import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const employee_number = String(body?.employee_number ?? "").trim();
    const motivo = String(body?.motivo ?? "").trim().slice(0, 500);

    if (!employee_number) {
      return new Response(JSON.stringify({ error: "Informe o número de matrícula" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: pErr } = await admin
      .from("profiles")
      .select("id, full_name, employee_number, empresa, empresa_terceira, status, email")
      .eq("employee_number", employee_number)
      .maybeSingle();

    if (pErr) {
      return new Response(JSON.stringify({ error: pErr.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!profile) {
      return new Response(JSON.stringify({ error: "Matrícula não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (profile.status !== "active") {
      return new Response(JSON.stringify({ error: "Usuário inativo. Procure o administrador." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Avoid spamming: don't create another open request if one already exists for the same user.
    const { data: existing } = await admin
      .from("error_reports")
      .select("id, numero, status")
      .eq("user_id", profile.id)
      .eq("module", "Reset de Senha")
      .in("status", ["pendente", "em_andamento"])
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({
        success: true,
        already_open: true,
        numero: existing.numero,
        message: "Já existe uma solicitação em aberto. Aguarde o administrador.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const description = [
      `Solicitação de reset de senha sem e-mail cadastrado.`,
      `Matrícula: ${profile.employee_number}`,
      `Nome: ${profile.full_name}`,
      `Empresa: ${profile.empresa || profile.empresa_terceira || "—"}`,
      motivo ? `Motivo: ${motivo}` : null,
    ].filter(Boolean).join("\n");

    const { data: inserted, error: iErr } = await admin
      .from("error_reports")
      .insert({
        user_id: profile.id,
        user_name: profile.full_name,
        module: "Reset de Senha",
        description,
        status: "pendente",
      })
      .select("id, numero")
      .single();

    if (iErr) {
      return new Response(JSON.stringify({ error: iErr.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, numero: inserted.numero }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
