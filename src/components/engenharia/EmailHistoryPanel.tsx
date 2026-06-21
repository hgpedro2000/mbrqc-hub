import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Send as SendIcon, History, RotateCw, Mail } from "lucide-react";

type LogRow = any;

export interface HistoryPanelProps {
  modulo: string;
  /** Maps configId → subtipo label (for resend dispatch) */
  configSubtipo: Map<string, string>;
  /** Edge function name used to invoke for resend (subtipo passed through) */
  senderFn: string;
  title?: string;
  /** Maps configId → display name */
  configName?: Map<string, string>;
  /** Optional: extra body fields for resend, computed from log row */
  buildResendBody?: (log: LogRow) => Record<string, any>;
}

const StatusBadge = ({ s }: { s: string }) => (
  <Badge variant={
    s === "sent" || s === "queued" ? "default"
    : s === "failed" ? "destructive"
    : "secondary"
  }>{s}</Badge>
);

export const HistoryPanel = ({
  modulo, configSubtipo, senderFn, title, configName, buildResendBody,
}: HistoryPanelProps) => {
  const qc = useQueryClient();

  const { data: logs = [] } = useQuery({
    queryKey: ["email_automation_log", modulo],
    queryFn: async () => {
      const { data } = await supabase
        .from("email_automation_log" as any)
        .select("*")
        .eq("modulo", modulo)
        .order("created_at", { ascending: false })
        .limit(60);
      return (data as LogRow[]) ?? [];
    },
    refetchInterval: 15000,
  });

  // Per-subtipo summary (group by config_id → subtipo)
  const summary = useMemo(() => {
    const acc = new Map<string, {
      subtipo: string;
      name: string;
      total: number;
      sent: number;
      queued: number;
      failed: number;
      draft: number;
      attempts: number;
      byRecipient: Map<string, { sent: number; failed: number }>;
      lastAt: string | null;
    }>();
    for (const l of logs) {
      const subtipo = configSubtipo.get(l.config_id) ?? (l.tipo_disparo || "—");
      const key = `${l.config_id}::${subtipo}`;
      if (!acc.has(key)) {
        acc.set(key, {
          subtipo,
          name: configName?.get(l.config_id) ?? subtipo,
          total: 0, sent: 0, queued: 0, failed: 0, draft: 0, attempts: 0,
          byRecipient: new Map(), lastAt: null,
        });
      }
      const it = acc.get(key)!;
      it.total += 1;
      if (l.status === "sent") it.sent += 1;
      else if (l.status === "queued" || l.status === "pending") it.queued += 1;
      else if (l.status === "failed") it.failed += 1;
      else if (l.status === "draft") it.draft += 1;
      if (l.attempt && l.attempt > 0) it.attempts += l.attempt;
      const recipients: string[] = l.recipients ?? [];
      for (const r of recipients) {
        if (!it.byRecipient.has(r)) it.byRecipient.set(r, { sent: 0, failed: 0 });
        const rb = it.byRecipient.get(r)!;
        if (l.status === "sent" || l.status === "queued") rb.sent += 1;
        else if (l.status === "failed") rb.failed += 1;
      }
      if (!it.lastAt || new Date(l.created_at) > new Date(it.lastAt)) it.lastAt = l.created_at;
    }
    return Array.from(acc.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [logs, configSubtipo, configName]);

  const resendMut = useMutation({
    mutationFn: async (log: LogRow) => {
      const subtipo = configSubtipo.get(log.config_id) ?? (log.tipo_disparo === "evento" ? "evento" : "agendado");
      const extra = buildResendBody ? buildResendBody(log) : {};
      const { data, error } = await supabase.functions.invoke(senderFn, {
        body: { config_id: log.config_id, subtipo, resend: true, ...extra },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast.success("Reenvio enfileirado");
      qc.invalidateQueries({ queryKey: ["email_automation_log", modulo] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {/* Status panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-5 w-5" /> Status por subtipo — {title ?? modulo}
          </CardTitle>
          <CardDescription>Resumo dos últimos 60 envios agrupados por configuração.</CardDescription>
        </CardHeader>
        <CardContent>
          {summary.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sem dados ainda.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {summary.map((s, i) => (
                <div key={i} className="border rounded p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-sm">{s.name}</div>
                    <Badge variant="outline">{s.subtipo}</Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="rounded bg-muted p-2">
                      <div className="text-base font-semibold">{s.total}</div>
                      <div className="text-muted-foreground">Total</div>
                    </div>
                    <div className="rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 p-2">
                      <div className="text-base font-semibold">{s.sent + s.queued}</div>
                      <div>Sucesso</div>
                    </div>
                    <div className="rounded bg-destructive/10 text-destructive p-2">
                      <div className="text-base font-semibold">{s.failed}</div>
                      <div>Falhas</div>
                    </div>
                    <div className="rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 p-2">
                      <div className="text-base font-semibold">{s.attempts}</div>
                      <div>Tentativas</div>
                    </div>
                  </div>
                  {s.byRecipient.size > 0 && (
                    <div className="text-xs">
                      <div className="text-muted-foreground mb-1">Por destinatário</div>
                      <div className="max-h-28 overflow-y-auto space-y-1">
                        {Array.from(s.byRecipient.entries()).map(([r, c]) => (
                          <div key={r} className="flex items-center justify-between gap-2 border rounded px-2 py-1">
                            <span className="truncate">{r}</span>
                            <span className="flex items-center gap-2 shrink-0">
                              <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="h-3 w-3" />{c.sent}
                              </span>
                              <span className="flex items-center gap-1 text-destructive">
                                <XCircle className="h-3 w-3" />{c.failed}
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {s.lastAt && (
                    <div className="text-[11px] text-muted-foreground">
                      Último envio: {new Date(s.lastAt).toLocaleString("pt-BR")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed history */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-5 w-5" /> Histórico de envios
          </CardTitle>
          <CardDescription>Últimos 60 envios (atualiza a cada 15s).</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sem envios registrados ainda.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.map((l: any) => (
                <div key={l.id} className="flex items-center justify-between gap-3 text-sm border rounded p-2 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <div className="font-medium truncate">{l.subject ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(l.created_at).toLocaleString("pt-BR")} • {l.tipo_disparo} • {l.trigger_type}
                      {l.attempt && l.attempt > 1 ? ` • tentativa ${l.attempt}` : ""}
                      {l.recipients?.length ? ` • ${l.recipients.length} dest.` : ""}
                    </div>
                    {l.error_message && (
                      <div className="text-xs text-destructive mt-1 line-clamp-2">{l.error_message}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge s={l.status} />
                    {(l.status === "failed" || l.status === "draft") && l.config_id && (
                      <Button size="sm" variant="ghost" onClick={() => resendMut.mutate(l)} disabled={resendMut.isPending}>
                        <RotateCw className="h-3 w-3 mr-1" /> Reenviar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default HistoryPanel;
