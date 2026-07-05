import { useState, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import { Loader2, Plus, Trash2, Send, ListChecks, Search, Save, RefreshCw, Download, Upload, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { parseImportRows, buildPedidoRows } from "@/lib/pedidoTime";

/* ─────────────────────────────  Role helpers  ───────────────────────────── */
export type ConsumivelRole = "inspetor" | "lider" | "manager" | "none";

export const getConsumivelRole = (cargo?: string | null, isAdmin?: boolean): ConsumivelRole => {
  if (isAdmin) return "manager";
  const c = (cargo || "").toLowerCase();
  if (!c) return "none";
  if (c.includes("analista") || c.includes("supervisor") || c.includes("gerente")) return "manager";
  if (c.includes("lider") || c.includes("líder") || c.includes("assistente")) return "lider";
  if (c.includes("inspetor")) return "inspetor";
  return "none";
};

const statusConfig: Record<string, { label: string; color: string }> = {
  aguardando: { label: "Aguardando", color: "border-yellow-500 text-yellow-600 bg-yellow-500/10" },
  entregue_pendente_confirmacao: { label: "Aguardando confirmação", color: "border-blue-500 text-blue-600 bg-blue-500/10" },
  entregue: { label: "Entregue", color: "border-emerald-500 text-emerald-600 bg-emerald-500/10" },
  rejeitado: { label: "Rejeitado", color: "border-red-500 text-red-600 bg-red-500/10" },
};

interface ListaItem { item_id: string; item_name: string; quantity: number; }

/* ─────────────────────────  Shared UI helpers  ───────────────────────── */
const TableSkeleton = ({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) => (
  <div className="space-y-2">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-2">
        {Array.from({ length: cols }).map((_, j) => (
          <Skeleton key={j} className="h-9 flex-1" />
        ))}
      </div>
    ))}
  </div>
);

const KpiSkeletons = ({ count = 3 }: { count?: number }) => (
  <div className={`grid grid-cols-2 ${count > 3 ? "md:grid-cols-4" : "sm:grid-cols-3"} gap-3`}>
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton key={i} className="h-20" />
    ))}
  </div>
);

const RetryBox = ({ msg, onRetry }: { msg: string; onRetry: () => void }) => (
  <div className="border border-destructive/40 bg-destructive/5 rounded-lg p-4 text-center space-y-2">
    <p className="text-sm text-destructive font-medium">{msg}</p>
    <p className="text-xs text-muted-foreground">Verifique sua conexão e tente novamente.</p>
    <Button size="sm" variant="outline" onClick={onRetry}><RefreshCw className="w-4 h-4 mr-1" />Tentar novamente</Button>
  </div>
);

const exportRows = (rows: Record<string, any>[], fileBase: string, format: "csv" | "xlsx") => {
  if (rows.length === 0) { toast.error("Sem dados para exportar"); return; }
  const ws = XLSX.utils.json_to_sheet(rows);
  if (format === "csv") {
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${fileBase}.csv`; a.click();
    URL.revokeObjectURL(url);
  } else {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dados");
    XLSX.writeFile(wb, `${fileBase}.xlsx`);
  }
};

const ExportButtons = ({ rows, fileBase }: { rows: Record<string, any>[]; fileBase: string }) => (
  <div className="flex gap-1.5">
    <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => exportRows(rows, fileBase, "csv")}>
      <Download className="w-3.5 h-3.5" /> CSV
    </Button>
    <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => exportRows(rows, fileBase, "xlsx")}>
      <Download className="w-3.5 h-3.5" /> Excel
    </Button>
  </div>
);

const ItemQtyEditor = ({ items, value, onChange }: { items: any[]; value: ListaItem[]; onChange: (v: ListaItem[]) => void; }) => {
  const update = (idx: number, patch: Partial<ListaItem>) => {
    const next = value.map((r, i) => i === idx ? { ...r, ...patch } : r);
    onChange(next);
  };
  const add = () => onChange([...value, { item_id: "", item_name: "", quantity: 1 }]);
  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));
  return (
    <div className="space-y-2">
      {value.map((row, idx) => (
        <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-2">
          <Select value={row.item_id} onValueChange={(v) => {
            const it = items.find((i: any) => i.id === v);
            update(idx, { item_id: v, item_name: it?.name || "" });
          }}>
            <SelectTrigger className="flex-1 h-9 text-xs min-w-0"><SelectValue placeholder="Selecione o item..." /></SelectTrigger>
            <SelectContent>{items.map((i: any) => (
              <SelectItem key={i.id} value={i.id}>{i.name} ({i.unit})</SelectItem>
            ))}</SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Input type="number" min={1} value={row.quantity} onChange={(e) => update(idx, { quantity: Math.max(1, Number(e.target.value)) })} className="w-20 h-9 text-xs" />
            <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive shrink-0" onClick={() => remove(idx)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add} className="gap-1">
        <Plus className="w-3.5 h-3.5" /> Adicionar item
      </Button>
    </div>
  );
};

/* ───────────────────────────  MEU HISTÓRICO  ─────────────────────────── */
export const MeuHistorico = () => {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["meu-historico-consumiveis", user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as any[];
      const { data, error } = await supabase.from("consumable_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const stats = useMemo(() => {
    const all = data || [];
    const totalReq = all.reduce((s, r: any) => s + (r.quantity || 0), 0);
    const totalEntregue = all.filter((r: any) => r.status === "entregue").reduce((s, r: any) => s + (r.quantity || 0), 0);
    const byItem = new Map<string, { name: string; req: number; entregue: number; rejeitado: number; last: string }>();
    for (const r of all) {
      const k = r.item_name || "—";
      const cur = byItem.get(k) || { name: k, req: 0, entregue: 0, rejeitado: 0, last: r.created_at };
      cur.req += r.quantity || 0;
      if (r.status === "entregue") cur.entregue += r.quantity || 0;
      if (r.status === "rejeitado") cur.rejeitado += r.quantity || 0;
      if (!cur.last || new Date(r.created_at) > new Date(cur.last)) cur.last = r.created_at;
      byItem.set(k, cur);
    }
    const itemsArr = Array.from(byItem.values()).sort((a, b) => b.req - a.req);
    const top = itemsArr[0]?.name || "—";
    const now = new Date();
    const months: { label: string; key: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({ key, label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), total: 0 });
    }
    for (const r of all) {
      const d = new Date(r.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const m = months.find((mm) => mm.key === key);
      if (m) m.total += 1;
    }
    return { totalReq, totalEntregue, top, itemsArr, months };
  }, [data]);

  const exportData = useMemo(() => stats.itemsArr.map((r) => ({
    Item: r.name, Requisitado: r.req, Entregue: r.entregue, Rejeitado: r.rejeitado,
    "Última requisição": new Date(r.last).toLocaleDateString("pt-BR"),
  })), [stats.itemsArr]);

  if (isLoading) return (
    <div className="space-y-4">
      <KpiSkeletons count={3} />
      <Skeleton className="h-56" />
      <TableSkeleton rows={5} cols={5} />
    </div>
  );
  if (isError) return <RetryBox msg="Erro ao carregar histórico" onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-heading font-semibold">Meu Histórico</h2>
        <ExportButtons rows={exportData} fileBase="meu_historico_consumiveis" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="form-section p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{stats.totalReq}</p>
          <p className="text-xs text-muted-foreground">Total requisitado</p>
        </div>
        <div className="form-section p-3 text-center">
          <p className="text-2xl font-bold text-emerald-600">{stats.totalEntregue}</p>
          <p className="text-xs text-muted-foreground">Total entregue</p>
        </div>
        <div className="form-section p-3 text-center">
          <p className="text-sm font-bold text-foreground truncate" title={stats.top}>{stats.top}</p>
          <p className="text-xs text-muted-foreground">Item mais requisitado</p>
        </div>
      </div>

      <div className="form-section p-3">
        <h3 className="text-sm font-semibold mb-2">Requisições nos últimos 6 meses</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.months}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {stats.itemsArr.map((r) => (
          <div key={r.name} className="border rounded-lg p-3 space-y-1">
            <p className="text-sm font-semibold">{r.name}</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div><span className="text-muted-foreground">Req:</span> <strong>{r.req}</strong></div>
              <div className="text-emerald-600"><span className="text-muted-foreground">OK:</span> <strong>{r.entregue}</strong></div>
              <div className="text-destructive"><span className="text-muted-foreground">Rej:</span> <strong>{r.rejeitado}</strong></div>
            </div>
            <p className="text-[10px] text-muted-foreground">Última: {new Date(r.last).toLocaleDateString("pt-BR")}</p>
          </div>
        ))}
        {stats.itemsArr.length === 0 && <p className="text-center text-muted-foreground py-6 text-sm">Nenhum pedido registrado</p>}
      </div>

      <div className="hidden sm:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Item</TableHead>
              <TableHead className="text-xs text-center">Requisitado</TableHead>
              <TableHead className="text-xs text-center">Entregue</TableHead>
              <TableHead className="text-xs text-center">Rejeitado</TableHead>
              <TableHead className="text-xs">Última</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.itemsArr.map((r) => (
              <TableRow key={r.name}>
                <TableCell className="text-sm font-medium">{r.name}</TableCell>
                <TableCell className="text-center text-sm">{r.req}</TableCell>
                <TableCell className="text-center text-sm text-emerald-600">{r.entregue}</TableCell>
                <TableCell className="text-center text-sm text-destructive">{r.rejeitado}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(r.last).toLocaleDateString("pt-BR")}</TableCell>
              </TableRow>
            ))}
            {stats.itemsArr.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6 text-sm">Nenhum pedido registrado</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

/* ───────────────────────────  PEDIDO DE TIME  ─────────────────────────── */
type MemberOrder = { items: ListaItem[] };

export const PedidoTime = ({ initialList }: { initialList?: { nome: string; itens: ListaItem[] } | null }) => {
  const { user, profile } = useAuth();
  const { isAdmin } = useUserRole();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const role = getConsumivelRole(profile?.cargo, isAdmin);
  const isManager = role === "manager"; // admin/analista/supervisor/gerente

  // Map of memberId -> their items list. Each entry becomes ONE pedido.
  const [memberOrders, setMemberOrders] = useState<Record<string, MemberOrder>>({});
  const [savedListId, setSavedListId] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [teamSearch, setTeamSearch] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: ["consumable-items-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("consumable_items").select("*").eq("active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: teamMembers = [], isLoading: loadingTeam, isError: errTeam, refetch: refetchTeam } = useQuery({
    queryKey: ["team-members-pedido", profile?.turno, isManager],
    queryFn: async () => {
      // Managers/Admins → ALL active MOBIS employees (regardless of turno).
      // Leaders → only members from their own turno.
      let q = supabase
        .from("profiles")
        .select("id, full_name, turno, cargo, employee_number, empresa")
        .eq("status", "active");
      if (isManager) {
        q = q.eq("empresa", "mobis_brasil");
      } else if (profile?.turno) {
        q = q.eq("turno", profile.turno);
      } else {
        return [];
      }
      const { data, error } = await q.order("full_name");
      if (error) throw error;
      return (data || []).filter((p: any) => p.full_name !== "TESTER");
    },
    enabled: !!profile && (isManager || !!profile?.turno),
  });

  const { data: savedLists = [] } = useQuery({
    queryKey: ["consumption-lists"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("consumption_lists").select("*").order("criado_em", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const selectedIds = Object.keys(memberOrders);
  const totalPedidos = selectedIds.length;
  const totalItens = selectedIds.reduce((s, id) => s + memberOrders[id].items.filter(i => i.item_id).length, 0);

  const addMember = (id: string, itens?: ListaItem[]) => {
    setMemberOrders((prev) => prev[id]
      ? prev
      : { ...prev, [id]: { items: itens && itens.length ? itens : [{ item_id: "", item_name: "", quantity: 1 }] } });
  };
  const removeMember = (id: string) => {
    setMemberOrders((prev) => {
      const n = { ...prev }; delete n[id]; return n;
    });
  };
  const toggleMember = (id: string) => {
    if (memberOrders[id]) removeMember(id); else addMember(id);
  };
  const updateMemberItems = (id: string, items: ListaItem[]) => {
    setMemberOrders((prev) => ({ ...prev, [id]: { items } }));
  };

  const loadListForAll = () => {
    const lst = savedLists.find((l: any) => l.id === savedListId);
    if (!lst) return;
    const itens: ListaItem[] = Array.isArray(lst.itens) ? lst.itens : [];
    if (selectedIds.length === 0) { toast.error("Selecione ao menos um membro primeiro"); return; }
    setMemberOrders((prev) => {
      const n = { ...prev };
      for (const id of Object.keys(n)) n[id] = { items: itens.map((i) => ({ ...i })) };
      return n;
    });
    toast.success(`Lista "${lst.nome}" aplicada a ${selectedIds.length} pedido(s)`);
  };

  const downloadTemplate = () => {
    const ex = items.slice(0, 2);
    const sampleMember = teamMembers[0];
    const ws = XLSX.utils.aoa_to_sheet([
      ["matricula", "nome", "item", "quantidade"],
      [sampleMember?.employee_number || "1234567", sampleMember?.full_name || "Nome do membro", ex[0]?.name || "Item A", 1],
      [sampleMember?.employee_number || "1234567", sampleMember?.full_name || "Nome do membro", ex[1]?.name || "Item B", 2],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pedido de Time");
    XLSX.writeFile(wb, "template_pedido_time.xlsx");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });

      const { grouped, unknownMembers, unknownItems, duplicates, skippedEmpty } =
        parseImportRows(json as any, teamMembers as any, items as any);

      const ids = Object.keys(grouped);
      if (ids.length === 0) {
        toast.error("Nenhuma linha válida. Use colunas: matricula (ou nome), item, quantidade.");
        return;
      }

      setMemberOrders((prev) => {
        const n = { ...prev };
        for (const id of ids) n[id] = { items: grouped[id] };
        return n;
      });

      const warns: string[] = [];
      if (duplicates.length) warns.push(`${duplicates.length} duplicata(s) somada(s)`);
      if (unknownMembers.length) warns.push(`${unknownMembers.length} membro(s) não encontrados`);
      if (unknownItems.length) warns.push(`${unknownItems.length} item(ns) não cadastrados`);
      if (skippedEmpty) warns.push(`${skippedEmpty} linha(s) sem item`);
      toast.success(`${ids.length} pedido(s) preparado(s)${warns.length ? ` — ${warns.join(", ")}` : ""}`);
    } catch {
      toast.error("Erro ao ler o arquivo. Use .xlsx, .xls ou .csv.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // Compute the rows that will be inserted (used for preview + submit).
  const previewRows = useMemo(() => {
    const flat: Record<string, ListaItem[]> = {};
    for (const id of selectedIds) flat[id] = memberOrders[id].items;
    return buildPedidoRows(flat, teamMembers as any, { createdBy: user?.id || null });
  }, [memberOrders, selectedIds, teamMembers, user?.id]);

  const previewByMember = useMemo(() => {
    const map = new Map<string, { name: string; pedido_id: string; items: { item_name: string; quantity: number }[] }>();
    for (const r of previewRows) {
      const cur = map.get(r.user_id) || { name: r.user_name, pedido_id: r.pedido_id, items: [] };
      cur.items.push({ item_name: r.item_name, quantity: r.quantity });
      map.set(r.user_id, cur);
    }
    return Array.from(map.values());
  }, [previewRows]);

  const openPreview = () => {
    if (selectedIds.length === 0) { toast.error("Selecione ao menos um membro"); return; }
    if (previewRows.length === 0) { toast.error("Adicione ao menos um item válido por pessoa"); return; }
    setPreviewOpen(true);
  };

  const confirmSend = async () => {
    if (previewRows.length === 0) return;
    setSending(true);
    try {
      const { error } = await (supabase as any).from("consumable_requests").insert(previewRows);
      if (error) throw error;
      const uniqPedidos = new Set(previewRows.map((r) => r.pedido_id)).size;
      toast.success(`${uniqPedidos} pedido(s) criados (${previewRows.length} itens)`);
      setMemberOrders({});
      setPreviewOpen(false);
      qc.invalidateQueries({ queryKey: ["all-consumable-requests"] });
      qc.invalidateQueries({ queryKey: ["team-consumable-requests"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };


  // Apply initialList once: pre-load the current user with the chosen list as a starting point
  const appliedInitial = useRef(false);
  if (initialList && !appliedInitial.current && selectedIds.length === 0 && user?.id && teamMembers.some((m: any) => m.id === user.id)) {
    appliedInitial.current = true;
    setTimeout(() => addMember(user.id!, initialList.itens), 0);
  }

  return (
    <div className="space-y-4">
      <div className="form-section p-3 space-y-2">
        <Label className="text-xs font-semibold">Usar lista salva (aplica os mesmos itens em todos os membros selecionados)</Label>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <Select value={savedListId} onValueChange={setSavedListId}>
            <SelectTrigger className="flex-1 h-9 text-xs min-w-0"><SelectValue placeholder="Selecione uma lista..." /></SelectTrigger>
            <SelectContent>{savedLists.map((l: any) => (
              <SelectItem key={l.id} value={l.id}>{l.nome} ({(l.itens || []).length} itens)</SelectItem>
            ))}</SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={loadListForAll} disabled={!savedListId || selectedIds.length === 0} className="min-h-[36px]">
            Aplicar nos selecionados
          </Button>
        </div>
      </div>

      <div className="form-section p-3 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <Label className="text-xs font-semibold">Importar pedidos por planilha</Label>
          <div className="grid grid-cols-1 sm:flex gap-1.5 w-full sm:w-auto">
            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs w-full sm:w-auto justify-center" onClick={downloadTemplate}>
              <FileSpreadsheet className="w-3.5 h-3.5" /> Template
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs w-full sm:w-auto justify-center" onClick={() => fileRef.current?.click()}>
              <Upload className="w-3.5 h-3.5" /> Importar
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Colunas: <code>matricula</code> (ou <code>nome</code>), <code>item</code>, <code>quantidade</code>. Cada matrícula vira um pedido com os itens listados.
        </p>
      </div>

      <div className="form-section p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <ListChecks className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight truncate">
                {isManager ? "Selecionar membros" : "Selecionar membros do time"}
              </p>
              <p className="text-[11px] text-muted-foreground leading-tight">
                {isManager
                  ? `Todos funcionários MOBIS · ${teamMembers.length}`
                  : `Turno ${profile?.turno || "—"} · ${teamMembers.length} pessoa(s)`}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="bg-primary/10 border-primary/30 text-primary font-semibold">
            {selectedIds.length} selecionado(s)
          </Badge>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={teamSearch}
            onChange={(e) => setTeamSearch(e.target.value)}
            placeholder="Buscar por nome ou matrícula..."
            className="h-9 text-xs pl-8"
          />
        </div>

        {(() => {
          const filteredMembers = teamMembers.filter((m: any) => {
            if (!teamSearch.trim()) return true;
            const t = teamSearch.toLowerCase();
            return (m.full_name || "").toLowerCase().includes(t)
              || String(m.employee_number || "").toLowerCase().includes(t);
          });
          const allFilteredSelected = filteredMembers.length > 0 && filteredMembers.every((m: any) => memberOrders[m.id]);
          return (
            <>
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-muted-foreground">
                  {filteredMembers.length} resultado(s)
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[11px] px-2"
                    disabled={filteredMembers.length === 0}
                    onClick={() => {
                      if (allFilteredSelected) {
                        filteredMembers.forEach((m: any) => memberOrders[m.id] && removeMember(m.id));
                      } else {
                        filteredMembers.forEach((m: any) => !memberOrders[m.id] && addMember(m.id));
                      }
                    }}
                  >
                    {allFilteredSelected ? "Desmarcar todos" : "Selecionar todos"}
                  </Button>
                  {selectedIds.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[11px] px-2 text-destructive hover:text-destructive"
                      onClick={() => setMemberOrders({})}
                    >
                      Limpar
                    </Button>
                  )}
                </div>
              </div>

              {loadingTeam ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground py-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Carregando membros...
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
                  </div>
                </div>
              ) : errTeam ? (
                <RetryBox msg="Erro ao carregar membros" onRetry={refetchTeam} />
              ) : teamMembers.length === 0 ? (
                <div className="text-center py-8 px-4 border border-dashed rounded-lg bg-muted/30">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
                    <ListChecks className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <p className="text-xs font-medium">Nenhum membro disponível</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {isManager
                      ? "Nenhum funcionário MOBIS cadastrado ainda."
                      : `Nenhum membro encontrado no turno ${profile?.turno || "—"}.`}
                  </p>
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="text-center py-8 px-4 border border-dashed rounded-lg bg-muted/30">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
                    <Search className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <p className="text-xs font-medium">Nenhum resultado para "{teamSearch}"</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Tente outro nome ou matrícula.</p>
                  <Button variant="ghost" size="sm" className="h-7 text-[11px] mt-2" onClick={() => setTeamSearch("")}>
                    Limpar busca
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-80 overflow-y-auto pr-1 -mr-1">
                  {filteredMembers.map((m: any) => {
                    const checked = !!memberOrders[m.id];
                    const initials = (m.full_name || "?")
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((s: string) => s[0]?.toUpperCase())
                      .join("");
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleMember(m.id)}
                        className={`group flex items-center gap-2 text-left p-2 rounded-lg border transition-all min-w-0 ${
                          checked
                            ? "bg-primary/10 border-primary/60 shadow-sm"
                            : "bg-card border-border hover:border-primary/40 hover:bg-muted/50"
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-colors ${
                            checked
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary"
                          }`}
                        >
                          {initials || "?"}
                        </div>
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <p className="text-xs font-medium truncate leading-tight">{m.full_name}</p>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            {m.employee_number && (
                              <span className="text-[10px] text-muted-foreground font-mono truncate">
                                #{m.employee_number}
                              </span>
                            )}
                            {isManager && m.turno && (
                              <span className="text-[10px] text-muted-foreground">· {m.turno}</span>
                            )}
                          </div>
                        </div>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleMember(m.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0"
                        />
                      </button>
                    );
                  })}
                </div>
              )}

            </>
          );
        })()}

        <div className="flex items-center justify-between pt-2 border-t text-[11px]">
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground">{totalPedidos}</span> pedido(s)
          </span>
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground">{totalItens}</span> item(ns) no total
          </span>
        </div>
      </div>


      {selectedIds.length > 0 && (
        <div className="space-y-3">
          <Label className="text-xs font-semibold">Itens por pessoa (um pedido por membro)</Label>
          {selectedIds.map((id) => {
            const m = teamMembers.find((tm: any) => tm.id === id);
            return (
              <div key={id} className="form-section p-3 space-y-2 border-l-2 border-primary">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{m?.full_name || id}</p>
                    <p className="text-[11px] text-muted-foreground">{m?.employee_number || ""}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-destructive h-8" onClick={() => removeMember(id)}>
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Remover
                  </Button>
                </div>
                <ItemQtyEditor items={items} value={memberOrders[id].items} onChange={(v) => updateMemberItems(id, v)} />
              </div>
            );
          })}
        </div>
      )}

      <Button onClick={openPreview} disabled={sending || selectedIds.length === 0} className="w-full min-h-[44px]">
        <Send className="w-4 h-4 mr-1" />
        Pré-visualizar {totalPedidos} pedido(s) individuais
      </Button>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Confirmar envio — {previewByMember.length} pedido(s)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Cada pessoa receberá <strong>um único pedido</strong> com os itens abaixo. Revise antes de confirmar.
            </p>
            {previewByMember.map((p) => (
              <div key={p.pedido_id} className="border rounded-lg p-3 space-y-1">
                <p className="text-sm font-semibold">{p.name}</p>
                <ul className="text-xs text-muted-foreground space-y-0.5 pl-3 list-disc">
                  {p.items.map((it, i) => (
                    <li key={i}><span className="text-foreground">{it.item_name}</span> — qtd {it.quantity}</li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button variant="outline" className="flex-1 min-h-[44px]" onClick={() => setPreviewOpen(false)} disabled={sending}>
                Voltar e ajustar
              </Button>
              <Button className="flex-1 min-h-[44px]" onClick={confirmSend} disabled={sending}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                Confirmar envio
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};


/* ───────────────────────────  LISTAS SALVAS  ─────────────────────────── */
export const ListasSalvas = ({ onUseList }: { onUseList: (l: { nome: string; itens: ListaItem[] }) => void }) => {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [itens, setItens] = useState<ListaItem[]>([{ item_id: "", item_name: "", quantity: 1 }]);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: items = [] } = useQuery({
    queryKey: ["consumable-items-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("consumable_items").select("*").eq("active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: lists = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["consumption-lists"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("consumption_lists").select("*").order("criado_em", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const handleSave = async () => {
    if (!nome.trim()) { toast.error("Informe o nome da lista"); return; }
    const valid = itens.filter((i) => i.item_id && i.quantity > 0);
    if (valid.length === 0) { toast.error("Adicione pelo menos um item"); return; }
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("consumption_lists").insert({
        nome: nome.trim(),
        criado_por: user?.id,
        criado_por_nome: profile?.full_name || "",
        itens: valid,
      });
      if (error) throw error;
      toast.success("Lista salva!");
      setCreateOpen(false);
      setNome("");
      setItens([{ item_id: "", item_name: "", quantity: 1 }]);
      qc.invalidateQueries({ queryKey: ["consumption-lists"] });
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await (supabase as any).from("consumption_lists").delete().eq("id", deleteId);
      if (error) throw error;
      toast.success("Lista excluída");
      setDeleteId(null);
      qc.invalidateQueries({ queryKey: ["consumption-lists"] });
    } catch (e: any) { toast.error(e.message); }
  };

  if (isLoading) return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
      </div>
    </div>
  );
  if (isError) return <RetryBox msg="Erro ao carregar listas" onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-heading font-semibold">Listas Salvas</h2>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1"><Plus className="w-4 h-4" /> Nova lista</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {lists.map((l: any) => (
          <div key={l.id} className="border rounded-lg p-3 space-y-2 bg-card">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{l.nome}</p>
                <p className="text-xs text-muted-foreground">por {l.criado_por_nome || "—"}</p>
              </div>
              <Badge variant="outline" className="text-[10px]">{(l.itens || []).length} itens</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{new Date(l.criado_em).toLocaleDateString("pt-BR")}</p>
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" variant="outline" className="flex-1 min-h-[36px]" onClick={() => onUseList({ nome: l.nome, itens: l.itens || [] })}>
                <ListChecks className="w-3.5 h-3.5 mr-1" /> Usar
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive min-h-[36px]" onClick={() => setDeleteId(l.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
        {lists.length === 0 && <p className="text-sm text-muted-foreground col-span-full text-center py-8">Nenhuma lista salva</p>}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg w-[95vw]">
          <DialogHeader><DialogTitle>Nova lista</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome da lista *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Kit inspetor turno 1" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Itens *</Label>
              <ItemQtyEditor items={items} value={itens} onChange={setItens} />
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full min-h-[44px]">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />} Salvar lista
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir lista</AlertDialogTitle><AlertDialogDescription>Tem certeza? Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={handleDelete}>Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

/* ─────────────────  ANÁLISE INDIVIDUAL (dentro de Consumo do Time)  ───────────────── */
const IndividualAnalysis = ({ rows, periodo }: { rows: any[]; periodo: string }) => {
  const [selectedUser, setSelectedUser] = useState<string>("");

  const users = useMemo(() => {
    const m = new Map<string, { key: string; name: string; turno: string; total: number }>();
    for (const r of rows) {
      const key = r.user_id || r.user_name;
      if (!key) continue;
      const cur = m.get(key) || { key, name: r.user_name || "—", turno: r.turno || "—", total: 0 };
      cur.total += 1;
      m.set(key, cur);
    }
    return Array.from(m.values()).sort((a, b) => b.total - a.total);
  }, [rows]);

  const userRows = useMemo(
    () => (selectedUser ? rows.filter((r) => (r.user_id || r.user_name) === selectedUser) : []),
    [rows, selectedUser]
  );

  const userStats = useMemo(() => {
    const delivered = userRows.filter((r) => r.status === "entregue");
    const aguardando = userRows.filter((r) => r.status === "aguardando").length;
    const rejeitado = userRows.filter((r) => r.status === "rejeitado").length;
    const totalQtd = delivered.reduce((s, r) => s + (r.quantity || 0), 0);
    const itemMap = new Map<string, number>();
    for (const r of delivered) itemMap.set(r.item_name, (itemMap.get(r.item_name) || 0) + (r.quantity || 0));
    const byItem = Array.from(itemMap.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
    const last = userRows[0]?.created_at;
    return { totalPedidos: userRows.length, delivered: delivered.length, aguardando, rejeitado, totalQtd, byItem, last };
  }, [userRows]);

  const exportData = useMemo(() => userRows.map((r: any) => ({
    Numero: r.numero || "",
    Data: new Date(r.created_at).toLocaleDateString("pt-BR"),
    Item: r.item_name,
    Quantidade: r.quantity,
    Status: statusConfig[r.status]?.label || r.status,
    Origem: r.origem === "pedido_coletivo" ? "Pedido coletivo" : "Individual",
  })), [userRows]);

  const currentUser = users.find((u) => u.key === selectedUser);

  return (
    <div className="form-section p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <UserCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">Análise individual</p>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Selecione um usuário para inspecionar o consumo pessoal no período
            </p>
          </div>
        </div>
        {selectedUser && (
          <div className="flex items-center gap-2">
            <ExportButtons rows={exportData} fileBase={`consumo_${(currentUser?.name || "usuario").replace(/\s+/g, "_")}_${periodo}d`} />
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setSelectedUser("")}>Limpar</Button>
          </div>
        )}
      </div>

      <Select value={selectedUser} onValueChange={setSelectedUser}>
        <SelectTrigger className="h-9 text-xs">
          <SelectValue placeholder={`Escolha um usuário (${users.length} com atividade)`} />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {users.length === 0 && <div className="px-2 py-3 text-xs text-muted-foreground text-center">Sem atividade no período</div>}
          {users.map((u) => (
            <SelectItem key={u.key} value={u.key}>
              {u.name} · {u.turno} · {u.total} pedido(s)
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!selectedUser ? (
        <div className="text-center py-6 border border-dashed rounded-lg bg-muted/30">
          <UserCheck className="w-6 h-6 mx-auto text-muted-foreground mb-1" />
          <p className="text-xs text-muted-foreground">Selecione um usuário acima para ver a análise individual</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <p className="text-sm font-semibold">{currentUser?.name}</p>
              <p className="text-[11px] text-muted-foreground">
                Turno {currentUser?.turno} · última atividade: {userStats.last ? new Date(userStats.last).toLocaleDateString("pt-BR") : "—"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="border rounded-lg p-2.5 text-center">
              <p className="text-xl font-bold">{userStats.totalPedidos}</p>
              <p className="text-[10px] text-muted-foreground">Pedidos</p>
            </div>
            <div className="border rounded-lg p-2.5 text-center">
              <p className="text-xl font-bold text-emerald-600">{userStats.totalQtd}</p>
              <p className="text-[10px] text-muted-foreground">Itens entregues</p>
            </div>
            <div className="border rounded-lg p-2.5 text-center">
              <p className="text-xl font-bold text-yellow-600">{userStats.aguardando}</p>
              <p className="text-[10px] text-muted-foreground">Aguardando</p>
            </div>
            <div className="border rounded-lg p-2.5 text-center">
              <p className="text-xl font-bold text-red-500">{userStats.rejeitado}</p>
              <p className="text-[10px] text-muted-foreground">Rejeitados</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="border rounded-lg p-3">
              <h4 className="text-xs font-semibold mb-2">Itens mais consumidos</h4>
              {userStats.byItem.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Sem itens entregues</p>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={userStats.byItem.slice(0, 8)} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="border rounded-lg p-3">
              <h4 className="text-xs font-semibold mb-2">Timeline ({userRows.length})</h4>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {userRows.map((r: any) => {
                  const cfg = statusConfig[r.status] || statusConfig.aguardando;
                  return (
                    <div key={r.id} className="flex items-center justify-between gap-2 text-[11px] border-l-2 border-primary/40 pl-2 py-1">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{r.item_name} <span className="text-muted-foreground">× {r.quantity}</span></p>
                        <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString("pt-BR")} · {r.numero || "—"}</p>
                      </div>
                      <Badge variant="outline" className={`${cfg.color} text-[10px] shrink-0`}>{cfg.label}</Badge>
                    </div>
                  );
                })}
                {userRows.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Sem registros</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ───────────────────────────  CONSUMO DO TIME  ─────────────────────────── */

export const ConsumoTime = () => {
  const { profile } = useAuth();
  const { isAdmin } = useUserRole();
  const role = getConsumivelRole(profile?.cargo, isAdmin);
  const canSeeAllShifts = role === "manager"; // gestores e admins
  const [periodo, setPeriodo] = useState<"30" | "90" | "180" | "365">("30");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [turnoView, setTurnoView] = useState<string>(canSeeAllShifts ? "all" : (profile?.turno || ""));

  const dateFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - parseInt(periodo, 10));
    return d.toISOString();
  }, [periodo]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["team-consumable-requests", canSeeAllShifts ? turnoView : profile?.turno, dateFrom],
    queryFn: async () => {
      const effectiveTurno = canSeeAllShifts ? turnoView : profile?.turno;
      if (!canSeeAllShifts && !profile?.turno) return [];
      let q = supabase.from("consumable_requests").select("*").gte("created_at", dateFrom).order("created_at", { ascending: false });
      if (effectiveTurno && effectiveTurno !== "all") q = q.eq("turno", effectiveTurno);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: canSeeAllShifts || !!profile?.turno,
  });


  const stats = useMemo(() => {
    const all = data || [];
    const total = all.length;
    const entregue = all.filter((r: any) => r.status === "entregue").length;
    const aguardando = all.filter((r: any) => r.status === "aguardando").length;
    const byMember = new Map<string, number>();
    const byItem = new Map<string, number>();
    for (const r of all) {
      if (r.status === "entregue") {
        byMember.set(r.user_name, (byMember.get(r.user_name) || 0) + (r.quantity || 0));
        byItem.set(r.item_name, (byItem.get(r.item_name) || 0) + (r.quantity || 0));
      }
    }
    const byMemberArr = Array.from(byMember.entries()).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
    const byItemArr = Array.from(byItem.entries()).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
    const topMember = byMemberArr[0]?.name || "—";
    return { total, entregue, aguardando, byMember: byMemberArr.slice(0, 10), byItem: byItemArr.slice(0, 10), topMember };
  }, [data]);

  const filtered = useMemo(() => {
    let r = data || [];
    if (statusFilter !== "all") r = r.filter((x: any) => x.status === statusFilter);
    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase();
      r = r.filter((x: any) =>
        x.item_name?.toLowerCase().includes(t) ||
        x.user_name?.toLowerCase().includes(t) ||
        x.numero?.toLowerCase().includes(t)
      );
    }
    return r;
  }, [data, statusFilter, searchTerm]);

  const exportData = useMemo(() => filtered.map((r: any) => ({
    Numero: r.numero || "",
    Usuario: r.user_name,
    Turno: r.turno || "",
    Item: r.item_name,
    Quantidade: r.quantity,
    Data: new Date(r.created_at).toLocaleDateString("pt-BR"),
    Status: statusConfig[r.status]?.label || r.status,
    Origem: r.origem === "pedido_coletivo" ? "Pedido coletivo" : "Individual",
  })), [filtered]);

  if (isLoading) return (
    <div className="space-y-4">
      <KpiSkeletons count={4} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
      <TableSkeleton rows={6} cols={6} />
    </div>
  );
  if (isError) return <RetryBox msg="Erro ao carregar consumo do time" onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-heading font-semibold">
            Consumo do Time — {canSeeAllShifts ? (turnoView === "all" ? "Todos os turnos" : `Turno ${turnoView}`) : `turno ${profile?.turno || "—"}`}
          </h2>
          {canSeeAllShifts && (
            <p className="text-[11px] text-muted-foreground">Visualização de gestor · alterne entre turnos</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ExportButtons rows={exportData} fileBase={`consumo_time_${canSeeAllShifts ? turnoView : profile?.turno}_${periodo}d`} />
          <Select value={periodo} onValueChange={(v: any) => setPeriodo(v)}>
            <SelectTrigger className="w-40 h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="180">Últimos 6 meses</SelectItem>
              <SelectItem value="365">Último ano</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {canSeeAllShifts && (
        <div className="form-section p-2 flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-muted-foreground px-1.5">Turno:</span>
          {[
            { v: "all", label: "Todos" },
            { v: "A", label: "Turno A" },
            { v: "B", label: "Turno B" },
            { v: "C", label: "Turno C" },
            { v: "ADM", label: "ADM" },
          ].map((t) => (
            <Button
              key={t.v}
              size="sm"
              variant={turnoView === t.v ? "default" : "outline"}
              className="h-7 text-[11px] px-3"
              onClick={() => setTurnoView(t.v)}
            >
              {t.label}
            </Button>
          ))}
        </div>
      )}


      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="form-section p-3 text-center"><p className="text-2xl font-bold">{stats.total}</p><p className="text-xs text-muted-foreground">Total requisições</p></div>
        <div className="form-section p-3 text-center"><p className="text-2xl font-bold text-emerald-600">{stats.entregue}</p><p className="text-xs text-muted-foreground">Entregue</p></div>
        <div className="form-section p-3 text-center"><p className="text-2xl font-bold text-yellow-600">{stats.aguardando}</p><p className="text-xs text-muted-foreground">Aguardando</p></div>
        <div className="form-section p-3 text-center"><p className="text-sm font-bold truncate" title={stats.topMember}>{stats.topMember}</p><p className="text-xs text-muted-foreground">Mais requisitou</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="form-section p-3">
          <h3 className="text-xs font-semibold mb-2">Consumo por membro (entregue)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.byMember} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="form-section p-3">
          <h3 className="text-xs font-semibold mb-2">Consumo por item (entregue)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.byItem}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={50} interval={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="total" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]}>
                  {stats.byItem.map((_, i) => <Cell key={i} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <IndividualAnalysis rows={(data as any[]) || []} periodo={periodo} />


      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar usuário, item ou nº..." className="pl-9 h-9 text-xs" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40 h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="aguardando">Aguardando</SelectItem>
            <SelectItem value="entregue">Entregue</SelectItem>
            <SelectItem value="rejeitado">Rejeitado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {filtered.map((r: any) => {
          const cfg = statusConfig[r.status] || statusConfig.aguardando;
          const origemLabel = r.origem === "pedido_coletivo" ? "Pedido coletivo" : "Individual";
          return (
            <div key={r.id} className="border rounded-lg p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono text-muted-foreground">{r.numero || "—"}</span>
                <Badge variant="outline" className={`${cfg.color} text-[10px]`}>{cfg.label}</Badge>
              </div>
              <p className="text-sm font-medium">{r.item_name} <span className="text-xs text-muted-foreground">× {r.quantity}</span></p>
              <p className="text-xs">{r.user_name} <span className="text-muted-foreground">• {r.turno || "—"} • {origemLabel}</span></p>
              <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString("pt-BR")}</p>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-6 text-sm">Nenhuma requisição no período</p>}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Nº</TableHead>
              <TableHead className="text-xs">Usuário</TableHead>
              <TableHead className="text-xs">Turno</TableHead>
              <TableHead className="text-xs">Item</TableHead>
              <TableHead className="text-xs text-center">Qtd</TableHead>
              <TableHead className="text-xs">Data</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Origem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r: any) => {
              const cfg = statusConfig[r.status] || statusConfig.aguardando;
              const origemLabel = r.origem === "pedido_coletivo" ? "Pedido coletivo" : "Individual";
              return (
                <TableRow key={r.id}>
                  <TableCell className="text-xs font-mono text-muted-foreground">{r.numero || "—"}</TableCell>
                  <TableCell className="text-xs">{r.user_name}</TableCell>
                  <TableCell className="text-xs">{r.turno || "—"}</TableCell>
                  <TableCell className="text-sm">{r.item_name}</TableCell>
                  <TableCell className="text-center text-sm">{r.quantity}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell><Badge variant="outline" className={cfg.color}>{cfg.label}</Badge></TableCell>
                  <TableCell className="text-xs">{origemLabel}</TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6 text-sm">Nenhuma requisição no período</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

/* ───────────────────  HISTÓRICO INDIVIDUAL POR USUÁRIO  ─────────────────── */
export const HistoricoIndividual = () => {
  const { profile } = useAuth();
  const { isAdmin } = useUserRole();
  const role = getConsumivelRole(profile?.cargo, isAdmin);
  const isManager = role === "manager";

  const [periodo, setPeriodo] = useState<"30" | "90" | "180" | "365">("90");
  const [turnoFilter, setTurnoFilter] = useState<string>(isManager ? "all" : (profile?.turno || "all"));
  const [userFilter, setUserFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const dateFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - parseInt(periodo, 10));
    return d.toISOString();
  }, [periodo]);

  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["historico-individual", periodo, isManager ? "all" : profile?.turno],
    queryFn: async () => {
      let q = supabase.from("consumable_requests").select("*").gte("created_at", dateFrom).order("created_at", { ascending: false });
      if (!isManager && profile?.turno) q = q.eq("turno", profile.turno);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile,
  });

  // Unique users list from data
  const usersInData = useMemo(() => {
    const map = new Map<string, { id: string; name: string; turno: string }>();
    for (const r of data as any[]) {
      const key = r.user_id || r.user_name;
      if (!map.has(key)) map.set(key, { id: key, name: r.user_name || "—", turno: r.turno || "—" });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const filtered = useMemo(() => {
    let r = data as any[];
    if (turnoFilter !== "all") r = r.filter((x) => (x.turno || "") === turnoFilter);
    if (userFilter !== "all") r = r.filter((x) => (x.user_id || x.user_name) === userFilter);
    if (statusFilter !== "all") r = r.filter((x) => x.status === statusFilter);
    if (search.trim()) {
      const t = search.toLowerCase();
      r = r.filter((x) =>
        x.item_name?.toLowerCase().includes(t) ||
        x.user_name?.toLowerCase().includes(t) ||
        x.numero?.toLowerCase().includes(t)
      );
    }
    return r;
  }, [data, turnoFilter, userFilter, statusFilter, search]);

  const stats = useMemo(() => {
    const delivered = filtered.filter((r) => r.status === "entregue");
    const totalQtd = delivered.reduce((s, r) => s + (r.quantity || 0), 0);
    // por turno
    const turnoMap = new Map<string, number>();
    for (const r of delivered) {
      const k = r.turno || "—";
      turnoMap.set(k, (turnoMap.get(k) || 0) + (r.quantity || 0));
    }
    const byTurno = Array.from(turnoMap.entries()).map(([turno, total]) => ({ turno, total })).sort((a, b) => a.turno.localeCompare(b.turno));
    // por usuário
    const userMap = new Map<string, { name: string; total: number; pedidos: number }>();
    for (const r of delivered) {
      const key = r.user_id || r.user_name;
      const cur = userMap.get(key) || { name: r.user_name || "—", total: 0, pedidos: 0 };
      cur.total += r.quantity || 0;
      cur.pedidos += 1;
      userMap.set(key, cur);
    }
    const byUser = Array.from(userMap.values()).sort((a, b) => b.total - a.total).slice(0, 12);
    return {
      totalPedidos: filtered.length,
      totalQtd,
      usuariosAtivos: userMap.size,
      byTurno,
      byUser,
    };
  }, [filtered]);

  // Individual breakdown: top items per selected user (or per top users)
  const perUserBreakdown = useMemo(() => {
    const delivered = filtered.filter((r) => r.status === "entregue");
    const byUserItems = new Map<string, { name: string; items: Map<string, number>; total: number }>();
    for (const r of delivered) {
      const key = r.user_id || r.user_name;
      const bucket = byUserItems.get(key) || { name: r.user_name || "—", items: new Map(), total: 0 };
      bucket.items.set(r.item_name, (bucket.items.get(r.item_name) || 0) + (r.quantity || 0));
      bucket.total += r.quantity || 0;
      byUserItems.set(key, bucket);
    }
    return Array.from(byUserItems.entries())
      .map(([id, v]) => ({
        id,
        name: v.name,
        total: v.total,
        items: Array.from(v.items.entries()).map(([n, q]) => ({ name: n, qtd: q })).sort((a, b) => b.qtd - a.qtd),
      }))
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  const exportRowsData = useMemo(() => filtered.map((r: any) => ({
    Numero: r.numero || "",
    Usuario: r.user_name,
    Turno: r.turno || "",
    Item: r.item_name,
    Quantidade: r.quantity,
    Data: new Date(r.created_at).toLocaleDateString("pt-BR"),
    Status: statusConfig[r.status]?.label || r.status,
    Origem: r.origem === "pedido_coletivo" ? "Pedido coletivo" : "Individual",
  })), [filtered]);

  if (isLoading) return (
    <div className="space-y-4">
      <KpiSkeletons count={4} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
      <TableSkeleton rows={6} cols={5} />
    </div>
  );
  if (isError) return <RetryBox msg="Erro ao carregar histórico" onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-heading font-semibold">Histórico Individual por Usuário</h2>
          <p className="text-[11px] text-muted-foreground">
            {isManager
              ? "Visão coletiva, por turno e individual de todos os funcionários"
              : `Time do turno ${profile?.turno || "—"}`}
          </p>
        </div>
        <ExportButtons rows={exportRowsData} fileBase={`historico_consumo_${periodo}d`} />
      </div>

      {/* Filtros */}
      <div className="form-section p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Período</Label>
          <Select value={periodo} onValueChange={(v: any) => setPeriodo(v)}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="180">Últimos 6 meses</SelectItem>
              <SelectItem value="365">Último ano</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Turno</Label>
          <Select value={turnoFilter} onValueChange={setTurnoFilter} disabled={!isManager}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos turnos</SelectItem>
              <SelectItem value="A">Turno A</SelectItem>
              <SelectItem value="B">Turno B</SelectItem>
              <SelectItem value="C">Turno C</SelectItem>
              <SelectItem value="ADM">ADM</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Usuário</Label>
          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">Todos usuários ({usersInData.length})</SelectItem>
              {usersInData.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name} · {u.turno}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="aguardando">Aguardando</SelectItem>
              <SelectItem value="entregue">Entregue</SelectItem>
              <SelectItem value="rejeitado">Rejeitado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Buscar</Label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Item, usuário ou nº" className="h-9 text-xs pl-8" />
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="form-section p-3 text-center">
          <p className="text-2xl font-bold">{stats.totalPedidos}</p>
          <p className="text-xs text-muted-foreground">Pedidos no período</p>
        </div>
        <div className="form-section p-3 text-center">
          <p className="text-2xl font-bold text-emerald-600">{stats.totalQtd}</p>
          <p className="text-xs text-muted-foreground">Itens entregues</p>
        </div>
        <div className="form-section p-3 text-center">
          <p className="text-2xl font-bold">{stats.usuariosAtivos}</p>
          <p className="text-xs text-muted-foreground">Usuários ativos</p>
        </div>
        <div className="form-section p-3 text-center">
          <p className="text-sm font-bold truncate" title={stats.byUser[0]?.name || "—"}>{stats.byUser[0]?.name || "—"}</p>
          <p className="text-xs text-muted-foreground">Maior consumidor</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="form-section p-3">
          <h3 className="text-xs font-semibold mb-2">Consumo por turno (entregue)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.byTurno}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="turno" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]}>
                  {stats.byTurno.map((_, i) => <Cell key={i} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="form-section p-3">
          <h3 className="text-xs font-semibold mb-2">Top 12 usuários (qtd entregue)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.byUser} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="total" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Breakdown individual */}
      <div className="form-section p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold">Consumo por usuário (top itens)</h3>
          <Badge variant="outline" className="text-[10px]">{perUserBreakdown.length} usuário(s)</Badge>
        </div>
        {perUserBreakdown.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Nenhum consumo entregue no período</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto pr-1">
            {perUserBreakdown.map((u) => (
              <div key={u.id} className="border rounded-lg p-2.5 bg-card hover:bg-muted/40 transition-colors">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <p className="text-xs font-semibold truncate">{u.name}</p>
                  <Badge variant="outline" className="bg-primary/10 border-primary/30 text-primary text-[10px]">
                    {u.total} itens
                  </Badge>
                </div>
                <div className="space-y-0.5">
                  {u.items.slice(0, 5).map((it) => (
                    <div key={it.name} className="flex items-center justify-between text-[11px]">
                      <span className="truncate text-muted-foreground">{it.name}</span>
                      <span className="font-mono font-semibold ml-2">{it.qtd}</span>
                    </div>
                  ))}
                  {u.items.length > 5 && (
                    <p className="text-[10px] text-muted-foreground pt-1">+{u.items.length - 5} outro(s)</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Timeline / tabela */}
      <div className="form-section p-3 space-y-2">
        <h3 className="text-xs font-semibold">Timeline de pedidos ({filtered.length})</h3>
        <div className="md:hidden space-y-2 max-h-[500px] overflow-y-auto">
          {filtered.map((r: any) => {
            const cfg = statusConfig[r.status] || statusConfig.aguardando;
            return (
              <div key={r.id} className="border rounded-lg p-2.5 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground">{r.numero || "—"}</span>
                  <Badge variant="outline" className={`${cfg.color} text-[10px]`}>{cfg.label}</Badge>
                </div>
                <p className="text-xs font-medium">{r.item_name} <span className="text-muted-foreground">× {r.quantity}</span></p>
                <p className="text-[11px]">{r.user_name} <span className="text-muted-foreground">· {r.turno || "—"}</span></p>
                <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</p>
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-6 text-xs">Nenhum registro</p>}
        </div>
        <div className="hidden md:block overflow-x-auto max-h-[500px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="text-xs">Nº</TableHead>
                <TableHead className="text-xs">Data</TableHead>
                <TableHead className="text-xs">Usuário</TableHead>
                <TableHead className="text-xs">Turno</TableHead>
                <TableHead className="text-xs">Item</TableHead>
                <TableHead className="text-xs text-center">Qtd</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r: any) => {
                const cfg = statusConfig[r.status] || statusConfig.aguardando;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs font-mono text-muted-foreground">{r.numero || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-xs font-medium">{r.user_name}</TableCell>
                    <TableCell className="text-xs">{r.turno || "—"}</TableCell>
                    <TableCell className="text-xs">{r.item_name}</TableCell>
                    <TableCell className="text-center text-xs font-semibold">{r.quantity}</TableCell>
                    <TableCell><Badge variant="outline" className={`${cfg.color} text-[10px]`}>{cfg.label}</Badge></TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6 text-sm">Nenhum registro no período</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

