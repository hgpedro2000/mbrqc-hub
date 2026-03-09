import { useState } from "react";
import { Settings, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDropdownOptions, useAddDropdownOption, useDeleteDropdownOption } from "@/hooks/useDropdownOptions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EngineeringModeProps {
  module: string;
}

const DropdownManager = ({ category, title }: { category: string; title: string }) => {
  const { data: options = [] } = useDropdownOptions(category);
  const addOption = useAddDropdownOption();
  const deleteOption = useDeleteDropdownOption();
  const [newLabel, setNewLabel] = useState("");

  const handleAdd = () => {
    if (!newLabel.trim()) return;
    const value = newLabel.trim().toLowerCase().replace(/\s+/g, "_");
    addOption.mutate(
      { category, label: newLabel.trim(), value, sort_order: options.length + 1 },
      {
        onSuccess: () => {
          setNewLabel("");
          toast.success("Item adicionado");
        },
        onError: () => toast.error("Erro ao adicionar"),
      }
    );
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-heading font-semibold text-foreground">{title}</h4>
      <div className="space-y-2">
        {options.map((opt) => (
          <div key={opt.id} className="flex items-center justify-between bg-muted/20 rounded-lg px-3 py-2">
            <span className="text-sm">{opt.label}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => deleteOption.mutate({ id: opt.id, category })}
              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Novo item..."
          className="text-sm"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <Button size="sm" onClick={handleAdd} disabled={!newLabel.trim()}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

const AuditItemManager = ({ auditType }: { auditType: string }) => {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: ["audit_items", auditType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_items")
        .select("*")
        .eq("audit_type", auditType)
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const [newCategory, setNewCategory] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const addItem = useMutation({
    mutationFn: async (item: { audit_type: string; category: string; description: string; sort_order: number }) => {
      const { error } = await supabase.from("audit_items").insert(item);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["audit_items", auditType] });
      setNewCategory("");
      setNewDescription("");
      toast.success("Item de auditoria adicionado");
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("audit_items").update({ active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["audit_items", auditType] }),
  });

  const categories = [...new Set(items.map((i) => i.category))];

  return (
    <div className="space-y-4">
      {categories.map((cat) => (
        <div key={cat}>
          <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{cat}</h5>
          {items
            .filter((i) => i.category === cat)
            .map((item) => (
              <div key={item.id} className="flex items-center justify-between bg-muted/20 rounded-lg px-3 py-2 mb-1">
                <span className="text-sm">{item.description}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteItem.mutate(item.id)}
                  className="h-6 w-6 p-0 text-destructive"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
        </div>
      ))}
      <div className="border-t pt-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="Categoria"
            className="text-sm"
          />
          <Input
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Descrição do item"
            className="text-sm"
          />
        </div>
        <Button
          size="sm"
          className="w-full"
          disabled={!newCategory.trim() || !newDescription.trim()}
          onClick={() =>
            addItem.mutate({
              audit_type: auditType,
              category: newCategory.trim(),
              description: newDescription.trim(),
              sort_order: items.length + 1,
            })
          }
        >
          <Plus className="w-4 h-4 mr-2" /> Adicionar Item
        </Button>
      </div>
    </div>
  );
};

const EngineeringMode = ({ module }: EngineeringModeProps) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="w-4 h-4" />
          Modo Engenharia
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto w-[95vw] md:w-full p-4 md:p-6">
        <DialogHeader>
          <DialogTitle className="font-heading text-base md:text-lg">Modo Engenharia — {module}</DialogTitle>
        </DialogHeader>

        {module === "Auditorias" && (
          <Tabs defaultValue="items_processo">
            <TabsList className="w-full grid grid-cols-2 md:grid-cols-4 h-auto">
              <TabsTrigger value="items_processo" className="text-xs md:text-sm px-2 py-1.5">Itens Processo</TabsTrigger>
              <TabsTrigger value="items_produto" className="text-xs md:text-sm px-2 py-1.5">Itens Produto</TabsTrigger>
              <TabsTrigger value="items_fornecedor" className="text-xs md:text-sm px-2 py-1.5">Itens Fornecedor</TabsTrigger>
              <TabsTrigger value="dropdowns" className="text-xs md:text-sm px-2 py-1.5">Dropdowns</TabsTrigger>
            </TabsList>
            <TabsContent value="items_processo" className="mt-4">
              <AuditItemManager auditType="processo" />
            </TabsContent>
            <TabsContent value="items_produto" className="mt-4">
              <AuditItemManager auditType="produto" />
            </TabsContent>
            <TabsContent value="items_fornecedor" className="mt-4">
              <AuditItemManager auditType="fornecedor" />
            </TabsContent>
            <TabsContent value="dropdowns" className="mt-4 space-y-6">
              <DropdownManager category="setor" title="Setores" />
              <DropdownManager category="linha" title="Linhas" />
            </TabsContent>
          </Tabs>
        )}

        {module !== "Auditorias" && (
          <Tabs defaultValue="dropdowns">
            <TabsList>
              <TabsTrigger value="dropdowns">Dropdowns</TabsTrigger>
            </TabsList>
            <TabsContent value="dropdowns" className="mt-4 space-y-6">
              <DropdownManager category="setor" title="Setores" />
              <DropdownManager category="linha" title="Linhas" />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EngineeringMode;
