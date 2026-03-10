import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, ShieldCheck, BarChart3, Pencil, Trash2 } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import EngineeringMode from "@/components/EngineeringMode";
import MasterListFilter, { useListFilters, FilterConfig } from "@/components/MasterListFilter";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import logo from "@/assets/hyundai-mobis-logo.png";
import { useTranslation } from "react-i18next";

const Auditorias = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const qc = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { search, setSearch, filterValues, handleFilterChange, clearFilters, matchesSearch, matchesFilters } = useListFilters();

  const { data: auditorias = [], isLoading } = useQuery({
    queryKey: ["auditorias"],
    queryFn: async () => {
      const { data, error } = await supabase.from("auditorias").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("audit_responses").delete().eq("auditoria_id", id);
      const { error } = await supabase.from("auditorias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auditorias"] });
      toast.success(t("auditorias.deleteSuccess"));
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filters: FilterConfig[] = useMemo(() => {
    const tipos = [...new Set(auditorias.map((a) => a.tipo).filter(Boolean))] as string[];
    const auditores = [...new Set(auditorias.map((a) => a.auditor).filter(Boolean))] as string[];
    const statuses = [...new Set(auditorias.map((a) => a.status).filter(Boolean))] as string[];
    return [
      { key: "tipo", label: t("common.type"), options: tipos },
      { key: "auditor", label: t("auditorias.auditor"), options: auditores },
      { key: "status", label: t("common.status"), options: statuses },
    ];
  }, [auditorias, t]);

  const filtered = useMemo(() => {
    return auditorias.filter((a) =>
      matchesSearch(a, ["numero", "titulo", "auditor", "setor", "fornecedor"]) && matchesFilters(a)
    );
  }, [auditorias, search, filterValues]);

  const statusColors: Record<string, string> = {
    aberta: "bg-blue-500/10 text-blue-600",
    em_andamento: "bg-amber-500/10 text-amber-600",
    concluida: "bg-emerald-500/10 text-emerald-600",
    cancelada: "bg-red-500/10 text-red-600",
  };
  const tipoLabels: Record<string, string> = {
    processo: t("auditorias.process"), produto: t("auditorias.product"), fornecedor: t("auditorias.supplierType"),
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-primary-foreground/70 hover:text-primary-foreground">
                <ArrowLeft className="w-4 h-4 mr-1" /> {t("common.hub")}
              </Button>
              <img src={logo} alt="Hyundai Mobis" className="h-8 object-contain bg-white rounded-md px-2 py-0.5" />
            </div>
            {isAdmin && <EngineeringMode module="Auditorias" />}
          </div>
          <div className="flex items-center gap-3 mt-3 md:mt-4">
            <ShieldCheck className="w-6 h-6 md:w-8 md:h-8" />
            <div>
              <h1 className="text-xl md:text-2xl font-heading font-bold">{t("auditorias.title")}</h1>
              <p className="text-primary-foreground/70 text-xs md:text-sm">{t("auditorias.subtitle")}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => navigate("/auditorias/nova")} className="gap-2">
            <Plus className="w-4 h-4" /> {t("auditorias.newAudit")}
          </Button>
          <Button variant="outline" onClick={() => navigate("/auditorias/dashboard")} className="gap-2">
            <BarChart3 className="w-4 h-4" /> {t("common.dashboard")}
          </Button>
        </div>

        <MasterListFilter searchValue={search} onSearchChange={setSearch} filters={filters} filterValues={filterValues} onFilterChange={handleFilterChange} onClearFilters={clearFilters} />

        {isLoading ? (
          <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" /></div>
        ) : filtered.length === 0 ? (
          <div className="form-section text-center py-12">
            <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">{auditorias.length === 0 ? t("auditorias.noAudits") : t("common.noResults")}</p>
          </div>
        ) : (
          <div className="grid gap-3 md:gap-4">
            {filtered.map((a) => (
              <div key={a.id} className="form-section cursor-pointer hover:border-accent/30 transition-colors" onClick={() => navigate(`/auditorias/${a.id}`)}>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {a.numero && <span className="text-xs font-mono text-muted-foreground bg-muted/20 px-2 py-0.5 rounded">#{a.numero}</span>}
                      <h3 className="font-heading font-semibold text-foreground text-sm md:text-base">{a.titulo}</h3>
                    </div>
                    <div className="flex flex-wrap gap-1.5 md:gap-2 text-xs md:text-sm text-muted-foreground">
                      <span>{t("auditorias.auditor")}: {a.auditor}</span>
                      <span>•</span>
                      <span>{new Date(a.data).toLocaleDateString("pt-BR")}</span>
                      {a.setor && <><span>•</span><span>{t("common.sector")}: {a.setor}</span></>}
                    </div>
                  </div>
                  <div className="flex sm:flex-col items-center sm:items-end gap-1.5 shrink-0">
                    <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                      <span className={`status-badge ${statusColors[a.status]}`}>{t(`auditorias.status.${a.status}`)}</span>
                      <span className="status-badge bg-card text-foreground border">{tipoLabels[a.tipo]}</span>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 sm:mt-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); navigate(`/auditorias/editar/${a.id}`); }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteId(a.id); }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                {a.pontuacao_total && Number(a.pontuacao_total) > 0 && (
                  <div className="mt-2 md:mt-3">
                    <div className="flex items-center gap-2 text-xs md:text-sm">
                      <span className="text-muted-foreground">{t("auditorias.score")}:</span>
                      <span className="font-semibold">{a.pontuacao_obtida}/{a.pontuacao_total}</span>
                      <span className="text-muted-foreground">({((Number(a.pontuacao_obtida) / Number(a.pontuacao_total)) * 100).toFixed(0)}%)</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("auditorias.deleteConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Auditorias;
