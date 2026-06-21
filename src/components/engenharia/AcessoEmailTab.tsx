import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { KeyRound, Save, Eye, Loader2, ShieldAlert } from "lucide-react";

interface Override {
  template_key: string;
  subject: string;
  intro_html: string;
  updated_by: string | null;
  updated_at: string;
}

const TEMPLATE_LABELS: Record<string, string> = {
  signup: "Cadastro (signup)",
  invite: "Convite (invite)",
  magiclink: "Link mágico (magiclink)",
  recovery: "Recuperação de senha (recovery)",
  email_change: "Alteração de e-mail (email_change)",
  reauthentication: "Reautenticação (reauthentication)",
};

const buildPreview = (subject: string, intro: string) => `<!doctype html><html><head><meta charset="utf-8"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'DM Sans',Arial,sans-serif;color:#0f172a;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#354052;color:#fff;border-radius:12px;padding:20px;">
      <div style="font-size:12px;opacity:.7;text-transform:uppercase;letter-spacing:.1em;">MBR Quality • Acesso</div>
      <h1 style="margin:8px 0 4px;font-size:22px;font-weight:700;">${subject}</h1>
    </div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin-top:16px;font-size:14px;line-height:1.6;">
      ${intro || '<em style="color:#64748b;">(Texto introdutório vazio — o corpo padrão do template será usado)</em>'}
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:18px 0;" />
      <p style="font-size:13px;color:#64748b;">Este botão/link real é gerado pelo Supabase Auth no momento do envio:</p>
      <p><a href="#" style="background:#354052;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;">[Ação do template]</a></p>
    </div>
    <p style="text-align:center;font-size:11px;color:#94a3b8;margin:24px 0 0;">MBR Quality — Preview do template</p>
  </div>
</body></html>`;

const TemplateCard = ({ ov }: { ov: Override }) => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState<Override>(ov);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => { setForm(ov); }, [ov]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("auth_email_overrides" as any)
        .update({ subject: form.subject, intro_html: form.intro_html, updated_by: user?.id ?? null })
        .eq("template_key", form.template_key);
      if (error) throw error;
      await supabase.from("audit_logs" as any).insert({
        action: "email_template_updated",
        module: "acesso",
        user_id: user?.id ?? null,
        user_email: user?.email ?? null,
        details: { template_key: form.template_key, subject: form.subject },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auth_email_overrides"] });
      toast.success("Template salvo");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            {TEMPLATE_LABELS[form.template_key] ?? form.template_key}
          </CardTitle>
          <Badge variant="outline">{form.template_key}</Badge>
        </div>
        <CardDescription>
          Atualizado em {new Date(form.updated_at).toLocaleString("pt-BR")}.
          As alterações ficam registradas no log de auditoria.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Assunto</Label>
          <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
        </div>
        <div>
          <Label>Texto introdutório (HTML opcional)</Label>
          <Textarea rows={5} value={form.intro_html}
            onChange={(e) => setForm({ ...form, intro_html: e.target.value })}
            placeholder="<p>Olá! Use o botão abaixo para...</p>" />
          <p className="text-xs text-muted-foreground mt-1">
            Exibido antes do botão/link de ação no e-mail. Deixe vazio para usar o corpo padrão do template.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Salvar
          </Button>
          <Button variant="outline" onClick={() => setPreviewOpen(true)}>
            <Eye className="h-4 w-4 mr-2" /> Preview
          </Button>
        </div>
      </CardContent>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl w-[95vw] h-[80vh] sm:h-[70vh] flex flex-col p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg break-words">Preview — {form.subject}</DialogTitle>
            <DialogDescription>Visualização aproximada do e-mail.</DialogDescription>
          </DialogHeader>
          <iframe srcDoc={buildPreview(form.subject, form.intro_html)} className="flex-1 w-full border rounded min-h-0" />
        </DialogContent>
      </Dialog>
    </Card>
  );
};

const AcessoEmailTab = () => {
  const { isAdmin } = useAuth();

  const { data: overrides = [], isLoading } = useQuery({
    queryKey: ["auth_email_overrides"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auth_email_overrides" as any)
        .select("*")
        .order("template_key");
      if (error) throw error;
      return (data as any[]) as Override[];
    },
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-5 w-5 text-destructive" /> Acesso restrito
          </CardTitle>
          <CardDescription>
            Esta área só está disponível para administradores.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isLoading) return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {overrides.map((o) => <TemplateCard key={o.template_key} ov={o} />)}
    </div>
  );
};

export default AcessoEmailTab;
