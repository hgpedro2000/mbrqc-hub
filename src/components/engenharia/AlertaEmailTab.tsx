import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, X, Send, Save, Eye, Loader2, History, AlertTriangle, RotateCw, Bell, CalendarClock } from "lucide-react";

interface AlertaConfig {
  id: string;
  name: string;
  modulo: string;
  subtipo: "imediato" | "agendado";
  enabled: boolean;
  schedule_time: string;
  timezone: string;
  weekdays: number[];
  recipients: string[];
  error_notify_recipients: string[];
  subject_template: string;
  message_body: string;
  last_sent_at: string | null;
}

const WEEKDAYS = [
  { v: 1, l: "Seg" }, { v: 2, l: "Ter" }, { v: 3, l: "Qua" },
  { v: 4, l: "Qui" }, { v: 5, l: "Sex" }, { v: 6, l: "Sáb" }, { v: 0, l: "Dom" },
];

const IMMEDIATE_VARS = [
  "numero_alerta", "modelo", "modo_falha", "linha_peca", "local_detectado",
  "data_ocorrencia", "data_validade", "turno", "responsabilidade",
  "descricao", "link_qrcode", "date",
];
const WEEKLY_VARS = ["date", "period", "total_pendentes", "total_vencidos"];

const ConfigCard = ({
  config,
  vars,
  isWeekly,
}: {
  config: AlertaConfig;
  vars: string[];
  isWeekly: boolean;
}) => {
  const qc = useQueryClient();
  const [form, setForm] = useState<AlertaConfig>(config);
  const [newRecipient, setNewRecipient] = useState("");
  const [newErr, setNewErr] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{ subject: string; html: string } | null>(null);

  useEffect(() => { setForm(config); }, [config]);

  const save = useMutation({
    mutationFn: async (payload: Partial<AlertaConfig>) => {
      const { error } = await supabase
        .from("email_automation_config" as any)
        .update(payload).eq("id", form.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email_automation_config", "alerta_qualidade"] });
      toast.success("Configuração salva");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const invokeSend = async (extra: Record<string, any> = {}) => {
    const { data, error } = await supabase.functions.invoke("send-alerta-email", {
      body: { config_id: form.id, subtipo: form.subtipo, ...extra },
    });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
    return data as any;
  };

  const previewMut = useMutation({
    mutationFn: () => invokeSend({ preview: true }),
    onSuccess: (d: any) => {
      setPreviewData({ subject: d.subject, html: d.html });
      setPreviewOpen(true);
    },
    onError: (e: any) => toast.error(`Falha no preview: ${e.message}`),
  });

  const testMut = useMutation({
    mutationFn: () => {
      if (!testEmail) throw new Error("Informe um e-mail para o teste");
      return invokeSend({ test_to: testEmail });
    },
    onSuccess: () => {
      toast.success(`Teste enviado para ${testEmail}`);
      qc.invalidateQueries({ queryKey: ["email_automation_log", "alerta_qualidade"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const manualMut = useMutation({
    mutationFn: () => invokeSend({}),
    onSuccess: (d: any) => {
      if (d.skipped) toast.info("Já existe um envio para hoje (idempotência).");
      else toast.success(`Enfileirado para ${d.queued} destinatário(s).`);
      qc.invalidateQueries({ queryKey: ["email_automation_log", "alerta_qualidade"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {isWeekly ? <CalendarClock className="h-5 w-5 text-primary" /> : <Bell className="h-5 w-5 text-primary" />}
            <CardTitle className="text-base">{form.name}</CardTitle>
            <Badge variant={form.enabled ? "default" : "secondary"}>
              {form.enabled ? "Ativa" : "Desativada"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm">Ativada</Label>
            <Switch
              checked={form.enabled}
              onCheckedChange={(v) => { setForm({ ...form, enabled: v }); save.mutate({ enabled: v }); }}
            />
          </div>
        </div>
        <CardDescription>
          {isWeekly
            ? "Resumo semanal de alertas pendentes de assinatura e vencidos. Reaproveita o mesmo worker e idempotência."
            : "Disparado automaticamente assim que um novo Alerta de Qualidade é criado."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Schedule (only weekly) */}
        {isWeekly && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Horário</Label>
              <Input
                type="time"
                value={form.schedule_time?.slice(0, 5) ?? "08:00"}
                onChange={(e) => setForm({ ...form, schedule_time: e.target.value })}
              />
            </div>
            <div>
              <Label>Fuso horário</Label>
              <Input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
            </div>
            <div className="md:col-span-1">
              <Label>Dias da semana</Label>
              <div className="flex flex-wrap gap-1 mt-2">
                {WEEKDAYS.map((d) => {
                  const on = form.weekdays?.includes(d.v);
                  return (
                    <Button
                      key={d.v}
                      type="button"
                      size="sm"
                      variant={on ? "default" : "outline"}
                      onClick={() => setForm({
                        ...form,
                        weekdays: on ? form.weekdays.filter((x) => x !== d.v) : [...(form.weekdays ?? []), d.v],
                      })}
                    >{d.l}</Button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Recipients */}
        <div>
          <Label>Destinatários ({form.recipients?.length ?? 0})</Label>
          <div className="flex gap-2 mt-1">
            <Input placeholder="email@exemplo.com" value={newRecipient}
              onChange={(e) => setNewRecipient(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newRecipient) {
                  setForm({ ...form, recipients: [...(form.recipients ?? []), newRecipient.trim()] });
                  setNewRecipient("");
                }
              }} />
            <Button type="button" size="icon" variant="outline" onClick={() => {
              if (!newRecipient) return;
              setForm({ ...form, recipients: [...(form.recipients ?? []), newRecipient.trim()] });
              setNewRecipient("");
            }}><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {(form.recipients ?? []).map((r, i) => (
              <Badge key={i} variant="outline" className="gap-1">
                {r}
                <button type="button" onClick={() => setForm({ ...form, recipients: form.recipients.filter((_, j) => j !== i) })}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        {/* Error alerts */}
        <div>
          <Label className="flex items-center gap-2"><AlertTriangle className="h-3 w-3" /> Alertas de falha ({form.error_notify_recipients?.length ?? 0})</Label>
          <div className="flex gap-2 mt-1">
            <Input placeholder="admin@exemplo.com" value={newErr} onChange={(e) => setNewErr(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newErr) {
                  setForm({ ...form, error_notify_recipients: [...(form.error_notify_recipients ?? []), newErr.trim()] });
                  setNewErr("");
                }
              }} />
            <Button type="button" size="icon" variant="outline" onClick={() => {
              if (!newErr) return;
              setForm({ ...form, error_notify_recipients: [...(form.error_notify_recipients ?? []), newErr.trim()] });
              setNewErr("");
            }}><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {(form.error_notify_recipients ?? []).map((r, i) => (
              <Badge key={i} variant="outline" className="gap-1">{r}
                <button type="button" onClick={() => setForm({ ...form, error_notify_recipients: form.error_notify_recipients.filter((_, j) => j !== i) })}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        {/* Subject + body */}
        <div>
          <Label>Assunto</Label>
          <Input value={form.subject_template} onChange={(e) => setForm({ ...form, subject_template: e.target.value })} />
        </div>
        <div>
          <Label>Mensagem</Label>
          <Textarea rows={6} value={form.message_body} onChange={(e) => setForm({ ...form, message_body: e.target.value })} />
          <div className="text-xs text-muted-foreground mt-1">
            Variáveis: {vars.map((v) => <code key={v} className="bg-muted px-1 mx-0.5 rounded">{`{{${v}}}`}</code>)}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 pt-2 border-t">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => save.mutate({
              schedule_time: form.schedule_time, timezone: form.timezone, weekdays: form.weekdays,
              recipients: form.recipients, error_notify_recipients: form.error_notify_recipients,
              subject_template: form.subject_template, message_body: form.message_body,
            })} disabled={save.isPending} className="flex-1 sm:flex-none">
              <Save className="h-4 w-4 mr-2" /> Salvar
            </Button>
            <Button variant="outline" onClick={() => previewMut.mutate()} disabled={previewMut.isPending} className="flex-1 sm:flex-none">
              {previewMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />} Preview
            </Button>
            <Button variant="outline" onClick={() => manualMut.mutate()} disabled={manualMut.isPending} className="flex-1 sm:flex-none">
              {manualMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />} Enviar agora
            </Button>
          </div>
          <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
            <Input className="flex-1 sm:w-56 min-w-0" placeholder="teste@exemplo.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
            <Button variant="secondary" onClick={() => testMut.mutate()} disabled={testMut.isPending || !testEmail} className="shrink-0">
              {testMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />} Teste
            </Button>
          </div>
        </div>
        {form.last_sent_at && (
          <p className="text-xs text-muted-foreground">Último envio: {new Date(form.last_sent_at).toLocaleString("pt-BR")}</p>
        )}
      </CardContent>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Preview — {previewData?.subject}</DialogTitle>
            <DialogDescription>Renderização exata do e-mail que será enviado.</DialogDescription>
          </DialogHeader>
          <iframe srcDoc={previewData?.html ?? ""} className="flex-1 w-full border rounded" />
        </DialogContent>
      </Dialog>
    </Card>
  );
};

const AlertaEmailTab = () => {
  const qc = useQueryClient();

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["email_automation_config", "alerta_qualidade"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_automation_config" as any)
        .select("*")
        .eq("modulo", "alerta_qualidade")
        .order("subtipo", { ascending: true });
      if (error) throw error;
      return (data as any[]) as AlertaConfig[];
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["email_automation_log", "alerta_qualidade"],
    queryFn: async () => {
      const { data } = await supabase
        .from("email_automation_log" as any)
        .select("*")
        .eq("modulo", "alerta_qualidade")
        .order("created_at", { ascending: false })
        .limit(30);
      return (data as any[]) ?? [];
    },
    refetchInterval: 15000,
  });

  const imediato = useMemo(() => configs.find((c) => c.subtipo === "imediato"), [configs]);
  const semanal = useMemo(() => configs.find((c) => c.subtipo === "agendado"), [configs]);

  const resendMut = useMutation({
    mutationFn: async (log: any) => {
      const { data, error } = await supabase.functions.invoke("send-alerta-email", {
        body: {
          config_id: log.config_id,
          subtipo: log.tipo_disparo === "evento" ? "imediato" : "agendado",
          alerta_id: log.entity_id ?? undefined,
          resend: true,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast.success("Reenvio enfileirado");
      qc.invalidateQueries({ queryKey: ["email_automation_log", "alerta_qualidade"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {imediato && <ConfigCard config={imediato} vars={IMMEDIATE_VARS} isWeekly={false} />}
      {semanal && <ConfigCard config={semanal} vars={WEEKLY_VARS} isWeekly={true} />}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-5 w-5" /> Histórico de envios — Alerta de Qualidade
          </CardTitle>
          <CardDescription>Últimos 30 envios (atualiza a cada 15s).</CardDescription>
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
                    </div>
                    {l.error_message && (
                      <div className="text-xs text-destructive mt-1 line-clamp-2">{l.error_message}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={
                      l.status === "sent" || l.status === "queued" ? "default"
                      : l.status === "failed" ? "destructive"
                      : "secondary"
                    }>{l.status}</Badge>
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

export default AlertaEmailTab;
