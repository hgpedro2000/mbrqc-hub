import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { AutomationConfigCard, GenericConfig } from "./AutomationConfigCard";
import { HistoryPanel } from "./EmailHistoryPanel";

const VARS_BY_SUBTIPO: Record<string, string[]> = {
  nova_solicitacao: ["numero", "item_name", "quantity", "user_name", "turno", "status", "date"],
  estoque_minimo: ["item_name", "stock_qty", "min_qty", "unit", "date"],
  agendado: ["date", "period", "total_items", "total_low"],
};

const DESCRIPTIONS: Record<string, string> = {
  nova_solicitacao: "Disparado automaticamente a cada nova requisição de consumível.",
  estoque_minimo: "Disparado quando o estoque de um item cruza o mínimo (idempotente por item até o estoque voltar a subir).",
  agendado: "Resumo semanal com tabela completa de itens e status OK/Baixo.",
};

const ConsumiveisEmailTab = () => {
  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["email_automation_config", "consumiveis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_automation_config" as any)
        .select("*")
        .eq("modulo", "consumiveis");
      if (error) throw error;
      const order = ["nova_solicitacao", "agendado", "estoque_minimo"];
      return ((data as any[]) as GenericConfig[]).sort(
        (a, b) => order.indexOf(a.subtipo) - order.indexOf(b.subtipo),
      );
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
          key={c.id} config={c}
          vars={VARS_BY_SUBTIPO[c.subtipo] ?? []}
          scheduled={c.subtipo === "agendado"}
          senderFn="send-consumiveis-email"
          queryKey={["email_automation_config", "consumiveis"]}
          description={DESCRIPTIONS[c.subtipo]}
        />
      ))}

      <HistoryPanel
        modulo="consumiveis"
        senderFn="send-consumiveis-email"
        configSubtipo={subtipoMap}
        configName={nameMap}
        title="Consumíveis"
        buildResendBody={(log) => ({
          ...(log.entity_id ? (subtipoMap.get(log.config_id) === "nova_solicitacao"
            ? { request_id: log.entity_id }
            : { item_id: log.entity_id }) : {}),
        })}
      />
    </div>
  );
};

export default ConsumiveisEmailTab;
