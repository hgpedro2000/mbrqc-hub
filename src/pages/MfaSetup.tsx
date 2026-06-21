import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import AuthenticatorLauncher from "@/components/AuthenticatorLauncher";

export default function MfaSetup() {
  const navigate = useNavigate();
  const { refreshMFAStatus, signOut } = useAuth();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauthUri, setOtpauthUri] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const enroll = async () => {
      try {
        // Clean up unverified factors first
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const unverified = (factors?.totp || []).filter((f: any) => f.status !== "verified");
        for (const f of unverified) {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }

        // Fetch current user's profile to use as account name in the authenticator app
        const { data: sessionData } = await supabase.auth.getUser();
        const userId = sessionData.user?.id;
        let accountName = sessionData.user?.email || "Quality Tools User";
        if (userId) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email, employee_number")
            .eq("id", userId)
            .maybeSingle();
          if (profile) {
            accountName = profile.email || profile.full_name || profile.employee_number || accountName;
          }
        }

        const { data, error } = await supabase.auth.mfa.enroll({
          factorType: "totp",
          issuer: "Quality Tools MBR",
          friendlyName: `${accountName} (${Date.now()})`,
        });
        if (error) throw error;
        setFactorId(data.id);
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
        // Build otpauth:// URI so the smart launcher can open the chosen app
        // with this account pre-filled.
        const issuer = encodeURIComponent("Quality Tools MBR");
        const accLabel = encodeURIComponent(accountName);
        setOtpauthUri(
          (data.totp as any).uri ||
            `otpauth://totp/${issuer}:${accLabel}?secret=${data.totp.secret}&issuer=${issuer}`
        );
      } catch (err: any) {
        toast.error(err.message || "Erro ao iniciar MFA");
      } finally {
        setLoading(false);
      }
    };
    enroll();
  }, []);

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
      toast.success("MFA configurado com sucesso");
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
          <CardTitle>Configurar MFA</CardTitle>
          <CardDescription>
            Como administrador, você precisa habilitar autenticação de dois fatores.
            Escaneie o QR code com seu app autenticador (Google Authenticator, Authy, etc.).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              {qrCode && (
                <div className="flex justify-center bg-white p-4 rounded">
                  <img src={qrCode} alt="QR Code MFA" className="w-48 h-48" />
                </div>
              )}
              {secret && (
                <div className="text-xs text-muted-foreground break-all text-center">
                  Código manual: <span className="font-mono">{secret}</span>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium">Código de 6 dígitos</label>
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                />
              </div>
              <Button onClick={handleVerify} disabled={code.length !== 6 || verifying} className="w-full">
                {verifying ? "Verificando..." : "Verificar e ativar"}
              </Button>
              <Button variant="ghost" onClick={async () => { await signOut(); navigate("/login"); }} className="w-full">
                Sair
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
