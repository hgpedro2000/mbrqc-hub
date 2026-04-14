import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Loader2, Trash2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import ExcelImportDialog, { ColumnMapping } from "./ExcelImportDialog";
import ExcelExportButton from "./ExcelExportButton";

const SUPPLIER_COLUMNS: ColumnMapping[] = [
  { excelHeader: "Código", dbField: "code", label: "Código", required: true },
  { excelHeader: "Nome", dbField: "name", label: "Nome", required: true },
];

const ORIGEM_OPTIONS = ["LP", "CKD", "CONSIGNADA"];

const SuppliersTab = () => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [origem, setOrigem] = useState("LP");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["eng-suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return suppliers;
    const term = searchTerm.toLowerCase();
    return suppliers.filter((s) => s.code?.toLowerCase().includes(term) || s.name?.toLowerCase().includes(term));
  }, [suppliers, searchTerm]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editId) {
        const { error } = await supabase.from("suppliers").update({ code, name, origem } as any).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("suppliers").insert({ code, name, origem } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["eng-suppliers"] }); toast.success(editId ? "Fornecedor atualizado!" : "Fornecedor criado!"); resetForm(); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("suppliers").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["eng-suppliers"] }); toast.success("Fornecedor excluído!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const handleBulkDelete = async () => {
    for (const id of selectedIds) {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) { toast.error(error.message); return; }
    }
    toast.success(`${selectedIds.size} fornecedores excluídos`);
    qc.invalidateQueries({ queryKey: ["eng-suppliers"] });
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("suppliers").update({ active: !active }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["eng-suppliers"] });
  };

  const resetForm = () => { setOpen(false); setEditId(null); setCode(""); setName(""); setOrigem("LP"); };

  const openEdit = (s: any) => { setEditId(s.id); setCode(s.code); setName(s.name); setOrigem((s as any).origem || "LP"); setOpen(true); };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h2 className="text-lg font-heading font-semibold">Fornecedores</h2>
        <div className="flex flex-wrap gap-2">
          {selectedIds.size > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
              <Trash2 className="w-4 h-4 mr-1" /> Excluir {selectedIds.size}
            </Button>
          )}
          <ExcelExportButton data={suppliers.map((s: any) => ({ ...s, origem: s.origem || "LP" }))} columns={[{ header: "Código", key: "code" }, { header: "Nome", key: "name" }, { header: "Origem", key: "origem" }, { header: "Ativo", key: "active" }]} fileName="fornecedores" />
          <ExcelImportDialog title="Fornecedores" columns={SUPPLIER_COLUMNS}
            checkDuplicates={async (rows) => { const codes = rows.map((r) => r.code); const { data } = await supabase.from("suppliers").select("code").in("code", codes); const existing = new Set((data || []).map((d) => d.code)); return rows.map((r) => existing.has(r.code)); }}
            onImport={async (rows) => { const { error } = await supabase.from("suppliers").upsert(rows.map((r) => ({ code: r.code, name: r.name })), { onConflict: "code" }); if (error) throw error; qc.invalidateQueries({ queryKey: ["eng-suppliers"] }); toast.success(`${rows.length} fornecedor(es) importado(s)!`); }}
          />
          <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> Novo</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editId ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><Label>Código *</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ex: FORN001" /></div>
                <div className="space-y-2"><Label>Nome *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do fornecedor" /></div>
                <div className="space-y-2">
                  <Label>Origem *</Label>
                  <Select value={origem} onValueChange={setOrigem}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ORIGEM_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button onClick={() => saveMutation.mutate()} disabled={!code || !name || saveMutation.isPending} className="w-full">{saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar por código ou nome..." className="pl-9" />
      </div>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir {selectedIds.size} fornecedores?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="block sm:hidden space-y-2">
            {filtered.map((s: any) => (
              <div key={s.id} className={`border rounded-lg p-3 flex justify-between items-start gap-2 ${!s.active ? "opacity-50" : ""}`}>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{s.name}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="font-mono text-xs text-muted-foreground">{s.code}</span>
                    <Badge variant="outline" className={`text-[10px] ${
                      s.origem === "CKD" ? "border-purple-400 text-purple-600 bg-purple-500/10" :
                      s.origem === "CONSIGNADA" ? "border-orange-400 text-orange-600 bg-orange-500/10" :
                      "border-blue-400 text-blue-600 bg-blue-500/10"
                    }`}>{s.origem || "LP"}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button></AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Excluir fornecedor?</AlertDialogTitle><AlertDialogDescription>Tem certeza que deseja excluir "{s.name}"?</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(s.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">Nenhum fornecedor encontrado</p>}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto -mx-3 px-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={filtered.length > 0 && filtered.every((s) => selectedIds.has(s.id))} onCheckedChange={() => {
                      const allIds = filtered.map((s) => s.id);
                      setSelectedIds(allIds.every((id) => selectedIds.has(id)) ? new Set() : new Set(allIds));
                    }} />
                  </TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s: any) => (
                  <TableRow key={s.id} className={!s.active ? "opacity-50" : ""}>
                    <TableCell onClick={(e) => e.stopPropagation()}><Checkbox checked={selectedIds.has(s.id)} onCheckedChange={() => toggleSelect(s.id)} /></TableCell>
                    <TableCell className="font-mono text-xs">{s.code}</TableCell>
                    <TableCell className="text-xs">{s.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        s.origem === "CKD" ? "border-purple-400 text-purple-600 bg-purple-500/10" :
                        s.origem === "CONSIGNADA" ? "border-orange-400 text-orange-600 bg-orange-500/10" :
                        "border-blue-400 text-blue-600 bg-blue-500/10"
                      }>{s.origem || "LP"}</Badge>
                    </TableCell>
                    <TableCell><Switch checked={s.active} onCheckedChange={() => toggleActive(s.id, s.active)} /></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}><Pencil className="w-4 h-4" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Excluir fornecedor?</AlertDialogTitle><AlertDialogDescription>Tem certeza que deseja excluir "{s.name}"?</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(s.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (<TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum fornecedor encontrado</TableCell></TableRow>)}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
};

export default SuppliersTab;
