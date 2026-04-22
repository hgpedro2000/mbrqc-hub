import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

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

  const handleVerify = async () => {
    if (!factorId || code.length !== 6) return;
    setVerifying(true);
    try {
      const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
      if (cErr) throw cErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (vErr) throw vErr;
      toast.success("Autenticação concluída");
      await refreshMFAStatus();
      navigate("/", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Código inválido");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Verificação MFA</CardTitle>
          <CardDescription>
            Insira o código de 6 dígitos do seu app autenticador.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            autoFocus
          />
          <Button onClick={handleVerify} disabled={code.length !== 6 || verifying} className="w-full">
            {verifying ? "Verificando..." : "Verificar"}
          </Button>
          <Button variant="ghost" onClick={async () => { await signOut(); navigate("/login"); }} className="w-full">
            Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
