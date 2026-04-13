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
    const { employee_number, full_name, password, role, turno, email, empresa, empresa_terceira, cargo } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const internalEmail = `${employee_number}@internal.qhub`;

    // Use provided password or default to 123456
    const userPassword = password || "123456";

    // Create auth user
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

    // Create profile with turno, email, empresa fields
    await admin.from("profiles").insert({
      id: userId,
      employee_number,
      full_name,
      status: "active",
      must_change_password: true,
      turno: turno || null,
      email: email || null,
      empresa: empresa || "mobis_brasil",
      empresa_terceira: empresa_terceira || null,
      cargo: cargo || null,
    });

    // Assign role
    if (role) {
      await admin.from("user_roles").insert({
        user_id: userId,
        role,
      });
    }

    // Auto-assign default module permissions: Apontamentos + Consulta de Peças
    const defaultModules = ["apontamentos", "consulta_pecas"];
    for (const mod of defaultModules) {
      await admin.from("user_module_permissions").insert({
        user_id: userId,
        module: mod,
        enabled: true,
      });
    }

    return new Response(
      JSON.stringify({ success: true, user_id: userId, email: internalEmail }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
