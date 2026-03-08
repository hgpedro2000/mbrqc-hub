import { useNavigate } from "react-router-dom";
import { Droplets, Paintbrush, Wrench, ClipboardCheck, ArrowRight, LogOut, BarChart3, ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Badge } from "@/components/ui/badge";
import MasterListFilter, { useListFilters, FilterConfig } from "@/components/MasterListFilter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useState, useMemo } from "react";

const modules = [
  { id: "injecao", title: "Injeção Plástica", description: "Checklist para processo de injeção: matéria-prima, injetora, parâmetros dimensionais e melhorias.", icon: Droplets, path: "/tryout/injecao", stats: "19 campos", color: "from-blue-500/10 to-blue-600/5" },
  { id: "pintura", title: "Pintura", description: "Checklist para processo de pintura com upload de fotos e controle de qualidade.", icon: Paintbrush, path: "/tryout/pintura", stats: "Editável", color: "from-amber-500/10 to-orange-500/5" },
  { id: "montagem", title: "Montagem e Finalização", description: "Checklist para montagem final, verificação de acabamento e controle dimensional.", icon: Wrench, path: "/tryout/montagem", stats: "Editável", color: "from-emerald-500/10 to-green-500/5" },
];

const Index = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; table: string } | null>(null);
  const [activeTab, setActiveTab] = useState("injecao");
  const { search, setSearch, filterValues, handleFilterChange, clearFilters, matchesSearch, matchesFilters } = useListFilters();

  const { data: injectionData = [] } = useQuery({
    queryKey: ["injection-checklists"],
    queryFn: async () => {
      const { data, error } = await supabase.from("injection_checklists").select("id, numero, nome, data, fornecedor, part_number, part_name, projeto, modulo, created_at").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: paintingData = [] } = useQuery({
    queryKey: ["painting-checklists"],
    queryFn: async () => {
      const { data, error } = await supabase.from("painting_checklists").select("id, numero, nome, data, created_at").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: assemblyData = [] } = useQuery({
    queryKey: ["assembly-checklists"],
    queryFn: async () => {
      const { data, error } = await supabase.from("assembly_checklists").select("id, numero, nome, data, created_at").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, table }: { id: string; table: string }) => {
      await supabase.from("checklist_photos").delete().eq("checklist_id", id);
      const { error } = await supabase.from(table as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro excluído!");
      queryClient.invalidateQueries({ queryKey: ["injection-checklists"] });
      queryClient.invalidateQueries({ queryKey: ["painting-checklists"] });
      queryClient.invalidateQueries({ queryKey: ["assembly-checklists"] });
      setDeleteTarget(null);
    },
    onError: (error: any) => toast.error("Erro ao excluir", { description: error.message }),
  });

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
    return [{ key: "nome", label: "Usuário", options: allNames }];
  }, [paintingData, assemblyData]);

  const filteredInj = useMemo(() => injectionData.filter((i) => matchesSearch(i, ["numero", "nome", "part_number", "part_name", "fornecedor", "projeto"]) && matchesFilters(i)), [injectionData, search, filterValues]);
  const filteredPaint = useMemo(() => paintingData.filter((i) => matchesSearch(i, ["numero", "nome"]) && matchesFilters(i)), [paintingData, search, filterValues]);
  const filteredAsm = useMemo(() => assemblyData.filter((i) => matchesSearch(i, ["numero", "nome"]) && matchesFilters(i)), [assemblyData, search, filterValues]);

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

  const renderList = (data: any[], filtered: any[], table: string, Icon: any, hasRichData: boolean) => {
    if (filtered.length === 0) {
      return (
        <div className="form-section text-center py-8">
          <Icon className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">{data.length === 0 ? "Nenhum registro." : "Nenhum resultado encontrado."}</p>
        </div>
      );
    }
    return (
      <div className="grid gap-3">
        {filtered.map((item: any) => (
          <div key={item.id} className="form-section hover:border-accent/30 transition-colors">
            <div className="flex items-start justify-between">
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {item.numero && <span className="text-xs font-mono text-muted-foreground bg-muted/20 px-2 py-0.5 rounded">#{item.numero}</span>}
                  <span className="font-heading font-semibold text-foreground text-sm">{hasRichData ? item.part_number : item.nome}</span>
                  {hasRichData && <Badge variant="secondary" className="text-xs">{item.fornecedor}</Badge>}
                </div>
                {hasRichData && <p className="text-sm text-muted-foreground">{item.part_name} • {item.projeto}</p>}
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {hasRichData && <span>{item.nome}</span>}
                  {hasRichData && <span>•</span>}
                  <span>{new Date(item.data).toLocaleDateString("pt-BR")}</span>
                </div>
              </div>
              <AdminActions id={item.id} table={table} />
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-4 py-8 md:py-12">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                <ClipboardCheck className="w-5 h-5 text-accent-foreground" />
              </div>
              <span className="text-sm font-medium tracking-wider uppercase opacity-80">Try-Out Control</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10">
                <ArrowLeft className="w-4 h-4 mr-2" /> Hub
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/tryout/dashboard")} className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10">
                <BarChart3 className="w-4 h-4 mr-2" /> Dashboard
              </Button>
              <Button variant="ghost" size="sm" onClick={signOut} className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10">
                <LogOut className="w-4 h-4 mr-2" /> Sair
              </Button>
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-heading font-bold mt-4">Try-Out</h1>
          <p className="mt-2 text-primary-foreground/70 max-w-xl text-lg">Selecione o módulo do processo para iniciar o checklist.</p>
        </div>
      </header>

      <main className="container mx-auto px-4 -mt-6 pb-12 space-y-8">
        {/* Module cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {modules.map((mod, i) => (
            <div key={mod.id} className="module-card opacity-0 animate-fade-in" style={{ animationDelay: `${i * 100}ms` }} onClick={() => navigate(mod.path)}>
              <div className={`absolute inset-0 bg-gradient-to-br ${mod.color} pointer-events-none`} />
              <div className="relative">
                <div className="module-card-icon"><mod.icon className="w-7 h-7" /></div>
                <h2 className="text-xl font-heading font-semibold text-card-foreground mb-2">{mod.title}</h2>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">{mod.description}</p>
                <div className="flex items-center justify-between">
                  <span className="status-badge bg-secondary text-secondary-foreground">{mod.stats}</span>
                  <ArrowRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Master list / Registros */}
        <div>
          <h2 className="text-xl font-heading font-bold text-foreground mb-4">Registros</h2>

          <MasterListFilter
            searchValue={search}
            onSearchChange={setSearch}
            filters={activeTab === "injecao" ? injFilters : genericFilters}
            filterValues={filterValues}
            onFilterChange={handleFilterChange}
            onClearFilters={clearFilters}
          />

          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); clearFilters(); }} className="mt-4">
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

            <TabsContent value="injecao" className="mt-4">
              {renderList(injectionData, filteredInj, "injection_checklists", Droplets, true)}
            </TabsContent>
            <TabsContent value="pintura" className="mt-4">
              {renderList(paintingData, filteredPaint, "painting_checklists", Paintbrush, false)}
            </TabsContent>
            <TabsContent value="montagem" className="mt-4">
              {renderList(assemblyData, filteredAsm, "assembly_checklists", Wrench, false)}
            </TabsContent>
          </Tabs>
        </div>
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

export default Index;
