import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Trash2, Loader2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

interface Empresa {
  id: string;
  name: string;
  active: boolean;
}

interface Props {
  trigger?: React.ReactNode;
}

const EmpresasTerceirasDialog = ({ trigger }: Props) => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ["empresas-terceiras"],
    queryFn: async (): Promise<Empresa[]> => {
      const { data, error } = await supabase
        .from("empresas_terceiras")
        .select("id, name, active")
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["empresas-terceiras"] });

  const handleAdd = async () => {
    const name = newName.trim().toUpperCase();
    if (!name) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("empresas_terceiras").insert({ name });
      if (error) throw error;
      toast.success("Empresa adicionada");
      setNewName("");
      refresh();
    } catch (e: any) {
      toast.error(e?.message?.includes("duplicate") ? "Empresa já existe" : "Erro ao adicionar");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (id: string) => {
    const name = editName.trim().toUpperCase();
    if (!name) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("empresas_terceiras").update({ name }).eq("id", id);
      if (error) throw error;
      toast.success("Atualizada");
      setEditId(null);
      refresh();
    } catch (e: any) {
      toast.error(e?.message?.includes("duplicate") ? "Empresa já existe" : "Erro ao atualizar");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (e: Empresa) => {
    const { error } = await supabase
      .from("empresas_terceiras")
      .update({ active: !e.active })
      .eq("id", e.id);
    if (error) toast.error("Erro");
    else { toast.success(!e.active ? "Ativada" : "Desativada"); refresh(); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("empresas_terceiras").delete().eq("id", deleteId);
      if (error) throw error;
      toast.success("Removida");
      setDeleteId(null);
      refresh();
    } catch (e: any) {
      toast.error("Erro ao remover");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger || (
            <Button size="sm" variant="outline" className="col-span-2 sm:col-span-1">
              <Building2 className="w-4 h-4 mr-1" /> Empresa
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-w-md w-[95vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Building2 className="w-4 h-4" />
              Empresas Terceiras
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: IL AUTOMOTIVE"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                className="h-9"
              />
              <Button size="sm" onClick={handleAdd} disabled={saving || !newName.trim()}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </Button>
            </div>

            <div className="border rounded-md divide-y max-h-[50vh] overflow-y-auto">
              {isLoading ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                </div>
              ) : empresas.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  Nenhuma empresa cadastrada
                </div>
              ) : (
                empresas.map((e) => (
                  <div key={e.id} className="flex items-center gap-2 p-2.5">
                    {editId === e.id ? (
                      <>
                        <Input
                          value={editName}
                          onChange={(ev) => setEditName(ev.target.value)}
                          className="h-8 text-sm flex-1"
                          autoFocus
                          onKeyDown={(ev) => ev.key === "Enter" && handleEdit(e.id)}
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(e.id)} disabled={saving}>
                          <Check className="w-4 h-4 text-emerald-600" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditId(null)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm font-medium truncate">{e.name}</span>
                        {!e.active && <Badge variant="outline" className="text-[10px]">Inativa</Badge>}
                        <Switch checked={e.active} onCheckedChange={() => handleToggleActive(e)} />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditId(e.id); setEditName(e.name); }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(e.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>

            <p className="text-[11px] text-muted-foreground">
              Use o switch para desativar uma empresa sem apagar. Empresas ativas aparecem no cadastro de novos usuários.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Usuários já cadastrados nessa empresa não serão afetados, mas ela não aparecerá mais em novos cadastros.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default EmpresasTerceirasDialog;
