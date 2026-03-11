import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Loader2, Trash2 } from "lucide-react";
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
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: [`eng-${tableName}`],
    queryFn: async () => {
      const { data, error } = await supabase.from(tableName).select("*").order("code");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editId) {
        const { error } = await supabase.from(tableName).update({ code, description }).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(tableName).insert({ code, description });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`eng-${tableName}`] });
      toast.success(editId ? "Atualizado!" : "Criado!");
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(tableName).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`eng-${tableName}`] });
      toast.success("Excluído!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from(tableName).update({ active: !active }).eq("id", id);
    qc.invalidateQueries({ queryKey: [`eng-${tableName}`] });
  };

  const resetForm = () => {
    setOpen(false);
    setEditId(null);
    setCode("");
    setDescription("");
  };

  const openEdit = (item: any) => {
    setEditId(item.id);
    setCode(item.code);
    setDescription(item.description);
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h2 className="text-lg font-heading font-semibold">{title}</h2>
        <div className="flex flex-wrap gap-2">
          <ExcelExportButton
            data={items}
            columns={[
              { header: codeLabel, key: "code" },
              { header: "Descrição", key: "description" },
              { header: "Ativo", key: "active" },
            ]}
            fileName={tableName}
          />
          <ExcelImportDialog
            title={title}
            columns={[
              { excelHeader: codeLabel, dbField: "code", label: codeLabel, required: true },
              { excelHeader: "Descrição", dbField: "description", label: "Descrição", required: true },
            ]}
            checkDuplicates={async (rows) => {
              const codes = rows.map((r) => r.code);
              const { data } = await supabase.from(tableName).select("code").in("code", codes);
              const existing = new Set((data || []).map((d: any) => d.code));
              return rows.map((r) => existing.has(r.code));
            }}
            onImport={async (rows) => {
              const { error } = await supabase.from(tableName).upsert(
                rows.map((r) => ({ code: r.code, description: r.description })),
                { onConflict: "code" }
              );
              if (error) throw error;
              qc.invalidateQueries({ queryKey: [`eng-${tableName}`] });
              toast.success(`${rows.length} item(s) importado(s)!`);
            }}
          />
          <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Novo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editId ? `Editar ${title}` : `Novo ${title}`}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{codeLabel} *</Label>
                  <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={codePlaceholder} />
                </div>
                <div className="space-y-2">
                  <Label>Descrição *</Label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição" />
                </div>
                <Button onClick={() => saveMutation.mutate()} disabled={!code || !description || saveMutation.isPending} className="w-full">
                  {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Salvar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="overflow-x-auto -mx-3 px-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{codeLabel}</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="hidden sm:table-cell">Ativo</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item: any) => (
                <TableRow key={item.id} className={!item.active ? "opacity-50" : ""}>
                  <TableCell className="font-mono text-xs sm:text-sm">{item.code}</TableCell>
                  <TableCell className="text-xs sm:text-sm">{item.description}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Switch checked={item.active} onCheckedChange={() => toggleActive(item.id, item.active)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir item?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir "{item.code} - {item.description}"? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(item.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum item cadastrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default CatalogTab;
