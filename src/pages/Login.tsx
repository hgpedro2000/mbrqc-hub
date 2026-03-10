import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn } from "lucide-react";
import logo from "@/assets/hyundai-mobis-logo.png";
import { toast } from "sonner";
import LanguageToggle from "@/components/LanguageToggle";
import { useTranslation } from "react-i18next";

const Login = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("auth-login-by-number", {
        body: { employee_number: employeeNumber.trim(), password },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || t("login.authError"));
      }

      if (data.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }

      if (data.profile?.must_change_password) {
        toast.info(t("login.mustChangePassword"));
        navigate("/alterar-senha");
        return;
      }

      toast.success(`${t("login.welcome")}, ${data.profile?.full_name || ""}!`);
      navigate("/");
    } catch (error: any) {
      toast.error(error.message || t("login.authError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="absolute top-4 right-4">
        <LanguageToggle variant="login" />
      </div>
      <div className="w-full max-w-md">
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
              placeholder="Ex: 3501165"
              inputMode="numeric"
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
              placeholder={t("login.password")}
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
      </div>
    </div>
  );
};

export default Login;
