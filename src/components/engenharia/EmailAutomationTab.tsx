import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Mail, Plus, X, Send, Clock, Save, History, AlertCircle,
  Eye, FileText, Loader2, FilePen, RotateCw, AlertTriangle, Bell,
} from "lucide-react";

interface AutomationConfig {
  id: string;
  name: string;
  enabled: boolean;
  schedule_time: string;
  timezone: string;
  recipients: string[];
  cc_recipients: string[];
  error_notify_recipients: string[];
  subject_template: string;
  message_body: string;
  include_dashboard_html: boolean;
  include_ng_pdf: boolean;
  weekdays: number[];
  last_sent_at: string | null;
}

const WEEKDAYS = [
  { v: 1, l: "Seg" }, { v: 2, l: "Ter" }, { v: 3, l: "Qua" },
  { v: 4, l: "Qui" }, { v: 5, l: "Sex" }, { v: 6, l: "Sáb" }, { v: 0, l: "Dom" },
];

const todayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const EmailAutomationTab = () => {
  const qc = useQueryClient();
  const [form, setForm] = useState<AutomationConfig | null>(null);
  const [newRecipient, setNewRecipient] = useState("");
  const [newCc, setNewCc] = useState("");
  const [newErr, setNewErr] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [testStart, setTestStart] = useState(todayStr());
  const [testEnd, setTestEnd] = useState(todayStr());

  const { data: config, isLoading } = useQuery({
    queryKey: ["email_automation_config", "apontamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_automation_config" as any)
        .select("*")
        .eq("modulo", "apontamentos")
        .order("created_at", { ascending: true })
        .limit(1).maybeSingle();
      if (error) throw error;
      return data as unknown as AutomationConfig | null;
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["email_automation_log", "apontamentos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("email_automation_log" as any)
        .select("*")
        .eq("modulo", "apontamentos")
        .order("created_at", { ascending: false })
        .limit(30);
      return (data as any[]) || [];
    },
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (config && !form) {
      setForm({
        ...config,
        error_notify_recipients: (config as any).error_notify_recipients ?? [],
      });
    }
  }, [config, form]);

  const save = useMutation({
    mutationFn: async (payload: Partial<AutomationConfig>) => {
      const { error } = await supabase
        .from("email_automation_config" as any)
        .update(payload).eq("id", form!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configuração salva");
      qc.invalidateQueries({ queryKey: ["email_automation_config"] });
    },
    onError: (e: any) => toast.error("Erro ao salvar: " + e.message),
  });

  const callSender = async (extra: Record<string, any>) => {
    const { data, error } = await supabase.functions.invoke("send-automation-email", {
      body: { config_id: form!.id, ...extra },
    });
    if (error) throw error;
    return data;
  };

  const sendNow = useMutation({
    mutationFn: () => callSender({}),
    onSuccess: (data: any) => {
      if (data?.skipped === "already_sent_today") {
        toast.info(`Já enviado hoje — use "Reenviar" no histórico para forçar um novo envio.`);
      } else {
        toast.success(`Enviado para ${data?.queued ?? 0} destinatário(s) — ${data?.ng_records ?? 0} NG hoje`);
      }
      qc.invalidateQueries({ queryKey: ["email_automation_log"] });
      qc.invalidateQueries({ queryKey: ["email_automation_config"] });
    },
    onError: (e: any) => toast.error("Erro: " + (e?.message ?? "falha no envio")),
  });

  const sendTest = useMutation({
    mutationFn: () => callSender({
      test_to: testEmail,
      period_start: testStart,
      period_end: testEnd,
    }),
    onSuccess: (data: any) => {
      toast.success(`Teste enviado — ${data?.ng_records ?? 0} registro(s) NG no período`);
      qc.invalidateQueries({ queryKey: ["email_automation_log"] });
    },
    onError: (e: any) => toast.error("Erro no teste: " + (e?.message ?? "falha")),
  });

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

  const loadPreview = useMutation({
    mutationFn: () => callSender({
      preview: true,
      period_start: testStart,
      period_end: testEnd,
    }),
    onSuccess: (data: any) => {
      setPreviewData(data);
      setPreviewOpen(true);
    },
    onError: (e: any) => toast.error("Erro ao gerar preview: " + (e?.message ?? "falha")),
  });

  const saveDraft = useMutation({
    mutationFn: () => callSender({
      draft: true,
      period_start: testStart,
      period_end: testEnd,
    }),
    onSuccess: (data: any) => {
      toast.success("Rascunho salvo — HTML e PDF gerados sem envio");
      setPreviewData(data);
      setPreviewOpen(true);
      qc.invalidateQueries({ queryKey: ["email_automation_log"] });
    },
    onError: (e: any) => toast.error("Erro no rascunho: " + (e?.message ?? "falha")),
  });

  const resend = useMutation({
    mutationFn: (_log: any) => callSender({ resend: true }),
    onSuccess: (data: any) => {
      toast.success(`Reenvio enfileirado — tentativa nº ${data?.attempt ?? "?"}`);
      qc.invalidateQueries({ queryKey: ["email_automation_log"] });
    },
    onError: (e: any) => toast.error("Erro no reenvio: " + (e?.message ?? "falha")),
  });

  if (isLoading || !form) {
    return <div className="text-center py-8 text-muted-foreground">Carregando…</div>;
  }

  const addEmail = (
    list: "recipients" | "cc_recipients" | "error_notify_recipients",
    value: string, reset: () => void,
  ) => {
    const v = value.trim().toLowerCase();
    if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      toast.error("E-mail inválido"); return;
    }
    if ((form[list] ?? []).includes(v)) return;
    setForm({ ...form, [list]: [...(form[list] ?? []), v] });
    reset();
  };
  const removeEmail = (
    list: "recipients" | "cc_recipients" | "error_notify_recipients", v: string,
  ) => setForm({ ...form, [list]: (form[list] ?? []).filter((e) => e !== v) });

  const toggleDay = (d: number) => {
    const has = form.weekdays.includes(d);
    setForm({
      ...form,
      weekdays: has ? form.weekdays.filter((x) => x !== d) : [...form.weekdays, d].sort(),
    });
  };

  const statusBadge = (l: any) => {
    if (l.status === "sent") return <Badge className="text-[10px]">sent</Badge>;
    if (l.status === "queued") return <Badge variant="secondary" className="text-[10px]">queued</Badge>;
    if (l.status === "draft") return <Badge variant="outline" className="text-[10px]"><FilePen className="w-3 h-3 mr-1" />draft</Badge>;
    if (l.status === "failed") return <Badge variant="destructive" className="text-[10px]"><AlertTriangle className="w-3 h-3 mr-1" />failed</Badge>;
    return <Badge variant="secondary" className="text-[10px]">{l.status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-heading font-semibold flex items-center gap-2">
            <Mail className="w-5 h-5" /> Automação de E-mails
          </h3>
          <p className="text-sm text-muted-foreground">
            Configure o envio automático do relatório diário de peças NG.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
          <Label className="text-sm">{form.enabled ? "Ativo" : "Desativado"}</Label>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4" /> Agendamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Horário de envio</Label>
              <Input type="time" value={form.schedule_time.slice(0, 5)}
                onChange={(e) => setForm({ ...form, schedule_time: e.target.value + ":00" })} />
            </div>
            <div>
              <Label className="text-xs">Fuso horário</Label>
              <Input value={form.timezone} disabled />
            </div>
          </div>
          <div>
            <Label className="text-xs mb-2 block">Dias da semana</Label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((d) => {
                const active = form.weekdays.includes(d.v);
                return (
                  <button key={d.v} type="button" onClick={() => toggleDay(d.v)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                      active ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/20 border-border text-muted-foreground"
                    }`}>
                    {d.l}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Destinatários</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Para</Label>
            <div className="flex gap-2">
              <Input value={newRecipient} onChange={(e) => setNewRecipient(e.target.value)}
                className="min-w-0 flex-1"
                placeholder="email@exemplo.com"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEmail("recipients", newRecipient, () => setNewRecipient("")))} />
              <Button size="sm" onClick={() => addEmail("recipients", newRecipient, () => setNewRecipient(""))} className="shrink-0">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {form.recipients.map((e) => (
                <Badge key={e} variant="secondary" className="gap-1">
                  {e}<button onClick={() => removeEmail("recipients", e)}><X className="w-3 h-3" /></button>
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">CC (cópia)</Label>
            <div className="flex gap-2">
              <Input value={newCc} onChange={(e) => setNewCc(e.target.value)}
                className="min-w-0 flex-1"
                placeholder="email@exemplo.com"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEmail("cc_recipients", newCc, () => setNewCc("")))} />
              <Button size="sm" onClick={() => addEmail("cc_recipients", newCc, () => setNewCc(""))} className="shrink-0">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {form.cc_recipients.map((e) => (
                <Badge key={e} variant="outline" className="gap-1">
                  {e}<button onClick={() => removeEmail("cc_recipients", e)}><X className="w-3 h-3" /></button>
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5" /> Alertas de erro (recebe quando o worker falha)
            </Label>
            <div className="flex gap-2">
              <Input value={newErr} onChange={(e) => setNewErr(e.target.value)}
                className="min-w-0 flex-1"
                placeholder="admin@exemplo.com"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEmail("error_notify_recipients", newErr, () => setNewErr("")))} />
              <Button size="sm" onClick={() => addEmail("error_notify_recipients", newErr, () => setNewErr(""))} className="shrink-0">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {(form.error_notify_recipients ?? []).map((e) => (
                <Badge key={e} variant="destructive" className="gap-1">
                  {e}<button onClick={() => removeEmail("error_notify_recipients", e)}><X className="w-3 h-3" /></button>
                </Badge>
              ))}
              {(form.error_notify_recipients ?? []).length === 0 && (
                <span className="text-[11px] text-muted-foreground">
                  Se vazio, usa os destinatários principais.
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Conteúdo</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">
              Assunto — variáveis:{" "}
              <code className="bg-muted px-1 rounded">{"{{date}}"}</code>{" "}
              <code className="bg-muted px-1 rounded">{"{{period}}"}</code>{" "}
              <code className="bg-muted px-1 rounded">{"{{total_ng}}"}</code>{" "}
              <code className="bg-muted px-1 rounded">{"{{total_records}}"}</code>{" "}
              <code className="bg-muted px-1 rounded">{"{{ppm}}"}</code>
            </Label>
            <Input value={form.subject_template}
              onChange={(e) => setForm({ ...form, subject_template: e.target.value })} />
            <p className="text-[11px] text-muted-foreground mt-1">
              Valores ausentes são substituídos por <code className="bg-muted px-1 rounded">—</code> sem quebrar a renderização.
            </p>
          </div>
          <div>
            <Label className="text-xs">Mensagem padrão</Label>
            <Textarea rows={4} value={form.message_body}
              onChange={(e) => setForm({ ...form, message_body: e.target.value })} />
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.include_dashboard_html}
                onCheckedChange={(v) => setForm({ ...form, include_dashboard_html: v })} />
              Incluir print HTML do Dashboard no corpo do e-mail
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.include_ng_pdf}
                onCheckedChange={(v) => setForm({ ...form, include_ng_pdf: v })} />
              Anexar PDF de Peças NG
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Send className="w-4 h-4" /> Teste, rascunho e período customizado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Período — início</Label>
              <Input type="date" value={testStart} onChange={(e) => setTestStart(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Período — fim</Label>
              <Input type="date" value={testEnd} onChange={(e) => setTestEnd(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input type="email" placeholder="email@empresa.com (apenas para 'Enviar teste')"
              className="min-w-0 flex-1"
              value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
            <Button variant="outline" onClick={() => sendTest.mutate()}
              className="w-full sm:w-auto shrink-0"
              disabled={sendTest.isPending || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)}>
              <Send className="w-4 h-4 mr-2" />
              {sendTest.isPending ? "Enviando…" : "Enviar teste"}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => loadPreview.mutate()} disabled={loadPreview.isPending}>
              {loadPreview.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
              Visualizar preview
            </Button>
            <Button variant="outline" onClick={() => saveDraft.mutate()} disabled={saveDraft.isPending}>
              {saveDraft.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FilePen className="w-4 h-4 mr-2" />}
              Salvar como rascunho
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            O rascunho gera HTML+PDF sem enviar e fica salvo por config/data — útil para revisão. Use o período para emitir relatórios atípicos quando alguém solicitar dados fora do agendamento.
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:justify-between">
        <div className="text-xs text-muted-foreground flex items-center gap-1.5 min-w-0">
          {form.last_sent_at ? (
            <><Clock className="w-3 h-3 shrink-0" /> <span className="truncate">Último envio: {new Date(form.last_sent_at).toLocaleString("pt-BR")}</span></>
          ) : (
            <><AlertCircle className="w-3 h-3 shrink-0" /> Nenhum envio realizado ainda</>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => sendNow.mutate()} className="flex-1 sm:flex-none"
            disabled={sendNow.isPending || form.recipients.length === 0}>
            <Send className="w-4 h-4 mr-2" /> {sendNow.isPending ? "Enviando…" : "Enviar agora"}
          </Button>
          <Button onClick={() => save.mutate(form)} disabled={save.isPending} className="flex-1 sm:flex-none">
            <Save className="w-4 h-4 mr-2" /> Salvar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><History className="w-4 h-4" /> Histórico de envios</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhum envio registrado.</p>
          ) : (
            <div className="space-y-2">
              {logs.map((l) => (
                <div key={l.id} className={`rounded-lg px-3 py-2 text-xs border ${
                  l.status === "failed" ? "bg-destructive/5 border-destructive/30" : "bg-muted/20 border-transparent"
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{l.subject || "(sem assunto)"}</p>
                      <p className="text-muted-foreground">
                        {new Date(l.created_at).toLocaleString("pt-BR")} •{" "}
                        {l.trigger_type === "manual" ? "Manual"
                          : l.trigger_type === "test" ? "Teste"
                          : l.trigger_type === "draft" ? "Rascunho"
                          : "Automático"} •{" "}
                        {l.recipients?.length || 0} destinatário(s)
                        {l.attempt && l.attempt > 1 && ` • tentativa nº ${l.attempt}`}
                        {l.period_start && l.period_end && l.period_start !== l.period_end && (
                          <> • {l.period_start} → {l.period_end}</>
                        )}
                      </p>
                      {l.status === "failed" && l.error_message && (
                        <div className="mt-1.5 p-2 rounded bg-destructive/10 text-destructive font-mono text-[11px] break-words">
                          <div className="font-sans not-italic font-medium mb-1 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Erro {l.error_notified && <span className="text-[10px] opacity-70">(alerta enviado)</span>}
                          </div>
                          {l.error_message}
                          <div className="mt-1 opacity-70">config_id: {l.config_id}</div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {statusBadge(l)}
                      {l.preview_pdf_url || l.pdf_url ? (
                        <a href={l.preview_pdf_url || l.pdf_url} target="_blank" rel="noreferrer"
                          className="text-[10px] text-primary hover:underline inline-flex items-center gap-1">
                          <FileText className="w-3 h-3" /> PDF
                        </a>
                      ) : null}
                      {(l.status === "failed" || l.trigger_type === "draft") && (
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]"
                          onClick={() => resend.mutate(l)} disabled={resend.isPending}>
                          <RotateCw className="w-3 h-3 mr-1" /> Reenviar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] w-[95vw] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" /> Preview do e-mail {previewData?.draft && <Badge variant="outline" className="ml-1"><FilePen className="w-3 h-3 mr-1" />Rascunho salvo</Badge>}
            </DialogTitle>
            <DialogDescription className="space-y-1">
              <div className="text-xs">
                <span className="font-medium text-foreground">Assunto:</span> {previewData?.subject}
              </div>
              <div className="text-xs flex items-center gap-3 flex-wrap">
                <span><span className="font-medium text-foreground">{previewData?.ng_records ?? 0}</span> registro(s) NG</span>
                <span>•</span>
                <span><span className="font-medium text-foreground">{previewData?.total_ng ?? 0}</span> peças NG no total</span>
                {previewData?.pdf_url && (
                  <><span>•</span>
                    <a href={previewData.pdf_url} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline font-medium">
                      <FileText className="w-3.5 h-3.5" /> Abrir PDF
                    </a>
                  </>
                )}
                {previewData?.pdf_error && (
                  <><span>•</span>
                    <span className="text-destructive inline-flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Falha no PDF: {previewData.pdf_error}
                    </span>
                  </>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden p-4 bg-muted/30">
            {previewData?.html ? (
              <iframe title="Preview do e-mail" srcDoc={previewData.html} sandbox=""
                className="w-full h-full min-h-[60vh] rounded-md border bg-white" />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Sem conteúdo
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmailAutomationTab;
