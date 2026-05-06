import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json(401, { error: "Não autenticado" });

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json(401, { error: "Sessão inválida" });
    const callerId = userData.user.id;

    const body = await req.json().catch(() => null);
    const { id, numero_tag, impersonatedUserId } = (body || {}) as {
      id?: string; numero_tag?: string; impersonatedUserId?: string | null;
    };
    if (!id || !numero_tag || !numero_tag.trim()) {
      return json(400, { error: "ID e numero_tag são obrigatórios" });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Determine acting user (impersonation only allowed for admins)
    let actingUserId = callerId;
    if (impersonatedUserId) {
      const { data: adminRow } = await admin
        .from("user_roles").select("role")
        .eq("user_id", callerId).eq("role", "admin").maybeSingle();
      if (!adminRow) return json(403, { error: "Apenas admins podem impersonar" });
      actingUserId = impersonatedUserId;
    }

    // Permission check: admin/lider/engenharia OR cargo contains supervisor/gerente/qualidade
    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", actingUserId).maybeSingle();
    const role = roleRow?.role || "user";
    const { data: prof } = await admin
      .from("profiles").select("full_name, cargo, empresa, empresa_terceira").eq("id", actingUserId).maybeSingle();
    const cargo = (prof?.cargo || "").toLowerCase();
    const isThirdParty = prof?.empresa === "empresa_terceira" || !!prof?.empresa_terceira;
    const allowedRoles = ["admin", "lider", "engenharia"];
    const allowedCargos = ["supervisor", "gerente", "analista de qualidade", "lider de qualidade"];
    const canTag = !isThirdParty && (
      allowedRoles.includes(role) || allowedCargos.some(c => cargo.includes(c))
    );
    if (!canTag) return json(403, { error: "Sem permissão para inserir TAG" });

    const { error: updErr } = await admin
      .from("apontamentos")
      .update({
        numero_tag: numero_tag.trim(),
        tag_inserted_at: new Date().toISOString(),
        tag_inserted_by: prof?.full_name || "",
      })
      .eq("id", id);
    if (updErr) return json(400, { error: updErr.message });

    return json(200, { ok: true });
  } catch (err) {
    return json(500, { error: (err as Error).message });
  }
});
