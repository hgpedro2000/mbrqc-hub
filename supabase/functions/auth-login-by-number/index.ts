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
    const { employee_number, password } = await req.json();

    if (!employee_number || !password) {
      return new Response(
        JSON.stringify({ error: "Número do usuário e senha são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Look up the profile by employee number
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, employee_number, full_name, status, must_change_password")
      .eq("employee_number", employee_number)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Usuário não encontrado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (profile.status !== "active") {
      return new Response(
        JSON.stringify({ error: "Usuário inativo. Contate o administrador." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // The internal email is {employee_number}@internal.qhub
    const internalEmail = `${employee_number}@internal.qhub`;

    // Sign in with the internal email
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const supabaseAnon = createClient(supabaseUrl, anonKey);

    const { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({
      email: internalEmail,
      password,
    });

    if (authError) {
      return new Response(
        JSON.stringify({ error: "Senha incorreta" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update last_login_at
    await supabaseAdmin
      .from("profiles")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", profile.id);

    return new Response(
      JSON.stringify({
        session: authData.session,
        user: authData.user,
        profile: {
          full_name: profile.full_name,
          employee_number: profile.employee_number,
          must_change_password: profile.must_change_password,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
