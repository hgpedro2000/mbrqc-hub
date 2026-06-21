import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { ShieldCheck, LogOut, Loader2, Smartphone, KeyRound, Info } from "lucide-react";
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

  const activeIndex = Math.min(code.length, 5);
  // Force a solid, fully-opaque 2px border on EVERY side (including the first
  // slot's left edge, where the shadcn base uses `first:border-l` 1px). Using
  // an inline style guarantees the border survives tailwind-merge collapsing
  // and renders identically on iOS Safari light mode.
  const slotBase =
    "h-14 w-11 sm:h-16 sm:w-12 text-xl sm:text-2xl font-mono font-semibold text-foreground rounded-lg bg-background transition-all !border-2 !border-l-2 !border-r-2 !border-t-2 !border-b-2";
  const slotActive =
    "data-[active=true]:!border-accent data-[active=true]:bg-accent/15 data-[active=true]:ring-2 data-[active=true]:ring-accent/30 data-[active=true]:shadow-md data-[active=true]:shadow-accent/20";
  const slotInactive =
    "data-[active=false]:!border-foreground/25";

  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* ambient glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(var(--accent)/0.14),transparent_60%)]" />
      <div className="pointer-events-none absolute -bottom-32 left-1/2 -translate-x-1/2 w-[480px] h-[480px] rounded-full bg-accent/5 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-5">
          <img src={logo} alt="Hyundai Mobis" className="h-16 sm:h-20 mx-auto object-contain" />
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/85 backdrop-blur-md shadow-2xl shadow-black/30 overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-6 pb-5 flex flex-col items-center text-center border-b border-border/40 bg-gradient-to-b from-accent/5 to-transparent">
            <div className="w-14 h-14 rounded-2xl bg-accent border border-accent flex items-center justify-center mb-3 shadow-lg shadow-accent/20">
              <ShieldCheck className="w-7 h-7 text-accent-foreground" />
            </div>
            <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground">
              Verificação em 2 etapas
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-[32ch]">
              Para sua segurança, confirme o código de 6 dígitos gerado no seu app autenticador.
            </p>
          </div>

          {/* Contextual hint */}
          <div className="px-6 pt-5">
            <div className="rounded-xl border border-accent/25 bg-accent/5 p-3 flex gap-3">
              <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <div className="text-xs text-foreground/80 leading-relaxed space-y-1">
                <p className="flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-accent" />
                  <span><b className="text-foreground">1.</b> Abra Google Authenticator, Microsoft Authenticator ou similar.</span>
                </p>
                <p className="flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-accent" />
                  <span><b className="text-foreground">2.</b> Digite os 6 dígitos abaixo — o login é automático.</span>
                </p>
              </div>
            </div>
          </div>

          {/* OTP */}
          <div className="px-4 sm:px-6 py-6 space-y-5">
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
                inputMode="numeric"
              >
                <InputOTPGroup className="gap-1 sm:gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <InputOTPSlot
                      key={i}
                      index={i}
                      data-active={activeIndex === i}
                      className={`${slotBase} ${slotActive}`}
                    />
                  ))}
                </InputOTPGroup>
                <span className="mx-1 sm:mx-2 text-accent/70 font-bold text-2xl select-none" aria-hidden>
                  –
                </span>
                <InputOTPGroup className="gap-1 sm:gap-1.5">
                  {[3, 4, 5].map((i) => (
                    <InputOTPSlot
                      key={i}
                      index={i}
                      data-active={activeIndex === i}
                      className={`${slotBase} ${slotActive}`}
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            <p className="text-center text-[11px] text-muted-foreground -mt-2">
              O código muda a cada 30 segundos.
            </p>

            <Button
              onClick={() => handleVerify()}
              disabled={code.length !== 6 || verifying}
              className="w-full h-12 bg-accent text-accent-foreground hover:bg-accent/90 font-heading font-semibold text-base shadow-lg shadow-accent/20"
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

        <p className="text-center text-xs text-muted-foreground mt-4 px-4">
          Não consegue acessar o app autenticador? Contate o administrador.
        </p>
      </div>
    </div>
  );
}
