import { supabase } from "@/integrations/supabase/client";

export type AuditAlertRow = {
  id: string;
  audit_id: string;
  type: "upcoming" | "supplier_overdue" | string;
  trigger_date: string;
  message: string;
  dismissed: boolean;
  created_at: string;
  audit?: { code: string | null; title: string; supplier_name: string; status: string } | null;
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a: Date, b: Date) =>
  Math.round((a.getTime() - b.getTime()) / 86400000);

/**
 * Client-side alert engine. Scans upcoming audits and overdue NCs
 * and upserts one alert row per (audit_id, type, trigger_date).
 */
export async function refreshAuditAlerts(): Promise<void> {
  const today = new Date(todayISO() + "T12:00:00");

  // Upcoming audits (planned, within next 3 days)
  const { data: audits } = await supabase
    .from("audits")
    .select("id, code, title, supplier_name, status, audit_date_start")
    .in("status", ["planejada", "em_andamento"])
    .not("audit_date_start", "is", null);

  const upserts: Array<{ audit_id: string; type: string; trigger_date: string; message: string }> = [];

  for (const a of audits ?? []) {
    if (!a.audit_date_start) continue;
    const start = new Date(a.audit_date_start + "T12:00:00");
    const diff = daysBetween(start, today);
    if (a.status === "planejada" && diff >= 0 && diff <= 3) {
      upserts.push({
        audit_id: a.id,
        type: "upcoming",
        trigger_date: todayISO(),
        message:
          diff === 0
            ? `Auditoria hoje — ${a.supplier_name}`
            : `Auditoria em ${diff} dia${diff > 1 ? "s" : ""} — ${a.supplier_name}`,
      });
    }
  }

  // Overdue supplier NCs (due_date < today, status != done)
  const { data: ncs } = await supabase
    .from("audit_ncs")
    .select("id, audit_id, seq_number, due_date, status, issue_category")
    .lt("due_date", todayISO())
    .neq("status", "done");

  if (ncs && ncs.length) {
    const auditIds = [...new Set(ncs.map((n: any) => n.audit_id))];
    const { data: auditRows } = await supabase
      .from("audits")
      .select("id, supplier_name")
      .in("id", auditIds);
    const sup = new Map((auditRows ?? []).map((r: any) => [r.id, r.supplier_name]));
    for (const n of ncs as any[]) {
      const overdue = daysBetween(today, new Date(n.due_date + "T12:00:00"));
      upserts.push({
        audit_id: n.audit_id,
        type: "supplier_overdue",
        trigger_date: todayISO(),
        message: `NC #${n.seq_number} atrasada ${overdue}d — ${sup.get(n.audit_id) ?? ""}`,
      });
    }
  }

  if (!upserts.length) return;
  await supabase
    .from("audit_alerts")
    .upsert(upserts, { onConflict: "audit_id,type,trigger_date", ignoreDuplicates: true });
}

export async function fetchActiveAlerts(): Promise<AuditAlertRow[]> {
  const { data, error } = await supabase
    .from("audit_alerts")
    .select("id, audit_id, type, trigger_date, message, dismissed, created_at, audit:audits(code,title,supplier_name,status)")
    .eq("dismissed", false)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data as any) ?? [];
}

export async function dismissAlert(id: string) {
  await supabase.from("audit_alerts").update({ dismissed: true }).eq("id", id);
}
