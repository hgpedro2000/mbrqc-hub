import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ShieldCheck, Save, Loader2 } from "lucide-react";
import { logAction } from "@/lib/logAction";

const PRESETS = [3, 7, 14, 30];
const KEY = "temp_password_expiry_days";

const SecurityConfigTab = () => {
  const [days, setDays] = useState<number>(7);
  const [original, setOriginal] = useState<number>(7);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_config")
        .select("value")
        .eq("key", KEY)
        .maybeSingle();
      const val = Math.max(1, parseInt((data as any)?.value || "7", 10) || 7);
      setDays(val);
      setOriginal(val);
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      toast.error("Informe um valor entre 1 e 365 dias.");
      return;
    }
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("app_config")
        .select("key")
        .eq("key", KEY)
        .maybeSingle();
      const payload = { value: String(days) };
      const { error } = existing
        ? await supabase.from("app_config").update(payload).eq("key", KEY)
        : await supabase.from("app_config").insert({ key: KEY, ...payload });
      if (error) throw error;
      setOriginal(days);
      toast.success(`Validade de senha temporária definida para ${days} dia(s).`);
      logAction("update_temp_password_expiry", "Engenharia", { days });
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err?.message || "desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  const dirty = days !== original;

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-accent" />
          Segurança — Senhas Temporárias
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            Define por quantos dias uma senha gerada pelo admin (na criação de usuário ou reset)
            permanece válida. Após esse prazo, o login é bloqueado e o usuário precisa solicitar
            uma nova senha ao administrador.
          </p>
          <p className="text-xs">
            Esta regra se aplica apenas a senhas temporárias (com troca obrigatória pendente).
            Senhas já trocadas pelo usuário não expiram automaticamente.
          </p>
        </div>

        <div className="space-y-3">
          <Label htmlFor="days">Validade da senha temporária (dias)</Label>
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              id="days"
              type="number"
              min={1}
              max={365}
              value={loading ? "" : days}
              onChange={(e) => setDays(parseInt(e.target.value || "0", 10) || 0)}
              disabled={loading || saving}
              className="w-28"
            />
            <span className="text-sm text-muted-foreground">dias</span>
            <div className="flex gap-1.5 ml-2">
              {PRESETS.map((p) => (
                <Button
                  key={p}
                  type="button"
                  size="sm"
                  variant={days === p ? "default" : "outline"}
                  onClick={() => setDays(p)}
                  disabled={loading || saving}
                >
                  {p}d
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={!dirty || saving || loading}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SecurityConfigTab;
