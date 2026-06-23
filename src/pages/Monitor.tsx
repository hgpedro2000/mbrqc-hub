import { useEffect, useMemo, useState, useCallback, ReactNode, useRef } from "react";
import { useNavigate } from "react-router-dom";
// IMPORTANT: /monitor uses a dedicated anon-only Supabase client (no session
// persistence). It must NOT import the main `supabase` client nor any auth
// listener/hook — the monitor session is independent of the main app login.
import { monitorClient as supabase } from "@/integrations/supabase/monitor-client";
import { MonitorDialog, loadPrefs, MonitorPreferences, MonitorBlock } from "@/components/apontamento/MonitorDialog";
import {
  Settings, Wifi, WifiOff, Loader2, ChevronLeft, ChevronRight, Pause, Play,
  AlertTriangle, CheckCircle2, TrendingUp, Package, ShieldAlert, Trophy,
  BarChart3, ListChecks, Maximize2, Minimize2, X, LogOut,
  Megaphone, Wrench, Microscope,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Cell, LabelList } from "recharts";
import { cn } from "@/lib/utils";

// Global in-memory photo cache: prefetched <img> objects keep decoded bytes warm.
const photoCache = new Map<string, HTMLImageElement>();
const prefetchPhotos = (urls: string[]) => {
  for (const url of urls) {
    if (!url || photoCache.has(url)) continue;
    const img = new Image();
    img.decoding = "async";
    img.loading = "eager";
    img.src = url;
    photoCache.set(url, img);
  }
};

type ConnState = "connecting" | "connected" | "error";

const SLIDE_DURATION_MS = 10000;
const STAGE_W = 1920;
const STAGE_H = 1080;

const periodRange = (p: MonitorPreferences): { start: Date; end?: Date } => {
  if (p.period === "custom" && p.customFrom && p.customTo) {
    return { start: new Date(`${p.customFrom}T00:00:00`), end: new Date(`${p.customTo}T23:59:59`) };
  }
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (p.period === "week") { const dow = d.getDay(); d.setDate(d.getDate() - dow); }
  else if (p.period === "month") d.setDate(1);
  return { start: d };
};

const fmtNum = (n: number) => new Intl.NumberFormat("pt-BR").format(n);

const BLOCK_META: Record<MonitorBlock, { title: string; icon: any; accent: string; gradient: string }> = {
  summary:        { title: "Resumo do Período",                  icon: TrendingUp,    accent: "text-primary",      gradient: "from-blue-500/20 via-transparent to-purple-500/20" },
  recent:         { title: "Últimos Lançamentos",                 icon: ListChecks,    accent: "text-cyan-400",     gradient: "from-cyan-500/20 via-transparent to-blue-500/20" },
  alerts:         { title: "Alertas de Qualidade",                icon: AlertTriangle, accent: "text-amber-500",    gradient: "from-amber-500/25 via-transparent to-orange-500/20" },
  contencao:      { title: "Contenções",                          icon: ShieldAlert,   accent: "text-red-500",      gradient: "from-red-500/25 via-transparent to-rose-500/20" },
  consumiveis:    { title: "Consumíveis Críticos",                icon: Package,       accent: "text-orange-500",   gradient: "from-orange-500/20 via-transparent to-yellow-500/20" },
  ranking:        { title: "Performance de Fornecedores",         icon: Trophy,        accent: "text-yellow-500",   gradient: "from-yellow-500/20 via-transparent to-amber-500/20" },
  defects:        { title: "Principais Modos de Falhas Detectados", icon: BarChart3,   accent: "text-destructive",  gradient: "from-red-500/20 via-transparent to-pink-500/20" },
  inspecionado:   { title: "Monitoramento de Inspeção",           icon: Package,       accent: "text-cyan-400",     gradient: "from-cyan-500/20 via-transparent to-emerald-500/20" },
  comunicados:    { title: "Comunicados",                         icon: Megaphone,     accent: "text-sky-400",      gradient: "from-sky-500/20 via-transparent to-indigo-500/20" },
  alteracoes_4m:  { title: "Alterações 4M/EO e Validações",       icon: Wrench,        accent: "text-violet-400",   gradient: "from-violet-500/20 via-transparent to-fuchsia-500/20" },
  ultimos_defeitos:{ title: "Últimos Defeitos Detectados",        icon: Microscope,    accent: "text-rose-400",     gradient: "from-rose-500/20 via-transparent to-red-500/20" },
};

// --- Hooks ---
const useScaleToFit = (w: number, h: number) => {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const calc = () => setScale(Math.min(window.innerWidth / w, window.innerHeight / h));
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [w, h]);
  return scale;
};

const useReducedMotion = () => {
  const [rm, setRm] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setRm(mq.matches);
    const handler = (e: MediaQueryListEvent) => setRm(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);
  return rm;
};

const useFullscreen = () => {
  const [isFs, setIsFs] = useState(false);
  useEffect(() => {
    const h = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);
  const toggle = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen?.();
    } catch { /* user-gesture / permission */ }
  }, []);
  return { isFs, toggle };
};

// --- Helpers ---
const allPhotos = (row: any): string[] => {
  const out: string[] = [];
  const singles = [row?.foto_url, row?.imagem_url, row?.photo_url];
  for (const s of singles) if (typeof s === "string" && s) out.push(s);
  const arrs = [row?.fotos, row?.imagens, row?.photos, row?.attachments];
  for (const a of arrs) if (Array.isArray(a)) for (const f of a) {
    if (typeof f === "string") out.push(f);
    else if (f?.url) out.push(f.url);
  }
  return Array.from(new Set(out));
};

// --- Photo modal ---
interface PhotoSource { photos: string[]; title: string; meta: { label: string; value: string }[]; }

const PhotoModal = ({ source, onClose }: { source: PhotoSource; onClose: () => void }) => {
  const [idx, setIdx] = useState(0);
  const total = source.photos.length;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIdx((i) => (i + 1) % total);
      if (e.key === "ArrowLeft") setIdx((i) => (i - 1 + total) % total);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total, onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-8 animate-fade-in" onClick={onClose}>
      <button onClick={onClose} className="absolute top-6 right-6 z-10 p-3 rounded-full bg-card/70 hover:bg-card border border-border" aria-label="Fechar">
        <X className="w-6 h-6" />
      </button>
      <div className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          <img src={source.photos[idx]} alt={source.title} className="max-w-[80vw] max-h-[70vh] object-contain rounded-xl shadow-2xl animate-scale-in" />
          {total > 1 && (
            <>
              <button onClick={() => setIdx((i) => (i - 1 + total) % total)} className="absolute left-3 top-1/2 -translate-y-1/2 p-3 rounded-full bg-card/70 hover:bg-card border border-border"><ChevronLeft className="w-6 h-6" /></button>
              <button onClick={() => setIdx((i) => (i + 1) % total)} className="absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-full bg-card/70 hover:bg-card border border-border"><ChevronRight className="w-6 h-6" /></button>
            </>
          )}
        </div>
        <div className="bg-card/80 backdrop-blur-md rounded-xl border border-border px-6 py-4 max-w-[80vw] w-full text-foreground">
          <h3 className="text-2xl font-bold mb-2 truncate">{source.title}</h3>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
            {source.meta.filter((m) => m.value).map((m) => (
              <span key={m.label}><span className="uppercase tracking-wider text-xs">{m.label}:</span> <span className="text-foreground">{m.value}</span></span>
            ))}
            {total > 1 && <span className="ml-auto">{idx + 1} / {total}</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Scaled stage wrapper ---
const ScaledStage = ({ children, className }: { children: ReactNode; className?: string }) => {
  const scale = useScaleToFit(STAGE_W, STAGE_H);
  return (
    <div className={cn("fixed inset-0 overflow-hidden", className)}>
      <div
        data-testid="monitor-stage"
        className="absolute left-1/2 top-1/2"
        style={{
          width: STAGE_W,
          height: STAGE_H,
          marginLeft: -STAGE_W / 2,
          marginTop: -STAGE_H / 2,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        {children}
      </div>
    </div>
  );
};

const Monitor = () => {
  const [prefs, setPrefs] = useState<MonitorPreferences>(loadPrefs());
  const [showSettings, setShowSettings] = useState(false);
  const [now, setNow] = useState(new Date());
  const [conn, setConn] = useState<ConnState>("connecting");
  const [slideIdx, setSlideIdx] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [paused, setPaused] = useState(false);
  const [flash, setFlash] = useState<{ type: "alert" | "contencao"; title: string } | null>(null);
  const [photoSource, setPhotoSource] = useState<PhotoSource | null>(null);
  const [logoutToast, setLogoutToast] = useState<string | null>(null);
  const [debugOpen, setDebugOpen] = useState(() => new URLSearchParams(window.location.search).has("debug"));
  const [debugEvents, setDebugEvents] = useState<{ t: number; kind: string; detail?: string }[]>([]);
  const [lastFetchAt, setLastFetchAt] = useState<Record<string, number>>({});
  const logEvt = useCallback((kind: string, detail?: string) => {
    setDebugEvents((prev) => [{ t: Date.now(), kind, detail }, ...prev].slice(0, 50));
  }, []);

  const reducedMotion = useReducedMotion();
  const { isFs, toggle: toggleFullscreen } = useFullscreen();
  const navigate = useNavigate();
  const autoFsTried = useRef(false);
  const [needsFsGesture, setNeedsFsGesture] = useState(false);

  const [apontamentos, setApontamentos] = useState<any[]>([]);
  const [alertas, setAlertas] = useState<any[]>([]);
  const [contencoes, setContencoes] = useState<any[]>([]);
  const [consumiveis, setConsumiveis] = useState<any[]>([]);

  const range = useMemo(() => periodRange(prefs), [prefs.period, prefs.customFrom, prefs.customTo]);
  const rangeKey = `${range.start.toISOString()}|${range.end?.toISOString() ?? ""}`;

  // Auto-enter fullscreen on mount; if the browser blocks it (no gesture), show a one-tap prompt.
  useEffect(() => {
    if (autoFsTried.current) return;
    autoFsTried.current = true;
    const tryFs = async () => {
      try {
        if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
      } catch {
        setNeedsFsGesture(true);
      }
    };
    tryFs();
  }, []);

  useEffect(() => {
    if (isFs) setNeedsFsGesture(false);
  }, [isFs]);

  const exitMonitor = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); } catch { /* noop */ }
    navigate("/apontamentos");
  };

  useEffect(() => {
    const root = document.documentElement;
    const had = root.classList.contains("dark");
    if (prefs.theme === "dark") root.classList.add("dark");
    return () => { if (!had && prefs.theme === "dark") root.classList.remove("dark"); };
  }, [prefs.theme]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // BroadcastChannel + localStorage fallback: PING/PONG/FOCUS/MAIN_LOGOUT.
  useEffect(() => {
    const handleMainLogout = () => {
      logEvt("MAIN_LOGOUT");
      setLogoutToast("Sessão principal encerrada — monitor mantido");
      setTimeout(() => setLogoutToast(null), 3000);
    };

    let ch: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      try {
        ch = new BroadcastChannel("monitor_channel");
        ch.onmessage = (e) => {
          const t = e.data?.type;
          if (t === "PING") { logEvt("PING→PONG"); ch?.postMessage({ type: "PONG" }); }
          else if (t === "FOCUS") { logEvt("FOCUS"); try { window.focus(); } catch { /* noop */ } }
          else if (t === "MAIN_LOGOUT") handleMainLogout();
        };
      } catch (err) { logEvt("BC_ERROR", String(err)); ch = null; }
    } else {
      logEvt("BC_UNAVAILABLE", "usando fallback localStorage");
    }

    // localStorage fallback — fires across windows via `storage` event.
    const onStorage = (ev: StorageEvent) => {
      if (ev.key !== "monitor_channel_evt" || !ev.newValue) return;
      try {
        const msg = JSON.parse(ev.newValue);
        if (msg?.type === "MAIN_LOGOUT") { logEvt("MAIN_LOGOUT(ls)"); handleMainLogout(); }
      } catch { /* noop */ }
    };
    window.addEventListener("storage", onStorage);

    const onUnload = () => {
      try { ch?.postMessage({ type: "MONITOR_CLOSED" }); } catch { /* noop */ }
      try { localStorage.setItem("monitor_channel_evt", JSON.stringify({ type: "MONITOR_CLOSED", t: Date.now() })); } catch { /* noop */ }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("storage", onStorage);
      try { ch?.postMessage({ type: "MONITOR_CLOSED" }); } catch { /* noop */ }
      ch?.close();
    };
  }, [logEvt]);

  const fetchTable = async (table: string) => {
    const startISO = range.start.toISOString();
    const endISO = range.end?.toISOString();
    if (table === "apontamentos") {
      let q = supabase.from("apontamentos").select("*").gte("created_at", startISO).order("created_at", { ascending: false });
      if (endISO) q = q.lte("created_at", endISO);
      const { data } = await q;
      if (data) setApontamentos(data);
    } else if (table === "alertas_qualidade") {
      const { data } = await supabase.from("alertas_qualidade").select("*").neq("status", "rascunho").order("created_at", { ascending: false }).limit(50);
      if (data) setAlertas(data);
    } else if (table === "contencao") {
      const { data } = await supabase.from("contencao").select("*").in("status", ["aberta", "em_andamento", "iniciada", "ativo"]).order("created_at", { ascending: false }).limit(50);
      if (data) setContencoes(data);
    } else if (table === "consumable_items") {
      const { data } = await supabase.from("consumable_items").select("*").eq("active", true);
      if (data) setConsumiveis(data);
    }
    setLastFetchAt((prev) => ({ ...prev, [table]: Date.now() }));
  };

  useEffect(() => {
    Promise.all([fetchTable("apontamentos"), fetchTable("alertas_qualidade"), fetchTable("contencao"), fetchTable("consumable_items")]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey]);

  // Realtime: one channel; debounce per-table refetch to avoid bursts on chatty updates.
  useEffect(() => {
    setConn("connecting");
    const timers: Record<string, any> = {};
    const debouncedRefetch = (table: string) => {
      clearTimeout(timers[table]);
      timers[table] = setTimeout(() => fetchTable(table), 250);
    };
    const channel = supabase
      .channel("monitor-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "apontamentos" }, () => debouncedRefetch("apontamentos"))
      .on("postgres_changes", { event: "*", schema: "public", table: "alertas_qualidade" }, (p: any) => {
        debouncedRefetch("alertas_qualidade");
        if (p?.eventType === "INSERT") setFlash({ type: "alert", title: p.new?.titulo || "Novo alerta de qualidade" });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "contencao" }, (p: any) => {
        debouncedRefetch("contencao");
        if (p?.eventType === "INSERT") setFlash({ type: "contencao", title: p.new?.titulo || "Nova contenção aberta" });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "consumable_items" }, () => debouncedRefetch("consumable_items"))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setConn("connected");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setConn("error");
        else setConn("connecting");
      });
    return () => {
      Object.values(timers).forEach(clearTimeout);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 6000);
    return () => clearTimeout(t);
  }, [flash]);

  // Prefetch + cache all alert/contention photos so the modal opens instantly.
  useEffect(() => {
    const urls: string[] = [];
    alertas.forEach((a) => urls.push(...allPhotos(a)));
    contencoes.forEach((c) => urls.push(...allPhotos(c)));
    if (urls.length) prefetchPhotos(urls);
  }, [alertas, contencoes]);

  const blocks = prefs.blocks;
  const safeIdx = blocks.length ? slideIdx % blocks.length : 0;
  const currentBlock = blocks[safeIdx];
  const nextBlock = blocks.length ? blocks[(safeIdx + 1) % blocks.length] : undefined;

  // Pause slideshow when modal/settings open
  const isPaused = paused || !!photoSource || showSettings;

  useEffect(() => {
    if (isPaused || blocks.length <= 1) return;
    const id = setInterval(() => {
      setDirection(1);
      setSlideIdx((i) => (i + 1) % blocks.length);
    }, SLIDE_DURATION_MS);
    return () => clearInterval(id);
  }, [isPaused, blocks.length]);

  const goPrev = () => { setDirection(-1); setSlideIdx((i) => (i - 1 + blocks.length) % blocks.length); };
  const goNext = () => { setDirection(1); setSlideIdx((i) => (i + 1) % blocks.length); };

  // KPIs
  const totalReg = apontamentos.length;
  const totalOk = apontamentos.reduce((s, a) => s + (a.quantidade_ok || 0), 0);
  const totalNg = apontamentos.reduce((s, a) => s + (a.quantidade_ng || 0), 0);
  const totalInsp = apontamentos.reduce((s, a) => s + (a.quantidade_inspecionada || a.quantidade || 0), 0);
  const ppm = totalInsp > 0 ? Math.round((totalNg / totalInsp) * 1_000_000) : 0;
  const criticalConsum = consumiveis.filter((c) => (c.stock_qty ?? 0) <= (c.min_qty ?? 0));

  const supplierRanking = useMemo(() => {
    const map = new Map<string, { ng: number; insp: number }>();
    apontamentos.forEach((a) => {
      const key = a.fornecedor || "—";
      const ng = a.quantidade_ng || 0;
      const insp = a.quantidade_inspecionada || a.quantidade || 0;
      const cur = map.get(key) || { ng: 0, insp: 0 };
      cur.ng += ng; cur.insp += insp;
      map.set(key, cur);
    });
    return Array.from(map.entries())
      .map(([fornecedor, v]) => ({ fornecedor, ng: v.ng, insp: v.insp, ppm: v.insp > 0 ? Math.round((v.ng / v.insp) * 1_000_000) : 0 }))
      .filter((s) => s.insp > 0)
      .sort((a, b) => b.ppm - a.ppm)
      .slice(0, 10);
  }, [apontamentos]);

  const inspecionadoData = useMemo(() => {
    // Group by supplier -> list of {part_number, part_name, qty}
    const bySupplier = new Map<string, Map<string, { part_number: string; part_name: string; qty: number }>>();
    apontamentos.forEach((a) => {
      const sup = a.fornecedor || "—";
      const pn = a.part_number || "—";
      const pname = a.part_name || a.descricao_peca || "";
      const qty = a.quantidade_inspecionada || a.quantidade || 0;
      if (!qty) return;
      if (!bySupplier.has(sup)) bySupplier.set(sup, new Map());
      const parts = bySupplier.get(sup)!;
      const key = `${pn}|${pname}`;
      const cur = parts.get(key) || { part_number: pn, part_name: pname, qty: 0 };
      cur.qty += qty;
      parts.set(key, cur);
    });
    return Array.from(bySupplier.entries())
      .map(([fornecedor, parts]) => ({
        fornecedor,
        total: Array.from(parts.values()).reduce((s, p) => s + p.qty, 0),
        parts: Array.from(parts.values()).sort((a, b) => b.qty - a.qty),
      }))
      .sort((a, b) => b.total - a.total);
  }, [apontamentos]);

  const defectsData = useMemo(() => {
    const map = new Map<string, number>();
    apontamentos.forEach((a) => { const ng = a.quantidade_ng || 0; if (!ng || !a.modo_falha) return; map.set(a.modo_falha, (map.get(a.modo_falha) || 0) + ng); });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [apontamentos]);

  const periodLabel = (() => {
    if (prefs.period === "today") return "Hoje";
    if (prefs.period === "week") return "Esta semana";
    if (prefs.period === "month") return "Este mês";
    if (prefs.period === "custom" && prefs.customFrom && prefs.customTo) return `${prefs.customFrom} → ${prefs.customTo}`;
    return "Período";
  })();

  const openPhotoModal = (row: any, kind: "alert" | "contencao") => {
    const photos = allPhotos(row);
    if (photos.length === 0) return;
    setPhotoSource({
      photos,
      title: row.titulo || row.numero || row.numero_alerta || (kind === "alert" ? "Alerta" : "Contenção"),
      meta: [
        { label: "Status", value: row.status || "" },
        { label: "Fornecedor", value: row.fornecedor || "" },
        { label: "Part Number", value: row.part_number || "" },
        { label: "Descrição", value: row.descricao || row.descricao_problema || "" },
        { label: "Criado em", value: row.created_at ? new Date(row.created_at).toLocaleString("pt-BR") : "" },
      ],
    });
  };

  const renderSlide = (id: MonitorBlock) => {
    switch (id) {
      case "summary": {
        const cards = [
          { label: "Registros", value: totalReg, accent: "text-foreground", bar: "bg-foreground/60", icon: ListChecks },
          { label: "Peças OK", value: totalOk, accent: "text-emerald-400", bar: "bg-emerald-400", icon: CheckCircle2 },
          { label: "Peças NG", value: totalNg, accent: "text-red-500", bar: "bg-red-500", icon: AlertTriangle },
          { label: "PPM", value: ppm, accent: "text-amber-400", bar: "bg-amber-400", icon: TrendingUp },
        ];
        return (
          <div className="grid grid-cols-2 grid-rows-2 gap-8 w-full h-full">
            {cards.map((c, i) => {
              const Icon = c.icon;
              return (
                <div
                  key={c.label}
                  className="relative overflow-hidden rounded-3xl bg-card/60 backdrop-blur-md border border-border/60 p-12 flex items-center justify-between gap-8"
                  style={reducedMotion ? undefined : { animation: `fade-in 0.6s ease-out ${i * 120}ms both` }}
                >
                  <div className="flex flex-col gap-3">
                    <span className="uppercase tracking-[0.2em] text-2xl text-muted-foreground">{c.label}</span>
                    <p className={cn("text-[140px] leading-none font-black tabular-nums", c.accent)}>{fmtNum(c.value)}</p>
                  </div>
                  <Icon className={cn("w-32 h-32 opacity-80", c.accent)} />
                  <div className={cn("absolute inset-x-0 bottom-0 h-2", c.bar)} />
                </div>
              );
            })}
          </div>
        );
      }
      case "recent":
        return (
          <div className="w-full h-full overflow-hidden rounded-3xl bg-card/60 backdrop-blur-md border border-border/60">
            <table className="w-full text-2xl">
              <thead className="bg-muted/30">
                <tr className="text-muted-foreground text-base uppercase tracking-wider">
                  <th className="text-left py-5 px-5">Nº</th>
                  <th className="text-left py-5 px-5">Part Number</th>
                  <th className="text-left py-5 px-5">Fornecedor</th>
                  <th className="text-left py-5 px-5">Modo de Falha</th>
                  <th className="text-right py-5 px-5">Insp.</th>
                  <th className="text-right py-5 px-5">OK</th>
                  <th className="text-right py-5 px-5">NG</th>
                  <th className="text-right py-5 px-5">Hora</th>
                </tr>
              </thead>
              <tbody>
                {apontamentos.slice(0, 11).map((a, i) => {
                  const insp = a.quantidade_inspecionada || a.quantidade || 0;
                  const ok = a.quantidade_ok ?? Math.max(insp - (a.quantidade_ng || 0), 0);
                  return (
                    <tr key={a.id} className="border-t border-border/40" style={reducedMotion ? undefined : { animation: `fade-in 0.4s ease-out ${i * 60}ms both` }}>
                      <td className="py-4 px-5 font-mono text-xl">{a.numero || "—"}</td>
                      <td className="py-4 px-5 truncate max-w-[260px]">{a.part_number || "—"}</td>
                      <td className="py-4 px-5 truncate max-w-[280px]">{a.fornecedor || "—"}</td>
                      <td className="py-4 px-5 truncate max-w-[300px] text-amber-300">{a.modo_falha || "—"}</td>
                      <td className="py-4 px-5 text-right font-bold tabular-nums text-cyan-300">{fmtNum(insp)}</td>
                      <td className="py-4 px-5 text-right font-bold tabular-nums text-emerald-400">{fmtNum(ok)}</td>
                      <td className={cn("py-4 px-5 text-right font-black text-3xl tabular-nums", a.quantidade_ng > 0 ? "text-red-500" : "text-emerald-400")}>{a.quantidade_ng || 0}</td>
                      <td className="py-4 px-5 text-right text-xl text-muted-foreground">{new Date(a.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
                    </tr>
                  );
                })}
                {apontamentos.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-20 text-4xl text-muted-foreground">Sem registros no período.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        );
      case "alerts":
        return (
          <div className="grid grid-cols-3 grid-rows-2 gap-6 w-full h-full">
            {alertas.length === 0 && <div className="col-span-3 row-span-2 flex items-center justify-center text-5xl text-muted-foreground">Sem alertas vigentes.</div>}
            {alertas.slice(0, 6).map((a, i) => {
              const photos = allPhotos(a);
              const photo = photos[0];
              const hasPhotos = photos.length > 0;
              return (
                <div
                  key={a.id}
                  onClick={() => hasPhotos && openPhotoModal(a, "alert")}
                  className={cn(
                    "relative overflow-hidden rounded-2xl bg-card/60 backdrop-blur-md border border-amber-500/40 flex flex-col",
                    hasPhotos && "cursor-pointer transition-transform hover:scale-[1.02]",
                  )}
                  style={reducedMotion ? undefined : { animation: `fade-in 0.5s ease-out ${i * 80}ms both` }}
                >
                  {photo && <img src={photo} alt="" className="w-full h-44 object-cover" loading="lazy" />}
                  <div className="p-5 flex-1 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-2xl font-bold truncate">{a.titulo || a.numero_alerta || "Alerta"}</h3>
                      <span className="text-base px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 font-semibold uppercase">{a.status || "ativo"}</span>
                    </div>
                    <p className="text-xl text-muted-foreground line-clamp-3">{a.descricao_problema || a.fornecedor || ""}</p>
                    {a.fornecedor && <p className="text-lg text-amber-400/80 mt-auto">⚠ {a.fornecedor}</p>}
                  </div>
                  <div className="absolute left-0 top-0 bottom-0 w-2 bg-amber-500" />
                  {photos.length > 1 && <span className="absolute top-3 right-3 text-xs px-2 py-1 rounded bg-black/60 text-white">+{photos.length - 1}</span>}
                </div>
              );
            })}
          </div>
        );
      case "contencao":
        return (
          <div className="grid grid-cols-3 grid-rows-2 gap-6 w-full h-full">
            {contencoes.length === 0 && <div className="col-span-3 row-span-2 flex items-center justify-center text-5xl text-muted-foreground">Nenhuma contenção ativa.</div>}
            {contencoes.slice(0, 6).map((c, i) => {
              const photos = allPhotos(c);
              const photo = photos[0];
              const hasPhotos = photos.length > 0;
              return (
                <div
                  key={c.id}
                  onClick={() => hasPhotos && openPhotoModal(c, "contencao")}
                  className={cn(
                    "relative overflow-hidden rounded-2xl bg-card/60 backdrop-blur-md border border-red-500/40 flex flex-col",
                    hasPhotos && "cursor-pointer transition-transform hover:scale-[1.02]",
                  )}
                  style={reducedMotion ? undefined : { animation: `fade-in 0.5s ease-out ${i * 80}ms both` }}
                >
                  {photo && <img src={photo} alt="" className="w-full h-44 object-cover" loading="lazy" />}
                  <div className="p-5 flex-1 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-2xl font-bold truncate">{c.titulo || c.numero || "Contenção"}</h3>
                      <span className="text-base px-3 py-1 rounded-full bg-red-500/20 text-red-400 font-semibold uppercase">{c.status}</span>
                    </div>
                    <p className="text-xl text-muted-foreground line-clamp-2">{c.part_number} · {c.fornecedor || ""}</p>
                    {c.descricao && <p className="text-lg text-muted-foreground line-clamp-2">{c.descricao}</p>}
                  </div>
                  <div className="absolute left-0 top-0 bottom-0 w-2 bg-red-500" />
                  {photos.length > 1 && <span className="absolute top-3 right-3 text-xs px-2 py-1 rounded bg-black/60 text-white">+{photos.length - 1}</span>}
                </div>
              );
            })}
          </div>
        );
      case "consumiveis":
        return (
          <div className="w-full h-full overflow-hidden rounded-3xl bg-card/60 backdrop-blur-md border border-border/60 p-10">
            {criticalConsum.length === 0 ? (
              <div className="h-full flex items-center justify-center text-5xl text-muted-foreground">Estoque saudável ✅</div>
            ) : (
              <ul className="space-y-6 h-full">
                {criticalConsum.slice(0, 10).map((c, i) => {
                  const pct = Math.min(100, ((c.stock_qty ?? 0) / Math.max(c.min_qty || 1, 1)) * 100);
                  return (
                    <li key={c.id} className="space-y-2" style={reducedMotion ? undefined : { animation: `fade-in 0.4s ease-out ${i * 60}ms both` }}>
                      <div className="flex items-center justify-between">
                        <span className="text-3xl font-semibold">{c.name}</span>
                        <span className="text-4xl font-black text-red-500 tabular-nums">{c.stock_qty} / {c.min_qty} {c.unit || ""}</span>
                      </div>
                      <div className="h-5 rounded-full bg-muted/40 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-red-600 via-red-500 to-orange-400 transition-all duration-700" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      case "ranking": {
        const max = Math.max(...supplierRanking.map((s) => s.ppm), 1);
        return (
          <div className="w-full h-full overflow-hidden rounded-3xl bg-card/60 backdrop-blur-md border border-border/60 p-10">
            <div className="grid grid-cols-[5rem_1fr_8rem_8rem_10rem] gap-6 text-xs uppercase tracking-wider text-muted-foreground pb-3 border-b border-border/40">
              <span className="text-center">#</span>
              <span>Fornecedor</span>
              <span className="text-right">Insp.</span>
              <span className="text-right">NG</span>
              <span className="text-right">PPM</span>
            </div>
            <ol className="divide-y divide-border/30">
              {supplierRanking.length === 0 && <li className="h-[60vh] flex items-center justify-center text-5xl text-muted-foreground">Sem dados no período.</li>}
              {supplierRanking.slice(0, 8).map((s, i) => (
                <li key={s.fornecedor} className="grid grid-cols-[5rem_1fr_8rem_8rem_10rem] items-center gap-6 py-4" style={reducedMotion ? undefined : { animation: `fade-in 0.4s ease-out ${i * 70}ms both` }}>
                  <span className={cn("text-5xl font-black text-center", i === 0 ? "text-yellow-400" : i === 1 ? "text-zinc-300" : i === 2 ? "text-amber-700" : "text-muted-foreground")}>{i + 1}</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-3xl truncate">{s.fornecedor}</p>
                    <div className="h-3 rounded-full bg-muted/40 overflow-hidden mt-2">
                      <div className="h-full bg-gradient-to-r from-red-600 to-amber-500 transition-all duration-700" style={{ width: `${(s.ppm / max) * 100}%` }} />
                    </div>
                  </div>
                  <span className="text-3xl font-bold text-cyan-300 tabular-nums text-right">{fmtNum(s.insp)}</span>
                  <span className="text-3xl font-bold text-red-400 tabular-nums text-right">{fmtNum(s.ng)}</span>
                  <span className="text-5xl font-black text-red-500 tabular-nums text-right">{fmtNum(s.ppm)}</span>
                </li>
              ))}
            </ol>
          </div>
        );
      }
      case "defects":
        return (
          <div className="w-full h-full overflow-hidden rounded-3xl bg-card/60 backdrop-blur-md border border-border/60 p-8">
            {defectsData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-5xl text-muted-foreground">Sem defeitos no período.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={defectsData} layout="vertical" margin={{ left: 200, right: 120, top: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={20} />
                  <YAxis dataKey="name" type="category" width={260} stroke="hsl(var(--muted-foreground))" fontSize={20} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 18 }} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} isAnimationActive={!reducedMotion} animationDuration={800}>
                    {defectsData.map((_, i) => <Cell key={i} fill={`hsl(${10 + i * 8}, 85%, ${55 - i * 2}%)`} />)}
                    <LabelList dataKey="value" position="right" fill="hsl(var(--foreground))" fontSize={26} fontWeight={900} formatter={(v: number) => fmtNum(v)} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        );
      case "inspecionado": {
        const suppliers = inspecionadoData.slice(0, 4);
        return (
          <div className="w-full h-full overflow-hidden">
            {suppliers.length === 0 ? (
              <div className="h-full flex items-center justify-center text-5xl text-muted-foreground rounded-3xl bg-card/60 backdrop-blur-md border border-border/60">
                Sem peças inspecionadas no período.
              </div>
            ) : (
              <div className={cn(
                "grid gap-6 w-full h-full",
                suppliers.length === 1 ? "grid-cols-1" : suppliers.length === 2 ? "grid-cols-2" : "grid-cols-2 grid-rows-2",
              )}>
                {suppliers.map((sup, si) => (
                  <div
                    key={sup.fornecedor}
                    className="relative overflow-hidden rounded-2xl bg-card/60 backdrop-blur-md border border-cyan-500/30 p-6 flex flex-col"
                    style={reducedMotion ? undefined : { animation: `fade-in 0.5s ease-out ${si * 100}ms both` }}
                  >
                    <div className="flex items-center justify-between gap-3 pb-3 border-b border-border/40">
                      <h3 className="text-2xl font-bold truncate text-cyan-300">{sup.fornecedor}</h3>
                      <span className="text-4xl font-black tabular-nums text-cyan-400">{fmtNum(sup.total)}</span>
                    </div>
                    <ul className="flex-1 overflow-hidden mt-2 divide-y divide-border/30">
                      {sup.parts.slice(0, 8).map((p, i) => (
                        <li key={`${p.part_number}-${i}`} className="grid grid-cols-[1fr_auto] items-center gap-4 py-2">
                          <div className="min-w-0">
                            <p className="font-mono text-lg truncate">{p.part_number}</p>
                            {p.part_name && <p className="text-sm text-muted-foreground truncate">{p.part_name}</p>}
                          </div>
                          <span className="text-2xl font-bold tabular-nums text-emerald-400">{fmtNum(p.qty)}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="absolute left-0 top-0 bottom-0 w-2 bg-cyan-500" />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }
    }
  };

  const slideAnimation = reducedMotion
    ? ""
    : direction === 1
      ? "animate-[slide-in-right_0.55s_ease-out]"
      : "animate-[slide-in-left_0.55s_ease-out]";

  const meta = currentBlock ? BLOCK_META[currentBlock] : null;
  const Icon = meta?.icon;

  return (
    <ScaledStage
      className={cn(
        prefs.theme === "dark"
          ? "bg-gradient-to-br from-[hsl(220,25%,6%)] via-[hsl(220,25%,9%)] to-[hsl(230,30%,12%)] text-foreground"
          : "bg-background text-foreground",
      )}
    >
      <style>{`
        @keyframes slide-in-left { 0% { transform: translateX(-100%); opacity: 0 } 100% { transform: translateX(0); opacity: 1 } }
        @keyframes ticker { 0% { transform: translateX(0) } 100% { transform: translateX(-50%) } }
        @media (prefers-reduced-motion: reduce) {
          .reduced-motion * { animation: none !important; transition: none !important; }
        }
      `}</style>

      <div data-testid="monitor-root" className={cn("relative w-full h-full flex flex-col group", reducedMotion && "reduced-motion")}>
        {/* Ambient gradient backdrop */}
        {meta && (
          <div
            key={`bg-${safeIdx}`}
            className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60 transition-opacity duration-700", meta.gradient)}
          />
        )}

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between px-10 py-6 border-b border-border/40 backdrop-blur-md bg-background/40">
          <div className="flex items-center gap-5">
            {Icon && <Icon className={cn("w-14 h-14", meta!.accent)} />}
            <div>
              <p className="text-lg uppercase tracking-[0.3em] text-muted-foreground">Monitor de Qualidade · {periodLabel}</p>
              <h1 className="text-6xl font-heading font-black tracking-tight">{meta?.title ?? "—"}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 mr-2">
              {blocks.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setDirection(i > safeIdx ? 1 : -1); setSlideIdx(i); }}
                  className={cn("h-2 rounded-full transition-all", i === safeIdx ? "w-16 bg-primary" : "w-4 bg-muted-foreground/40 hover:bg-muted-foreground")}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
            <Button variant="ghost" size="icon" onClick={goPrev} className="opacity-30 hover:opacity-100"><ChevronLeft className="w-7 h-7" /></Button>
            <Button variant="ghost" size="icon" onClick={() => setPaused((p) => !p)} className="opacity-30 hover:opacity-100">
              {paused ? <Play className="w-7 h-7" /> : <Pause className="w-7 h-7" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={goNext} className="opacity-30 hover:opacity-100"><ChevronRight className="w-7 h-7" /></Button>
            <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="opacity-30 hover:opacity-100" aria-label="Tela cheia">
              {isFs ? <Minimize2 className="w-7 h-7" /> : <Maximize2 className="w-7 h-7" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)} className="opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Configurações do monitor">
              <Settings className="w-7 h-7" />
            </Button>
            <Button
              variant="destructive"
              onClick={exitMonitor}
              className="ml-2 gap-2 font-bold uppercase tracking-wider shadow-lg"
              aria-label="Sair do monitor"
            >
              <LogOut className="w-5 h-5" /> Sair
            </Button>
          </div>
        </header>

        {/* Auto-advance progress bar */}
        {!isPaused && blocks.length > 1 && (
          <div className="relative z-10 h-1.5 bg-muted/30">
            <div
              key={`pb-${safeIdx}-${rangeKey}`}
              className="h-full bg-gradient-to-r from-primary via-cyan-400 to-primary"
              style={{ animation: reducedMotion ? undefined : `slide-in-right ${SLIDE_DURATION_MS}ms linear forwards`, transformOrigin: "left" }}
            />
          </div>
        )}

        {/* Flash banner */}
        {flash && (
          <div className={cn(
            "relative z-20 mx-10 mt-4 rounded-2xl border px-6 py-4 flex items-center gap-4",
            !reducedMotion && "animate-[slide-in-right_0.4s_ease-out]",
            flash.type === "alert" ? "bg-amber-500/15 border-amber-500/50 text-amber-200" : "bg-red-500/15 border-red-500/50 text-red-200",
          )}>
            <AlertTriangle className="w-7 h-7 animate-pulse" />
            <span className="font-semibold uppercase tracking-wider text-base">{flash.type === "alert" ? "Novo alerta" : "Nova contenção"}</span>
            <span className="text-2xl truncate">{flash.title}</span>
          </div>
        )}

        {/* Slide area — render only current; preload next off-screen for image cache. */}
        <main data-testid="monitor-grid" className="relative z-10 flex-1 min-h-0 p-10 overflow-hidden">
          {blocks.length === 0 ? (
            <div className="h-full flex items-center justify-center text-4xl text-muted-foreground">
              Nenhum bloco selecionado.
              <Button className="ml-4" onClick={() => setShowSettings(true)}>Configurar</Button>
            </div>
          ) : (
            <>
              <div key={`${currentBlock}-${safeIdx}`} className={cn("w-full h-full", slideAnimation)}>
                {currentBlock && renderSlide(currentBlock)}
              </div>
              {/* Preload next slide off-screen (warms images, recharts) without painting it */}
              {nextBlock && nextBlock !== currentBlock && (
                <div
                  data-testid="monitor-preload"
                  aria-hidden="true"
                  className="absolute pointer-events-none opacity-0"
                  style={{ left: -99999, top: 0, width: STAGE_W - 80, height: STAGE_H - 280 }}
                >
                  {renderSlide(nextBlock)}
                </div>
              )}
            </>
          )}
        </main>

        {/* Live ticker */}
        {apontamentos.length > 0 && (
          <div className="relative z-10 overflow-hidden border-t border-border/40 bg-background/60 backdrop-blur-md py-3">
            <div className="flex gap-14 whitespace-nowrap" style={{ animation: reducedMotion ? undefined : "ticker 45s linear infinite", width: "max-content" }}>
              {[...apontamentos.slice(0, 20), ...apontamentos.slice(0, 20)].map((a, i) => (
                <span key={i} className="flex items-center gap-3 text-xl">
                  <span className="font-mono text-muted-foreground">{a.numero || "—"}</span>
                  <span className="uppercase text-sm px-2 py-0.5 rounded bg-muted/50">{a.tipo}</span>
                  <span className="font-semibold">{a.part_number || "—"}</span>
                  <span className="text-muted-foreground">· {a.fornecedor || "—"}</span>
                  <span className={cn("font-black", a.quantidade_ng > 0 ? "text-red-500" : "text-emerald-400")}>NG {a.quantidade_ng || 0}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="relative z-10 flex items-center justify-between px-10 py-4 border-t border-border/40 bg-background/60 backdrop-blur-md text-xl">
          <span className="font-mono">
            {now.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })} · <span className="font-bold">{now.toLocaleTimeString("pt-BR")}</span>
          </span>
          <span className="text-muted-foreground text-base uppercase tracking-widest">
            Slide {safeIdx + 1} / {blocks.length} · {isPaused ? "Pausado" : `Auto ${SLIDE_DURATION_MS / 1000}s`}{isFs ? " · Kiosk" : ""}
          </span>
          <span data-testid="monitor-conn" data-state={conn} className="flex items-center gap-2">
            {conn === "connected" && (<><Wifi className="w-6 h-6 text-emerald-500" /><span className="text-emerald-500">Conectado</span></>)}
            {conn === "connecting" && (<><Loader2 className="w-6 h-6 text-amber-500 animate-spin" /><span className="text-amber-500">Conectando…</span></>)}
            {conn === "error" && (<><WifiOff className="w-6 h-6 text-red-500" /><span className="text-red-500">Sem conexão</span></>)}
            <span className={cn("inline-block w-3 h-3 rounded-full",
              conn === "connected" && "bg-emerald-500 animate-pulse",
              conn === "connecting" && "bg-amber-500 animate-pulse",
              conn === "error" && "bg-red-500")} />
          </span>
        </footer>
      </div>

      {photoSource && <PhotoModal source={photoSource} onClose={() => setPhotoSource(null)} />}

      {logoutToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] px-4 py-2 rounded-lg bg-black/80 text-white text-sm shadow-lg animate-fade-in">
          {logoutToast}
        </div>
      )}

      {/* Debug panel — toggle with `D` key or ?debug query param */}
      <button
        onClick={() => setDebugOpen((v) => !v)}
        className="fixed bottom-2 right-2 z-[250] px-2 py-1 rounded bg-black/40 text-white/60 text-[10px] font-mono hover:bg-black/70"
        aria-label="Toggle debug"
      >DBG</button>
      {debugOpen && (
        <div className="fixed bottom-10 right-2 z-[250] w-[360px] max-h-[60vh] overflow-auto rounded-lg bg-black/85 text-white text-xs font-mono shadow-2xl border border-white/10">
          <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
            <span className="font-bold">Monitor Debug</span>
            <span className="text-white/50">
              BC: {typeof BroadcastChannel !== "undefined" ? "ok" : "fallback(ls)"}
            </span>
          </div>
          <div className="px-3 py-2 border-b border-white/10 space-y-0.5">
            <div className="text-white/60">Última atualização dos dados:</div>
            {(["apontamentos","alertas_qualidade","contencao","consumable_items"] as const).map((t) => {
              const ts = lastFetchAt[t];
              const ago = ts ? Math.round((Date.now() - ts) / 1000) : null;
              return (
                <div key={t} className="flex justify-between">
                  <span>{t}</span>
                  <span className={cn(ago === null ? "text-white/40" : ago > 60 ? "text-amber-400" : "text-emerald-400")}>
                    {ago === null ? "—" : `${ago}s atrás`}
                  </span>
                </div>
              );
            })}
            <div className="flex justify-between pt-1 border-t border-white/10 mt-1">
              <span>Realtime</span>
              <span className={cn(conn === "connected" ? "text-emerald-400" : conn === "error" ? "text-red-400" : "text-amber-400")}>{conn}</span>
            </div>
          </div>
          <div className="px-3 py-2">
            <div className="text-white/60 mb-1">Eventos BroadcastChannel ({debugEvents.length}):</div>
            {debugEvents.length === 0 && <div className="text-white/40">nenhum evento ainda</div>}
            {debugEvents.map((e, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-white/40">{new Date(e.t).toLocaleTimeString()}</span>
                <span className="text-cyan-300">{e.kind}</span>
                {e.detail && <span className="text-white/60 truncate">{e.detail}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {needsFsGesture && !isFs && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-card border border-border rounded-2xl p-8 max-w-md text-center space-y-4 shadow-2xl">
            <Maximize2 className="w-12 h-12 mx-auto text-primary" />
            <h2 className="text-2xl font-bold">Ativar modo Kiosk</h2>
            <p className="text-muted-foreground">O navegador exige um clique para entrar em tela cheia.</p>
            <Button size="lg" className="w-full" onClick={() => { toggleFullscreen(); setNeedsFsGesture(false); }}>
              Entrar em tela cheia
            </Button>
          </div>
        </div>
      )}

      <MonitorDialog open={showSettings} onOpenChange={setShowSettings} initial={prefs} confirmLabel="Aplicar" onConfirm={(p) => { setPrefs(p); setSlideIdx(0); }} />
    </ScaledStage>
  );
};

export default Monitor;
