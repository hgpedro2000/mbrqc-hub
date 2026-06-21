import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, AlertTriangle, RefreshCw, HelpCircle, UserPlus, ArrowDown, X, Building2, Hash } from "lucide-react";
import logo from "@/assets/hyundai-mobis-logo.png";
import { toast } from "sonner";
import LanguageToggle from "@/components/LanguageToggle";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { logAction } from "@/lib/logAction";
import { primeBeep } from "@/lib/beep";

const Login = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { versionKicked, user, profile, loading: authLoading } = useAuth();
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  // Terceiros possuem letras no código — permite alternar para teclado alfanumérico.
  const [alphaKeyboard, setAlphaKeyboard] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Whenever AuthContext finishes hydrating with a valid session/profile,
  // redirect away from /login. This handles BOTH:
  //  1) the user just submitted the login form, and
  //  2) the user reloads /login while already authenticated (e.g. PWA cold start
  //     in production where the persisted session rehydrates after the page
  //     mounts). Without this, the user would stay stuck on the login screen
  //     even though their session is valid.
  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    // Wait until we actually have the profile loaded so we can decide between
    // "must change password" and "go home".
    if (!profile) return;
    if (profile.must_change_password) {
      navigate("/alterar-senha", { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  }, [authLoading, user, profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Unlock AudioContext while we are inside a user gesture so subsequent
    // scanner beeps are loud even on browsers that block autoplay.
    primeBeep();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("auth-login-by-number", {
        body: { employee_number: employeeNumber.trim(), password },
      });

      if (error) {
        // Extract the real error message from the response body (robust)
        let realMsg = "";
        try {
          const ctx: any = (error as any).context;
          if (ctx) {
            if (typeof ctx.clone === "function") {
              const cloned = ctx.clone();
              try {
                const body = await cloned.json();
                if (body?.error) realMsg = body.error;
              } catch {
                const txt = await ctx.clone().text();
                try { const j = JSON.parse(txt); if (j?.error) realMsg = j.error; } catch { if (txt) realMsg = txt; }
              }
            } else if (typeof ctx.json === "function") {
              const body = await ctx.json();
              if (body?.error) realMsg = body.error;
            } else if (ctx.body?.error) {
              realMsg = ctx.body.error;
            }
          }
        } catch { /* ignore parse errors */ }
        throw new Error(realMsg || t("login.authError"));
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }

      // Audit: successful login
      logAction("login", "auth", {
        employee_number: employeeNumber.trim(),
        full_name: data.profile?.full_name,
      });

      // Pre-request camera permission RIGHT AFTER successful auth. We are
      // still inside the original submit user-gesture, so the browser will
      // accept the prompt. Once the user grants it the first time, no future
      // prompt is shown when the scanner opens.
      try {
        if (navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false,
          });
          stream.getTracks().forEach((t) => t.stop());
        }
      } catch {
        // User denied or no camera — scanner will prompt again when opened.
      }

      if (data.profile?.must_change_password) {
        toast.info(t("login.mustChangePassword"));
      } else {
        toast.success(`${t("login.welcome")}, ${data.profile?.full_name || ""}!`);
      }

      // The useEffect above watches AuthContext and will redirect as soon
      // as the new session/profile finishes hydrating.

    } catch (error: any) {
      const msg = error.message || t("login.authError");
      setErrorMessage(msg);
      setErrorDialogOpen(true);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8 relative">
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10">
        <LanguageToggle variant="login" />
      </div>
      <div className="w-full max-w-md mx-auto">
        {versionKicked && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-destructive shrink-0" />
            <p className="text-sm text-destructive font-medium">Sua sessão foi encerrada. Faça login novamente para carregar a versão mais recente.</p>
          </div>
        )}
        <div className="text-center mb-8">
          <img src={logo} alt="Hyundai Mobis" className="h-40 mx-auto mb-0 mt-10 object-contain" />
          <h1 className="text-2xl font-heading font-bold text-foreground -mt-1">{t("login.title")}</h1>
          <p className="text-muted-foreground mt-0">{t("login.subtitle")}</p>
        </div>

        {/* Ajuda (Terceiros) — botão discreto que abre a dica quando clicado */}
        {showOnboarding && (
          <div className="mb-4 rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-4 relative shadow-sm">
            <button
              type="button"
              onClick={() => setShowOnboarding(false)}
              aria-label="Fechar"
              className="absolute top-2 right-2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-background/40"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                <UserPlus className="w-4 h-4 text-accent" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-heading font-bold text-foreground">
                  Primeira vez? Veja onde clicar
                </h3>
                <ul className="mt-2 space-y-1.5 text-xs text-foreground/80">
                  <li className="flex items-start gap-2">
                    <Building2 className="w-3.5 h-3.5 text-accent mt-0.5 shrink-0" />
                    <span><b>Mobis (funcionário):</b> use só números do seu N° de empregado.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Hash className="w-3.5 h-3.5 text-accent mt-0.5 shrink-0" />
                    <span><b>Terceiro:</b> seu código tem letras — toque em "Sou Terceiro" abaixo <ArrowDown className="inline w-3 h-3 -mt-0.5" /></span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="form-section space-y-4">
          <div className="space-y-2">
            <Label htmlFor="employeeNumber">{t("login.employeeNumber")}</Label>
            <Input
              id="employeeNumber"
              type={alphaKeyboard ? "text" : "tel"}
              required
              value={employeeNumber}
              onChange={(e) => {
                const v = e.target.value;
                setEmployeeNumber(alphaKeyboard ? v.toUpperCase().replace(/\s/g, "") : v.replace(/\D/g, ""));
              }}
              placeholder={alphaKeyboard ? "Ex: ABC123" : "Apenas números"}
              inputMode={alphaKeyboard ? "text" : "numeric"}
              pattern={alphaKeyboard ? undefined : "[0-9]*"}
              autoComplete="username"
              autoCapitalize={alphaKeyboard ? "characters" : "off"}
              enterKeyHint="next"
              onFocus={(e) => (e.target.placeholder = "")}
            />

            {/* Terceiros CTA — destacado */}
            {!alphaKeyboard ? (
              <button
                type="button"
                onClick={() => setAlphaKeyboard(true)}
                aria-pressed={alphaKeyboard}
                className="mt-2 group relative w-full flex items-center gap-3 rounded-xl border-2 border-accent/60 bg-accent/15 hover:bg-accent/25 hover:border-accent active:scale-[0.99] px-4 py-3 text-left transition-all shadow-md shadow-accent/10"
              >
                <div className="w-9 h-9 rounded-lg bg-accent text-accent-foreground flex items-center justify-center font-bold text-sm shrink-0">
                  Aa
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-heading font-bold text-foreground leading-tight">
                    Sou Terceiro / Visitante
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                    Meu código tem letras — toque para liberar o teclado
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-accent group-hover:translate-x-0.5 transition-transform">
                  Toque →
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAlphaKeyboard(false)}
                aria-pressed={alphaKeyboard}
                className="mt-2 inline-flex items-center gap-2 w-full justify-center rounded-md border border-border bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px] font-bold">0</span>
                Voltar para teclado numérico (Mobis)
              </button>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("login.password")}</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder=""
              onFocus={(e) => e.target.placeholder = ""}
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-heading font-semibold h-12"
          >
            {loading ? t("login.wait") : (
              <>
                <LogIn className="w-4 h-4 mr-2" />
                {t("login.enter")}
              </>
            )}
          </Button>
          <Link
            to="/esqueci-senha"
            className="block w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("login.forgotPassword")}
          </Link>
        </form>

        <div className="mt-6 pt-4 border-t border-border/30 flex flex-col items-center gap-3">
          <Link
            to="/privacy-policy"
            className="text-xs text-muted-foreground hover:text-accent transition-colors"
          >
            Política de Privacidade
          </Link>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/50 border border-border/40">
            <span className="text-[10px] font-mono text-muted-foreground">v{import.meta.env.VITE_APP_VERSION || "1.0.0.0"}</span>
          </div>
        </div>
      </div>

      {/* Error Dialog */}
      <Dialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Erro no Login
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{errorMessage}</p>
          <Button onClick={() => setErrorDialogOpen(false)} className="w-full mt-2">Entendi</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Login;
