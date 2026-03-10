import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
import pptxgen from "pptxgenjs";
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
  LabelList,
} from "recharts";

interface InjectionRow {
  projeto: string;
  fornecedor: string;
  part_number: string;
  part_name: string;
  needs_improvement: boolean;
  improvement_category: number | null;
  defects: any[] | null;
  created_at: string;
  cycle_time: number;
  cooling_time: number;
  weight: number;
  dimensional: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  
  const [injectionData, setInjectionData] = useState<InjectionRow[]>([]);
  const [paintingCount, setPaintingCount] = useState(0);
  const [assemblyCount, setAssemblyCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [suppliersMap, setSuppliersMap] = useState<Map<string, string>>(new Map());
  const [defectCatMap, setDefectCatMap] = useState<Map<string, string>>(new Map());
  const [defectsLabelMap, setDefectsLabelMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const fetchData = async () => {
      const [injRes, paintRes, assemblyRes, suppRes, catRes, defRes] = await Promise.all([
        supabase.from("injection_checklists").select("projeto, fornecedor, part_number, part_name, needs_improvement, improvement_category, defects, created_at, cycle_time, cooling_time, weight, dimensional"),
        supabase.from("painting_checklists").select("id", { count: "exact", head: true }),
        supabase.from("assembly_checklists").select("id", { count: "exact", head: true }),
        supabase.from("suppliers").select("code, name"),
        supabase.from("defect_categories").select("code, description").eq("active", true),
        supabase.from("defects").select("code, description").eq("active", true),
      ]);
      const sMap = new Map<string, string>();
      (suppRes.data || []).forEach((s: { code: string; name: string }) => {
        sMap.set(s.code.toUpperCase(), s.name);
        sMap.set(s.name.toUpperCase(), s.name);
      });
      setSuppliersMap(sMap);

      const cMap = new Map<string, string>();
      (catRes.data || []).forEach((c: { code: string; description: string }) => {
        cMap.set(c.code, `${c.code} - ${c.description}`);
      });
      setDefectCatMap(cMap);

      const dMap = new Map<string, string>();
      (defRes.data || []).forEach((d: { code: string; description: string }) => {
        dMap.set(d.code, `${d.code} - ${d.description}`);
      });
      setDefectsLabelMap(dMap);

      setInjectionData((injRes.data as InjectionRow[]) || []);
      setPaintingCount(paintRes.count || 0);
      setAssemblyCount(assemblyRes.count || 0);
      setLoading(false);
    };
    fetchData();
  }, []);

  // --- Data aggregations ---
  const totalInjection = injectionData.length;
  const totalAll = totalInjection + paintingCount + assemblyCount;

  // Helper to resolve supplier name from catalog
  const resolveSupplierName = (raw: string) => {
    return suppliersMap.get(raw.toUpperCase()) || raw;
  };

  // Supplier table + horizontal bar data
  const supplierMap = new Map<string, { ok: number; ng: number; pns: Set<string> }>();
  injectionData.forEach((d) => {
    const resolvedName = resolveSupplierName(d.fornecedor);
    const existing = supplierMap.get(resolvedName) || { ok: 0, ng: 0, pns: new Set<string>() };
    if (d.needs_improvement) existing.ng++;
    else existing.ok++;
    existing.pns.add(d.part_number);
    supplierMap.set(resolvedName, existing);
  });
  const supplierData = Array.from(supplierMap.entries())
    .map(([name, { ok, ng, pns }]) => ({ name, ok, ng, total: ok + ng, qtyPN: pns.size }))
    .sort((a, b) => b.total - a.total);

  // Donut charts data: based on top 3 defect categories from defects array
  const catCountMap = new Map<string, { ok: number; ng: number }>();
  injectionData.forEach((d) => {
    const defects = d.defects as any[] | null;
    if (defects && defects.length > 0) {
      defects.forEach((def: any) => {
        if (def.improvement_category) {
          const label = defectCatMap.get(def.improvement_category) || def.improvement_category;
          const existing = catCountMap.get(label) || { ok: 0, ng: 0 };
          existing.ng++;
          catCountMap.set(label, existing);
        }
      });
    }
  });
  // Fill OK counts (total checklists minus NG for each category)
  const totalChecklists = injectionData.length;
  const topCategories = Array.from(catCountMap.entries())
    .sort((a, b) => b[1].ng - a[1].ng)
    .slice(0, 3);
  const donutDataSets = topCategories.map(([label, counts]) => ({
    label,
    data: [
      { name: "OK", value: totalChecklists - counts.ng },
      { name: "NG", value: counts.ng },
    ],
  }));

  // Main Failure Mode — from defects[].failure_mode field
  const failureMap = new Map<string, number>();
  injectionData.forEach((d) => {
    const defects = d.defects as any[] | null;
    if (defects && defects.length > 0) {
      defects.forEach((def: any) => {
        if (def.failure_mode) {
          const label = defectsLabelMap.get(def.failure_mode) || def.failure_mode;
          failureMap.set(label, (failureMap.get(label) || 0) + 1);
        }
      });
    }
  });
  const failureModeData = Array.from(failureMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Problem type data — from defects[].improvement_category field
  const problemMap = new Map<string, number>();
  injectionData.forEach((d) => {
    const defects = d.defects as any[] | null;
    if (defects && defects.length > 0) {
      defects.forEach((def: any) => {
        if (def.improvement_category) {
          const label = defectCatMap.get(def.improvement_category) || def.improvement_category;
          problemMap.set(label, (problemMap.get(label) || 0) + 1);
        }
      });
    }
  });
  const problemTypes = Array.from(problemMap.entries())
    .map(([type, qty]) => ({ type, qty }))
    .sort((a, b) => b.qty - a.qty);
  const totalProblems = problemTypes.reduce((a, b) => a + b.qty, 0);

  // Main issues (NG items list)
  const mainIssues = injectionData
    .filter((d) => d.needs_improvement)
    .slice(0, 8)
    .map((d) => {
      const defects = d.defects as any[] | null;
      const firstCat = defects?.[0]?.improvement_category;
      return {
        supplier: resolveSupplierName(d.fornecedor),
        pn: d.part_number,
        description: d.part_name,
        category: firstCat ? (defectCatMap.get(firstCat) || firstCat) : "—",
      };
    });

  const chartConfig = {
    ok: { label: "OK", color: "hsl(0, 65%, 45%)" },
    ng: { label: "NG", color: "hsl(140, 60%, 45%)" },
    value: { label: "Quantidade", color: "hsl(210, 70%, 60%)" },
  };

  const DONUT_COLORS = ["hsl(45, 80%, 55%)", "hsl(15, 70%, 45%)", "hsl(0, 60%, 35%)"];

  const renderSupplierAxisTick = ({ x = 0, y = 0, payload }: { x?: number; y?: number; payload?: { value?: string } }) => (
    <text
      x={x}
      y={y}
      dx={-4}
      dy={4}
      textAnchor="end"
      fill="hsl(0 0% 100%)"
      style={{ fill: "hsl(0 0% 100%)", fontSize: "11px", fontWeight: 500 }}
    >
      {payload?.value ?? ""}
    </text>
  );

  const exportToPptx = async () => {
    const pptx = new pptxgen();
    pptx.layout = "LAYOUT_WIDE";
    const BG = "1a2035";
    const HEADER_BG = "2a3040";
    const TXT = "E0E0E0";
    const TXT_DIM = "999999";
    const BORDER_CLR = "3a4050";
    const OK_CLR = "B33B3B";
    const NG_CLR = "3B8F3B";
    const ACCENT = "5B9BD5";

    // ===== SLIDE 1: Top section =====
    const s1 = pptx.addSlide();
    s1.background = { color: BG };

    // Title
    s1.addText("Suppliers Try-Outs Status", { x: 0.3, y: 0.15, w: 8, h: 0.45, fontSize: 18, color: "FFFFFF", bold: true });
    s1.addText(`Total: ${totalAll}`, { x: 10, y: 0.15, w: 3, h: 0.45, fontSize: 11, color: TXT_DIM, align: "right" });

    // --- LEFT: General Quality Incoming Status table ---
    s1.addText("General Quality Incoming Status", { x: 0.3, y: 0.7, w: 3.8, h: 0.3, fontSize: 10, color: "FFFFFF", bold: true, fill: { color: HEADER_BG }, align: "center" });

    const supRows: pptxgen.TableRow[] = [
      [
        { text: "Fornecedor", options: { bold: true, color: "FFFFFF", fill: { color: HEADER_BG }, fontSize: 8 } },
        { text: "Qty PN", options: { bold: true, color: "FFFFFF", fill: { color: HEADER_BG }, fontSize: 8, align: "center" } },
        { text: "OK", options: { bold: true, color: "FFFFFF", fill: { color: HEADER_BG }, fontSize: 8, align: "center" } },
        { text: "NG", options: { bold: true, color: "FFFFFF", fill: { color: HEADER_BG }, fontSize: 8, align: "center" } },
      ],
    ];
    supplierData.forEach((s, i) => {
      const rowBg = i % 2 === 0 ? "1e2538" : "232a3e";
      supRows.push([
        { text: s.name, options: { color: ACCENT, fontSize: 8, fill: { color: rowBg } } },
        { text: String(s.qtyPN), options: { color: TXT, fontSize: 8, align: "center", fill: { color: rowBg } } },
        { text: String(s.ok), options: { color: TXT, fontSize: 8, align: "center", fill: { color: rowBg } } },
        { text: String(s.ng), options: { color: TXT, fontSize: 8, align: "center", fill: { color: rowBg } } },
      ]);
    });
    // Total row
    supRows.push([
      { text: "TTL", options: { bold: true, color: TXT, fontSize: 8, fill: { color: HEADER_BG } } },
      { text: String(totalInjection), options: { bold: true, color: TXT, fontSize: 8, align: "center", fill: { color: HEADER_BG } } },
      { text: String(supplierData.reduce((a, b) => a + b.ok, 0)), options: { bold: true, color: TXT, fontSize: 8, align: "center", fill: { color: HEADER_BG } } },
      { text: String(supplierData.reduce((a, b) => a + b.ng, 0)), options: { bold: true, color: TXT, fontSize: 8, align: "center", fill: { color: HEADER_BG } } },
    ]);
    s1.addTable(supRows, { x: 0.3, y: 1.05, w: 3.8, colW: [1.6, 0.7, 0.7, 0.7], fontSize: 8, border: { type: "solid", pt: 0.5, color: BORDER_CLR } });

    // --- CENTER: Supplier T/Out Status (horizontal bar chart) ---
    s1.addText("Supplier T/Out Status", { x: 4.3, y: 0.7, w: 4.2, h: 0.3, fontSize: 10, color: "FFFFFF", bold: true, fill: { color: HEADER_BG }, align: "center" });
    s1.addText("❖ Status of Supplier T/Outs OK vs NG", { x: 4.3, y: 1.05, w: 4.2, h: 0.2, fontSize: 7, color: TXT_DIM });

    if (supplierData.length > 0) {
      s1.addChart(pptx.ChartType.bar, [
        { name: "OK", labels: supplierData.map(s => s.name), values: supplierData.map(s => s.ok) },
        { name: "NG", labels: supplierData.map(s => s.name), values: supplierData.map(s => s.ng) },
      ], {
        x: 4.3, y: 1.3, w: 4.2, h: 3.5,
        barDir: "bar",
        barGrouping: "stacked",
        chartColors: [OK_CLR, NG_CLR],
        showValue: false,
        catAxisLabelColor: "FFFFFF",
        catAxisLabelFontSize: 8,
        valAxisHidden: true,
        catAxisLineShow: false,
        valAxisLineShow: false,
        plotArea: { fill: { color: BG } },
        showLegend: true,
        legendPos: "b",
        legendColor: TXT_DIM,
        legendFontSize: 7,
      });
    }

    // --- RIGHT TOP: Try Out Attendance Status (donuts) ---
    s1.addText("Try Out Attendance Status", { x: 8.7, y: 0.7, w: 4.3, h: 0.3, fontSize: 10, color: "FFFFFF", bold: true, fill: { color: HEADER_BG }, align: "center" });

    const donutSets = donutDataSets.slice(0, 3).map((ds, i) => ({
      title: ds.label,
      data: ds.data,
      x: 8.8 + i * 1.4,
    }));
    donutSets.forEach(({ title, data, x }) => {
      s1.addText(title, { x, y: 1.05, w: 1.2, h: 0.2, fontSize: 7, color: TXT, bold: true, align: "center" });
      const total = data[0].value + data[1].value;
      s1.addChart(pptx.ChartType.doughnut, [
        { name: title, labels: ["OK", "NG"], values: [data[0].value, data[1].value] },
      ], {
        x, y: 1.3, w: 1.2, h: 1.4,
        chartColors: ["C8A828", "A84420"],
        showTitle: false,
        showValue: false,
        dataLabelPosition: "none" as never,
        plotArea: { fill: { color: BG } },
      });
      const okPct = total > 0 ? ((data[0].value / total) * 100).toFixed(1) : "0";
      const ngPct = total > 0 ? ((data[1].value / total) * 100).toFixed(1) : "0";
      s1.addText(`OK ${okPct}%  NG ${ngPct}%`, { x, y: 2.75, w: 1.2, h: 0.2, fontSize: 6, color: TXT_DIM, align: "center" });
    });

    // --- RIGHT BOTTOM: Main Failure Mode (bar chart) ---
    s1.addText("Main Failure Mode", { x: 8.7, y: 3.1, w: 4.3, h: 0.3, fontSize: 10, color: "FFFFFF", bold: true, fill: { color: HEADER_BG }, align: "center" });

    if (failureModeData.length > 0) {
      s1.addChart(pptx.ChartType.bar, [
        { name: "Qty", labels: failureModeData.map(f => f.name), values: failureModeData.map(f => f.value) },
      ], {
        x: 8.7, y: 3.45, w: 4.3, h: 2.0,
        barDir: "col",
        chartColors: [ACCENT],
        showValue: true,
        dataLabelColor: TXT,
        dataLabelFontSize: 8,
        dataLabelPosition: "outEnd",
        catAxisLabelColor: TXT_DIM,
        catAxisLabelFontSize: 7,
        valAxisHidden: true,
        catAxisLineShow: false,
        valAxisLineShow: false,
        plotArea: { fill: { color: BG } },
        showLegend: false,
      });
    }

    // --- BOTTOM LEFT: Try-Out Data – Problem (on same slide) ---
    s1.addText("Try-Out Data – Problem", { x: 0.3, y: 5.1, w: 3.8, h: 0.25, fontSize: 9, color: "FFFFFF", bold: true, fill: { color: HEADER_BG }, align: "center" });

    const probRows: pptxgen.TableRow[] = [
      [
        { text: "Type", options: { bold: true, color: "FFFFFF", fill: { color: HEADER_BG }, fontSize: 7 } },
        { text: "Qty", options: { bold: true, color: "FFFFFF", fill: { color: HEADER_BG }, fontSize: 7, align: "center" } },
        { text: "%", options: { bold: true, color: "FFFFFF", fill: { color: HEADER_BG }, fontSize: 7, align: "center" } },
      ],
    ];
    problemTypes.forEach((p, i) => {
      const rowBg = i % 2 === 0 ? "1e2538" : "232a3e";
      probRows.push([
        { text: p.type, options: { color: TXT, fontSize: 7, fill: { color: rowBg } } },
        { text: String(p.qty), options: { color: TXT, fontSize: 7, align: "center", fill: { color: rowBg } } },
        { text: `${totalProblems > 0 ? ((p.qty / totalProblems) * 100).toFixed(0) : 0}%`, options: { color: TXT, fontSize: 7, align: "center", fill: { color: rowBg } } },
      ]);
    });
    s1.addTable(probRows, { x: 0.3, y: 5.4, w: 3.8, colW: [1.6, 1.1, 1.1], fontSize: 7, border: { type: "solid", pt: 0.5, color: BORDER_CLR } });

    // --- BOTTOM RIGHT: Main Issues (on same slide) ---
    s1.addText("Main Issues", { x: 4.3, y: 5.1, w: 8.7, h: 0.25, fontSize: 9, color: "FFFFFF", bold: true, fill: { color: HEADER_BG }, align: "center" });

    const issueRows: pptxgen.TableRow[] = [
      [
        { text: "Supplier", options: { bold: true, color: "FFFFFF", fill: { color: HEADER_BG }, fontSize: 7 } },
        { text: "PN", options: { bold: true, color: "FFFFFF", fill: { color: HEADER_BG }, fontSize: 7 } },
        { text: "Description", options: { bold: true, color: "FFFFFF", fill: { color: HEADER_BG }, fontSize: 7 } },
        { text: "Category", options: { bold: true, color: "FFFFFF", fill: { color: HEADER_BG }, fontSize: 7 } },
      ],
    ];
    mainIssues.slice(0, 8).forEach((issue, i) => {
      const rowBg = i % 2 === 0 ? "1e2538" : "232a3e";
      issueRows.push([
        { text: issue.supplier, options: { color: TXT, fontSize: 7, fill: { color: rowBg } } },
        { text: issue.pn, options: { color: TXT, fontSize: 7, fill: { color: rowBg } } },
        { text: issue.description, options: { color: TXT, fontSize: 7, fill: { color: rowBg } } },
        { text: issue.category, options: { color: TXT, fontSize: 7, fill: { color: rowBg } } },
      ]);
    });
    if (mainIssues.length === 0) {
      issueRows.push([{ text: "Sem issues registrados.", options: { color: TXT_DIM, fontSize: 7, fill: { color: "1e2538" }, colspan: 4, align: "center" } }]);
    }
    s1.addTable(issueRows, { x: 4.3, y: 5.4, w: 8.7, colW: [2, 1.5, 3.5, 1.7], fontSize: 7, border: { type: "solid", pt: 0.5, color: BORDER_CLR } });

    await pptx.writeFile({ fileName: "Dashboard_TryOut_Status.pptx" });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[hsl(220,20%,10%)] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-info border-t-transparent rounded-full" />
      </div>
    );
  }

  const SectionHeader = ({ children }: { children: React.ReactNode }) => (
    <div className="bg-[hsl(220,10%,30%)] px-3 py-1.5 border border-[hsl(220,10%,40%)]">
      <h3 className="text-sm font-bold text-[hsl(0,0%,90%)] text-center tracking-wide">{children}</h3>
    </div>
  );

  const DonutChart = ({ data, title }: { data: { name: string; value: number }[]; title: string }) => {
    const total = data.reduce((a, b) => a + b.value, 0);
    const okPct = total > 0 ? ((data[0].value / total) * 100).toFixed(1) : "0";
    const ngPct = total > 0 ? ((data[1].value / total) * 100).toFixed(1) : "0";
    return (
      <div className="flex flex-col items-center">
        <p className="text-xs font-bold text-[hsl(0,0%,85%)] mb-1">{title}</p>
        <div className="relative w-24 h-24">
          <ChartContainer config={chartConfig} className="h-24 w-24">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={25} outerRadius={40} dataKey="value" strokeWidth={0}>
                {data.map((_, i) => (
                  <Cell key={i} fill={DONUT_COLORS[i]} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-bold text-[hsl(0,0%,80%)]">{total}ea</span>
          </div>
        </div>
        <div className="flex gap-3 mt-1">
          <span className="text-[10px] text-[hsl(45,80%,55%)]">{okPct}%</span>
          <span className="text-[10px] text-[hsl(15,70%,45%)]">{ngPct}%</span>
        </div>
        <div className="flex gap-3">
          <span className="text-[9px] text-[hsl(0,0%,60%)]">■OK</span>
          <span className="text-[9px] text-[hsl(0,0%,60%)]">■NG</span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[hsl(220,20%,10%)]">
      {/* Header */}
      <div className="border-b border-[hsl(220,10%,25%)] bg-[hsl(220,20%,12%)] px-3 md:px-4 py-2 md:py-3 flex items-center gap-2 md:gap-4 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/tryout")}
          className="text-[hsl(0,0%,60%)] hover:text-[hsl(0,0%,90%)] hover:bg-[hsl(220,10%,20%)] px-2"
        >
          <ArrowLeft className="w-4 h-4 md:mr-2" />
          <span className="hidden md:inline">Voltar</span>
        </Button>
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-sm md:text-xl font-bold text-[hsl(0,0%,90%)] font-heading tracking-wide truncate">
            Suppliers Try-Outs Status
          </h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] md:text-xs text-[hsl(0,0%,50%)]">Total: {totalAll}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToPptx}
            className="text-[hsl(0,0%,80%)] border-[hsl(220,10%,30%)] bg-[hsl(220,15%,18%)] hover:bg-[hsl(220,15%,25%)] text-xs"
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            PPTX
          </Button>
        </div>
      </div>

      {/* Main grid */}
      <main className="p-2 md:p-4 grid grid-cols-1 lg:grid-cols-12 gap-3 overflow-x-hidden">
        {/* LEFT: General Quality Incoming Status table */}
        <div className="lg:col-span-3 border border-[hsl(220,10%,25%)] bg-[hsl(220,15%,14%)] overflow-x-auto rounded-lg">
          <SectionHeader>General Quality Incoming Status</SectionHeader>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[hsl(220,10%,25%)]">
                <th className="text-left px-2 py-1.5 text-[hsl(0,0%,70%)] font-medium">Fornecedor</th>
                <th className="text-center px-2 py-1.5 text-[hsl(0,0%,70%)] font-medium">Qty PN</th>
                <th className="text-center px-2 py-1.5 text-[hsl(0,0%,70%)] font-medium" colSpan={2}>
                  <div>T/Out Status</div>
                  <div className="flex text-[10px] text-[hsl(0,0%,55%)]">
                    <span className="flex-1">OK</span>
                    <span className="flex-1">NG</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {supplierData.map((s, i) => (
                <tr key={s.name} className={`border-b border-[hsl(220,10%,20%)] ${i % 2 === 0 ? 'bg-[hsl(220,15%,14%)]' : 'bg-[hsl(220,15%,16%)]'}`}>
                  <td className="px-2 py-1 text-[hsl(210,70%,60%)] underline cursor-pointer">{s.name}</td>
                  <td className="text-center px-2 py-1 text-[hsl(0,0%,80%)]">{s.qtyPN}</td>
                  <td className="text-center px-2 py-1 text-[hsl(0,0%,80%)]">{s.ok}</td>
                  <td className="text-center px-2 py-1 text-[hsl(0,0%,80%)]">{s.ng}</td>
                </tr>
              ))}
              <tr className="bg-[hsl(220,10%,20%)] font-bold">
                <td className="px-2 py-1.5 text-[hsl(0,0%,80%)]">TTL</td>
                <td className="text-center px-2 py-1.5 text-[hsl(0,0%,80%)]">{totalInjection}</td>
                <td className="text-center px-2 py-1.5 text-[hsl(0,0%,80%)]">{supplierData.reduce((a, b) => a + b.ok, 0)}</td>
                <td className="text-center px-2 py-1.5 text-[hsl(0,0%,80%)]">{supplierData.reduce((a, b) => a + b.ng, 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* CENTER: Supplier T/Out Status (horizontal bars) */}
        <div className="lg:col-span-4 border border-[hsl(220,10%,25%)] bg-[hsl(220,15%,14%)] overflow-hidden rounded-lg">
          <SectionHeader>Supplier T/Out Status</SectionHeader>
          <p className="text-[10px] text-[hsl(0,0%,60%)] px-3 pt-2">❖ Status of Supplier T/Outs OK vs NG</p>
          {supplierData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[250px] md:h-[280px] w-full px-1">
              <BarChart data={supplierData} layout="vertical" margin={{ left: 5, right: 20, top: 5, bottom: 5 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={80} tick={renderSupplierAxisTick} axisLine={false} tickLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
<<<<<<< HEAD
                <Bar dataKey="ok" stackId="a" fill="hsl(140, 55%, 45%)" barSize={16} />
                <Bar dataKey="ng" stackId="a" fill="hsl(0, 55%, 50%)" barSize={16} />
=======
                <Bar dataKey="ok" stackId="a" fill="hsl(140, 55%, 45%)" barSize={16}>
                  <LabelList dataKey="ok" position="center" fontSize={9} fill="white" formatter={(v: number) => v > 0 ? v : ''} />
                </Bar>
                <Bar dataKey="ng" stackId="a" fill="hsl(0, 55%, 50%)" barSize={16}>
                  <LabelList dataKey="ng" position="center" fontSize={9} fill="white" formatter={(v: number) => v > 0 ? v : ''} />
                </Bar>
>>>>>>> 853a538787cf446c7d01e628ea96edf722a8086f
              </BarChart>
            </ChartContainer>
          ) : (
            <p className="text-[hsl(0,0%,50%)] text-xs text-center py-12">Sem dados.</p>
          )}
        </div>

        {/* RIGHT: Donuts + Failure Mode */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          {/* Donut charts row */}
          <div className="border border-[hsl(220,10%,25%)] bg-[hsl(220,15%,14%)] p-3 rounded-lg">
            <SectionHeader>Try Out Attendance Status</SectionHeader>
            <div className="flex justify-around mt-3 flex-wrap gap-2">
              {donutDataSets.length > 0 ? donutDataSets.map((ds, i) => (
                <DonutChart key={i} data={ds.data} title={ds.label} />
              )) : (
                <p className="text-[hsl(0,0%,50%)] text-xs text-center py-4">Sem dados de categoria.</p>
              )}
            </div>
          </div>

          {/* Main Failure Mode */}
          <div className="border border-[hsl(220,10%,25%)] bg-[hsl(220,15%,14%)] flex-1 rounded-lg">
            <SectionHeader>Main Failure Mode</SectionHeader>
            {failureModeData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[200px] md:h-[180px] w-full [&_.recharts-cartesian-axis-tick_text]:!fill-white">
                <BarChart data={failureModeData} margin={{ left: 10, right: 10, top: 15, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,10%,25%)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#ffffff" }} angle={-35} textAnchor="end" axisLine={false} height={40} />
                  <YAxis hide />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" radius={[2, 2, 0, 0]} barSize={30} label={{ position: "top", fontSize: 10, fill: "hsl(0,0%,80%)" }}>
                    {failureModeData.map((_, i) => (
                      <Cell key={i} fill={`hsl(${210 - i * 15}, ${60 + i * 5}%, ${55 + i * 3}%)`} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="text-[hsl(0,0%,50%)] text-xs text-center py-8">Sem dados.</p>
            )}
          </div>
        </div>

        {/* BOTTOM LEFT: Try-Out Data - Problem */}
        <div className="lg:col-span-4 border border-[hsl(220,10%,25%)] bg-[hsl(220,15%,14%)] rounded-lg overflow-x-auto">
          <SectionHeader>Try-Out Data – Problem</SectionHeader>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[hsl(220,10%,25%)]">
                <th className="text-left px-3 py-1.5 text-[hsl(0,0%,70%)] font-medium">Type</th>
                <th className="text-center px-3 py-1.5 text-[hsl(0,0%,70%)] font-medium">Qty</th>
                <th className="text-center px-3 py-1.5 text-[hsl(0,0%,70%)] font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {problemTypes.map((p, i) => (
                <tr key={p.type} className={`border-b border-[hsl(220,10%,20%)] ${i % 2 === 0 ? 'bg-[hsl(220,15%,14%)]' : 'bg-[hsl(220,15%,16%)]'}`}>
                  <td className="px-3 py-1 text-[hsl(0,0%,80%)]">{p.type}</td>
                  <td className="text-center px-3 py-1 text-[hsl(0,0%,80%)]">{p.qty}</td>
                  <td className="text-center px-3 py-1 text-[hsl(0,0%,80%)]">{totalProblems > 0 ? ((p.qty / totalProblems) * 100).toFixed(0) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* BOTTOM RIGHT: Main Issues table */}
        <div className="lg:col-span-8 border border-[hsl(220,10%,25%)] bg-[hsl(220,15%,14%)] overflow-x-auto rounded-lg">
          <SectionHeader>Main Issues</SectionHeader>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[hsl(220,10%,25%)]">
                <th className="text-left px-3 py-1.5 text-[hsl(0,0%,70%)] font-medium">Supplier</th>
                <th className="text-left px-3 py-1.5 text-[hsl(0,0%,70%)] font-medium">PN</th>
                <th className="text-left px-3 py-1.5 text-[hsl(0,0%,70%)] font-medium">Description</th>
                <th className="text-left px-3 py-1.5 text-[hsl(0,0%,70%)] font-medium">Category</th>
              </tr>
            </thead>
            <tbody>
              {mainIssues.length > 0 ? mainIssues.map((issue, i) => (
                <tr key={i} className={`border-b border-[hsl(220,10%,20%)] ${i % 2 === 0 ? 'bg-[hsl(220,15%,14%)]' : 'bg-[hsl(220,15%,16%)]'}`}>
                  <td className="px-3 py-1 text-[hsl(0,0%,80%)]">{issue.supplier}</td>
                  <td className="px-3 py-1 text-[hsl(0,0%,80%)]">{issue.pn}</td>
                  <td className="px-3 py-1 text-[hsl(0,0%,80%)]">{issue.description}</td>
                  <td className="px-3 py-1 text-[hsl(0,0%,80%)]">{issue.category}</td>
                </tr>
              )) : (
                <tr><td colSpan={4} className="text-center py-4 text-[hsl(0,0%,50%)]">Sem issues registrados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
