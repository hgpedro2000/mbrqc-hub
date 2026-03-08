import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import logo from "@/assets/hyundai-mobis-logo.png";

const COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#6b7280", "#8b5cf6"];

const AlertaQualidadeDashboard = () => {
  const navigate = useNavigate();

  const { data: alertas = [] } = useQuery({
    queryKey: ["alertas_qualidade"],
    queryFn: async () => {
      const { data, error } = await supabase.from("alertas_qualidade").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const total = alertas.length;
  const ativos = alertas.filter((a) => a.status === "ativo").length;
  const encerrados = alertas.filter((a) => a.status === "encerrado").length;
  const criticos = alertas.filter((a) => a.severidade === "critica" || a.severidade === "alta").length;

  const byStatus = [
    { name: "Ativo", value: alertas.filter((a) => a.status === "ativo").length },
    { name: "Em Verificação", value: alertas.filter((a) => a.status === "em_verificacao").length },
    { name: "Encerrado", value: alertas.filter((a) => a.status === "encerrado").length },
    { name: "Cancelado", value: alertas.filter((a) => a.status === "cancelado").length },
  ].filter((d) => d.value > 0);

  const bySeveridade = [
    { name: "Crítica", value: alertas.filter((a) => a.severidade === "critica").length },
    { name: "Alta", value: alertas.filter((a) => a.severidade === "alta").length },
    { name: "Média", value: alertas.filter((a) => a.severidade === "media").length },
    { name: "Baixa", value: alertas.filter((a) => a.severidade === "baixa").length },
  ].filter((d) => d.value > 0);

  const setorCounts: Record<string, number> = {};
  alertas.forEach((a) => { if (a.setor) setorCounts[a.setor] = (setorCounts[a.setor] || 0) + 1; });
  const bySetor = Object.entries(setorCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/alerta-qualidade")} className="text-primary-foreground/70 hover:text-primary-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <img src={logo} alt="Hyundai Mobis" className="h-8 object-contain bg-white rounded-md px-2 py-0.5" />
          </div>
          <div className="flex items-center gap-3 mt-4">
            <AlertTriangle className="w-8 h-8" />
            <h1 className="text-2xl font-heading font-bold">Dashboard — Alertas de Qualidade</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Alertas", value: total },
            { label: "Ativos", value: ativos },
            { label: "Encerrados", value: encerrados },
            { label: "Alta/Crítica", value: criticos },
          ].map((kpi) => (
            <div key={kpi.label} className="form-section text-center">
              <p className="text-2xl font-heading font-bold text-foreground">{kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="form-section">
            <h3 className="form-section-title mb-4">Por Status</h3>
            {byStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart><Pie data={byStatus} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>{byStatus.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}</Pie><Tooltip /></PieChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-muted-foreground py-12">Sem dados</p>}
          </div>

          <div className="form-section">
            <h3 className="form-section-title mb-4">Por Severidade</h3>
            {bySeveridade.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={bySeveridade}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip /><Bar dataKey="value" name="Qtd">{bySeveridade.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}</Bar></BarChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-muted-foreground py-12">Sem dados</p>}
          </div>

          <div className="form-section md:col-span-2">
            <h3 className="form-section-title mb-4">Por Setor</h3>
            {bySetor.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={bySetor}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip /><Bar dataKey="value" name="Alertas" fill="#ef4444" /></BarChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-muted-foreground py-12">Sem dados</p>}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AlertaQualidadeDashboard;
