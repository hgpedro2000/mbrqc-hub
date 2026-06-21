import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { AutomationConfigCard, GenericConfig } from "./AutomationConfigCard";
import { HistoryPanel } from "./EmailHistoryPanel";

const VARS = ["date", "period", "total_vencidos", "total_vencer", "dias_antecedencia"];

const MatrizEmailTab = () => {
  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["email_automation_config", "matriz"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_automation_config" as any)
        .select("*")
        .eq("modulo", "matriz");
      if (error) throw error;
      return ((data as any[]) as GenericConfig[]);
    },
  });

  const { subtipoMap, nameMap } = useMemo(() => {
    const s = new Map<string, string>();
    const n = new Map<string, string>();
    configs.forEach((c) => { s.set(c.id, c.subtipo); n.set(c.id, c.name); });
    return { subtipoMap: s, nameMap: n };
  }, [configs]);

  if (isLoading) return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {configs.map((c) => (
        <AutomationConfigCard
          key={c.id} config={c} vars={VARS} scheduled
          senderFn="send-matriz-email"
          queryKey={["email_automation_config", "matriz"]}
          description="Resumo semanal de treinamentos vencidos e a vencer (janela configurável)."
          diasAntecedencia
        />
      ))}

      <HistoryPanel
        modulo="matriz" senderFn="send-matriz-email"
        configSubtipo={subtipoMap} configName={nameMap}
        title="Matriz de Versatilidade"
      />
    </div>
  );
};

export default MatrizEmailTab;
