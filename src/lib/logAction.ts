// Audit log helper. Fire-and-forget — never blocks user flow nor throws.
// Inserts into public.audit_logs with the currently authenticated user.
import { supabase } from "@/integrations/supabase/client";

export type AuditModule =
  | "auth"
  | "alerta_qualidade"
  | "auditoria"
  | "tryout"
  | "apontamento"
  | "contencao"
  | "export"
  | "engenharia"
  | "outro";

export type AuditAction =
  | "login"
  | "logout"
  | "create"
  | "update"
  | "delete"
  | "validate_qr"
  | "export_pdf"
  | "export_excel"
  | "export_pptx"
  | string;

let cachedIp: string | null | undefined;

async function getIp(): Promise<string | null> {
  if (cachedIp !== undefined) return cachedIp;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch("https://api.ipify.org?format=json", { signal: ctrl.signal });
    clearTimeout(t);
    const j = await res.json();
    cachedIp = j?.ip ?? null;
  } catch {
    cachedIp = null;
  }
  return cachedIp;
}

export async function logAction(
  action: AuditAction,
  module: AuditModule | string,
  details: Record<string, any> = {}
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const ip = await getIp();
    await supabase.from("audit_logs" as any).insert({
      user_id: user?.id ?? null,
      user_email: user?.email ?? (details.email ?? null),
      action,
      module,
      details: details ?? {},
      ip_address: ip,
    });
  } catch (err) {
    // Never break the calling flow.
    console.warn("[audit] logAction failed", err);
  }
}
