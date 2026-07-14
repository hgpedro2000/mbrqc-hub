import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function requireAdmin(req: Request, admin: any) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Unauthorized", status: 401 };
  }
  const token = authHeader.replace("Bearer ", "");
  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userRes?.user) {
    return { error: "Unauthorized", status: 401 };
  }
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userRes.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) {
    return { error: "Forbidden: admin role required", status: 403 };
  }
  return { user: userRes.user };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const auth = await requireAdmin(req, admin);
    if ("error" in auth) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { employee_number, full_name, password, role, turno, email, empresa, empresa_terceira, cargo } = await req.json();

    if (!employee_number || !full_name) {
      return new Response(JSON.stringify({ error: "employee_number e full_name são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const internalEmail = `${employee_number}@internal.qhub`;
    const generatedTempPassword = crypto.randomUUID().replace(/-/g, "") + "!Aa1";
    const userPassword = password || generatedTempPassword;

    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email: internalEmail,
      password: userPassword,
      email_confirm: true,
    });

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authUser.user.id;

    await admin.from("profiles").insert({
      id: userId,
      employee_number,
      full_name,
      status: "active",
      must_change_password: true,
      password_changed_at: new Date().toISOString(),
      turno: turno || null,
      email: email || null,
      empresa: empresa || "mobis_brasil",
      empresa_terceira: empresa_terceira || null,
      cargo: cargo || null,
    });

    if (role) {
      await admin.from("user_roles").insert({ user_id: userId, role });
    }

    const defaultModules = ["subhub_qualidade", "apontamentos", "apontamentos_incoming", "consulta-pecas"];
    for (const mod of defaultModules) {
      await admin.from("user_module_permissions").insert({
        user_id: userId,
        module: mod,
        enabled: true,
      });
    }

    return new Response(
      JSON.stringify({ success: true, user_id: userId, email: internalEmail, temporary_password: password ? undefined : userPassword }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
