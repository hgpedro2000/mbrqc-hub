import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MIN_PASSWORD_LENGTH = 10;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function requireAdmin(req: Request, admin: any) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return { error: "Unauthorized", status: 401 };
  const token = authHeader.replace("Bearer ", "");
  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userRes?.user) return { error: "Unauthorized", status: 401 };
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userRes.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) return { error: "Forbidden: admin role required", status: 403 };
  return { user: userRes.user };
}

function generateTemporaryPassword() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0")).join("").slice(0, 16);
  return `Mobis@${token}A1`;
}

function passwordPolicyError(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) return `Senha deve ter ao menos ${MIN_PASSWORD_LENGTH} caracteres`;
  if (!/[A-Z]/.test(password)) return "Senha deve conter pelo menos 1 letra maiúscula";
  if (!/[0-9]/.test(password)) return "Senha deve conter pelo menos 1 número";
  if (!/[^A-Za-z0-9]/.test(password)) return "Senha deve conter pelo menos 1 caractere especial";
  return null;
}

function publicAuthErrorMessage(message?: string) {
  const raw = (message || "").toLowerCase();
  if (raw.includes("password") || raw.includes("senha") || raw.includes("weak") || raw.includes("breached")) {
    return "A senha foi recusada pela política de segurança. Use uma senha forte com 10+ caracteres, maiúscula, número e símbolo.";
  }
  if (raw.includes("user not found") || raw.includes("not found")) return "Usuário não encontrado no autenticador.";
  return message || "Falha ao atualizar a senha no autenticador.";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("reset-user-password missing required environment variables", {
        hasUrl: !!supabaseUrl,
        hasServiceRoleKey: !!serviceRoleKey,
      });
      return jsonResponse({ error: "Configuração do servidor indisponível para reset de senha." }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const auth = await requireAdmin(req, admin);
    if ("error" in auth) return jsonResponse({ error: auth.error }, auth.status);

    const body = await req.json().catch(() => ({}));
    const user_id = typeof body?.user_id === "string" ? body.user_id.trim() : "";
    const new_password = typeof body?.new_password === "string" ? body.new_password : "";

    if (!user_id) return jsonResponse({ error: "user_id é obrigatório" }, 400);

    const isOldUnsafeDefault = new_password.trim().toLowerCase() === "admin123*";
    const tempPassword = new_password && !isOldUnsafeDefault ? new_password.trim() : generateTemporaryPassword();
    const policyError = passwordPolicyError(tempPassword);
    if (policyError) return jsonResponse({ error: policyError }, 400);

    const { error: authError } = await admin.auth.admin.updateUserById(user_id, {
      password: tempPassword,
    });
    if (authError) {
      console.error("reset-user-password auth update failed", {
        user_id,
        status: (authError as any)?.status,
        code: (authError as any)?.code,
        message: authError.message,
      });
      return jsonResponse({ error: publicAuthErrorMessage(authError.message) }, 400);
    }

    const { error: profileError } = await admin.rpc("admin_set_must_change_password", {
      _user_id: user_id,
      _value: true,
    });
    if (profileError) {
      console.error("reset-user-password profile flag failed", {
        user_id,
        code: profileError.code,
        message: profileError.message,
      });
      return jsonResponse({ error: profileError.message }, 400);
    }

    if (body?.ticket_id && typeof body.ticket_id === "string") {
      const { error: ticketError } = await admin
        .from("error_reports")
        .update({
          status: "resolvido",
          admin_notes: typeof body?.admin_notes === "string" ? body.admin_notes : null,
        })
        .eq("id", body.ticket_id);

      if (ticketError) {
        console.error("reset-user-password ticket update failed", {
          ticket_id: body.ticket_id,
          code: ticketError.code,
          message: ticketError.message,
        });
        return jsonResponse({ error: "Senha redefinida, mas não foi possível fechar o chamado automaticamente." }, 400);
      }
    }

    return jsonResponse({
      success: true,
      temporary_password: tempPassword,
      generated: !new_password || isOldUnsafeDefault,
    });
  } catch (err) {
    console.error("reset-user-password unexpected error", {
      message: err instanceof Error ? err.message : String(err),
    });
    return jsonResponse({ error: "Erro interno ao redefinir senha." }, 500);
  }
});
