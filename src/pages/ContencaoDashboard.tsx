import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import logo from "@/assets/hyundai-mobis-logo.png";
import { useTranslation } from "react-i18next";

const COLORS = ["#3b82f6", "#f59e0b", "#22c55e", "#ef4444"];

const ContencaoDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: items = [] } = useQuery({
    queryKey: ["contencao"],
    queryFn: async () => { const { data, error } = await supabase.from("contencao").select("*").order("created_at", { ascending: false }); if (error) throw error; return data; },
  });

  const total = items.length;
  const totalContida = items.reduce((s, i) => s + (i.quantidade_contida || 0), 0);
  const totalAprovada = items.reduce((s, i) => s + (i.quantidade_aprovada || 0), 0);
  const totalRejeitada = items.reduce((s, i) => s + (i.quantidade_rejeitada || 0), 0);

  const byTipo = [
    { name: t("contencao.internoMBR"), value: items.filter((i) => i.tipo === "interno_mbr").length },
    { name: t("contencao.externoHMB"), value: items.filter((i) => i.tipo === "externo_hmb").length },
  ].filter((d) => d.value > 0);

  const statusDist = [
    { name: t("contencao.status.aberta"), value: items.filter((i) => i.status === "aberta").length },
    { name: t("contencao.status.em_andamento"), value: items.filter((i) => i.status === "em_andamento").length },
    { name: t("contencao.status.concluida"), value: items.filter((i) => i.status === "concluida").length },
    { name: t("contencao.status.cancelada"), value: items.filter((i) => i.status === "cancelada").length },
  ].filter((d) => d.value > 0);

  const qtyData = [
    { name: t("contencao.contidas"), value: totalContida },
    { name: t("contencao.aprovadas"), value: totalAprovada },
    { name: t("contencao.rejeitadas"), value: totalRejeitada },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/contencao")} className="text-primary-foreground/70 hover:text-primary-foreground"><ArrowLeft className="w-4 h-4 mr-1" /> {t("common.back")}</Button>
            <img src={logo} alt="Hyundai Mobis" className="h-8 object-contain bg-white rounded-md px-2 py-0.5" />
          </div>
          <div className="flex items-center gap-3 mt-4"><ShieldAlert className="w-8 h-8" /><h1 className="text-2xl font-heading font-bold">{t("contencao.dashboard.title")}</h1></div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: t("contencao.dashboard.total"), value: total },
            { label: t("contencao.qtyContida"), value: totalContida },
            { label: t("contencao.qtyAprovada"), value: totalAprovada },
            { label: t("contencao.qtyRejeitada"), value: totalRejeitada },
          ].map((kpi) => (<div key={kpi.label} className="form-section text-center"><p className="text-2xl font-heading font-bold text-foreground">{kpi.value}</p><p className="text-xs text-muted-foreground mt-1">{kpi.label}</p></div>))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="form-section"><h3 className="form-section-title mb-4">{t("contencao.dashboard.byType")}</h3>
            {byTipo.length > 0 ? (<ResponsiveContainer width="100%" height={250}><PieChart><Pie data={byTipo} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>{byTipo.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>) : <p className="text-center text-muted-foreground py-12">{t("common.noData")}</p>}
          </div>
          <div className="form-section"><h3 className="form-section-title mb-4">{t("contencao.dashboard.statusChart")}</h3>
            {statusDist.length > 0 ? (<ResponsiveContainer width="100%" height={250}><PieChart><Pie data={statusDist} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>{statusDist.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>) : <p className="text-center text-muted-foreground py-12">{t("common.noData")}</p>}
          </div>
          <div className="form-section md:col-span-2"><h3 className="form-section-title mb-4">{t("contencao.dashboard.totalQty")}</h3>
            <ResponsiveContainer width="100%" height={250}><BarChart data={qtyData}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip /><Bar dataKey="value" name={t("common.quantity")} fill="#3b82f6" /></BarChart></ResponsiveContainer>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ContencaoDashboard;
