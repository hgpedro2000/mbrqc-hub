import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Package, ShoppingCart, BarChart3, Plus, Loader2, Send, Check, X as XIcon, Clock, Trash2, Pencil, Search, RotateCcw, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useEnabledModules } from "@/hooks/useModulePermissions";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import logo from "@/assets/hyundai-mobis-logo.png";
import ReportErrorButton from "@/components/ReportErrorButton";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; color: string }> = {
  aguardando: { label: "Aguardando", color: "border-yellow-500 text-yellow-600 bg-yellow-500/10" },
  entregue: { label: "Entregue", color: "border-emerald-500 text-emerald-600 bg-emerald-500/10" },
  rejeitado: { label: "Rejeitado", color: "border-red-500 text-red-600 bg-red-500/10" },
};

/* ─── Requisitar Item sub-module ─── */
const RequisitarItem = () => {
  const { user, profile } = useAuth();
  const { impersonating } = useImpersonation();
  const activeProfile = impersonating || profile;
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState("");
  const [qty, setQty] = useState(1);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: ["consumable-items-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("consumable_items").select("*").eq("active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: myRequests = [], isLoading } = useQuery({
    queryKey: ["my-consumable-requests", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase.from("consumable_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const filteredRequests = useMemo(() => {
    if (!searchTerm.trim()) return myRequests;
    const term = searchTerm.toLowerCase();
    return myRequests.filter((r: any) =>
      r.item_name?.toLowerCase().includes(term) ||
      r.numero?.toLowerCase().includes(term)
    );
  }, [myRequests, searchTerm]);

  const handleSubmit = async () => {
    if (!selectedItem) { toast.error("Selecione um item"); return; }
    if (qty < 1) { toast.error("Quantidade mínima é 1"); return; }
    setSending(true);
    try {
      const itemObj = items.find((i: any) => i.id === selectedItem);
      const { error } = await supabase.from("consumable_requests").insert({
        user_id: user?.id,
        user_name: activeProfile?.full_name || "",
        turno: activeProfile?.turno || null,
        item_id: selectedItem,
        item_name: itemObj?.name || "",
        quantity: qty,
      } as any);
      if (error) throw error;
      toast.success("Pedido realizado com sucesso!");
      setAddOpen(false);
      setSelectedItem("");
      setQty(1);
      qc.invalidateQueries({ queryKey: ["my-consumable-requests"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-heading font-semibold">Requisitar Item</h2>
        <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1">
          <Plus className="w-4 h-4" /> Adicionar Item
        </Button>
      </div>

      <div className="form-section">
        <div className="grid grid-cols-2 gap-3 text-sm mb-3">
          <div><span className="text-muted-foreground text-xs">Usuário</span><p className="font-medium">{activeProfile?.full_name}</p></div>
          <div><span className="text-muted-foreground text-xs">Turno</span><p className="font-medium">{activeProfile?.turno || "—"}</p></div>
        </div>
      </div>

      <h3 className="text-sm font-semibold text-muted-foreground">Histórico de Pedidos</h3>
      
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar por item ou número..." className="pl-9 h-8 text-xs" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
        <div className="sm:hidden space-y-2">
          {filteredRequests.map((r: any) => {
            const cfg = statusConfig[r.status] || statusConfig.aguardando;
            return (
              <div key={r.id} className="border rounded-lg p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-muted-foreground">{r.numero || "—"}</span>
                  <Badge variant="outline" className={`${cfg.color} text-[10px]`}>{cfg.label}</Badge>
                </div>
                <p className="text-sm font-medium">{r.item_name}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>Qtd: <strong>{r.quantity}</strong></span>
                  <span>{new Date(r.created_at).toLocaleDateString("pt-BR")}</span>
                </div>
              </div>
            );
          })}
          {filteredRequests.length === 0 && (
            <p className="text-center text-muted-foreground py-6 text-sm">Nenhum pedido encontrado</p>
          )}
        </div>
        <div className="hidden sm:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Nº</TableHead>
                <TableHead className="text-xs">Item</TableHead>
                <TableHead className="text-xs text-center">Qtd</TableHead>
                <TableHead className="text-xs">Data</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.map((r: any) => {
                const cfg = statusConfig[r.status] || statusConfig.aguardando;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs font-mono text-muted-foreground">{r.numero || "—"}</TableCell>
                    <TableCell className="text-sm">{r.item_name}</TableCell>
                    <TableCell className="text-center text-sm">{r.quantity}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell><Badge variant="outline" className={cfg.color}>{cfg.label}</Badge></TableCell>
                  </TableRow>
                );
              })}
              {filteredRequests.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum pedido encontrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        </>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Requisitar Consumível</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Item *</Label>
              <Select value={selectedItem} onValueChange={setSelectedItem}>
                <SelectTrigger><SelectValue placeholder="Selecione o item..." /></SelectTrigger>
                <SelectContent>
                  {items.map((i: any) => (
                    <SelectItem key={i.id} value={i.id}>{i.name} ({i.unit})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantidade *</Label>
              <Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
            </div>
            <Button onClick={handleSubmit} disabled={sending} className="w-full">
              {sending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
              Enviar Pedido
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ─── Inventário e Requisições sub-module ─── */
const InventarioRequisicoes = () => {
  const { isAdmin } = useUserRole();
  const { enabledModules } = useEnabledModules();
  const hasInventarioPermission = isAdmin || enabledModules.includes("consumiveis_inventario" as any);
  const qc = useQueryClient();
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [stockListOpen, setStockListOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("un");
  const [newStock, setNewStock] = useState(0);
  const [newMinQty, setNewMinQty] = useState(0);
  const [saving, setSaving] = useState(false);
  const [turnoFilter, setTurnoFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState("un");
  const [editStock, setEditStock] = useState(0);
  const [editMinQty, setEditMinQty] = useState(0);
  const [editSaving, setEditSaving] = useState(false);
  const [insufficientDialog, setInsufficientDialog] = useState<{ itemName: string; stock: number; requested: number } | null>(null);

  const { data: items = [], isLoading: loadingItems } = useQuery({
    queryKey: ["consumable-items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("consumable_items").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: allRequests = [], isLoading: loadingReqs } = useQuery({
    queryKey: ["all-consumable-requests"],
    queryFn: async () => {
      const { data, error } = await supabase.from("consumable_requests").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const lowStockItems = useMemo(() => items.filter((i: any) => i.active && i.stock_qty <= i.min_qty && i.min_qty > 0), [items]);

  const filteredRequests = useMemo(() => {
    let result = allRequests;
    if (turnoFilter) result = result.filter((r: any) => r.turno === turnoFilter);
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter((r: any) =>
        r.item_name?.toLowerCase().includes(term) ||
        r.user_name?.toLowerCase().includes(term) ||
        r.numero?.toLowerCase().includes(term)
      );
    }
    return result;
  }, [allRequests, turnoFilter, searchTerm]);

  const handleAddItem = async () => {
    if (!newName.trim()) { toast.error("Nome obrigatório"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("consumable_items").insert({
        name: newName.trim(), unit: newUnit, stock_qty: newStock, min_qty: newMinQty,
      } as any);
      if (error) throw error;
      toast.success("Item registrado");
      setAddItemOpen(false); setNewName(""); setNewUnit("un"); setNewStock(0); setNewMinQty(0);
      qc.invalidateQueries({ queryKey: ["consumable-items"] });
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const updateRequestStatus = async (id: string, status: string) => {
    try {
      const request = allRequests.find((r: any) => r.id === id);
      if (!request) return;

      if (status === "entregue") {
        const item = items.find((i: any) => i.id === request.item_id);
        if (item && item.stock_qty < request.quantity) {
          setInsufficientDialog({
            itemName: item.name,
            stock: item.stock_qty,
            requested: request.quantity,
          });
          return;
        }
        if (item) {
          const newQty = item.stock_qty - request.quantity;
          const { error: stockErr } = await supabase.from("consumable_items").update({ stock_qty: newQty } as any).eq("id", item.id);
          if (stockErr) throw stockErr;
        }
      }

      const { error } = await supabase.from("consumable_requests").update({ status } as any).eq("id", id);
      if (error) throw error;
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["all-consumable-requests"] });
      qc.invalidateQueries({ queryKey: ["my-consumable-requests"] });
      qc.invalidateQueries({ queryKey: ["consumable-items"] });
      qc.invalidateQueries({ queryKey: ["consumable-items-active"] });
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDeleteItem = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from("consumable_items").delete().eq("id", deleteTarget);
      if (error) throw error;
      toast.success("Item excluído");
      qc.invalidateQueries({ queryKey: ["consumable-items"] });
      setDeleteTarget(null);
    } catch (e: any) { toast.error(e.message); }
  };

  const openEditItem = (item: any) => {
    setEditItem(item); setEditName(item.name); setEditUnit(item.unit); setEditStock(item.stock_qty); setEditMinQty(item.min_qty);
  };

  const handleEditItem = async () => {
    if (!editItem || !editName.trim()) { toast.error("Nome obrigatório"); return; }
    setEditSaving(true);
    try {
      const { error } = await supabase.from("consumable_items").update({
        name: editName.trim(), unit: editUnit, stock_qty: editStock, min_qty: editMinQty,
      } as any).eq("id", editItem.id);
      if (error) throw error;
      toast.success("Item atualizado"); setEditItem(null);
      qc.invalidateQueries({ queryKey: ["consumable-items"] });
      qc.invalidateQueries({ queryKey: ["consumable-items-active"] });
    } catch (e: any) { toast.error(e.message); } finally { setEditSaving(false); }
  };

  const totalRequests = allRequests.length;
  const pendingRequests = allRequests.filter((r: any) => r.status === "aguardando").length;
  const deliveredRequests = allRequests.filter((r: any) => r.status === "entregue").length;

  // Can approve: admin or user with inventario permission
  const canApprove = hasInventarioPermission;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="form-section p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{items.filter((i: any) => i.active).length}</p>
          <p className="text-xs text-muted-foreground">Itens Cadastrados</p>
        </div>
        <div className="form-section p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{totalRequests}</p>
          <p className="text-xs text-muted-foreground">Total Requisições</p>
        </div>
        <div className="form-section p-3 text-center">
          <p className="text-2xl font-bold text-yellow-600">{pendingRequests}</p>
          <p className="text-xs text-muted-foreground">Aguardando</p>
        </div>
        <div className="form-section p-3 text-center">
          <p className="text-2xl font-bold text-emerald-600">{deliveredRequests}</p>
          <p className="text-xs text-muted-foreground">Entregues</p>
        </div>
      </div>

      {lowStockItems.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
          <p className="text-sm font-semibold text-destructive mb-1">⚠ Estoque Baixo</p>
          <div className="flex flex-wrap gap-2">
            {lowStockItems.map((i: any) => (
              <Badge key={i.id} variant="outline" className="border-destructive/50 text-destructive">
                {i.name}: {i.stock_qty} {i.unit} (mín: {i.min_qty})
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-base font-heading font-semibold">Estoque de Consumíveis</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setStockListOpen(true)} className="gap-1">
            <Package className="w-4 h-4" /> Ver Estoque ({items.filter((i: any) => i.active).length})
          </Button>
          {isAdmin && (
            <Button size="sm" onClick={() => setAddItemOpen(true)} className="gap-1">
              <Plus className="w-4 h-4" /> Registrar Consumível
            </Button>
          )}
        </div>
      </div>

      {/* Stock list dialog */}
      <Dialog open={stockListOpen} onOpenChange={setStockListOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Estoque de Consumíveis</DialogTitle></DialogHeader>
          {loadingItems ? (
            <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : (
            <>
              <div className="sm:hidden space-y-2">
                {items.map((i: any) => (
                  <div key={i.id} className={`border rounded-lg p-3 space-y-1 ${i.stock_qty <= i.min_qty && i.min_qty > 0 ? "bg-destructive/5 border-destructive/20" : ""}`}>
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{i.name}</p>
                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditItem(i)}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(i.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Unid: <strong>{i.unit}</strong></span>
                      <span className={i.stock_qty <= i.min_qty && i.min_qty > 0 ? "text-destructive font-semibold" : ""}>Estoque: <strong>{i.stock_qty}</strong></span>
                      <span>Mín: <strong>{i.min_qty}</strong></span>
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="text-center text-muted-foreground py-6 text-sm">Nenhum item cadastrado</p>
                )}
              </div>
              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-center">Unidade</TableHead>
                      <TableHead className="text-center">Estoque</TableHead>
                      <TableHead className="text-center">Mín.</TableHead>
                      {isAdmin && <TableHead className="text-right">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((i: any) => (
                      <TableRow key={i.id} className={i.stock_qty <= i.min_qty && i.min_qty > 0 ? "bg-destructive/5" : ""}>
                        <TableCell className="font-medium text-sm">{i.name}</TableCell>
                        <TableCell className="text-center text-sm">{i.unit}</TableCell>
                        <TableCell className={`text-center font-semibold ${i.stock_qty <= i.min_qty && i.min_qty > 0 ? "text-destructive" : ""}`}>{i.stock_qty}</TableCell>
                        <TableCell className="text-center text-muted-foreground">{i.min_qty}</TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditItem(i)} title="Editar"><Pencil className="w-3.5 h-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(i.id)} title="Excluir"><Trash2 className="w-3.5 h-3.5" /></Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    {items.length === 0 && (
                      <TableRow><TableCell colSpan={isAdmin ? 5 : 4} className="text-center text-muted-foreground py-6">Nenhum item cadastrado</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Requests table */}
      <div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 gap-2">
          <h3 className="text-base font-heading font-semibold">Requisições</h3>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar..." className="pl-9 h-8 text-xs w-full sm:w-48" />
            </div>
            <Select value={turnoFilter || "all"} onValueChange={(v) => setTurnoFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-full sm:w-40 h-8 text-xs"><SelectValue placeholder="Turno" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os turnos</SelectItem>
                <SelectItem value="1º Turno">1º Turno</SelectItem>
                <SelectItem value="2º Turno">2º Turno</SelectItem>
                <SelectItem value="3º Turno">3º Turno</SelectItem>
                <SelectItem value="ADM">ADM</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {loadingReqs ? (
          <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <>
          <div className="sm:hidden space-y-2">
            {filteredRequests.map((r: any) => {
              const cfg = statusConfig[r.status] || statusConfig.aguardando;
              return (
                <div key={r.id} className="border rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-muted-foreground">{r.numero || "—"}</span>
                    <Badge variant="outline" className={`${cfg.color} text-[10px]`}>{cfg.label}</Badge>
                  </div>
                  <p className="text-sm font-medium">{r.item_name}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{r.user_name}</span>
                    <span>Qtd: <strong>{r.quantity}</strong></span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{r.turno || ""}</span>
                    <span>{new Date(r.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                  {r.status === "aguardando" && canApprove && (
                    <div className="flex items-center gap-1 justify-end pt-1">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-emerald-600 text-xs" onClick={() => updateRequestStatus(r.id, "entregue")}>
                        <Check className="w-3.5 h-3.5 mr-1" /> Entregar
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive text-xs" onClick={() => updateRequestStatus(r.id, "rejeitado")}>
                        <XIcon className="w-3.5 h-3.5 mr-1" /> Rejeitar
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
            {filteredRequests.length === 0 && (
              <p className="text-center text-muted-foreground py-6 text-sm">Nenhuma requisição</p>
            )}
          </div>
          <div className="hidden sm:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Nº</TableHead>
                  <TableHead className="text-xs">Usuário</TableHead>
                  <TableHead className="text-xs hidden md:table-cell">Turno</TableHead>
                  <TableHead className="text-xs">Item</TableHead>
                  <TableHead className="text-xs text-center">Qtd</TableHead>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  {canApprove && <TableHead className="text-xs text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((r: any) => {
                  const cfg = statusConfig[r.status] || statusConfig.aguardando;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs font-mono text-muted-foreground">{r.numero || "—"}</TableCell>
                      <TableCell className="text-xs">{r.user_name}</TableCell>
                      <TableCell className="text-xs hidden md:table-cell">{r.turno || "—"}</TableCell>
                      <TableCell className="text-sm">{r.item_name}</TableCell>
                      <TableCell className="text-center">{r.quantity}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell><Badge variant="outline" className={cfg.color}>{cfg.label}</Badge></TableCell>
                      {canApprove && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {r.status === "aguardando" && (
                              <>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" onClick={() => updateRequestStatus(r.id, "entregue")} title="Entregar">
                                  <Check className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => updateRequestStatus(r.id, "rejeitado")} title="Rejeitar">
                                  <XIcon className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
                {filteredRequests.length === 0 && (
                  <TableRow><TableCell colSpan={canApprove ? 8 : 7} className="text-center text-muted-foreground py-6">Nenhuma requisição</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          </>
        )}
      </div>
      {/* Insufficient stock dialog */}
      <AlertDialog open={!!insufficientDialog} onOpenChange={() => setInsufficientDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-destructive" /> Estoque Insuficiente
            </AlertDialogTitle>
            <AlertDialogDescription>
              O item <strong>{insufficientDialog?.itemName}</strong> possui apenas <strong>{insufficientDialog?.stock}</strong> unidade(s) em estoque, mas a requisição solicita <strong>{insufficientDialog?.requested}</strong> unidade(s).
              <br /><br />
              Não é possível aprovar este pedido. Atualize o estoque antes de prosseguir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setInsufficientDialog(null)}>Entendido</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add item dialog */}
      <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Registrar Consumível</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Item *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Luvas de nitrilo" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>Unidade</Label>
                <Select value={newUnit} onValueChange={setNewUnit}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="un">un</SelectItem><SelectItem value="par">par</SelectItem><SelectItem value="cx">cx</SelectItem><SelectItem value="pct">pct</SelectItem><SelectItem value="kg">kg</SelectItem><SelectItem value="L">L</SelectItem><SelectItem value="m">m</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Estoque</Label><Input type="number" min={0} value={newStock} onChange={(e) => setNewStock(Number(e.target.value))} /></div>
              <div className="space-y-2"><Label>Qtd Mín.</Label><Input type="number" min={0} value={newMinQty} onChange={(e) => setNewMinQty(Number(e.target.value))} /></div>
            </div>
            <Button onClick={handleAddItem} disabled={saving} className="w-full">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Package className="w-4 h-4 mr-1" />}
              Registrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit item dialog */}
      <Dialog open={!!editItem} onOpenChange={(open) => { if (!open) setEditItem(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Editar Consumível</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nome do Item *</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>Unidade</Label>
                <Select value={editUnit} onValueChange={setEditUnit}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="un">un</SelectItem><SelectItem value="par">par</SelectItem><SelectItem value="cx">cx</SelectItem><SelectItem value="pct">pct</SelectItem><SelectItem value="kg">kg</SelectItem><SelectItem value="L">L</SelectItem><SelectItem value="m">m</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Estoque</Label><Input type="number" min={0} value={editStock} onChange={(e) => setEditStock(Number(e.target.value))} /></div>
              <div className="space-y-2"><Label>Qtd Mín.</Label><Input type="number" min={0} value={editMinQty} onChange={(e) => setEditMinQty(Number(e.target.value))} /></div>
            </div>
            <Button onClick={handleEditItem} disabled={editSaving} className="w-full">
              {editSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Pencil className="w-4 h-4 mr-1" />}
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete item confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir item</AlertDialogTitle><AlertDialogDescription>Tem certeza? Isso também excluirá todas as requisições associadas.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={handleDeleteItem}>Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

/* ─── Main Consumíveis Page ─── */
const ConsumiveisPage = () => {
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const { impersonating } = useImpersonation();
  const { enabledModules } = useEnabledModules(impersonating?.id);
  
  const hasParent = enabledModules.includes("consumiveis" as any);
  const hasRequisitar = enabledModules.includes("consumiveis_requisitar" as any);
  const hasInventario = enabledModules.includes("consumiveis_inventario" as any);
  const showRequisitar = impersonating 
    ? (hasRequisitar || (hasParent && !hasRequisitar && !hasInventario))
    : (isAdmin || hasRequisitar || (hasParent && !hasRequisitar && !hasInventario));
  const showInventario = impersonating ? hasInventario : (isAdmin || hasInventario);
  const defaultTab = showRequisitar ? "requisitar" : showInventario ? "inventario" : "requisitar";

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-4 py-6 md:py-12">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-accent flex items-center justify-center">
                <Package className="w-4 h-4 md:w-5 md:h-5 text-accent-foreground" />
              </div>
              <span className="text-xs md:text-sm font-medium tracking-wider uppercase opacity-80">Consumíveis</span>
            </div>
            <div className="flex items-center gap-1 md:gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 px-2 md:px-3">
                <ArrowLeft className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">Hub</span>
              </Button>
              <ReportErrorButton moduleName="Consumíveis" />
            </div>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-4xl font-heading font-bold mt-3 md:mt-4">Consumíveis</h1>
          <p className="mt-1 md:mt-2 text-primary-foreground/70 max-w-xl text-xs sm:text-sm md:text-lg">Requisição e gestão de itens de consumo do setor da qualidade.</p>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-5xl -mt-4">
        <Tabs defaultValue={defaultTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 h-auto">
            {showRequisitar && (
              <TabsTrigger value="requisitar" className="gap-1.5 text-xs sm:text-sm py-2">
                <ShoppingCart className="w-4 h-4" /> Requisitar Item
              </TabsTrigger>
            )}
            {showInventario && (
              <TabsTrigger value="inventario" className="gap-1.5 text-xs sm:text-sm py-2">
                <BarChart3 className="w-4 h-4" /> Inventário e Requisições
              </TabsTrigger>
            )}
          </TabsList>

          {showRequisitar && (
            <TabsContent value="requisitar" className="form-section">
              <RequisitarItem />
            </TabsContent>
          )}
          {showInventario && (
            <TabsContent value="inventario" className="form-section">
              <InventarioRequisicoes />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
};

export default ConsumiveisPage;
