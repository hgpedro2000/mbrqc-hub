import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, AlertTriangle, RefreshCw } from "lucide-react";
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
    // Pre-request camera permission. Browsers REQUIRE a user gesture for the
    // initial prompt — once granted, the permission is remembered and no
    // future prompt is shown when opening the scanner.
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        stream.getTracks().forEach((t) => t.stop());
      }
    } catch {
      // Ignore — user may deny or device may have no camera. Scanner will
      // re-prompt if needed.
    }
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

        <form onSubmit={handleSubmit} className="form-section space-y-4">
          <div className="space-y-2">
            <Label htmlFor="employeeNumber">{t("login.employeeNumber")}</Label>
            <Input
              id="employeeNumber"
              type="text"
              required
              value={employeeNumber}
              onChange={(e) => {
                const v = e.target.value;
                setEmployeeNumber(alphaKeyboard ? v.toUpperCase().replace(/\s/g, "") : v.replace(/\D/g, ""));
              }}
              placeholder=""
              inputMode={alphaKeyboard ? "text" : "numeric"}
              pattern={alphaKeyboard ? undefined : "[0-9]*"}
              autoComplete="username"
              autoCapitalize={alphaKeyboard ? "characters" : "off"}
              onFocus={(e) => e.target.placeholder = ""}
            />
            <button
              type="button"
              onClick={() => setAlphaKeyboard((v) => !v)}
              className="text-xs text-muted-foreground hover:text-accent transition-colors underline-offset-2 hover:underline"
            >
              {alphaKeyboard
                ? "Usar teclado numérico"
                : "Meu código tem letras (terceiros) — usar teclado alfanumérico"}
            </button>
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
