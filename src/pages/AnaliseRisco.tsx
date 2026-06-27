import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, ShieldAlert, TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, ResponsiveContainer, ReferenceLine,
} from "recharts";

type Apto = {
  id: string;
  data: string;
  tipo: string;
  fornecedor: string | null;
  part_number: string | null;
  modo_falha: string | null;
  quantidade_ok: number | null;
  quantidade_ng: number | null;
};

const META_REJEICOES = 200;

const stripCode = (s: string) => s.replace(/^\d+\s*-\s*/, "").trim();
const monthKey = (d: string) => d.slice(0, 7);
const daysBetween = (a: Date, b: Date) => Math.floor((b.getTime() - a.getTime()) / 86400000);

export default function AnaliseRisco() {
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState<"30" | "90" | "180">("90");

  const dateFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - parseInt(periodo, 10));
    return d.toISOString().slice(0, 10);
  }, [periodo]);

  const { data: items = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["analise-risco", dateFrom],
    queryFn: async () => {
      const all: Apto[] = [];
      const PAGE = 1000;
      for (let i = 0; ; i++) {
        const { data, error } = await supabase
          .from("apontamentos")
          .select("id,data,tipo,fornecedor,part_number,modo_falha,quantidade_ok,quantidade_ng")
          .eq("tipo", "incoming")
          .gte("data", dateFrom)
          .range(i * PAGE, i * PAGE + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...(data as any));
        if (data.length < PAGE) break;
      }
      return all;
    },
  });

  // --- Aggregations ---
  const today = new Date();
  const halfPoint = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - parseInt(periodo, 10) / 2);
    return d.toISOString().slice(0, 10);
  }, [periodo]);

  const totalNG = useMemo(() => items.reduce((s, i) => s + (i.quantidade_ng || 0), 0), [items]);

  const modosFalha = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of items) {
      if (!i.modo_falha) continue;
      const k = stripCode(i.modo_falha);
      if (!k) continue;
      map.set(k, (map.get(k) || 0) + (i.quantidade_ng || 0));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  const supplierStats = useMemo(() => {
    type S = { name: string; ng: number; ok: number; months: Set<string>; modos: Map<string, number>; firstHalfNG: number; secondHalfNG: number };
    const m = new Map<string, S>();
    for (const i of items) {
      const k = i.fornecedor || "Desconhecido";
      if (!m.has(k)) m.set(k, { name: k, ng: 0, ok: 0, months: new Set(), modos: new Map(), firstHalfNG: 0, secondHalfNG: 0 });
      const e = m.get(k)!;
      const ng = i.quantidade_ng || 0;
      e.ng += ng;
      e.ok += i.quantidade_ok || 0;
      if (ng > 0) e.months.add(monthKey(i.data));
      if (i.modo_falha) {
        const mk = stripCode(i.modo_falha);
        e.modos.set(mk, (e.modos.get(mk) || 0) + ng);
      }
      if (ng > 0) {
        if (i.data >= halfPoint) e.secondHalfNG += ng;
        else e.firstHalfNG += ng;
      }
    }
    return [...m.values()];
  }, [items, halfPoint]);

  const reincidentes = supplierStats.filter((s) => s.months.size >= 2).length;
  const ppmMedio = useMemo(() => {
    const v = supplierStats.filter((s) => s.ok + s.ng > 0);
    if (!v.length) return 0;
    return Math.round(v.reduce((a, s) => a + (s.ng / (s.ok + s.ng)) * 1_000_000, 0) / v.length);
  }, [supplierStats]);

  const top2PPM = useMemo(() => {
    return new Set(
      [...supplierStats]
        .filter((s) => s.ok + s.ng > 0)
        .sort((a, b) => (b.ng / (b.ok + b.ng)) - (a.ng / (a.ok + a.ng)))
        .slice(0, 2)
        .map((s) => s.name),
    );
  }, [supplierStats]);

  // Pareto data
  const paretoData = useMemo(() => {
    const top = modosFalha.slice(0, 10);
    const total = top.reduce((a, b) => a + b[1], 0) || 1;
    let acc = 0;
    return top.map(([name, value]) => {
      acc += value;
      return { name, value, acc: Math.round((acc / total) * 100) };
    });
  }, [modosFalha]);

  // Tendência mensal
  const trendData = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) {
      const k = monthKey(i.data);
      m.set(k, (m.get(k) || 0) + (i.quantidade_ng || 0));
    }
    return [...m.entries()].sort().map(([name, ng]) => ({ name, ng }));
  }, [items]);

  // Supplier table
  const supplierTable = useMemo(() => {
    return supplierStats.map((s) => {
      const total = s.ok + s.ng;
      const ppm = total ? Math.round((s.ng / total) * 1_000_000) : 0;
      const mainModo = [...s.modos.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
      let trend: "up" | "down" | "flat" = "flat";
      if (s.secondHalfNG > s.firstHalfNG * 1.15) trend = "up";
      else if (s.secondHalfNG < s.firstHalfNG * 0.85) trend = "down";
      let risk: "Alto" | "Médio" | "Baixo" = "Baixo";
      if (ppm >= 10000 || s.ng >= 30) risk = "Alto";
      else if (ppm >= 3000 || s.ng >= 10) risk = "Médio";
      return { ...s, ppm, mainModo, trend, risk };
    }).sort((a, b) => b.ng - a.ng);
  }, [supplierStats]);

  // --- Per-part risk score ---
  type PartRisk = {
    pn: string; fornecedor: string; ng: number; diasSem: number; modoRecorrente: string;
    score: number; classification: "alto" | "medio" | "baixo"; recomendacao: string;
    monthsWithModo: number; ppmFornecedor: number;
  };

  const parts: PartRisk[] = useMemo(() => {
    type Acc = { pn: string; fornecedor: string; ng: number; lastNgDate: string | null; modoMonths: Map<string, Set<string>>; modos: Map<string, number> };
    const m = new Map<string, Acc>();
    for (const i of items) {
      if (!i.part_number) continue;
      const key = `${i.part_number}__${i.fornecedor || "—"}`;
      if (!m.has(key)) m.set(key, { pn: i.part_number, fornecedor: i.fornecedor || "—", ng: 0, lastNgDate: null, modoMonths: new Map(), modos: new Map() });
      const e = m.get(key)!;
      const ng = i.quantidade_ng || 0;
      e.ng += ng;
      if (ng > 0) {
        if (!e.lastNgDate || i.data > e.lastNgDate) e.lastNgDate = i.data;
        if (i.modo_falha) {
          const mk = stripCode(i.modo_falha);
          e.modos.set(mk, (e.modos.get(mk) || 0) + ng);
          if (!e.modoMonths.has(mk)) e.modoMonths.set(mk, new Set());
          e.modoMonths.get(mk)!.add(monthKey(i.data));
        }
      }
    }
    return [...m.values()].map((e) => {
      let score = 0;
      if (e.ng >= 30) score += 40;
      else if (e.ng >= 10) score += 25;
      else if (e.ng >= 1) score += 10;

      const maxModoMonths = [...e.modoMonths.values()].reduce((a, s) => Math.max(a, s.size), 0);
      if (maxModoMonths >= 3) score += 35;
      else if (maxModoMonths >= 2) score += 25;

      if (top2PPM.has(e.fornecedor)) score += 15;

      const diasSem = e.lastNgDate ? daysBetween(new Date(e.lastNgDate), today) : parseInt(periodo, 10);
      if (diasSem >= 60) score -= 20;
      else if (diasSem >= 30) score -= 10;

      score = Math.max(0, Math.min(100, score));
      let classification: "alto" | "medio" | "baixo" = "baixo";
      let recomendacao = "Liberação direta";
      if (score >= 60) { classification = "alto"; recomendacao = "100% inspeção"; }
      else if (score >= 30) { classification = "medio"; recomendacao = score >= 45 ? "Amostral 20%" : "Amostral 10%"; }

      const modoRecorrente = [...e.modos.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
      const ppmF = supplierStats.find((s) => s.name === e.fornecedor);
      const ppmFornecedor = ppmF && ppmF.ok + ppmF.ng > 0 ? Math.round((ppmF.ng / (ppmF.ok + ppmF.ng)) * 1_000_000) : 0;

      return {
        pn: e.pn, fornecedor: e.fornecedor, ng: e.ng, diasSem, modoRecorrente,
        score, classification, recomendacao, monthsWithModo: maxModoMonths, ppmFornecedor,
      };
    }).sort((a, b) => b.score - a.score);
  }, [items, top2PPM, supplierStats, periodo]);

  const counts = useMemo(() => {
    const a = parts.filter((p) => p.classification === "alto").length;
    const m = parts.filter((p) => p.classification === "medio").length;
    const b = parts.filter((p) => p.classification === "baixo").length;
    const total = parts.length || 1;
    return { a, m, b, total, reducao: Math.round((b / total) * 100) };
  }, [parts]);

  const [riskFilter, setRiskFilter] = useState<"todas" | "alto" | "medio" | "baixo">("todas");
  const partsFiltered = useMemo(
    () => riskFilter === "todas" ? parts : parts.filter((p) => p.classification === riskFilter),
    [parts, riskFilter],
  );

  // ---------- Drill-down ----------
  const [drill, setDrill] = useState<{ pn: string; fornecedor: string } | null>(null);

  const drillData = useMemo(() => {
    if (!drill) return null;
    const rows = items
      .filter((i) => i.part_number === drill.pn && (i.fornecedor || "—") === drill.fornecedor)
      .sort((a, b) => (a.data < b.data ? 1 : -1));
    const totalNg = rows.reduce((s, r) => s + (r.quantidade_ng || 0), 0);
    const totalOk = rows.reduce((s, r) => s + (r.quantidade_ok || 0), 0);
    const totalInsp = totalOk + totalNg;
    const ppm = totalInsp ? Math.round((totalNg / totalInsp) * 1_000_000) : 0;

    const byDay = new Map<string, number>();
    const modos = new Map<string, number>();
    for (const r of rows) {
      const ng = r.quantidade_ng || 0;
      byDay.set(r.data, (byDay.get(r.data) || 0) + ng);
      if (ng > 0 && r.modo_falha) {
        const k = stripCode(r.modo_falha);
        modos.set(k, (modos.get(k) || 0) + ng);
      }
    }
    const trend = [...byDay.entries()].sort().map(([data, ng]) => ({ data: data.slice(5), ng }));
    const topModos = [...modos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { rows, totalNg, totalOk, totalInsp, ppm, trend, topModos };
  }, [drill, items]);

  // ---------- UI helpers ----------
  const KPICard = ({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) => (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-heading font-bold mt-1">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>}
    </Card>
  );

  const riskBadge = (c: "alto" | "medio" | "baixo") => {
    if (c === "alto") return <Badge className="bg-destructive/15 text-destructive border-destructive/30">Alto</Badge>;
    if (c === "medio") return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">Médio</Badge>;
    return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Baixo</Badge>;
  };

  const scoreBar = (score: number, c: "alto" | "medio" | "baixo") => {
    const color = c === "alto" ? "bg-destructive" : c === "medio" ? "bg-amber-500" : "bg-emerald-500";
    return (
      <div className="flex items-center gap-2 min-w-[120px]">
        <div className="flex-1 h-2 rounded bg-muted overflow-hidden">
          <div className={`h-full ${color}`} style={{ width: `${score}%` }} />
        </div>
        <span className="text-xs font-semibold w-8 text-right">{score}</span>
      </div>
    );
  };

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="p-6 max-w-md text-center space-y-4">
          <h2 className="text-lg font-semibold">Erro ao carregar dados</h2>
          <p className="text-sm text-muted-foreground">Não foi possível conectar ao backend.</p>
          <Button onClick={() => refetch()}><RefreshCw className="w-4 h-4 mr-2" />Tentar novamente</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}><ArrowLeft className="w-5 h-5" /></Button>
          <ShieldAlert className="w-6 h-6 text-primary" />
          <div className="flex-1">
            <h1 className="text-lg font-heading font-bold">Análise de Risco</h1>
            <p className="text-xs text-muted-foreground">Baseado em apontamentos de Incoming</p>
          </div>
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as any)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="180">Últimos 180 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="painel" className="space-y-4">
          <TabsList>
            <TabsTrigger value="painel">Painel de Falhas</TabsTrigger>
            <TabsTrigger value="mapa">Mapa de Risco</TabsTrigger>
            <TabsTrigger value="reco">Recomendações do Dia</TabsTrigger>
          </TabsList>

          {/* ============ PAINEL ============ */}
          <TabsContent value="painel" className="space-y-4">
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KPICard label="Total NG no período" value={totalNG.toLocaleString()} />
                <KPICard label="Modos de falha distintos" value={modosFalha.length} />
                <KPICard label="PPM médio fornecedores" value={ppmMedio.toLocaleString()} />
                <KPICard label="Fornecedores reincidentes" value={reincidentes} sub="rejeição em 2+ meses" />
              </div>
            )}

            <div className="grid lg:grid-cols-2 gap-4">
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3">Pareto dos modos de falha</h3>
                <div className="h-[300px]">
                  <ResponsiveContainer>
                    <ComposedChart data={paretoData} margin={{ top: 10, right: 30, left: 0, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} fontSize={10} height={70} />
                      <YAxis yAxisId="left" fontSize={10} />
                      <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%" fontSize={10} />
                      <Tooltip />
                      <Bar yAxisId="left" dataKey="value" fill="hsl(var(--destructive))" name="Ocorrências" />
                      <Line yAxisId="right" type="monotone" dataKey="acc" stroke="hsl(var(--primary))" name="% Acumulado" strokeWidth={2} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3">Tendência mensal de rejeições</h3>
                <div className="h-[300px]">
                  <ResponsiveContainer>
                    <LineChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="name" fontSize={10} />
                      <YAxis fontSize={10} />
                      <Tooltip />
                      <Legend />
                      <ReferenceLine y={META_REJEICOES} stroke="hsl(var(--muted-foreground))" strokeDasharray="6 4" label={{ value: `Meta ${META_REJEICOES}`, position: "right", fontSize: 10 }} />
                      <Line type="monotone" dataKey="ng" stroke="hsl(var(--destructive))" strokeWidth={2} name="NG" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            <Card className="p-0 overflow-hidden">
              <div className="px-4 py-3 border-b">
                <h3 className="text-sm font-semibold">Fornecedores</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs">
                    <tr>
                      <th className="text-left px-3 py-2">Fornecedor</th>
                      <th className="text-center px-3 py-2">NG</th>
                      <th className="text-center px-3 py-2">PPM</th>
                      <th className="text-left px-3 py-2">Modo principal</th>
                      <th className="text-center px-3 py-2">Tendência</th>
                      <th className="text-center px-3 py-2">Risco</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplierTable.map((s) => (
                      <tr key={s.name} className="border-t">
                        <td className="px-3 py-2">{s.name}</td>
                        <td className="text-center px-3 py-2 font-semibold">{s.ng}</td>
                        <td className="text-center px-3 py-2">{s.ppm.toLocaleString()}</td>
                        <td className="px-3 py-2 text-muted-foreground">{s.mainModo}</td>
                        <td className="text-center px-3 py-2">
                          {s.trend === "up" && <TrendingUp className="w-4 h-4 text-destructive inline" />}
                          {s.trend === "down" && <TrendingDown className="w-4 h-4 text-emerald-500 inline" />}
                          {s.trend === "flat" && <Minus className="w-4 h-4 text-muted-foreground inline" />}
                        </td>
                        <td className="text-center px-3 py-2">
                          {riskBadge(s.risk === "Alto" ? "alto" : s.risk === "Médio" ? "medio" : "baixo")}
                        </td>
                      </tr>
                    ))}
                    {!supplierTable.length && !isLoading && (
                      <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">Sem dados no período.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* ============ MAPA DE RISCO ============ */}
          <TabsContent value="mapa" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KPICard label="Alto risco" value={<span className="text-destructive">{counts.a}</span>} sub="100% inspeção" />
              <KPICard label="Médio risco" value={<span className="text-amber-600">{counts.m}</span>} sub="Amostral" />
              <KPICard label="Baixo risco" value={<span className="text-emerald-600">{counts.b}</span>} sub="Liberação direta" />
              <KPICard label="Redução de esforço" value={`${counts.reducao}%`} sub="peças fora da 100%" />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">Filtrar:</span>
              <Select value={riskFilter} onValueChange={(v) => setRiskFilter(v as any)}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="alto">Somente alto</SelectItem>
                  <SelectItem value="medio">Somente médio</SelectItem>
                  <SelectItem value="baixo">Liberação direta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs">
                    <tr>
                      <th className="text-left px-3 py-2">Part Number</th>
                      <th className="text-left px-3 py-2">Fornecedor</th>
                      <th className="text-left px-3 py-2">Score</th>
                      <th className="text-center px-3 py-2">NG</th>
                      <th className="text-center px-3 py-2">Dias sem rejeição</th>
                      <th className="text-left px-3 py-2">Modo recorrente</th>
                      <th className="text-left px-3 py-2">Ação recomendada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partsFiltered.map((p) => (
                      <tr
                        key={`${p.pn}-${p.fornecedor}`}
                        className="border-t cursor-pointer hover:bg-muted/40 transition-colors"
                        onClick={() => setDrill({ pn: p.pn, fornecedor: p.fornecedor })}
                      >
                        <td className="px-3 py-2 font-mono text-xs">{p.pn}</td>
                        <td className="px-3 py-2">{p.fornecedor}</td>
                        <td className="px-3 py-2">{scoreBar(p.score, p.classification)}</td>
                        <td className="text-center px-3 py-2">{p.ng}</td>
                        <td className="text-center px-3 py-2">{p.diasSem}</td>
                        <td className="px-3 py-2 text-muted-foreground">{p.modoRecorrente}</td>
                        <td className="px-3 py-2">{riskBadge(p.classification)} <span className="text-xs text-muted-foreground ml-2">{p.recomendacao}</span></td>
                      </tr>
                    ))}
                    {!partsFiltered.length && !isLoading && (
                      <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">Sem peças.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* ============ RECOMENDAÇÕES ============ */}
          <TabsContent value="reco" className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <KPICard label="Peças para inspecionar hoje" value={counts.a + counts.m} sub="alto + médio risco" />
              <KPICard label="Liberação direta disponível" value={counts.b} sub="baixo risco" />
            </div>

            <Card className="border-destructive/30 bg-destructive/5">
              <div className="px-4 py-3 border-b border-destructive/20">
                <h3 className="font-semibold text-destructive">Inspeção 100% — não liberar sem verificação</h3>
              </div>
              <div className="divide-y">
                {parts.filter((p) => p.classification === "alto").map((p) => (
                  <button
                    type="button"
                    key={p.pn + p.fornecedor}
                    onClick={() => setDrill({ pn: p.pn, fornecedor: p.fornecedor })}
                    className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-destructive/10 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-sm">{p.pn} <span className="text-muted-foreground">· {p.fornecedor}</span></div>
                      <div className="text-xs text-muted-foreground">{p.ng} rejeições no período · modo recorrente: {p.modoRecorrente}</div>
                    </div>
                    <Badge className="bg-destructive text-destructive-foreground">Score {p.score}</Badge>
                  </button>
                ))}
                {!counts.a && <div className="px-4 py-6 text-center text-muted-foreground text-sm">Nenhuma peça em inspeção 100%.</div>}
              </div>
            </Card>

            <Card className="border-amber-500/30 bg-amber-500/5">
              <div className="px-4 py-3 border-b border-amber-500/20">
                <h3 className="font-semibold text-amber-700">Inspeção amostral</h3>
              </div>
              <div className="divide-y">
                {parts.filter((p) => p.classification === "medio").map((p) => {
                  const sampling = p.score >= 45 ? "20%" : "10%";
                  return (
                    <button
                      type="button"
                      key={p.pn + p.fornecedor}
                      onClick={() => setDrill({ pn: p.pn, fornecedor: p.fornecedor })}
                      className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-amber-500/10 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-sm">{p.pn} <span className="text-muted-foreground">· {p.fornecedor}</span></div>
                        <div className="text-xs text-muted-foreground">{p.ng} rejeições · modo: {p.modoRecorrente} · amostragem {sampling}</div>
                      </div>
                      <Badge className="bg-amber-500 text-white">Score {p.score}</Badge>
                    </button>
                  );
                })}
                {!counts.m && <div className="px-4 py-6 text-center text-muted-foreground text-sm">Nenhuma peça em amostragem.</div>}
              </div>
            </Card>

            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <div className="px-4 py-3 border-b border-emerald-500/20">
                <h3 className="font-semibold text-emerald-700">Liberação direta — histórico limpo</h3>
              </div>
              <div className="divide-y">
                {parts.filter((p) => p.classification === "baixo").map((p) => (
                  <button
                    type="button"
                    key={p.pn + p.fornecedor}
                    onClick={() => setDrill({ pn: p.pn, fornecedor: p.fornecedor })}
                    className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-emerald-500/10 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-sm">{p.pn} <span className="text-muted-foreground">· {p.fornecedor}</span></div>
                      <div className="text-xs text-muted-foreground">{p.diasSem} dias sem rejeição</div>
                    </div>
                    <Badge className="bg-emerald-500 text-white">Score {p.score}</Badge>
                  </button>
                ))}
                {!counts.b && <div className="px-4 py-6 text-center text-muted-foreground text-sm">Nenhuma peça em liberação direta.</div>}
              </div>
              <div className="px-4 py-3 bg-emerald-500/10 border-t border-emerald-500/20 text-xs text-emerald-800">
                Estas peças possuem histórico verificável no sistema. Liberação direta com rastreabilidade registrada.
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* ============ DRILL-DOWN DIALOG ============ */}
      <Dialog open={!!drill} onOpenChange={(o) => !o && setDrill(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-mono">{drill?.pn}</DialogTitle>
            <DialogDescription>
              {drill?.fornecedor} · histórico completo dos últimos {periodo} dias
            </DialogDescription>
          </DialogHeader>

          {drillData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Card className="p-3"><div className="text-[11px] text-muted-foreground">NG total</div><div className="text-xl font-bold text-destructive">{drillData.totalNg}</div></Card>
                <Card className="p-3"><div className="text-[11px] text-muted-foreground">OK total</div><div className="text-xl font-bold text-emerald-600">{drillData.totalOk}</div></Card>
                <Card className="p-3"><div className="text-[11px] text-muted-foreground">Inspecionadas</div><div className="text-xl font-bold">{drillData.totalInsp}</div></Card>
                <Card className="p-3"><div className="text-[11px] text-muted-foreground">PPM</div><div className="text-xl font-bold">{drillData.ppm.toLocaleString()}</div></Card>
              </div>

              <Card className="p-3">
                <h4 className="text-xs font-semibold mb-2 text-muted-foreground">NG por dia</h4>
                <div className="h-[180px]">
                  <ResponsiveContainer>
                    <LineChart data={drillData.trend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="data" fontSize={10} />
                      <YAxis fontSize={10} />
                      <Tooltip />
                      <Line type="monotone" dataKey="ng" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {drillData.topModos.length > 0 && (
                <Card className="p-3">
                  <h4 className="text-xs font-semibold mb-2 text-muted-foreground">Modos de falha</h4>
                  <div className="space-y-1">
                    {drillData.topModos.map(([modo, qty]) => (
                      <div key={modo} className="flex justify-between text-sm">
                        <span>{modo}</span>
                        <span className="font-semibold text-destructive">{qty}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <Card className="p-0 overflow-hidden">
                <div className="px-3 py-2 border-b text-xs font-semibold text-muted-foreground">
                  Apontamentos ({drillData.rows.length})
                </div>
                <div className="max-h-[280px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2">Data</th>
                        <th className="text-center px-3 py-2">OK</th>
                        <th className="text-center px-3 py-2">NG</th>
                        <th className="text-left px-3 py-2">Modo de falha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drillData.rows.map((r) => (
                        <tr key={r.id} className="border-t">
                          <td className="px-3 py-2">{r.data}</td>
                          <td className="text-center px-3 py-2 text-emerald-600">{r.quantidade_ok || 0}</td>
                          <td className="text-center px-3 py-2 font-semibold text-destructive">{r.quantidade_ng || 0}</td>
                          <td className="px-3 py-2 text-muted-foreground">{r.modo_falha ? stripCode(r.modo_falha) : "—"}</td>
                        </tr>
                      ))}
                      {!drillData.rows.length && (
                        <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">Sem apontamentos.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
