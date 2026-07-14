import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const SUB_HUBS = [
  { id: "subhub_qualidade", label: "Sub-Hub: Qualidade" },
  { id: "subhub_ga", label: "Sub-Hub: G.A." },
  { id: "subhub_producao", label: "Sub-Hub: Produção" },
  { id: "subhub_vendas", label: "Sub-Hub: Vendas" },
  { id: "subhub_sesmt", label: "Sub-Hub: SESMT" },
] as const;

export const ALL_MODULES = [
  // Sub-Hubs (top level access)
  { id: "subhub_qualidade", label: "Sub-Hub: Qualidade", isSubHub: true },
  { id: "subhub_ga", label: "Sub-Hub: G.A.", isSubHub: true },
  { id: "subhub_producao", label: "Sub-Hub: Produção", isSubHub: true },
  { id: "subhub_vendas", label: "Sub-Hub: Vendas", isSubHub: true },
  { id: "subhub_sesmt", label: "Sub-Hub: SESMT", isSubHub: true },

  // Qualidade modules
  { id: "tryout", label: "Try-Out", subHub: "subhub_qualidade" },
  { id: "auditorias", label: "Auditorias", subHub: "subhub_qualidade" },
  { id: "contencao", label: "Contenção", subHub: "subhub_qualidade" },
  { id: "apontamentos", label: "Apontamentos", subHub: "subhub_qualidade" },
  { id: "apontamentos_incoming", label: "  ↳ Incoming", parent: "apontamentos", subHub: "subhub_qualidade" },
  { id: "apontamentos_peca", label: "  ↳ Peça", parent: "apontamentos", subHub: "subhub_qualidade" },
  { id: "apontamentos_processo", label: "  ↳ Processo", parent: "apontamentos", subHub: "subhub_qualidade" },
  { id: "apontamentos_oem", label: "  ↳ OEM", parent: "apontamentos", subHub: "subhub_qualidade" },
  { id: "apontamentos_contencao", label: "  ↳ Contenção", parent: "apontamentos", subHub: "subhub_qualidade" },
  { id: "alerta-qualidade", label: "Alerta de Qualidade", subHub: "subhub_qualidade" },
  { id: "consumiveis", label: "Consumíveis", subHub: "subhub_qualidade" },
  { id: "consumiveis_requisitar", label: "  ↳ Requisitar Item", parent: "consumiveis", subHub: "subhub_qualidade" },
  { id: "consumiveis_inventario", label: "  ↳ Inventário e Requisições", parent: "consumiveis", subHub: "subhub_qualidade" },
  { id: "consulta-pecas", label: "Consulta de Peças", subHub: "subhub_qualidade" },
  { id: "matriz-versatilidade", label: "Matriz de Versatilidade", subHub: "subhub_qualidade" },
  { id: "analise-risco", label: "Análise de Risco", subHub: "subhub_qualidade" },
] as const;

export type ModuleId = typeof ALL_MODULES[number]["id"];

export const useModulePermissions = (userId?: string) => {
  const { user } = useAuth();
  const targetUserId = userId || user?.id;

  return useQuery({
    queryKey: ["module-permissions", targetUserId],
    queryFn: async () => {
      if (!targetUserId) return [];
      const { data, error } = await supabase
        .from("user_module_permissions")
        .select("*")
        .eq("user_id", targetUserId);
      if (error) throw error;
      return data;
    },
    enabled: !!targetUserId,
  });
};

export const useEnabledModules = (overrideUserId?: string) => {
  const { user } = useAuth();
  const targetUserId = overrideUserId || user?.id;
  const { data: permissions, isLoading } = useModulePermissions(targetUserId);
  const { data: roles, isLoading: rolesLoading } = useQuery({
    queryKey: ["my-roles", targetUserId],
    queryFn: async () => {
      if (!targetUserId) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", targetUserId);
      if (error) throw error;
      return data;
    },
    enabled: !!targetUserId,
  });

  const isAdmin = useMemo(() => roles?.some((r) => r.role === "admin") ?? false, [roles]);

  const enabledModules = useMemo(() => {
    if (isAdmin && !overrideUserId) {
      return ALL_MODULES.map((m) => m.id);
    }

    const enabledSet = new Set(
      (permissions || []).filter((p) => p.enabled).map((p) => p.module)
    );

    // Filter out modules whose Sub-Hub is not enabled for this user
    return ALL_MODULES
      .filter((m) => {
        if (!enabledSet.has(m.id)) return false;
        const subHub = (m as any).subHub;
        if (subHub && !enabledSet.has(subHub)) return false;
        return true;
      })
      .map((m) => m.id as ModuleId);
  }, [isAdmin, overrideUserId, permissions]);

  return { enabledModules, isLoading: isLoading || rolesLoading };
};
