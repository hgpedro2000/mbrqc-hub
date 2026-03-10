import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ALL_MODULES } from "@/hooks/useModulePermissions";

const ModulePermissionsTab = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ["eng-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("status", "active").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: permissions = [], isLoading: loadingPerms } = useQuery({
    queryKey: ["all-module-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_module_permissions").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["eng-user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data;
    },
  });

  const isAdmin = (userId: string) => roles.some((r: any) => r.user_id === userId && r.role === "admin");

  const isModuleEnabled = (userId: string, moduleId: string) => {
    if (isAdmin(userId)) return true;
    return permissions.some((p: any) => p.user_id === userId && p.module === moduleId && p.enabled);
  };

  const toggleModule = async (userId: string, moduleId: string) => {
    const key = `${userId}-${moduleId}`;
    setSaving(key);
    try {
      const existing = permissions.find((p: any) => p.user_id === userId && p.module === moduleId);
      if (existing) {
        const { error } = await supabase
          .from("user_module_permissions")
          .update({ enabled: !existing.enabled })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_module_permissions")
          .insert({ user_id: userId, module: moduleId, enabled: true });
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ["all-module-permissions"] });
      toast.success("Permissão atualizada");
    } catch (e: any) {
      toast.error("Erro ao atualizar permissão");
    } finally {
      setSaving(null);
    }
  };

  const enableAllModules = async (userId: string) => {
    setSaving(`all-${userId}`);
    try {
      for (const m of ALL_MODULES) {
        const existing = permissions.find((p: any) => p.user_id === userId && p.module === m.id);
        if (existing) {
          if (!existing.enabled) {
            await supabase.from("user_module_permissions").update({ enabled: true }).eq("id", existing.id);
          }
        } else {
          await supabase.from("user_module_permissions").insert({ user_id: userId, module: m.id, enabled: true });
        }
      }
      qc.invalidateQueries({ queryKey: ["all-module-permissions"] });
      toast.success("Todos os módulos ativados");
    } catch {
      toast.error("Erro ao ativar módulos");
    } finally {
      setSaving(null);
    }
  };

  const filteredProfiles = profiles.filter((p: any) =>
    p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    p.employee_number.includes(search)
  );

  const isLoading = loadingProfiles || loadingPerms;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-heading font-semibold">Permissões de Módulos</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Ative ou desative módulos individualmente para cada usuário. Administradores têm acesso a todos os módulos automaticamente.
      </p>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar usuário..."
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 px-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[150px]">Usuário</TableHead>
                {ALL_MODULES.map((m) => (
                  <TableHead key={m.id} className="text-center min-w-[100px] text-xs">
                    {m.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProfiles.map((p: any) => {
                const userIsAdmin = isAdmin(p.id);
                return (
                  <TableRow key={p.id} className={userIsAdmin ? "bg-muted/30" : ""}>
                    <TableCell>
                      <div>
                        <span className="font-medium text-sm">{p.full_name}</span>
                        <span className="block text-xs text-muted-foreground font-mono">{p.employee_number}</span>
                        {userIsAdmin && (
                          <span className="text-xs text-primary font-medium">Admin (todos)</span>
                        )}
                      </div>
                    </TableCell>
                    {ALL_MODULES.map((m) => (
                      <TableCell key={m.id} className="text-center">
                        <Switch
                          checked={isModuleEnabled(p.id, m.id)}
                          onCheckedChange={() => toggleModule(p.id, m.id)}
                          disabled={userIsAdmin || saving === `${p.id}-${m.id}`}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
              {filteredProfiles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={ALL_MODULES.length + 1} className="text-center text-muted-foreground py-8">
                    Nenhum usuário encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default ModulePermissionsTab;
