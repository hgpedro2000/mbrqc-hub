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
import { toast } from "sonner";
import { Mail, Plus, X, Send, Clock, Save, History, AlertCircle } from "lucide-react";
// auth user resolved via supabase.auth.getUser at trigger time

interface AutomationConfig {
  id: string;
  name: string;
  enabled: boolean;
  schedule_time: string;
  timezone: string;
  recipients: string[];
  cc_recipients: string[];
  subject_template: string;
  message_body: string;
  include_dashboard_html: boolean;
  include_ng_pdf: boolean;
  weekdays: number[];
  last_sent_at: string | null;
}

const WEEKDAYS = [
  { v: 1, l: "Seg" },
  { v: 2, l: "Ter" },
  { v: 3, l: "Qua" },
  { v: 4, l: "Qui" },
  { v: 5, l: "Sex" },
  { v: 6, l: "Sáb" },
  { v: 0, l: "Dom" },
];

const EmailAutomationTab = () => {
  const qc = useQueryClient();
  const [form, setForm] = useState<AutomationConfig | null>(null);
  const [newRecipient, setNewRecipient] = useState("");
  const [newCc, setNewCc] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [newCc, setNewCc] = useState("");

  const { data: config, isLoading } = useQuery({
    queryKey: ["email_automation_config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_automation_config" as any)
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as AutomationConfig | null;
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["email_automation_log"],
    queryFn: async () => {
      const { data } = await supabase
        .from("email_automation_log" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      return (data as any[]) || [];
    },
  });

  useEffect(() => {
    if (config && !form) setForm(config);
  }, [config, form]);

  const save = useMutation({
    mutationFn: async (payload: Partial<AutomationConfig>) => {
      const { error } = await supabase
        .from("email_automation_config" as any)
        .update(payload)
        .eq("id", form!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configuração salva");
      qc.invalidateQueries({ queryKey: ["email_automation_config"] });
    },
    onError: (e: any) => toast.error("Erro ao salvar: " + e.message),
  });

  const sendNow = useMutation({
    mutationFn: async () => {
      if (!form) return;
      const { data, error } = await supabase.functions.invoke("send-automation-email", {
        body: { config_id: form.id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(
        `Enviado para ${data?.queued ?? 0} destinatário(s) — ${data?.ng_records ?? 0} registro(s) NG hoje`,
      );
      qc.invalidateQueries({ queryKey: ["email_automation_log"] });
      qc.invalidateQueries({ queryKey: ["email_automation_config"] });
    },
    onError: (e: any) => toast.error("Erro: " + (e?.message ?? "falha no envio")),
  });

  const sendTest = useMutation({
    mutationFn: async (testEmail: string) => {
      if (!form) return;
      const { data, error } = await supabase.functions.invoke("send-automation-email", {
        body: { config_id: form.id, test_to: testEmail },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(`Teste enviado — ${data?.ng_records ?? 0} registro(s) NG no relatório`);
      qc.invalidateQueries({ queryKey: ["email_automation_log"] });
    },
    onError: (e: any) => toast.error("Erro no teste: " + (e?.message ?? "falha")),
  });

  if (isLoading || !form) {
    return <div className="text-center py-8 text-muted-foreground">Carregando…</div>;
  }

  const addEmail = (list: "recipients" | "cc_recipients", value: string, reset: () => void) => {
    const v = value.trim().toLowerCase();
    if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      toast.error("E-mail inválido");
      return;
    }
    if (form[list].includes(v)) return;
    setForm({ ...form, [list]: [...form[list], v] });
    reset();
  };

  const removeEmail = (list: "recipients" | "cc_recipients", v: string) =>
    setForm({ ...form, [list]: form[list].filter((e) => e !== v) });

  const toggleDay = (d: number) => {
    const has = form.weekdays.includes(d);
    setForm({
      ...form,
      weekdays: has ? form.weekdays.filter((x) => x !== d) : [...form.weekdays, d].sort(),
    });
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
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={form.enabled}
              onCheckedChange={(v) => setForm({ ...form, enabled: v })}
            />
            <Label className="text-sm">{form.enabled ? "Ativo" : "Desativado"}</Label>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="w-4 h-4" /> Agendamento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Horário de envio</Label>
              <Input
                type="time"
                value={form.schedule_time.slice(0, 5)}
                onChange={(e) =>
                  setForm({ ...form, schedule_time: e.target.value + ":00" })
                }
              />
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
                  <button
                    key={d.v}
                    type="button"
                    onClick={() => toggleDay(d.v)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/20 border-border text-muted-foreground"
                    }`}
                  >
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
              <Input
                value={newRecipient}
                onChange={(e) => setNewRecipient(e.target.value)}
                placeholder="email@exemplo.com"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEmail("recipients", newRecipient, () => setNewRecipient("")))}
              />
              <Button size="sm" onClick={() => addEmail("recipients", newRecipient, () => setNewRecipient(""))}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {form.recipients.map((e) => (
                <Badge key={e} variant="secondary" className="gap-1">
                  {e}
                  <button onClick={() => removeEmail("recipients", e)}>
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">CC (cópia)</Label>
            <div className="flex gap-2">
              <Input
                value={newCc}
                onChange={(e) => setNewCc(e.target.value)}
                placeholder="email@exemplo.com"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEmail("cc_recipients", newCc, () => setNewCc("")))}
              />
              <Button size="sm" onClick={() => addEmail("cc_recipients", newCc, () => setNewCc(""))}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {form.cc_recipients.map((e) => (
                <Badge key={e} variant="outline" className="gap-1">
                  {e}
                  <button onClick={() => removeEmail("cc_recipients", e)}>
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Conteúdo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">
              Assunto (use <code className="bg-muted px-1 rounded">{"{{date}}"}</code> para data)
            </Label>
            <Input
              value={form.subject_template}
              onChange={(e) => setForm({ ...form, subject_template: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Mensagem padrão</Label>
            <Textarea
              rows={4}
              value={form.message_body}
              onChange={(e) => setForm({ ...form, message_body: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={form.include_dashboard_html}
                onCheckedChange={(v) => setForm({ ...form, include_dashboard_html: v })}
              />
              Incluir print HTML do Dashboard no corpo do e-mail
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={form.include_ng_pdf}
                onCheckedChange={(v) => setForm({ ...form, include_ng_pdf: v })}
              />
              Anexar PDF de Peças NG do dia
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Send className="w-4 h-4" /> Teste de envio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="email"
              placeholder="seu-email@empresa.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
            />
            <Button
              variant="outline"
              onClick={() => sendTest.mutate(testEmail)}
              disabled={sendTest.isPending || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)}
            >
              <Send className="w-4 h-4 mr-2" />
              {sendTest.isPending ? "Enviando…" : "Enviar teste"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Envia o relatório do dia atual apenas para este e-mail, sem atualizar a data do último envio agendado.
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          {form.last_sent_at ? (
            <>
              <Clock className="w-3 h-3" />
              Último envio: {new Date(form.last_sent_at).toLocaleString("pt-BR")}
            </>
          ) : (
            <>
              <AlertCircle className="w-3 h-3" /> Nenhum envio realizado ainda
            </>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => sendNow.mutate()}
            disabled={sendNow.isPending || form.recipients.length === 0}
          >
            <Send className="w-4 h-4 mr-2" /> {sendNow.isPending ? "Enviando…" : "Enviar agora"}
          </Button>
          <Button onClick={() => save.mutate(form)} disabled={save.isPending}>
            <Save className="w-4 h-4 mr-2" /> Salvar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="w-4 h-4" /> Histórico de envios
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Nenhum envio registrado.
            </p>
          ) : (
            <div className="space-y-2">
              {logs.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between bg-muted/20 rounded-lg px-3 py-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{l.subject || "(sem assunto)"}</p>
                    <p className="text-muted-foreground">
                      {new Date(l.created_at).toLocaleString("pt-BR")} •{" "}
                      {l.trigger_type === "manual" ? "Manual" : "Automático"} •{" "}
                      {l.recipients?.length || 0} destinatário(s)
                    </p>
                  </div>
                  <Badge
                    variant={
                      l.status === "sent"
                        ? "default"
                        : l.status === "failed"
                        ? "destructive"
                        : "secondary"
                    }
                    className="text-[10px]"
                  >
                    {l.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailAutomationTab;
