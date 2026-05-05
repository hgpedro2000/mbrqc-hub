import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const { id, payload, impersonatedUserId } = body as {
      id?: string; payload?: Record<string, unknown>; impersonatedUserId?: string | null;
    };
    if (!id || !payload || typeof payload !== "object") {
      return new Response(JSON.stringify({ error: "Parâmetros inválidos" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Caller admin role
    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();
    const callerIsAdmin = !!roleRow;

    // Load record
    const { data: record, error: recErr } = await admin
      .from("apontamentos").select("id, created_by").eq("id", id).maybeSingle();
    if (recErr || !record) {
      return new Response(JSON.stringify({ error: "Apontamento não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorization
    let isOwnerEdit = false;
    if (impersonatedUserId) {
      if (!callerIsAdmin) {
        return new Response(JSON.stringify({ error: "Apenas administradores podem usar o modo teste" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (record.created_by !== impersonatedUserId) {
        return new Response(JSON.stringify({
          error: "Modo teste: este apontamento não pertence ao usuário simulado.",
        }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      isOwnerEdit = true; // simulated owner edit -> stamp
    } else {
      const isOwner = record.created_by === callerId;
      if (!isOwner && !callerIsAdmin) {
        return new Response(JSON.stringify({ error: "Sem permissão para editar este apontamento" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      isOwnerEdit = isOwner && !callerIsAdmin;
    }

    // Strip protected fields the client must never overwrite
    const safe: Record<string, unknown> = { ...payload };
    delete safe.id;
    delete safe.created_by;
    delete safe.created_at;
    delete safe.numero;
    delete safe.last_edited_at;
    delete safe.last_edited_by;

    if (isOwnerEdit) {
      const { data: prof } = await admin
        .from("profiles").select("full_name, email").eq("id", impersonatedUserId || callerId).maybeSingle();
      safe.last_edited_at = new Date().toISOString();
      safe.last_edited_by = prof?.full_name || prof?.email || "Usuário";
    }

    const { error: updErr } = await admin.from("apontamentos").update(safe).eq("id", id);
    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message || "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
