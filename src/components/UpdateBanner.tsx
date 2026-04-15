import { useAppVersion } from "@/hooks/useAppVersion";
import { RefreshCw, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const UpdateBanner = () => {
  const { updateAvailable, criticalUpdate } = useAppVersion();

  if (!updateAvailable && !criticalUpdate) return null;

  const handleRefresh = () => {
    // Navigate to root to avoid 404 on stale routes
    window.location.href = '/';
  };

  const handleLogoutAndRefresh = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
        <div className="bg-background border rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-300">
          {/* Icon */}
          <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${criticalUpdate ? "bg-destructive/15" : "bg-primary/15"}`}>
            <RefreshCw className={`w-8 h-8 animate-spin ${criticalUpdate ? "text-destructive" : "text-primary"}`} />
          </div>

          {/* Title */}
          <div className="text-center space-y-2">
            <h2 className="text-lg font-heading font-bold">
              {criticalUpdate ? "Atualização Obrigatória" : "Nova Versão Disponível"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {criticalUpdate
                ? "Uma atualização crítica está disponível. Por favor, atualize para continuar usando o sistema."
                : "Uma nova versão do sistema foi publicada. Atualize para ter acesso às últimas melhorias."}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <Button onClick={handleRefresh} className="w-full gap-2 min-h-[44px]">
              <RefreshCw className="w-4 h-4" />
              Atualizar agora
            </Button>
            <Button variant="outline" onClick={handleLogoutAndRefresh} className="w-full gap-2 min-h-[44px]">
              <LogOut className="w-4 h-4" />
              Sair e atualizar
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default UpdateBanner;
