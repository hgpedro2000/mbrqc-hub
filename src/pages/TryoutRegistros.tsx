import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2, Droplets, Paintbrush, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

const TryoutRegistros = () => {
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; table: string } | null>(null);

  const { data: injectionData = [] } = useQuery({
    queryKey: ["injection-checklists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("injection_checklists")
        .select("id, nome, data, fornecedor, part_number, part_name, projeto, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: paintingData = [] } = useQuery({
    queryKey: ["painting-checklists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("painting_checklists")
        .select("id, nome, data, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: assemblyData = [] } = useQuery({
    queryKey: ["assembly-checklists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assembly_checklists")
        .select("id, nome, data, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, table }: { id: string; table: string }) => {
      // Delete related photos first
      await supabase.from("checklist_photos").delete().eq("checklist_id", id);
      const { error } = await supabase.from(table as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro excluído com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["injection-checklists"] });
      queryClient.invalidateQueries({ queryKey: ["painting-checklists"] });
      queryClient.invalidateQueries({ queryKey: ["assembly-checklists"] });
      setDeleteTarget(null);
    },
    onError: (error: any) => {
      toast.error("Erro ao excluir", { description: error.message });
    },
  });

  const getEditPath = (table: string, id: string) => {
    if (table === "injection_checklists") return `/tryout/injecao/editar/${id}`;
    if (table === "painting_checklists") return `/tryout/pintura/editar/${id}`;
    return `/tryout/montagem/editar/${id}`;
  };

  const AdminActions = ({ id, table }: { id: string; table: string }) => {
    if (!isAdmin) return null;
    return (
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(getEditPath(table, id))}>
          <Pencil className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget({ id, table })}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-4 py-6">
          <button
            onClick={() => navigate("/tryout")}
            className="flex items-center gap-2 text-primary-foreground/70 hover:text-primary-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Voltar</span>
          </button>
          <h1 className="text-2xl md:text-3xl font-heading font-bold">Registros de Try-Out</h1>
          <p className="text-primary-foreground/70 text-sm mt-1">Visualize todos os checklists enviados</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <Tabs defaultValue="injecao">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="injecao" className="gap-2">
              <Droplets className="w-4 h-4" /> Injeção ({injectionData.length})
            </TabsTrigger>
            <TabsTrigger value="pintura" className="gap-2">
              <Paintbrush className="w-4 h-4" /> Pintura ({paintingData.length})
            </TabsTrigger>
            <TabsTrigger value="montagem" className="gap-2">
              <Wrench className="w-4 h-4" /> Montagem ({assemblyData.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="injecao" className="space-y-3 mt-4">
            {injectionData.length === 0 && <p className="text-muted-foreground text-center py-8">Nenhum registro de injeção.</p>}
            {injectionData.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{item.part_number}</span>
                      <Badge variant="secondary">{item.fornecedor}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{item.part_name} • {item.projeto}</p>
                    <p className="text-xs text-muted-foreground">{item.nome} — {item.data}</p>
                  </div>
                  <AdminActions id={item.id} table="injection_checklists" />
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="pintura" className="space-y-3 mt-4">
            {paintingData.length === 0 && <p className="text-muted-foreground text-center py-8">Nenhum registro de pintura.</p>}
            {paintingData.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{item.nome}</p>
                    <p className="text-xs text-muted-foreground">Data: {item.data}</p>
                  </div>
                  <AdminActions id={item.id} table="painting_checklists" />
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="montagem" className="space-y-3 mt-4">
            {assemblyData.length === 0 && <p className="text-muted-foreground text-center py-8">Nenhum registro de montagem.</p>}
            {assemblyData.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{item.nome}</p>
                    <p className="text-xs text-muted-foreground">Data: {item.data}</p>
                  </div>
                  <AdminActions id={item.id} table="assembly_checklists" />
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </main>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir este checklist? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TryoutRegistros;
