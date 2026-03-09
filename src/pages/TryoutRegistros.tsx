import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2, Droplets, Paintbrush, Wrench, Plus, BarChart3, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import MasterListFilter, { useListFilters, FilterConfig } from "@/components/MasterListFilter";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import logo from "@/assets/hyundai-mobis-logo.png";
import ChecklistViewDialog from "@/components/tryout/ChecklistViewDialog";

const TryoutRegistros = () => {
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; table: string } | null>(null);
  const [viewTarget, setViewTarget] = useState<{ id: string; type: "injection_checklists" | "painting_checklists" | "assembly_checklists" } | null>(null);
  const { search, setSearch, filterValues, handleFilterChange, clearFilters, matchesSearch, matchesFilters } = useListFilters();

  const { data: injectionData = [], isLoading: loadingInj } = useQuery({
    queryKey: ["injection-checklists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("injection_checklists")
        .select("id, numero, nome, data, fornecedor, part_number, part_name, projeto, modulo, created_by, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: paintingData = [], isLoading: loadingPaint } = useQuery({
    queryKey: ["painting-checklists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("painting_checklists")
        .select("id, numero, nome, data, created_by, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: assemblyData = [], isLoading: loadingAsm } = useQuery({
    queryKey: ["assembly-checklists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assembly_checklists")
        .select("id, numero, nome, data, created_by, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const isLoading = loadingInj || loadingPaint || loadingAsm;

  const deleteMutation = useMutation({
    mutationFn: async ({ id, table }: { id: string; table: string }) => {
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
    onError: (error: any) => toast.error("Erro ao excluir", { description: error.message }),
  });

  // Filters for injection tab (has richer data)
  const injFilters: FilterConfig[] = useMemo(() => {
    const projetos = [...new Set(injectionData.map((i) => i.projeto).filter(Boolean))] as string[];
    const fornecedores = [...new Set(injectionData.map((i) => i.fornecedor).filter(Boolean))] as string[];
    const usuarios = [...new Set(injectionData.map((i) => i.nome).filter(Boolean))] as string[];
    return [
      { key: "projeto", label: "Projeto", options: projetos },
      { key: "fornecedor", label: "Fornecedor", options: fornecedores },
      { key: "nome", label: "Usuário", options: usuarios },
    ];
  }, [injectionData]);

  const genericFilters: FilterConfig[] = useMemo(() => {
    const allNames = [...new Set([...paintingData.map((i) => i.nome), ...assemblyData.map((i) => i.nome)].filter(Boolean))] as string[];
    return [
      { key: "nome", label: "Usuário", options: allNames },
    ];
  }, [paintingData, assemblyData]);

  const filteredInj = useMemo(() => 
    injectionData.filter((i) =>
      matchesSearch(i, ["numero", "nome", "part_number", "part_name", "fornecedor", "projeto"]) && matchesFilters(i)
    ), [injectionData, search, filterValues]);

  const filteredPaint = useMemo(() =>
    paintingData.filter((i) =>
      matchesSearch(i, ["numero", "nome"]) && matchesFilters(i)
    ), [paintingData, search, filterValues]);

  const filteredAsm = useMemo(() =>
    assemblyData.filter((i) =>
      matchesSearch(i, ["numero", "nome"]) && matchesFilters(i)
    ), [assemblyData, search, filterValues]);

  const getEditPath = (table: string, id: string) => {
    if (table === "injection_checklists") return `/tryout/injecao/editar/${id}`;
    if (table === "painting_checklists") return `/tryout/pintura/editar/${id}`;
    return `/tryout/montagem/editar/${id}`;
  };

  const AdminActions = ({ id, table }: { id: string; table: string }) => {
    if (!isAdmin) return null;
    return (
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(getEditPath(table, id))}>
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget({ id, table })}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    );
  };

  const [activeTab, setActiveTab] = useState("injecao");

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-3 md:px-4 py-4 md:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate("/tryout")} className="text-primary-foreground/70 hover:text-primary-foreground px-2">
                <ArrowLeft className="w-4 h-4 md:mr-1" /> <span className="hidden md:inline">Voltar</span>
              </Button>
              <img src={logo} alt="Hyundai Mobis" className="h-6 md:h-8 object-contain bg-white rounded-md px-2 py-0.5" />
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 mt-3 md:mt-4">
            <Droplets className="w-6 h-6 md:w-8 md:h-8 shrink-0" />
            <div>
              <h1 className="text-lg md:text-2xl font-heading font-bold">Registros de Try-Out</h1>
              <p className="text-primary-foreground/70 text-xs md:text-sm">Lista mestra de checklists</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 md:px-4 py-4 md:py-6 space-y-4 md:space-y-6">
        <div className="flex flex-wrap gap-2 md:gap-3">
          <Button onClick={() => navigate("/tryout/injecao")} className="gap-2">
            <Plus className="w-4 h-4" /> Novo Checklist
          </Button>
          <Button variant="outline" onClick={() => navigate("/tryout/dashboard")} className="gap-2">
            <BarChart3 className="w-4 h-4" /> Dashboard
          </Button>
        </div>

        <MasterListFilter
          searchValue={search}
          onSearchChange={setSearch}
          filters={activeTab === "injecao" ? injFilters : genericFilters}
          filterValues={filterValues}
          onFilterChange={handleFilterChange}
          onClearFilters={clearFilters}
        />

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); clearFilters(); }}>
          <TabsList className="grid w-full grid-cols-3 h-auto">
            <TabsTrigger value="injecao" className="gap-1 md:gap-2 text-xs md:text-sm px-1 md:px-3 py-2">
              <Droplets className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" /> 
              <span className="truncate">Injeção</span>
              <span className="hidden sm:inline">({injectionData.length})</span>
            </TabsTrigger>
            <TabsTrigger value="pintura" className="gap-1 md:gap-2 text-xs md:text-sm px-1 md:px-3 py-2">
              <Paintbrush className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />
              <span className="truncate">Pintura</span>
              <span className="hidden sm:inline">({paintingData.length})</span>
            </TabsTrigger>
            <TabsTrigger value="montagem" className="gap-1 md:gap-2 text-xs md:text-sm px-1 md:px-3 py-2">
              <Wrench className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />
              <span className="truncate">Montagem</span>
              <span className="hidden sm:inline">({assemblyData.length})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="injecao" className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" /></div>
            ) : filteredInj.length === 0 ? (
              <div className="form-section text-center py-12">
                <Droplets className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">{injectionData.length === 0 ? "Nenhum registro de injeção." : "Nenhum resultado encontrado."}</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredInj.map((item) => (
                  <div key={item.id} className="form-section hover:border-accent/30 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {item.numero && <span className="text-xs font-mono text-muted-foreground bg-muted/20 px-2 py-0.5 rounded">#{item.numero}</span>}
                          <span className="font-heading font-semibold text-foreground">{item.part_number}</span>
                          <Badge variant="secondary">{item.fornecedor}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{item.part_name} • {item.projeto}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>{item.nome}</span>
                          <span>•</span>
                          <span>{new Date(item.data).toLocaleDateString("pt-BR")}</span>
                        </div>
                      </div>
                      <AdminActions id={item.id} table="injection_checklists" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pintura" className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" /></div>
            ) : filteredPaint.length === 0 ? (
              <div className="form-section text-center py-12">
                <Paintbrush className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">{paintingData.length === 0 ? "Nenhum registro de pintura." : "Nenhum resultado encontrado."}</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredPaint.map((item) => (
                  <div key={item.id} className="form-section hover:border-accent/30 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {item.numero && <span className="text-xs font-mono text-muted-foreground bg-muted/20 px-2 py-0.5 rounded">#{item.numero}</span>}
                          <span className="font-heading font-semibold text-foreground">{item.nome}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{new Date(item.data).toLocaleDateString("pt-BR")}</p>
                      </div>
                      <AdminActions id={item.id} table="painting_checklists" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="montagem" className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" /></div>
            ) : filteredAsm.length === 0 ? (
              <div className="form-section text-center py-12">
                <Wrench className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">{assemblyData.length === 0 ? "Nenhum registro de montagem." : "Nenhum resultado encontrado."}</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredAsm.map((item) => (
                  <div key={item.id} className="form-section hover:border-accent/30 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {item.numero && <span className="text-xs font-mono text-muted-foreground bg-muted/20 px-2 py-0.5 rounded">#{item.numero}</span>}
                          <span className="font-heading font-semibold text-foreground">{item.nome}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{new Date(item.data).toLocaleDateString("pt-BR")}</p>
                      </div>
                      <AdminActions id={item.id} table="assembly_checklists" />
                    </div>
                  </div>
                ))}
              </div>
            )}
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
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TryoutRegistros;
