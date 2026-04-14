const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getAssistantText(payload: any): string {
  const content = payload?.choices?.[0]?.message?.content;

  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        return item?.text || "";
      })
      .join("\n");
  }

  return "";
}

function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeCode(value?: string | null) {
  if (!value) return null;
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return normalized || null;
}

function extractPartNumberFromText(text?: string | null) {
  if (!text) return null;

  const upper = text.toUpperCase();
  const patterns = [
    /\b\d{5}(?:[-\s.]?[A-Z0-9]{5,8})\b/g,
    /\b\d{5}[A-Z0-9]{5,8}\b/g,
  ];

  for (const pattern of patterns) {
    const matches = upper.match(pattern) || [];
    const valid = matches
      .map((match) => normalizeCode(match))
      .find((match) => match && match.length >= 10);

    if (valid) return valid;
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { images } = await req.json();

    if (!Array.isArray(images) || images.length === 0) {
      return jsonResponse({ error: "Nenhuma imagem enviada." }, 400);
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return jsonResponse({ error: "Serviço de análise visual não configurado." }, 500);
    }

    const imageParts = images
      .filter((value) => typeof value === "string" && value.startsWith("data:image/"))
      .slice(0, 2)
      .map((url) => ({ type: "image_url", image_url: { url } }));

    if (imageParts.length === 0) {
      return jsonResponse({ error: "Formato de imagem inválido." }, 400);
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 0.1,
        max_tokens: 300,
        messages: [
          {
            role: "system",
            content:
              "Você extrai dados visíveis de etiquetas Hyundai Mobis em fotos reais de celular. Nao decodifique o Data Matrix em si; leia apenas o texto humano visível impresso na etiqueta. Retorne somente JSON com as chaves partNumber, lotNumber e visibleText. O part number pode aparecer com ou sem hífen, ponto ou espaço. Se os separadores estiverem ambíguos, retorne o código alfanumérico sem espaços. Nunca invente valores.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Analise a(s) imagem(ns). Elas podem ser screenshots da câmera. Foque na etiqueta amarela e extraia o part number visível e o lote/data se estiverem legíveis. Responda apenas com JSON.",
              },
              ...imageParts,
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return jsonResponse({ error: errorText || "Falha ao analisar imagem." }, 500);
    }

    const completion = await response.json();
    const assistantText = getAssistantText(completion);
    const parsed = extractJson(assistantText) || {};

    const visibleText = typeof parsed.visibleText === "string" ? parsed.visibleText.trim() : null;
    const partNumber = normalizeCode(parsed.partNumber) || extractPartNumberFromText(visibleText);
    const lotNumber = normalizeCode(parsed.lotNumber);

    return jsonResponse({
      partNumber,
      lotNumber,
      visibleText,
      raw: assistantText,
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
