import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Send } from "lucide-react";
import logo from "@/assets/hyundai-mobis-logo.png";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const ForgotPassword = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success(t("forgotPassword.success"));
    } catch (error: any) {
      toast.error(t("forgotPassword.error"), { description: error?.message });

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={logo} alt="Hyundai Mobis" className="h-16 mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-heading font-bold text-foreground">{t("forgotPassword.title")}</h1>
          <p className="text-muted-foreground mt-1">
            {sent ? t("forgotPassword.subtitleSent") : t("forgotPassword.subtitleDefault")}
          </p>
        </div>

        {!sent ? (
          <form onSubmit={handleSubmit} className="form-section space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("forgotPassword.email")}</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("forgotPassword.emailPlaceholder")} />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-heading font-semibold h-12">
              {loading ? t("common.sending") : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  {t("forgotPassword.sendLink")}
                </>
              )}
            </Button>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center" aria-hidden>
                <span className="w-full border-t border-border/50" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-card px-2 text-[11px] uppercase tracking-wider text-muted-foreground">{t("forgotPassword.or")}</span>
              </div>
            </div>

            <Link
              to="/solicitar-reset-admin"
              className="inline-flex flex-col items-center justify-center gap-0.5 w-full min-h-[3.25rem] py-2 rounded-md border-2 border-accent bg-accent/10 px-4 text-center font-heading font-semibold text-foreground hover:bg-accent hover:text-accent-foreground transition-colors shadow-sm"
            >
              <span className="text-sm leading-tight">{t("forgotPassword.requestAdminLine1")}</span>
              <span className="text-xs leading-tight opacity-90">{t("forgotPassword.requestAdminLine2")}</span>
            </Link>




            <Link to="/login" className="flex items-center justify-center gap-2 w-full text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              {t("forgotPassword.backToLogin")}
            </Link>
          </form>
        ) : (
          <div className="form-section space-y-4 text-center">
            <p className="text-sm text-muted-foreground">{t("forgotPassword.sentMessage")}</p>
            <Link to="/login" className="flex items-center justify-center gap-2 w-full text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              {t("forgotPassword.backToLogin")}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
