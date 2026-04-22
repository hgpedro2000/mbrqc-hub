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

const Login = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { versionKicked, user, profile, loading: authLoading } = useAuth();
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("auth-login-by-number", {
        body: { employee_number: employeeNumber.trim(), password },
      });

      if (error) {
        // Try to extract the real error message from the response body
        let realMsg = t("login.authError");
        try {
          if (error.context && typeof error.context.json === "function") {
            const body = await error.context.json();
            if (body?.error) realMsg = body.error;
          }
        } catch { /* ignore parse errors */ }
        throw new Error(realMsg);
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

      // Mark as submitted; the useEffect above will navigate once the
      // AuthContext finishes hydrating with the new session.
      setSubmitted(true);
    } catch (error: any) {
      const msg = error.message || t("login.authError");
      setErrorMessage(msg);
      setErrorDialogOpen(true);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="absolute top-4 right-4">
        <LanguageToggle variant="login" />
      </div>
      <div className="w-full max-w-md">
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
              onChange={(e) => setEmployeeNumber(e.target.value)}
              placeholder=""
              inputMode="text"
              onFocus={(e) => e.target.placeholder = ""}
            />
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

        <div className="mt-6 pt-4 border-t border-border/30 text-center">
          <Link
            to="/privacy-policy"
            className="text-xs text-muted-foreground hover:text-accent transition-colors"
          >
            Política de Privacidade
          </Link>
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
