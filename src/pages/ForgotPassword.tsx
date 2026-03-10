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
      toast.error(error.message || t("forgotPassword.error"));
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
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-heading font-semibold h-12">
              {loading ? t("common.sending") : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  {t("forgotPassword.sendLink")}
                </>
              )}
            </Button>
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
