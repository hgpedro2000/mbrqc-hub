import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, ShieldAlert, BarChart3, Pencil, Trash2, Clock, Calendar, LayoutList, LayoutGrid } from "lucide-react";
import ReportErrorButton from "@/components/ReportErrorButton";
import { useUserRole } from "@/hooks/useUserRole";
import EngineeringMode from "@/components/EngineeringMode";
import MasterListFilter, { useListFilters, FilterConfig } from "@/components/MasterListFilter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import logo from "@/assets/hyundai-mobis-logo.png";
import { useTranslation } from "react-i18next";
import ResumoMensalCard from "@/components/contencao/ResumoMensalCard";
import ContencaoDetalheDrawer from "@/components/contencao/ContencaoDetalheDrawer";
import ContencaoFotosStrip from "@/components/contencao/ContencaoFotosStrip";
import { STATUS_META, normalizeStatus, computeDiasAndamento, formatHoras, formatRelativeBR } from "@/lib/contencao";

interface UltimoRegistro {
  contencao_id: string;
  turno: string;
  created_at: string;
}

const Contencao = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const qc = useQueryClient();
  const [tab, setTab] = useState<string>("todos");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detalheItem, setDetalheItem] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<"compact" | "expanded">(() => (localStorage.getItem("contencao:viewMode") as any) || "compact");
  useEffect(() => { localStorage.setItem("contencao:viewMode", viewMode); }, [viewMode]);
  const { search, setSearch, filterValues, handleFilterChange, clearFilters, matchesSearch, matchesFilters } = useListFilters();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["contencao"],
    queryFn: async () => { const { data, error } = await supabase.from("contencao").select("*").order("created_at", { ascending: false }); if (error) throw error; return data; },
  });

  const { data: registrosAgg = { ultimo: {}, totais: {} } } = useQuery<{
    ultimo: Record<string, UltimoRegistro>;
    totais: Record<string, { insp: number; ng: number; ok: number }>;
  }>({
    queryKey: ["contencao-ultimos-registros"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contencao_registros" as any)
        .select("contencao_id, turno, created_at, qtd_inspecionada, qtd_diferenca, qtd_ng, qtd_ok")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ultimo: Record<string, UltimoRegistro> = {};
      const totais: Record<string, { insp: number; ng: number; ok: number }> = {};
      for (const r of (data || []) as any[]) {
        if (!ultimo[r.contencao_id]) ultimo[r.contencao_id] = r;
        const t = totais[r.contencao_id] || { insp: 0, ng: 0, ok: 0 };
        t.insp += Number(r.qtd_inspecionada || 0) + Number(r.qtd_diferenca || 0);
        t.ng += Number(r.qtd_ng || 0);
        t.ok += Number(r.qtd_ok || 0);
        totais[r.contencao_id] = t;
      }
      return { ultimo, totais };
    },
  });
  const ultimoPorContencao = registrosAgg.ultimo;
  const totaisPorContencao = registrosAgg.totais;


  // Realtime: refresh list when registros or contencao change
  useEffect(() => {
    const channel = supabase
      .channel("contencao-list-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "contencao" }, () => {
        qc.invalidateQueries({ queryKey: ["contencao"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "contencao_registros" }, () => {
        qc.invalidateQueries({ queryKey: ["contencao-ultimos-registros"] });
        qc.invalidateQueries({ queryKey: ["contencao"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("contencao").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contencao"] }); toast.success(t("contencao.deleteSuccess")); setDeleteId(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const filters: FilterConfig[] = useMemo(() => {
    const partNumbers = [...new Set(items.map((i) => i.part_number).filter(Boolean))] as string[];
    const responsaveis = [...new Set(items.map((i) => i.responsavel).filter(Boolean))] as string[];
    const statuses = [...new Set(items.map((i) => normalizeStatus(i.status)))] as string[];
    return [
      { key: "part_number", label: "Part Number", options: partNumbers },
      { key: "responsavel", label: t("common.responsible"), options: responsaveis },
      { key: "status", label: t("common.status"), options: statuses },
    ];
  }, [items, t]);

  const filtered = useMemo(
    () => items
      .filter((i) => tab === "todos" ? true : i.tipo === tab)
      .filter((i) => matchesSearch(i, ["numero", "titulo", "responsavel", "part_number", "part_name", "fornecedor", "local"]) && matchesFilters(i)),
    [items, tab, search, filterValues, matchesSearch, matchesFilters],
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-primary-foreground/70 hover:text-primary-foreground px-2"><ArrowLeft className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">{t("common.hub")}</span></Button>
              <img src={logo} alt="Hyundai Mobis" className="h-6 sm:h-8 object-contain bg-white rounded-md px-2 py-0.5" />
            </div>
            <div className="flex items-center gap-1">
              <ReportErrorButton moduleName="Contenção" />
              {isAdmin && <EngineeringMode module="Contenção" />}
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 mt-3 md:mt-4"><ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8" /><div><h1 className="text-lg sm:text-xl md:text-2xl font-heading font-bold">{t("contencao.title")}</h1><p className="text-primary-foreground/70 text-xs md:text-sm">{t("contencao.subtitle")}</p></div></div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <ResumoMensalCard />

        <div className="flex flex-wrap gap-3 items-center">
          <Button onClick={() => navigate("/contencao/nova")} className="gap-2"><Plus className="w-4 h-4" /> {t("contencao.newContencao")}</Button>
          <Button variant="outline" onClick={() => navigate("/contencao/dashboard")} className="gap-2"><BarChart3 className="w-4 h-4" /> {t("common.dashboard")}</Button>
          <div className="ml-auto inline-flex rounded-md border border-border overflow-hidden">
            <button type="button" onClick={() => setViewMode("compact")} className={`px-3 py-1.5 text-xs inline-flex items-center gap-1 ${viewMode === "compact" ? "bg-accent text-accent-foreground" : "bg-background text-muted-foreground hover:bg-muted/40"}`} title="Compacto"><LayoutList className="w-3.5 h-3.5" /> Compacto</button>
            <button type="button" onClick={() => setViewMode("expanded")} className={`px-3 py-1.5 text-xs inline-flex items-center gap-1 border-l border-border ${viewMode === "expanded" ? "bg-accent text-accent-foreground" : "bg-background text-muted-foreground hover:bg-muted/40"}`} title="Expandido"><LayoutGrid className="w-3.5 h-3.5" /> Expandido</button>
          </div>
        </div>

        <MasterListFilter searchValue={search} onSearchChange={setSearch} filters={filters} filterValues={filterValues} onFilterChange={handleFilterChange} onClearFilters={clearFilters} />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="fornecedor_lp">Fornecedor LP</TabsTrigger>
            <TabsTrigger value="fornecedor_ckd">Fornecedor CKD</TabsTrigger>
            <TabsTrigger value="processo_mbr">Processo MBR</TabsTrigger>
            <TabsTrigger value="processo_hmb">Processo HMB</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {isLoading ? (<div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" /></div>
            ) : filtered.length === 0 ? (<div className="form-section text-center py-12"><ShieldAlert className="w-12 h-12 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">{t("contencao.noItems")}</p></div>
            ) : (
              <div className="grid gap-3 md:gap-4">
                {filtered.map((item) => {
                  const st = normalizeStatus(item.status);
                  const meta = STATUS_META[st];
                  const dias = (item as any).dias_andamento ?? computeDiasAndamento(item.created_at, (item as any).data_conclusao, st);
                  const concluida = st === "concluida";
                  const agg = (totaisPorContencao as any)[item.id] || { insp: 0, ng: 0, ok: 0 };
                  const estoque = Number(item.quantidade_aprovada || 0);
                  const contidas = Number(item.quantidade_contida || 0) || estoque;
                  const inspecionado = agg.insp;
                  const ng = agg.ng;
                  const denom = estoque > 0 ? estoque : Math.max(inspecionado, 1);
                  const inspPct = Math.min(100, (inspecionado / denom) * 100);
                  const ngPct = inspecionado > 0 ? (ng / inspecionado) * 100 : 0;
                  const ultimo = (ultimoPorContencao as any)[item.id];
                  return (
                    <div
                      key={item.id}
                      className="form-section hover:border-accent/40 transition-colors cursor-pointer"
                      onClick={() => setDetalheItem(item)}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {item.numero && <span className="text-xs font-mono text-muted-foreground bg-muted/20 px-2 py-0.5 rounded">#{item.numero}</span>}
                            <h3 className="font-heading font-semibold text-foreground text-sm md:text-base">{item.titulo}</h3>
                          </div>
                          <div className="flex flex-wrap gap-1.5 md:gap-2 text-xs md:text-sm text-muted-foreground">
                            <span>{t("common.responsible")}: {item.responsavel}</span><span>•</span><span>{new Date(item.data).toLocaleDateString("pt-BR")}</span>
                            {item.part_number && <><span>•</span><span>PN: {item.part_number}</span></>}
                            {(item as any).local && <><span>•</span><span>📍 {(item as any).local}</span></>}
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-1">
                            <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> {concluida ? `Concluída em ${dias} dia${dias === 1 ? "" : "s"}` : `${dias} dia${dias === 1 ? "" : "s"} em andamento`}</span>
                            <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {formatHoras((item as any).total_horas)} registradas</span>
                            {ultimo && <span>Último: {ultimo.turno} — {formatRelativeBR(ultimo.created_at)}</span>}
                          </div>
                          {item.motivo && <p className="text-xs md:text-sm text-muted-foreground mt-1 line-clamp-2">{t("contencao.reason")}: {item.motivo}</p>}
                        </div>
                        <div className="flex sm:flex-col items-center sm:items-end gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.badge}`}>{meta.label}</span>
                          {isAdmin && (
                            <div className="flex gap-1 sm:mt-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/contencao/editar/${item.id}`)}><Pencil className="w-3.5 h-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(item.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                            </div>
                          )}
                        </div>
                      </div>
                      {viewMode === "compact" ? (
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-[auto,1fr] gap-3 md:gap-4 items-start">
                          <div className="flex flex-col gap-1 text-xs md:text-sm border border-border/60 rounded-md p-2 bg-muted/10 min-w-[160px]">
                            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">{estoque > 0 ? "Peças" : "Peças"}</span><span className="font-semibold tabular-nums">{estoque > 0 ? estoque : contidas || "—"}</span></div>
                            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Inspecionadas</span><span className="font-semibold text-sky-600 dark:text-sky-400 tabular-nums">{inspecionado}</span></div>
                            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">NG</span><span className="font-semibold text-red-600 tabular-nums">{ng}</span></div>
                            {(inspecionado > 0 || estoque > 0) && (
                              <div className="mt-1 h-1.5 w-full rounded-full bg-muted overflow-hidden flex">
                                <div className="h-full bg-sky-500" style={{ width: `${inspPct}%` }} />
                                <div className="h-full bg-red-500" style={{ width: `${(ngPct * inspPct) / 100}%`, marginLeft: `-${(ngPct * inspPct) / 100}%` }} />
                              </div>
                            )}
                          </div>
                          <ContencaoFotosStrip fotosProblema={(item as any).fotos_problema} fotosMarkCheck={(item as any).mark_check_fotos} size="sm" />
                        </div>
                      ) : (
                        <>
                          <div className="mt-2 md:mt-3 grid grid-cols-3 gap-2 md:gap-4 text-xs md:text-sm">
                            <div><span className="text-muted-foreground">{estoque > 0 ? "Estoque" : "Peças"}:</span> <span className="font-semibold">{estoque > 0 ? estoque : contidas || "—"}</span></div>
                            <div><span className="text-muted-foreground">Inspecionadas:</span> <span className="font-semibold text-sky-600 dark:text-sky-400">{inspecionado}</span></div>
                            <div><span className="text-muted-foreground">NG:</span> <span className="font-semibold text-red-600">{ng}</span></div>
                          </div>
                          {(inspecionado > 0 || estoque > 0) && (
                            <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden flex">
                              <div className="h-full bg-sky-500" style={{ width: `${inspPct}%` }} />
                              <div className="h-full bg-red-500" style={{ width: `${(ngPct * inspPct) / 100}%`, marginLeft: `-${(ngPct * inspPct) / 100}%` }} />
                            </div>
                          )}
                          <ContencaoFotosStrip fotosProblema={(item as any).fotos_problema} fotosMarkCheck={(item as any).mark_check_fotos} size="md" />
                        </>
                      )}
                    </div>
                  );
                })}

              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <ContencaoDetalheDrawer contencao={detalheItem} onClose={() => setDetalheItem(null)} />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle><AlertDialogDescription>{t("contencao.deleteConfirm")}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t("common.delete")}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Contencao;
