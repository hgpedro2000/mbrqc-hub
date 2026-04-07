import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileBarChart } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line } from "recharts";
import logo from "@/assets/hyundai-mobis-logo.png";

const COLORS = ["#3b82f6", "#f59e0b", "#22c55e", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];
const TYPES = ["incoming", "peca", "processo", "oem"] as const;
const TYPE_LABELS: Record<string, string> = { incoming: "Incoming", peca: "Peça", processo: "Processo", oem: "OEM" };

const ApontamentoDashboard = () => {
  const navigate = useNavigate();
  const [activeType, setActiveType] = useState("all");

  const { data: items = [] } = useQuery({
    queryKey: ["apontamentos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("apontamentos").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => activeType === "all" ? items : items.filter((i) => i.tipo === activeType), [items, activeType]);

  const total = filtered.length;
  const totalNg = filtered.reduce((sum, i) => sum + (i.quantidade_ng || 0), 0);
  const totalInspecionado = filtered.reduce((sum, i) => sum + (i.quantidade_inspecionada || 0), 0);
  const drafts = filtered.filter((i) => i.status === "draft").length;
  const submitted = filtered.filter((i) => i.status !== "draft").length;

  const byType = TYPES.map((t) => ({ name: TYPE_LABELS[t], value: items.filter((i) => i.tipo === t).length })).filter((d) => d.value > 0);

  const byProjeto = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach((i) => { if (i.projeto) counts[i.projeto] = (counts[i.projeto] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const byFornecedor = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach((i) => { if (i.fornecedor) counts[i.fornecedor] = (counts[i.fornecedor] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [filtered]);

  const byMonth = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach((i) => {
      const month = i.data?.substring(0, 7);
      if (month) counts[month] = (counts[month] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => a.name.localeCompare(b.name)).slice(-12);
  }, [filtered]);

  const byModoFalha = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach((i) => { if (i.modo_falha) counts[i.modo_falha] = (counts[i.modo_falha] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name: name.length > 20 ? name.substring(0, 20) + "..." : name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [filtered]);

  const ChartEmpty = () => <p className="text-center text-muted-foreground py-12">Sem dados</p>;

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/apontamentos")} className="text-primary-foreground/70 hover:text-primary-foreground"><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button>
            <img src={logo} alt="Hyundai Mobis" className="h-6 sm:h-8 object-contain bg-white rounded-md px-2 py-0.5" />
          </div>
          <div className="flex items-center gap-3 mt-4"><FileBarChart className="w-6 h-6 sm:w-8 sm:h-8" /><h1 className="text-xl sm:text-2xl font-heading font-bold">Dashboard — Apontamentos</h1></div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-6">
        {/* Type filter tabs */}
        <Tabs value={activeType} onValueChange={setActiveType}>
          <TabsList className="grid w-full grid-cols-5 h-auto">
            <TabsTrigger value="all" className="text-xs sm:text-sm py-2">Todos</TabsTrigger>
            {TYPES.map((t) => (
              <TabsTrigger key={t} value={t} className="text-xs sm:text-sm py-2">{TYPE_LABELS[t]}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Registros", value: total },
            { label: "Finalizados", value: submitted },
            { label: "Rascunhos", value: drafts },
            { label: "Total NG", value: totalNg },
          ].map((kpi) => (
            <div key={kpi.label} className="form-section text-center">
              <p className="text-2xl font-heading font-bold text-foreground">{kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-6">
          {activeType === "all" && (
            <div className="form-section">
              <h3 className="form-section-title mb-4">Por Tipo</h3>
              {byType.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart><Pie data={byType} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>{byType.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}</Pie><Tooltip /></PieChart>
                </ResponsiveContainer>
              ) : <ChartEmpty />}
            </div>
          )}

          <div className="form-section">
            <h3 className="form-section-title mb-4">Por Projeto</h3>
            {byProjeto.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={byProjeto}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip /><Bar dataKey="value" name="Registros">{byProjeto.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}</Bar></BarChart>
              </ResponsiveContainer>
            ) : <ChartEmpty />}
          </div>

          <div className="form-section">
            <h3 className="form-section-title mb-4">Por Fornecedor (Top 10)</h3>
            {byFornecedor.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={byFornecedor} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis type="number" tick={{ fontSize: 11 }} /><YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="value" name="Registros" fill="#3b82f6" /></BarChart>
              </ResponsiveContainer>
            ) : <ChartEmpty />}
          </div>

          <div className="form-section">
            <h3 className="form-section-title mb-4">Evolução Mensal</h3>
            {byMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={byMonth}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip /><Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} /></LineChart>
              </ResponsiveContainer>
            ) : <ChartEmpty />}
          </div>

          {(activeType !== "oem") && (
            <div className="form-section md:col-span-2">
              <h3 className="form-section-title mb-4">Por Modo de Falha (Top 8)</h3>
              {byModoFalha.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={byModoFalha}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} /><YAxis tick={{ fontSize: 12 }} /><Tooltip /><Bar dataKey="value" name="Ocorrências">{byModoFalha.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Bar></BarChart>
                </ResponsiveContainer>
              ) : <ChartEmpty />}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ApontamentoDashboard;
