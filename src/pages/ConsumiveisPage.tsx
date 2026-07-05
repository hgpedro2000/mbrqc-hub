import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Package, ShoppingCart, BarChart3, Plus, Loader2, Send, Check, X as XIcon, Clock, Trash2, Pencil, Search, RotateCcw, History, UserCog, ListChecks, Users, LineChart, ClipboardList, QrCode, ScanLine } from "lucide-react";
import QrScannerModal from "@/components/QrScannerModal";
import { QRCodeSVG } from "qrcode.react";
import ConsumiveisAccessDialog from "@/components/consumiveis/ConsumiveisAccessDialog";
import { MeuHistorico, PedidoTime, ListasSalvas, ConsumoTime, HistoricoIndividual, getConsumivelRole } from "@/components/consumiveis/ConsumiveisExtras";
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
  entregue_pendente_confirmacao: { label: "Aguardando confirmação", color: "border-blue-500 text-blue-600 bg-blue-500/10" },
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
  const [editReq, setEditReq] = useState<any>(null);
  const [editQty, setEditQty] = useState(1);
  const [editItemId, setEditItemId] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [cancelReqId, setCancelReqId] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [appConfirmOpen, setAppConfirmOpen] = useState(false);

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const confirmReceipt = async (reqId: string) => {
    if (!reqId) return;
    setConfirming(true);
    try {
      const { error } = await supabase
        .from("consumable_requests")
        .update({ status: "entregue", confirmado_em: new Date().toISOString() } as any)
        .eq("id", reqId)
        .eq("user_id", user?.id || "")
        .eq("status", "entregue_pendente_confirmacao");
      if (error) throw error;
      toast.success("Recebimento confirmado");
      qc.invalidateQueries({ queryKey: ["my-consumable-requests"] });
      qc.invalidateQueries({ queryKey: ["all-consumable-requests"] });
    } catch (e: any) { toast.error(e.message); } finally { setConfirming(false); }
  };

  const confirmPedido = async (pedidoId: string) => {
    if (!pedidoId || !UUID_RE.test(pedidoId)) { toast.error("Identificador inválido"); return; }
    setConfirming(true);
    try {
      const { data, error } = await supabase
        .from("consumable_requests")
        .update({ status: "entregue", confirmado_em: new Date().toISOString() } as any)
        .eq("user_id", user?.id || "")
        .eq("status", "entregue_pendente_confirmacao")
        .or(`pedido_id.eq.${pedidoId},id.eq.${pedidoId}`)
        .select("id");
      if (error) throw error;
      if (!data?.length) { toast.error("Nenhum pedido pendente correspondente"); return; }
      toast.success(`Recebimento confirmado (${data.length} item${data.length > 1 ? "s" : ""})`);
      qc.invalidateQueries({ queryKey: ["my-consumable-requests"] });
      qc.invalidateQueries({ queryKey: ["all-consumable-requests"] });
    } catch (e: any) { toast.error(e.message); } finally { setConfirming(false); }
  };

  const handleScan = async (value: string) => {
    setScanOpen(false);
    if (!value) { toast.error("QR vazio"); return; }
    // STRICT validation: require JSON payload with the expected type
    let parsed: any;
    try { parsed = JSON.parse(value); } catch { toast.error("QR inválido — formato não reconhecido"); return; }
    if (!parsed || parsed.type !== "consumivel_confirm" || !parsed.pedido_id) {
      toast.error("QR inválido — não é um QR de confirmação de consumível"); return;
    }
    const pedidoId = String(parsed.pedido_id).trim();
    if (!UUID_RE.test(pedidoId)) { toast.error("QR inválido — identificador malformado"); return; }
    // Ensure the QR corresponds to one of MY pending orders before updating
    const target = (myRequests as any[]).find(
      (r: any) => (r.pedido_id === pedidoId || r.id === pedidoId) && r.status === "entregue_pendente_confirmacao"
    );
    if (!target) { toast.error("QR não corresponde a nenhum pedido pendente seu"); return; }
    await confirmPedido(pedidoId);
  };

  const openEditReq = (r: any) => {
    setEditReq(r); setEditItemId(r.item_id || ""); setEditQty(r.quantity || 1);
  };
  const handleEditReq = async () => {
    if (!editReq) return;
    if (editQty < 1) { toast.error("Quantidade mínima é 1"); return; }
    setEditSaving(true);
    try {
      const itemObj = items.find((i: any) => i.id === editItemId);
      const { error } = await supabase.from("consumable_requests")
        .update({ item_id: editItemId, item_name: itemObj?.name || editReq.item_name, quantity: editQty } as any)
        .eq("id", editReq.id).eq("status", "aguardando");
      if (error) throw error;
      toast.success("Pedido atualizado");
      setEditReq(null);
      qc.invalidateQueries({ queryKey: ["my-consumable-requests"] });
      qc.invalidateQueries({ queryKey: ["all-consumable-requests"] });
    } catch (e: any) { toast.error(e.message); } finally { setEditSaving(false); }
  };
  const handleCancelReq = async () => {
    if (!cancelReqId) return;
    try {
      const { error } = await supabase.from("consumable_requests").delete().eq("id", cancelReqId).eq("status", "aguardando");
      if (error) throw error;
      toast.success("Pedido cancelado");
      setCancelReqId(null);
      qc.invalidateQueries({ queryKey: ["my-consumable-requests"] });
      qc.invalidateQueries({ queryKey: ["all-consumable-requests"] });
    } catch (e: any) { toast.error(e.message); }
  };

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h2 className="text-base sm:text-lg font-heading font-semibold">Requisitar Item</h2>
        <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1 w-full sm:w-auto min-h-[40px]">
          <Plus className="w-4 h-4" /> Adicionar Item
        </Button>
      </div>

      <div className="form-section">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm mb-3">
          <div><span className="text-muted-foreground text-xs">Usuário</span><p className="font-medium">{activeProfile?.full_name}</p></div>
          <div><span className="text-muted-foreground text-xs">Matrícula</span><p className="font-medium font-mono">{(activeProfile as any)?.employee_number || "—"}</p></div>
          <div><span className="text-muted-foreground text-xs">Turno</span><p className="font-medium">{activeProfile?.turno || "—"}</p></div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground">Histórico de Pedidos</h3>
        <div className="grid grid-cols-1 sm:flex sm:flex-row gap-2 w-full sm:w-auto">
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs w-full sm:w-auto" onClick={() => setAppConfirmOpen(true)}>
            <Check className="w-3.5 h-3.5" /> Confirmar via App
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs w-full sm:w-auto" onClick={() => setScanOpen(true)}>
            <ScanLine className="w-3.5 h-3.5" /> Confirmar via QR
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar por item ou número..." className="pl-9 h-9 text-xs w-full" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
        <div className="sm:hidden space-y-2">
          {filteredRequests.map((r: any) => {
            const cfg = statusConfig[r.status] || statusConfig.aguardando;
            const editable = r.status === "aguardando";
            const fromLeader = r.origem === "pedido_coletivo" && r.criado_por && r.criado_por !== r.user_id;
            const needsConfirm = r.status === "entregue_pendente_confirmacao";
            return (
              <div key={r.id} className="border rounded-lg p-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-muted-foreground">{r.numero || "—"}</span>
                  <Badge variant="outline" className={`${cfg.color} text-[10px]`}>{cfg.label}</Badge>
                </div>
                {fromLeader && (
                  <Badge variant="outline" className="text-[10px] border-primary/40 text-primary bg-primary/5">
                    Pedido gerado pelo Líder
                  </Badge>
                )}
                <p className="text-sm font-medium">{r.item_name}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>Qtd: <strong>{r.quantity}</strong></span>
                  <span>{new Date(r.created_at).toLocaleDateString("pt-BR")}</span>
                </div>
                {editable && (
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => openEditReq(r)}>
                      <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs text-destructive" onClick={() => setCancelReqId(r.id)}>
                      <XIcon className="w-3.5 h-3.5 mr-1" /> Cancelar
                    </Button>
                  </div>
                )}
                {needsConfirm && (
                  <Button size="sm" className="w-full h-8 text-xs mt-1" disabled={confirming} onClick={() => confirmReceipt(r.id)}>
                    <Check className="w-3.5 h-3.5 mr-1" /> Confirmar recebimento
                  </Button>
                )}
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
                <TableHead className="text-xs text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.map((r: any) => {
                const cfg = statusConfig[r.status] || statusConfig.aguardando;
                const editable = r.status === "aguardando";
                const fromLeader = r.origem === "pedido_coletivo" && r.criado_por && r.criado_por !== r.user_id;
                const needsConfirm = r.status === "entregue_pendente_confirmacao";
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs font-mono text-muted-foreground">{r.numero || "—"}</TableCell>
                    <TableCell className="text-sm">
                      {r.item_name}
                      {fromLeader && (
                        <Badge variant="outline" className="ml-2 text-[10px] border-primary/40 text-primary bg-primary/5">
                          Pelo Líder
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-sm">{r.quantity}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell><Badge variant="outline" className={cfg.color}>{cfg.label}</Badge></TableCell>
                    <TableCell className="text-right">
                      {needsConfirm ? (
                        <Button size="sm" className="h-7 text-xs" disabled={confirming} onClick={() => confirmReceipt(r.id)}>
                          <Check className="w-3.5 h-3.5 mr-1" /> Confirmar
                        </Button>
                      ) : editable ? (
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditReq(r)} title="Editar">
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setCancelReqId(r.id)} title="Cancelar">
                            <XIcon className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredRequests.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhum pedido encontrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        </>
      )}

      <Dialog open={!!editReq} onOpenChange={(o) => !o && setEditReq(null)}>
        <DialogContent className="max-w-sm w-[95vw]">
          <DialogHeader><DialogTitle>Editar Pedido</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Item *</Label>
              <Select value={editItemId} onValueChange={setEditItemId}>
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
              <Input type="number" min={1} value={editQty} onChange={(e) => setEditQty(Math.max(1, Number(e.target.value)))} />
            </div>
            <Button onClick={handleEditReq} disabled={editSaving} className="w-full min-h-[44px]">
              {editSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Pencil className="w-4 h-4 mr-1" />}
              Salvar alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!cancelReqId} onOpenChange={(o) => !o && setCancelReqId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar pedido</AlertDialogTitle>
            <AlertDialogDescription>Esta ação remove o pedido. Só é possível enquanto estiver "Aguardando".</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={handleCancelReq}>Cancelar pedido</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <QrScannerModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={handleScan}
        title="Confirmar entrega via QR"
      />

      <Dialog open={appConfirmOpen} onOpenChange={setAppConfirmOpen}>
        <DialogContent className="max-w-md w-[95vw]">
          <DialogHeader><DialogTitle>Confirmar recebimento via App</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Confirme abaixo apenas os pedidos que você efetivamente recebeu. Cada confirmação valida que o item registrado no app foi entregue.
            </p>
            {(() => {
              const pending = (myRequests as any[]).filter((r) => r.status === "entregue_pendente_confirmacao");
              const groups = new Map<string, any[]>();
              pending.forEach((r) => {
                const k = r.pedido_id || r.id;
                if (!groups.has(k)) groups.set(k, []);
                groups.get(k)!.push(r);
              });
              if (groups.size === 0) {
                return <p className="text-center text-sm text-muted-foreground py-6">Nenhum pedido aguardando sua confirmação</p>;
              }
              return Array.from(groups.entries()).map(([pid, rows]) => (
                <div key={pid} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono text-muted-foreground">{rows[0].numero || "—"}</span>
                    <Badge variant="outline" className="text-[10px] border-blue-500 text-blue-600 bg-blue-500/10">Aguardando confirmação</Badge>
                  </div>
                  <ul className="text-sm space-y-1">
                    {rows.map((r) => (
                      <li key={r.id} className="flex justify-between gap-2">
                        <span className="truncate">{r.item_name}</span>
                        <span className="text-muted-foreground">Qtd: <strong>{r.quantity}</strong></span>
                      </li>
                    ))}
                  </ul>
                  <Button size="sm" className="w-full h-8 text-xs" disabled={confirming} onClick={async () => { await confirmPedido(pid); }}>
                    <Check className="w-3.5 h-3.5 mr-1" /> Confirmo que recebi
                  </Button>
                </div>
              ));
            })()}
          </div>
        </DialogContent>
      </Dialog>



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
  const [accessOpen, setAccessOpen] = useState(false);
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
  const [replenishOpen, setReplenishOpen] = useState(false);
  const [replenishItem, setReplenishItem] = useState("");
  const [replenishQty, setReplenishQty] = useState(0);
  const [replenishType, setReplenishType] = useState("entrada");
  const [replenishNotes, setReplenishNotes] = useState("");
  const [replenishSaving, setReplenishSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItemId, setHistoryItemId] = useState("");
  const [qrPedidoId, setQrPedidoId] = useState<string | null>(null);

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

  const { data: stockHistory = [] } = useQuery({
    queryKey: ["stock-history", historyItemId],
    queryFn: async () => {
      const { data, error } = await supabase.from("stock_history" as any).select("*").eq("item_id", historyItemId).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!historyItemId,
  });

  const activeProfile = (() => {
    // Just for getting name
    return null;
  })();

  const handleReplenish = async () => {
    if (!replenishItem) { toast.error("Selecione um item"); return; }
    if (replenishQty <= 0) { toast.error("Quantidade deve ser maior que 0"); return; }
    setReplenishSaving(true);
    try {
      const item = items.find((i: any) => i.id === replenishItem);
      if (!item) throw new Error("Item não encontrado");
      const prevQty = (item as any).stock_qty;
      const newQty = replenishType === "entrada" ? prevQty + replenishQty : Math.max(0, prevQty - replenishQty);
      
      const { error: updateErr } = await supabase.from("consumable_items").update({ stock_qty: newQty } as any).eq("id", replenishItem);
      if (updateErr) throw updateErr;
      
      const { error: histErr } = await supabase.from("stock_history" as any).insert({
        item_id: replenishItem,
        type: replenishType,
        quantity: replenishQty,
        previous_qty: prevQty,
        new_qty: newQty,
        notes: replenishNotes || null,
        created_by_name: "Admin",
      });
      if (histErr) throw histErr;

      toast.success(`Estoque atualizado: ${(item as any).name} (${prevQty} → ${newQty})`);
      setReplenishOpen(false);
      setReplenishItem("");
      setReplenishQty(0);
      setReplenishType("entrada");
      setReplenishNotes("");
      qc.invalidateQueries({ queryKey: ["consumable-items"] });
      qc.invalidateQueries({ queryKey: ["consumable-items-active"] });
      qc.invalidateQueries({ queryKey: ["stock-history"] });
    } catch (e: any) { toast.error(e.message); } finally { setReplenishSaving(false); }
  };

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

      // For team orders (pedido_coletivo), "entregue" actually means
      // delivered-by-leader, awaiting inspector confirmation.
      let nextStatus = status;
      const isTeamDelivery = status === "entregue" && request.origem === "pedido_coletivo" && request.criado_por && request.criado_por !== request.user_id;

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
        if (isTeamDelivery) nextStatus = "entregue_pendente_confirmacao";
      }

      const patch: any = { status: nextStatus };
      if (nextStatus === "entregue_pendente_confirmacao") patch.entregue_em = new Date().toISOString();
      if (nextStatus === "entregue") patch.entregue_em = patch.entregue_em || new Date().toISOString();

      const { error } = await supabase.from("consumable_requests").update(patch).eq("id", id);
      if (error) throw error;
      if (isTeamDelivery) {
        toast.success("Entregue — aguardando confirmação do inspetor (via app ou QR)");
        // Open QR dialog so leader can show the code
        setQrPedidoId(request.pedido_id || request.id);
      } else {
        toast.success("Status atualizado");
      }
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

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h3 className="text-base font-heading font-semibold">Estoque de Consumíveis</h3>
        <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={() => setStockListOpen(true)} className="gap-1 min-h-[36px] w-full sm:w-auto justify-center">
            <Package className="w-4 h-4" /> <span className="truncate">Ver Estoque ({items.filter((i: any) => i.active).length})</span>
          </Button>
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" onClick={() => setAccessOpen(true)} className="gap-1 min-h-[36px] w-full sm:w-auto justify-center">
                <UserCog className="w-4 h-4" /> <span className="truncate">Gerenciar Acessos</span>
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setReplenishOpen(true)} className="gap-1 min-h-[36px] w-full sm:w-auto justify-center">
                <RotateCcw className="w-4 h-4" /> <span className="truncate">Atualizar Estoque</span>
              </Button>
              <Button size="sm" onClick={() => setAddItemOpen(true)} className="gap-1 min-h-[36px] w-full sm:w-auto justify-center">
                <Plus className="w-4 h-4" /> <span className="truncate">Registrar Consumível</span>
              </Button>
            </>
          )}
        </div>
      </div>

      <ConsumiveisAccessDialog open={accessOpen} onOpenChange={setAccessOpen} />

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
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setHistoryItemId(i.id); setHistoryOpen(true); }}><History className="w-3.5 h-3.5" /></Button>
                        {isAdmin && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditItem(i)}><Pencil className="w-3.5 h-3.5" /></Button>}
                        {isAdmin && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(i.id)}><Trash2 className="w-3.5 h-3.5" /></Button>}
                      </div>
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
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((i: any) => (
                      <TableRow key={i.id} className={i.stock_qty <= i.min_qty && i.min_qty > 0 ? "bg-destructive/5" : ""}>
                        <TableCell className="font-medium text-sm">{i.name}</TableCell>
                        <TableCell className="text-center text-sm">{i.unit}</TableCell>
                        <TableCell className={`text-center font-semibold ${i.stock_qty <= i.min_qty && i.min_qty > 0 ? "text-destructive" : ""}`}>{i.stock_qty}</TableCell>
                        <TableCell className="text-center text-muted-foreground">{i.min_qty}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setHistoryItemId(i.id); setHistoryOpen(true); }} title="Histórico"><History className="w-3.5 h-3.5" /></Button>
                            {isAdmin && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditItem(i)} title="Editar"><Pencil className="w-3.5 h-3.5" /></Button>}
                            {isAdmin && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(i.id)} title="Excluir"><Trash2 className="w-3.5 h-3.5" /></Button>}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {items.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum item cadastrado</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* QR for inspector to scan and confirm leader delivery */}
      <Dialog open={!!qrPedidoId} onOpenChange={(o) => !o && setQrPedidoId(null)}>
        <DialogContent className="max-w-sm w-[95vw]">
          <DialogHeader><DialogTitle>Mostrar para o inspetor</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="bg-white p-3 rounded-lg">
              {qrPedidoId && (
                <QRCodeSVG
                  value={JSON.stringify({ type: "consumivel_confirm", pedido_id: qrPedidoId })}
                  size={220}
                />
              )}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              O inspetor confirma o recebimento abrindo Consumíveis → "Confirmar via QR".
            </p>
            <p className="text-[10px] font-mono text-muted-foreground break-all">{qrPedidoId}</p>
          </div>
        </DialogContent>
      </Dialog>

      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <h3 className="text-base font-heading font-semibold">Requisições</h3>
          <div className="grid grid-cols-1 sm:flex sm:flex-row gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar..." className="pl-9 h-9 text-xs w-full" />
            </div>
            <Select value={turnoFilter || "all"} onValueChange={(v) => setTurnoFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-full sm:w-40 h-9 text-xs"><SelectValue placeholder="Turno" /></SelectTrigger>
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
      {/* Replenish stock dialog */}
      <Dialog open={replenishOpen} onOpenChange={setReplenishOpen}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Atualizar Estoque</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Item *</Label>
              <Select value={replenishItem} onValueChange={setReplenishItem}>
                <SelectTrigger><SelectValue placeholder="Selecione o item..." /></SelectTrigger>
                <SelectContent>
                  {items.filter((i: any) => i.active).map((i: any) => (
                    <SelectItem key={i.id} value={i.id}>{i.name} (atual: {i.stock_qty} {i.unit})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de Movimentação *</Label>
              <Select value={replenishType} onValueChange={setReplenishType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada / Reposição</SelectItem>
                  <SelectItem value="saida">Saída / Ajuste</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantidade *</Label>
              <Input type="number" min={1} value={replenishQty || ""} onChange={(e) => setReplenishQty(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Observação</Label>
              <Input value={replenishNotes} onChange={(e) => setReplenishNotes(e.target.value)} placeholder="Motivo da movimentação" />
            </div>
            <Button onClick={handleReplenish} disabled={replenishSaving} className="w-full min-h-[44px]">
              {replenishSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RotateCcw className="w-4 h-4 mr-1" />}
              Confirmar Movimentação
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stock history dialog */}
      <Dialog open={historyOpen} onOpenChange={(v) => { setHistoryOpen(v); if (!v) setHistoryItemId(""); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><History className="w-5 h-5" /> Histórico de Movimentação</DialogTitle></DialogHeader>
          {historyItemId && (
            <div className="space-y-3">
              <p className="text-sm font-medium">{items.find((i: any) => i.id === historyItemId)?.name || "Item"}</p>
              {stockHistory.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-6">Nenhum registro encontrado</p>
              ) : (
                <div className="space-y-2">
                  {stockHistory.map((h: any) => (
                    <div key={h.id} className="border rounded-lg p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className={h.type === "entrada" ? "border-emerald-500 text-emerald-600 bg-emerald-500/10" : h.type === "saida" ? "border-red-500 text-red-600 bg-red-500/10" : "border-blue-500 text-blue-600 bg-blue-500/10"}>
                          {h.type === "entrada" ? "Entrada" : h.type === "saida" ? "Saída" : h.type === "reposicao" ? "Reposição" : h.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR")}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Qtd: <strong>{h.quantity}</strong></span>
                        <span className="text-muted-foreground">({h.previous_qty} → {h.new_qty})</span>
                      </div>
                      {h.notes && <p className="text-xs text-muted-foreground">{h.notes}</p>}
                      <p className="text-xs text-muted-foreground">Por: {h.created_by_name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
};

/* ─── Main Consumíveis Page ─── */
const ConsumiveisPage = () => {
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const { profile } = useAuth();
  const { impersonating } = useImpersonation();
  const activeProfile = impersonating || profile;
  const role = getConsumivelRole(activeProfile?.cargo, isAdmin && !impersonating);

  const [activeTab, setActiveTab] = useState<string>("meu_pedido");
  const [prefilledList, setPrefilledList] = useState<{ nome: string; itens: any[] } | null>(null);

  const showTeam = role === "lider" || role === "manager";
  const showManager = role === "manager";

  const tabs = useMemo(() => {
    const t: { value: string; label: string; icon: any }[] = [
      { value: "meu_pedido", label: "Meu Pedido", icon: ShoppingCart },
      { value: "meu_historico", label: "Meu Histórico", icon: LineChart },
    ];
    if (showTeam) {
      t.push({ value: "pedido_time", label: "Pedido de Time", icon: Users });
      t.push({ value: "listas_salvas", label: "Listas Salvas", icon: ListChecks });
      t.push({ value: "historico_individual", label: "Histórico", icon: History });
    }
    if (showManager) {
      t.push({ value: "gestao_estoque", label: "Gestão e Estoque", icon: BarChart3 });
      t.push({ value: "consumo_time", label: "Consumo do Time", icon: ClipboardList });
    }

    return t;
  }, [showTeam, showManager]);

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header sticky top-0 z-40">
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
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
          <h1 className="text-lg sm:text-2xl md:text-3xl font-heading font-bold mt-2 sm:mt-3">Consumíveis</h1>
          <p className="mt-0.5 sm:mt-1 text-primary-foreground/70 max-w-xl text-xs sm:text-sm">Requisição e gestão de itens de consumo do setor da qualidade.</p>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="sticky top-[132px] sm:top-[156px] z-30 w-full overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70 py-2 border-b border-border">
            <TabsList className="inline-flex w-auto min-w-full h-auto flex-nowrap gap-1 p-1">
              {tabs.map((t) => (
                <TabsTrigger key={t.value} value={t.value} className="gap-1.5 text-xs sm:text-sm px-3 py-1.5 sm:py-2 whitespace-nowrap shrink-0">
                  <t.icon className="w-4 h-4" /> {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="meu_pedido" className="form-section"><RequisitarItem /></TabsContent>
          <TabsContent value="meu_historico" className="form-section"><MeuHistorico /></TabsContent>
          {showTeam && (
            <>
              <TabsContent value="pedido_time" className="form-section">
                <PedidoTime initialList={prefilledList} />
              </TabsContent>
              <TabsContent value="listas_salvas" className="form-section">
                <ListasSalvas onUseList={(l) => { setPrefilledList(l); setActiveTab("pedido_time"); }} />
              </TabsContent>
              <TabsContent value="historico_individual" className="form-section">
                <HistoricoIndividual />
              </TabsContent>
            </>
          )}

          {showManager && (
            <>
              <TabsContent value="gestao_estoque" className="form-section"><InventarioRequisicoes /></TabsContent>
              <TabsContent value="consumo_time" className="form-section"><ConsumoTime /></TabsContent>
            </>
          )}
        </Tabs>
      </main>
    </div>
  );
};

export default ConsumiveisPage;
