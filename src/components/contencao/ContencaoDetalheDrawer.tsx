import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Plus, Clock, Calendar, Loader2, CheckCircle2, FileText } from "lucide-react";
import { toast } from "sonner";
import ContencaoStatusStepper from "./ContencaoStatusStepper";
import ContencaoRegistroDialog from "./ContencaoRegistroDialog";
import RegistroCard from "./RegistroCard";
import ContencaoClaimReportDialog from "./ContencaoClaimReportDialog";
import { computeDiasAndamento, formatHoras, normalizeStatus, ContencaoRegistro, aggregateRegistrosDrawer } from "@/lib/contencao";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { canGenerateClaimReport } from "@/lib/contencaoClaimAccess";

interface Props {
  contencao: any | null;
  onClose: () => void;
}

const ContencaoDetalheDrawer = ({ contencao, onClose }: Props) => {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { isAdmin } = useUserRole();
  const { profile } = useAuth();
  const canClaim = canGenerateClaimReport({ isAdmin, cargo: profile?.cargo });
  const open = !!contencao;
  const [editing, setEditing] = useState<ContencaoRegistro | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ["contencao-registros", contencao?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contencao_registros" as any)
        .select("*")
        .eq("contencao_id", contencao!.id)
        .order("data", { ascending: false })
        .order("hora_inicio", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ContencaoRegistro[];
    },
    enabled: open,
  });

  const status = normalizeStatus(contencao?.status);
  const dias = (contencao as any)?.dias_andamento ?? computeDiasAndamento(contencao?.created_at, contencao?.data_conclusao, status);
  const totais = useMemo(() => aggregateRegistrosDrawer(registros as any[]), [registros]);

  const grouped = useMemo(() => {
    const map = new Map<string, ContencaoRegistro[]>();
    for (const r of registros) {
      const key = r.data;
      const arr = map.get(key) || [];
      arr.push(r);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [registros]);

  const concluida = status === "concluida";
  const canEditRegistros = isAdmin && !concluida;
  const canDeleteRegistros = isAdmin;
  const locale = i18n.language === "en" ? "en-US" : "pt-BR";

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <div className="p-4 sm:p-6 space-y-4">
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2 flex-wrap">
              {contencao?.numero && <span className="text-xs font-mono text-muted-foreground bg-muted/30 px-2 py-0.5 rounded">#{contencao.numero}</span>}
              <span className="truncate">{contencao?.titulo}</span>
            </SheetTitle>
            <SheetDescription className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {contencao?.responsavel && <span>{t("contencao.detail.responsible")}: {contencao.responsavel}</span>}
              {contencao?.local && <span>📍 {contencao.local}</span>}
              {contencao?.part_number && <span>PN: {contencao.part_number}</span>}
            </SheetDescription>
          </SheetHeader>

          <ContencaoStatusStepper status={status} />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Stat icon={Calendar} label={t("contencao.detail.days")} value={concluida ? t("contencao.detail.completedIn", { days: dias }) : t("contencao.detail.daysRunning", { days: dias })} />
            <Stat icon={Clock} label={t("contencao.detail.totalHours")} value={formatHoras(contencao?.total_horas ?? totais.horas)} />
            <Stat label={t("contencao.detail.inspected")} value={String(totais.insp)} />
            <Stat label={t("contencao.detail.okNg")} value={`${totais.ok} / ${totais.ng}`} colored />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h3 className="font-heading font-semibold text-sm">{t("contencao.detail.registros")}</h3>
            <div className="flex flex-wrap items-stretch gap-2 w-full sm:w-auto">
              {canClaim && registros.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 border-amber-500 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30 flex-1 sm:flex-none"
                  onClick={() => setClaimOpen(true)}
                >
                  <FileText className="w-4 h-4" /> <span className="truncate">{t("contencao.detail.report")}</span>
                </Button>
              )}
              {!concluida && (
                <Button size="sm" className="gap-1 flex-1 sm:flex-none" onClick={() => { setEditing(null); setDialogOpen(true); }}>
                  <Plus className="w-4 h-4" /> <span className="truncate">{t("contencao.detail.new")}</span>
                </Button>
              )}
              {!concluida && registros.length > 0 && (
                <Button
                  size="sm"
                  className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"
                  onClick={() => setConfirmFinalize(true)}
                  disabled={finalizing}
                >
                  <CheckCircle2 className="w-4 h-4" /> <span className="truncate">{t("contencao.detail.finalize")}</span>
                </Button>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : registros.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8 border border-dashed rounded-md">
              {t("contencao.detail.noRegistros")}
            </div>
          ) : (
            <div className="space-y-4">
              {grouped.map(([data, arr]) => (
                <div key={data} className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {new Date(`${data}T12:00:00`).toLocaleDateString(locale, { weekday: "long", day: "2-digit", month: "long" })}
                  </p>
                  {arr.map((r) => (
                    <RegistroCard
                      key={r.id}
                      registro={r}
                      canEdit={canEditRegistros}
                      canDelete={canDeleteRegistros}
                      onEdit={(reg) => { setEditing(reg); setDialogOpen(true); }}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {contencao && (
          <ContencaoRegistroDialog
            open={dialogOpen}
            onClose={() => { setDialogOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["contencao-registros", contencao.id] }); qc.invalidateQueries({ queryKey: ["contencao"] }); }}
            contencaoId={contencao.id}
            defaultLocal={contencao.local}
            initial={editing}
            contencaoConcluida={concluida}
          />
        )}
        <ContencaoClaimReportDialog open={claimOpen} onClose={() => setClaimOpen(false)} contencao={contencao} />
      </SheetContent>

      <AlertDialog open={confirmFinalize} onOpenChange={setConfirmFinalize}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("contencao.detail.finalizeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("contencao.detail.finalizeDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={finalizing}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={finalizing}
              onClick={async (e) => {
                e.preventDefault();
                if (!contencao) return;
                setFinalizing(true);
                try {
                  const { error } = await supabase
                    .from("contencao")
                    .update({ status: "concluida", data_conclusao: new Date().toISOString() })
                    .eq("id", contencao.id);
                  if (error) throw error;
                  toast.success(t("contencao.detail.finalizeSuccess"));
                  qc.invalidateQueries({ queryKey: ["contencao"] });
                  qc.invalidateQueries({ queryKey: ["contencao-registros", contencao.id] });
                  qc.invalidateQueries({ queryKey: ["contencao-resumo-mensal"] });
                  setConfirmFinalize(false);
                  onClose();
                } catch (err: any) {
                  toast.error(err.message || t("contencao.detail.finalizeError"));
                } finally {
                  setFinalizing(false);
                }
              }}
            >
              {t("contencao.detail.finalizeConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
};

const Stat = ({ icon: Icon, label, value, colored }: any) => (
  <div className="rounded-md border bg-card p-2">
    <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
      {Icon && <Icon className="w-3 h-3" />} {label}
    </div>
    <p className={`text-sm font-semibold mt-0.5 ${colored ? "" : ""}`}>{value}</p>
  </div>
);

export default ContencaoDetalheDrawer;
