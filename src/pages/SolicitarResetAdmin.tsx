import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ShieldAlert, Send, CheckCircle2, Loader2 } from "lucide-react";
import logo from "@/assets/hyundai-mobis-logo.png";
import { toast } from "sonner";

export default function SolicitarResetAdmin() {
  const navigate = useNavigate();
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<{ numero?: string; alreadyOpen?: boolean } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = employeeNumber.trim();
    if (!trimmed) {
      toast.error("Informe sua matrícula");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("request-admin-password-reset", {
        body: { employee_number: trimmed, motivo: motivo.trim() },
      });
      if (error) throw new Error((data as any)?.error || error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      setSent({ numero: (data as any)?.numero, alreadyOpen: (data as any)?.already_open });
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar solicitação");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center px-4 py-8 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(var(--accent)/0.12),transparent_60%)]" />
      <div className="relative w-full max-w-md">
        <div className="text-center mb-6">
          <img src={logo} alt="Hyundai Mobis" className="h-16 mx-auto mb-3 object-contain" />
          <h1 className="text-2xl font-heading font-bold text-foreground">Reset via administrador</h1>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">
            Não tem e-mail cadastrado? Solicite o reset diretamente ao administrador do sistema.
          </p>
        </div>

        {!sent ? (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-border/60 bg-card/85 backdrop-blur-md shadow-2xl shadow-black/20 p-6 space-y-5"
          >
            <div className="rounded-xl border border-accent/25 bg-accent/5 p-3 flex gap-3">
              <ShieldAlert className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <p className="text-xs text-foreground/80 leading-relaxed">
                Seu pedido será enviado para o <b>Help Desk</b> do administrador. Você receberá a senha provisória pessoalmente.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="employee_number">Matrícula / Código</Label>
              <Input
                id="employee_number"
                type="text"
                inputMode="text"
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="username"
                required
                value={employeeNumber}
                onChange={(e) => setEmployeeNumber(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                placeholder="Ex.: 12345 ou ABC123"
                className="h-12 text-base tracking-wider font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Use o mesmo código usado no login (números para colaboradores Mobis, código completo para terceiros).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Textarea
                id="motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: esqueci minha senha e não tenho e-mail cadastrado"
                rows={3}
                maxLength={500}
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-accent text-accent-foreground hover:bg-accent/90 font-heading font-semibold"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
              ) : (
                <><Send className="w-4 h-4 mr-2" /> Solicitar reset ao administrador</>
              )}
            </Button>

            <Link
              to="/esqueci-senha"
              className="flex items-center justify-center gap-2 w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Link>
          </form>
        ) : (
          <div className="rounded-2xl border border-border/60 bg-card/85 backdrop-blur-md shadow-2xl shadow-black/20 p-6 space-y-5 text-center">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-lg text-foreground">
                {sent.alreadyOpen ? "Solicitação já em aberto" : "Solicitação enviada"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {sent.alreadyOpen
                  ? "Você já possui uma solicitação em andamento. Aguarde o contato do administrador."
                  : "O administrador foi notificado no Help Desk e entrará em contato para liberar sua senha provisória."}
              </p>
              {sent.numero && (
                <p className="mt-3 inline-block px-3 py-1 rounded-full bg-muted/60 border border-border/40 text-xs font-mono text-foreground">
                  Protocolo: {sent.numero}
                </p>
              )}
            </div>
            <Button onClick={() => navigate("/login")} className="w-full h-11">
              <ArrowLeft className="w-4 h-4 mr-2" /> Voltar para o login
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
