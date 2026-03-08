import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from "recharts";
import logo from "@/assets/hyundai-mobis-logo.png";

const COLORS = ["#22c55e", "#f59e0b", "#ef4444", "#6b7280"];

const AuditoriaDashboard = () => {
  const navigate = useNavigate();

  const { data: auditorias = [] } = useQuery({
    queryKey: ["auditorias"],
    queryFn: async () => {
      const { data, error } = await supabase.from("auditorias").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: responses = [] } = useQuery({
    queryKey: ["all_audit_responses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_responses").select("*, audit_items(category, description)");
      if (error) throw error;
      return data;
    },
  });

  // Stats
  const total = auditorias.length;
  const concluidas = auditorias.filter((a) => a.status === "concluida").length;
  const avgScore = auditorias.filter((a) => Number(a.pontuacao_total) > 0).length > 0
    ? (auditorias.filter((a) => Number(a.pontuacao_total) > 0)
        .reduce((sum, a) => sum + (Number(a.pontuacao_obtida) / Number(a.pontuacao_total)) * 100, 0) /
      auditorias.filter((a) => Number(a.pontuacao_total) > 0).length).toFixed(1)
    : "0";

  // By type
  const byType = ["processo", "produto", "fornecedor"].map((t) => ({
    name: t.charAt(0).toUpperCase() + t.slice(1),
    total: auditorias.filter((a) => a.tipo === t).length,
    concluidas: auditorias.filter((a) => a.tipo === t && a.status === "concluida").length,
  }));

  // Conformidade distribution
  const confDist = [
    { name: "Conforme", value: responses.filter((r) => r.conformidade === "conforme").length },
    { name: "Parcial", value: responses.filter((r) => r.conformidade === "parcial").length },
    { name: "Não Conforme", value: responses.filter((r) => r.conformidade === "nao_conforme").length },
    { name: "N/A", value: responses.filter((r) => r.conformidade === "na").length },
  ].filter((d) => d.value > 0);

  // Status distribution
  const statusDist = [
    { name: "Aberta", value: auditorias.filter((a) => a.status === "aberta").length },
    { name: "Em Andamento", value: auditorias.filter((a) => a.status === "em_andamento").length },
    { name: "Concluída", value: auditorias.filter((a) => a.status === "concluida").length },
    { name: "Cancelada", value: auditorias.filter((a) => a.status === "cancelada").length },
  ].filter((d) => d.value > 0);

  // Recent audits trend (last 6)
  const recentAudits = auditorias
    .filter((a) => Number(a.pontuacao_total) > 0)
    .slice(0, 10)
    .reverse()
    .map((a) => ({
      name: a.titulo.substring(0, 15),
      score: Number(((Number(a.pontuacao_obtida) / Number(a.pontuacao_total)) * 100).toFixed(1)),
    }));

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/auditorias")} className="text-primary-foreground/70 hover:text-primary-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <img src={logo} alt="Hyundai Mobis" className="h-8 object-contain bg-white rounded-md px-2 py-0.5" />
          </div>
          <div className="flex items-center gap-3 mt-4">
            <ShieldCheck className="w-8 h-8" />
            <h1 className="text-2xl font-heading font-bold">Dashboard — Auditorias</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Auditorias", value: total },
            { label: "Concluídas", value: concluidas },
            { label: "Taxa Conclusão", value: total > 0 ? `${((concluidas / total) * 100).toFixed(0)}%` : "0%" },
            { label: "Score Médio", value: `${avgScore}%` },
          ].map((kpi) => (
            <div key={kpi.label} className="form-section text-center">
              <p className="text-2xl font-heading font-bold text-foreground">{kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* By Type */}
          <div className="form-section">
            <h3 className="form-section-title mb-4">Auditorias por Tipo</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={byType}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" name="Total" fill="hsl(var(--chart-2))" />
                <Bar dataKey="concluidas" name="Concluídas" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Conformidade Pie */}
          <div className="form-section">
            <h3 className="form-section-title mb-4">Distribuição de Conformidade</h3>
            {confDist.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={confDist} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {confDist.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-12">Sem dados</p>
            )}
          </div>

          {/* Score Trend */}
          <div className="form-section">
            <h3 className="form-section-title mb-4">Tendência de Score</h3>
            {recentAudits.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={recentAudits}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="score" name="Score %" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-12">Sem dados</p>
            )}
          </div>

          {/* Status */}
          <div className="form-section">
            <h3 className="form-section-title mb-4">Status das Auditorias</h3>
            {statusDist.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={statusDist} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {statusDist.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-12">Sem dados</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AuditoriaDashboard;
