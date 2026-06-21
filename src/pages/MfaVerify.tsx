import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { ShieldCheck, LogOut, Loader2 } from "lucide-react";
import logo from "@/assets/hyundai-mobis-logo.png";

export default function MfaVerify() {
  const navigate = useNavigate();
  const { refreshMFAStatus, signOut } = useAuth();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        toast.error(error.message);
        return;
      }
      const verified = (data?.totp || []).find((f: any) => f.status === "verified");
      if (!verified) {
        navigate("/mfa-setup", { replace: true });
        return;
      }
      setFactorId(verified.id);
    };
    load();
  }, [navigate]);

  const handleVerify = async (codeToVerify?: string) => {
    const finalCode = codeToVerify ?? code;
    if (!factorId || finalCode.length !== 6) return;
    setVerifying(true);
    try {
      const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
      if (cErr) throw cErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: finalCode,
      });
      if (vErr) throw vErr;
      toast.success("Autenticação concluída");
      await refreshMFAStatus();
      navigate("/", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Código inválido");
      setCode("");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* subtle ambient glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(var(--accent)/0.12),transparent_60%)]" />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-6">
          <img src={logo} alt="Hyundai Mobis" className="h-20 mx-auto object-contain mb-3" />
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-xl shadow-black/20 overflow-hidden">
          <div className="px-6 pt-6 pb-4 flex flex-col items-center text-center border-b border-border/40">
            <div className="w-14 h-14 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center mb-3">
              <ShieldCheck className="w-7 h-7 text-accent" />
            </div>
            <h1 className="text-xl font-heading font-bold text-foreground">Verificação em duas etapas</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-[28ch]">
              Abra seu app autenticador e insira o código de 6 dígitos.
            </p>
          </div>

          <div className="px-6 py-6 space-y-5">
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(v) => {
                  const digits = v.replace(/\D/g, "");
                  setCode(digits);
                  if (digits.length === 6) handleVerify(digits);
                }}
                autoFocus
                disabled={verifying}
              >
                <InputOTPGroup className="gap-1.5">
                  <InputOTPSlot index={0} className="h-12 w-11 text-lg font-mono rounded-md border" />
                  <InputOTPSlot index={1} className="h-12 w-11 text-lg font-mono rounded-md border" />
                  <InputOTPSlot index={2} className="h-12 w-11 text-lg font-mono rounded-md border" />
                </InputOTPGroup>
                <span className="mx-1 text-muted-foreground/60 font-bold select-none">·</span>
                <InputOTPGroup className="gap-1.5">
                  <InputOTPSlot index={3} className="h-12 w-11 text-lg font-mono rounded-md border" />
                  <InputOTPSlot index={4} className="h-12 w-11 text-lg font-mono rounded-md border" />
                  <InputOTPSlot index={5} className="h-12 w-11 text-lg font-mono rounded-md border" />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button
              onClick={() => handleVerify()}
              disabled={code.length !== 6 || verifying}
              className="w-full h-11 bg-accent text-accent-foreground hover:bg-accent/90 font-heading font-semibold"
            >
              {verifying ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verificando...</>
              ) : (
                "Verificar e entrar"
              )}
            </Button>

            <Button
              variant="ghost"
              onClick={async () => { await signOut(); navigate("/login"); }}
              className="w-full text-muted-foreground hover:text-foreground"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair e usar outra conta
            </Button>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Não consegue acessar o app autenticador? Contate o administrador.
        </p>
      </div>
    </div>
  );
}
