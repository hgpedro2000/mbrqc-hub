import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Loader2, Search, CheckCheck, XCircle, Shield, ChevronRight, ChevronLeft, User as UserIcon, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { ALL_MODULES } from "@/hooks/useModulePermissions";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

const stripPrefix = (label: string) => label.replace(/^\s*↳\s*/, "").replace(/^Sub-Hub:\s*/, "");

const normalize = (s: string) =>
  (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const ModulePermissionsTab = () => {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [empresaFilter, setEmpresaFilter] = useState<string>("all");
  const [turnoFilter, setTurnoFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all"); // all | admin | user
  const [accessFilter, setAccessFilter] = useState<string>("all"); // all | none | some | full
  const [page, setPage] = useState(1);

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
      if (moduleId === "apontamentos" && newEnabled) {
        const existingIncoming = permissions.find((p: any) => p.user_id === userId && p.module === "apontamentos_incoming");
        if (!existingIncoming) {
          await supabase.from("user_module_permissions").insert({ user_id: userId, module: "apontamentos_incoming", enabled: true });
        } else if (!existingIncoming.enabled) {
          await supabase.from("user_module_permissions").update({ enabled: true }).eq("id", existingIncoming.id);
        }
      }
      const moduleDef = ALL_MODULES.find((m) => m.id === moduleId) as any;
      const parentSubHub = moduleDef?.subHub;
      if (parentSubHub && newEnabled) {
        const existingSub = permissions.find((p: any) => p.user_id === userId && p.module === parentSubHub);
        if (!existingSub) {
          await supabase.from("user_module_permissions").insert({ user_id: userId, module: parentSubHub, enabled: true });
        } else if (!existingSub.enabled) {
          await supabase.from("user_module_permissions").update({ enabled: true }).eq("id", existingSub.id);
        }
      }
      qc.invalidateQueries({ queryKey: ["all-module-permissions"] });
    } catch {
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
          if (!existing.enabled) await supabase.from("user_module_permissions").update({ enabled: true }).eq("id", existing.id);
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

  const empresaOptions = useMemo(() => {
    const set = new Set<string>();
    profiles.forEach((p: any) => p.empresa && set.add(p.empresa));
    return Array.from(set).sort();
  }, [profiles]);

  const turnoOptions = useMemo(() => {
    const set = new Set<string>();
    profiles.forEach((p: any) => p.turno && set.add(p.turno));
    return Array.from(set).sort();
  }, [profiles]);

  const enabledCountFor = (userId: string) =>
    isAdmin(userId)
      ? ALL_MODULES.length
      : permissions.filter((p: any) => p.user_id === userId && p.enabled).length;

  const filteredProfiles = useMemo(() => {
    const q = normalize(search);
    return profiles.filter((p: any) => {
      if (q && !normalize(p.full_name).includes(q) && !(p.employee_number || "").toLowerCase().includes(q)) return false;
      if (empresaFilter !== "all" && p.empresa !== empresaFilter) return false;
      if (turnoFilter !== "all" && p.turno !== turnoFilter) return false;
      if (roleFilter === "admin" && !isAdmin(p.id)) return false;
      if (roleFilter === "user" && isAdmin(p.id)) return false;
      if (accessFilter !== "all") {
        const c = enabledCountFor(p.id);
        if (accessFilter === "none" && c !== 0) return false;
        if (accessFilter === "full" && c < ALL_MODULES.length) return false;
        if (accessFilter === "some" && (c === 0 || c >= ALL_MODULES.length)) return false;
      }
      return true;
    });
  }, [profiles, search, empresaFilter, turnoFilter, roleFilter, accessFilter, roles, permissions]);

  const totalPages = Math.max(1, Math.ceil(filteredProfiles.length / PAGE_SIZE));
  useEffect(() => { setPage(1); }, [search, empresaFilter, turnoFilter, roleFilter, accessFilter]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);
  const pagedProfiles = useMemo(
    () => filteredProfiles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredProfiles, page]
  );

  const activeFilterCount =
    (empresaFilter !== "all" ? 1 : 0) +
    (turnoFilter !== "all" ? 1 : 0) +
    (roleFilter !== "all" ? 1 : 0) +
    (accessFilter !== "all" ? 1 : 0);

  const clearAdvancedFilters = () => {
    setEmpresaFilter("all"); setTurnoFilter("all"); setRoleFilter("all"); setAccessFilter("all");
  };


  const selectedUser = useMemo(
    () => profiles.find((p: any) => p.id === selectedId) || null,
    [profiles, selectedId]
  );

  // Group modules by sub-hub for the detail view
  const grouped = useMemo(() => {
    const subHubs = ALL_MODULES.filter((m) => (m as any).isSubHub);
    return subHubs.map((sh) => ({
      hub: sh,
      children: ALL_MODULES.filter((m) => (m as any).subHub === sh.id && !(m as any).parent),
    }));
  }, []);

  const childrenOf = (parentId: string) =>
    ALL_MODULES.filter((m) => (m as any).parent === parentId);

  const enabledCount = (userId: string) =>
    isAdmin(userId)
      ? ALL_MODULES.length
      : permissions.filter((p: any) => p.user_id === userId && p.enabled).length;

  const isLoading = loadingProfiles || loadingPerms;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-heading font-semibold">Permissões de Módulos</h2>
        <p className="text-sm text-muted-foreground mt-1">{t("engenharia.modulePermissionsDesc")}</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
          {/* Users list */}
          <div className="border border-border rounded-lg bg-card overflow-hidden flex flex-col max-h-[70vh]">
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("engenharia.searchUser")}
                  className="pl-9 h-9"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                {filteredProfiles.length} usuário{filteredProfiles.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="overflow-y-auto flex-1 divide-y divide-border/50">
              {filteredProfiles.map((p: any) => {
                const active = p.id === selectedId;
                const admin = isAdmin(p.id);
                const count = enabledCount(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 flex items-center gap-2 transition-colors hover:bg-muted/50",
                      active && "bg-primary/10 hover:bg-primary/10"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                      admin ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      {admin ? <Shield className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.full_name}</p>
                      <p className="text-[11px] text-muted-foreground font-mono truncate">
                        {p.employee_number}
                        {admin ? " • Admin" : ` • ${count} módulo${count !== 1 ? "s" : ""}`}
                      </p>
                    </div>
                    <ChevronRight className={cn("w-4 h-4 text-muted-foreground/50 transition-transform", active && "text-primary rotate-90")} />
                  </button>
                );
              })}
              {filteredProfiles.length === 0 && (
                <p className="text-center text-muted-foreground py-8 text-sm">Nenhum usuário encontrado</p>
              )}
            </div>
          </div>

          {/* Detail panel */}
          <div className="border border-border rounded-lg bg-card p-4 lg:p-6 min-h-[400px]">
            {!selectedUser ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-16">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <UserIcon className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-heading font-semibold text-base">Selecione um usuário</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                  Escolha um usuário à esquerda para configurar suas permissões de acesso aos módulos.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-heading font-semibold text-base">{selectedUser.full_name}</h3>
                      {isAdmin(selectedUser.id) && (
                        <Badge variant="secondary" className="gap-1">
                          <Shield className="w-3 h-3" /> Admin
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      {selectedUser.employee_number}
                      {selectedUser.cargo ? ` • ${selectedUser.cargo}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isAdmin(selectedUser.id) || saving === `all-${selectedUser.id}`}
                      onClick={() => enableAllModules(selectedUser.id)}
                      className="gap-1.5"
                    >
                      {saving === `all-${selectedUser.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
                      Ativar todos
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isAdmin(selectedUser.id) || saving === `none-${selectedUser.id}`}
                      onClick={() => disableAllModules(selectedUser.id)}
                      className="gap-1.5 text-destructive hover:text-destructive"
                    >
                      {saving === `none-${selectedUser.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                      Limpar
                    </Button>
                  </div>
                </div>

                {isAdmin(selectedUser.id) && (
                  <div className="rounded-md bg-primary/10 border border-primary/20 px-3 py-2 text-xs text-primary">
                    Este usuário é administrador e tem acesso automático a todos os módulos.
                  </div>
                )}

                <div className="space-y-3">
                  {grouped.map(({ hub, children }) => {
                    const hubOn = isModuleEnabled(selectedUser.id, hub.id);
                    const active = children.filter((c) => isModuleEnabled(selectedUser.id, c.id)).length;
                    return (
                      <div
                        key={hub.id}
                        className={cn(
                          "border rounded-lg overflow-hidden transition-colors",
                          hubOn ? "border-primary/30 bg-primary/[0.03]" : "border-border bg-background"
                        )}
                      >
                        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/50">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-2 h-2 rounded-full",
                              hubOn ? "bg-primary" : "bg-muted-foreground/30"
                            )} />
                            <span className="font-semibold text-sm">{stripPrefix(hub.label)}</span>
                            {hubOn && children.length > 0 && (
                              <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                                {active}/{children.length}
                              </Badge>
                            )}
                          </div>
                          <Switch
                            checked={hubOn}
                            onCheckedChange={() => toggleModule(selectedUser.id, hub.id)}
                            disabled={isAdmin(selectedUser.id) || saving === `${selectedUser.id}-${hub.id}`}
                          />
                        </div>

                        {hubOn && children.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 divide-y sm:divide-y-0 divide-border/50">
                            {children.map((m) => {
                              const on = isModuleEnabled(selectedUser.id, m.id);
                              const subs = childrenOf(m.id);
                              return (
                                <div key={m.id} className="px-3 py-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm">{stripPrefix(m.label)}</span>
                                    <Switch
                                      checked={on}
                                      onCheckedChange={() => toggleModule(selectedUser.id, m.id)}
                                      disabled={isAdmin(selectedUser.id) || saving === `${selectedUser.id}-${m.id}`}
                                    />
                                  </div>
                                  {on && subs.length > 0 && (
                                    <div className="mt-1.5 pl-3 border-l-2 border-border space-y-1">
                                      {subs.map((sm) => (
                                        <div key={sm.id} className="flex items-center justify-between">
                                          <span className="text-xs text-muted-foreground">{stripPrefix(sm.label)}</span>
                                          <Switch
                                            checked={isModuleEnabled(selectedUser.id, sm.id)}
                                            onCheckedChange={() => toggleModule(selectedUser.id, sm.id)}
                                            disabled={isAdmin(selectedUser.id) || saving === `${selectedUser.id}-${sm.id}`}
                                            className="scale-75"
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModulePermissionsTab;
