import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Loader2, Search, CheckCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ALL_MODULES } from "@/hooks/useModulePermissions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const MODULE_ABBREVIATIONS: Record<string, string> = {
  "Sub-Hub: Qualidade": "Qualidade",
  "Sub-Hub: G.A.": "G.A.",
  "Sub-Hub: Produção": "Produção",
  "Sub-Hub: Vendas": "Vendas",
  "Sub-Hub: SESMT": "SESMT",
  "Try-Out": "Try-Out",
  "Auditorias": "Audit.",
  "Contenção": "Conten.",
  "Apontamentos": "Apont.",
  "  ↳ Incoming": "Incoming",
  "  ↳ Peça": "Peça",
  "  ↳ Processo": "Processo",
  "  ↳ OEM": "OEM",
  "Alerta de Qualidade": "Alerta Q.",
  "Consumíveis": "Consum.",
  "  ↳ Requisitar Item": "Req. Item",
  "  ↳ Inventário e Requisições": "Inv. Req.",
  "Consulta de Peças": "Cons. Peças",
  "Matriz de Versatilidade": "Matr. Vers.",
  "Análise de Risco": "Análise R.",
};

const ModulePermissionsTab = () => {
  const { t } = useTranslation();
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
      const newEnabled = existing ? !existing.enabled : true;
      if (existing) {
        const { error } = await supabase
          .from("user_module_permissions")
          .update({ enabled: newEnabled })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_module_permissions")
          .insert({ user_id: userId, module: moduleId, enabled: true });
        if (error) throw error;
      }
      // Auto-enable apontamentos_incoming when enabling apontamentos
      if (moduleId === "apontamentos" && newEnabled) {
        const existingIncoming = permissions.find((p: any) => p.user_id === userId && p.module === "apontamentos_incoming");
        if (!existingIncoming) {
          await supabase.from("user_module_permissions").insert({ user_id: userId, module: "apontamentos_incoming", enabled: true });
        } else if (!existingIncoming.enabled) {
          await supabase.from("user_module_permissions").update({ enabled: true }).eq("id", existingIncoming.id);
        }
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

  const disableAllModules = async (userId: string) => {
    setSaving(`none-${userId}`);
    try {
      for (const m of ALL_MODULES) {
        const existing = permissions.find((p: any) => p.user_id === userId && p.module === m.id);
        if (existing && existing.enabled) {
          await supabase.from("user_module_permissions").update({ enabled: false }).eq("id", existing.id);
        }
      }
      qc.invalidateQueries({ queryKey: ["all-module-permissions"] });
      toast.success("Todos os módulos desativados");
    } catch {
      toast.error("Erro ao desativar módulos");
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
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-heading font-semibold">Permissões de Módulos</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("engenharia.modulePermissionsDesc")}
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("engenharia.searchUser")}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Mobile card layout */}
            <div className="sm:hidden space-y-3">
              {filteredProfiles.map((p: any) => {
                const userIsAdmin = isAdmin(p.id);
                return (
                  <div key={p.id} className={`border rounded-lg p-3 space-y-2 ${userIsAdmin ? "bg-muted/30" : ""}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-sm">{p.full_name}</span>
                        <span className="block text-xs text-muted-foreground font-mono">{p.employee_number}</span>
                        {userIsAdmin && <span className="text-xs text-primary font-medium">Admin (todos)</span>}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" className="h-7 px-2 text-[10px]" disabled={userIsAdmin || saving === `all-${p.id}`} onClick={() => enableAllModules(p.id)}>
                          {saving === `all-${p.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3 h-3" />}
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] text-destructive" disabled={userIsAdmin || saving === `none-${p.id}`} onClick={() => disableAllModules(p.id)}>
                          {saving === `none-${p.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                      {ALL_MODULES.map((m) => {
                        const parentMod = (m as any).parent;
                        const subHub = (m as any).subHub;
                        if (parentMod && !isModuleEnabled(p.id, parentMod)) return null;
                        if (subHub && !isModuleEnabled(p.id, subHub)) return null;
                        const abbr = MODULE_ABBREVIATIONS[m.label] || m.label;
                        const isSubHub = (m as any).isSubHub;
                        return (
                          <div key={m.id} className={`flex items-center justify-between gap-1 ${isSubHub ? "col-span-2 border-t pt-1 mt-1" : ""}`}>
                            <span className={`text-[10px] truncate ${isSubHub ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{abbr}</span>
                            <Switch
                              checked={isModuleEnabled(p.id, m.id)}
                              onCheckedChange={() => toggleModule(p.id, m.id)}
                              disabled={userIsAdmin || saving === `${p.id}-${m.id}`}
                              className="scale-75"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {filteredProfiles.length === 0 && (
                <p className="text-center text-muted-foreground py-8 text-sm">Nenhum usuário encontrado</p>
              )}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto -mx-2 px-2 max-w-full">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-1.5 font-semibold text-muted-foreground min-w-[100px] sticky left-0 bg-background z-10">Usuário</th>
                    {ALL_MODULES.map((m) => {
                      const abbr = MODULE_ABBREVIATIONS[m.label] || m.label;
                      return (
                        <th key={m.id} className="text-center py-2 px-0.5 font-semibold text-muted-foreground">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-[8px] leading-tight block cursor-help whitespace-nowrap">{abbr}</span>
                            </TooltipTrigger>
                            <TooltipContent side="top"><p className="text-xs">{m.label}</p></TooltipContent>
                          </Tooltip>
                        </th>
                      );
                    })}
                    <th className="text-center py-2 px-0.5 font-semibold text-muted-foreground text-[8px]">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProfiles.map((p: any) => {
                    const userIsAdmin = isAdmin(p.id);
                    return (
                      <tr key={p.id} className={`border-b border-border/50 ${userIsAdmin ? "bg-muted/30" : ""}`}>
                        <td className="py-1.5 px-1.5 sticky left-0 bg-background z-10">
                          <div>
                            <span className="font-medium text-[11px] block">{p.full_name}</span>
                            <span className="text-[9px] text-muted-foreground font-mono">{p.employee_number}</span>
                            {userIsAdmin && <span className="block text-[9px] text-primary font-medium">Admin</span>}
                          </div>
                        </td>
                        {ALL_MODULES.map((m) => {
                          const parentMod = (m as any).parent;
                          if (parentMod && !isModuleEnabled(p.id, parentMod)) {
                            return <td key={m.id} className="text-center py-1 px-0.5"><span className="text-muted-foreground/30">—</span></td>;
                          }
                          return (
                            <td key={m.id} className="text-center py-1 px-0.5">
                              <Switch
                                checked={isModuleEnabled(p.id, m.id)}
                                onCheckedChange={() => toggleModule(p.id, m.id)}
                                disabled={userIsAdmin || saving === `${p.id}-${m.id}`}
                                className="scale-75"
                              />
                            </td>
                          );
                        })}
                        <td className="text-center py-1 px-0.5">
                          <div className="flex items-center justify-center gap-0.5">
                            <Button variant="outline" size="sm" className="h-6 px-1.5 text-[9px]" disabled={userIsAdmin || saving === `all-${p.id}`} onClick={() => enableAllModules(p.id)}>
                              {saving === `all-${p.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3 h-3" />}
                            </Button>
                            <Button variant="outline" size="sm" className="h-6 px-1.5 text-[9px] text-destructive hover:text-destructive" disabled={userIsAdmin || saving === `none-${p.id}`} onClick={() => disableAllModules(p.id)}>
                              {saving === `none-${p.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredProfiles.length === 0 && (
                    <tr>
                      <td colSpan={ALL_MODULES.length + 2} className="text-center text-muted-foreground py-8">
                        Nenhum usuário encontrado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </TooltipProvider>
  );
};

export default ModulePermissionsTab;
