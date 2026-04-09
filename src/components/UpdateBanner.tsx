import { useAppVersion } from "@/hooks/useAppVersion";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const UpdateBanner = () => {
  const { updateAvailable, criticalUpdate } = useAppVersion();

  if (!updateAvailable && !criticalUpdate) return null;

  return (
    <div className={`fixed top-0 left-0 right-0 z-[100] px-4 py-2 flex items-center justify-center gap-3 text-sm font-medium ${criticalUpdate ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}`}>
      <RefreshCw className="w-4 h-4 animate-spin" />
      <span>{criticalUpdate ? "Atualização obrigatória disponível" : "Nova versão disponível"}</span>
      <Button
        size="sm"
        variant={criticalUpdate ? "secondary" : "outline"}
        className="h-7 text-xs text-foreground"
        onClick={() => { window.location.href = '/'; }}
      >
        Atualizar agora
      </Button>
    </div>
  );
};

export default UpdateBanner;
