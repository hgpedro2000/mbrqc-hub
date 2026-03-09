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
} from "recharts";

const IMPROVEMENT_CATEGORIES: Record<number, string> = {
  1: "Dimensional",
  2: "Visual",
  3: "Funcional",
  4: "Processo",
  5: "Material",
};

interface InjectionRow {
  projeto: string;
  fornecedor: string;
  part_number: string;
  part_name: string;
  needs_improvement: boolean;
  improvement_category: number | null;
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

  useEffect(() => {
    const fetchData = async () => {
      const [injRes, paintRes, assemblyRes] = await Promise.all([
        supabase.from("injection_checklists").select("projeto, fornecedor, part_number, part_name, needs_improvement, improvement_category, created_at, cycle_time, cooling_time, weight, dimensional"),
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

  // --- Data aggregations ---
  const totalInjection = injectionData.length;
  const totalAll = totalInjection + paintingCount + assemblyCount;

  // Supplier table + horizontal bar data
  const supplierMap = new Map<string, { ok: number; ng: number; pns: Set<string> }>();
  injectionData.forEach((d) => {
    const existing = supplierMap.get(d.fornecedor) || { ok: 0, ng: 0, pns: new Set<string>() };
    if (d.needs_improvement) existing.ng++;
    else existing.ok++;
    existing.pns.add(d.part_number);
    supplierMap.set(d.fornecedor, existing);
  });
  const supplierData = Array.from(supplierMap.entries())
    .map(([name, { ok, ng, pns }]) => ({ name, ok, ng, total: ok + ng, qtyPN: pns.size }))
    .sort((a, b) => b.total - a.total);

  // Donut charts data: Weight OK/NG, Dimensional OK/NG, Appearance (Visual) OK/NG
  const getDonutData = (filterFn: (d: InjectionRow) => boolean) => {
    const ok = injectionData.filter((d) => !d.needs_improvement || !filterFn(d)).length;
    const ng = injectionData.filter((d) => d.needs_improvement && filterFn(d)).length;
    return [
      { name: "OK", value: ok },
      { name: "NG", value: ng },
    ];
  };
  const weightDonut = getDonutData((d) => d.improvement_category === 5); // Material ~ Weight
  const dimensionalDonut = getDonutData((d) => d.improvement_category === 1);
  const appearanceDonut = getDonutData((d) => d.improvement_category === 2);

  // Main Failure Mode (improvement categories breakdown)
  const failureMap = new Map<string, number>();
  injectionData.forEach((d) => {
    if (d.needs_improvement && d.improvement_category) {
      const label = IMPROVEMENT_CATEGORIES[d.improvement_category] || `Cat ${d.improvement_category}`;
      failureMap.set(label, (failureMap.get(label) || 0) + 1);
    }
  });
  const failureModeData = Array.from(failureMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Problem type data
  const problemTypes = [
    { type: "Dimensional", qty: injectionData.filter(d => d.needs_improvement && d.improvement_category === 1).length },
    { type: "Visual", qty: injectionData.filter(d => d.needs_improvement && d.improvement_category === 2).length },
    { type: "Funcional", qty: injectionData.filter(d => d.needs_improvement && d.improvement_category === 3).length },
    { type: "Processo", qty: injectionData.filter(d => d.needs_improvement && d.improvement_category === 4).length },
    { type: "Material", qty: injectionData.filter(d => d.needs_improvement && d.improvement_category === 5).length },
  ];
  const totalProblems = problemTypes.reduce((a, b) => a + b.qty, 0);

  // Main issues (NG items list)
  const mainIssues = injectionData
    .filter((d) => d.needs_improvement)
    .slice(0, 8)
    .map((d) => ({
      supplier: d.fornecedor,
      pn: d.part_number,
      description: d.part_name,
      category: d.improvement_category ? IMPROVEMENT_CATEGORIES[d.improvement_category] : "—",
    }));

  const chartConfig = {
    ok: { label: "OK", color: "hsl(0, 65%, 45%)" },
    ng: { label: "NG", color: "hsl(140, 60%, 45%)" },
    value: { label: "Quantidade", color: "hsl(210, 70%, 60%)" },
  };

  const DONUT_COLORS = ["hsl(45, 80%, 55%)", "hsl(15, 70%, 45%)", "hsl(0, 60%, 35%)"];

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
          <span className="text-[10px] text-[hsl(45,80%,55%)]">{okPct}</span>
          <span className="text-[10px] text-[hsl(15,70%,45%)]">{ngPct}</span>
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
        <div className="ml-auto text-[10px] md:text-xs text-[hsl(0,0%,50%)]">
          Total: {totalAll}
        </div>
      </div>

      {/* Main grid */}
      <main className="p-2 md:p-4 grid grid-cols-1 lg:grid-cols-12 gap-3 overflow-x-hidden">
        {/* LEFT: General Quality Incoming Status table */}
        <div className="lg:col-span-3 border border-[hsl(220,10%,25%)] bg-[hsl(220,15%,14%)] overflow-x-auto">
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
        <div className="lg:col-span-4 border border-[hsl(220,10%,25%)] bg-[hsl(220,15%,14%)] overflow-hidden">
          <SectionHeader>Supplier T/Out Status</SectionHeader>
          <p className="text-[10px] text-[hsl(0,0%,60%)] px-3 pt-2">❖ Status of Supplier T/Outs OK vs NG</p>
          {supplierData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[280px] w-full px-1">
              <BarChart data={supplierData} layout="vertical" margin={{ left: 70, right: 30, top: 5, bottom: 5 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={65} tick={{ fontSize: 10, fill: "hsl(0,0%,70%)" }} axisLine={false} tickLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="ok" stackId="a" fill="hsl(0, 55%, 50%)" barSize={16} />
                <Bar dataKey="ng" stackId="a" fill="hsl(140, 55%, 45%)" barSize={16} />
              </BarChart>
            </ChartContainer>
          ) : (
            <p className="text-[hsl(0,0%,50%)] text-xs text-center py-12">Sem dados.</p>
          )}
        </div>

        {/* RIGHT: Donuts + Failure Mode */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          {/* Donut charts row */}
          <div className="border border-[hsl(220,10%,25%)] bg-[hsl(220,15%,14%)] p-3">
            <SectionHeader>Try Out Attendance Status</SectionHeader>
            <div className="flex justify-around mt-3">
              <DonutChart data={weightDonut} title="Weight" />
              <DonutChart data={dimensionalDonut} title="Dimensional" />
              <DonutChart data={appearanceDonut} title="Appearance" />
            </div>
          </div>

          {/* Main Failure Mode */}
          <div className="border border-[hsl(220,10%,25%)] bg-[hsl(220,15%,14%)] flex-1">
            <SectionHeader>Main Failure Mode</SectionHeader>
            {failureModeData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[180px] w-full">
                <BarChart data={failureModeData} margin={{ left: 10, right: 10, top: 15, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,10%,25%)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(0,0%,60%)" }} angle={-35} textAnchor="end" axisLine={false} height={40} />
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
        <div className="lg:col-span-4 border border-[hsl(220,10%,25%)] bg-[hsl(220,15%,14%)]">
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
        <div className="lg:col-span-8 border border-[hsl(220,10%,25%)] bg-[hsl(220,15%,14%)] overflow-x-auto">
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
