import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, ShieldAlert, BarChart3, Pencil, Trash2 } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import EngineeringMode from "@/components/EngineeringMode";
import MasterListFilter, { useListFilters, FilterConfig } from "@/components/MasterListFilter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import logo from "@/assets/hyundai-mobis-logo.png";
import { useTranslation } from "react-i18next";

const Contencao = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const qc = useQueryClient();
  const [tab, setTab] = useState("interno_mbr");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { search, setSearch, filterValues, handleFilterChange, clearFilters, matchesSearch, matchesFilters } = useListFilters();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["contencao"],
    queryFn: async () => { const { data, error } = await supabase.from("contencao").select("*").order("created_at", { ascending: false }); if (error) throw error; return data; },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("contencao").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contencao"] }); toast.success(t("contencao.deleteSuccess")); setDeleteId(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const filters: FilterConfig[] = useMemo(() => {
    const partNumbers = [...new Set(items.map((i) => i.part_number).filter(Boolean))] as string[];
    const responsaveis = [...new Set(items.map((i) => i.responsavel).filter(Boolean))] as string[];
    const statuses = [...new Set(items.map((i) => i.status).filter(Boolean))] as string[];
    return [
      { key: "part_number", label: "Part Number", options: partNumbers },
      { key: "responsavel", label: t("common.responsible"), options: responsaveis },
      { key: "status", label: t("common.status"), options: statuses },
    ];
  }, [items, t]);

  const filtered = useMemo(() => items.filter((i) => i.tipo === tab).filter((i) => matchesSearch(i, ["numero", "titulo", "responsavel", "part_number", "part_name", "fornecedor"]) && matchesFilters(i)), [items, tab, search, filterValues]);

  const statusColors: Record<string, string> = { aberta: "bg-blue-500/10 text-blue-600", em_andamento: "bg-amber-500/10 text-amber-600", concluida: "bg-emerald-500/10 text-emerald-600", cancelada: "bg-red-500/10 text-red-600" };

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-primary-foreground/70 hover:text-primary-foreground"><ArrowLeft className="w-4 h-4 mr-1" /> {t("common.hub")}</Button>
              <img src={logo} alt="Hyundai Mobis" className="h-8 object-contain bg-white rounded-md px-2 py-0.5" />
            </div>
            {isAdmin && <EngineeringMode module="Contenção" />}
          </div>
          <div className="flex items-center gap-3 mt-4"><ShieldAlert className="w-8 h-8" /><div><h1 className="text-2xl font-heading font-bold">{t("contencao.title")}</h1><p className="text-primary-foreground/70 text-sm">{t("contencao.subtitle")}</p></div></div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => navigate("/contencao/nova")} className="gap-2"><Plus className="w-4 h-4" /> {t("contencao.newContencao")}</Button>
          <Button variant="outline" onClick={() => navigate("/contencao/dashboard")} className="gap-2"><BarChart3 className="w-4 h-4" /> {t("common.dashboard")}</Button>
        </div>

        <MasterListFilter searchValue={search} onSearchChange={setSearch} filters={filters} filterValues={filterValues} onFilterChange={handleFilterChange} onClearFilters={clearFilters} />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="interno_mbr">{t("contencao.internoMBR")}</TabsTrigger>
            <TabsTrigger value="externo_hmb">{t("contencao.externoHMB")}</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {isLoading ? (<div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" /></div>
            ) : filtered.length === 0 ? (<div className="form-section text-center py-12"><ShieldAlert className="w-12 h-12 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">{t("contencao.noItems")}</p></div>
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
                        <div className="flex flex-wrap gap-1.5 md:gap-2 text-xs md:text-sm text-muted-foreground">
                          <span>{t("common.responsible")}: {item.responsavel}</span><span>•</span><span>{new Date(item.data).toLocaleDateString("pt-BR")}</span>
                          {item.part_number && <><span>•</span><span>PN: {item.part_number}</span></>}
                        </div>
                        {item.motivo && <p className="text-xs md:text-sm text-muted-foreground mt-1">{t("contencao.reason")}: {item.motivo}</p>}
                      </div>
                      <div className="flex sm:flex-col items-center sm:items-end gap-1.5 shrink-0">
                        <span className={`status-badge ${statusColors[item.status]}`}>{t(`contencao.status.${item.status}`)}</span>
                        {isAdmin && (
                          <div className="flex gap-1 sm:mt-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/contencao/editar/${item.id}`)}><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(item.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 md:mt-3 grid grid-cols-3 gap-2 md:gap-4 text-xs md:text-sm">
                      <div><span className="text-muted-foreground">{t("contencao.contidas")}:</span> <span className="font-semibold">{item.quantidade_contida}</span></div>
                      <div><span className="text-muted-foreground">{t("contencao.aprovadas")}:</span> <span className="font-semibold text-emerald-600">{item.quantidade_aprovada}</span></div>
                      <div><span className="text-muted-foreground">{t("contencao.rejeitadas")}:</span> <span className="font-semibold text-red-600">{item.quantidade_rejeitada}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

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
