import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Loader2, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

interface Props {
  category: string;
  title: string;
  triggerLabel: string;
  placeholder?: string;
}

const DropdownOptionsDialog = ({ category, title, triggerLabel, placeholder }: Props) => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [label, setLabel] = useState("");

  const { data: options = [], isLoading } = useQuery({
    queryKey: ["dropdown_options_all", category],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dropdown_options")
        .select("*")
        .eq("category", category)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const reset = () => { setEditId(null); setLabel(""); };

  const save = useMutation({
    mutationFn: async () => {
      const value = label.trim();
      if (!value) throw new Error("Informe um valor");
      if (editId) {
        const { error } = await supabase
          .from("dropdown_options")
          .update({ label: value, value })
          .eq("id", editId);
        if (error) throw error;
      } else {
        const nextOrder = (options.reduce((m: number, o: any) => Math.max(m, o.sort_order || 0), 0) || 0) + 1;
        const { error } = await supabase
          .from("dropdown_options")
          .insert({ category, label: value, value, sort_order: nextOrder, active: true });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dropdown_options_all", category] });
      qc.invalidateQueries({ queryKey: ["dropdown_options", category] });
      toast.success(editId ? "Atualizado!" : "Adicionado!");
      reset();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("dropdown_options").update({ active: !active }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["dropdown_options_all", category] });
    qc.invalidateQueries({ queryKey: ["dropdown_options", category] });
  };

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dropdown_options").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dropdown_options_all", category] });
      qc.invalidateQueries({ queryKey: ["dropdown_options", category] });
      toast.success("Excluído!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); setOpen(v); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="col-span-2 sm:col-span-1">
          <Plus className="w-4 h-4 mr-1" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[95vw] sm:w-full max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label>{editId ? "Editar" : "Novo"}</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={placeholder || "Ex: SU2b"} />
            </div>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !label.trim()}>
              {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : editId ? "Salvar" : "Adicionar"}
            </Button>
            {editId && <Button variant="ghost" onClick={reset}>Cancelar</Button>}
          </div>

          <div className="border rounded-md divide-y">
            {isLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : options.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">Nenhum cadastrado</p>
            ) : (
              options.map((o: any) => (
                <div key={o.id} className={`flex items-center justify-between gap-2 px-3 py-2 ${!o.active ? "opacity-50" : ""}`}>
                  <span className="text-sm font-medium">{o.label}</span>
                  <div className="flex items-center gap-1">
                    <Switch checked={o.active} onCheckedChange={() => toggleActive(o.id, o.active)} />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditId(o.id); setLabel(o.label); }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir "{o.label}"?</AlertDialogTitle>
                          <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove.mutate(o.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DropdownOptionsDialog;
