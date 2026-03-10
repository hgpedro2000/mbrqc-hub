import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const ALL_MODULES = [
  { id: "tryout", label: "Try-Out" },
  { id: "auditorias", label: "Auditorias" },
  { id: "contencao", label: "Contenção" },
  { id: "apontamentos", label: "Apontamentos" },
  { id: "alerta-qualidade", label: "Alerta de Qualidade" },
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

export const useEnabledModules = () => {
  const { user } = useAuth();
  const { data: permissions, isLoading } = useModulePermissions();
  const { data: roles } = useQuery({
    queryKey: ["my-roles"],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const isAdmin = roles?.some((r) => r.role === "admin") ?? false;

  // Admins see all modules
  if (isAdmin) {
    return { enabledModules: ALL_MODULES.map((m) => m.id), isLoading: false };
  }

  // If no permissions set, show nothing (no modules enabled)
  const enabledModules = (permissions || [])
    .filter((p) => p.enabled)
    .map((p) => p.module as ModuleId);

  return { enabledModules, isLoading };
};
