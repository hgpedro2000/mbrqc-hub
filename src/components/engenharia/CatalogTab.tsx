import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Loader2, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import ExcelImportDialog from "./ExcelImportDialog";
import ExcelExportButton from "./ExcelExportButton";

interface CatalogTabProps {
  tableName: "defects" | "responsibilities" | "defect_categories";
  title: string;
  codeLabel: string;
  codePlaceholder: string;
}

const CatalogTab = ({ tableName, title, codeLabel, codePlaceholder }: CatalogTabProps) => {
  const qc = useQueryClient();
  const hasPt = tableName === "defects";
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionPt, setDescriptionPt] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: [`eng-${tableName}`],
    queryFn: async () => {
      const { data, error } = await supabase.from(tableName).select("*").order("code");
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const term = searchTerm.toLowerCase();
    return items.filter((i: any) =>
      i.code?.toLowerCase().includes(term) ||
      i.description?.toLowerCase().includes(term) ||
      (hasPt && i.description_pt?.toLowerCase().includes(term))
    );
  }, [items, searchTerm, hasPt]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { code, description };
      if (hasPt) payload.description_pt = descriptionPt || null;
      if (editId) { const { error } = await supabase.from(tableName).update(payload).eq("id", editId); if (error) throw error; }
      else { const { error } = await supabase.from(tableName).insert(payload); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [`eng-${tableName}`] }); toast.success(editId ? "Atualizado!" : "Criado!"); resetForm(); },
    onError: (e: any) => toast.error(e.message),
  });


  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from(tableName).delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [`eng-${tableName}`] }); toast.success("Excluído!"); },
    onError: (e: any) => toast.error(e.message),
  });

  const handleBulkDelete = async () => {
    for (const id of selectedIds) { await supabase.from(tableName).delete().eq("id", id); }
    toast.success(`${selectedIds.size} itens excluídos`);
    qc.invalidateQueries({ queryKey: [`eng-${tableName}`] });
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from(tableName).update({ active: !active }).eq("id", id);
    qc.invalidateQueries({ queryKey: [`eng-${tableName}`] });
  };

  const resetForm = () => { setOpen(false); setEditId(null); setCode(""); setDescription(""); setDescriptionPt(""); };
  const openEdit = (item: any) => { setEditId(item.id); setCode(item.code); setDescription(item.description); setDescriptionPt(item.description_pt || ""); setOpen(true); };

  const toggleSelect = (id: string) => { setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };

  return (
    <div className="space-y-4 w-full">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h2 className="text-base sm:text-lg font-heading font-semibold text-center sm:text-left">{title}</h2>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full sm:w-auto">
          {selectedIds.size > 0 && <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)} className="col-span-2 sm:col-span-1"><Trash2 className="w-4 h-4 mr-1" /> Excluir {selectedIds.size}</Button>}
          <ExcelExportButton
            data={items}
            columns={[
              { header: codeLabel, key: "code" },
              { header: hasPt ? "Descrição (EN)" : "Descrição", key: "description" },
              ...(hasPt ? [{ header: "Descrição (PT)", key: "description_pt" }] : []),
              { header: "Ativo", key: "active" },
            ]}
            fileName={tableName}
          />
          <ExcelImportDialog
            title={title}
            columns={[
              { excelHeader: codeLabel, dbField: "code", label: codeLabel, required: true },
              { excelHeader: hasPt ? "Descrição (EN)" : "Descrição", dbField: "description", label: hasPt ? "Descrição (EN)" : "Descrição", required: true },
              ...(hasPt ? [{ excelHeader: "Descrição (PT)", dbField: "description_pt", label: "Descrição (PT)", required: false }] : []),
            ]}
            checkDuplicates={async (rows) => { const codes = rows.map((r) => r.code); const { data } = await supabase.from(tableName).select("code").in("code", codes); const existing = new Set((data || []).map((d: any) => d.code)); return rows.map((r) => existing.has(r.code)); }}
            onImport={async (rows) => {
              const payload = rows.map((r) => hasPt
                ? { code: r.code, description: r.description, description_pt: r.description_pt || null }
                : { code: r.code, description: r.description });
              const { error } = await supabase.from(tableName).upsert(payload, { onConflict: "code" });
              if (error) throw error;
              qc.invalidateQueries({ queryKey: [`eng-${tableName}`] });
              toast.success(`${rows.length} item(s) importado(s)!`);
            }}
          />
          <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
            <DialogTrigger asChild><Button size="sm" className="col-span-2 sm:col-span-1"><Plus className="w-4 h-4 mr-1" /> Novo</Button></DialogTrigger>
            <DialogContent className="w-[95vw] sm:w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editId ? `Editar ${title}` : `Novo ${title}`}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><Label>{codeLabel} *</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={codePlaceholder} /></div>
                <div className="space-y-2"><Label>{hasPt ? "Descrição (EN) *" : "Descrição *"}</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={hasPt ? "Description in English" : "Descrição"} /></div>
                {hasPt && (
                  <div className="space-y-2"><Label>Descrição (PT)</Label><Input value={descriptionPt} onChange={(e) => setDescriptionPt(e.target.value)} placeholder="Descrição em Português" /></div>
                )}
                <Button onClick={() => saveMutation.mutate()} disabled={!code || !description || saveMutation.isPending} className="w-full">{saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>

        </div>
      </div>

      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar por código ou descrição..." className="pl-9" /></div>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir {selectedIds.size} itens?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="block sm:hidden space-y-2">
            {filtered.map((item: any) => (
              <div key={item.id} className={`border rounded-lg p-3 flex justify-between items-start gap-2 ${!item.active ? "opacity-50" : ""}`}>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-medium">{item.code}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                  {hasPt && item.description_pt && (
                    <p className="text-xs text-foreground/80 truncate">{item.description_pt}</p>
                  )}

                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button></AlertDialogTrigger>
                    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir?</AlertDialogTitle><AlertDialogDescription>Excluir "{item.code}"?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(item.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">Nenhum item encontrado</p>}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto -mx-3 px-3 pl-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 pl-3"><Checkbox checked={filtered.length > 0 && filtered.every((i: any) => selectedIds.has(i.id))} onCheckedChange={() => { const allIds = filtered.map((i: any) => i.id); setSelectedIds(allIds.every((id) => selectedIds.has(id)) ? new Set() : new Set(allIds)); }} /></TableHead>
                  <TableHead>{codeLabel}</TableHead>
                  <TableHead>{hasPt ? "Descrição (EN)" : "Descrição"}</TableHead>
                  {hasPt && <TableHead>Descrição (PT)</TableHead>}
                  <TableHead>Ativo</TableHead>
                  <TableHead className="w-20"></TableHead>

                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item: any) => (
                  <TableRow key={item.id} className={!item.active ? "opacity-50" : ""}>
                    <TableCell className="pl-3" onClick={(e) => e.stopPropagation()}><Checkbox checked={selectedIds.has(item.id)} onCheckedChange={() => toggleSelect(item.id)} /></TableCell>
                    <TableCell className="font-mono text-xs">{item.code}</TableCell>
                    <TableCell className="text-xs">{item.description}</TableCell>
                    {hasPt && <TableCell className="text-xs">{item.description_pt || <span className="text-muted-foreground italic">—</span>}</TableCell>}
                    <TableCell><Switch checked={item.active} onCheckedChange={() => toggleActive(item.id, item.active)} /></TableCell>

                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}><Pencil className="w-4 h-4" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger>
                          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir?</AlertDialogTitle><AlertDialogDescription>Excluir "{item.code}"?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(item.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (<TableRow><TableCell colSpan={hasPt ? 6 : 5} className="text-center text-muted-foreground py-8">Nenhum item encontrado</TableCell></TableRow>)}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
};

export default CatalogTab;
