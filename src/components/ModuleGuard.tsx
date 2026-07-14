import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ShieldOff, ArrowLeft } from "lucide-react";
import { useEnabledModules, ALL_MODULES, ModuleId } from "@/hooks/useModulePermissions";

interface ModuleGuardProps {
  module: ModuleId;
  children: ReactNode;
}

/**
 * Blocks access to a module page when the user (or the impersonated user)
 * doesn't have the module OR its parent Sub-Hub enabled.
 */
const ModuleGuard = ({ module, children }: ModuleGuardProps) => {
  const { enabledModules, isLoading } = useEnabledModules();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  const hasModule = enabledModules.includes(module);
  const meta = ALL_MODULES.find((m) => m.id === module) as any;
  const subHub = meta?.subHub as ModuleId | undefined;
  const hasSubHub = !subHub || enabledModules.includes(subHub);

  if (hasModule && hasSubHub) return <>{children}</>;

  const subHubLabel = subHub
    ? ALL_MODULES.find((m) => m.id === subHub)?.label
    : null;
  const moduleLabel = meta?.label ?? module;

  return (
    <div
      role="alert"
      aria-live="polite"
      data-testid="module-guard-denied"
      className="min-h-screen bg-background flex items-center justify-center px-4"
    >
      <div className="max-w-md w-full text-center space-y-4 border border-border rounded-xl p-6 bg-card">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldOff className="w-7 h-7 text-destructive" />
          </div>
        </div>
        <h1 className="text-xl font-heading font-bold text-foreground">Acesso negado</h1>
        <p className="text-sm text-muted-foreground">
          {!hasSubHub && subHubLabel ? (
            <>
              Você não possui permissão para o <strong>{subHubLabel}</strong>, que contém o módulo{" "}
              <strong>{moduleLabel}</strong>.
            </>
          ) : (
            <>
              Você não possui permissão para acessar o módulo <strong>{moduleLabel}</strong>.
            </>
          )}
          <br />
          Solicite acesso ao administrador no Modo Engenharia.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao Hub
        </Link>
      </div>
    </div>
  );
};

export default ModuleGuard;
