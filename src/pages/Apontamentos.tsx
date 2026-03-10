import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, FileBarChart, BarChart3, Pencil, Trash2 } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import EngineeringMode from "@/components/EngineeringMode";
import MasterListFilter, { useListFilters, FilterConfig } from "@/components/MasterListFilter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import logo from "@/assets/hyundai-mobis-logo.png";
<<<<<<< HEAD

const Apontamentos = () => {
=======
import { useTranslation } from "react-i18next";

const Apontamentos = () => {
  const { t } = useTranslation();
>>>>>>> 853a538787cf446c7d01e628ea96edf722a8086f
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const qc = useQueryClient();
  const [tab, setTab] = useState("defeito_processo");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { search, setSearch, filterValues, handleFilterChange, clearFilters, matchesSearch, matchesFilters } = useListFilters();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["apontamentos"],
<<<<<<< HEAD
    queryFn: async () => {
      const { data, error } = await supabase
        .from("apontamentos")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("apontamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["apontamentos"] });
      toast.success("Apontamento excluído com sucesso!");
      setDeleteId(null);
    },
=======
    queryFn: async () => { const { data, error } = await supabase.from("apontamentos").select("*").order("created_at", { ascending: false }); if (error) throw error; return data; },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("apontamentos").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["apontamentos"] }); toast.success(t("apontamentos.deleteSuccess")); setDeleteId(null); },
>>>>>>> 853a538787cf446c7d01e628ea96edf722a8086f
    onError: (e: any) => toast.error(e.message),
  });

  const filters: FilterConfig[] = useMemo(() => {
    const partNumbers = [...new Set(items.map((i) => i.part_number).filter(Boolean))] as string[];
    const responsaveis = [...new Set(items.map((i) => i.responsavel).filter(Boolean))] as string[];
    const statuses = [...new Set(items.map((i) => i.status).filter(Boolean))] as string[];
    return [
      { key: "part_number", label: "Part Number", options: partNumbers },
<<<<<<< HEAD
      { key: "responsavel", label: "Responsável", options: responsaveis },
      { key: "status", label: "Status", options: statuses },
    ];
  }, [items]);

  const filtered = useMemo(() => {
    return items
      .filter((i) => i.tipo === tab)
      .filter((i) =>
        matchesSearch(i, ["numero", "titulo", "responsavel", "part_number", "part_name", "descricao"]) &&
        matchesFilters(i)
      );
  }, [items, tab, search, filterValues]);

  const statusColors: Record<string, string> = {
    aberto: "bg-blue-500/10 text-blue-600",
    em_analise: "bg-amber-500/10 text-amber-600",
    acao_definida: "bg-violet-500/10 text-violet-600",
    concluido: "bg-emerald-500/10 text-emerald-600",
    cancelado: "bg-red-500/10 text-red-600",
  };
  const statusLabels: Record<string, string> = {
    aberto: "Aberto", em_analise: "Em Análise", acao_definida: "Ação Definida", concluido: "Concluído", cancelado: "Cancelado",
  };
  const severidadeColors: Record<string, string> = {
    baixa: "bg-emerald-500/10 text-emerald-600",
    media: "bg-amber-500/10 text-amber-600",
    alta: "bg-orange-500/10 text-orange-600",
    critica: "bg-red-500/10 text-red-600",
  };
=======
      { key: "responsavel", label: t("common.responsible"), options: responsaveis },
      { key: "status", label: t("common.status"), options: statuses },
    ];
  }, [items, t]);

  const filtered = useMemo(() => items.filter((i) => i.tipo === tab).filter((i) => matchesSearch(i, ["numero", "titulo", "responsavel", "part_number", "part_name", "descricao"]) && matchesFilters(i)), [items, tab, search, filterValues]);

  const statusColors: Record<string, string> = { aberto: "bg-blue-500/10 text-blue-600", em_analise: "bg-amber-500/10 text-amber-600", acao_definida: "bg-violet-500/10 text-violet-600", concluido: "bg-emerald-500/10 text-emerald-600", cancelado: "bg-red-500/10 text-red-600" };
  const severidadeColors: Record<string, string> = { baixa: "bg-emerald-500/10 text-emerald-600", media: "bg-amber-500/10 text-amber-600", alta: "bg-orange-500/10 text-orange-600", critica: "bg-red-500/10 text-red-600" };
>>>>>>> 853a538787cf446c7d01e628ea96edf722a8086f

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
<<<<<<< HEAD
              <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-primary-foreground/70 hover:text-primary-foreground">
                <ArrowLeft className="w-4 h-4 mr-1" /> Hub
              </Button>
=======
              <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-primary-foreground/70 hover:text-primary-foreground"><ArrowLeft className="w-4 h-4 mr-1" /> {t("common.hub")}</Button>
>>>>>>> 853a538787cf446c7d01e628ea96edf722a8086f
              <img src={logo} alt="Hyundai Mobis" className="h-8 object-contain bg-white rounded-md px-2 py-0.5" />
            </div>
            {isAdmin && <EngineeringMode module="Apontamentos" />}
          </div>
<<<<<<< HEAD
          <div className="flex items-center gap-3 mt-4">
            <FileBarChart className="w-8 h-8" />
            <div>
              <h1 className="text-2xl font-heading font-bold">Apontamentos</h1>
              <p className="text-primary-foreground/70 text-sm">Defeitos de processo, peças e paradas de linha</p>
            </div>
          </div>
=======
          <div className="flex items-center gap-3 mt-3 md:mt-4"><FileBarChart className="w-6 h-6 md:w-8 md:h-8" /><div><h1 className="text-xl md:text-2xl font-heading font-bold">{t("apontamentos.title")}</h1><p className="text-primary-foreground/70 text-xs md:text-sm">{t("apontamentos.subtitle")}</p></div></div>
>>>>>>> 853a538787cf446c7d01e628ea96edf722a8086f
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-wrap gap-3">
<<<<<<< HEAD
          <Button onClick={() => navigate("/apontamentos/novo")} className="gap-2">
            <Plus className="w-4 h-4" /> Novo Apontamento
          </Button>
          <Button variant="outline" onClick={() => navigate("/apontamentos/dashboard")} className="gap-2">
            <BarChart3 className="w-4 h-4" /> Dashboard
          </Button>
        </div>

        <MasterListFilter
          searchValue={search}
          onSearchChange={setSearch}
          filters={filters}
          filterValues={filterValues}
          onFilterChange={handleFilterChange}
          onClearFilters={clearFilters}
        />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="defeito_processo">Defeito Processo</TabsTrigger>
            <TabsTrigger value="defeito_peca">Defeito Peça</TabsTrigger>
            <TabsTrigger value="parada_linha">Parada de Linha</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="form-section text-center py-12">
                <FileBarChart className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum apontamento encontrado.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {filtered.map((item) => (
                  <div key={item.id} className="form-section hover:border-accent/30 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {item.numero && <span className="text-xs font-mono text-muted-foreground bg-muted/20 px-2 py-0.5 rounded">#{item.numero}</span>}
                          <h3 className="font-heading font-semibold text-foreground">{item.titulo}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">{item.descricao}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-1">
                          <span>Resp: {item.responsavel}</span>
                          <span>•</span>
                          <span>{new Date(item.data).toLocaleDateString("pt-BR")}</span>
                          {item.part_number && <><span>•</span><span>PN: {item.part_number}</span></>}
                          {item.quantidade && item.quantidade > 1 && <><span>•</span><span>Qtd: {item.quantidade}</span></>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`status-badge ${statusColors[item.status]}`}>{statusLabels[item.status]}</span>
                        <span className={`status-badge ${severidadeColors[item.severidade || "media"]}`}>{(item.severidade || "media").charAt(0).toUpperCase() + (item.severidade || "media").slice(1)}</span>
                        {isAdmin && (
                          <div className="flex gap-1 mt-2">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/apontamentos/editar/${item.id}`)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(item.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
=======
          <Button onClick={() => navigate("/apontamentos/novo")} className="gap-2"><Plus className="w-4 h-4" /> {t("apontamentos.newApontamento")}</Button>
          <Button variant="outline" onClick={() => navigate("/apontamentos/dashboard")} className="gap-2"><BarChart3 className="w-4 h-4" /> {t("common.dashboard")}</Button>
        </div>

        <MasterListFilter searchValue={search} onSearchChange={setSearch} filters={filters} filterValues={filterValues} onFilterChange={handleFilterChange} onClearFilters={clearFilters} />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="defeito_processo">{t("apontamentos.tabDefeitoProcesso")}</TabsTrigger>
            <TabsTrigger value="defeito_peca">{t("apontamentos.tabDefeitoPeca")}</TabsTrigger>
            <TabsTrigger value="parada_linha">{t("apontamentos.tabParadaLinha")}</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {isLoading ? (<div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" /></div>
            ) : filtered.length === 0 ? (<div className="form-section text-center py-12"><FileBarChart className="w-12 h-12 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">{t("apontamentos.noItems")}</p></div>
            ) : (
              <div className="grid gap-3 md:gap-4">
                {filtered.map((item) => (
                  <div key={item.id} className="form-section hover:border-accent/30 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {item.numero && <span className="text-xs font-mono text-muted-foreground bg-muted/20 px-2 py-0.5 rounded">#{item.numero}</span>}
                          <h3 className="font-heading font-semibold text-foreground text-sm md:text-base">{item.titulo}</h3>
                        </div>
                        <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">{item.descricao}</p>
                        <div className="flex flex-wrap gap-1.5 md:gap-2 text-[10px] md:text-xs text-muted-foreground mt-1">
                          <span>{t("common.responsible")}: {item.responsavel}</span><span>•</span><span>{new Date(item.data).toLocaleDateString("pt-BR")}</span>
                          {item.part_number && <><span>•</span><span>PN: {item.part_number}</span></>}
                          {item.quantidade && item.quantidade > 1 && <><span>•</span><span>{t("common.quantity")}: {item.quantidade}</span></>}
                        </div>
                      </div>
                      <div className="flex sm:flex-col items-center sm:items-end gap-1.5 shrink-0">
                        <span className={`status-badge ${statusColors[item.status]}`}>{t(`apontamentos.status.${item.status}`)}</span>
                        <span className={`status-badge ${severidadeColors[item.severidade || "media"]}`}>{t(`apontamentos.severity.${item.severidade || "media"}`)}</span>
                        {isAdmin && (
                          <div className="flex gap-1 sm:mt-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/apontamentos/editar/${item.id}`)}><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(item.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
>>>>>>> 853a538787cf446c7d01e628ea96edf722a8086f
                          </div>
                        )}
                      </div>
                    </div>
                    {(item.causa_raiz || item.acao_corretiva) && (
<<<<<<< HEAD
                      <div className="mt-3 pt-3 border-t border-border grid md:grid-cols-2 gap-3 text-sm">
                        {item.causa_raiz && <div><span className="text-muted-foreground font-medium">Causa Raiz:</span> {item.causa_raiz}</div>}
                        {item.acao_corretiva && <div><span className="text-muted-foreground font-medium">Ação Corretiva:</span> {item.acao_corretiva}</div>}
=======
                      <div className="mt-2 md:mt-3 pt-2 md:pt-3 border-t border-border grid md:grid-cols-2 gap-2 md:gap-3 text-xs md:text-sm">
                        {item.causa_raiz && <div><span className="text-muted-foreground font-medium">{t("apontamentos.rootCause")}:</span> {item.causa_raiz}</div>}
                        {item.acao_corretiva && <div><span className="text-muted-foreground font-medium">{t("apontamentos.correctiveAction")}:</span> {item.acao_corretiva}</div>}
>>>>>>> 853a538787cf446c7d01e628ea96edf722a8086f
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
<<<<<<< HEAD
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir este apontamento? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
=======
          <AlertDialogHeader><AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle><AlertDialogDescription>{t("apontamentos.deleteConfirm")}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t("common.delete")}</AlertDialogAction></AlertDialogFooter>
>>>>>>> 853a538787cf446c7d01e628ea96edf722a8086f
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Apontamentos;
