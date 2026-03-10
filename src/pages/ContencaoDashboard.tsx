import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import logo from "@/assets/hyundai-mobis-logo.png";

const COLORS = ["#3b82f6", "#f59e0b", "#22c55e", "#ef4444"];

const ContencaoDashboard = () => {
  const navigate = useNavigate();

  const { data: items = [] } = useQuery({
    queryKey: ["contencao"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contencao").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const total = items.length;
  const totalContida = items.reduce((s, i) => s + (i.quantidade_contida || 0), 0);
  const totalAprovada = items.reduce((s, i) => s + (i.quantidade_aprovada || 0), 0);
  const totalRejeitada = items.reduce((s, i) => s + (i.quantidade_rejeitada || 0), 0);

  const byTipo = [
    { name: "Interno MBR", value: items.filter((i) => i.tipo === "interno_mbr").length },
    { name: "Externo HMB", value: items.filter((i) => i.tipo === "externo_hmb").length },
  ].filter((d) => d.value > 0);

  const statusDist = [
    { name: "Aberta", value: items.filter((i) => i.status === "aberta").length },
    { name: "Em Andamento", value: items.filter((i) => i.status === "em_andamento").length },
    { name: "Concluída", value: items.filter((i) => i.status === "concluida").length },
    { name: "Cancelada", value: items.filter((i) => i.status === "cancelada").length },
  ].filter((d) => d.value > 0);

  const qtyData = [
    { name: "Contidas", value: totalContida },
    { name: "Aprovadas", value: totalAprovada },
    { name: "Rejeitadas", value: totalRejeitada },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/contencao")} className="text-primary-foreground/70 hover:text-primary-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <img src={logo} alt="Hyundai Mobis" className="h-8 object-contain bg-white rounded-md px-2 py-0.5" />
          </div>
          <div className="flex items-center gap-3 mt-4">
            <ShieldAlert className="w-8 h-8" />
            <h1 className="text-2xl font-heading font-bold">Dashboard — Contenção</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total", value: total },
            { label: "Qtd Contida", value: totalContida },
            { label: "Qtd Aprovada", value: totalAprovada },
            { label: "Qtd Rejeitada", value: totalRejeitada },
          ].map((kpi) => (
            <div key={kpi.label} className="form-section text-center">
              <p className="text-2xl font-heading font-bold text-foreground">{kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="form-section">
            <h3 className="form-section-title mb-4">Por Tipo</h3>
            {byTipo.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={byTipo} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {byTipo.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-muted-foreground py-12">Sem dados</p>}
          </div>

          <div className="form-section">
            <h3 className="form-section-title mb-4">Status</h3>
            {statusDist.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={statusDist} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {statusDist.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-muted-foreground py-12">Sem dados</p>}
          </div>

          <div className="form-section md:col-span-2">
            <h3 className="form-section-title mb-4">Quantidades Totais</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={qtyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" name="Quantidade" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ContencaoDashboard;
