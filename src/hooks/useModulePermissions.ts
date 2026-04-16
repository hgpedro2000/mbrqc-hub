import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const ALL_MODULES = [
  { id: "tryout", label: "Try-Out" },
  { id: "auditorias", label: "Auditorias" },
  { id: "contencao", label: "Contenção" },
  { id: "apontamentos", label: "Apontamentos" },
  { id: "apontamentos_incoming", label: "  ↳ Incoming", parent: "apontamentos" },
  { id: "apontamentos_peca", label: "  ↳ Peça", parent: "apontamentos" },
  { id: "apontamentos_processo", label: "  ↳ Processo", parent: "apontamentos" },
  { id: "apontamentos_oem", label: "  ↳ OEM", parent: "apontamentos" },
  { id: "alerta-qualidade", label: "Alerta de Qualidade" },
  { id: "consumiveis", label: "Consumíveis" },
  { id: "consumiveis_requisitar", label: "  ↳ Requisitar Item", parent: "consumiveis" },
  { id: "consumiveis_inventario", label: "  ↳ Inventário e Requisições", parent: "consumiveis" },
  { id: "consulta-pecas", label: "Consulta de Peças" },
  { id: "matriz-versatilidade", label: "Matriz de Versatilidade" },
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
  const { data: roles } = useQuery({
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

  const isAdmin = roles?.some((r) => r.role === "admin") ?? false;

  // Admins see all modules (only when not overriding)
  if (isAdmin && !overrideUserId) {
    return { enabledModules: ALL_MODULES.map((m) => m.id), isLoading: false };
  }

  // If no permissions set, show nothing (no modules enabled)
  const enabledModules = (permissions || [])
    .filter((p) => p.enabled)
    .map((p) => p.module as ModuleId);

  return { enabledModules, isLoading };
};
