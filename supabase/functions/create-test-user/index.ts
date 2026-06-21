import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TEST_EMPLOYEE_NUMBER = "99999";
const TEST_EMAIL = `${TEST_EMPLOYEE_NUMBER}@internal.qhub`;
const TEST_PASSWORD = "Teste@1234";
const TEST_FULL_NAME = "Usuário Teste (sem MFA)";

async function requireAdmin(req: Request, admin: any) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return { error: "Unauthorized", status: 401 };
  const token = authHeader.replace("Bearer ", "");
  const { data: userRes, error } = await admin.auth.getUser(token);
  if (error || !userRes?.user) return { error: "Unauthorized", status: 401 };
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userRes.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) return { error: "Forbidden: admin role required", status: 403 };
  return { user: userRes.user };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const auth = await requireAdmin(req, admin);
    if ("error" in auth) return json({ error: auth.error }, auth.status);

    // Check if user already exists (by internal email)
    let userId: string | null = null;
    const { data: existingList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = existingList?.users?.find((u: any) => u.email === TEST_EMAIL);

    if (existing) {
      userId = existing.id;
      // Reset password + ensure no MFA factors
      await admin.auth.admin.updateUserById(userId, {
        password: TEST_PASSWORD,
        email_confirm: true,
      });
      const { data: factors } = await admin.auth.admin.mfa.listFactors({ userId });
      for (const f of factors?.factors || []) {
        await admin.auth.admin.mfa.deleteFactor({ userId, id: f.id });
      }
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        email_confirm: true,
      });
      if (createErr || !created?.user) return json({ error: createErr?.message || "createUser failed" }, 400);
      userId = created.user.id;
    }

    // Upsert profile — non-admin, no password change required
    await admin.from("profiles").upsert({
      id: userId,
      employee_number: TEST_EMPLOYEE_NUMBER,
      full_name: TEST_FULL_NAME,
      status: "active",
      must_change_password: false,
      turno: "ADM",
      email: null,
      empresa: "mobis_brasil",
      empresa_terceira: null,
      cargo: "Inspetor de Teste",
    });

    // Remove any admin role so MFA is NOT required
    await admin.from("user_roles").delete().eq("user_id", userId);

    // Grant all module permissions so the test covers everything
    const modules = [
      "apontamentos", "consulta_pecas", "alerta_qualidade", "matriz_versatilidade",
      "consumiveis", "auditorias", "contencao", "engenharia", "tryout",
    ];
    await admin.from("user_module_permissions").delete().eq("user_id", userId);
    await admin.from("user_module_permissions").insert(
      modules.map((m) => ({ user_id: userId, module: m, enabled: true })),
    );

    return json({
      success: true,
      employee_number: TEST_EMPLOYEE_NUMBER,
      password: TEST_PASSWORD,
      message: "Usuário de teste pronto. Faça login com matrícula 99999 e senha Teste@1234.",
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
