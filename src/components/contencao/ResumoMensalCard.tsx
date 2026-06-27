import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Clock, FolderOpen, CheckCircle2, TrendingUp } from "lucide-react";
import { formatHoras } from "@/lib/contencao";

const monthBounds = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  return { start, end };
};

const ResumoMensalCard = () => {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();

  const locale = i18n.language === "en" ? "en-US" : "pt-BR";
  const monthLabel = new Date().toLocaleDateString(locale, { month: "long", year: "numeric" });

  const { data: resumo } = useQuery({
    queryKey: ["contencao-resumo-mensal"],
    queryFn: async () => {
      const { start, end } = monthBounds();
      const { data: regs, error: e1 } = await supabase
        .from("contencao_registros" as any)
        .select("horas_trabalhadas, contencao_id, created_at")
        .gte("created_at", start)
        .lt("created_at", end);
      if (e1) throw e1;
      const totalHoras = (regs || []).reduce((acc: number, r: any) => acc + Number(r.horas_trabalhadas || 0), 0);

      const { data: cAbertas } = await supabase
        .from("contencao")
        .select("id", { count: "exact", head: false })
        .gte("created_at", start)
        .lt("created_at", end);
      const { data: cConcluidas } = await supabase
        .from("contencao")
        .select("id", { count: "exact", head: false })
        .eq("status", "concluida")
        .gte("data_conclusao", start)
        .lt("data_conclusao", end);

      const abertas = cAbertas?.length || 0;
      const concluidas = cConcluidas?.length || 0;
      const media = concluidas > 0 ? totalHoras / concluidas : 0;
      return { totalHoras, abertas, concluidas, media };
    },
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("contencao-resumo-mensal")
      .on("postgres_changes", { event: "*", schema: "public", table: "contencao_registros" }, () => {
        qc.invalidateQueries({ queryKey: ["contencao-resumo-mensal"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "contencao" }, () => {
        qc.invalidateQueries({ queryKey: ["contencao-resumo-mensal"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  return (
    <div className="rounded-lg border bg-gradient-to-br from-accent/5 to-primary/5 p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-4 h-4 text-accent" />
        <h3 className="font-heading font-semibold text-sm sm:text-base">
          {t("contencao.resumo.title")} — <span className="capitalize">{monthLabel}</span>
        </h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <Metric icon={Clock} label={t("contencao.resumo.horasRegistradas")} value={formatHoras(resumo?.totalHoras)} color="text-blue-600" />
        <Metric icon={FolderOpen} label={t("contencao.resumo.abertasNoMes")} value={String(resumo?.abertas ?? 0)} color="text-amber-600" />
        <Metric icon={CheckCircle2} label={t("contencao.resumo.concluidasNoMes")} value={String(resumo?.concluidas ?? 0)} color="text-emerald-600" />
        <Metric icon={TrendingUp} label={t("contencao.resumo.mediaContencao")} value={formatHoras(resumo?.media)} color="text-purple-600" />
      </div>
    </div>
  );
};

const Metric = ({ icon: Icon, label, value, color }: any) => (
  <div className="rounded-md border bg-card p-2.5 sm:p-3">
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className={`w-3.5 h-3.5 ${color}`} /> <span className="truncate">{label}</span>
    </div>
    <p className="text-base sm:text-lg font-semibold mt-1">{value}</p>
  </div>
);

export default ResumoMensalCard;
