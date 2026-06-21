import { useEffect, useMemo, useState } from "react";
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
import { Plus, X, Send, Save, Eye, Loader2, AlertTriangle, PlayCircle, Cog, CheckCircle2 } from "lucide-react";
import { HistoryPanel } from "./EmailHistoryPanel";

interface CtnConfig {
  id: string;
  name: string;
  modulo: string;
  subtipo: "iniciada" | "em_andamento" | "concluida";
  enabled: boolean;
  recipients: string[];
  error_notify_recipients: string[];
  subject_template: string;
  message_body: string;
  last_sent_at: string | null;
}

const VARS = [
  "numero", "titulo", "tipo", "status", "responsavel", "setor", "linha",
  "part_number", "part_name", "fornecedor", "motivo", "acao_contencao",
  "observacoes", "quantidade_contida", "quantidade_aprovada", "quantidade_rejeitada",
  "data", "date", "evento", "link",
];

const SUBTIPO_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  iniciada: PlayCircle,
  em_andamento: Cog,
  concluida: CheckCircle2,
};

const ConfigCard = ({ config }: { config: CtnConfig }) => {
  const qc = useQueryClient();
  const [form, setForm] = useState<CtnConfig>(config);
  const [newRecipient, setNewRecipient] = useState("");
  const [newErr, setNewErr] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{ subject: string; html: string } | null>(null);
  const Icon = SUBTIPO_ICONS[form.subtipo] ?? PlayCircle;

  useEffect(() => { setForm(config); }, [config]);

  const save = useMutation({
    mutationFn: async (payload: Partial<CtnConfig>) => {
      const { error } = await supabase.from("email_automation_config" as any).update(payload).eq("id", form.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email_automation_config", "contencao"] });
      toast.success("Configuração salva");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const invokeSend = async (extra: Record<string, any> = {}) => {
    const { data, error } = await supabase.functions.invoke("send-contencao-email", {
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
      qc.invalidateQueries({ queryKey: ["email_automation_log", "contencao"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
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
          {form.subtipo === "iniciada" && "Disparado quando uma nova Contenção é criada."}
          {form.subtipo === "em_andamento" && "Disparado quando o status muda para 'Em andamento'."}
          {form.subtipo === "concluida" && "Disparado quando o status muda para 'Concluída'. Encerra o ciclo de notificações."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <Label>Destinatários ({form.recipients?.length ?? 0})</Label>
          <div className="flex gap-2 mt-1">
            <Input className="min-w-0 flex-1" placeholder="email@exemplo.com" value={newRecipient}
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

        <div>
          <Label className="flex items-center gap-2"><AlertTriangle className="h-3 w-3" /> Alertas de falha ({form.error_notify_recipients?.length ?? 0})</Label>
          <div className="flex gap-2 mt-1">
            <Input className="min-w-0 flex-1" placeholder="admin@exemplo.com" value={newErr} onChange={(e) => setNewErr(e.target.value)}
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
            Variáveis: {VARS.map((v) => <code key={v} className="bg-muted px-1 mx-0.5 rounded">{`{{${v}}}`}</code>)}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 pt-2 border-t">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => save.mutate({
              recipients: form.recipients, error_notify_recipients: form.error_notify_recipients,
              subject_template: form.subject_template, message_body: form.message_body,
            })} disabled={save.isPending} className="flex-1 sm:flex-none">
              <Save className="h-4 w-4 mr-2" /> Salvar
            </Button>
            <Button variant="outline" onClick={() => previewMut.mutate()} disabled={previewMut.isPending} className="flex-1 sm:flex-none">
              {previewMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />} Preview
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
        <DialogContent className="max-w-4xl w-[95vw] h-[85vh] sm:h-[80vh] flex flex-col p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg break-words">Preview — {previewData?.subject}</DialogTitle>
            <DialogDescription>Renderização exata do e-mail que será enviado.</DialogDescription>
          </DialogHeader>
          <iframe srcDoc={previewData?.html ?? ""} className="flex-1 w-full border rounded min-h-0" />
        </DialogContent>
      </Dialog>
    </Card>
  );
};

const ContencaoEmailTab = () => {
  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["email_automation_config", "contencao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_automation_config" as any)
        .select("*")
        .eq("modulo", "contencao");
      if (error) throw error;
      const order = ["iniciada", "em_andamento", "concluida"];
      return ((data as any[]) as CtnConfig[]).sort(
        (a, b) => order.indexOf(a.subtipo) - order.indexOf(b.subtipo),
      );
    },
  });

  const { subtipoMap, nameMap } = useMemo(() => {
    const s = new Map<string, string>();
    const n = new Map<string, string>();
    configs.forEach((c) => { s.set(c.id, c.subtipo); n.set(c.id, c.name); });
    return { subtipoMap: s, nameMap: n };
  }, [configs]);

  if (isLoading) return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {configs.map((c) => <ConfigCard key={c.id} config={c} />)}

      <HistoryPanel
        modulo="contencao"
        senderFn="send-contencao-email"
        configSubtipo={subtipoMap}
        configName={nameMap}
        title="Contenção"
        buildResendBody={(log) => (log.entity_id ? { contencao_id: log.entity_id } : {})}
      />
    </div>
  );
};

export default ContencaoEmailTab;
