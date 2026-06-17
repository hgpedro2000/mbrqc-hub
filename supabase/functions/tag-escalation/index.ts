import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Require shared cron secret to prevent abuse
  const cronSecret = Deno.env.get("CRON_SECRET");
  const reqSecret = req.headers.get("x-cron-secret");
  if (!cronSecret || reqSecret !== cronSecret) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find NG apontamentos without TAG older than 3 days
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const cutoffDate = threeDaysAgo.toISOString().split("T")[0];

    const { data: overdue, error: fetchErr } = await supabase
      .from("apontamentos")
      .select("id, numero, part_number, part_name, fornecedor, data, responsavel, quantidade_ng, turno")
      .neq("status", "draft")
      .gt("quantidade_ng", 0)
      .is("numero_tag", null)
      .lte("data", cutoffDate)
      .order("data", { ascending: true });

    if (fetchErr) throw fetchErr;

    if (!overdue || overdue.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhum apontamento pendente de TAG." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build description
    const lines = overdue.map(
      (a: any) =>
        `• ${a.numero || "S/N"} | ${a.part_number || "—"} | ${a.fornecedor || "—"} | Data: ${a.data} | NG: ${a.quantidade_ng} | Turno: ${a.turno || "—"}`
    );

    const description = `Existem ${overdue.length} apontamento(s) com NG sem número de TAG há mais de 3 dias:\n\n${lines.join("\n")}`;

    // Get any admin user to use as user_id
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();

    const userId = adminRole?.user_id || "00000000-0000-0000-0000-000000000000";

    const { error: insertErr } = await supabase.from("error_reports").insert({
      module: "Escalação Automática — TAG Pendente",
      description,
      user_name: "Sistema Automático",
      user_id: userId,
      status: "pendente",
    });

    if (insertErr) throw insertErr;

    return new Response(
      JSON.stringify({ message: `Escalação criada para ${overdue.length} apontamento(s).` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
