import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileBarChart } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import logo from "@/assets/hyundai-mobis-logo.png";
import { useTranslation } from "react-i18next";

const COLORS = ["#3b82f6", "#f59e0b", "#22c55e", "#ef4444", "#8b5cf6"];

const ApontamentoDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: items = [] } = useQuery({
    queryKey: ["apontamentos"],
    queryFn: async () => { const { data, error } = await supabase.from("apontamentos").select("*").order("created_at", { ascending: false }); if (error) throw error; return data; },
  });

  const total = items.length;
  const abertos = items.filter((i) => i.status === "aberto" || i.status === "em_analise").length;
  const concluidos = items.filter((i) => i.status === "concluido").length;
  const criticos = items.filter((i) => i.severidade === "critica" || i.severidade === "alta").length;

  const byTipo = [
    { name: t("apontamentos.tabDefeitoProcesso"), value: items.filter((i) => i.tipo === "defeito_processo").length },
    { name: t("apontamentos.tabDefeitoPeca"), value: items.filter((i) => i.tipo === "defeito_peca").length },
    { name: t("apontamentos.tabParadaLinha"), value: items.filter((i) => i.tipo === "parada_linha").length },
  ].filter((d) => d.value > 0);

  const bySeveridade = [
    { name: t("apontamentos.severity.baixa"), value: items.filter((i) => i.severidade === "baixa").length },
    { name: t("apontamentos.severity.media"), value: items.filter((i) => i.severidade === "media").length },
    { name: t("apontamentos.severity.alta"), value: items.filter((i) => i.severidade === "alta").length },
    { name: t("apontamentos.severity.critica"), value: items.filter((i) => i.severidade === "critica").length },
  ].filter((d) => d.value > 0);

  const byStatus = [
    { name: t("apontamentos.status.aberto"), value: items.filter((i) => i.status === "aberto").length },
    { name: t("apontamentos.status.em_analise"), value: items.filter((i) => i.status === "em_analise").length },
    { name: t("apontamentos.status.acao_definida"), value: items.filter((i) => i.status === "acao_definida").length },
    { name: t("apontamentos.status.concluido"), value: items.filter((i) => i.status === "concluido").length },
    { name: t("apontamentos.status.cancelado"), value: items.filter((i) => i.status === "cancelado").length },
  ].filter((d) => d.value > 0);

  const setorCounts: Record<string, number> = {};
  items.forEach((i) => { if (i.setor) setorCounts[i.setor] = (setorCounts[i.setor] || 0) + 1; });
  const bySetor = Object.entries(setorCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/apontamentos")} className="text-primary-foreground/70 hover:text-primary-foreground"><ArrowLeft className="w-4 h-4 mr-1" /> {t("common.back")}</Button>
            <img src={logo} alt="Hyundai Mobis" className="h-8 object-contain bg-white rounded-md px-2 py-0.5" />
          </div>
          <div className="flex items-center gap-3 mt-4"><FileBarChart className="w-8 h-8" /><h1 className="text-2xl font-heading font-bold">{t("apontamentos.dashboard.title")}</h1></div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: t("apontamentos.dashboard.total"), value: total },
            { label: t("apontamentos.dashboard.open"), value: abertos },
            { label: t("apontamentos.dashboard.completed"), value: concluidos },
            { label: t("apontamentos.dashboard.highCritical"), value: criticos },
          ].map((kpi) => (<div key={kpi.label} className="form-section text-center"><p className="text-2xl font-heading font-bold text-foreground">{kpi.value}</p><p className="text-xs text-muted-foreground mt-1">{kpi.label}</p></div>))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="form-section"><h3 className="form-section-title mb-4">{t("apontamentos.dashboard.byType")}</h3>
            {byTipo.length > 0 ? (<ResponsiveContainer width="100%" height={250}><PieChart><Pie data={byTipo} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>{byTipo.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>) : <p className="text-center text-muted-foreground py-12">{t("common.noData")}</p>}
          </div>
          <div className="form-section"><h3 className="form-section-title mb-4">{t("apontamentos.dashboard.bySeverity")}</h3>
            {bySeveridade.length > 0 ? (<ResponsiveContainer width="100%" height={250}><BarChart data={bySeveridade}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip /><Bar dataKey="value" name={t("common.quantity")}>{bySeveridade.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}</Bar></BarChart></ResponsiveContainer>) : <p className="text-center text-muted-foreground py-12">{t("common.noData")}</p>}
          </div>
          <div className="form-section"><h3 className="form-section-title mb-4">{t("apontamentos.dashboard.byStatus")}</h3>
            {byStatus.length > 0 ? (<ResponsiveContainer width="100%" height={250}><PieChart><Pie data={byStatus} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>{byStatus.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>) : <p className="text-center text-muted-foreground py-12">{t("common.noData")}</p>}
          </div>
          <div className="form-section"><h3 className="form-section-title mb-4">{t("apontamentos.dashboard.bySector")}</h3>
            {bySetor.length > 0 ? (<ResponsiveContainer width="100%" height={250}><BarChart data={bySetor}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip /><Bar dataKey="value" name={t("common.quantity")} fill="#8b5cf6" /></BarChart></ResponsiveContainer>) : <p className="text-center text-muted-foreground py-12">{t("common.noData")}</p>}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ApontamentoDashboard;
