import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, Users, Eye, UserCog } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const HUB_BADGE_MODULE = "consumiveis_inventario";

const ConsumiveisAccessDialog = ({ open, onOpenChange }: Props) => {
  const qc = useQueryClient();
  const [itemSearch, setItemSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");

  const { data: items = [], isLoading: loadingItems } = useQuery({
    queryKey: ["consumable-items-with-responsible"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consumable_items")
        .select("id, name, unit, responsible_user_id, active")
        .order("name");
      if (error) throw error;
      return data as any[];
    },
    enabled: open,
  });

  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ["profiles-active-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, employee_number, turno, empresa")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return (data || []).filter((p: any) => p.full_name !== "TESTER");
    },
    enabled: open,
  });

  const { data: badgePerms = [], isLoading: loadingPerms } = useQuery({
    queryKey: ["consumiveis-badge-perms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_module_permissions")
        .select("user_id, enabled")
        .eq("module", HUB_BADGE_MODULE);
      if (error) throw error;
      return (data || []) as { user_id: string; enabled: boolean }[];
    },
    enabled: open,
  });

  const badgeMap = useMemo(() => {
    const m = new Map<string, boolean>();
    badgePerms.forEach((p) => m.set(p.user_id, p.enabled));
    return m;
  }, [badgePerms]);

  const filteredItems = useMemo(() => {
    const t = itemSearch.trim().toLowerCase();
    if (!t) return items;
    return items.filter((i) => i.name.toLowerCase().includes(t));
  }, [items, itemSearch]);

  const filteredProfiles = useMemo(() => {
    const t = userSearch.trim().toLowerCase();
    if (!t) return profiles;
    return profiles.filter(
      (p: any) =>
        p.full_name?.toLowerCase().includes(t) ||
        p.employee_number?.toLowerCase().includes(t),
    );
  }, [profiles, userSearch]);

  const setResponsible = async (itemId: string, userId: string | null) => {
    const { error } = await supabase
      .from("consumable_items")
      .update({ responsible_user_id: userId } as any)
      .eq("id", itemId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Responsável atualizado");
    qc.invalidateQueries({ queryKey: ["consumable-items-with-responsible"] });
    qc.invalidateQueries({ queryKey: ["consumable-items"] });
    qc.invalidateQueries({ queryKey: ["consumable-items-active"] });
  };

  const toggleBadgePerm = async (userId: string, enabled: boolean) => {
    const { error } = await supabase
      .from("user_module_permissions")
      .upsert(
        { user_id: userId, module: HUB_BADGE_MODULE, enabled } as any,
        { onConflict: "user_id,module" },
      );
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(enabled ? "Acesso ao badge concedido" : "Acesso ao badge removido");
    qc.invalidateQueries({ queryKey: ["consumiveis-badge-perms"] });
    qc.invalidateQueries({ queryKey: ["is-consumivel-manager"] });
    qc.invalidateQueries({ queryKey: ["badge-consumiveis"] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="w-5 h-5" /> Gerenciar Acessos de Consumíveis
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="responsaveis" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="responsaveis" className="gap-1.5 text-xs sm:text-sm">
              <Users className="w-4 h-4" /> Responsável por Item
            </TabsTrigger>
            <TabsTrigger value="badges" className="gap-1.5 text-xs sm:text-sm">
              <Eye className="w-4 h-4" /> Badge no Hub
            </TabsTrigger>
          </TabsList>

          {/* Responsáveis por item */}
          <TabsContent value="responsaveis" className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Defina o usuário responsável por cada consumível. Ele será o destinatário
              prioritário em notificações relacionadas ao item.
            </p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Buscar item..."
                className="pl-9 h-9"
              />
            </div>
            {loadingItems || loadingProfiles ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {filteredItems.map((i) => (
                  <div
                    key={i.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border rounded-lg p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{i.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Unidade: {i.unit} {!i.active && "• Inativo"}
                      </p>
                    </div>
                    <div className="w-full sm:w-64">
                      <Select
                        value={i.responsible_user_id || "none"}
                        onValueChange={(v) => setResponsible(i.id, v === "none" ? null : v)}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder="Sem responsável" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Sem responsável —</SelectItem>
                          {profiles.map((p: any) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.full_name} {p.turno ? `(${p.turno})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
                {filteredItems.length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-6">
                    Nenhum item encontrado
                  </p>
                )}
              </div>
            )}
          </TabsContent>

          {/* Quem vê o badge no Hub */}
          <TabsContent value="badges" className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Selecione quais usuários devem ver, no card de Consumíveis do Hub,
              o badge com a quantidade de itens pendentes e estoque baixo.
              Administradores e líderes sempre veem.
            </p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Buscar usuário..."
                className="pl-9 h-9"
              />
            </div>
            {loadingProfiles || loadingPerms ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : (
              <div className="space-y-1 max-h-[50vh] overflow-y-auto pr-1">
                {filteredProfiles.map((p: any) => {
                  const enabled = !!badgeMap.get(p.id);
                  return (
                    <Label
                      key={p.id}
                      htmlFor={`badge-${p.id}`}
                      className="flex items-center justify-between gap-3 border rounded-lg p-2.5 cursor-pointer hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.full_name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {p.employee_number || "—"} {p.turno ? `• ${p.turno}` : ""}
                        </p>
                      </div>
                      <Switch
                        id={`badge-${p.id}`}
                        checked={enabled}
                        onCheckedChange={(v) => toggleBadgePerm(p.id, v)}
                      />
                    </Label>
                  );
                })}
                {filteredProfiles.length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-6">
                    Nenhum usuário encontrado
                  </p>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ConsumiveisAccessDialog;
