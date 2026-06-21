import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Plus, X, Send, Save, Eye, Loader2, AlertTriangle, CalendarClock, Bell, Users, Mail } from "lucide-react";

const WEEKDAYS = [
  { v: 1, l: "Seg" }, { v: 2, l: "Ter" }, { v: 3, l: "Qua" },
  { v: 4, l: "Qui" }, { v: 5, l: "Sex" }, { v: 6, l: "Sáb" }, { v: 0, l: "Dom" },
];

export interface GenericConfig {
  id: string;
  name: string;
  modulo: string;
  subtipo: string;
  enabled: boolean;
  schedule_time: string;
  timezone: string;
  weekdays: number[];
  recipients: string[];
  error_notify_recipients: string[];
  subject_template: string;
  message_body: string;
  last_sent_at: string | null;
  metadata: any;
}

export interface AutomationConfigCardProps {
  config: GenericConfig;
  vars: string[];
  scheduled: boolean;
  senderFn: string;
  queryKey: (string | number)[];
  description?: string;
  /** Optional: enable a numeric "dias_antecedencia" editor stored in metadata */
  diasAntecedencia?: boolean;
}

export const AutomationConfigCard = ({
  config, vars, scheduled, senderFn, queryKey, description, diasAntecedencia,
}: AutomationConfigCardProps) => {
  const qc = useQueryClient();
  const [form, setForm] = useState<GenericConfig>(config);
  const [newErr, setNewErr] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{ subject: string; html: string } | null>(null);
  const [recipientsOpen, setRecipientsOpen] = useState(false);
  const [bulkTo, setBulkTo] = useState("");
  const [bulkCc, setBulkCc] = useState("");

  const ccList: string[] = Array.isArray(form.metadata?.cc) ? form.metadata.cc : [];

  useEffect(() => { setForm(config); }, [config]);

  const openRecipientsDialog = () => {
    setBulkTo((form.recipients ?? []).join(", "));
    setBulkCc(((form.metadata?.cc ?? []) as string[]).join(", "));
    setRecipientsOpen(true);
  };

  // RFC-5322 inspired pragmatic email regex
  const EMAIL_RE = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;
  const normalizeEmail = (raw: string) => {
    const t = raw.trim().replace(/^["'<]+|["'>]+$/g, "");
    if (!t) return "";
    const idx = t.lastIndexOf("@");
    if (idx < 1) return t.toLowerCase();
    return t.slice(0, idx) + "@" + t.slice(idx + 1).toLowerCase();
  };
  const parseEmails = (s: string) => {
    const seen = new Set<string>();
    const valid: string[] = [];
    const invalid: string[] = [];
    const tokens = s.split(/[,;\n\t\s]+/).map(normalizeEmail).filter(Boolean);
    for (const e of tokens) {
      const key = e.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      if (EMAIL_RE.test(e) && e.length <= 254) valid.push(e);
      else invalid.push(e);
    }
    return { valid, invalid };
  };

  const save = useMutation({
    mutationFn: async (payload: Partial<GenericConfig>) => {
      const { error } = await supabase.from("email_automation_config" as any).update(payload as any).eq("id", form.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Configuração salva");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const invokeSend = async (extra: Record<string, any> = {}) => {
    const { data, error } = await supabase.functions.invoke(senderFn, {
      body: { config_id: form.id, subtipo: form.subtipo, ...extra },
    });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
    return data as any;
  };

  const previewMut = useMutation({
    mutationFn: () => invokeSend({ preview: true }),
    onSuccess: (d: any) => { setPreviewData({ subject: d.subject, html: d.html }); setPreviewOpen(true); },
    onError: (e: any) => toast.error(`Falha no preview: ${e.message}`),
  });

  const testMut = useMutation({
    mutationFn: () => {
      if (!testEmail) throw new Error("Informe um e-mail para o teste");
      return invokeSend({ test_to: testEmail });
    },
    onSuccess: () => {
      toast.success(`Teste enviado para ${testEmail}`);
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const manualMut = useMutation({
    mutationFn: () => invokeSend({}),
    onSuccess: (d: any) => {
      if (d?.skipped) toast.info("Já existe um envio para hoje (idempotência).");
      else toast.success(`Enfileirado para ${d?.queued ?? 0} destinatário(s).`);
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {scheduled ? <CalendarClock className="h-5 w-5 text-primary" /> : <Bell className="h-5 w-5 text-primary" />}
            <CardTitle className="text-base">{form.name}</CardTitle>
            <Badge variant={form.enabled ? "default" : "secondary"}>
              {form.enabled ? "Ativa" : "Desativada"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm">Ativada</Label>
            <Switch checked={form.enabled}
              onCheckedChange={(v) => { setForm({ ...form, enabled: v }); save.mutate({ enabled: v }); }} />
          </div>
        </div>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>

      <CardContent className="space-y-4">
        {scheduled && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Horário</Label>
              <Input type="time" value={form.schedule_time?.slice(0, 5) ?? "08:00"}
                onChange={(e) => setForm({ ...form, schedule_time: e.target.value })} />
            </div>
            <div>
              <Label>Fuso horário</Label>
              <Input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
            </div>
            <div>
              <Label>Dias da semana</Label>
              <div className="flex flex-wrap gap-1 mt-2">
                {WEEKDAYS.map((d) => {
                  const on = form.weekdays?.includes(d.v);
                  return (
                    <Button key={d.v} type="button" size="sm" variant={on ? "default" : "outline"}
                      onClick={() => setForm({
                        ...form,
                        weekdays: on ? form.weekdays.filter((x) => x !== d.v) : [...(form.weekdays ?? []), d.v],
                      })}>{d.l}</Button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {diasAntecedencia && (
          <div>
            <Label>Dias de antecedência (a vencer)</Label>
            <Input type="number" min={1} max={365}
              value={Number(form.metadata?.dias_antecedencia ?? 30)}
              onChange={(e) => setForm({
                ...form,
                metadata: { ...(form.metadata ?? {}), dias_antecedencia: Math.max(1, Number(e.target.value || 30)) },
              })} />
          </div>
        )}

        <div className="rounded-md border p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4 text-primary" />
              Destinatários
              <Badge variant="secondary">TO: {form.recipients?.length ?? 0}</Badge>
              <Badge variant="secondary">CC: {ccList.length}</Badge>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={openRecipientsDialog}>
              <Mail className="h-4 w-4 mr-2" /> Cadastrar destinatários
            </Button>
          </div>
          <div className="text-xs text-muted-foreground break-all">
            <span className="font-medium">TO:</span> {(form.recipients ?? []).join(", ") || "— nenhum —"}
          </div>
          <div className="text-xs text-muted-foreground break-all">
            <span className="font-medium">CC:</span> {ccList.join(", ") || "— nenhum —"}
          </div>
        </div>

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

        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Button onClick={() => save.mutate({
            schedule_time: form.schedule_time, timezone: form.timezone, weekdays: form.weekdays,
            recipients: form.recipients, error_notify_recipients: form.error_notify_recipients,
            subject_template: form.subject_template, message_body: form.message_body,
            metadata: form.metadata,
          })} disabled={save.isPending}>
            <Save className="h-4 w-4 mr-2" /> Salvar
          </Button>
          <Button variant="outline" onClick={() => previewMut.mutate()} disabled={previewMut.isPending}>
            {previewMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />} Preview
          </Button>
          {scheduled && (
            <Button variant="outline" onClick={() => manualMut.mutate()} disabled={manualMut.isPending}>
              {manualMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />} Enviar agora
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Input className="w-56" placeholder="teste@exemplo.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
            <Button variant="secondary" onClick={() => testMut.mutate()} disabled={testMut.isPending || !testEmail}>
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

      <Dialog open={recipientsOpen} onOpenChange={setRecipientsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Cadastrar destinatários — {form.name}</DialogTitle>
            <DialogDescription>
              Informe os e-mails separados por vírgula, ponto-e-vírgula ou nova linha.
              TO recebe diretamente; CC recebe em cópia (uma entrega individual por endereço).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Destinatários (TO)</Label>
              <Textarea rows={3} placeholder="qualidade@empresa.com, engenharia@empresa.com"
                value={bulkTo} onChange={(e) => setBulkTo(e.target.value)} />
            </div>
            <div>
              <Label>Em cópia (CC)</Label>
              <Textarea rows={3} placeholder="gestor@empresa.com"
                value={bulkCc} onChange={(e) => setBulkCc(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setRecipientsOpen(false)}>Cancelar</Button>
              <Button onClick={() => {
                const to = parseList(bulkTo);
                const cc = parseList(bulkCc);
                const nextMeta = { ...(form.metadata ?? {}), cc };
                setForm({ ...form, recipients: to, metadata: nextMeta });
                save.mutate({ recipients: to, metadata: nextMeta });
                setRecipientsOpen(false);
              }}>
                <Save className="h-4 w-4 mr-2" /> Salvar destinatários
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default AutomationConfigCard;
