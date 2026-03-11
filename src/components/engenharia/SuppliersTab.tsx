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
import ExcelImportDialog, { ColumnMapping } from "./ExcelImportDialog";
import ExcelExportButton from "./ExcelExportButton";
import { ScrollArea } from "@/components/ui/scroll-area";

const SUPPLIER_COLUMNS: ColumnMapping[] = [
  { excelHeader: "Código", dbField: "code", label: "Código", required: true },
  { excelHeader: "Nome", dbField: "name", label: "Nome", required: true },
];

const SuppliersTab = () => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["eng-suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editId) {
        const { error } = await supabase.from("suppliers").update({ code, name }).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("suppliers").insert({ code, name });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eng-suppliers"] });
      toast.success(editId ? "Fornecedor atualizado!" : "Fornecedor criado!");
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eng-suppliers"] });
      toast.success("Fornecedor excluído!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("suppliers").update({ active: !active }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["eng-suppliers"] });
  };

  const resetForm = () => {
    setOpen(false);
    setEditId(null);
    setCode("");
    setName("");
  };

  const openEdit = (s: any) => {
    setEditId(s.id);
    setCode(s.code);
    setName(s.name);
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h2 className="text-lg font-heading font-semibold">Fornecedores</h2>
        <div className="flex flex-wrap gap-2">
          <ExcelExportButton
            data={suppliers}
            columns={[
              { header: "Código", key: "code" },
              { header: "Nome", key: "name" },
              { header: "Ativo", key: "active" },
            ]}
            fileName="fornecedores"
          />
          <ExcelImportDialog
            title="Fornecedores"
            columns={SUPPLIER_COLUMNS}
            checkDuplicates={async (rows) => {
              const codes = rows.map((r) => r.code);
              const { data } = await supabase.from("suppliers").select("code").in("code", codes);
              const existing = new Set((data || []).map((d) => d.code));
              return rows.map((r) => existing.has(r.code));
            }}
            onImport={async (rows) => {
              const { error } = await supabase.from("suppliers").upsert(
                rows.map((r) => ({ code: r.code, name: r.name })),
                { onConflict: "code" }
              );
              if (error) throw error;
              qc.invalidateQueries({ queryKey: ["eng-suppliers"] });
              toast.success(`${rows.length} fornecedor(es) importado(s)!`);
            }}
          />
          <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Novo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editId ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Código *</Label>
                  <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ex: FORN001" />
                </div>
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do fornecedor" />
                </div>
                <Button onClick={() => saveMutation.mutate()} disabled={!code || !name || saveMutation.isPending} className="w-full">
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
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden sm:table-cell">Ativo</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s) => (
                <TableRow key={s.id} className={!s.active ? "opacity-50" : ""}>
                  <TableCell className="font-mono text-xs sm:text-sm">{s.code}</TableCell>
                  <TableCell className="text-xs sm:text-sm">{s.name}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Switch checked={s.active} onCheckedChange={() => toggleActive(s.id, s.active)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}>
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
                            <AlertDialogTitle>Excluir fornecedor?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir "{s.name}"? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(s.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {suppliers.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum fornecedor cadastrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default SuppliersTab;
