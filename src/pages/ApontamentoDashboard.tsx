import { useState, useMemo } from "react";
import { getLocalDateString } from "@/lib/localDate";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, CalendarIcon, ChevronDown, X } from "lucide-react";
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import pptxgen from "pptxgenjs";
import { stripCode } from "@/lib/stripCode";
import ApontamentoDailyReport from "@/components/apontamento/ApontamentoDailyReport";
import ApontamentoViewDialog from "@/components/apontamento/ApontamentoViewDialog";

const TYPES = ["incoming", "peca", "processo", "oem", "100days"] as const;
const TYPE_LABELS: Record<string, string> = { incoming: "Incoming", peca: "Peça", processo: "Processo", oem: "OEM", "100days": "100 Days" };
const HUNDRED_DAYS_PROJECT = "BC4b";
const DONUT_COLORS = ["hsl(45, 80%, 55%)", "hsl(15, 70%, 45%)"];

const ApontamentoDashboard = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { impersonating } = useImpersonation();
  const [activeType, setActiveType] = useState("incoming");
  const [dateFromOpen, setDateFromOpen] = useState(false);
  const [dateToOpen, setDateToOpen] = useState(false);
  const today = getLocalDateString();

  // Per-tab filter state — each tab keeps its own filters independently
  const [dateFromMap, setDateFromMap] = useState<Record<string, string>>({});
  const [dateToMap, setDateToMap] = useState<Record<string, string>>({});
  const [supplierFilterMap, setSupplierFilterMap] = useState<Record<string, string | null>>({});
  const [responsibilityFilterMap, setResponsibilityFilterMap] = useState<Record<string, string | null>>({});
  const [projectFilterMap, setProjectFilterMap] = useState<Record<string, string | null>>({});
  const [moduleFilterMap, setModuleFilterMap] = useState<Record<string, string | null>>({});
  const [pnFilterMap, setPnFilterMap] = useState<Record<string, string | null>>({});
  const [failureModeFilterMap, setFailureModeFilterMap] = useState<Record<string, string[]>>({});

  const dateFrom = dateFromMap[activeType] ?? "";
  const dateTo = dateToMap[activeType] ?? "";
  const supplierFilter = supplierFilterMap[activeType] ?? null;
  const responsibilityFilter = responsibilityFilterMap[activeType] ?? null;
  const projectFilter = projectFilterMap[activeType] ?? null;
  const moduleFilter = moduleFilterMap[activeType] ?? null;
  const pnFilter = pnFilterMap[activeType] ?? null;
  const failureModeFilter = failureModeFilterMap[activeType] ?? [];

  const makeScopedSetter = <T,>(setMap: React.Dispatch<React.SetStateAction<Record<string, T>>>, fallback: T) =>
    (value: T | ((prev: T) => T)) => {
      setMap((m) => {
        const prev = (m[activeType] ?? fallback) as T;
        const next = typeof value === "function" ? (value as (p: T) => T)(prev) : value;
        return { ...m, [activeType]: next };
      });
    };

  const setDateFrom = makeScopedSetter<string>(setDateFromMap, "");
  const setDateTo = makeScopedSetter<string>(setDateToMap, "");
  const setSupplierFilter = makeScopedSetter<string | null>(setSupplierFilterMap, null);
  const setResponsibilityFilter = makeScopedSetter<string | null>(setResponsibilityFilterMap, null);
  const setProjectFilter = makeScopedSetter<string | null>(setProjectFilterMap, null);
  const setModuleFilter = makeScopedSetter<string | null>(setModuleFilterMap, null);
  const setPnFilter = makeScopedSetter<string | null>(setPnFilterMap, null);
  const setFailureModeFilter = makeScopedSetter<string[]>(setFailureModeFilterMap, []);

  const [showPPM, setShowPPM] = useState(false);

  const { data: rawItems = [], isLoading } = useQuery({
    queryKey: ["apontamentos", "all"],
    queryFn: async () => {
      const PAGE = 1000;
      let from = 0;
      const all: any[] = [];
      // paginate to bypass Supabase default 1000-row cap
      while (true) {
        const { data, error } = await supabase
          .from("apontamentos")
          .select("*")
          .order("created_at", { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      return all;
    },
  });

  // Profiles for empresa-based scoping (terceira users only see their own company)
  const { data: profilesList = [] } = useQuery({
    queryKey: ["profiles-empresa-map-dash"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_creator_empresa_map");
      if (error) throw error;
      return data || [];
    },
  });
  const empresaByUserId = useMemo(() => {
    const map: Record<string, string> = {};
    (profilesList as any[]).forEach((p: any) => {
      map[p.id] = p.empresa === "empresa_terceira" ? (p.empresa_terceira || "Terceira") : "Mobis Brasil";
    });
    return map;
  }, [profilesList]);
  const effEmpresa = impersonating ? impersonating.empresa : profile?.empresa;
  const effEmpresaTerceira = impersonating ? impersonating.empresa_terceira : profile?.empresa_terceira;
  const isTerceira = effEmpresa === "empresa_terceira";
  const terceiraName = effEmpresaTerceira || null;
  const items = useMemo(() => {
    if (!isTerceira || !terceiraName) return rawItems;
    return (rawItems as any[]).filter((i) => i.created_by && empresaByUserId[i.created_by] === terceiraName);
  }, [rawItems, isTerceira, terceiraName, empresaByUserId]);

  const { data: suppliersRaw = [] } = useQuery({
    queryKey: ["suppliers-dash"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("code, name");
      if (error) throw error;
      return data;
    },
  });

  // Master PNs for 100 Days project (filter by master, not by sometimes-misregistered apontamento.projeto)
  const { data: bc4bPnsRaw = [] } = useQuery({
    queryKey: ["pns-bc4b"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("part_numbers")
        .select("part_number, line_module")
        .eq("project", HUNDRED_DAYS_PROJECT);
      if (error) throw error;
      return data || [];
    },
  });
  const bc4bPnSet = useMemo(() => new Set((bc4bPnsRaw as any[]).map((p) => p.part_number)), [bc4bPnsRaw]);
  const bc4bPnModuleMap = useMemo(() => {
    const m = new Map<string, string>();
    (bc4bPnsRaw as any[]).forEach((p) => { if (p.part_number) m.set(p.part_number, (p.line_module || "—").toUpperCase()); });
    return m;
  }, [bc4bPnsRaw]);

  // NG report dialog state (opened from clicking a Problem Type row)
  const [ngReportOpen, setNgReportOpen] = useState(false);
  const [ngReportFailureMode, setNgReportFailureMode] = useState<string | null>(null);
  const [ngBreakdownOpen, setNgBreakdownOpen] = useState(false);
  const [ngRespFilter, setNgRespFilter] = useState<string | null>(null);
  const [viewTarget, setViewTarget] = useState<string | null>(null);

  const suppliersMap = useMemo(() => {
    const m = new Map<string, string>();
    suppliersRaw.forEach((s) => { m.set(s.code.toUpperCase(), s.name); m.set(s.name.toUpperCase(), s.name); });
    return m;
  }, [suppliersRaw]);

  const resolveName = (raw: string) => suppliersMap.get(raw.toUpperCase()) || raw;

  // Base list: 100 Days = incoming whose part_number belongs to project BC4b (per master part_numbers table)
  const baseList = useMemo(() => {
    if (activeType === "100days") {
      return items.filter((i) => i.tipo === "incoming" && i.part_number && bc4bPnSet.has(i.part_number));
    }
    return items.filter((i) => i.tipo === activeType);
  }, [items, activeType, bc4bPnSet]);

  // Filter by date range / supplier / responsibility / project / PN
  const filtered = useMemo(() => {
    let list = baseList;
    if (dateFrom) list = list.filter((i) => i.data >= dateFrom);
    if (dateTo) list = list.filter((i) => i.data <= dateTo);
    if (supplierFilter) list = list.filter((i) => resolveName(i.fornecedor || "Desconhecido") === supplierFilter);
    if (projectFilter) list = list.filter((i) => (i.projeto || "—") === projectFilter);
    if (moduleFilter) list = list.filter((i) => (bc4bPnModuleMap.get(i.part_number || "") || "—") === moduleFilter);
    if (pnFilter) list = list.filter((i) => (i.part_number || "—") === pnFilter);
    if (failureModeFilter.length > 0) {
      list = list.filter((i) => {
        const main = (i.modo_falha || "").replace(/^\d+\s*-\s*/, "").trim().toLowerCase();
        if (failureModeFilter.includes(main)) return true;
        const sd = (i as any).segundo_defeitos as any[] | null;
        if (sd && Array.isArray(sd)) {
          return sd.some((d) => failureModeFilter.includes((d.modo_falha || "").replace(/^\d+\s*-\s*/, "").trim().toLowerCase()));
        }
        return false;
      });
    }
    if (responsibilityFilter) {
      list = list.filter((i) => {
        const resp = i.responsabilidade_defeito;
        if (!resp) return false;
        const displayResp = resp.replace(/^\d+\s*-\s*/, "").trim().toLowerCase();
        if (!displayResp.includes("part") && !displayResp.includes("sorting")) return false;
        return displayResp.includes(responsibilityFilter.toLowerCase());
      });
    }
    return list;
  }, [baseList, dateFrom, dateTo, supplierFilter, projectFilter, moduleFilter, pnFilter, failureModeFilter, responsibilityFilter]);

  // Origem data (Part vs Sorting counts) — only counts records whose Responsabilidade is PART or SORTING
  const origemData = useMemo(() => {
    let list = baseList;
    if (dateFrom) list = list.filter((i) => i.data >= dateFrom);
    if (dateTo) list = list.filter((i) => i.data <= dateTo);
    if (supplierFilter) list = list.filter((i) => resolveName(i.fornecedor || "Desconhecido") === supplierFilter);
    if (projectFilter) list = list.filter((i) => (i.projeto || "—") === projectFilter);
    if (moduleFilter) list = list.filter((i) => (bc4bPnModuleMap.get(i.part_number || "") || "—") === moduleFilter);
    if (pnFilter) list = list.filter((i) => (i.part_number || "—") === pnFilter);
    let partCount = 0;
    let sortingCount = 0;
    let totalInspected = 0;
    let totalOk = 0;
    let totalNg = 0;
    list.forEach((i) => {
      totalInspected += (i.quantidade_ok || 0) + (i.quantidade_ng || 0);
      totalOk += (i.quantidade_ok || 0);
      totalNg += (i.quantidade_ng || 0);
      const resp = i.responsabilidade_defeito;
      if (!resp) return;
      const displayResp = resp.replace(/^\d+\s*-\s*/, "").trim().toLowerCase();
      if (displayResp.includes("part")) partCount++;
      else if (displayResp.includes("sorting")) sortingCount++;
    });
    return { part: partCount, sorting: sortingCount, total: partCount + sortingCount, totalInspected, totalOk, totalNg };
  }, [baseList, dateFrom, dateTo, supplierFilter, projectFilter, moduleFilter, pnFilter]);

  // NG breakdown by responsabilidade (for the popup opened from NG)
  const ngBreakdown = useMemo(() => {
    const ngList = filtered.filter((i) => (i.quantidade_ng || 0) > 0);
    const byResp = new Map<string, { qty: number; records: any[] }>();
    let totalNg = 0;
    ngList.forEach((i) => {
      const qty = i.quantidade_ng || 0;
      totalNg += qty;
      const raw = (i.responsabilidade_defeito || "").replace(/^\d+\s*-\s*/, "").trim();
      const key = raw || "Sem responsabilidade";
      const e = byResp.get(key) || { qty: 0, records: [] };
      e.qty += qty;
      e.records.push(i);
      byResp.set(key, e);
    });
    const groups = Array.from(byResp.entries())
      .map(([name, { qty, records }]) => ({ name, qty, records, pct: totalNg > 0 ? (qty / totalNg) * 100 : 0 }))
      .sort((a, b) => b.qty - a.qty);
    return { totalNg, groups };
  }, [filtered]);


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

  // Module Status donuts (rate OK vs NG by module) — used in 100 Days tab
  const moduleData = useMemo(() => {
    const labels: Record<string, string> = { CP: "CP - Cockpit", BP: "BP - Bumper", CH: "CH - Chassis", EI: "EI - End Items" };
    const order = ["CP", "BP", "CH", "EI"];
    const map = new Map<string, { ok: number; ng: number }>();
    order.forEach((k) => map.set(k, { ok: 0, ng: 0 }));
    filtered.forEach((d) => {
      const mod = (bc4bPnModuleMap.get(d.part_number || "") || "—").toUpperCase();
      const key = order.includes(mod) ? mod : "—";
      const e = map.get(key) || { ok: 0, ng: 0 };
      e.ok += (d.quantidade_ok || 0);
      e.ng += (d.quantidade_ng || 0);
      map.set(key, e);
    });
    return Array.from(map.entries())
      .filter(([, v]) => v.ok + v.ng > 0)
      .map(([name, { ok, ng }]) => ({ name, label: labels[name] || name, ok, ng, total: ok + ng }))
      .sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
  }, [filtered, bc4bPnModuleMap]);

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
            id: d.id,
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
              id: d.id,
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

  // Info popup: aggregate all INCs matching a given PN + category
  const [infoTarget, setInfoTarget] = useState<{ pn: string; category: string } | null>(null);
  const infoRecords = useMemo(() => {
    if (!infoTarget) return [] as Array<{ id: string; numero: string | null; date: string; ng: number; supplier: string }>;
    const rows: Array<{ id: string; numero: string | null; date: string; ng: number; supplier: string }> = [];
    filtered.forEach((d: any) => {
      if ((d.part_number || "—") !== infoTarget.pn) return;
      let qty = 0;
      if (d.modo_falha && stripCode(d.modo_falha) === infoTarget.category) {
        qty += d.quantidade_ng || 0;
      }
      const sd = d.segundo_defeitos as any[] | null;
      if (sd && Array.isArray(sd)) {
        sd.forEach((def: any) => {
          if (stripCode(def.modo_falha || "—") === infoTarget.category) qty += def.qty || 0;
        });
      }
      if (qty > 0) {
        rows.push({
          id: d.id,
          numero: d.numero || null,
          date: d.data || d.created_at || "",
          ng: qty,
          supplier: resolveName(d.fornecedor || "—"),
        });
      }
    });
    return rows.sort((a, b) => (b.date > a.date ? 1 : -1));
  }, [infoTarget, filtered]);
  const infoTotal = useMemo(() => infoRecords.reduce((s, r) => s + r.ng, 0), [infoRecords]);

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

  const DonutChart = ({ data, title, onClick, active }: { data: { name: string; value: number }[]; title: string; onClick?: () => void; active?: boolean }) => {
    const okVal = data[0]?.value || 0;
    const ngVal = data[1]?.value || 0;
    const totalD = okVal + ngVal;
    const okPct = totalD > 0 ? ((okVal / totalD) * 100).toFixed(1) : "0";
    const ngPct = totalD > 0 ? ((ngVal / totalD) * 100).toFixed(1) : "0";
    return (
      <button
        type="button"
        onClick={onClick}
        className={`flex flex-col items-center rounded-md p-1 transition-colors ${onClick ? "cursor-pointer hover:bg-[hsl(220,15%,18%)]" : "cursor-default"} ${active ? "ring-1 ring-[hsl(210,70%,60%)] bg-[hsl(210,70%,60%)]/10" : ""}`}
      >
        <div className="relative w-28 h-28">
          <ChartContainer config={chartConfig} className="h-28 w-28">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={30} outerRadius={48} dataKey="value" strokeWidth={0}>
                {data.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i]} />)}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-2 text-center leading-tight">
            {title.includes(" - ") ? (
              <>
                <span className="text-[11px] font-bold text-[hsl(0,0%,95%)]">{title.split(" - ")[0]}</span>
                <span className="text-[9px] font-semibold text-[hsl(0,0%,85%)]">{title.split(" - ").slice(1).join(" - ")}</span>
              </>
            ) : (
              <span className="text-[11px] font-bold text-[hsl(0,0%,95%)]">{title}</span>
            )}
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
      </button>
    );
  };

  // HSL→Hex helper for pptxgenjs (no # prefix)
  const hslToHex = (h: number, s: number, l: number): string => {
    s /= 100; l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => { const k = (n + h / 30) % 12; return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1); };
    const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
    return `${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`.toUpperCase();
  };

  // ========== PPTX HELPERS ==========
  const createPptx = () => {
    const pptx = new pptxgen() as any;
    pptx.layout = "LAYOUT_WIDE";
    pptx.author = "MBR QC";
    pptx.title = `Dashboard ${TYPE_LABELS[activeType]} — Apontamentos`;
    return pptx;
  };

  const BG = "1A2035";
  const HEADER_BG = "2A3040";
  const TXT = "E0E0E0";
  const TXT_DIM = "999999";
  const BORDER_CLR = "3A4050";
  const OK_HEX = hslToHex(140, 55, 45);
  const NG_HEX = hslToHex(0, 55, 50);
  const DONUT_OK = hslToHex(45, 80, 55);
  const DONUT_NG = hslToHex(0, 70, 55);
  const ACCENT = "5B9BD5";

  const addSlideHeader = (pptx: any, slide: any, title: string) => {
    slide.background = { color: BG };
    slide.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 13.3, h: 0.65, fill: { color: HEADER_BG } });
    slide.addText(title, { x: 0.4, y: 0.08, w: 9, h: 0.5, fontSize: 20, color: "FFFFFF", bold: true, fontFace: "Calibri" });
    slide.addText(`Total: ${total}  |  ${TYPE_LABELS[activeType]}`, { x: 9.5, y: 0.08, w: 3.5, h: 0.5, fontSize: 11, color: TXT_DIM, align: "right", fontFace: "Calibri" });
  };

  const addSectionLabel = (pptx: any, slide: any, text: string, x: number, y: number, w: number) => {
    slide.addShape(pptx.shapes.RECTANGLE, { x, y, w, h: 0.35, fill: { color: HEADER_BG } });
    slide.addText(text, { x, y, w, h: 0.35, fontSize: 10, color: "FFFFFF", bold: true, align: "center", fontFace: "Calibri" });
  };

  const addFooter = (slide: any) => {
    slide.addText("Hyundai Mobis — MBR QC Dashboard", { x: 0.4, y: 7.1, w: 6, h: 0.3, fontSize: 7, color: TXT_DIM, fontFace: "Calibri" });
    slide.addText(format(new Date(), "dd/MM/yyyy", { locale: ptBR }), { x: 9, y: 7.1, w: 3.9, h: 0.3, fontSize: 7, color: TXT_DIM, align: "right", fontFace: "Calibri" });
  };

  const fmColors = failureModeData.map((_, i) => hslToHex(210 - i * 15, 60 + i * 5, 55 + i * 3));

  // ========== EXPORT: 1 SLIDE ==========
  const exportOneSlide = async () => {
    const pptx = createPptx();
    const s = pptx.addSlide();
    s.background = { color: BG };

    const SLIDE_W = 13.33;
    const COLS = 12;
    const COL_W = SLIDE_W / COLS;
    const PAD = 0.08; // inner padding for elements

    const ttlOkL = supplierData.reduce((a: number, b: any) => a + b.ok, 0);
    const ttlNgL = supplierData.reduce((a: number, b: any) => a + b.ng, 0);

    // ---- ROW 1, COL 1: General Quality Status (col-span-3) ----
    const r1c1x = 0 * COL_W + PAD;
    const r1c1y = 0.4;
    const r1c1w = 3 * COL_W - PAD * 2;
    const r1c1h = 3.2;

    addSectionLabel(pptx, s, `General Quality ${TYPE_LABELS[activeType]} Status`, r1c1x, r1c1y, r1c1w);
    const supHdr = { bold: true, color: "FFFFFF", fill: { color: HEADER_BG }, fontSize: 6, fontFace: "Calibri" };
    const supRows: any[][] = [[
      { text: "Fornecedor", options: { ...supHdr } },
      { text: "PN", options: { ...supHdr, align: "center" } },
      { text: "OK", options: { ...supHdr, align: "center" } },
      { text: "NG", options: { ...supHdr, align: "center" } },
      { text: "Total", options: { ...supHdr, align: "center" } },
    ]];
    supplierData.forEach((sup, i) => {
      const bg = i % 2 === 0 ? "1E2538" : "232A3E";
      const co = { color: TXT, fontSize: 5.5, fill: { color: bg }, fontFace: "Calibri" };
      supRows.push([
        { text: sup.name, options: { ...co, color: ACCENT } },
        { text: String(sup.qtyPN), options: { ...co, align: "center" } },
        { text: String(sup.ok), options: { ...co, align: "center" } },
        { text: String(sup.ng), options: { ...co, align: "center" } },
        { text: String(sup.total), options: { ...co, align: "center" } },
      ]);
    });
    const ttlRow = { bold: true, color: TXT, fontSize: 6, fill: { color: HEADER_BG }, fontFace: "Calibri" };
    supRows.push([
      { text: "TOTAL", options: { ...ttlRow } },
      { text: String(supplierData.reduce((a: number, b: any) => a + b.qtyPN, 0)), options: { ...ttlRow, align: "center" } },
      { text: String(ttlOkL), options: { ...ttlRow, align: "center" } },
      { text: String(ttlNgL), options: { ...ttlRow, align: "center" } },
      { text: String(ttlOkL + ttlNgL), options: { ...ttlRow, align: "center" } },
    ]);
    s.addTable(supRows, {
      x: r1c1x, y: r1c1y + 0.38, w: r1c1w,
      colW: [r1c1w * 0.38, r1c1w * 0.12, r1c1w * 0.15, r1c1w * 0.15, r1c1w * 0.20],
      fontSize: 5.5, border: { type: "solid", pt: 0.5, color: BORDER_CLR },
    });

    // ---- ROW 1, COL 2: Supplier Status chart (col-span-4) ----
    const r1c2x = 3 * COL_W + PAD;
    const r1c2y = 0.4;
    const r1c2w = 4 * COL_W - PAD * 2;
    const r1c2h = 3.2;

    addSectionLabel(pptx, s, "Supplier Status", r1c2x, r1c2y, r1c2w);
    if (supplierData.length > 0) {
      s.addChart(pptx.charts.BAR, [
        { name: "OK", labels: supplierData.map((x: any) => x.name), values: supplierData.map((x: any) => x.ok) },
        { name: "NG", labels: supplierData.map((x: any) => x.name), values: supplierData.map((x: any) => x.ng) },
      ], {
        x: r1c2x, y: r1c2y + 0.38, w: r1c2w, h: r1c2h - 0.38,
        barDir: "bar", barGrouping: "stacked",
        chartColors: [OK_HEX, NG_HEX],
        showValue: true, dataLabelColor: "FFFFFF", dataLabelFontSize: 6,
        catAxisLabelColor: TXT, catAxisLabelFontSize: 6, valAxisHidden: true,
        catGridLine: { style: "none" }, valGridLine: { color: BORDER_CLR, size: 0.5 },
        showLegend: true, legendPos: "b", legendColor: TXT_DIM, legendFontSize: 6,
        plotArea: { fill: { color: BG } }, chartArea: { fill: { color: BG }, roundedCorners: false },
      });
    }

    // ---- ROW 1, COL 3 TOP: Project Status donuts (col-span-5, top half) ----
    const r1c3x = 7 * COL_W + PAD;
    const r1c3y = 0.4;
    const r1c3w = 5 * COL_W - PAD * 2;

    addSectionLabel(pptx, s, "Project Status", r1c3x, r1c3y, r1c3w);
    if (projectData.length > 0) {
      const donutCols = Math.min(projectData.length, 4);
      const donutW = r1c3w / donutCols;
      const donutH = 1.2;
      projectData.forEach((proj, idx) => {
        const dx = r1c3x + idx * donutW;
        const dy = r1c3y + 0.38;
        s.addChart(pptx.charts.DOUGHNUT, [{
          name: proj.name, labels: ["OK", "NG"], values: [proj.ok, proj.ng],
        }], {
          x: dx, y: dy, w: donutW, h: donutH,
          chartColors: [DONUT_OK, DONUT_NG],
          showPercent: true, dataLabelColor: "FFFFFF", dataLabelFontSize: 7,
          showLegend: false, showTitle: true, title: proj.name,
          titleColor: "FFFFFF", titleFontSize: 7,
          plotArea: { fill: { color: BG } }, chartArea: { fill: { color: "1E2538" }, roundedCorners: true },
        });
      });
    }

    // ---- ROW 1, COL 3 BOTTOM: Main Failure Mode (col-span-5, bottom half) ----
    const fmY = 2.2;
    const fmH = 1.4;

    addSectionLabel(pptx, s, "Main Failure Mode", r1c3x, fmY, r1c3w);
    if (failureModeData.length > 0) {
      s.addChart(pptx.charts.BAR, [{
        name: "Quantidade",
        labels: failureModeData.map((f: any) => f.name),
        values: failureModeData.map((f: any) => f.value),
      }], {
        x: r1c3x, y: fmY + 0.35, w: r1c3w, h: fmH,
        barDir: "col", chartColors: fmColors,
        showValue: true, dataLabelPosition: "outEnd", dataLabelColor: TXT, dataLabelFontSize: 6,
        catAxisLabelColor: TXT, catAxisLabelFontSize: 5, catAxisLabelRotate: 330,
        valAxisHidden: true, catGridLine: { style: "none" }, valGridLine: { color: BORDER_CLR, size: 0.5 },
        showLegend: false,
        plotArea: { fill: { color: BG } }, chartArea: { fill: { color: BG }, roundedCorners: false },
      });
    }

    // ---- ROW 2, COL 1: Incoming Data – Problema (col-span-4) ----
    const r2c1x = 0 * COL_W + PAD;
    const r2c1y = 3.8;
    const r2c1w = 4 * COL_W - PAD * 2;

    addSectionLabel(pptx, s, `${TYPE_LABELS[activeType]} Data — Problem`, r2c1x, r2c1y, r2c1w);
    if (problemTypes.items.length > 0) {
      const ptHdr = { bold: true, color: "FFFFFF", fill: { color: HEADER_BG }, fontSize: 6, fontFace: "Calibri" };
      const ptRows: any[][] = [[
        { text: "Tipo de Problema", options: { ...ptHdr } },
        { text: "Qty", options: { ...ptHdr, align: "center" } },
        { text: "%", options: { ...ptHdr, align: "center" } },
      ]];
      problemTypes.items.slice(0, 10).forEach((p, i) => {
        const bg = i % 2 === 0 ? "1E2538" : "232A3E";
        const co = { color: TXT, fontSize: 5.5, fill: { color: bg }, fontFace: "Calibri" };
        ptRows.push([
          { text: p.type, options: { ...co } },
          { text: String(p.qty), options: { ...co, align: "center" } },
          { text: problemTypes.total > 0 ? `${((p.qty / problemTypes.total) * 100).toFixed(0)}%` : "0%", options: { ...co, align: "center" } },
        ]);
      });
      s.addTable(ptRows, {
        x: r2c1x, y: r2c1y + 0.38, w: r2c1w,
        colW: [r2c1w * 0.55, r2c1w * 0.2, r2c1w * 0.25],
        fontSize: 5.5, border: { type: "solid", pt: 0.5, color: BORDER_CLR },
      });
    }

    // ---- ROW 2, COL 2: Main Issues (col-span-8) ----
    const r2c2x = 4 * COL_W + PAD;
    const r2c2y = 3.8;
    const r2c2w = 8 * COL_W - PAD * 2;

    addSectionLabel(pptx, s, "Main Issues (NG)", r2c2x, r2c2y, r2c2w);
    const issHdr = { bold: true, color: "FFFFFF", fill: { color: HEADER_BG }, fontSize: 6, fontFace: "Calibri" };
    const issRows: any[][] = [[
      { text: "Supplier", options: { ...issHdr } },
      { text: "PN", options: { ...issHdr } },
      { text: "Description", options: { ...issHdr } },
      { text: "Category", options: { ...issHdr } },
      { text: "NG", options: { ...issHdr, align: "center" } },
    ]];
    mainIssues.slice(0, 10).forEach((iss, i) => {
      const bg = i % 2 === 0 ? "1E2538" : "232A3E";
      const co = { color: TXT, fontSize: 5.5, fill: { color: bg }, fontFace: "Calibri" };
      issRows.push([
        { text: iss.supplier, options: { ...co } },
        { text: iss.pn, options: { ...co } },
        { text: iss.description, options: { ...co } },
        { text: iss.category, options: { ...co } },
        { text: String(iss.ng), options: { ...co, color: NG_HEX, bold: true, align: "center" } },
      ]);
    });
    if (mainIssues.length === 0) {
      const e = { color: TXT_DIM, fontSize: 5.5, fill: { color: "1E2538" }, fontFace: "Calibri" };
      issRows.push([{ text: "Sem issues.", options: { ...e, colspan: 5, align: "center" } }]);
    }
    s.addTable(issRows, {
      x: r2c2x, y: r2c2y + 0.38, w: r2c2w,
      colW: [r2c2w * 0.18, r2c2w * 0.16, r2c2w * 0.30, r2c2w * 0.24, r2c2w * 0.12],
      fontSize: 5.5, border: { type: "solid", pt: 0.5, color: BORDER_CLR },
    });

    addFooter(s);
    const now = new Date();
    const fname = `Incoming_Status_${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')}.pptx`;
    await pptx.writeFile({ fileName: fname });
  };

  // ========== EXPORT: 4 SLIDES ==========
  const exportFourSlides = async () => {
    const pptx = createPptx();

    const ttlOkLocal = supplierData.reduce((a: number, b: any) => a + b.ok, 0);
    const ttlNgLocal = supplierData.reduce((a: number, b: any) => a + b.ng, 0);

    // SLIDE 1 — Status Geral + Tabela de Fornecedores
    const s1 = pptx.addSlide();
    addSlideHeader(pptx, s1, `${TYPE_LABELS[activeType]} — Status Geral`);
    addSectionLabel(pptx, s1, "General Quality Incoming Status", 0.4, 0.85, 5.5);

    const supHeaderOpts = { bold: true, color: "FFFFFF", fill: { color: HEADER_BG }, fontSize: 9, fontFace: "Calibri" };
    const supRows: any[][] = [[
      { text: "Fornecedor", options: { ...supHeaderOpts } },
      { text: "Qty PN", options: { ...supHeaderOpts, align: "center" } },
      { text: "OK", options: { ...supHeaderOpts, align: "center" } },
      { text: "NG", options: { ...supHeaderOpts, align: "center" } },
      { text: "Total", options: { ...supHeaderOpts, align: "center" } },
    ]];
    supplierData.forEach((sup, i) => {
      const rowBg = i % 2 === 0 ? "1E2538" : "232A3E";
      const cellOpts = { color: TXT, fontSize: 8, fill: { color: rowBg }, fontFace: "Calibri" };
      supRows.push([
        { text: sup.name, options: { ...cellOpts, color: ACCENT } },
        { text: String(sup.qtyPN), options: { ...cellOpts, align: "center" } },
        { text: String(sup.ok), options: { ...cellOpts, align: "center" } },
        { text: String(sup.ng), options: { ...cellOpts, align: "center" } },
        { text: String(sup.total), options: { ...cellOpts, align: "center" } },
      ]);
    });
    const ttlPN = supplierData.reduce((a: number, b: any) => a + b.qtyPN, 0);
    const totalRow = { bold: true, color: TXT, fontSize: 9, fill: { color: HEADER_BG }, fontFace: "Calibri" };
    supRows.push([
      { text: "TOTAL", options: { ...totalRow } },
      { text: String(ttlPN), options: { ...totalRow, align: "center" } },
      { text: String(ttlOkLocal), options: { ...totalRow, align: "center" } },
      { text: String(ttlNgLocal), options: { ...totalRow, align: "center" } },
      { text: String(ttlOkLocal + ttlNgLocal), options: { ...totalRow, align: "center" } },
    ]);
    s1.addTable(supRows, {
      x: 0.4, y: 1.25, w: 5.5, colW: [2.0, 0.8, 0.8, 0.8, 1.1],
      fontSize: 8, border: { type: "solid", pt: 0.5, color: BORDER_CLR },
    });

    // KPIs on right
    addSectionLabel(pptx, s1, "Resumo", 6.5, 0.85, 6.2);
    const kpiY = 1.4;
    const kpiBoxW = 2.8;
    const kpiBoxH = 1.2;
    s1.addShape(pptx.shapes.RECTANGLE, { x: 6.5, y: kpiY, w: kpiBoxW, h: kpiBoxH, fill: { color: "1E2538" }, line: { color: BORDER_CLR, width: 1 } });
    s1.addText("OK", { x: 6.5, y: kpiY + 0.1, w: kpiBoxW, h: 0.3, fontSize: 12, color: OK_HEX, bold: true, align: "center", fontFace: "Calibri" });
    s1.addText(String(ttlOkLocal), { x: 6.5, y: kpiY + 0.4, w: kpiBoxW, h: 0.5, fontSize: 36, color: OK_HEX, bold: true, align: "center", fontFace: "Calibri" });
    s1.addShape(pptx.shapes.RECTANGLE, { x: 9.8, y: kpiY, w: kpiBoxW, h: kpiBoxH, fill: { color: "1E2538" }, line: { color: BORDER_CLR, width: 1 } });
    s1.addText("NG", { x: 9.8, y: kpiY + 0.1, w: kpiBoxW, h: 0.3, fontSize: 12, color: NG_HEX, bold: true, align: "center", fontFace: "Calibri" });
    s1.addText(String(ttlNgLocal), { x: 9.8, y: kpiY + 0.4, w: kpiBoxW, h: 0.5, fontSize: 36, color: NG_HEX, bold: true, align: "center", fontFace: "Calibri" });
    const okRate = (ttlOkLocal + ttlNgLocal) > 0 ? ((ttlOkLocal / (ttlOkLocal + ttlNgLocal)) * 100).toFixed(1) : "0";
    s1.addShape(pptx.shapes.RECTANGLE, { x: 6.5, y: kpiY + 1.4, w: 6.1, h: 0.6, fill: { color: "1E2538" }, line: { color: BORDER_CLR, width: 1 } });
    s1.addText(`Taxa de Aprovação: ${okRate}%`, { x: 6.5, y: kpiY + 1.4, w: 6.1, h: 0.6, fontSize: 16, color: ACCENT, bold: true, align: "center", fontFace: "Calibri" });

    // Problem type table on slide 1 bottom-right
    if (problemTypes.items.length > 0) {
      addSectionLabel(pptx, s1, `${TYPE_LABELS[activeType]} Data — Problem`, 6.5, 3.6, 6.2);
      const ptHeaderOpts = { bold: true, color: "FFFFFF", fill: { color: HEADER_BG }, fontSize: 8, fontFace: "Calibri" };
      const ptRows: any[][] = [[
        { text: "Tipo de Problema", options: { ...ptHeaderOpts } },
        { text: "Qty", options: { ...ptHeaderOpts, align: "center" } },
        { text: "%", options: { ...ptHeaderOpts, align: "center" } },
      ]];
      problemTypes.items.slice(0, 10).forEach((p, i) => {
        const bg = i % 2 === 0 ? "1E2538" : "232A3E";
        const co = { color: TXT, fontSize: 8, fill: { color: bg }, fontFace: "Calibri" };
        ptRows.push([
          { text: p.type, options: { ...co } },
          { text: String(p.qty), options: { ...co, align: "center" } },
          { text: problemTypes.total > 0 ? `${((p.qty / problemTypes.total) * 100).toFixed(0)}%` : "0%", options: { ...co, align: "center" } },
        ]);
      });
      s1.addTable(ptRows, {
        x: 6.5, y: 4.0, w: 6.2, colW: [3.6, 1.2, 1.4],
        fontSize: 8, border: { type: "solid", pt: 0.5, color: BORDER_CLR },
      });
    }

    // SLIDE 2 — Supplier Status (stacked horizontal bars)
    const s2 = pptx.addSlide();
    addSlideHeader(pptx, s2, `${TYPE_LABELS[activeType]} — Supplier Status`);
    addSectionLabel(pptx, s2, "Status of Supplier OK vs NG", 0.4, 0.85, 12.5);
    if (supplierData.length > 0) {
      s2.addChart(pptx.charts.BAR, [
        { name: "OK", labels: supplierData.map((x: any) => x.name), values: supplierData.map((x: any) => x.ok) },
        { name: "NG", labels: supplierData.map((x: any) => x.name), values: supplierData.map((x: any) => x.ng) },
      ], {
        x: 0.4, y: 1.4, w: 12.5, h: 5.5,
        barDir: "bar", barGrouping: "stacked",
        chartColors: [OK_HEX, NG_HEX],
        showValue: true, dataLabelColor: "FFFFFF", dataLabelFontSize: 8,
        catAxisLabelColor: TXT, catAxisLabelFontSize: 9, valAxisHidden: true,
        catGridLine: { style: "none" }, valGridLine: { color: BORDER_CLR, size: 0.5 },
        showLegend: true, legendPos: "b", legendColor: TXT_DIM, legendFontSize: 9,
        plotArea: { fill: { color: BG } }, chartArea: { fill: { color: BG }, roundedCorners: false },
      });
    } else {
      s2.addText("Sem dados de fornecedor.", { x: 2, y: 3, w: 9, h: 1, fontSize: 16, color: TXT_DIM, align: "center" });
    }

    // SLIDE 3 — Project Status (doughnut charts)
    const s3 = pptx.addSlide();
    addSlideHeader(pptx, s3, `${TYPE_LABELS[activeType]} — Project Status`);
    addSectionLabel(pptx, s3, "Project Status — OK vs NG by Project", 0.4, 0.85, 12.5);
    if (projectData.length > 0) {
      const donutW = 2.8;
      const donutH = 3.5;
      const gap = 0.4;
      const totalDonutsW = projectData.length * donutW + (projectData.length - 1) * gap;
      const startX = (13.3 - totalDonutsW) / 2;
      projectData.forEach((proj, idx) => {
        const dx = startX + idx * (donutW + gap);
        const dy = 1.5;
        s3.addChart(pptx.charts.DOUGHNUT, [{
          name: proj.name, labels: ["OK", "NG"], values: [proj.ok, proj.ng],
        }], {
          x: dx, y: dy, w: donutW, h: donutH,
          chartColors: [DONUT_OK, DONUT_NG],
          showPercent: true, dataLabelColor: "FFFFFF", dataLabelFontSize: 10,
          showLegend: false, showTitle: true, title: proj.name,
          titleColor: "FFFFFF", titleFontSize: 12,
          plotArea: { fill: { color: BG } }, chartArea: { fill: { color: "1E2538" }, roundedCorners: true },
        });
        const totalP = proj.ok + proj.ng;
        const okP = totalP > 0 ? ((proj.ok / totalP) * 100).toFixed(1) : "0";
        const ngP = totalP > 0 ? ((proj.ng / totalP) * 100).toFixed(1) : "0";
        s3.addText([
          { text: `OK: ${proj.ok} (${okP}%)`, options: { color: DONUT_OK, fontSize: 9, bold: true, breakLine: true } },
          { text: `NG: ${proj.ng} (${ngP}%)`, options: { color: DONUT_NG, fontSize: 9, bold: true } },
        ], { x: dx, y: dy + donutH + 0.1, w: donutW, h: 0.5, align: "center", fontFace: "Calibri" });
      });
    } else {
      s3.addText("Sem dados de projeto.", { x: 2, y: 3, w: 9, h: 1, fontSize: 16, color: TXT_DIM, align: "center" });
    }

    // SLIDE 4 — Failure Mode + Problem Type + Main Issues
    const s4 = pptx.addSlide();
    addSlideHeader(pptx, s4, `${TYPE_LABELS[activeType]} — Failure Mode & Main Issues`);
    addSectionLabel(pptx, s4, "Main Failure Mode", 0.4, 0.85, 6.0);
    if (failureModeData.length > 0) {
      s4.addChart(pptx.charts.BAR, [{
        name: "Quantidade",
        labels: failureModeData.map((f: any) => f.name),
        values: failureModeData.map((f: any) => f.value),
      }], {
        x: 0.4, y: 1.3, w: 6.0, h: 3.2,
        barDir: "col", chartColors: fmColors,
        showValue: true, dataLabelPosition: "outEnd", dataLabelColor: TXT, dataLabelFontSize: 8,
        catAxisLabelColor: TXT, catAxisLabelFontSize: 7, catAxisLabelRotate: 330,
        valAxisHidden: true, catGridLine: { style: "none" }, valGridLine: { color: BORDER_CLR, size: 0.5 },
        showLegend: false,
        plotArea: { fill: { color: BG } }, chartArea: { fill: { color: BG }, roundedCorners: false },
      });
    } else {
      s4.addText("Sem dados.", { x: 0.4, y: 2, w: 6, h: 1, fontSize: 14, color: TXT_DIM, align: "center" });
    }

    addSectionLabel(pptx, s4, `${TYPE_LABELS[activeType]} Data — Problem`, 6.8, 0.85, 6.1);
    if (problemTypes.items.length > 0) {
      const ptSlice = problemTypes.items.slice(0, 8);
      s4.addChart(pptx.charts.BAR, [{
        name: "Qty",
        labels: ptSlice.map((p: any) => p.type),
        values: ptSlice.map((p: any) => p.qty),
      }], {
        x: 6.8, y: 1.3, w: 6.1, h: 3.2,
        barDir: "bar", chartColors: [ACCENT],
        showValue: true, dataLabelColor: "FFFFFF", dataLabelFontSize: 8,
        catAxisLabelColor: TXT, catAxisLabelFontSize: 8, valAxisHidden: true,
        catGridLine: { style: "none" }, valGridLine: { color: BORDER_CLR, size: 0.5 },
        showLegend: false,
        plotArea: { fill: { color: BG } }, chartArea: { fill: { color: BG }, roundedCorners: false },
      });
    }

    addSectionLabel(pptx, s4, "Main Issues (NG)", 0.4, 4.7, 12.5);
    const issHeaderOpts = { bold: true, color: "FFFFFF", fill: { color: HEADER_BG }, fontSize: 8, fontFace: "Calibri" };
    const issRows: any[][] = [[
      { text: "Supplier", options: { ...issHeaderOpts } },
      { text: "PN", options: { ...issHeaderOpts } },
      { text: "Description", options: { ...issHeaderOpts } },
      { text: "Category", options: { ...issHeaderOpts } },
      { text: "NG", options: { ...issHeaderOpts, align: "center" } },
    ]];
    mainIssues.slice(0, 8).forEach((iss, i) => {
      const bg = i % 2 === 0 ? "1E2538" : "232A3E";
      const co = { color: TXT, fontSize: 7, fill: { color: bg }, fontFace: "Calibri" };
      issRows.push([
        { text: iss.supplier, options: { ...co } },
        { text: iss.pn, options: { ...co } },
        { text: iss.description, options: { ...co } },
        { text: iss.category, options: { ...co } },
        { text: String(iss.ng), options: { ...co, color: NG_HEX, bold: true, align: "center" } },
      ]);
    });
    if (mainIssues.length === 0) {
      const emptyRow = { color: TXT_DIM, fontSize: 8, fill: { color: "1E2538" }, fontFace: "Calibri" };
      issRows.push([{ text: "Sem issues registrados.", options: { ...emptyRow, colspan: 5, align: "center" } }]);
    }
    s4.addTable(issRows, {
      x: 0.4, y: 5.1, w: 12.5, colW: [2.5, 2.0, 3.5, 2.8, 1.7],
      fontSize: 8, border: { type: "solid", pt: 0.5, color: BORDER_CLR },
    });

    [s1, s2, s3, s4].forEach(addFooter);
    const now = new Date();
    const fname = `Incoming_Status_${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')}.pptx`;
    await pptx.writeFile({ fileName: fname });
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
            <Popover open={dateFromOpen} onOpenChange={setDateFromOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("w-[130px] text-[10px] h-7 bg-[hsl(220,15%,18%)] border-[hsl(220,10%,30%)] text-[hsl(0,0%,80%)] justify-start", !dateFrom && "text-[hsl(0,0%,50%)]")}>
                  <CalendarIcon className="w-3 h-3 mr-1" />
                  {dateFrom ? format(new Date(dateFrom + "T12:00:00"), "dd/MM/yyyy") : "De"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom ? new Date(dateFrom + "T12:00:00") : undefined} onSelect={(d) => { setDateFrom(d ? format(d, "yyyy-MM-dd") : ""); setDateFromOpen(false); }} locale={ptBR} className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
            <span className="text-[10px] text-[hsl(0,0%,50%)]">a</span>
            <Popover open={dateToOpen} onOpenChange={setDateToOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("w-[130px] text-[10px] h-7 bg-[hsl(220,15%,18%)] border-[hsl(220,10%,30%)] text-[hsl(0,0%,80%)] justify-start", !dateTo && "text-[hsl(0,0%,50%)]")}>
                  <CalendarIcon className="w-3 h-3 mr-1" />
                  {dateTo ? format(new Date(dateTo + "T12:00:00"), "dd/MM/yyyy") : "Até"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo ? new Date(dateTo + "T12:00:00") : undefined} onSelect={(d) => { setDateTo(d ? format(d, "yyyy-MM-dd") : ""); setDateToOpen(false); }} locale={ptBR} className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-[hsl(0,0%,60%)] hover:text-[hsl(0,0%,90%)] h-7 px-1.5 text-[10px]">Limpar</Button>
            )}
          </div>
          <span className="text-[10px] md:text-xs text-[hsl(0,0%,50%)]">Total: {total}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="text-[hsl(0,0%,80%)] border-[hsl(220,10%,30%)] bg-[hsl(220,15%,18%)] hover:bg-[hsl(220,15%,25%)] text-xs">
                <Download className="w-3.5 h-3.5 mr-1" />PPTX<ChevronDown className="w-3 h-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[hsl(220,15%,18%)] border-[hsl(220,10%,30%)] text-[hsl(0,0%,85%)]">
              <DropdownMenuItem onClick={exportOneSlide} className="text-xs cursor-pointer hover:bg-[hsl(220,15%,25%)] focus:bg-[hsl(220,15%,25%)] focus:text-[hsl(0,0%,95%)]">
                Exportar em 1 Slide (Dashboard Completo)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportFourSlides} className="text-xs cursor-pointer hover:bg-[hsl(220,15%,25%)] focus:bg-[hsl(220,15%,25%)] focus:text-[hsl(0,0%,95%)]">
                Exportar em 4 Slides (Versão Detalhada)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Type tabs */}
      <div className="px-3 md:px-4 pt-3">
        <Tabs value={activeType} onValueChange={setActiveType}>
          <TabsList className="grid w-full grid-cols-5 h-auto bg-[hsl(220,15%,16%)] border border-[hsl(220,10%,25%)]">
            {TYPES.map((t) => (
              <TabsTrigger key={t} value={t} className="text-xs sm:text-sm py-2 text-[hsl(0,0%,60%)] data-[state=active]:bg-[hsl(220,10%,25%)] data-[state=active]:text-[hsl(0,0%,95%)]">
                {TYPE_LABELS[t]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Origem KPI — only for incoming */}
      {(activeType === "incoming" || activeType === "100days") && (
        <div className="px-2 md:px-4 pt-2">
          <div className="border border-[hsl(220,10%,25%)] bg-[hsl(220,15%,14%)] rounded-lg overflow-hidden">
            <SectionHeader>Origem</SectionHeader>
            <div className="px-3 py-3 grid grid-cols-4 gap-2 bg-[hsl(220,15%,12%)]">
              <div className="text-center">
                <p className="text-[10px] text-[hsl(0,0%,60%)] uppercase tracking-wider">Inspecionados</p>
                <p className="text-lg font-bold text-[hsl(0,0%,90%)]">{origemData.totalInspected.toLocaleString('pt-BR')}</p>
                <p className="text-[10px] text-[hsl(0,0%,50%)]">100%</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-green-400/80 uppercase tracking-wider">OK</p>
                <p className="text-lg font-bold text-green-400">{origemData.totalOk.toLocaleString('pt-BR')}</p>
                <p className="text-[10px] text-green-400/60">{origemData.totalInspected > 0 ? ((origemData.totalOk / origemData.totalInspected) * 100).toFixed(1) : "0"}%</p>
              </div>
              <button
                type="button"
                onClick={() => origemData.totalNg > 0 && setNgBreakdownOpen(true)}
                className="text-center rounded-md hover:bg-red-500/10 transition-colors py-1"
                title="Ver detalhamento por responsabilidade"
              >
                <p className="text-[10px] text-red-400/80 uppercase tracking-wider">NG</p>
                <p className="text-lg font-bold text-red-400 underline-offset-2 hover:underline">{origemData.totalNg.toLocaleString('pt-BR')}</p>
                <p className="text-[10px] text-red-400/60">{origemData.totalInspected > 0 ? ((origemData.totalNg / origemData.totalInspected) * 100).toFixed(1) : "0"}%</p>
              </button>
              <div className="text-center">
                <p className="text-[10px] text-[hsl(45,90%,60%)]/80 uppercase tracking-wider">PPM</p>
                <p className="text-lg font-bold text-[hsl(45,90%,60%)]">
                  {origemData.totalOk > 0 ? ((origemData.totalNg / origemData.totalOk) * 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'}
                </p>
                <p className="text-[10px] text-[hsl(45,90%,60%)]/40">&nbsp;</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main grid */}
      <main className="p-2 md:p-4 grid grid-cols-1 lg:grid-cols-12 gap-3 overflow-x-hidden">
        {/* LEFT: General Quality Status table */}
        <div className="lg:col-span-3 border border-[hsl(220,10%,25%)] bg-[hsl(220,15%,14%)] overflow-x-auto rounded-lg">
          <SectionHeader>General Quality {TYPE_LABELS[activeType]} Status</SectionHeader>
          <div className="px-2 pt-2 flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPPM((v) => !v)}
              className={`text-[10px] h-6 gap-1 ${showPPM ? 'bg-[hsl(210,70%,60%)]/30 border-[hsl(210,70%,60%)]/60 text-[hsl(210,70%,75%)]' : 'bg-[hsl(220,10%,20%)] border-[hsl(220,10%,30%)] text-[hsl(0,0%,70%)]'}`}
            >
              PPM {showPPM ? '✓' : ''}
            </Button>
            {supplierFilter && (
              <Button variant="outline" size="sm" onClick={() => setSupplierFilter(null)} className="text-[10px] h-6 bg-[hsl(210,70%,60%)]/20 border-[hsl(210,70%,60%)]/40 text-[hsl(210,70%,60%)] hover:bg-[hsl(210,70%,60%)]/30 gap-1">
                ✕ Filtro: {supplierFilter}
              </Button>
            )}
          </div>
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
                {showPPM && (
                  <th className="text-center px-2 py-1.5 text-[hsl(45,90%,60%)] font-medium">PPM</th>
                )}
              </tr>
            </thead>
            <tbody>
              {supplierData.map((s, i) => {
                const ppm = s.ok > 0 ? (s.ng / s.ok) * 1_000_000 : 0;
                return (
                  <tr key={s.name} className={`border-b border-[hsl(220,10%,20%)] ${i % 2 === 0 ? 'bg-[hsl(220,15%,14%)]' : 'bg-[hsl(220,15%,16%)]'}`}>
                    <td className="px-2 py-1 text-[hsl(210,70%,60%)] cursor-pointer hover:underline" onClick={() => setSupplierFilter(s.name)}>{s.name}</td>
                    <td className="text-center px-2 py-1 text-[hsl(0,0%,80%)]">{s.qtyPN}</td>
                    <td className="text-center px-2 py-1 text-[hsl(0,0%,80%)]">{s.ok}</td>
                    <td className="text-center px-2 py-1 text-[hsl(0,0%,80%)]">{s.ng}</td>
                    {showPPM && (
                      <td className="text-center px-2 py-1 text-[hsl(45,90%,60%)] font-medium">{ppm.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    )}
                  </tr>
                );
              })}
              <tr className="bg-[hsl(220,10%,20%)] font-bold">
                <td className="px-2 py-1.5 text-[hsl(0,0%,80%)]">TTL</td>
                <td className="text-center px-2 py-1.5 text-[hsl(0,0%,80%)]">{supplierData.reduce((a, b) => a + b.qtyPN, 0)}</td>
                <td className="text-center px-2 py-1.5 text-[hsl(0,0%,80%)]">{ttlOk}</td>
                <td className="text-center px-2 py-1.5 text-[hsl(0,0%,80%)]">{ttlNg}</td>
                {showPPM && (
                  <td className="text-center px-2 py-1.5 text-[hsl(45,90%,60%)]">{ttlOk > 0 ? ((ttlNg / ttlOk) * 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'}</td>
                )}
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

        {/* RIGHT: Project/Module Status donuts + Failure Mode */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          {/* Status donuts — Module for 100 Days, Project otherwise */}
          {activeType === "100days" ? (
            <div className="border border-[hsl(220,10%,25%)] bg-[hsl(220,15%,14%)] p-3 rounded-lg">
              <SectionHeader>Module Status</SectionHeader>
              <div className="flex justify-around mt-3 flex-wrap gap-2">
                {moduleData.length > 0 ? moduleData.map((mod, i) => (
                  <DonutChart key={i} data={[
                    { name: "OK", value: mod.ok },
                    { name: "NG", value: mod.ng },
                  ]} title={mod.label}
                    active={moduleFilter === mod.name}
                    onClick={() => setModuleFilter(moduleFilter === mod.name ? null : mod.name)}
                  />
                )) : (
                  <p className="text-[hsl(0,0%,50%)] text-xs text-center py-4">Sem dados de módulo.</p>
                )}
              </div>
              {moduleFilter && (
                <button onClick={() => setModuleFilter(null)} className="mt-2 text-[10px] text-[hsl(210,70%,60%)] hover:underline">
                  ✕ Filtro módulo: {moduleFilter}
                </button>
              )}
            </div>
          ) : (
            <div className="border border-[hsl(220,10%,25%)] bg-[hsl(220,15%,14%)] p-3 rounded-lg">
              <SectionHeader>Project Status</SectionHeader>
              <div className="flex justify-around mt-3 flex-wrap gap-2">
                {projectData.length > 0 ? projectData.map((proj, i) => (
                  <DonutChart key={i} data={[
                    { name: "OK", value: proj.ok },
                    { name: "NG", value: proj.ng },
                  ]} title={proj.name}
                    active={projectFilter === proj.name}
                    onClick={() => setProjectFilter(projectFilter === proj.name ? null : proj.name)}
                  />
                )) : (
                  <p className="text-[hsl(0,0%,50%)] text-xs text-center py-4">Sem dados de projeto.</p>
                )}
              </div>
              {projectFilter && (
                <button onClick={() => setProjectFilter(null)} className="mt-2 text-[10px] text-[hsl(210,70%,60%)] hover:underline">
                  ✕ Filtro modelo: {projectFilter}
                </button>
              )}
            </div>
          )}

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
                  <Bar dataKey="value" radius={[2, 2, 0, 0]} barSize={30} label={{ position: "top", fontSize: 10, fill: "hsl(0,0%,80%)" }}
                    cursor="pointer"
                    onClick={(d: any) => {
                      const fname = d?.payload?.fullName ?? d?.fullName;
                      if (!fname) return;
                      setFailureModeFilter((prev) =>
                        prev.includes(fname) ? prev.filter((f) => f !== fname) : [...prev, fname]
                      );
                    }}
                  >
                    {failureModeData.map((entry, i) => (
                      <Cell key={i} fill={`hsl(${210 - i * 15}, ${60 + i * 5}%, ${55 + i * 3}%)`}
                        opacity={failureModeFilter.length > 0 && !failureModeFilter.includes(entry.fullName) ? 0.35 : 1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="text-[hsl(0,0%,50%)] text-xs text-center py-8">Sem dados.</p>
            )}
            {failureModeFilter.length > 0 && (
              <div className="mx-3 mb-2 flex flex-wrap gap-1.5 items-center">
                {failureModeFilter.map((fm) => (
                  <button
                    key={fm}
                    onClick={() => setFailureModeFilter((prev) => prev.filter((f) => f !== fm))}
                    className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[hsl(210,70%,60%)]/10 text-[hsl(210,70%,60%)] hover:bg-[hsl(210,70%,60%)]/20 transition-colors"
                  >
                    <X className="w-2.5 h-2.5" /> {fm}
                  </button>
                ))}
                <button
                  onClick={() => setFailureModeFilter([])}
                  className="text-[10px] text-[hsl(0,0%,60%)] hover:text-[hsl(0,0%,80%)] hover:underline"
                >
                  Limpar todos
                </button>
              </div>
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
                <tr
                  key={p.type}
                  className={`border-b border-[hsl(220,10%,20%)] cursor-pointer hover:bg-[hsl(220,15%,22%)] ${i % 2 === 0 ? 'bg-[hsl(220,15%,14%)]' : 'bg-[hsl(220,15%,16%)]'}`}
                  onClick={() => { setNgReportFailureMode(p.type); setNgReportOpen(true); }}
                  title="Ver peças NG com este modo de falha"
                >
                  <td className="px-3 py-1 text-[hsl(210,70%,60%)] underline-offset-2 hover:underline">{p.type}</td>
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
          {pnFilter && (
            <div className="px-3 pt-2">
              <button onClick={() => setPnFilter(null)} className="text-[10px] text-[hsl(210,70%,60%)] hover:underline">
                ✕ Filtro PN: {pnFilter}
              </button>
            </div>
          )}
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[hsl(220,10%,25%)]">
                <th className="text-left px-3 py-1.5 text-[hsl(0,0%,70%)] font-medium">Supplier</th>
                <th className="text-left px-3 py-1.5 text-[hsl(0,0%,70%)] font-medium">PN</th>
                <th className="text-left px-3 py-1.5 text-[hsl(0,0%,70%)] font-medium">Description</th>
                <th className="text-left px-3 py-1.5 text-[hsl(0,0%,70%)] font-medium">Category</th>
                <th className="text-center px-3 py-1.5 text-[hsl(0,0%,70%)] font-medium">NG</th>
                <th className="text-center px-3 py-1.5 text-[hsl(0,0%,70%)] font-medium">Information</th>
              </tr>
            </thead>
            <tbody>
              {mainIssues.length > 0 ? mainIssues.map((issue, i) => (
                <tr key={i} className={`border-b border-[hsl(220,10%,20%)] ${i % 2 === 0 ? 'bg-[hsl(220,15%,14%)]' : 'bg-[hsl(220,15%,16%)]'}`}>
                  <td className="px-3 py-1 text-[hsl(0,0%,80%)]">{issue.supplier}</td>
                  <td
                    className="px-3 py-1 text-[hsl(210,70%,60%)] cursor-pointer hover:underline"
                    onClick={() => setPnFilter(pnFilter === issue.pn ? null : issue.pn)}
                  >{issue.pn}</td>
                  <td className="px-3 py-1 text-[hsl(0,0%,80%)]">{issue.description}</td>
                  <td className="px-3 py-1 text-[hsl(0,0%,80%)]">{issue.category}</td>
                  <td className="text-center px-3 py-1 text-[hsl(0,55%,55%)] font-semibold">{issue.ng}</td>
                  <td className="text-center px-3 py-1">
                    <button
                      className="text-[hsl(210,70%,60%)] hover:underline text-[11px]"
                      onClick={() => setInfoTarget({ pn: issue.pn, category: issue.category })}
                    >
                      More details
                    </button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="text-center py-4 text-[hsl(0,0%,50%)]">Sem issues registrados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      <ApontamentoDailyReport
        open={ngReportOpen}
        onOpenChange={(o) => { setNgReportOpen(o); if (!o) setNgReportFailureMode(null); }}
        items={items}
        mode="ng"
        onViewRecord={(id) => setViewTarget(id)}
        failureModeFilter={ngReportFailureMode}
        tipoFilter={activeType === "100days" ? "incoming" : activeType}
        pnSetFilter={activeType === "100days" ? bc4bPnSet : null}
        initialDateFrom={dateFrom || undefined}
        initialDateTo={dateTo || undefined}
      />
      <ApontamentoViewDialog open={!!viewTarget} onOpenChange={(o) => !o && setViewTarget(null)} apontamentoId={viewTarget} />

      <Dialog open={!!infoTarget} onOpenChange={(o) => !o && setInfoTarget(null)}>
        <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-3">
              <span className="text-sm">
                {infoTarget?.pn} — <span className="text-muted-foreground">{infoTarget?.category}</span>
              </span>
              <span className="text-sm font-normal text-red-400">Total NG: {infoTotal.toLocaleString('pt-BR')}</span>
            </DialogTitle>
          </DialogHeader>
          {infoRecords.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Sem registros.</p>
          ) : (
            <div className="divide-y divide-border rounded-md border">
              {infoRecords.map((r) => (
                <button
                  key={r.id}
                  onClick={() => { setInfoTarget(null); setViewTarget(r.id); }}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-medium">{r.supplier}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {r.date ? new Date(`${String(r.date).slice(0,10)}T12:00:00`).toLocaleDateString('pt-BR') : '—'} · INC {r.numero || 'S/N'}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-red-400">{r.ng}</span>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={ngBreakdownOpen} onOpenChange={(o) => { setNgBreakdownOpen(o); if (!o) setNgRespFilter(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-3">
              <span>NG por Responsabilidade</span>
              <span className="text-sm font-normal text-red-400">Total: {ngBreakdown.totalNg.toLocaleString('pt-BR')} peças NG</span>
            </DialogTitle>
          </DialogHeader>
          {ngBreakdown.groups.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Sem registros NG no filtro atual.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setNgRespFilter(null)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${ngRespFilter === null ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/40 text-foreground border-border hover:bg-muted'}`}
                >
                  Todas ({ngBreakdown.totalNg})
                </button>
                {ngBreakdown.groups.map((g) => {
                  const active = ngRespFilter === g.name;
                  return (
                    <button
                      key={g.name}
                      onClick={() => setNgRespFilter(active ? null : g.name)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/40 text-foreground border-border hover:bg-muted'}`}
                    >
                      {g.name} · <span className="font-bold">{g.qty}</span> · {g.pct.toFixed(1)}%
                    </button>
                  );
                })}
              </div>

              {ngBreakdown.groups
                .filter((g) => ngRespFilter === null || g.name === ngRespFilter)
                .map((g) => (
                <div key={g.name} className="border border-border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/40">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-foreground truncate">{g.name}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-sm">
                      <span className="font-bold text-red-400">{g.qty}</span>
                      <span className="text-muted-foreground">{g.pct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="divide-y divide-border">
                    {g.records.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => { setNgBreakdownOpen(false); setViewTarget(r.id); }}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-[hsl(210,70%,60%)]">{r.numero || "S/N"}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {r.part_number || "—"} · {resolveName(r.fornecedor || "—")} · {r.data}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-red-400 shrink-0">{r.quantidade_ng}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ApontamentoDashboard;