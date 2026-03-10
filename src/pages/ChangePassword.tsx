import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound } from "lucide-react";
import logo from "@/assets/hyundai-mobis-logo.png";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const ChangePassword = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error(t("changePassword.minError"));
      return;
    }

    if (password !== confirmPassword) {
      toast.error(t("changePassword.mismatchError"));
      return;
    }

    setLoading(true);
    try {
      const { error: pwError } = await supabase.auth.updateUser({ password });
      if (pwError) throw pwError;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({ must_change_password: false })
          .eq("id", user.id);
      }

      await supabase.auth.signOut();
      toast.success(t("changePassword.success"));
      navigate("/login");
    } catch (error: any) {
      toast.error(error.message || t("changePassword.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={logo} alt="Hyundai Mobis" className="h-16 mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-heading font-bold text-foreground">{t("changePassword.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("changePassword.subtitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="form-section space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">{t("changePassword.newPassword")}</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("changePassword.minChars")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t("changePassword.confirmPassword")}</Label>
            <Input id="confirmPassword" type="password" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={t("changePassword.repeatPassword")} />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-heading font-semibold h-12">
            {loading ? t("common.saving") : (
              <>
                <KeyRound className="w-4 h-4 mr-2" />
                {t("changePassword.setPassword")}
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;
