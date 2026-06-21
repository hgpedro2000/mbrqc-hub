import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Smartphone, ExternalLink, Check } from "lucide-react";

/**
 * Smart Authenticator Launcher
 * --------------------------------
 * Botão único que abre o app autenticador do usuário.
 * - Primeira vez: abre modal pedindo para escolher qual app ele usa.
 * - Próximas vezes: abre direto o app escolhido (lembrado em localStorage).
 * - Link "trocar app" volta ao modal de seleção.
 *
 * Se `otpauthUri` for fornecido (tela de cadastro do MFA), usa o link
 * universal `otpauth://` — qualquer autenticador instalado captura. Caso
 * contrário (tela de verificação no login), tenta abrir o scheme nativo
 * do app escolhido pelo usuário.
 */

type AuthenticatorApp = {
  id: string;
  label: string;
  scheme: string; // URL scheme to try opening (when no otpauth URI is available)
  color: string; // tailwind bg class for the colored dot
};

const APPS: AuthenticatorApp[] = [
  { id: "google", label: "Google Authenticator", scheme: "googleauthenticator://", color: "bg-blue-500" },
  { id: "microsoft", label: "Microsoft Authenticator", scheme: "msauth://", color: "bg-sky-600" },
  { id: "authy", label: "Authy", scheme: "authy://", color: "bg-red-500" },
  { id: "1password", label: "1Password", scheme: "onepassword://", color: "bg-slate-700" },
  { id: "bitwarden", label: "Bitwarden", scheme: "bitwarden://", color: "bg-amber-500" },
  { id: "other", label: "Outro app autenticador", scheme: "otpauth://", color: "bg-muted-foreground" },
];

const STORAGE_KEY = "mfa_preferred_authenticator";

const getStoredApp = (): AuthenticatorApp | null => {
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    if (!id) return null;
    return APPS.find((a) => a.id === id) || null;
  } catch {
    return null;
  }
};

interface Props {
  /**
   * Optional otpauth:// URI from MFA enrollment. When provided, clicking the
   * button uses this URI (so the chosen app opens with the new account
   * pre-filled). When absent (login verification), tries the native scheme
   * of the chosen app.
   */
  otpauthUri?: string;
  className?: string;
}

export default function AuthenticatorLauncher({ otpauthUri, className }: Props) {
  const [chosen, setChosen] = useState<AuthenticatorApp | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    setChosen(getStoredApp());
  }, []);

  const handlePick = (app: AuthenticatorApp) => {
    try {
      localStorage.setItem(STORAGE_KEY, app.id);
    } catch {}
    setChosen(app);
    setModalOpen(false);
    // Open right after picking
    setTimeout(() => launch(app), 50);
  };

  const launch = (app: AuthenticatorApp) => {
    // Setup flow: always prefer otpauth:// so the secret is pre-filled.
    // Login flow: use the chosen app's native scheme.
    const target = otpauthUri || app.scheme;
    try {
      window.location.href = target;
    } catch {
      window.open(target, "_blank");
    }
  };

  const handleMainClick = () => {
    if (!chosen) {
      setModalOpen(true);
      return;
    }
    launch(chosen);
  };

  return (
    <>
      <div className={className}>
        <Button
          type="button"
          onClick={handleMainClick}
          variant="outline"
          className="w-full h-11 border-accent/40 hover:border-accent hover:bg-accent/5 font-medium"
        >
          <Smartphone className="w-4 h-4 mr-2 text-accent" />
          {chosen ? `Abrir ${chosen.label}` : "Abrir app autenticador"}
          <ExternalLink className="w-3.5 h-3.5 ml-2 opacity-60" />
        </Button>

        {chosen && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="block mx-auto mt-1.5 text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            trocar app
          </button>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Qual app você usa?</DialogTitle>
            <DialogDescription className="text-xs">
              Sua escolha será memorizada para abrir direto nos próximos acessos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 pt-2">
            {APPS.map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => handlePick(app)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border hover:border-accent hover:bg-accent/5 transition-colors text-left"
              >
                <span className={`w-2.5 h-2.5 rounded-full ${app.color} shrink-0`} />
                <span className="flex-1 text-sm font-medium text-foreground">{app.label}</span>
                {chosen?.id === app.id && <Check className="w-4 h-4 text-accent" />}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
            Se o app não abrir, é porque não está instalado neste dispositivo. Instale pela loja e tente novamente.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
