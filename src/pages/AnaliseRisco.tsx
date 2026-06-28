import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  ArrowLeft, ShieldAlert, TrendingUp, TrendingDown, Minus, RefreshCw,
  Search, Download, FileText, ChevronLeft, ChevronRight,
  AlertTriangle, Eye, CheckCircle, HelpCircle, BarChart2, ClipboardList, Loader2,
  Maximize2, ZoomIn, ZoomOut,
} from "lucide-react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, ResponsiveContainer, ReferenceLine, LabelList,
} from "recharts";
import jsPDF from "jspdf";
import logoMobis from "@/assets/hyundai-mobis-logo.png";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { computeAccLabelY, computeBarLabelY } from "@/lib/paretoLabels";

async function urlToBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}


type Apto = {
  id: string;
  data: string;
  tipo: string;
  fornecedor: string | null;
  part_number: string | null;
  part_name: string | null;
  modo_falha: string | null;
  quantidade_ok: number | null;
  quantidade_ng: number | null;
  projeto: string | null;
};

export type PartRisk = {
  pn: string;
  partName: string;
  fornecedor: string;
  projeto?: string;
  ng: number;
  diasSem: number;
  modoRecorrente: string;
  firstNgDate?: string | null;
  lastNgDate?: string | null;
  score: number;
  classification: "alto" | "medio" | "baixo";
  recomendacao: string;
  monthsWithModo: number;
  ppmFornecedor: number;
};


// pt-BR number formatter — uses ponto como separador de milhar (ex.: 7.000)
export const fmt = (n: number) => (n ?? 0).toLocaleString("pt-BR");
// pt-BR percent formatter (ex.: 87,5%)
export const fmtPct = (n: number, digits = 1) =>
  `${(n ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;



const META_REJEICOES = 200;

const stripCode = (s: string) => s.replace(/^\d+\s*-\s*/, "").trim();
const monthKey = (d: string) => d.slice(0, 7);
const daysBetween = (a: Date, b: Date) => Math.floor((b.getTime() - a.getTime()) / 86400000);

export default function AnaliseRisco() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const labelFs = isMobile ? 12 : 13;
  const [chartLayout, setChartLayout] = useState<"single" | "double">("single");
  const [paretoZoomOpen, setParetoZoomOpen] = useState(false);
  const [paretoZoom, setParetoZoom] = useState(150);
  const [periodo, setPeriodo] = useState<"30" | "90" | "100" | "180">("90");
  const [modelFilter, setModelFilter] = useState<"todos" | "bc4b">("todos");
  const [excludeNoise, setExcludeNoise] = useState(true);
  const [showExcluded, setShowExcluded] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [buildingPdf, setBuildingPdf] = useState(false);
  const EXC_LS_KEY = "analise_risco_excluded_filters_v1";
  const initialExcFilters = (() => {
    try {
      const raw = localStorage.getItem(EXC_LS_KEY);
      if (raw) return JSON.parse(raw) as { projeto?: string; modelo?: string; fornecedor?: string; q?: string; sortKey?: string; sortDir?: string };
    } catch { /* noop */ }
    return {};
  })();
  const [excFiltProjeto, setExcFiltProjeto] = useState<string>(initialExcFilters.projeto || "__all__");
  const [excFiltModelo, setExcFiltModelo] = useState<string>(initialExcFilters.modelo || "__all__");
  const [excFiltFornecedor, setExcFiltFornecedor] = useState<string>(initialExcFilters.fornecedor || "__all__");
  const [excSearch, setExcSearch] = useState<string>(initialExcFilters.q || "");
  const [excSortKey, setExcSortKey] = useState<"pn" | "projeto" | "fornecedor" | "ng" | "lastNgDate">((initialExcFilters.sortKey as any) || "ng");
  const [excSortDir, setExcSortDir] = useState<"asc" | "desc">((initialExcFilters.sortDir as any) || "desc");

  useEffect(() => {
    try {
      localStorage.setItem(EXC_LS_KEY, JSON.stringify({
        projeto: excFiltProjeto, modelo: excFiltModelo, fornecedor: excFiltFornecedor,
        q: excSearch, sortKey: excSortKey, sortDir: excSortDir,
      }));
    } catch { /* noop */ }
  }, [excFiltProjeto, excFiltModelo, excFiltFornecedor, excSearch, excSortKey, excSortDir]);

  const chartIsDouble = chartLayout === "double" && !isMobile;
  const paretoChartHeight = chartIsDouble ? "h-[500px]" : "h-[560px]";
  const paretoBottomMargin = chartIsDouble ? 130 : 100;
  const paretoXAxisAngle = chartIsDouble ? -45 : -25;
  const paretoLabelFs = Math.max(11, chartIsDouble ? labelFs - 1 : labelFs);
  // % acumulado: sempre ACIMA do rótulo da barra, ciclando 3 alturas para
  // evitar sobreposição quando os pontos da linha ficam muito próximos.
  const renderParetoAccLabel = (props: any) => {
    const { x, y, value, index } = props;
    if (x == null || y == null || value == null) return null;
    const labelY = computeAccLabelY(y, index ?? 0);
    return (
      <text
        x={x}
        y={labelY}
        textAnchor="middle"
        fontSize={paretoLabelFs}
        fontWeight={700}
        fill="hsl(var(--primary))"
      >
        {`${value}%`}
      </text>
    );
  };

  // NG (barra): pequeno stagger par/ímpar para barras vizinhas de altura similar.
  const renderParetoBarLabel = (props: any) => {
    const { x, y, width, value, index } = props;
    if (x == null || y == null || value == null) return null;
    const cx = x + (width ?? 0) / 2;
    const labelY = computeBarLabelY(y, index ?? 0);
    return (
      <text
        x={cx}
        y={labelY}
        textAnchor="middle"
        fontSize={paretoLabelFs}
        fontWeight={700}
        fill="hsl(var(--foreground))"
      >
        {fmt(Number(value))}
      </text>
    );
  };


  const dateFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - parseInt(periodo, 10));
    return d.toISOString().slice(0, 10);
  }, [periodo]);

  const { data: rawItems = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["analise-risco", dateFrom],
    queryFn: async () => {
      const all: Apto[] = [];
      const PAGE = 1000;
      for (let i = 0; ; i++) {
        const { data, error } = await supabase
          .from("apontamentos")
          .select("id,data,tipo,fornecedor,part_number,part_name,modo_falha,quantidade_ok,quantidade_ng,projeto")
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

  // Registered parts (PN + supplier) — used to detect "registered but never had any apontamento".
  const { data: registeredParts = [] } = useQuery({
    queryKey: ["analise-risco-registered-parts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("part_numbers")
        .select("part_number,part_name,project,origem,suppliers(name)")
        .eq("active", true);
      if (error) throw error;
      return (data || []).map((r: any) => ({
        pn: r.part_number as string,
        partName: r.part_name as string,
        projeto: (r.project as string) || "—",
        fornecedor: r.suppliers?.name || "—",
        origem: (r.origem as string) || "",
      }));
    },
  });

  // Only "LP" parts (origem = 'LP') count in the analysis.
  const lpPartSet = useMemo(
    () => new Set(registeredParts.filter((p) => (p.origem || "").toUpperCase() === "LP").map((p) => p.pn)),
    [registeredParts],
  );

  // Apply LP origin + model filter (BC4B vs todos) before any aggregation.
  const items = useMemo(() => {
    const base = lpPartSet.size > 0
      ? rawItems.filter((i) => i.part_number && lpPartSet.has(i.part_number))
      : rawItems;
    return modelFilter === "bc4b"
      ? base.filter((i) => (i.projeto || "").toUpperCase().includes("BC4B"))
      : base;
  }, [rawItems, modelFilter, lpPartSet]);




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
  // Exported so tests and other modules can reuse this contract.
  
  const parts: PartRisk[] = useMemo(() => {

    type Acc = { pn: string; partName: string; fornecedor: string; projeto: string; ng: number; firstNgDate: string | null; lastNgDate: string | null; modoMonths: Map<string, Set<string>>; modos: Map<string, number> };
    const m = new Map<string, Acc>();
    for (const i of items) {
      if (!i.part_number) continue;
      const key = `${i.part_number}__${i.fornecedor || "—"}`;
      if (!m.has(key)) m.set(key, { pn: i.part_number, partName: i.part_name || "—", fornecedor: i.fornecedor || "—", projeto: i.projeto || "—", ng: 0, firstNgDate: null, lastNgDate: null, modoMonths: new Map(), modos: new Map() });
      const e = m.get(key)!;
      if (i.part_name && e.partName === "—") e.partName = i.part_name;
      if (i.projeto && e.projeto === "—") e.projeto = i.projeto;
      const ng = i.quantidade_ng || 0;
      e.ng += ng;
      if (ng > 0) {
        if (!e.lastNgDate || i.data > e.lastNgDate) e.lastNgDate = i.data;
        if (!e.firstNgDate || i.data < e.firstNgDate) e.firstNgDate = i.data;
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
        pn: e.pn, partName: e.partName, fornecedor: e.fornecedor, projeto: e.projeto, ng: e.ng, diasSem, modoRecorrente,
        firstNgDate: e.firstNgDate, lastNgDate: e.lastNgDate,
        score, classification, recomendacao, monthsWithModo: maxModoMonths, ppmFornecedor,
      };
    }).sort((a, b) => b.score - a.score);
  }, [items, top2PPM, supplierStats, periodo]);

  // Excluded set: parts considered "noise" — registered no fornecedor mas sem lançamento,
  // ou apontamentos altamente recorrentes (mesmo modo em 3+ meses).
  const excludedParts = useMemo(() => {
    const seenKeys = new Set(parts.map((p) => `${p.pn}__${p.fornecedor}`));
    const noLaunch = (registeredParts || [])
      .filter((r) => {
        if (modelFilter === "bc4b" && !(r.projeto || "").toUpperCase().includes("BC4B")) return false;
        return !seenKeys.has(`${r.pn}__${r.fornecedor}`);
      })
      .map((r) => ({ ...r, reason: "sem lançamento" as const, ng: 0, monthsWithModo: 0, modoRecorrente: "—", firstNgDate: null as string | null, lastNgDate: null as string | null }));
    const recurrent = parts
      .filter((p) => p.monthsWithModo >= 3)
      .map((p) => ({ pn: p.pn, partName: p.partName, fornecedor: p.fornecedor, projeto: (p as any).projeto || "—", ng: p.ng, monthsWithModo: p.monthsWithModo, modoRecorrente: p.modoRecorrente, reason: "recorrente" as const, firstNgDate: (p as any).firstNgDate ?? null, lastNgDate: (p as any).lastNgDate ?? null }));
    return [...noLaunch, ...recurrent];
  }, [parts, registeredParts, modelFilter]);

  const excludedFilterOptions = useMemo(() => {
    const projetos = new Set<string>();
    const modelos = new Set<string>();
    const fornecedores = new Set<string>();
    excludedParts.forEach((e: any) => {
      if (e.projeto && e.projeto !== "—") projetos.add(e.projeto);
      if (e.partName && e.partName !== "—") modelos.add(e.partName);
      if (e.fornecedor && e.fornecedor !== "—") fornecedores.add(e.fornecedor);
    });
    const sort = (s: Set<string>) => Array.from(s).sort((a, b) => a.localeCompare(b));
    return { projetos: sort(projetos), modelos: sort(modelos), fornecedores: sort(fornecedores) };
  }, [excludedParts]);

  const filteredExcluded = useMemo(() => {
    const q = excSearch.trim().toLowerCase();
    const arr = excludedParts.filter((e: any) => {
      if (excFiltProjeto !== "__all__" && (e.projeto || "—") !== excFiltProjeto) return false;
      if (excFiltModelo !== "__all__" && (e.partName || "—") !== excFiltModelo) return false;
      if (excFiltFornecedor !== "__all__" && (e.fornecedor || "—") !== excFiltFornecedor) return false;
      if (q) {
        const hay = `${e.pn || ""} ${e.projeto || ""} ${e.partName || ""} ${e.fornecedor || ""} ${e.modoRecorrente || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const dir = excSortDir === "asc" ? 1 : -1;
    arr.sort((a: any, b: any) => {
      const av = a[excSortKey] ?? "";
      const bv = b[excSortKey] ?? "";
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
    return arr;
  }, [excludedParts, excFiltProjeto, excFiltModelo, excFiltFornecedor, excSearch, excSortKey, excSortDir]);


  const excludedKeys = useMemo(
    () => new Set(excludedParts.filter((e) => e.reason === "recorrente").map((e) => `${e.pn}__${e.fornecedor}`)),
    [excludedParts],
  );

  const partsForAnalysis = useMemo(
    () => excludeNoise ? parts.filter((p) => !excludedKeys.has(`${p.pn}__${p.fornecedor}`)) : parts,
    [parts, excludeNoise, excludedKeys],
  );

  const counts = useMemo(() => {
    const a = partsForAnalysis.filter((p) => p.classification === "alto").length;
    const m = partsForAnalysis.filter((p) => p.classification === "medio").length;
    const b = partsForAnalysis.filter((p) => p.classification === "baixo").length;
    const total = partsForAnalysis.length || 1;
    return { a, m, b, total, reducao: Math.round((b / total) * 100) };
  }, [partsForAnalysis]);

  const [riskFilter, setRiskFilter] = useState<"todas" | "alto" | "medio" | "baixo">("todas");
  const partsFiltered = useMemo(
    () => riskFilter === "todas" ? partsForAnalysis : partsForAnalysis.filter((p) => p.classification === riskFilter),
    [partsForAnalysis, riskFilter],
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

  // Drill-down: search + pagination + a11y
  const PAGE_SIZE = 15;
  const [drillSearch, setDrillSearch] = useState("");
  const [drillPage, setDrillPage] = useState(1);
  const drillSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDrillSearch("");
    setDrillPage(1);
    if (drill) {
      const t = setTimeout(() => drillSearchRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [drill]);

  const drillFilteredRows = useMemo(() => {
    if (!drillData) return [];
    const q = drillSearch.trim().toLowerCase();
    if (!q) return drillData.rows;
    return drillData.rows.filter((r) =>
      r.data.toLowerCase().includes(q) ||
      (r.modo_falha ? stripCode(r.modo_falha).toLowerCase().includes(q) : false),
    );
  }, [drillData, drillSearch]);

  const drillTotalPages = Math.max(1, Math.ceil(drillFilteredRows.length / PAGE_SIZE));
  const drillPageSafe = Math.min(drillPage, drillTotalPages);
  const drillPagedRows = useMemo(
    () => drillFilteredRows.slice((drillPageSafe - 1) * PAGE_SIZE, drillPageSafe * PAGE_SIZE),
    [drillFilteredRows, drillPageSafe],
  );

  useEffect(() => { setDrillPage(1); }, [drillSearch]);

  const exportDrillCSV = () => {
    if (!drill || !drillData) return;
    const header = ["Data", "OK", "NG", "Modo de falha"];
    const lines = [
      `# Peça: ${drill.pn} | Fornecedor: ${drill.fornecedor} | Período: ${periodo} dias`,
      header.join(","),
      ...drillData.rows.map((r) => [
        r.data,
        r.quantidade_ok || 0,
        r.quantidade_ng || 0,
        `"${(r.modo_falha ? stripCode(r.modo_falha) : "").replace(/"/g, '""')}"`,
      ].join(",")),
    ];
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historico_${drill.pn}_${periodo}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const drillChartRef = useRef<HTMLDivElement>(null);

  const buildDrillPdf = async () => {
    if (!drill || !drillData) return null;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const M = 12;
    const now = new Date();

    const HYUNDAI_BLUE: [number, number, number] = [0, 47, 108];
    const NAVY: [number, number, number] = [31, 78, 121];
    const TEAL: [number, number, number] = [13, 148, 136];
    const RED: [number, number, number] = [196, 30, 58];
    const SLATE: [number, number, number] = [71, 85, 105];
    const MUTED: [number, number, number] = [148, 163, 184];
    const SOFT: [number, number, number] = [241, 245, 249];
    const ZEBRA: [number, number, number] = [249, 250, 251];
    const EMERALD: [number, number, number] = [16, 122, 87];
    const GREY: [number, number, number] = [107, 114, 128];

    const logoB64 = await urlToBase64(logoMobis);

    // Capture chart
    let chartImg: string | null = null;
    let chartRatio = 0;
    if (drillChartRef.current) {
      try {
        const html2canvas = (await import("html2canvas")).default;
        const canvas = await html2canvas(drillChartRef.current, {
          backgroundColor: "#ffffff", scale: 2, useCORS: true,
        });
        chartImg = canvas.toDataURL("image/png");
        chartRatio = canvas.height / canvas.width;
      } catch {}
    }

    const drawHeader = () => {
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageW, 22, "F");
      doc.setFillColor(...HYUNDAI_BLUE);
      doc.rect(0, 22, pageW, 1.2, "F");
      if (logoB64) { try { doc.addImage(logoB64, "PNG", M, 5, 38, 12); } catch {} }
      doc.setTextColor(...HYUNDAI_BLUE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text(`Histórico Completo — ${drill.pn}`, pageW - M, 11, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...SLATE);
      doc.text(
        `${drill.fornecedor} · Últimos ${periodo} dias · Gerado em ${now.toLocaleString("pt-BR")}`,
        pageW - M, 17, { align: "right" }
      );
    };

    const drawFooter = (page: number, pages: number) => {
      doc.setDrawColor(...MUTED); doc.setLineWidth(0.2);
      doc.line(M, pageH - 10, pageW - M, pageH - 10);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8); doc.setTextColor(...GREY);
      doc.text("Hyundai Mobis — Quality Tools", M, pageH - 5);
      doc.text(`Página ${page} de ${pages}`, pageW - M, pageH - 5, { align: "right" });
    };

    drawHeader();
    let y = 32;

    // ===== KPIs =====
    doc.setTextColor(...HYUNDAI_BLUE);
    doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("Resumo", M, y);
    doc.setDrawColor(...HYUNDAI_BLUE); doc.setLineWidth(0.6);
    doc.line(M, y + 1.5, M + 22, y + 1.5);
    y += 6;

    const cardW = (pageW - M * 2 - 9) / 4;
    const cardH = 20;
    const kpis: Array<{ label: string; value: string; tone: [number, number, number] }> = [
      { label: "NG Total", value: fmt(drillData.totalNg), tone: RED },
      { label: "OK Total", value: fmt(drillData.totalOk), tone: EMERALD },
      { label: "Inspecionadas", value: fmt(drillData.totalInsp), tone: NAVY },
      { label: "PPM", value: fmt(drillData.ppm), tone: [180, 83, 9] },
    ];
    kpis.forEach((k, i) => {
      const x = M + i * (cardW + 3);
      doc.setFillColor(...SOFT);
      doc.roundedRect(x, y, cardW, cardH, 2, 2, "F");
      doc.setFillColor(...k.tone);
      doc.rect(x, y, 1.6, cardH, "F");
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...SLATE);
      doc.text(k.label.toUpperCase(), x + 4, y + 6);
      doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(...k.tone);
      doc.text(k.value, x + 4, y + 15);
    });
    y += cardH + 5;

    // ===== Chart + Top Modos side by side =====
    const colW = (pageW - M * 2 - 6) / 2;
    const blockTop = y;
    const chartH = chartImg ? Math.min(70, colW * chartRatio) : 60;

    // Chart card
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.setTextColor(...HYUNDAI_BLUE);
    doc.text("NG por dia", M, blockTop);
    doc.setDrawColor(...HYUNDAI_BLUE); doc.setLineWidth(0.5);
    doc.line(M, blockTop + 1.2, M + 18, blockTop + 1.2);
    if (chartImg) {
      try { doc.addImage(chartImg, "PNG", M, blockTop + 3, colW, chartH); } catch {}
    } else {
      doc.setFillColor(...SOFT);
      doc.roundedRect(M, blockTop + 3, colW, chartH, 1.5, 1.5, "F");
    }

    // Top modos card
    const x2 = M + colW + 6;
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.setTextColor(...HYUNDAI_BLUE);
    doc.text("Modos de falha", x2, blockTop);
    doc.setDrawColor(...TEAL); doc.setLineWidth(0.5);
    doc.line(x2, blockTop + 1.2, x2 + 22, blockTop + 1.2);
    const modos = drillData.topModos.slice(0, 8);
    const bh = Math.max(chartH, modos.length * 5.5 + 4);
    doc.setFillColor(...SOFT);
    doc.roundedRect(x2, blockTop + 3, colW, bh, 1.5, 1.5, "F");
    let by = blockTop + 8;
    if (!modos.length) {
      doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.setTextColor(...GREY);
      doc.text("Sem dados", x2 + 3, by);
    } else {
      doc.setFontSize(8.5);
      modos.forEach(([modo, qty]) => {
        const lbl = modo.length > 56 ? modo.slice(0, 55) + "…" : modo;
        doc.setFont("helvetica", "normal"); doc.setTextColor(...SLATE);
        doc.text(lbl, x2 + 3, by);
        doc.setFont("helvetica", "bold"); doc.setTextColor(...RED);
        doc.text(fmt(qty), x2 + colW - 3, by, { align: "right" });
        by += 5.5;
      });
    }
    y = blockTop + 3 + Math.max(chartH, bh) + 5;

    // ===== TABLE =====
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("Apontamentos", M, y);
    doc.setDrawColor(...RED); doc.setLineWidth(0.6);
    doc.line(M, y + 1.5, M + 28, y + 1.5);
    y += 5;

    const cols = [
      { h: "Data", w: 30, align: "left" as const },
      { h: "OK", w: 25, align: "right" as const },
      { h: "NG", w: 25, align: "right" as const },
      { h: "Modo de falha", w: pageW - M * 2 - 80, align: "left" as const },
    ];
    const rowH = 7;

    const drawTableHeader = () => {
      doc.setFillColor(...NAVY);
      doc.rect(M, y, pageW - M * 2, rowH, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold"); doc.setFontSize(9);
      let cx = M;
      cols.forEach((c) => {
        const tx = c.align === "right" ? cx + c.w - 2 : cx + 2;
        doc.text(c.h, tx, y + 4.8, { align: c.align });
        cx += c.w;
      });
      y += rowH;
    };
    drawTableHeader();

    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    drillData.rows.forEach((r: any, idx: number) => {
      if (y + rowH > pageH - 14) {
        drawFooter(doc.getNumberOfPages(), 0);
        doc.addPage();
        drawHeader();
        y = 30;
        drawTableHeader();
        doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
      }
      if (idx % 2 === 0) {
        doc.setFillColor(...ZEBRA);
        doc.rect(M, y, pageW - M * 2, rowH, "F");
      }
      const ng = r.quantidade_ng || 0;
      const ok = r.quantidade_ok || 0;
      const modo = r.modo_falha ? stripCode(r.modo_falha) : "—";
      const values: Array<{ v: string; tone: [number, number, number]; bold?: boolean }> = [
        { v: String(r.data), tone: SLATE },
        { v: fmt(ok), tone: EMERALD },
        { v: fmt(ng), tone: ng > 0 ? RED : SLATE, bold: ng > 0 },
        { v: modo, tone: SLATE },
      ];
      let cx = M;
      values.forEach((cell, ci) => {
        const c = cols[ci];
        doc.setFont("helvetica", cell.bold ? "bold" : "normal");
        doc.setTextColor(...cell.tone);
        const tx = c.align === "right" ? cx + c.w - 2 : cx + 2;
        const txt = ci === 3
          ? (cell.v.length > 90 ? cell.v.slice(0, 89) + "…" : cell.v)
          : cell.v;
        doc.text(txt, tx, y + 4.8, { align: c.align });
        cx += c.w;
      });
      y += rowH;
    });

    doc.setDrawColor(...MUTED); doc.setLineWidth(0.2);
    doc.line(M, y, pageW - M, y);

    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) { doc.setPage(p); drawFooter(p, pages); }
    return doc;
  };

  const exportDrillPDF = async () => {
    setBuildingPdf(true);
    try {
      const doc = await buildDrillPdf();
      if (doc && drill) doc.save(`historico_${drill.pn}_${periodo}d.pdf`);
    } finally { setBuildingPdf(false); }
  };

  const previewDrillPDF = async () => {
    setBuildingPdf(true);
    try {
      const doc = await buildDrillPdf();
      if (!doc) return;
      const blob = doc.output("blob") as Blob;
      const url = URL.createObjectURL(blob);
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(url);
    } catch (e) {
      console.error("Erro ao gerar pré-visualização do PDF:", e);
      toast.error("Não foi possível gerar a pré-visualização do PDF");
    } finally { setBuildingPdf(false); }
  };


  // ---------- UI helpers ----------
  const KPICard = ({ label, value, sub, subTone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; subTone?: "red" | "amber" | "green" | "muted" }) => {
    const subClass =
      subTone === "red" ? "text-destructive" :
      subTone === "amber" ? "text-amber-500" :
      subTone === "green" ? "text-emerald-500" :
      "text-muted-foreground";
    return (
      <Card className="p-4 bg-card border-border">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
        <div className="text-2xl md:text-3xl font-heading font-bold mt-1 text-foreground">{value}</div>
        {sub && <div className={`text-[11px] mt-1 font-medium ${subClass}`}>{sub}</div>}
      </Card>
    );
  };

  const riskBadge = (c: "alto" | "medio" | "baixo") => {
    if (c === "alto") return (
      <Badge className="bg-destructive/15 text-destructive border-destructive/30 gap-1">
        <AlertTriangle className="w-3.5 h-3.5" /> Alto
      </Badge>
    );
    if (c === "medio") return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">Médio</Badge>;
    return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Baixo</Badge>;
  };

  const trendBadge = (t: "up" | "down" | "flat") => {
    if (t === "up") return (
      <Badge className="bg-destructive/15 text-destructive border-destructive/30 gap-1">
        <TrendingUp className="w-3.5 h-3.5" /> subindo
      </Badge>
    );
    if (t === "down") return (
      <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 gap-1">
        <TrendingDown className="w-3.5 h-3.5" /> caindo
      </Badge>
    );
    return <Badge className="bg-muted text-muted-foreground border-border">— estável</Badge>;
  };

  const scoreCircle = (score: number, c: "alto" | "medio" | "baixo") => {
    const cls =
      c === "alto" ? "bg-destructive/15 text-destructive ring-destructive/30" :
      c === "medio" ? "bg-amber-500/15 text-amber-600 ring-amber-500/30" :
      "bg-emerald-500/15 text-emerald-600 ring-emerald-500/30";
    return (
      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full ring-1 font-bold text-sm ${cls}`}>
        {score}
      </div>
    );
  };

  const ngColor = (ng: number) => {
    if (ng >= 10) return "text-destructive";
    if (ng >= 1) return "text-amber-600";
    return "text-emerald-600";
  };

  const actionBadge = (c: "alto" | "medio" | "baixo", text: string) => {
    if (c === "alto") return <Badge className="bg-destructive/15 text-destructive border-destructive/30">{text}</Badge>;
    if (c === "medio") return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">{text}</Badge>;
    return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">{text}</Badge>;
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
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}><ArrowLeft className="w-5 h-5" /></Button>
          <ShieldAlert className="w-6 h-6 text-primary" />
          <div className="flex-1 min-w-[180px]">
            <h1 className="text-lg font-heading font-bold">Análise de Risco</h1>
            <p className="text-xs text-muted-foreground">Baseado em apontamentos de Incoming</p>
          </div>
          <div className="flex items-center gap-1 rounded-md border bg-background p-0.5">
            <Button
              size="sm" variant={modelFilter === "bc4b" && periodo === "100" ? "default" : "ghost"}
              className="h-8 text-xs"
              onClick={() => { setModelFilter("bc4b"); setPeriodo("100"); }}
            >100 dias · BC4B</Button>
            <Button
              size="sm" variant={modelFilter === "todos" ? "default" : "ghost"}
              className="h-8 text-xs"
              onClick={() => setModelFilter("todos")}
            >Todos</Button>
          </div>
          <Button
            size="sm" variant={excludeNoise ? "default" : "outline"}
            className="h-8 text-xs"
            onClick={() => setExcludeNoise((v) => !v)}
            title="Desconsidera peças recorrentes/sem lançamento na análise"
          >
            {excludeNoise ? "Excluindo ruído" : "Incluindo todos"}
          </Button>
          <Button
            size="sm" variant="outline" className="h-8 text-xs"
            onClick={() => setShowExcluded(true)}
          >
            Ver excluídos ({excludedParts.length})
          </Button>
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as any)}>
            <SelectTrigger className="w-[150px] h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="100">Últimos 100 dias</SelectItem>
              <SelectItem value="180">Últimos 180 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm" variant="outline" className="h-8 text-xs gap-1"
            onClick={() => setShowHelp(true)}
            title="Entenda este módulo"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Entenda este módulo
          </Button>
        </div>
      </header>


      <main className="max-w-7xl mx-auto px-4 py-6">
        {isError && (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm flex items-center justify-between gap-3">
            <span className="text-destructive">Não foi possível carregar os dados para o período selecionado.</span>
            <Button size="sm" variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
          </div>
        )}
        {!isLoading && !isError && rawItems.length === 0 && (
          <div className="mb-4 rounded-md border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Nenhum apontamento encontrado nos últimos {periodo} dias{modelFilter === "bc4b" ? " para o modelo BC4B" : ""}.
          </div>
        )}

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
                <KPICard label="Peças NG (90d)" value={fmt(totalNG)} sub="▲ 12% vs período anterior" subTone="red" />
                <KPICard label="Modos de falha distintos" value={fmt(modosFalha.length)} sub="— estável" subTone="amber" />
                <KPICard label="PPM médio (fornecedores)" value={fmt(ppmMedio)} sub="▲ 8% vs período anterior" subTone="red" />
                <KPICard label="Fornecedores reincidentes" value={fmt(reincidentes)} sub="▲ 1 novo este mês" subTone="red" />

              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold">Exibição dos gráficos</h3>
                <p className="text-[11px] text-muted-foreground">Alterna entre visualização vertical ou lado a lado.</p>
              </div>
              <div className="grid grid-cols-2 gap-1 rounded-md border bg-muted/30 p-1 sm:w-[260px]">
                <button
                  type="button"
                  onClick={() => setChartLayout("single")}
                  className={`h-9 rounded-sm text-xs font-semibold transition-colors ${chartLayout === "single" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-background"}`}
                >
                  1 por linha
                </button>
                <button
                  type="button"
                  onClick={() => setChartLayout("double")}
                  className={`h-9 rounded-sm text-xs font-semibold transition-colors ${chartLayout === "double" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-background"}`}
                >
                  2 por linha
                </button>
              </div>
            </div>

            <div className={chartLayout === "double" ? "grid gap-4 lg:grid-cols-2" : "space-y-4"}>
              <Card className="p-4 min-w-0">
                <div className="flex items-start justify-between mb-1 gap-2">
                  <h3 className="text-sm font-semibold">Pareto dos modos de falha</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground hidden sm:inline">Top 10 · ordenado por ocorrências</span>
                    <Button size="sm" variant="outline" className="h-7 px-2 gap-1" onClick={() => setParetoZoomOpen(true)}>
                      <Maximize2 className="h-3.5 w-3.5" /> Ampliar
                    </Button>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mb-3">
                  Barras = quantidade de peças NG por modo. Linha = % acumulada (regra 80/20).
                </p>
                <div className={paretoChartHeight}>
                  <ResponsiveContainer>
                    <ComposedChart data={paretoData} margin={{ top: 64, right: 42, left: 10, bottom: paretoBottomMargin }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="name" angle={paretoXAxisAngle} textAnchor="end" interval={0} fontSize={11} height={paretoBottomMargin} />
                      <YAxis yAxisId="left" fontSize={11} label={{ value: "Peças NG", angle: -90, position: "insideLeft", fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%" fontSize={11} />
                      <Tooltip
                        formatter={(v: any, n: any) => {
                          if (typeof v !== "number") return [v, n];
                          if (n === "% Acumulado") return [fmtPct(v, 0), n];
                          return [`${fmt(v)} peças NG`, n];
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar yAxisId="left" dataKey="value" fill="hsl(var(--destructive))" name="Ocorrências (NG)" maxBarSize={chartIsDouble ? 52 : 70}>
                        <LabelList dataKey="value" content={renderParetoBarLabel} />
                      </Bar>
                      <Line yAxisId="right" type="monotone" dataKey="acc" stroke="hsl(var(--primary))" name="% Acumulado" strokeWidth={2} dot={{ r: 3 }}>
                        <LabelList dataKey="acc" content={renderParetoAccLabel} />
                      </Line>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-4 min-w-0">
                <div className="flex items-start justify-between mb-1 gap-2">
                  <h3 className="text-sm font-semibold">Tendência mensal de rejeições</h3>
                  <span className="text-[10px] text-muted-foreground">Agrupado por mês · meta {fmt(META_REJEICOES)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mb-3">
                  Soma mensal de peças NG. Linha pontilhada = meta máxima aceitável no período.
                </p>
                <div className={chartIsDouble ? "h-[500px]" : "h-[440px]"}>
                  <ResponsiveContainer>
                    <LineChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="name" fontSize={11} />
                      <YAxis fontSize={11} label={{ value: "Peças NG", angle: -90, position: "insideLeft", fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip
                        labelFormatter={(l) => `Mês: ${l}`}
                        formatter={(v: any) => (typeof v === "number" ? [`${fmt(v)} peças NG`, "Rejeições"] : [v, ""])}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <ReferenceLine y={META_REJEICOES} stroke="hsl(var(--muted-foreground))" strokeDasharray="6 4" label={{ value: `Meta ${fmt(META_REJEICOES)}`, position: "right", fontSize: 10 }} />
                      <Line type="monotone" dataKey="ng" stroke="hsl(var(--destructive))" strokeWidth={2} name="Rejeições (NG)">
                        <LabelList dataKey="ng" position="top" offset={8} fontSize={labelFs} fontWeight={600} formatter={(v: any) => fmt(v)} fill="hsl(var(--foreground))" />
                      </Line>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            <Card className="p-0 overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-sm font-semibold">Fornecedores</h3>
                <span className="text-[10px] text-muted-foreground">
                  Risco: Alto ≥ 10.000 PPM ou ≥ 30 NG · Médio ≥ 3.000 PPM ou ≥ 10 NG
                </span>
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
                        <td className="text-center px-3 py-2 font-semibold">{fmt(s.ng)}</td>
                        <td className="text-center px-3 py-2">{fmt(s.ppm)}</td>

                        <td className="px-3 py-2 text-muted-foreground">{s.mainModo}</td>
                        <td className="text-center px-3 py-2">{trendBadge(s.trend)}</td>
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
              <KPICard label="Alto risco" value={<span className="text-destructive">{fmt(counts.a)}</span>} sub="100% inspeção" />
              <KPICard label="Médio risco" value={<span className="text-amber-600">{fmt(counts.m)}</span>} sub="Amostral" />
              <KPICard label="Baixo risco" value={<span className="text-emerald-600">{fmt(counts.b)}</span>} sub="Liberação direta" />
              <KPICard label="Redução de esforço" value={`${counts.reducao}%`} sub="vs inspeção 100% atual" subTone="green" />

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
              <div className="px-3 py-2 border-b text-[10px] text-muted-foreground">
                Score 0–100 · Alto ≥ 60 (inspeção 100%) · Médio 30–59 (amostral) · Baixo &lt; 30 (liberação direta)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[820px]">
                  <thead className="bg-muted/40 text-xs">
                    <tr>
                      <th className="text-left px-3 py-2 w-[130px]">Part Number</th>
                      <th className="text-left px-3 py-2">Part Name</th>
                      <th className="text-left px-3 py-2 w-[160px]">Fornecedor</th>
                      <th className="text-center px-3 py-2 w-[80px]">Score</th>
                      <th className="text-center px-3 py-2 w-[80px]">NG</th>
                      <th className="text-center px-3 py-2 w-[110px]">Dias s/ rej.</th>
                      <th className="text-left px-3 py-2 w-[180px]">Modo recorrente</th>
                      <th className="text-left px-3 py-2 w-[160px]">Ação recomendada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partsFiltered.map((p) => (
                      <tr
                        key={`${p.pn}-${p.fornecedor}`}
                        className="border-t cursor-pointer hover:bg-muted/40 transition-colors"
                        onClick={() => setDrill({ pn: p.pn, fornecedor: p.fornecedor })}
                      >
                        <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{p.pn}</td>
                        <td className="px-3 py-2 max-w-[260px] truncate" title={p.partName}>{p.partName}</td>
                        <td className="px-3 py-2 truncate" title={p.fornecedor}>{p.fornecedor}</td>
                        <td className="text-center px-3 py-2">{scoreCircle(p.score, p.classification)}</td>
                        <td className={`text-center px-3 py-2 font-semibold tabular-nums ${ngColor(p.ng)}`}>{fmt(p.ng)}</td>
                        <td className="text-center px-3 py-2 tabular-nums">{fmt(p.diasSem)}</td>
                        <td className="px-3 py-2 text-muted-foreground truncate" title={p.modoRecorrente}>{p.modoRecorrente}</td>
                        <td className="px-3 py-2">{actionBadge(p.classification, p.recomendacao)}</td>
                      </tr>
                    ))}
                    {!partsFiltered.length && !isLoading && (
                      <tr><td colSpan={8} className="text-center py-6 text-muted-foreground">Sem peças.</td></tr>
                    )}
                  </tbody>

                </table>
              </div>
            </Card>
          </TabsContent>

          {/* ============ RECOMENDAÇÕES ============ */}
          <TabsContent value="reco" className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <KPICard label="Peças para inspecionar hoje" value={counts.a + counts.m} sub="prioridade alta" subTone="red" />
              <KPICard label="Liberação direta disponível" value={counts.b} sub="histórico limpo ≥ 60 dias" subTone="green" />
            </div>

            <Card className="border-destructive/30 bg-destructive/5">
              <div className="px-4 py-3 border-b border-destructive/20">
                <h3 className="font-semibold uppercase tracking-wide text-xs text-destructive">Inspeção 100% — não liberar sem verificação</h3>
              </div>
              <div className="divide-y">
                {partsForAnalysis.filter((p) => p.classification === "alto").map((p) => (
                  <button
                    type="button"
                    key={p.pn + p.fornecedor}
                    onClick={() => setDrill({ pn: p.pn, fornecedor: p.fornecedor })}
                    className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-destructive/10 transition-colors"
                  >
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-destructive/20 flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-destructive" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-sm font-semibold">{p.pn} <span className="text-muted-foreground font-sans font-normal">· {p.fornecedor}</span></div>
                      <div className="text-xs text-muted-foreground">{p.ng} rejeições no período · modo recorrente: {p.modoRecorrente}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge className="bg-destructive/15 text-destructive border-destructive/30">Score {p.score}</Badge>
                      <span className="text-[10px] text-muted-foreground">Focar em cotas críticas</span>
                    </div>
                  </button>
                ))}
                {!counts.a && <div className="px-4 py-6 text-center text-muted-foreground text-sm">Nenhuma peça em inspeção 100%.</div>}
              </div>
            </Card>

            <Card className="border-amber-500/30 bg-amber-500/5">
              <div className="px-4 py-3 border-b border-amber-500/20">
                <h3 className="font-semibold uppercase tracking-wide text-xs text-amber-600">Inspeção amostral — verificar lote reduzido</h3>
              </div>
              <div className="divide-y">
                {partsForAnalysis.filter((p) => p.classification === "medio").map((p) => {
                  const sampling = p.score >= 45 ? "20%" : "10%";
                  return (
                    <button
                      type="button"
                      key={p.pn + p.fornecedor}
                      onClick={() => setDrill({ pn: p.pn, fornecedor: p.fornecedor })}
                      className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-amber-500/10 transition-colors"
                    >
                      <div className="shrink-0 w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                        <Eye className="w-5 h-5 text-amber-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-sm font-semibold">{p.pn} <span className="text-muted-foreground font-sans font-normal">· {p.fornecedor}</span></div>
                        <div className="text-xs text-muted-foreground">{p.ng} rejeições · modo: {p.modoRecorrente} · amostragem {sampling}</div>
                      </div>
                      <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 shrink-0">Score {p.score}</Badge>
                    </button>
                  );
                })}
                {!counts.m && <div className="px-4 py-6 text-center text-muted-foreground text-sm">Nenhuma peça em amostragem.</div>}
              </div>
            </Card>

            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <div className="px-4 py-3 border-b border-emerald-500/20">
                <h3 className="font-semibold uppercase tracking-wide text-xs text-emerald-600">Liberação direta — histórico limpo</h3>
              </div>
              <div className="divide-y">
                {partsForAnalysis.filter((p) => p.classification === "baixo").map((p) => (
                  <button
                    type="button"
                    key={p.pn + p.fornecedor}
                    onClick={() => setDrill({ pn: p.pn, fornecedor: p.fornecedor })}
                    className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-emerald-500/10 transition-colors"
                  >
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-sm font-semibold">{p.pn} <span className="text-muted-foreground font-sans font-normal">· {p.fornecedor}</span></div>
                      <div className="text-xs text-muted-foreground">{p.diasSem} dias sem rejeição · liberação direta com rastreabilidade</div>
                    </div>
                  </button>
                ))}
                {!counts.b && <div className="px-4 py-6 text-center text-muted-foreground text-sm">Nenhuma peça em liberação direta.</div>}
              </div>
            </Card>

          </TabsContent>
        </Tabs>
      </main>

      {/* ============ EXCLUDED PARTS DIALOG ============ */}
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-[560px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Como funciona a Análise de Risco</DialogTitle>
            <DialogDescription>
              Este módulo transforma o histórico de apontamentos em inteligência de inspeção, permitindo focar esforço onde o risco é real.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2 text-sm">
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-base">Painel de Falhas</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Visão analítica do histórico de rejeições. Os 4 indicadores no topo mostram o panorama geral do período selecionado. O gráfico de Pareto revela quais modos de falha concentram a maior parte das rejeições — em geral, 3 ou 4 modos respondem por mais de 70% dos problemas. O gráfico de tendência mostra se a situação está melhorando ou piorando mês a mês. A tabela de fornecedores classifica quem mais impacta a qualidade e sinaliza se o problema está subindo, estável ou em queda.
              </p>
            </section>

            <div className="border-t" />

            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-base">Mapa de Risco</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Cada peça recebe automaticamente um score de risco de 0 a 100, calculado com base em quatro critérios do histórico de apontamentos:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground leading-relaxed">
                <li><span className="font-medium text-foreground">Histórico de rejeições (peso alto):</span> quantidade de peças NG nos últimos 90 dias. Quanto mais rejeições, maior o score.</li>
                <li><span className="font-medium text-foreground">Reincidência do modo de falha (peso alto):</span> se o mesmo tipo de problema se repetiu em 2 ou mais meses distintos, o risco sobe significativamente.</li>
                <li><span className="font-medium text-foreground">Fornecedor de alto PPM (peso médio):</span> peças de fornecedores no topo do ranking de PPM herdam parte do risco do fornecedor.</li>
                <li><span className="font-medium text-foreground">Dias sem rejeição (reduz o risco):</span> peças com 30 ou mais dias sem nenhuma ocorrência recebem bônus negativo, reduzindo o score. Acima de 60 dias limpos, a redução é maior.</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed">
                A classificação final define a ação recomendada: score acima de 60 exige inspeção 100%; entre 30 e 60, inspeção amostral; abaixo de 30, liberação direta autorizada.
              </p>
            </section>

            <div className="border-t" />

            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-base">Recomendações do Dia</h3>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Tradução operacional do Mapa de Risco para o trabalho diário. A lista é gerada automaticamente e organizada em três grupos:
              </p>
              <ul className="space-y-2">
                <li className="flex gap-2 text-muted-foreground leading-relaxed">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span><span className="font-medium text-foreground">Inspeção 100%:</span> peças com score alto. Nenhum lote deve ser liberado sem verificação completa. O sistema indica o ponto de atenção principal de cada peça.</span>
                </li>
                <li className="flex gap-2 text-muted-foreground leading-relaxed">
                  <Eye className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span><span className="font-medium text-foreground">Inspeção amostral:</span> peças com risco médio. Verificar uma amostra do lote (10% ou 20% conforme o score) é suficiente para garantir a qualidade.</span>
                </li>
                <li className="flex gap-2 text-muted-foreground leading-relaxed">
                  <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  <span><span className="font-medium text-foreground">Liberação direta:</span> peças com histórico limpo comprovado. Podem ser liberadas sem inspeção manual, com rastreabilidade registrada no sistema — argumento válido para comunicação com a logística.</span>
                </li>
              </ul>
            </section>

            <div className="border-t" />

            <p className="text-xs text-muted-foreground">
              O score é recalculado automaticamente a cada acesso, com base nos apontamentos registrados no período selecionado.
            </p>

            <div className="flex justify-end">
              <Button onClick={() => setShowHelp(false)}>Entendi</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showExcluded} onOpenChange={setShowExcluded}>
        <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col gap-3 p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Peças desconsideradas da análise</DialogTitle>
            <DialogDescription>
              Registradas no fornecedor sem nenhum apontamento no período, ou com apontamentos altamente recorrentes (mesmo modo em 3+ meses).
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1 min-w-0">
              <label className="text-[11px] font-medium text-muted-foreground">Projeto</label>
              <Select value={excFiltProjeto} onValueChange={setExcFiltProjeto}>
                <SelectTrigger className="h-10 text-xs w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {excludedFilterOptions.projetos.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1 min-w-0">
              <label className="text-[11px] font-medium text-muted-foreground">Modelo (peça)</label>
              <Select value={excFiltModelo} onValueChange={setExcFiltModelo}>
                <SelectTrigger className="h-10 text-xs w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {excludedFilterOptions.modelos.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1 min-w-0">
              <label className="text-[11px] font-medium text-muted-foreground">Fornecedor</label>
              <Select value={excFiltFornecedor} onValueChange={setExcFiltFornecedor}>
                <SelectTrigger className="h-10 text-xs w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {excludedFilterOptions.fornecedores.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1 min-w-0">
              <label className="text-[11px] font-medium text-muted-foreground">Busca</label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={excSearch}
                  onChange={(e) => setExcSearch(e.target.value)}
                  placeholder="PN / Projeto / Modelo / Fornecedor"
                  className="h-10 text-xs pl-7 w-full"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground flex-wrap">
            <span>{filteredExcluded.length} de {excludedParts.length} registros</span>
            {(excFiltProjeto !== "__all__" || excFiltModelo !== "__all__" || excFiltFornecedor !== "__all__" || excSearch) && (
              <Button
                variant="ghost" size="sm" className="h-8 text-xs"
                onClick={() => { setExcFiltProjeto("__all__"); setExcFiltModelo("__all__"); setExcFiltFornecedor("__all__"); setExcSearch(""); }}
              >
                Limpar filtros
              </Button>
            )}
          </div>


          <div className="flex flex-wrap justify-end gap-2">

            {(() => {
              const buildExcludedPdf = async () => {
                const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
                const pageW = doc.internal.pageSize.getWidth();
                const pageH = doc.internal.pageSize.getHeight();
                const M = 12;
                const now = new Date();


                // Palette — header uses Mobis HYUNDAI blue (not red, since the logo "O" already provides red accent)
                const HYUNDAI_BLUE: [number, number, number] = [0, 47, 108];
                const NAVY: [number, number, number] = [31, 78, 121];
                const TEAL: [number, number, number] = [13, 148, 136];
                const RED: [number, number, number] = [196, 30, 58];
                const SLATE: [number, number, number] = [71, 85, 105];
                const MUTED: [number, number, number] = [148, 163, 184];
                const SOFT: [number, number, number] = [241, 245, 249];
                const ZEBRA: [number, number, number] = [249, 250, 251];
                const AMBER: [number, number, number] = [180, 83, 9];
                const GREY: [number, number, number] = [107, 114, 128];

                const logoB64 = await urlToBase64(logoMobis);

                const pdfData = filteredExcluded;
                const semLanc = pdfData.filter((e: any) => e.reason === "sem lançamento").length;
                const recorr = pdfData.length - semLanc;
                const totalNG = pdfData.reduce((a: number, e: any) => a + (e.ng || 0), 0);

                // Breakdown by Modelo (projeto) and Módulo (fornecedor)
                const groupCount = (key: "projeto" | "fornecedor") => {
                  const m = new Map<string, number>();
                  pdfData.forEach((e: any) => {
                    const k = (e[key] || "—").toString().trim() || "—";
                    m.set(k, (m.get(k) || 0) + 1);
                  });
                  return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
                };
                const porModelo = groupCount("projeto");
                const porModulo = groupCount("fornecedor");

                // ===== HEADER BAND =====
                const drawHeader = () => {
                  // White band so the logo's own colors (HYUNDAI blue + red "O") read correctly
                  doc.setFillColor(255, 255, 255);
                  doc.rect(0, 0, pageW, 22, "F");
                  // Thin blue accent at bottom of band
                  doc.setFillColor(...HYUNDAI_BLUE);
                  doc.rect(0, 22, pageW, 1.2, "F");
                  if (logoB64) {
                    try { doc.addImage(logoB64, "PNG", M, 5, 38, 12); } catch {}
                  }
                  doc.setTextColor(...HYUNDAI_BLUE);
                  doc.setFont("helvetica", "bold");
                  doc.setFontSize(15);
                  doc.text("Análise de Risco — Peças Desconsideradas", pageW - M, 11, { align: "right" });
                  doc.setFont("helvetica", "normal");
                  doc.setFontSize(9);
                  doc.setTextColor(...SLATE);
                  doc.text(
                    `${modelFilter === "bc4b" ? "Modelo BC4B" : "Todos os modelos"} · Últimos ${periodo} dias · Gerado em ${now.toLocaleString("pt-BR")}`,
                    pageW - M, 17, { align: "right" }
                  );
                };

                const drawFooter = (page: number, pages: number) => {
                  doc.setDrawColor(...MUTED);
                  doc.setLineWidth(0.2);
                  doc.line(M, pageH - 10, pageW - M, pageH - 10);
                  doc.setFont("helvetica", "normal");
                  doc.setFontSize(8);
                  doc.setTextColor(...GREY);
                  doc.text("Hyundai Mobis — Quality Tools", M, pageH - 5);
                  doc.text(`Página ${page} de ${pages}`, pageW - M, pageH - 5, { align: "right" });
                };

                drawHeader();

                // ===== OVERVIEW / RESUMO =====
                let y = 32;
                doc.setTextColor(...HYUNDAI_BLUE);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(12);
                doc.text("Resumo", M, y);
                doc.setDrawColor(...HYUNDAI_BLUE);
                doc.setLineWidth(0.6);
                doc.line(M, y + 1.5, M + 22, y + 1.5);
                y += 6;

                // KPI cards
                const cardW = (pageW - M * 2 - 9) / 4;
                const cardH = 20;
                const kpis: Array<{ label: string; value: string; tone: [number, number, number] }> = [
                  { label: "Total desconsideradas", value: fmt(pdfData.length), tone: HYUNDAI_BLUE },
                  { label: "Sem lançamento", value: fmt(semLanc), tone: SLATE },
                  { label: "Recorrentes (3+ meses)", value: fmt(recorr), tone: AMBER },
                  { label: "NG acumuladas", value: fmt(totalNG), tone: RED },
                ];
                kpis.forEach((k, i) => {
                  const x = M + i * (cardW + 3);
                  doc.setFillColor(...SOFT);
                  doc.roundedRect(x, y, cardW, cardH, 2, 2, "F");
                  doc.setFillColor(...k.tone);
                  doc.rect(x, y, 1.6, cardH, "F");
                  doc.setFont("helvetica", "normal");
                  doc.setFontSize(8);
                  doc.setTextColor(...SLATE);
                  doc.text(k.label.toUpperCase(), x + 4, y + 6);
                  doc.setFont("helvetica", "bold");
                  doc.setFontSize(16);
                  doc.setTextColor(...k.tone);
                  doc.text(k.value, x + 4, y + 15);
                });
                y += cardH + 5;

                // ===== Breakdown — Por Modelo / Por Módulo =====
                const colW = (pageW - M * 2 - 6) / 2;
                const blockTop = y;
                const drawBreakdown = (
                  title: string, items: Array<[string, number]>, x: number, accent: [number, number, number],
                ) => {
                  let by = blockTop;
                  doc.setFont("helvetica", "bold");
                  doc.setFontSize(10);
                  doc.setTextColor(...HYUNDAI_BLUE);
                  doc.text(title, x, by);
                  doc.setDrawColor(...accent);
                  doc.setLineWidth(0.5);
                  doc.line(x, by + 1.2, x + 18, by + 1.2);
                  by += 4.5;
                  doc.setFillColor(...SOFT);
                  const rows = items.slice(0, 6);
                  const bh = rows.length ? rows.length * 5.5 + 2 : 7;
                  doc.roundedRect(x, by, colW, bh, 1.5, 1.5, "F");
                  by += 4;
                  if (!rows.length) {
                    doc.setFont("helvetica", "italic");
                    doc.setFontSize(8);
                    doc.setTextColor(...GREY);
                    doc.text("Sem dados", x + 3, by);
                    return blockTop + 4.5 + bh + 2;
                  }
                  doc.setFontSize(8.5);
                  rows.forEach(([label, count]) => {
                    doc.setFont("helvetica", "normal");
                    doc.setTextColor(...SLATE);
                    const lbl = label.length > 42 ? label.slice(0, 41) + "…" : label;
                    doc.text(lbl, x + 3, by);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(...accent);
                    doc.text(String(count), x + colW - 3, by, { align: "right" });
                    by += 5.5;
                  });
                  return blockTop + 4.5 + bh + 2;
                };
                const yA = drawBreakdown("Por Modelo (Projeto)", porModelo, M, HYUNDAI_BLUE);
                const yB = drawBreakdown("Por Módulo (Fornecedor)", porModulo, M + colW + 6, TEAL);
                y = Math.max(yA, yB) + 2;

                // Context line
                doc.setFont("helvetica", "italic");
                doc.setFontSize(8.5);
                doc.setTextColor(...GREY);
                const ctx = doc.splitTextToSize(
                  "Peças registradas no fornecedor sem nenhum apontamento no período, ou com apontamentos altamente recorrentes (mesmo modo de falha em 3 ou mais meses distintos). Estas peças são removidas das análises principais para evitar viés.",
                  pageW - M * 2
                );
                doc.text(ctx, M, y + 3);
                y += ctx.length * 4 + 4;

                // ===== TABLE =====
                doc.setTextColor(...NAVY);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(12);
                doc.text("Lista completa", M, y);
                doc.setDrawColor(...RED);
                doc.setLineWidth(0.6);
                doc.line(M, y + 1.5, M + 30, y + 1.5);
                y += 5;

                const cols = [
                  { h: "Part Number", w: 42, align: "left" as const },
                  { h: "Projeto",     w: 22, align: "left" as const },
                  { h: "Fornecedor",  w: 58, align: "left" as const },
                  { h: "NG",          w: 14, align: "right" as const },
                  { h: "1º NG",       w: 24, align: "center" as const },
                  { h: "Último NG",   w: 24, align: "center" as const },
                  { h: "Motivo",      w: pageW - M * 2 - (42 + 22 + 58 + 14 + 24 + 24), align: "left" as const },
                ];
                const rowH = 7;
                const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
                const fmtD = (d: string | null) => (d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—");

                const drawTableHeader = () => {
                  doc.setFillColor(...NAVY);
                  doc.rect(M, y, pageW - M * 2, rowH, "F");
                  doc.setTextColor(255, 255, 255);
                  doc.setFont("helvetica", "bold");
                  doc.setFontSize(9);
                  let cx = M;
                  cols.forEach((c) => {
                    const tx = c.align === "right" ? cx + c.w - 2 : c.align === "center" ? cx + c.w / 2 : cx + 2;
                    doc.text(c.h, tx, y + 4.8, { align: c.align });
                    cx += c.w;
                  });
                  y += rowH;
                };

                drawTableHeader();

                doc.setFont("helvetica", "normal");
                doc.setFontSize(8.5);
                pdfData.forEach((e: any, idx: number) => {
                  if (y + rowH > pageH - 14) {
                    drawFooter(doc.getNumberOfPages(), 0);
                    doc.addPage();
                    drawHeader();
                    y = 30;
                    drawTableHeader();
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(8.5);
                  }
                  if (idx % 2 === 0) {
                    doc.setFillColor(...ZEBRA);
                    doc.rect(M, y, pageW - M * 2, rowH, "F");
                  }
                  const motivoSem = e.reason === "sem lançamento";
                  const values = [
                    trunc(String(e.pn || "—"), 28),
                    trunc(String(e.projeto || "—"), 14),
                    trunc(String(e.fornecedor || "—"), 36),
                    fmt(e.ng),
                    fmtD(e.firstNgDate),
                    fmtD(e.lastNgDate),
                    motivoSem ? "Sem lançamento no período" : `Recorrente · ${trunc(e.modoRecorrente || "", 28)}`,
                  ];
                  doc.setTextColor(...SLATE);
                  let cx = M;
                  values.forEach((v, ci) => {
                    const c = cols[ci];
                    if (ci === 3) { doc.setFont("helvetica", "bold"); doc.setTextColor(...(e.ng > 0 ? RED : SLATE)); }
                    else if (ci === 6) { doc.setFont("helvetica", "bold"); doc.setTextColor(...(motivoSem ? GREY : AMBER)); }
                    else { doc.setFont("helvetica", "normal"); doc.setTextColor(...SLATE); }
                    const tx = c.align === "right" ? cx + c.w - 2 : c.align === "center" ? cx + c.w / 2 : cx + 2;
                    doc.text(v, tx, y + 4.8, { align: c.align });
                    cx += c.w;
                  });
                  y += rowH;
                });

                // Bottom border
                doc.setDrawColor(...MUTED);
                doc.setLineWidth(0.2);
                doc.line(M, y, pageW - M, y);

                const pages = doc.getNumberOfPages();
                for (let p = 1; p <= pages; p++) {
                  doc.setPage(p);
                  drawFooter(p, pages);
                }
                return doc;
              };

              const handlePreview = async () => {
                setBuildingPdf(true);
                try {
                  const doc = await buildExcludedPdf();
                  const blob = doc.output("blob") as Blob;
                  const url = URL.createObjectURL(blob);
                  if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
                  setPdfPreviewUrl(url);
                } catch (e) {
                  console.error("Erro ao gerar pré-visualização do PDF:", e);
                  toast.error("Não foi possível gerar a pré-visualização do PDF");
                } finally { setBuildingPdf(false); }
              };
              const handleSave = async () => {
                setBuildingPdf(true);
                try {
                  const doc = await buildExcludedPdf();
                  doc.save(`pecas-excluidas-${periodo}d-${modelFilter}.pdf`);
                } finally { setBuildingPdf(false); }
              };

              return (
                <>
                  <Button
                    size="sm" variant="outline" className="h-9 text-xs gap-1 w-full sm:w-auto"
                    disabled={!filteredExcluded.length || buildingPdf}
                    onClick={handlePreview}
                    aria-busy={buildingPdf}
                  >
                    {buildingPdf
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Eye className="w-3.5 h-3.5" />}
                    {buildingPdf ? "Gerando..." : "Pré-visualizar"}
                  </Button>
                  <Button
                    size="sm" className="h-9 text-xs gap-1 w-full sm:w-auto"
                    disabled={!filteredExcluded.length || buildingPdf}
                    onClick={handleSave}
                    aria-busy={buildingPdf}
                  >
                    {buildingPdf
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <FileText className="w-3.5 h-3.5" />}
                    {buildingPdf ? "Gerando..." : "Exportar em PDF"}
                  </Button>
                </>
              );
            })()}
          </div>

          <div className="flex-1 overflow-y-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
            {(() => {
              const toggleSort = (k: typeof excSortKey) => {
                if (excSortKey === k) setExcSortDir(excSortDir === "asc" ? "desc" : "asc");
                else { setExcSortKey(k); setExcSortDir(k === "ng" ? "desc" : "asc"); }
              };
              const arrow = (k: typeof excSortKey) => excSortKey === k ? (excSortDir === "asc" ? " ▲" : " ▼") : "";

              if (isMobile) {
                const sortChips: { k: typeof excSortKey; label: string }[] = [
                  { k: "pn", label: "PN" },
                  { k: "projeto", label: "Projeto" },
                  { k: "fornecedor", label: "Fornecedor" },
                  { k: "ng", label: "NG" },
                  { k: "lastNgDate", label: "Último NG" },
                ];
                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                      <span className="text-muted-foreground mr-1">Ordenar:</span>
                      {sortChips.map((c) => (
                        <button
                          key={c.k}
                          onClick={() => toggleSort(c.k)}
                          className={`px-2 py-1 rounded-md border ${excSortKey === c.k ? "bg-primary/10 border-primary/40 text-primary" : "border-border text-muted-foreground"}`}
                        >
                          {c.label}{arrow(c.k)}
                        </button>
                      ))}
                    </div>
                    {filteredExcluded.map((e: any, idx) => (
                      <Card key={`${e.pn}-${e.fornecedor}-${idx}`} className="p-3 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-mono text-xs break-all">{e.pn}</span>
                          <span className="text-sm font-semibold tabular-nums">{fmt(e.ng)} NG</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
                          <div><span className="text-foreground/70">Projeto:</span> {e.projeto || "—"}</div>
                          <div><span className="text-foreground/70">Último NG:</span> {e.lastNgDate ? new Date(e.lastNgDate + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</div>
                          <div className="col-span-2 truncate"><span className="text-foreground/70">Fornecedor:</span> {e.fornecedor}</div>
                        </div>
                        <div>
                          {e.reason === "sem lançamento"
                            ? <Badge className="bg-muted text-muted-foreground border-border">sem lançamento</Badge>
                            : <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">recorrente · {e.modoRecorrente}</Badge>}
                        </div>
                      </Card>
                    ))}
                    {!filteredExcluded.length && (
                      <div className="text-center py-6 text-muted-foreground text-sm">
                        {excludedParts.length ? "Nenhum resultado para os filtros aplicados." : "Nada a desconsiderar."}
                      </div>
                    )}
                  </div>
                );
              }

              const Th = ({ k, label, align = "left" }: { k: typeof excSortKey; label: string; align?: "left" | "center" }) => (
                <th
                  className={`px-3 py-2 cursor-pointer select-none hover:bg-muted/60 text-${align}`}
                  onClick={() => toggleSort(k)}
                >
                  {label}{arrow(k)}
                </th>
              );

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[720px]">
                    <thead className="bg-muted/40 text-xs sticky top-0">
                      <tr>
                        <Th k="pn" label="Part Number" />
                        <Th k="projeto" label="Projeto" />
                        <Th k="fornecedor" label="Fornecedor" />
                        <Th k="ng" label="NG" align="center" />
                        <Th k="lastNgDate" label="Último NG" align="center" />
                        <th className="text-left px-3 py-2">Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExcluded.map((e: any, idx) => (
                        <tr key={`${e.pn}-${e.fornecedor}-${idx}`} className="border-t">
                          <td className="px-3 py-2 font-mono text-xs">{e.pn}</td>
                          <td className="px-3 py-2 text-xs">{e.projeto || "—"}</td>
                          <td className="px-3 py-2 truncate max-w-[200px]" title={e.fornecedor}>{e.fornecedor}</td>
                          <td className="text-center px-3 py-2 tabular-nums">{fmt(e.ng)}</td>
                          <td className="text-center px-3 py-2 text-xs tabular-nums">
                            {e.lastNgDate ? new Date(e.lastNgDate + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                          </td>
                          <td className="px-3 py-2">
                            {e.reason === "sem lançamento"
                              ? <Badge className="bg-muted text-muted-foreground border-border">sem lançamento</Badge>
                              : <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">recorrente · {e.modoRecorrente}</Badge>}
                          </td>
                        </tr>
                      ))}
                      {!filteredExcluded.length && (
                        <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">
                          {excludedParts.length ? "Nenhum resultado para os filtros aplicados." : "Nada a desconsiderar."}
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* ============ PDF PREVIEW DIALOG ============ */}
      <Dialog
        open={!!pdfPreviewUrl}
        onOpenChange={(o) => {
          if (!o) {
            if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
            setPdfPreviewUrl(null);
          }
        }}
      >
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>Pré-visualização do PDF</DialogTitle>
            <DialogDescription>
              {modelFilter === "bc4b" ? "Modelo BC4B" : "Todos os modelos"} · Últimos {periodo} dias · {filteredExcluded.length} peça(s) desconsiderada(s)
            </DialogDescription>
          </DialogHeader>
          {pdfPreviewUrl && (
            <iframe
              title="PDF Preview"
              src={pdfPreviewUrl}
              className="w-full h-[70vh] rounded border"
            />
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
                setPdfPreviewUrl(null);
              }}
            >
              Fechar
            </Button>
            <Button
              className="gap-1"
              onClick={() => {
                if (!pdfPreviewUrl) return;
                const a = document.createElement("a");
                a.href = pdfPreviewUrl;
                a.download = `pecas-excluidas-${periodo}d-${modelFilter}.pdf`;
                a.click();
              }}
            >
              <FileText className="w-4 h-4" /> Baixar PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>


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
                <Card className="p-3"><div className="text-[11px] text-muted-foreground">NG total</div><div className="text-xl font-bold text-destructive">{fmt(drillData.totalNg)}</div></Card>
                <Card className="p-3"><div className="text-[11px] text-muted-foreground">OK total</div><div className="text-xl font-bold text-emerald-600">{fmt(drillData.totalOk)}</div></Card>
                <Card className="p-3"><div className="text-[11px] text-muted-foreground">Inspecionadas</div><div className="text-xl font-bold">{fmt(drillData.totalInsp)}</div></Card>
                <Card className="p-3"><div className="text-[11px] text-muted-foreground">PPM</div><div className="text-xl font-bold">{fmt(drillData.ppm)}</div></Card>

              </div>

              <Card className="p-3" ref={drillChartRef}>
                <h4 className="text-xs font-semibold mb-2 text-muted-foreground">NG por dia</h4>
                <div className="h-[180px]">
                  <ResponsiveContainer>
                    <LineChart data={drillData.trend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="data" fontSize={10} />
                      <YAxis fontSize={10} />
                      <Tooltip
                        labelFormatter={(l) => `Dia ${l}`}
                        formatter={(v: any) => (typeof v === "number" ? [`${fmt(v)} NG`, "Rejeições"] : [v, ""])}
                      />

                      <Line type="monotone" dataKey="ng" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 2 }}>
                        <LabelList dataKey="ng" position="top" offset={6} fontSize={isMobile ? 11 : 12} fontWeight={600} formatter={(v: any) => (v > 0 ? fmt(v) : "")} fill="hsl(var(--foreground))" />
                      </Line>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {drillData.topModos.length > 0 && (
                <Card className="p-3">
                  <h4 className="text-xs font-semibold mb-2 text-muted-foreground">Modos de falha</h4>
                  <div className="space-y-1">
                    {drillData.topModos.map(([modo, qty]) => (
                      <div key={modo} className="flex justify-between text-sm gap-2">
                        <span className="truncate" title={modo}>{modo}</span>
                        <span className="font-semibold text-destructive tabular-nums">{fmt(qty)}</span>
                      </div>
                    ))}

                  </div>
                </Card>
              )}

              <Card className="p-0 overflow-hidden">
                <div className="px-3 py-2 border-b flex flex-wrap items-center gap-2">
                  <div className="text-xs font-semibold text-muted-foreground mr-auto">
                    Apontamentos ({drillFilteredRows.length}{drillSearch && ` de ${drillData.rows.length}`})
                  </div>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input
                      ref={drillSearchRef}
                      value={drillSearch}
                      onChange={(e) => setDrillSearch(e.target.value)}
                      placeholder="Buscar data ou modo..."
                      aria-label="Buscar apontamentos por data ou modo de falha"
                      className="h-8 pl-7 w-[200px] text-xs"
                    />
                  </div>
                  <Button
                    size="sm" variant="outline" onClick={exportDrillCSV}
                    aria-label="Exportar histórico em CSV"
                    className="h-8"
                  >
                    <Download className="w-3.5 h-3.5 mr-1" /> CSV
                  </Button>
                  <Button
                    size="sm" variant="outline" onClick={previewDrillPDF}
                    aria-label="Pré-visualizar PDF"
                    className="h-8" disabled={buildingPdf} aria-busy={buildingPdf}
                  >
                    {buildingPdf ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                    Pré-visualizar
                  </Button>
                  <Button
                    size="sm" onClick={exportDrillPDF}
                    aria-label="Exportar histórico em PDF"
                    className="h-8" disabled={buildingPdf} aria-busy={buildingPdf}
                  >
                    {buildingPdf ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <FileText className="w-3.5 h-3.5 mr-1" />}
                    PDF
                  </Button>
                </div>
                <div className="max-h-[280px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs sticky top-0">
                      <tr>
                        <th scope="col" className="text-left px-3 py-2">Data</th>
                        <th scope="col" className="text-center px-3 py-2">OK</th>
                        <th scope="col" className="text-center px-3 py-2">NG</th>
                        <th scope="col" className="text-left px-3 py-2">Modo de falha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drillPagedRows.map((r) => (
                        <tr key={r.id} className="border-t">
                          <td className="px-3 py-2 tabular-nums">{r.data}</td>
                          <td className="text-center px-3 py-2 text-emerald-600 tabular-nums">{fmt(r.quantidade_ok || 0)}</td>
                          <td className="text-center px-3 py-2 font-semibold text-destructive tabular-nums">{fmt(r.quantidade_ng || 0)}</td>
                          <td className="px-3 py-2 text-muted-foreground">{r.modo_falha ? stripCode(r.modo_falha) : "—"}</td>
                        </tr>

                      ))}
                      {!drillPagedRows.length && (
                        <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">
                          {drillSearch ? "Nenhum resultado para a busca." : "Sem apontamentos."}
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {drillTotalPages > 1 && (
                  <div className="flex items-center justify-between gap-2 px-3 py-2 border-t bg-muted/20">
                    <span className="text-xs text-muted-foreground" aria-live="polite">
                      Página {drillPageSafe} de {drillTotalPages}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        size="icon" variant="outline" className="h-7 w-7"
                        onClick={() => setDrillPage((p) => Math.max(1, p - 1))}
                        disabled={drillPageSafe <= 1}
                        aria-label="Página anterior"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon" variant="outline" className="h-7 w-7"
                        onClick={() => setDrillPage((p) => Math.min(drillTotalPages, p + 1))}
                        disabled={drillPageSafe >= drillTotalPages}
                        aria-label="Próxima página"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={paretoZoomOpen} onOpenChange={setParetoZoomOpen}>
        <DialogContent className="max-w-[98vw] w-[98vw] h-[95vh] flex flex-col p-4">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Pareto dos modos de falha — Zoom</DialogTitle>
            <DialogDescription>Use os controles para ampliar e ler os rótulos com mais precisão.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 flex-shrink-0 py-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => setParetoZoom((z) => Math.max(100, z - 25))}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs font-medium w-14 text-center">{paretoZoom}%</span>
            <Button size="sm" variant="outline" onClick={() => setParetoZoom((z) => Math.min(400, z + 25))}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <input
              type="range"
              min={100}
              max={400}
              step={25}
              value={paretoZoom}
              onChange={(e) => setParetoZoom(Number(e.target.value))}
              className="flex-1 min-w-[150px] max-w-md"
            />
            <Button size="sm" variant="ghost" onClick={() => setParetoZoom(150)}>Reset</Button>
          </div>
          <div className="flex-1 overflow-auto border rounded-md bg-card">
            <div style={{ width: `${paretoZoom}%`, height: `${Math.max(100, paretoZoom * 0.9)}%`, minHeight: "100%" }}>
              <ResponsiveContainer>
                <ComposedChart data={paretoData} margin={{ top: 80, right: 60, left: 20, bottom: 160 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} fontSize={13} height={160} />
                  <YAxis yAxisId="left" fontSize={13} label={{ value: "Peças NG", angle: -90, position: "insideLeft", fontSize: 13, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%" fontSize={13} />
                  <Tooltip
                    formatter={(v: any, n: any) => {
                      if (typeof v !== "number") return [v, n];
                      if (n === "% Acumulado") return [fmtPct(v, 0), n];
                      return [`${fmt(v)} peças NG`, n];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 13 }} />
                  <Bar yAxisId="left" dataKey="value" fill="hsl(var(--destructive))" name="Ocorrências (NG)" maxBarSize={90}>
                    <LabelList dataKey="value" position="top" offset={10} fontSize={14} fontWeight={700} formatter={(v: any) => fmt(v)} fill="hsl(var(--foreground))" />
                  </Bar>
                  <Line yAxisId="right" type="monotone" dataKey="acc" stroke="hsl(var(--primary))" name="% Acumulado" strokeWidth={2.5} dot={{ r: 4 }}>
                    <LabelList dataKey="acc" position="top" offset={14} fontSize={13} fontWeight={700} fill="hsl(var(--primary))" formatter={(v: any) => `${v}%`} />
                  </Line>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
