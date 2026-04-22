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
import { toast } from "sonner";
import ExcelImportDialog, { ColumnMapping } from "./ExcelImportDialog";
import ExcelExportButton from "./ExcelExportButton";

const PN_COLUMNS: ColumnMapping[] = [
  { excelHeader: "Fornecedor (Código)", dbField: "supplier_code", label: "Fornecedor", required: true },
  { excelHeader: "Part Number", dbField: "part_number", label: "Part Number", required: true },
  { excelHeader: "Part Name", dbField: "part_name", label: "Part Name", required: true },
  { excelHeader: "Projeto", dbField: "project", label: "Projeto" },
  { excelHeader: "Módulo de Linha", dbField: "line_module", label: "Módulo" },
  { excelHeader: "ALC Code", dbField: "alc_code", label: "ALC Code" },
];

const PartNumbersTab = () => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [partName, setPartName] = useState("");
  const [project, setProject] = useState("");
  const [lineModule, setLineModule] = useState("");
  const [alcCode, setAlcCode] = useState("N/A");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const { data: suppliers = [] } = useQuery({
    queryKey: ["eng-suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id, code, name").eq("active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: partNumbers = [], isLoading } = useQuery({
    queryKey: ["eng-part-numbers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("part_numbers").select("*, suppliers(name, code)").order("part_number");
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return partNumbers;
    const term = searchTerm.toLowerCase();
    return partNumbers.filter((p: any) =>
      p.part_number?.toLowerCase().includes(term) || p.part_name?.toLowerCase().includes(term) || p.suppliers?.name?.toLowerCase().includes(term) || p.project?.toLowerCase().includes(term) || p.alc_code?.toLowerCase().includes(term)
    );
  }, [partNumbers, searchTerm]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { supplier_id: supplierId, part_number: partNumber, part_name: partName, project, line_module: lineModule, alc_code: alcCode } as any;
      if (editId) { const { error } = await supabase.from("part_numbers").update(payload).eq("id", editId); if (error) throw error; }
      else { const { error } = await supabase.from("part_numbers").insert(payload); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["eng-part-numbers"] }); toast.success(editId ? "Atualizado!" : "Criado!"); resetForm(); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("part_numbers").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["eng-part-numbers"] }); toast.success("Excluído!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const handleBulkDelete = async () => {
    for (const id of selectedIds) { await supabase.from("part_numbers").delete().eq("id", id); }
    toast.success(`${selectedIds.size} part numbers excluídos`);
    qc.invalidateQueries({ queryKey: ["eng-part-numbers"] });
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("part_numbers").update({ active: !active }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["eng-part-numbers"] });
  };

  const resetForm = () => { setOpen(false); setEditId(null); setSupplierId(""); setPartNumber(""); setPartName(""); setProject(""); setLineModule(""); setAlcCode("N/A"); };
  const openEdit = (p: any) => { setEditId(p.id); setSupplierId(p.supplier_id); setPartNumber(p.part_number); setPartName(p.part_name); setProject(p.project); setLineModule(p.line_module); setAlcCode(p.alc_code || "N/A"); setOpen(true); };
  const toggleSelect = (id: string) => { setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h2 className="text-lg font-heading font-semibold">Part Numbers</h2>
        <div className="flex flex-wrap gap-2">
          {selectedIds.size > 0 && <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}><Trash2 className="w-4 h-4 mr-1" /> Excluir {selectedIds.size}</Button>}
          <ExcelExportButton data={partNumbers.map((p: any) => ({ supplier_code: p.suppliers?.code || "", supplier_name: p.suppliers?.name || "", part_number: p.part_number, part_name: p.part_name, project: p.project, line_module: p.line_module, alc_code: p.alc_code || "N/A", active: p.active }))} columns={[{ header: "Fornecedor (Código)", key: "supplier_code" }, { header: "Fornecedor (Nome)", key: "supplier_name" }, { header: "Part Number", key: "part_number" }, { header: "Part Name", key: "part_name" }, { header: "Projeto", key: "project" }, { header: "Módulo", key: "line_module" }, { header: "ALC Code", key: "alc_code" }, { header: "Ativo", key: "active" }]} fileName="part_numbers" />
          <ExcelImportDialog title="Part Numbers" columns={PN_COLUMNS}
            checkDuplicates={async (rows) => { const pns = rows.map((r) => r.part_number); const { data } = await supabase.from("part_numbers").select("part_number").in("part_number", pns); const existing = new Set((data || []).map((d) => d.part_number)); return rows.map((r) => existing.has(r.part_number)); }}
            onImport={async (rows) => { const codes = [...new Set(rows.map((r) => r.supplier_code))]; const { data: suppData } = await supabase.from("suppliers").select("id, code").in("code", codes); const codeToId = new Map((suppData || []).map((s) => [s.code, s.id])); const toInsert = rows.filter((r) => codeToId.has(r.supplier_code)).map((r) => ({ supplier_id: codeToId.get(r.supplier_code)!, part_number: r.part_number, part_name: r.part_name, project: r.project || "", line_module: r.line_module || "", alc_code: r.alc_code || "N/A" })); const skipped = rows.length - toInsert.length; if (toInsert.length === 0) throw new Error("Nenhum fornecedor encontrado."); const { error } = await supabase.from("part_numbers").upsert(toInsert, { onConflict: "part_number" }); if (error) throw error; qc.invalidateQueries({ queryKey: ["eng-part-numbers"] }); toast.success(`${toInsert.length} importado(s)!${skipped > 0 ? ` ${skipped} ignorado(s).` : ""}`); }}
          />
          <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> Novo</Button></DialogTrigger>
            <DialogContent className="w-[95vw] sm:w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editId ? "Editar Part Number" : "Novo Part Number"}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><Label>Fornecedor *</Label><Select value={supplierId} onValueChange={setSupplierId}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Part Number *</Label><Input value={partNumber} onChange={(e) => setPartNumber(e.target.value)} placeholder="Ex: ABC-12345" /></div>
                <div className="space-y-2"><Label>Part Name *</Label><Input value={partName} onChange={(e) => setPartName(e.target.value)} placeholder="Nome da peça" /></div>
                <div className="space-y-2"><Label>Projeto</Label><Input value={project} onChange={(e) => setProject(e.target.value)} placeholder="Nome do projeto" /></div>
                <div className="space-y-2"><Label>Módulo de Linha</Label><Input value={lineModule} onChange={(e) => setLineModule(e.target.value)} placeholder="Módulo" /></div>
                <div className="space-y-2"><Label>ALC Code</Label><Input value={alcCode} onChange={(e) => setAlcCode(e.target.value)} placeholder="N/A" /></div>
                <Button onClick={() => saveMutation.mutate()} disabled={!supplierId || !partNumber || !partName || saveMutation.isPending} className="w-full">{saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar por part number, nome, fornecedor, ALC..." className="pl-9" /></div>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir {selectedIds.size} part numbers?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="block sm:hidden space-y-2">
            {filtered.map((p: any) => (
              <div key={p.id} className={`border rounded-lg p-3 flex justify-between items-start gap-2 ${!p.active ? "opacity-50" : ""}`}>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-medium">{p.part_number}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.part_name}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{p.suppliers?.name || "—"}</p>
                  {p.project && <p className="text-[10px] text-muted-foreground mt-0.5">{p.project} {p.line_module ? `• ${p.line_module}` : ""}</p>}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button></AlertDialogTrigger>
                    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir?</AlertDialogTitle><AlertDialogDescription>Excluir "{p.part_number}"?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(p.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">Nenhum part number encontrado</p>}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto -mx-3 px-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"><Checkbox checked={filtered.length > 0 && filtered.every((p: any) => selectedIds.has(p.id))} onCheckedChange={() => { const allIds = filtered.map((p: any) => p.id); setSelectedIds(allIds.every((id) => selectedIds.has(id)) ? new Set() : new Set(allIds)); }} /></TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Part Number</TableHead>
                  <TableHead className="hidden md:table-cell">Part Name</TableHead>
                  <TableHead className="hidden lg:table-cell">Projeto</TableHead>
                  <TableHead className="hidden lg:table-cell">Módulo</TableHead>
                  <TableHead className="hidden lg:table-cell">ALC</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p: any) => (
                  <TableRow key={p.id} className={!p.active ? "opacity-50" : ""}>
                    <TableCell onClick={(e) => e.stopPropagation()}><Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} /></TableCell>
                    <TableCell className="text-xs">{p.suppliers?.name || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{p.part_number}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs">{p.part_name}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs">{p.project || "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs">{p.line_module || "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs font-mono">{p.alc_code || "N/A"}</TableCell>
                    <TableCell><Switch checked={p.active} onCheckedChange={() => toggleActive(p.id, p.active)} /></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}><Pencil className="w-4 h-4" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger>
                          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir?</AlertDialogTitle><AlertDialogDescription>Excluir "{p.part_number}"?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(p.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (<TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhum part number encontrado</TableCell></TableRow>)}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
};

export default PartNumbersTab;
