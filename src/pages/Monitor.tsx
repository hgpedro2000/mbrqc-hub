import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MonitorDialog, loadPrefs, MonitorPreferences, MonitorBlock } from "@/components/apontamento/MonitorDialog";
import { Settings, Wifi, WifiOff, Loader2, ChevronLeft, ChevronRight, Pause, Play, AlertTriangle, CheckCircle2, TrendingUp, Package, ShieldAlert, Trophy, BarChart3, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Cell } from "recharts";
import { cn } from "@/lib/utils";

type ConnState = "connecting" | "connected" | "error";

const SLIDE_DURATION_MS = 10000; // 10s per slide

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
  summary:    { title: "Resumo do Período",         icon: TrendingUp,  accent: "text-primary",     gradient: "from-blue-500/20 via-transparent to-purple-500/20" },
  recent:     { title: "Últimos Registros",         icon: ListChecks,  accent: "text-cyan-400",    gradient: "from-cyan-500/20 via-transparent to-blue-500/20" },
  alerts:     { title: "Alertas Vigentes",          icon: AlertTriangle,accent: "text-amber-500",  gradient: "from-amber-500/25 via-transparent to-orange-500/20" },
  contencao:  { title: "Contenções Ativas",         icon: ShieldAlert, accent: "text-red-500",     gradient: "from-red-500/25 via-transparent to-rose-500/20" },
  consumiveis:{ title: "Consumíveis Críticos",      icon: Package,     accent: "text-orange-500",  gradient: "from-orange-500/20 via-transparent to-yellow-500/20" },
  ranking:    { title: "Ranking de Fornecedores",   icon: Trophy,      accent: "text-yellow-500",  gradient: "from-yellow-500/20 via-transparent to-amber-500/20" },
  defects:    { title: "Gráfico de Defeitos",       icon: BarChart3,   accent: "text-destructive", gradient: "from-red-500/20 via-transparent to-pink-500/20" },
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

  const [apontamentos, setApontamentos] = useState<any[]>([]);
  const [alertas, setAlertas] = useState<any[]>([]);
  const [contencoes, setContencoes] = useState<any[]>([]);
  const [consumiveis, setConsumiveis] = useState<any[]>([]);

  const range = useMemo(() => periodRange(prefs), [prefs.period, prefs.customFrom, prefs.customTo]);
  const rangeKey = `${range.start.toISOString()}|${range.end?.toISOString() ?? ""}`;

  // Force dark when selected (default)
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
  };

  useEffect(() => {
    Promise.all([fetchTable("apontamentos"), fetchTable("alertas_qualidade"), fetchTable("contencao"), fetchTable("consumable_items")]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey]);

  useEffect(() => {
    setConn("connecting");
    const channel = supabase
      .channel("monitor-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "apontamentos" }, () => fetchTable("apontamentos"))
      .on("postgres_changes", { event: "*", schema: "public", table: "alertas_qualidade" }, (p: any) => {
        fetchTable("alertas_qualidade");
        if (p?.eventType === "INSERT") setFlash({ type: "alert", title: p.new?.titulo || "Novo alerta de qualidade" });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "contencao" }, (p: any) => {
        fetchTable("contencao");
        if (p?.eventType === "INSERT") setFlash({ type: "contencao", title: p.new?.titulo || "Nova contenção aberta" });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "consumable_items" }, () => fetchTable("consumable_items"))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setConn("connected");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setConn("error");
        else setConn("connecting");
      });

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey]);

  // Flash banner auto-dismiss
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 6000);
    return () => clearTimeout(t);
  }, [flash]);

  const blocks = prefs.blocks;
  const safeIdx = blocks.length ? slideIdx % blocks.length : 0;
  const currentBlock = blocks[safeIdx];

  // Auto-advance
  useEffect(() => {
    if (paused || blocks.length <= 1) return;
    const id = setInterval(() => {
      setDirection(1);
      setSlideIdx((i) => (i + 1) % blocks.length);
    }, SLIDE_DURATION_MS);
    return () => clearInterval(id);
  }, [paused, blocks.length]);

  const goPrev = () => { setDirection(-1); setSlideIdx((i) => (i - 1 + blocks.length) % blocks.length); };
  const goNext = () => { setDirection(1); setSlideIdx((i) => (i + 1) % blocks.length); };

  // Derived KPIs
  const totalReg = apontamentos.length;
  const totalOk = apontamentos.reduce((s, a) => s + (a.quantidade_ok || 0), 0);
  const totalNg = apontamentos.reduce((s, a) => s + (a.quantidade_ng || 0), 0);
  const totalInsp = apontamentos.reduce((s, a) => s + (a.quantidade_inspecionada || a.quantidade || 0), 0);
  const ppm = totalInsp > 0 ? Math.round((totalNg / totalInsp) * 1_000_000) : 0;
  const criticalConsum = consumiveis.filter((c) => (c.stock_qty ?? 0) <= (c.min_qty ?? 0));

  const supplierRanking = useMemo(() => {
    const map = new Map<string, number>();
    apontamentos.forEach((a) => { const ng = a.quantidade_ng || 0; if (!ng) return; const key = a.fornecedor || "—"; map.set(key, (map.get(key) || 0) + ng); });
    return Array.from(map.entries()).map(([fornecedor, ng]) => ({ fornecedor, ng })).sort((a, b) => b.ng - a.ng).slice(0, 10);
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

  // Photo helper for alerts/contenções
  const firstPhoto = (row: any): string | null => {
    const candidates = [row?.foto_url, row?.imagem_url, row?.photo_url];
    for (const c of candidates) if (typeof c === "string" && c) return c;
    const arrs = [row?.fotos, row?.imagens, row?.photos, row?.attachments];
    for (const a of arrs) if (Array.isArray(a) && a.length) {
      const first = a[0];
      if (typeof first === "string") return first;
      if (first?.url) return first.url;
    }
    return null;
  };

  const renderSlide = (id: MonitorBlock) => {
    switch (id) {
      case "summary": {
        const cards = [
          { label: "Registros", value: totalReg, accent: "text-foreground", icon: ListChecks },
          { label: "Peças OK", value: totalOk, accent: "text-emerald-400", icon: CheckCircle2 },
          { label: "Peças NG", value: totalNg, accent: "text-red-500", icon: AlertTriangle },
          { label: "PPM", value: ppm, accent: "text-amber-400", icon: TrendingUp },
        ];
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 w-full h-full">
            {cards.map((c, i) => {
              const Icon = c.icon;
              return (
                <div
                  key={c.label}
                  className="relative overflow-hidden rounded-2xl bg-card/60 backdrop-blur-md border border-border/60 p-8 flex flex-col justify-between"
                  style={{ animation: `fade-in 0.6s ease-out ${i * 120}ms both` }}
                >
                  <div className="flex items-center justify-between">
                    <span className="uppercase tracking-[0.2em] text-sm text-muted-foreground">{c.label}</span>
                    <Icon className={cn("w-8 h-8", c.accent)} />
                  </div>
                  <p className={cn("text-7xl xl:text-8xl font-black tabular-nums", c.accent)}>{fmtNum(c.value)}</p>
                  <div className={cn("absolute inset-x-0 bottom-0 h-1", c.accent.replace("text-", "bg-"))} />
                </div>
              );
            })}
          </div>
        );
      }
      case "recent":
        return (
          <div className="w-full h-full overflow-hidden rounded-2xl bg-card/60 backdrop-blur-md border border-border/60">
            <table className="w-full text-xl">
              <thead className="bg-muted/30">
                <tr className="text-muted-foreground text-base uppercase tracking-wider">
                  <th className="text-left py-4 px-6">Nº</th>
                  <th className="text-left py-4 px-6">Tipo</th>
                  <th className="text-left py-4 px-6">Part Number</th>
                  <th className="text-left py-4 px-6">Fornecedor</th>
                  <th className="text-right py-4 px-6">NG</th>
                  <th className="text-right py-4 px-6">Hora</th>
                </tr>
              </thead>
              <tbody>
                {apontamentos.slice(0, 12).map((a, i) => (
                  <tr key={a.id} className="border-t border-border/40" style={{ animation: `fade-in 0.4s ease-out ${i * 60}ms both` }}>
                    <td className="py-4 px-6 font-mono text-base">{a.numero || "—"}</td>
                    <td className="py-4 px-6 uppercase font-semibold">{a.tipo}</td>
                    <td className="py-4 px-6">{a.part_number || "—"}</td>
                    <td className="py-4 px-6 truncate max-w-[300px]">{a.fornecedor || "—"}</td>
                    <td className={cn("py-4 px-6 text-right font-black text-2xl tabular-nums", a.quantidade_ng > 0 ? "text-red-500" : "text-emerald-400")}>{a.quantidade_ng || 0}</td>
                    <td className="py-4 px-6 text-right text-base text-muted-foreground">{new Date(a.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
                  </tr>
                ))}
                {apontamentos.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-16 text-2xl text-muted-foreground">Sem registros no período.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        );
      case "alerts":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 w-full h-full overflow-y-auto pr-2">
            {alertas.length === 0 && <div className="col-span-full flex items-center justify-center text-3xl text-muted-foreground">Sem alertas vigentes.</div>}
            {alertas.slice(0, 9).map((a, i) => {
              const photo = firstPhoto(a);
              return (
                <div
                  key={a.id}
                  className="relative overflow-hidden rounded-2xl bg-card/60 backdrop-blur-md border border-amber-500/40 flex flex-col"
                  style={{ animation: `fade-in 0.5s ease-out ${i * 80}ms both` }}
                >
                  {photo && <img src={photo} alt="" className="w-full h-40 object-cover" loading="lazy" />}
                  <div className="p-5 flex-1 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-xl font-bold truncate">{a.titulo || a.numero_alerta || "Alerta"}</h3>
                      <span className="text-xs px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 font-semibold uppercase">{a.status || "ativo"}</span>
                    </div>
                    <p className="text-base text-muted-foreground line-clamp-3">{a.descricao_problema || a.fornecedor || ""}</p>
                    {a.fornecedor && <p className="text-sm text-amber-400/80 mt-auto">⚠ {a.fornecedor}</p>}
                  </div>
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500" />
                </div>
              );
            })}
          </div>
        );
      case "contencao":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 w-full h-full overflow-y-auto pr-2">
            {contencoes.length === 0 && <div className="col-span-full flex items-center justify-center text-3xl text-muted-foreground">Nenhuma contenção ativa.</div>}
            {contencoes.slice(0, 9).map((c, i) => {
              const photo = firstPhoto(c);
              return (
                <div
                  key={c.id}
                  className="relative overflow-hidden rounded-2xl bg-card/60 backdrop-blur-md border border-red-500/40 flex flex-col"
                  style={{ animation: `fade-in 0.5s ease-out ${i * 80}ms both` }}
                >
                  {photo && <img src={photo} alt="" className="w-full h-40 object-cover" loading="lazy" />}
                  <div className="p-5 flex-1 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-xl font-bold truncate">{c.titulo || c.numero || "Contenção"}</h3>
                      <span className="text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-400 font-semibold uppercase">{c.status}</span>
                    </div>
                    <p className="text-base text-muted-foreground line-clamp-2">{c.part_number} · {c.fornecedor || ""}</p>
                    {c.descricao && <p className="text-sm text-muted-foreground line-clamp-2">{c.descricao}</p>}
                  </div>
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500" />
                </div>
              );
            })}
          </div>
        );
      case "consumiveis": {
        const maxQty = Math.max(...criticalConsum.map((c) => c.min_qty || 1), 1);
        return (
          <div className="w-full h-full overflow-hidden rounded-2xl bg-card/60 backdrop-blur-md border border-border/60 p-6">
            {criticalConsum.length === 0 ? (
              <div className="h-full flex items-center justify-center text-3xl text-muted-foreground">Estoque saudável ✅</div>
            ) : (
              <ul className="space-y-4 h-full overflow-y-auto pr-2">
                {criticalConsum.map((c, i) => {
                  const pct = Math.min(100, ((c.stock_qty ?? 0) / Math.max(c.min_qty || 1, 1)) * 100);
                  return (
                    <li key={c.id} className="space-y-2" style={{ animation: `fade-in 0.4s ease-out ${i * 60}ms both` }}>
                      <div className="flex items-center justify-between">
                        <span className="text-xl font-semibold">{c.name}</span>
                        <span className="text-2xl font-black text-red-500 tabular-nums">{c.stock_qty} / {c.min_qty} {c.unit || ""}</span>
                      </div>
                      <div className="h-3 rounded-full bg-muted/40 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-red-600 via-red-500 to-orange-400 transition-all duration-700" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      }
      case "ranking": {
        const max = Math.max(...supplierRanking.map((s) => s.ng), 1);
        return (
          <div className="w-full h-full overflow-hidden rounded-2xl bg-card/60 backdrop-blur-md border border-border/60 p-6">
            <ol className="space-y-3 h-full overflow-y-auto pr-2">
              {supplierRanking.length === 0 && <li className="h-full flex items-center justify-center text-3xl text-muted-foreground">Sem dados no período.</li>}
              {supplierRanking.map((s, i) => (
                <li key={s.fornecedor} className="grid grid-cols-[3rem_1fr_auto] items-center gap-4" style={{ animation: `fade-in 0.4s ease-out ${i * 70}ms both` }}>
                  <span className={cn("text-3xl font-black text-center", i === 0 ? "text-yellow-400" : i === 1 ? "text-zinc-300" : i === 2 ? "text-amber-700" : "text-muted-foreground")}>{i + 1}</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-lg truncate">{s.fornecedor}</p>
                    <div className="h-2.5 rounded-full bg-muted/40 overflow-hidden mt-1">
                      <div className="h-full bg-gradient-to-r from-red-600 to-amber-500 transition-all duration-700" style={{ width: `${(s.ng / max) * 100}%` }} />
                    </div>
                  </div>
                  <span className="text-3xl font-black text-red-500 tabular-nums">{fmtNum(s.ng)}</span>
                </li>
              ))}
            </ol>
          </div>
        );
      }
      case "defects":
        return (
          <div className="w-full h-full overflow-hidden rounded-2xl bg-card/60 backdrop-blur-md border border-border/60 p-6">
            {defectsData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-3xl text-muted-foreground">Sem defeitos no período.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={defectsData} layout="vertical" margin={{ left: 120, right: 40, top: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={14} />
                  <YAxis dataKey="name" type="category" width={180} stroke="hsl(var(--muted-foreground))" fontSize={14} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} isAnimationActive animationDuration={800}>
                    {defectsData.map((_, i) => <Cell key={i} fill={`hsl(${10 + i * 8}, 85%, ${55 - i * 2}%)`} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        );
    }
  };

  const slideAnimation = direction === 1
    ? "animate-[slide-in-right_0.55s_ease-out]"
    : "animate-[slide-in-left_0.55s_ease-out]";

  const meta = currentBlock ? BLOCK_META[currentBlock] : null;
  const Icon = meta?.icon;

  return (
    <div
      data-testid="monitor-root"
      className={cn(
        "fixed inset-0 flex flex-col overflow-hidden group",
        prefs.theme === "dark"
          ? "bg-gradient-to-br from-[hsl(220,25%,6%)] via-[hsl(220,25%,9%)] to-[hsl(230,30%,12%)] text-foreground"
          : "bg-background text-foreground",
      )}
    >
      {/* Local keyframes for slide-in-left (slide-in-right exists in tailwind config) */}
      <style>{`
        @keyframes slide-in-left { 0% { transform: translateX(-100%); opacity: 0 } 100% { transform: translateX(0); opacity: 1 } }
        @keyframes ken-burns { 0% { transform: scale(1) translate(0,0) } 100% { transform: scale(1.04) translate(-1%, -1%) } }
        .ken-burns { animation: ken-burns 12s ease-in-out alternate infinite; }
        @keyframes ticker { 0% { transform: translateX(0) } 100% { transform: translateX(-50%) } }
      `}</style>

      {/* Ambient gradient backdrop reacting to current block */}
      {meta && (
        <div
          key={`bg-${safeIdx}`}
          className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60 transition-opacity duration-700", meta.gradient)}
        />
      )}

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-border/40 backdrop-blur-md bg-background/40">
        <div className="flex items-center gap-4">
          {Icon && <Icon className={cn("w-9 h-9", meta!.accent)} />}
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Monitor de Qualidade · {periodLabel}</p>
            <h1 className="text-3xl xl:text-4xl font-heading font-black tracking-tight">{meta?.title ?? "—"}</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Slide progress dots */}
          <div className="hidden md:flex items-center gap-1.5 mr-2">
            {blocks.map((_, i) => (
              <button
                key={i}
                onClick={() => { setDirection(i > safeIdx ? 1 : -1); setSlideIdx(i); }}
                className={cn("h-1.5 rounded-full transition-all", i === safeIdx ? "w-10 bg-primary" : "w-3 bg-muted-foreground/40 hover:bg-muted-foreground")}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
          <Button variant="ghost" size="icon" onClick={goPrev} className="opacity-30 hover:opacity-100"><ChevronLeft className="w-5 h-5" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setPaused((p) => !p)} className="opacity-30 hover:opacity-100">
            {paused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={goNext} className="opacity-30 hover:opacity-100"><ChevronRight className="w-5 h-5" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)} className="opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Configurações do monitor">
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Auto-advance progress bar */}
      {!paused && blocks.length > 1 && (
        <div className="relative z-10 h-1 bg-muted/30">
          <div
            key={`pb-${safeIdx}-${rangeKey}`}
            className="h-full bg-gradient-to-r from-primary via-cyan-400 to-primary"
            style={{ animation: `slide-in-right ${SLIDE_DURATION_MS}ms linear forwards`, transformOrigin: "left" }}
          />
        </div>
      )}

      {/* Realtime flash banner */}
      {flash && (
        <div className={cn(
          "relative z-20 mx-8 mt-4 rounded-xl border px-5 py-3 flex items-center gap-3 animate-[slide-in-right_0.4s_ease-out]",
          flash.type === "alert" ? "bg-amber-500/15 border-amber-500/50 text-amber-200" : "bg-red-500/15 border-red-500/50 text-red-200",
        )}>
          <AlertTriangle className="w-5 h-5 animate-pulse" />
          <span className="font-semibold uppercase tracking-wider text-xs">{flash.type === "alert" ? "Novo alerta" : "Nova contenção"}</span>
          <span className="text-base truncate">{flash.title}</span>
        </div>
      )}

      {/* Main slide area */}
      <main data-testid="monitor-grid" className="relative z-10 flex-1 min-h-0 p-8 overflow-hidden">
        {blocks.length === 0 ? (
          <div className="h-full flex items-center justify-center text-2xl text-muted-foreground">
            Nenhum bloco selecionado.
            <Button className="ml-4" onClick={() => setShowSettings(true)}>Configurar</Button>
          </div>
        ) : (
          <div key={`${currentBlock}-${safeIdx}`} className={cn("w-full h-full", slideAnimation)}>
            {currentBlock && renderSlide(currentBlock)}
          </div>
        )}
      </main>

      {/* Live ticker of recent NGs */}
      {apontamentos.length > 0 && (
        <div className="relative z-10 overflow-hidden border-t border-border/40 bg-background/60 backdrop-blur-md py-2">
          <div className="flex gap-12 whitespace-nowrap" style={{ animation: "ticker 45s linear infinite", width: "max-content" }}>
            {[...apontamentos.slice(0, 20), ...apontamentos.slice(0, 20)].map((a, i) => (
              <span key={i} className="flex items-center gap-2 text-sm">
                <span className="font-mono text-muted-foreground">{a.numero || "—"}</span>
                <span className="uppercase text-xs px-2 py-0.5 rounded bg-muted/50">{a.tipo}</span>
                <span className="font-semibold">{a.part_number || "—"}</span>
                <span className="text-muted-foreground">· {a.fornecedor || "—"}</span>
                <span className={cn("font-black", a.quantidade_ng > 0 ? "text-red-500" : "text-emerald-400")}>NG {a.quantidade_ng || 0}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="relative z-10 flex items-center justify-between px-8 py-3 border-t border-border/40 bg-background/60 backdrop-blur-md text-sm">
        <span className="font-mono text-base">
          {now.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })} · <span className="font-bold">{now.toLocaleTimeString("pt-BR")}</span>
        </span>
        <span className="text-muted-foreground text-xs uppercase tracking-widest hidden md:inline">
          Slide {safeIdx + 1} / {blocks.length} · {paused ? "Pausado" : `Auto ${SLIDE_DURATION_MS / 1000}s`}
        </span>
        <span data-testid="monitor-conn" data-state={conn} className="flex items-center gap-2">
          {conn === "connected" && (<><Wifi className="w-4 h-4 text-emerald-500" /><span className="text-emerald-500">Conectado</span></>)}
          {conn === "connecting" && (<><Loader2 className="w-4 h-4 text-amber-500 animate-spin" /><span className="text-amber-500">Conectando…</span></>)}
          {conn === "error" && (<><WifiOff className="w-4 h-4 text-red-500" /><span className="text-red-500">Sem conexão</span></>)}
          <span className={cn("inline-block w-2.5 h-2.5 rounded-full",
            conn === "connected" && "bg-emerald-500 animate-pulse",
            conn === "connecting" && "bg-amber-500 animate-pulse",
            conn === "error" && "bg-red-500")} />
        </span>
      </footer>

      <MonitorDialog open={showSettings} onOpenChange={setShowSettings} initial={prefs} confirmLabel="Aplicar" onConfirm={(p) => { setPrefs(p); setSlideIdx(0); }} />
    </div>
  );
};

export default Monitor;
