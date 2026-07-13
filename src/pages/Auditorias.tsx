import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, ShieldCheck, BarChart3, Pencil, Trash2, CalendarClock, AlertTriangle } from "lucide-react";
import ReportErrorButton from "@/components/ReportErrorButton";
import { useUserRole } from "@/hooks/useUserRole";
import EngineeringMode from "@/components/EngineeringMode";
import MasterListFilter, { useListFilters, FilterConfig } from "@/components/MasterListFilter";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import logo from "@/assets/hyundai-mobis-logo.png";
import { useTranslation } from "react-i18next";

const STATUS_COLORS: Record<string, string> = {
  planejada: "bg-slate-500/15 text-slate-300 border border-slate-500/30",
  em_andamento: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  aguardando_fornecedor: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  respondida: "bg-violet-500/15 text-violet-300 border border-violet-500/30",
  concluida: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  atrasada: "bg-red-500/15 text-red-400 border border-red-500/30 animate-pulse",
};
const STATUS_LABELS: Record<string, string> = {
  planejada: "Planejada",
  em_andamento: "Em andamento",
  aguardando_fornecedor: "Aguardando fornecedor",
  respondida: "Respondida",
  concluida: "Concluída",
  atrasada: "Atrasada",
};
const TYPE_LABELS: Record<string, string> = {
  processo: "Processo", produto: "Produto", fornecedor: "Fornecedor",
};

const Auditorias = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const qc = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { search, setSearch, filterValues, handleFilterChange, clearFilters, matchesSearch, matchesFilters } = useListFilters();

  const { data: audits = [], isLoading } = useQuery({
    queryKey: ["audits-v2"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audits")
        .select("id, code, title, supplier_name, type, status, audit_date_start, audit_date_end, auditor_name, place, score")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: openNcCounts = {} } = useQuery({
    queryKey: ["audit-open-ncs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_ncs").select("audit_id, status");
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of data ?? []) {
        if (r.status !== "done") map[r.audit_id as string] = (map[r.audit_id as string] || 0) + 1;
      }
      return map;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("audits").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["audits-v2"] });
      toast.success("Auditoria excluída");
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filters: FilterConfig[] = useMemo(() => {
    const tipos = [...new Set(audits.map((a: any) => a.type).filter(Boolean))] as string[];
    const auditores = [...new Set(audits.map((a: any) => a.auditor_name).filter(Boolean))] as string[];
    const statuses = [...new Set(audits.map((a: any) => a.status).filter(Boolean))] as string[];
    return [
      { key: "type", label: "Tipo", options: tipos.map(x => ({ value: x, label: TYPE_LABELS[x] || x })) },
      { key: "auditor_name", label: "Auditor", options: auditores },
      { key: "status", label: "Status", options: statuses.map(x => ({ value: x, label: STATUS_LABELS[x] || x })) },
    ];
  }, [audits]);

  const filtered = useMemo(() => {
    return (audits as any[]).filter((a) =>
      matchesSearch(a, ["code", "title", "supplier_name", "auditor_name", "place"]) && matchesFilters(a)
    );
  }, [audits, search, filterValues]);

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <Button variant="ghost" onClick={() => navigate("/")} className="header-btn header-btn-back">
                <ArrowLeft className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">{t("common.hub")}</span>
              </Button>
              <img src={logo} alt="Hyundai Mobis" className="h-6 sm:h-8 object-contain bg-white rounded-md px-2 py-0.5" />
            </div>
            <div className="flex items-center gap-1">
              <ReportErrorButton moduleName="Auditorias" />
              {isAdmin && <EngineeringMode module="Auditorias" />}
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 mt-3 md:mt-4">
            <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8" />
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-heading font-bold">Auditorias</h1>
              <p className="text-primary-foreground/70 text-xs md:text-sm">
                Gestão completa de auditorias de fornecedores
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => navigate("/auditorias/nova")} className="gap-2">
            <Plus className="w-4 h-4" /> Nova Auditoria
          </Button>
          <Button
            variant="outline"
            onClick={() => toast.info("Agenda chega na Fase 4 do módulo.")}
            className="gap-2"
          >
            <CalendarClock className="w-4 h-4" /> Agenda
          </Button>
          <Button variant="outline" onClick={() => navigate("/auditorias/dashboard")} className="gap-2">
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

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="form-section text-center py-12">
            <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              {audits.length === 0 ? "Nenhuma auditoria cadastrada" : "Nenhum resultado"}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:gap-4">
            {filtered.map((a: any) => {
              const openNc = openNcCounts[a.id] || 0;
              return (
                <div
                  key={a.id}
                  className="form-section cursor-pointer hover:border-accent/30 transition-colors"
                  onClick={() => navigate(`/auditorias/${a.id}`)}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {a.code && (
                          <span className="text-xs font-mono text-muted-foreground bg-muted/20 px-2 py-0.5 rounded">
                            #{a.code}
                          </span>
                        )}
                        <h3 className="font-heading font-semibold text-foreground text-sm md:text-base">
                          {a.title}
                        </h3>
                        {openNc > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded">
                            <AlertTriangle className="w-3 h-3" /> {openNc} NC{openNc > 1 ? "s" : ""} aberta{openNc > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 md:gap-2 text-xs md:text-sm text-muted-foreground">
                        <span>Fornecedor: <span className="text-foreground">{a.supplier_name}</span></span>
                        {a.auditor_name && (<><span>•</span><span>Auditor: {a.auditor_name}</span></>)}
                        {a.audit_date_start && (
                          <>
                            <span>•</span>
                            <span>
                              {new Date(a.audit_date_start + "T12:00:00").toLocaleDateString("pt-BR")}
                              {a.audit_date_end && a.audit_date_end !== a.audit_date_start &&
                                ` → ${new Date(a.audit_date_end + "T12:00:00").toLocaleDateString("pt-BR")}`}
                            </span>
                          </>
                        )}
                        {a.place && (<><span>•</span><span>{a.place}</span></>)}
                      </div>
                    </div>
                    <div className="flex sm:flex-col items-center sm:items-end gap-1.5 shrink-0">
                      <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                        <span className={`status-badge ${STATUS_COLORS[a.status] || ""}`}>
                          {STATUS_LABELS[a.status] || a.status}
                        </span>
                        <span className="status-badge bg-card text-foreground border">
                          {TYPE_LABELS[a.type] || a.type}
                        </span>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-1 sm:mt-1">
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            onClick={(e) => { e.stopPropagation(); navigate(`/auditorias/editar/${a.id}`); }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); setDeleteId(a.id); }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Esta auditoria e todas as NCs relacionadas serão removidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Auditorias;
