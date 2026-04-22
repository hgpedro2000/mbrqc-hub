import { useState, useMemo, useEffect } from "react";
import type { Session } from "@supabase/supabase-js";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { KeyRound, Check, X, AlertTriangle, ShieldCheck, Info } from "lucide-react";
import logo from "@/assets/hyundai-mobis-logo.png";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  evaluatePassword,
  passwordScore,
  isPasswordValid,
  strengthLabel,
  hashPassword,
  PASSWORD_HISTORY_SIZE,
  MIN_PASSWORD_LENGTH,
} from "@/lib/passwordPolicy";

const ChangePassword = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const expired = searchParams.get("expired") === "1";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  const criteria = useMemo(() => evaluatePassword(password), [password]);
  const score = passwordScore(criteria);
  const valid = isPasswordValid(criteria);
  const strength = strengthLabel(score);
  const matches = password.length > 0 && password === confirmPassword;
  const canSubmit = valid && matches && !loading && session !== null;

  useEffect(() => {
    if (expired) {
      toast.warning("Sua senha expirou. Por favor, cadastre uma nova senha.");
    }
  }, [expired]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (currentSession) {
        setSession(currentSession);
        return;
      }

      if (event === "SIGNED_OUT" || event === "INITIAL_SESSION") {
        toast.error("Sessão expirada. Faça login novamente.");
        navigate("/login", { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!valid) {
      toast.error("A senha não atende todos os critérios de segurança.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error(t("changePassword.mismatchError"));
      return;
    }

    setLoading(true);
    try {
      if (!session) {
        toast.error("Sessão expirada. Faça login novamente.");
        navigate("/login", { replace: true });
        return;
      }
      const user = session.user;
      if (!user) throw new Error("Sessão inválida.");

      // Check password history (last N hashes)
      const newHash = await hashPassword(password);
      const { data: history } = await supabase
        .from("password_history" as any)
        .select("password_hash")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(PASSWORD_HISTORY_SIZE);

      if (history && (history as any[]).some((h) => h.password_hash === newHash)) {
        toast.error(`Você não pode reutilizar uma das últimas ${PASSWORD_HISTORY_SIZE} senhas. Escolha uma diferente.`);
        setLoading(false);
        return;
      }

      const { error: pwError } = await supabase.auth.updateUser({ password });
      if (pwError) throw pwError;

      // Save to history + reset flags
      await supabase.from("password_history" as any).insert({
        user_id: user.id,
        password_hash: newHash,
      });

      await supabase
        .from("profiles")
        .update({
          must_change_password: false,
          password_changed_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      await supabase.auth.signOut();
      toast.success(t("changePassword.success"));
      navigate("/login");
    } catch (error: any) {
      toast.error(error.message || t("changePassword.error"));
    } finally {
      setLoading(false);
    }
  };

  const CriterionRow = ({ ok, label }: { ok: boolean; label: string }) => (
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <Check className="w-4 h-4 text-success shrink-0" />
      ) : (
        <X className="w-4 h-4 text-muted-foreground shrink-0" />
      )}
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={logo} alt="Hyundai Mobis" className="h-16 mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-heading font-bold text-foreground">{t("changePassword.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("changePassword.subtitle")}</p>
        </div>

        {expired && (
          <Alert className="mb-4 border-warning/50 bg-warning/10">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertDescription className="text-foreground">
              Sua senha expirou. Por favor, cadastre uma nova senha.
            </AlertDescription>
          </Alert>
        )}

        <Alert className="mb-4 border-primary/40 bg-primary/5">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <AlertDescription className="text-foreground">
            <p className="font-semibold mb-1">Política de senha</p>
            <ul className="list-disc pl-4 space-y-0.5 text-sm text-muted-foreground">
              <li>Mínimo de {MIN_PASSWORD_LENGTH} caracteres</li>
              <li>Pelo menos 1 letra maiúscula, 1 número e 1 caractere especial</li>
              <li>Não pode repetir as últimas {PASSWORD_HISTORY_SIZE} senhas utilizadas</li>
            </ul>
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="form-section space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">{t("changePassword.newPassword")}</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
            />

            {password.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${strength.color}`}
                    style={{ width: `${strength.widthPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Força da senha</span>
                  <span className="font-medium text-foreground">{strength.label}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-1.5 pt-2">
              <CriterionRow ok={criteria.minLength} label={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`} />
              <CriterionRow ok={criteria.uppercase} label="1 letra maiúscula" />
              <CriterionRow ok={criteria.number} label="1 número" />
              <CriterionRow ok={criteria.special} label="1 caractere especial" />
              <div className="flex items-center gap-2 text-sm">
                <Info className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">
                  Não pode ser igual às últimas {PASSWORD_HISTORY_SIZE} senhas (verificado ao salvar)
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t("changePassword.confirmPassword")}</Label>
            <Input
              id="confirmPassword"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t("changePassword.repeatPassword")}
            />
            {confirmPassword.length > 0 && !matches && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <X className="w-3 h-3" /> As senhas não coincidem
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-heading font-semibold h-12"
          >
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
