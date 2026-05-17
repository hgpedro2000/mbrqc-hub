import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Allowed enums (mirrors DB CHECK constraints)
const TIPO = ["defeito_processo", "defeito_peca", "parada_linha", "incoming", "peca", "processo", "oem"] as const;
const STATUS = ["aberto", "em_analise", "acao_definida", "concluido", "cancelado", "draft", "submitted"] as const;

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const nullableStr = (max = 2000) =>
  z.union([z.string().max(max), z.null()]).optional();
const nullableInt = () => z.union([z.number().int().min(0).max(1_000_000), z.null()]).optional();

// Schema covers ONLY fields the form is allowed to update.
// Unknown keys are stripped (strict() would reject; we keep the call resilient
// and instead drop unknowns in code to provide clearer errors).
const PayloadSchema = z.object({
  tipo: z.enum(TIPO).optional(),
  titulo: z.string().min(1).max(500).optional(),
  responsavel: z.string().min(1).max(255).optional(),
  data: z.string().regex(dateRe, "Data deve estar no formato YYYY-MM-DD").optional(),
  turno: nullableStr(50),
  fase: nullableStr(100),
  projeto: nullableStr(255),
  fornecedor: nullableStr(255),
  part_number: nullableStr(255),
  part_name: nullableStr(500),
  descricao: z.string().min(1).max(5000).optional(),
  quantidade_inspecionada: nullableInt(),
  quantidade_ng: nullableInt(),
  quantidade_ok: nullableInt(),
  lote_inspecionado: nullableStr(255),
  modo_falha: nullableStr(500),
  parada_linha: z.union([z.enum(["sim", "nao"]), z.null()]).optional(),
  parada_linha_tempo: nullableStr(100),
  local_deteccao: nullableStr(255),
  vin_number: nullableStr(100),
  responsabilidade_defeito: nullableStr(255),
  quantidade_detectado: nullableInt(),
  lancamento: nullableStr(255),
  analise_inicial: nullableStr(5000),
  acao_imediata: nullableStr(5000),
  comentario_adicional: nullableStr(5000),
  segundo_defeitos: z.array(z.record(z.unknown())).optional(),
  status: z.enum(STATUS).optional(),
  co_inspetores: z.array(z.unknown()).optional(),
  tempo_inspecao: nullableStr(255),
  numero_tag: nullableStr(100),
  alc_code: nullableStr(100),
  alc_expected: nullableStr(100),
  alc_validation_method: nullableStr(20),
  alc_validation_status: nullableStr(20),
}).passthrough(); // we'll filter unknowns explicitly below

const ALLOWED_KEYS = new Set(Object.keys(PayloadSchema.shape));
// Fields the client must NEVER overwrite
const PROTECTED_KEYS = new Set([
  "id", "created_by", "created_at", "updated_at",
  "numero", "last_edited_at", "last_edited_by",
  "tag_inserted_at", "tag_inserted_by", "tag_number",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json(401, { error: "Não autenticado", code: "UNAUTHENTICATED" });

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !userData?.user) {
      return json(401, { error: "Sessão inválida ou expirada", code: "INVALID_SESSION" });
    }
    const callerId = userData.user.id;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json(400, { error: "Corpo da requisição inválido", code: "INVALID_BODY" });
    }
    const { id, payload, impersonatedUserId } = body as {
      id?: string; payload?: Record<string, unknown>; impersonatedUserId?: string | null;
    };

    if (!id || typeof id !== "string" || !uuidRe.test(id)) {
      return json(400, { error: "ID do apontamento inválido", code: "INVALID_ID" });
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return json(400, { error: "Payload inválido", code: "INVALID_PAYLOAD" });
    }
    if (impersonatedUserId && (typeof impersonatedUserId !== "string" || !uuidRe.test(impersonatedUserId))) {
      return json(400, { error: "ID do usuário simulado inválido", code: "INVALID_IMPERSONATION" });
    }

    // Pre-strip protected + unknown keys, then validate
    const filtered: Record<string, unknown> = {};
    const droppedUnknown: string[] = [];
    const droppedProtected: string[] = [];
    for (const [k, v] of Object.entries(payload)) {
      if (PROTECTED_KEYS.has(k)) { droppedProtected.push(k); continue; }
      if (!ALLOWED_KEYS.has(k)) { droppedUnknown.push(k); continue; }
      filtered[k] = v;
    }

    const parsed = PayloadSchema.safeParse(filtered);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstField = Object.keys(fieldErrors)[0];
      const firstMsg = firstField ? `${firstField}: ${fieldErrors[firstField]?.[0]}` : "Dados inválidos";
      return json(400, {
        error: `Validação falhou — ${firstMsg}`,
        code: "VALIDATION_FAILED",
        fields: fieldErrors,
        droppedUnknown,
      });
    }
    const safe: Record<string, unknown> = { ...parsed.data };

    const admin = createClient(supabaseUrl, serviceKey);

    // Caller admin role
    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();
    const callerIsAdmin = !!roleRow;

    // Load record
    const { data: record, error: recErr } = await admin
      .from("apontamentos").select("id, created_by").eq("id", id).maybeSingle();
    if (recErr) return json(500, { error: "Erro ao carregar apontamento", code: "DB_READ_ERROR" });
    if (!record) return json(404, { error: "Apontamento não encontrado", code: "NOT_FOUND" });

    // Authorization
    let isOwnerEdit = false;
    if (impersonatedUserId) {
      if (!callerIsAdmin) {
        return json(403, { error: "Apenas administradores podem usar o modo teste", code: "IMPERSONATION_FORBIDDEN" });
      }
      if (record.created_by !== impersonatedUserId) {
        return json(403, {
          error: "Modo teste: este apontamento não pertence ao usuário simulado.",
          code: "IMPERSONATION_OWNERSHIP_MISMATCH",
        });
      }
      isOwnerEdit = true;
    } else {
      const isOwner = record.created_by === callerId;
      if (!isOwner && !callerIsAdmin) {
        return json(403, { error: "Sem permissão para editar este apontamento", code: "FORBIDDEN" });
      }
      isOwnerEdit = isOwner && !callerIsAdmin;
    }

    if (isOwnerEdit) {
      const { data: prof } = await admin
        .from("profiles").select("full_name, email").eq("id", impersonatedUserId || callerId).maybeSingle();
      safe.last_edited_at = new Date().toISOString();
      safe.last_edited_by = prof?.full_name || prof?.email || "Usuário";
    }

    const { error: updErr } = await admin.from("apontamentos").update(safe).eq("id", id);
    if (updErr) {
      return json(400, { error: updErr.message, code: "DB_UPDATE_ERROR" });
    }

    return json(200, { ok: true, droppedUnknown, droppedProtected });
  } catch (err) {
    return json(500, { error: (err as Error).message || "Erro interno", code: "INTERNAL_ERROR" });
  }
});
