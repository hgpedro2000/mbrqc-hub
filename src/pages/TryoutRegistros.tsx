import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2, Droplets, Paintbrush, Wrench, Plus, BarChart3, Eye, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import MasterListFilter, { useListFilters, FilterConfig } from "@/components/MasterListFilter";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import logo from "@/assets/hyundai-mobis-logo.png";
import ChecklistViewDialog from "@/components/tryout/ChecklistViewDialog";
import { useTranslation } from "react-i18next";

const TryoutRegistros = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; table: string } | null>(null);
  const [viewTarget, setViewTarget] = useState<{ id: string; type: "injection_checklists" | "painting_checklists" | "assembly_checklists" } | null>(null);
  const { search, setSearch, filterValues, handleFilterChange, clearFilters, matchesSearch, matchesFilters } = useListFilters();

  const { data: injectionData = [], isLoading: loadingInj } = useQuery({
    queryKey: ["injection-checklists"],
    queryFn: async () => { const { data, error } = await supabase.from("injection_checklists").select("id, numero, nome, data, fornecedor, part_number, part_name, projeto, modulo, created_by, created_at, status").order("created_at", { ascending: false }); if (error) throw error; return data; },
  });
  const { data: paintingData = [], isLoading: loadingPaint } = useQuery({
    queryKey: ["painting-checklists"],
    queryFn: async () => { const { data, error } = await supabase.from("painting_checklists").select("id, numero, nome, data, created_by, created_at, status").order("created_at", { ascending: false }); if (error) throw error; return data; },
  });
  const { data: assemblyData = [], isLoading: loadingAsm } = useQuery({
    queryKey: ["assembly-checklists"],
    queryFn: async () => { const { data, error } = await supabase.from("assembly_checklists").select("id, numero, nome, data, created_by, created_at, status").order("created_at", { ascending: false }); if (error) throw error; return data; },
  });

  const isLoading = loadingInj || loadingPaint || loadingAsm;

  const deleteMutation = useMutation({
    mutationFn: async ({ id, table }: { id: string; table: string }) => { await supabase.from("checklist_photos").delete().eq("checklist_id", id); const { error } = await supabase.from(table as any).delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success(t("tryout.deleteSuccess")); queryClient.invalidateQueries({ queryKey: ["injection-checklists"] }); queryClient.invalidateQueries({ queryKey: ["painting-checklists"] }); queryClient.invalidateQueries({ queryKey: ["assembly-checklists"] }); setDeleteTarget(null); },
    onError: (error: any) => toast.error(t("tryout.deleteError"), { description: error.message }),
  });

  const injFilters: FilterConfig[] = useMemo(() => {
    const projetos = [...new Set(injectionData.map((i) => i.projeto).filter(Boolean))] as string[];
    const fornecedores = [...new Set(injectionData.map((i) => i.fornecedor).filter(Boolean))] as string[];
    const usuarios = [...new Set(injectionData.map((i) => i.nome).filter(Boolean))] as string[];
    return [{ key: "projeto", label: t("supplierSelector.project"), options: projetos }, { key: "fornecedor", label: t("common.supplier"), options: fornecedores }, { key: "nome", label: t("common.name"), options: usuarios }];
  }, [injectionData, t]);

  const genericFilters: FilterConfig[] = useMemo(() => {
    const allNames = [...new Set([...paintingData.map((i) => i.nome), ...assemblyData.map((i) => i.nome)].filter(Boolean))] as string[];
    return [{ key: "nome", label: t("common.name"), options: allNames }];
  }, [paintingData, assemblyData, t]);

  const filteredInj = useMemo(() => injectionData.filter((i) => matchesSearch(i, ["numero", "nome", "part_number", "part_name", "fornecedor", "projeto"]) && matchesFilters(i)), [injectionData, search, filterValues]);
  const filteredPaint = useMemo(() => paintingData.filter((i) => matchesSearch(i, ["numero", "nome"]) && matchesFilters(i)), [paintingData, search, filterValues]);
  const filteredAsm = useMemo(() => assemblyData.filter((i) => matchesSearch(i, ["numero", "nome"]) && matchesFilters(i)), [assemblyData, search, filterValues]);

  const getEditPath = (table: string, id: string) => {
    if (table === "injection_checklists") return `/tryout/injecao/editar/${id}`;
    if (table === "painting_checklists") return `/tryout/pintura/editar/${id}`;
    return `/tryout/montagem/editar/${id}`;
  };

  const StatusBadge = ({ status }: { status?: string }) => {
    if (status === "draft") return <Badge variant="outline" className="border-yellow-500 text-yellow-600 bg-yellow-50">{t("common.draft")}</Badge>;
    return <Badge variant="outline" className="border-emerald-500 text-emerald-600 bg-emerald-50">{t("tryout.finalized") || "Finalizado"}</Badge>;
  };

  const EditActions = ({ id, table, createdBy, status }: { id: string; table: string; createdBy?: string | null; status?: string }) => {
    const isOwner = user && createdBy === user.id;
    const canEdit = isAdmin || isOwner;
    const isFinalized = status !== "draft";
    return (
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setViewTarget({ id, type: table as any }); }}><Eye className="w-3.5 h-3.5" /></Button>
        {isFinalized && <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:text-primary" onClick={(e) => { e.stopPropagation(); setViewTarget({ id, type: table as any }); }} title="Baixar PDF"><FileDown className="w-3.5 h-3.5" /></Button>}
        {canEdit && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(getEditPath(table, id))}><Pencil className="w-3.5 h-3.5" /></Button>}
        {isAdmin && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget({ id, table })}><Trash2 className="w-3.5 h-3.5" /></Button>}
      </div>
    );
  };

  const [activeTab, setActiveTab] = useState("injecao");

  const renderEmpty = (Icon: any, dataLen: number) => (
    <div className="form-section text-center py-12"><Icon className="w-12 h-12 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">{dataLen === 0 ? t("tryout.noRecords") : t("common.noResults")}</p></div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-3 md:px-4 py-4 md:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate("/tryout")} className="text-primary-foreground/70 hover:text-primary-foreground px-2"><ArrowLeft className="w-4 h-4 md:mr-1" /> <span className="hidden md:inline">{t("common.back")}</span></Button>
              <img src={logo} alt="Hyundai Mobis" className="h-6 md:h-8 object-contain bg-white rounded-md px-2 py-0.5" />
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 mt-3 md:mt-4">
            <Droplets className="w-6 h-6 md:w-8 md:h-8 shrink-0" />
            <div><h1 className="text-lg md:text-2xl font-heading font-bold">{t("tryout.recordsTitle")}</h1><p className="text-primary-foreground/70 text-xs md:text-sm">{t("tryout.recordsSubtitle")}</p></div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 md:px-4 py-4 md:py-6 space-y-4 md:space-y-6">
        <div className="flex flex-wrap gap-2 md:gap-3">
          <Button onClick={() => navigate("/tryout/injecao")} className="gap-2"><Plus className="w-4 h-4" /> {t("tryout.newChecklist")}</Button>
          <Button variant="outline" onClick={() => navigate("/tryout/dashboard")} className="gap-2"><BarChart3 className="w-4 h-4" /> {t("common.dashboard")}</Button>
        </div>

        <MasterListFilter searchValue={search} onSearchChange={setSearch} filters={activeTab === "injecao" ? injFilters : genericFilters} filterValues={filterValues} onFilterChange={handleFilterChange} onClearFilters={clearFilters} />

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); clearFilters(); }}>
          <TabsList className="grid w-full grid-cols-3 h-auto">
            <TabsTrigger value="injecao" className="gap-1 md:gap-2 text-xs md:text-sm px-1 md:px-3 py-2"><Droplets className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" /><span className="truncate">{t("tryout.injection.title")}</span><span className="hidden sm:inline">({injectionData.length})</span></TabsTrigger>
            <TabsTrigger value="pintura" className="gap-1 md:gap-2 text-xs md:text-sm px-1 md:px-3 py-2"><Paintbrush className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" /><span className="truncate">{t("tryout.painting.title")}</span><span className="hidden sm:inline">({paintingData.length})</span></TabsTrigger>
            <TabsTrigger value="montagem" className="gap-1 md:gap-2 text-xs md:text-sm px-1 md:px-3 py-2"><Wrench className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" /><span className="truncate">{t("tryout.assembly.title")}</span><span className="hidden sm:inline">({assemblyData.length})</span></TabsTrigger>
          </TabsList>

          <TabsContent value="injecao" className="mt-4">
            {isLoading ? <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" /></div>
            : filteredInj.length === 0 ? renderEmpty(Droplets, injectionData.length)
            : <div className="grid gap-4">{filteredInj.map((item) => (
              <div key={item.id} className="form-section hover:border-accent/30 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1 min-w-0">
                     <div className="flex items-center gap-2 flex-wrap">{item.numero && <span className="text-xs font-mono text-muted-foreground bg-muted/20 px-2 py-0.5 rounded">#{item.numero}</span>}<span className="font-heading font-semibold text-foreground">{item.part_number}</span><Badge variant="secondary">{item.fornecedor}</Badge><StatusBadge status={(item as any).status} /></div>
                     <p className="text-sm text-muted-foreground">{item.part_name} • {item.projeto}</p>
                     <div className="flex flex-wrap gap-2 text-xs text-muted-foreground"><span>{item.nome}</span><span>•</span><span>{new Date(item.data).toLocaleDateString("pt-BR")}</span></div>
                   </div>
                   <EditActions id={item.id} table="injection_checklists" createdBy={item.created_by} status={(item as any).status} />
                </div>
              </div>
            ))}</div>}
          </TabsContent>

          <TabsContent value="pintura" className="mt-4">
            {isLoading ? <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" /></div>
            : filteredPaint.length === 0 ? renderEmpty(Paintbrush, paintingData.length)
            : <div className="grid gap-4">{filteredPaint.map((item) => (
              <div key={item.id} className="form-section hover:border-accent/30 transition-colors">
                <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1 min-w-0"><div className="flex items-center gap-2">{item.numero && <span className="text-xs font-mono text-muted-foreground bg-muted/20 px-2 py-0.5 rounded">#{item.numero}</span>}<span className="font-heading font-semibold text-foreground">{item.nome}</span><StatusBadge status={(item as any).status} /></div><p className="text-xs text-muted-foreground">{new Date(item.data).toLocaleDateString("pt-BR")}</p></div>
                   <EditActions id={item.id} table="painting_checklists" createdBy={item.created_by} status={(item as any).status} />
                </div>
              </div>
            ))}</div>}
          </TabsContent>

          <TabsContent value="montagem" className="mt-4">
            {isLoading ? <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" /></div>
            : filteredAsm.length === 0 ? renderEmpty(Wrench, assemblyData.length)
            : <div className="grid gap-4">{filteredAsm.map((item) => (
              <div key={item.id} className="form-section hover:border-accent/30 transition-colors">
                <div className="flex items-start justify-between">
                   <div className="space-y-1 flex-1 min-w-0"><div className="flex items-center gap-2">{item.numero && <span className="text-xs font-mono text-muted-foreground bg-muted/20 px-2 py-0.5 rounded">#{item.numero}</span>}<span className="font-heading font-semibold text-foreground">{item.nome}</span><StatusBadge status={(item as any).status} /></div><p className="text-xs text-muted-foreground">{new Date(item.data).toLocaleDateString("pt-BR")}</p></div>
                   <EditActions id={item.id} table="assembly_checklists" createdBy={item.created_by} status={(item as any).status} />
                </div>
              </div>
            ))}</div>}
          </TabsContent>
        </Tabs>
      </main>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle><AlertDialogDescription>{t("tryout.deleteConfirm")}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}>{t("common.delete")}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ChecklistViewDialog open={!!viewTarget} onOpenChange={(open) => !open && setViewTarget(null)} checklistId={viewTarget?.id || null} checklistType={viewTarget?.type || "injection_checklists"} />
    </div>
  );
};

export default TryoutRegistros;
