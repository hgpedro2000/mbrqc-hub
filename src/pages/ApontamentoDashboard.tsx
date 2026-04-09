import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, LabelList,
} from "recharts";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import pptxgen from "pptxgenjs";
import { stripCode } from "@/lib/stripCode";

const TYPES = ["incoming", "peca", "processo", "oem"] as const;
const TYPE_LABELS: Record<string, string> = { incoming: "Incoming", peca: "Peça", processo: "Processo", oem: "OEM" };
const DONUT_COLORS = ["hsl(45, 80%, 55%)", "hsl(15, 70%, 45%)"];

const ApontamentoDashboard = () => {
  const navigate = useNavigate();
  const [activeType, setActiveType] = useState("incoming");
  const today = new Date().toISOString().split("T")[0];
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [supplierFilter, setSupplierFilter] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["apontamentos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("apontamentos").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: suppliersRaw = [] } = useQuery({
    queryKey: ["suppliers-dash"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("code, name");
      if (error) throw error;
      return data;
    },
  });

  const suppliersMap = useMemo(() => {
    const m = new Map<string, string>();
    suppliersRaw.forEach((s) => { m.set(s.code.toUpperCase(), s.name); m.set(s.name.toUpperCase(), s.name); });
    return m;
  }, [suppliersRaw]);

  const resolveName = (raw: string) => suppliersMap.get(raw.toUpperCase()) || raw;

  // Filter by type and date range
  const filtered = useMemo(() => {
    let list = items.filter((i) => i.tipo === activeType);
    if (dateFrom) list = list.filter((i) => i.data >= dateFrom);
    if (dateTo) list = list.filter((i) => i.data <= dateTo);
    if (supplierFilter) list = list.filter((i) => resolveName(i.fornecedor || "Desconhecido") === supplierFilter);
    return list;
  }, [items, activeType, dateFrom, dateTo, supplierFilter]);

  const total = filtered.length;

  // Supplier table: Fornecedor | Qty PN inspecionados | sum OK | sum NG
  const supplierData = useMemo(() => {
    const map = new Map<string, { ok: number; ng: number; pns: Set<string> }>();
    filtered.forEach((d) => {
      const name = resolveName(d.fornecedor || "Desconhecido");
      const e = map.get(name) || { ok: 0, ng: 0, pns: new Set<string>() };
      e.ok += (d.quantidade_ok || 0);
      e.ng += (d.quantidade_ng || 0);
      if (d.part_number) e.pns.add(d.part_number);
      map.set(name, e);
    });
    return Array.from(map.entries())
      .map(([name, { ok, ng, pns }]) => ({ name, ok, ng, total: ok + ng, qtyPN: pns.size }))
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  // Project Status donuts (rate OK vs NG by project)
  const projectData = useMemo(() => {
    const map = new Map<string, { ok: number; ng: number }>();
    filtered.forEach((d) => {
      const proj = d.projeto || "—";
      const e = map.get(proj) || { ok: 0, ng: 0 };
      e.ok += (d.quantidade_ok || 0);
      e.ng += (d.quantidade_ng || 0);
      map.set(proj, e);
    });
    return Array.from(map.entries())
      .map(([name, { ok, ng }]) => ({ name, ok, ng, total: ok + ng }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);
  }, [filtered]);

  // Main Failure Mode bar (only from NG items)
  const failureModeData = useMemo(() => {
    const map = new Map<string, number>();
    filtered.filter(d => (d.quantidade_ng || 0) > 0).forEach((d) => {
      if (d.modo_falha) {
        const stripped = d.modo_falha.replace(/^\d+\s*-\s*/, "").trim();
        const qty = d.quantidade_ng || 0;
        const sdCount = (d.segundo_defeitos as any[] | null)?.length || 0;
        const mainQty = sdCount > 0 ? Math.ceil(qty / (sdCount + 1)) : qty;
        map.set(stripped, (map.get(stripped) || 0) + mainQty);
      }
      const sd = d.segundo_defeitos as any[] | null;
      if (sd && Array.isArray(sd)) {
        sd.forEach((def: any) => {
          if (def.modo_falha) {
            const stripped = def.modo_falha.replace(/^\d+\s*-\s*/, "").trim();
            map.set(stripped, (map.get(stripped) || 0) + (def.qty || 1));
          }
        });
      }
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name: name.length > 20 ? name.substring(0, 20) + "..." : name, fullName: name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filtered]);

  // Problem type table (only from NG items)
  const problemTypes = useMemo(() => {
    const map = new Map<string, number>();
    filtered.filter(d => (d.quantidade_ng || 0) > 0).forEach((d) => {
      if (d.modo_falha) {
        const label = d.modo_falha.replace(/^\d+\s*-\s*/, "").trim();
        const qty = d.quantidade_ng || 0;
        const sdCount = (d.segundo_defeitos as any[] | null)?.length || 0;
        const mainQty = sdCount > 0 ? Math.ceil(qty / (sdCount + 1)) : qty;
        map.set(label, (map.get(label) || 0) + mainQty);
      }
      const sd = d.segundo_defeitos as any[] | null;
      if (sd && Array.isArray(sd)) {
        sd.forEach((def: any) => {
          if (def.modo_falha) {
            const label = def.modo_falha.replace(/^\d+\s*-\s*/, "").trim();
            map.set(label, (map.get(label) || 0) + (def.qty || 1));
          }
        });
      }
    });
    const arr = Array.from(map.entries()).map(([type, qty]) => ({ type, qty })).sort((a, b) => b.qty - a.qty);
    const totalP = arr.reduce((a, b) => a + b.qty, 0);
    return { items: arr, total: totalP };
  }, [filtered]);

  // Main issues (only NG items)
  const mainIssues = useMemo(() => {
    return filtered
      .filter((d) => (d.quantidade_ng || 0) > 0)
      .map((d) => {
        const issues: any[] = [];
        if (d.modo_falha) {
          issues.push({
            supplier: resolveName(d.fornecedor || "—"),
            pn: d.part_number || "—",
            description: d.part_name || d.descricao || "—",
            category: stripCode(d.modo_falha),
            ng: d.quantidade_ng || 0,
          });
        }
        const sd = d.segundo_defeitos as any[] | null;
        if (sd && Array.isArray(sd)) {
          sd.forEach((def: any) => {
            issues.push({
              supplier: resolveName(d.fornecedor || "—"),
              pn: d.part_number || "—",
              description: d.part_name || "—",
              category: stripCode(def.modo_falha || "—"),
              ng: def.qty || 0,
            });
          });
        }
        return issues;
      })
      .flat()
      .slice(0, 15);
  }, [filtered]);

  const chartConfig = {
    ok: { label: "OK", color: "hsl(140, 55%, 45%)" },
    ng: { label: "NG", color: "hsl(0, 55%, 50%)" },
    value: { label: "Quantidade", color: "hsl(210, 70%, 60%)" },
  };

  const renderSupplierAxisTick = ({ x = 0, y = 0, payload }: { x?: number; y?: number; payload?: { value?: string } }) => {
    const name = payload?.value ?? "";
    const displayName = name.length > 18 ? name.substring(0, 18) + "…" : name;
    return (
      <text x={x} y={y} dx={-4} dy={4} textAnchor="end" fill="hsl(0 0% 100%)" style={{ fill: "hsl(0 0% 100%)", fontSize: "10px", fontWeight: 500 }}>
        {displayName}
      </text>
    );
  };

  const SectionHeader = ({ children }: { children: React.ReactNode }) => (
    <div className="bg-[hsl(220,10%,30%)] px-3 py-1.5 border border-[hsl(220,10%,40%)]">
      <h3 className="text-sm font-bold text-[hsl(0,0%,90%)] text-center tracking-wide">{children}</h3>
    </div>
  );

  const DonutChart = ({ data, title }: { data: { name: string; value: number }[]; title: string }) => {
    const okVal = data[0]?.value || 0;
    const ngVal = data[1]?.value || 0;
    const totalD = okVal + ngVal;
    const okPct = totalD > 0 ? ((okVal / totalD) * 100).toFixed(1) : "0";
    const ngPct = totalD > 0 ? ((ngVal / totalD) * 100).toFixed(1) : "0";
    return (
      <div className="flex flex-col items-center">
        <div className="relative w-28 h-28">
          <ChartContainer config={chartConfig} className="h-28 w-28">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={30} outerRadius={48} dataKey="value" strokeWidth={0}>
                {data.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i]} />)}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[11px] font-bold text-[hsl(0,0%,95%)]">{title}</span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-0 mt-1">
          <div className="flex gap-3">
            <span className="text-[10px] text-[hsl(45,80%,55%)] font-semibold">{okPct}% OK</span>
            <span className="text-[10px] text-[hsl(15,70%,45%)] font-semibold">{ngPct}% NG</span>
          </div>
          <div className="flex gap-3 text-[9px] text-[hsl(0,0%,60%)]">
            <span>OK: {okVal}</span>
            <span>NG: {ngVal}</span>
          </div>
        </div>
      </div>
    );
  };

  const exportToPptx = async () => {
    const pptx = new pptxgen();
    pptx.layout = "LAYOUT_WIDE";
    const BG = "1a2035";
    const HEADER_BG = "2a3040";
    const TXT = "E0E0E0";
    const TXT_DIM = "999999";
    const BORDER_CLR = "3a4050";
    const OK_CLR = "3B8F3B";
    const NG_CLR = "B33B3B";
    const ACCENT = "5B9BD5";

    const s1 = pptx.addSlide();
    s1.background = { color: BG };
    s1.addText(`${TYPE_LABELS[activeType]} — Apontamentos Dashboard`, { x: 0.3, y: 0.15, w: 8, h: 0.45, fontSize: 18, color: "FFFFFF", bold: true });
    s1.addText(`Total: ${total}`, { x: 10, y: 0.15, w: 3, h: 0.45, fontSize: 11, color: TXT_DIM, align: "right" });

    // Supplier table
    s1.addText("General Quality Incoming Status", { x: 0.3, y: 0.7, w: 3.8, h: 0.3, fontSize: 10, color: "FFFFFF", bold: true, fill: { color: HEADER_BG }, align: "center" });
    const supRows: pptxgen.TableRow[] = [[
      { text: "Fornecedor", options: { bold: true, color: "FFFFFF", fill: { color: HEADER_BG }, fontSize: 8 } },
      { text: "Qty PN", options: { bold: true, color: "FFFFFF", fill: { color: HEADER_BG }, fontSize: 8, align: "center" } },
      { text: "OK", options: { bold: true, color: "FFFFFF", fill: { color: HEADER_BG }, fontSize: 8, align: "center" } },
      { text: "NG", options: { bold: true, color: "FFFFFF", fill: { color: HEADER_BG }, fontSize: 8, align: "center" } },
    ]];
    supplierData.forEach((s, i) => {
      const rowBg = i % 2 === 0 ? "1e2538" : "232a3e";
      supRows.push([
        { text: s.name, options: { color: ACCENT, fontSize: 8, fill: { color: rowBg } } },
        { text: String(s.qtyPN), options: { color: TXT, fontSize: 8, align: "center", fill: { color: rowBg } } },
        { text: String(s.ok), options: { color: TXT, fontSize: 8, align: "center", fill: { color: rowBg } } },
        { text: String(s.ng), options: { color: TXT, fontSize: 8, align: "center", fill: { color: rowBg } } },
      ]);
    });
    const ttlOk = supplierData.reduce((a, b) => a + b.ok, 0);
    const ttlNg = supplierData.reduce((a, b) => a + b.ng, 0);
    supRows.push([
      { text: "TTL", options: { bold: true, color: TXT, fontSize: 8, fill: { color: HEADER_BG } } },
      { text: String(supplierData.reduce((a, b) => a + b.qtyPN, 0)), options: { bold: true, color: TXT, fontSize: 8, align: "center", fill: { color: HEADER_BG } } },
      { text: String(ttlOk), options: { bold: true, color: TXT, fontSize: 8, align: "center", fill: { color: HEADER_BG } } },
      { text: String(ttlNg), options: { bold: true, color: TXT, fontSize: 8, align: "center", fill: { color: HEADER_BG } } },
    ]);
    s1.addTable(supRows, { x: 0.3, y: 1.05, w: 3.8, colW: [1.6, 0.7, 0.7, 0.7], fontSize: 8, border: { type: "solid", pt: 0.5, color: BORDER_CLR } });

    // Supplier bar
    s1.addText("Supplier Status", { x: 4.3, y: 0.7, w: 4.2, h: 0.3, fontSize: 10, color: "FFFFFF", bold: true, fill: { color: HEADER_BG }, align: "center" });
    if (supplierData.length > 0) {
      s1.addChart(pptx.ChartType.bar, [
        { name: "OK", labels: supplierData.map(s => s.name), values: supplierData.map(s => s.ok) },
        { name: "NG", labels: supplierData.map(s => s.name), values: supplierData.map(s => s.ng) },
      ], { x: 4.3, y: 1.3, w: 4.2, h: 3.5, barDir: "bar", barGrouping: "stacked", chartColors: [OK_CLR, NG_CLR], showValue: false, catAxisLabelColor: "FFFFFF", catAxisLabelFontSize: 8, valAxisHidden: true, showLegend: true, legendPos: "b", legendColor: TXT_DIM, legendFontSize: 7, plotArea: { fill: { color: BG } } });
    }

    await pptx.writeFile({ fileName: `Dashboard_${TYPE_LABELS[activeType]}_Apontamentos.pptx` });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[hsl(220,20%,10%)] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  const ttlOk = supplierData.reduce((a, b) => a + b.ok, 0);
  const ttlNg = supplierData.reduce((a, b) => a + b.ng, 0);

  return (
    <div className="min-h-screen bg-[hsl(220,20%,10%)]">
      {/* Header */}
      <div className="border-b border-[hsl(220,10%,25%)] bg-[hsl(220,20%,12%)] px-3 md:px-4 py-2 md:py-3 flex items-center gap-2 md:gap-4 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate("/apontamentos")} className="text-[hsl(0,0%,60%)] hover:text-[hsl(0,0%,90%)] hover:bg-[hsl(220,10%,20%)] px-2">
          <ArrowLeft className="w-4 h-4 md:mr-2" /><span className="hidden md:inline">Voltar</span>
        </Button>
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-sm md:text-xl font-bold text-[hsl(0,0%,90%)] font-heading tracking-wide truncate">
            Apontamentos — {TYPE_LABELS[activeType]} Status
          </h1>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("w-[130px] text-[10px] h-7 bg-[hsl(220,15%,18%)] border-[hsl(220,10%,30%)] text-[hsl(0,0%,80%)] justify-start", !dateFrom && "text-[hsl(0,0%,50%)]")}>
                  <CalendarIcon className="w-3 h-3 mr-1" />
                  {dateFrom ? format(new Date(dateFrom + "T12:00:00"), "dd/MM/yyyy") : "De"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom ? new Date(dateFrom + "T12:00:00") : undefined} onSelect={(d) => setDateFrom(d ? format(d, "yyyy-MM-dd") : "")} locale={ptBR} className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
            <span className="text-[10px] text-[hsl(0,0%,50%)]">a</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("w-[130px] text-[10px] h-7 bg-[hsl(220,15%,18%)] border-[hsl(220,10%,30%)] text-[hsl(0,0%,80%)] justify-start", !dateTo && "text-[hsl(0,0%,50%)]")}>
                  <CalendarIcon className="w-3 h-3 mr-1" />
                  {dateTo ? format(new Date(dateTo + "T12:00:00"), "dd/MM/yyyy") : "Até"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo ? new Date(dateTo + "T12:00:00") : undefined} onSelect={(d) => setDateTo(d ? format(d, "yyyy-MM-dd") : "")} locale={ptBR} className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-[hsl(0,0%,60%)] hover:text-[hsl(0,0%,90%)] h-7 px-1.5 text-[10px]">Limpar</Button>
            )}
          </div>
          <span className="text-[10px] md:text-xs text-[hsl(0,0%,50%)]">Total: {total}</span>
          <Button variant="outline" size="sm" onClick={exportToPptx} className="text-[hsl(0,0%,80%)] border-[hsl(220,10%,30%)] bg-[hsl(220,15%,18%)] hover:bg-[hsl(220,15%,25%)] text-xs">
            <Download className="w-3.5 h-3.5 mr-1" />PPTX
          </Button>
        </div>
      </div>

      {/* Type tabs */}
      <div className="px-3 md:px-4 pt-3">
        <Tabs value={activeType} onValueChange={setActiveType}>
          <TabsList className="grid w-full grid-cols-4 h-auto bg-[hsl(220,15%,16%)] border border-[hsl(220,10%,25%)]">
            {TYPES.map((t) => (
              <TabsTrigger key={t} value={t} className="text-xs sm:text-sm py-2 text-[hsl(0,0%,60%)] data-[state=active]:bg-[hsl(220,10%,25%)] data-[state=active]:text-[hsl(0,0%,95%)]">
                {TYPE_LABELS[t]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Main grid */}
      <main className="p-2 md:p-4 grid grid-cols-1 lg:grid-cols-12 gap-3 overflow-x-hidden">
        {/* LEFT: General Quality Status table */}
        <div className="lg:col-span-3 border border-[hsl(220,10%,25%)] bg-[hsl(220,15%,14%)] overflow-x-auto rounded-lg">
          <SectionHeader>General Quality {TYPE_LABELS[activeType]} Status</SectionHeader>
          {supplierFilter && (
            <div className="px-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setSupplierFilter(null)} className="text-[10px] h-6 bg-[hsl(210,70%,60%)]/20 border-[hsl(210,70%,60%)]/40 text-[hsl(210,70%,60%)] hover:bg-[hsl(210,70%,60%)]/30 gap-1">
                ✕ Filtro: {supplierFilter}
              </Button>
            </div>
          )}
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[hsl(220,10%,25%)]">
                <th className="text-left px-2 py-1.5 text-[hsl(0,0%,70%)] font-medium">Fornecedor</th>
                <th className="text-center px-2 py-1.5 text-[hsl(0,0%,70%)] font-medium">Qty PN</th>
                <th className="text-center px-2 py-1.5 text-[hsl(0,0%,70%)] font-medium" colSpan={2}>
                  <div>Status</div>
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
                  <td className="px-2 py-1 text-[hsl(210,70%,60%)] cursor-pointer hover:underline" onClick={() => setSupplierFilter(s.name)}>{s.name}</td>
                  <td className="text-center px-2 py-1 text-[hsl(0,0%,80%)]">{s.qtyPN}</td>
                  <td className="text-center px-2 py-1 text-[hsl(0,0%,80%)]">{s.ok}</td>
                  <td className="text-center px-2 py-1 text-[hsl(0,0%,80%)]">{s.ng}</td>
                </tr>
              ))}
              <tr className="bg-[hsl(220,10%,20%)] font-bold">
                <td className="px-2 py-1.5 text-[hsl(0,0%,80%)]">TTL</td>
                <td className="text-center px-2 py-1.5 text-[hsl(0,0%,80%)]">{supplierData.reduce((a, b) => a + b.qtyPN, 0)}</td>
                <td className="text-center px-2 py-1.5 text-[hsl(0,0%,80%)]">{ttlOk}</td>
                <td className="text-center px-2 py-1.5 text-[hsl(0,0%,80%)]">{ttlNg}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* CENTER: Supplier Status (horizontal bars) - qty OK vs qty NG */}
        <div className="lg:col-span-4 border border-[hsl(220,10%,25%)] bg-[hsl(220,15%,14%)] overflow-hidden rounded-lg">
          <SectionHeader>Supplier Status</SectionHeader>
          <p className="text-[10px] text-[hsl(0,0%,60%)] px-3 pt-2">❖ Status of Supplier OK vs NG</p>
          {supplierData.length > 0 ? (
            <ChartContainer config={chartConfig} className="w-full px-1" style={{ height: Math.max(300, supplierData.length * 35) }}>
              <BarChart data={supplierData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={140} tick={renderSupplierAxisTick} axisLine={false} tickLine={false} interval={0} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="ok" stackId="a" fill="hsl(140, 55%, 45%)" barSize={16}>
                  <LabelList dataKey="ok" position="center" fontSize={9} fill="white" formatter={(v: number) => v > 0 ? v : ''} />
                </Bar>
                <Bar dataKey="ng" stackId="a" fill="hsl(0, 55%, 50%)" barSize={16}>
                  <LabelList dataKey="ng" position="center" fontSize={9} fill="white" formatter={(v: number) => v > 0 ? v : ''} />
                </Bar>
              </BarChart>
            </ChartContainer>
          ) : (
            <p className="text-[hsl(0,0%,50%)] text-xs text-center py-12">Sem dados.</p>
          )}
        </div>

        {/* RIGHT: Project Status donuts + Failure Mode */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          {/* Project Status donuts */}
          <div className="border border-[hsl(220,10%,25%)] bg-[hsl(220,15%,14%)] p-3 rounded-lg">
            <SectionHeader>Project Status</SectionHeader>
            <div className="flex justify-around mt-3 flex-wrap gap-2">
              {projectData.length > 0 ? projectData.map((proj, i) => (
                <DonutChart key={i} data={[
                  { name: "OK", value: proj.ok },
                  { name: "NG", value: proj.ng },
                ]} title={proj.name} />
              )) : (
                <p className="text-[hsl(0,0%,50%)] text-xs text-center py-4">Sem dados de projeto.</p>
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

        {/* BOTTOM LEFT: Data - Problem */}
        <div className="lg:col-span-4 border border-[hsl(220,10%,25%)] bg-[hsl(220,15%,14%)] rounded-lg overflow-x-auto">
          <SectionHeader>{TYPE_LABELS[activeType]} Data – Problem</SectionHeader>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[hsl(220,10%,25%)]">
                <th className="text-left px-3 py-1.5 text-[hsl(0,0%,70%)] font-medium">Type</th>
                <th className="text-center px-3 py-1.5 text-[hsl(0,0%,70%)] font-medium">Qty</th>
                <th className="text-center px-3 py-1.5 text-[hsl(0,0%,70%)] font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {problemTypes.items.map((p, i) => (
                <tr key={p.type} className={`border-b border-[hsl(220,10%,20%)] ${i % 2 === 0 ? 'bg-[hsl(220,15%,14%)]' : 'bg-[hsl(220,15%,16%)]'}`}>
                  <td className="px-3 py-1 text-[hsl(0,0%,80%)]">{p.type}</td>
                  <td className="text-center px-3 py-1 text-[hsl(0,0%,80%)]">{p.qty}</td>
                  <td className="text-center px-3 py-1 text-[hsl(0,0%,80%)]">{problemTypes.total > 0 ? ((p.qty / problemTypes.total) * 100).toFixed(0) : 0}%</td>
                </tr>
              ))}
              {problemTypes.items.length === 0 && (
                <tr><td colSpan={3} className="text-center py-4 text-[hsl(0,0%,50%)]">Sem dados.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* BOTTOM RIGHT: Main Issues table (NG only) */}
        <div className="lg:col-span-8 border border-[hsl(220,10%,25%)] bg-[hsl(220,15%,14%)] overflow-x-auto rounded-lg">
          <SectionHeader>Main Issues</SectionHeader>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[hsl(220,10%,25%)]">
                <th className="text-left px-3 py-1.5 text-[hsl(0,0%,70%)] font-medium">Supplier</th>
                <th className="text-left px-3 py-1.5 text-[hsl(0,0%,70%)] font-medium">PN</th>
                <th className="text-left px-3 py-1.5 text-[hsl(0,0%,70%)] font-medium">Description</th>
                <th className="text-left px-3 py-1.5 text-[hsl(0,0%,70%)] font-medium">Category</th>
                <th className="text-center px-3 py-1.5 text-[hsl(0,0%,70%)] font-medium">NG</th>
              </tr>
            </thead>
            <tbody>
              {mainIssues.length > 0 ? mainIssues.map((issue, i) => (
                <tr key={i} className={`border-b border-[hsl(220,10%,20%)] ${i % 2 === 0 ? 'bg-[hsl(220,15%,14%)]' : 'bg-[hsl(220,15%,16%)]'}`}>
                  <td className="px-3 py-1 text-[hsl(0,0%,80%)]">{issue.supplier}</td>
                  <td className="px-3 py-1 text-[hsl(0,0%,80%)]">{issue.pn}</td>
                  <td className="px-3 py-1 text-[hsl(0,0%,80%)]">{issue.description}</td>
                  <td className="px-3 py-1 text-[hsl(0,0%,80%)]">{issue.category}</td>
                  <td className="text-center px-3 py-1 text-[hsl(0,55%,55%)] font-semibold">{issue.ng}</td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="text-center py-4 text-[hsl(0,0%,50%)]">Sem issues registrados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
};

export default ApontamentoDashboard;