import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Droplets, Paintbrush, Wrench, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

const IMPROVEMENT_CATEGORIES: Record<number, string> = {
  1: "Dimensional",
  2: "Visual",
  3: "Funcional",
  4: "Processo",
  5: "Material",
};

const PIE_COLORS = [
  "hsl(210, 80%, 55%)",
  "hsl(38, 92%, 50%)",
  "hsl(152, 60%, 40%)",
  "hsl(0, 72%, 50%)",
  "hsl(270, 60%, 55%)",
];

interface InjectionRow {
  projeto: string;
  needs_improvement: boolean;
  improvement_category: number | null;
  created_at: string;
  cycle_time: number;
  cooling_time: number;
  weight: number;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [injectionData, setInjectionData] = useState<InjectionRow[]>([]);
  const [paintingCount, setPaintingCount] = useState(0);
  const [assemblyCount, setAssemblyCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [injRes, paintRes, assemblyRes] = await Promise.all([
        supabase.from("injection_checklists").select("projeto, needs_improvement, improvement_category, created_at, cycle_time, cooling_time, weight"),
        supabase.from("painting_checklists").select("id", { count: "exact", head: true }),
        supabase.from("assembly_checklists").select("id", { count: "exact", head: true }),
      ]);
      setInjectionData((injRes.data as InjectionRow[]) || []);
      setPaintingCount(paintRes.count || 0);
      setAssemblyCount(assemblyRes.count || 0);
      setLoading(false);
    };
    fetchData();
  }, []);

  // KPIs
  const totalInjection = injectionData.length;
  const totalAll = totalInjection + paintingCount + assemblyCount;
  const needsImprovement = injectionData.filter((d) => d.needs_improvement).length;
  const improvementRate = totalInjection > 0 ? Math.round((needsImprovement / totalInjection) * 100) : 0;

  // Try-outs por projeto
  const projectMap = new Map<string, number>();
  injectionData.forEach((d) => {
    projectMap.set(d.projeto, (projectMap.get(d.projeto) || 0) + 1);
  });
  const projectData = Array.from(projectMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Melhorias por categoria
  const categoryMap = new Map<number, number>();
  injectionData.forEach((d) => {
    if (d.needs_improvement && d.improvement_category) {
      categoryMap.set(d.improvement_category, (categoryMap.get(d.improvement_category) || 0) + 1);
    }
  });
  const categoryData = Array.from(categoryMap.entries()).map(([key, value]) => ({
    name: IMPROVEMENT_CATEGORIES[key] || `Cat ${key}`,
    value,
  }));

  // Timeline - try-outs por mês
  const monthMap = new Map<string, number>();
  injectionData.forEach((d) => {
    const date = new Date(d.created_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    monthMap.set(key, (monthMap.get(key) || 0) + 1);
  });
  const timelineData = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }));

  // Média de cycle_time por projeto
  const cycleMap = new Map<string, { total: number; count: number }>();
  injectionData.forEach((d) => {
    const existing = cycleMap.get(d.projeto) || { total: 0, count: 0 };
    cycleMap.set(d.projeto, { total: existing.total + d.cycle_time, count: existing.count + 1 });
  });
  const cycleData = Array.from(cycleMap.entries())
    .map(([name, { total, count }]) => ({ name, avg: Math.round((total / count) * 10) / 10 }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 8);

  const chartConfig = {
    value: { label: "Quantidade", color: "hsl(210, 80%, 55%)" },
    count: { label: "Try-outs", color: "hsl(152, 60%, 40%)" },
    avg: { label: "Tempo Médio (s)", color: "hsl(38, 92%, 50%)" },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-4 py-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <h1 className="text-3xl md:text-4xl font-heading font-bold">Dashboard</h1>
          <p className="mt-2 text-primary-foreground/70 text-lg">
            Indicadores e gráficos dos try-outs realizados.
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 -mt-6 pb-12 space-y-6">
        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-info/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-info" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Registros</p>
                <p className="text-2xl font-heading font-bold">{totalAll}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Droplets className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Injeção</p>
                <p className="text-2xl font-heading font-bold">{totalInjection}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Paintbrush className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pintura</p>
                <p className="text-2xl font-heading font-bold">{paintingCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Wrench className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Montagem</p>
                <p className="text-2xl font-heading font-bold">{assemblyCount}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Improvement indicator */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Precisam Melhoria</p>
                <p className="text-2xl font-heading font-bold">{needsImprovement}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Taxa de Aprovação</p>
                <p className="text-2xl font-heading font-bold">{100 - improvementRate}%</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Try-outs por Projeto */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-heading">Try-outs por Projeto</CardTitle>
            </CardHeader>
            <CardContent>
              {projectData.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <BarChart data={projectData} layout="vertical" margin={{ left: 80, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={75} tick={{ fontSize: 12 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" fill="hsl(210, 80%, 55%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-12">Nenhum dado de injeção registrado.</p>
              )}
            </CardContent>
          </Card>

          {/* Melhorias por Categoria */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-heading">Melhorias por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              {categoryData.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {categoryData.map((_, index) => (
                        <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-12">Nenhuma melhoria registrada.</p>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-heading">Try-outs por Mês</CardTitle>
            </CardHeader>
            <CardContent>
              {timelineData.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <LineChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="count" stroke="hsl(152, 60%, 40%)" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ChartContainer>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-12">Sem dados no período.</p>
              )}
            </CardContent>
          </Card>

          {/* Cycle time médio por projeto */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-heading">Tempo de Ciclo Médio por Projeto</CardTitle>
            </CardHeader>
            <CardContent>
              {cycleData.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <BarChart data={cycleData} margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="avg" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-12">Nenhum dado disponível.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
