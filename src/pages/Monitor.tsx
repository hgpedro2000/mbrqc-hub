import { useEffect, useMemo, useState, useCallback, ReactNode, useRef } from "react";
import { useNavigate } from "react-router-dom";
// IMPORTANT: /monitor uses a dedicated anon-only Supabase client (no session
// persistence). It must NOT import the main `supabase` client nor any auth
// listener/hook — the monitor session is independent of the main app login.
import { monitorClient as supabase } from "@/integrations/supabase/monitor-client";
import { MonitorDialog, loadPrefs, loadGlobalPrefs, savePrefs, MonitorPreferences, MonitorBlock, getBlockSlideConfig, descStyleClasses, defaultPrefs } from "@/components/apontamento/MonitorDialog";
import {
  Settings, Wifi, WifiOff, Loader2, ChevronLeft, ChevronRight, Pause, Play,
  AlertTriangle, CheckCircle2, TrendingUp, Package, ShieldAlert, Trophy,
  BarChart3, ListChecks, Maximize2, Minimize2, X, LogOut,
  Megaphone, Wrench, Microscope, RefreshCw, CalendarRange,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Cell, LabelList, AreaChart, Area, PieChart, Pie, Legend } from "recharts";
import { cn } from "@/lib/utils";
import { useKioskMode } from "@/hooks/useKioskMode";

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

const DEFAULT_slideDurationMs = 10000;
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
  retrabalhos:    { title: "Retrabalhos em Andamento",             icon: RefreshCw,     accent: "text-amber-400",    gradient: "from-amber-500/20 via-transparent to-orange-500/20" },
  ultimos_defeitos:{ title: "Últimos Defeitos Detectados",        icon: Microscope,    accent: "text-rose-400",     gradient: "from-rose-500/20 via-transparent to-red-500/20" },
  resumo_acumulado:{ title: "Resumo Acumulado do Mês",            icon: CalendarRange, accent: "text-emerald-400",  gradient: "from-emerald-500/20 via-transparent to-cyan-500/20" },
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

// --- SplitFlap digit (airport-board style two-half flip) ---
// Each character change flips through intermediate characters like a real
// airport board. For digits we step 0→1→2…→target; for other chars we step
// through a small set until we reach the target. Each step does a two-half flip
// (top of OLD drops down, then bottom of NEW rises up). Per-digit `delayMs`
// enables a left-to-right cascade on first paint.
// Dynamic flap speed — controlled by Monitor preferences (flapSpeedMs).
// Default 70ms half-flip; readers below pull live value each render so the
// global slider effect is felt immediately by every digit.
let CURRENT_FLAP_HALF_MS = 70;
export const setFlapHalfMs = (n: number) => {
  CURRENT_FLAP_HALF_MS = Math.max(15, Math.min(400, Math.round(n)));
};
const flapHalfMs = () => CURRENT_FLAP_HALF_MS;
const flapStepMs = () => CURRENT_FLAP_HALF_MS * 2;
const FLAP_CASCADE_MS = 90;


// Inject keyframes once.
if (typeof document !== "undefined" && !document.getElementById("splitflap-keyframes")) {
  const s = document.createElement("style");
  s.id = "splitflap-keyframes";
  s.textContent = `
    @keyframes splitflap-top    { 0% { transform: rotateX(0deg);  } 100% { transform: rotateX(-90deg); } }
    @keyframes splitflap-bottom { 0% { transform: rotateX(90deg); } 100% { transform: rotateX(0deg);   } }
  `;
  document.head.appendChild(s);
}

// Build the ordered flip sequence from `from` → `to`.
const DIGIT_SEQ = "0123456789";
const ALPHA_SEQ = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:-/+%";
const buildFlipPath = (from: string, to: string): string[] => {
  if (from === to) return [];
  const isD = /[0-9]/.test(from) && /[0-9]/.test(to);
  const seq = isD ? DIGIT_SEQ : ALPHA_SEQ;
  const a = seq.indexOf(from);
  const b = seq.indexOf(to);
  if (a < 0 || b < 0) return [to];
  const len = seq.length;
  const steps: string[] = [];
  let i = a;
  // Always go forward (wrap around) — like a real flap board.
  while (i !== b) {
    i = (i + 1) % len;
    steps.push(seq[i]);
  }
  return steps;
};

const SplitFlapDigit = ({ ch, size, delayMs = 0 }: { ch: string; size: number; delayMs?: number }) => {
  const isDigit = /[0-9]/.test(ch);
  const w = isDigit ? size * 0.7 : size * 0.45;
  const h = size;
  const halfH = h / 2;
  const fontSize = size * 0.72;

  // Digits start at "0" so first paint counts up from zero; non-digits show as-is.
  const [current, setCurrent] = useState(() => (isDigit ? "0" : ch));
  const [next, setNext] = useState<string | null>(null);
  const [flipKey, setFlipKey] = useState(0);
  const timersRef = useRef<number[]>([]);
  const chRef = useRef(ch);
  const currentRef = useRef(current);
  currentRef.current = current;

  useEffect(() => {
    chRef.current = ch;
    if (ch === currentRef.current && next === null) return;
    // Cancel any pending steps and restart from whatever is currently shown.
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current = [];

    const run = () => {
      if (chRef.current !== ch) return;
      const path = buildFlipPath(currentRef.current, ch);
      if (path.length === 0) {
        setNext(null);
        return;
      }
      let idx = 0;
      const step = () => {
        if (chRef.current !== ch) return;
        const target = path[idx];
        setNext(target);
        setFlipKey((k) => k + 1);
        const commitId = window.setTimeout(() => {
          setCurrent(target);
          currentRef.current = target;
          idx += 1;
          if (idx < path.length) {
            step();
          } else {
            setNext(null);
          }
        }, flapStepMs());
        timersRef.current.push(commitId);
      };
      step();
    };

    const startId = window.setTimeout(run, delayMs);
    timersRef.current.push(startId);

    return () => {
      timersRef.current.forEach((id) => clearTimeout(id));
      timersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ch]);

  const animating = next !== null && next !== current;
  const bgTop = animating ? next! : current;
  const bgBottom = current;

  const half: React.CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    height: halfH,
    overflow: "hidden",
    background: "#0a0a0a",
    color: "#fff",
    display: "block",
    textAlign: "center",
    fontSize,
  };
  const innerFull: React.CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    height: h,
    lineHeight: `${h}px`,
    textAlign: "center",
    fontSize,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontWeight: 900,
  };

  return (
    <span
      className="relative inline-block rounded-md border border-white/15 shadow-inner align-middle"
      style={{ width: w, height: h, perspective: 400, background: "#0a0a0a", verticalAlign: "middle" }}
    >
      <span style={{ ...half, top: 0, borderBottom: "1px solid rgba(255,255,255,0.18)" }}>
        <span style={{ ...innerFull, top: 0 }}>{bgTop}</span>
      </span>
      <span style={{ ...half, bottom: 0 }}>
        <span style={{ ...innerFull, bottom: 0 }}>{bgBottom}</span>
      </span>

      {animating && (
        <>
          <span
            key={`t${flipKey}`}
            style={{
              ...half,
              top: 0,
              borderBottom: "1px solid rgba(255,255,255,0.18)",
              transformOrigin: "bottom",
              animation: `splitflap-top ${flapHalfMs()}ms ease-in forwards`,
              backfaceVisibility: "hidden",
              zIndex: 2,
            }}
          >
            <span style={{ ...innerFull, top: 0 }}>{current}</span>
          </span>
          <span
            key={`b${flipKey}`}
            style={{
              ...half,
              bottom: 0,
              transformOrigin: "top",
              transform: "rotateX(90deg)",
              animation: `splitflap-bottom ${flapHalfMs()}ms ease-out ${flapHalfMs()}ms forwards`,
              backfaceVisibility: "hidden",
              zIndex: 2,
            }}
          >
            <span style={{ ...innerFull, bottom: 0 }}>{next!}</span>
          </span>
        </>
      )}
    </span>
  );
};

export const SplitFlapNumber = ({ value, size = 80, cascadeMs = FLAP_CASCADE_MS, gapPx = 2 }: { value: number; size?: number; cascadeMs?: number; gapPx?: number }) => {
  const str = fmtNum(value);
  return (
    <span className="inline-flex items-center align-middle" style={{ lineHeight: 1, gap: `${gapPx}px` }}>
      {str.split("").map((ch, i) => (
        <SplitFlapDigit key={i} ch={ch} size={size} delayMs={i * cascadeMs} />
      ))}
    </span>
  );
};

// Split-flap text: each character (letter/digit) flips like an airport board.
// Uppercases input so it maps onto the ALPHA_SEQ flip path.
export const SplitFlapText = ({
  value,
  size = 22,
  cascadeMs = 60,
  maxChars,
  className,
  gapPx = 2,
}: { value: string; size?: number; cascadeMs?: number; maxChars?: number; className?: string; gapPx?: number }) => {
  let str = (value || "").toUpperCase();
  if (maxChars && str.length > maxChars) str = str.slice(0, maxChars);
  return (
    <span className={cn("inline-flex items-center align-middle", className)} style={{ lineHeight: 1, gap: `${gapPx}px` }}>
      {str.split("").map((ch, i) => (
        <SplitFlapDigit key={i} ch={ch} size={size} delayMs={i * cascadeMs} />
      ))}
    </span>
  );
};


// --- Rotating parts list for supplier cards ---
// Persist rotation index across remounts (slide visits) so the user picks up
// where the last view left off when there are many parts to read.
type InspPart = { part_number: string; part_name: string; qty: number };
const rotationIndexStore = new Map<string, number>();

const RotatingParts = ({
  parts,
  qtySize,
  perGroup = 2,
  fontScale = 1,
  intervalMs,
  postFlapDelayMs = 0,
  gapPx = 2,
  storageKey,
}: {
  parts: InspPart[];
  qtySize: number;
  perGroup?: number;
  fontScale?: number;
  intervalMs?: number;
  postFlapDelayMs?: number;
  gapPx?: number;
  storageKey: string;
}) => {
  const groups = useMemo(() => {
    const step = Math.max(1, perGroup);
    const out: InspPart[][] = [];
    for (let i = 0; i < parts.length; i += step) out.push(parts.slice(i, i + step));
    return out;
  }, [parts, perGroup]);
  const total = groups.length;
  const fullKey = `${storageKey}::${perGroup}::${total}`;
  const interval = Math.max(
    2000,
    intervalMs ?? (total <= 4 ? 4000 : Math.floor(16000 / total)),
  );

  const [idx, setIdx] = useState(() => {
    const saved = rotationIndexStore.get(fullKey) ?? 0;
    return total > 0 ? saved % total : 0;
  });
  const [phase, setPhase] = useState<"enter" | "visible" | "exit">("visible");

  // Reset only when the group shape changes (not on every mount), so a fresh
  // visit to the slide resumes from the saved index for the same supplier+config.
  useEffect(() => {
    const saved = rotationIndexStore.get(fullKey) ?? 0;
    setIdx(total > 0 ? saved % total : 0);
    setPhase("visible");
  }, [fullKey, total]);

  // Persist idx whenever it changes.
  useEffect(() => {
    rotationIndexStore.set(fullKey, idx);
  }, [fullKey, idx]);

  // Enter → visible on next frame so CSS transitions fire.
  useEffect(() => {
    if (phase !== "enter") return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setPhase("visible")));
    return () => cancelAnimationFrame(id);
  }, [phase, idx]);

  // Rotation timer — count `interval` ms AFTER the split-flap finishes settling
  // on the new group, so users always get a guaranteed reading window.
  useEffect(() => {
    if (total <= 1) return;
    if (phase !== "visible") return;
    const currentGroup = groups[idx] || [];
    const maxChars = currentGroup.reduce((m, p) => {
      const a = (p.part_number || "").length;
      const b = (p.part_name || "").length;
      const c = String(p.qty ?? "").length;
      return Math.max(m, a, b, c);
    }, 1);
    // Settle ≈ longest cascade + a few flap half-flips for the path.
    const settleMs = maxChars * FLAP_CASCADE_MS + flapHalfMs() * 2 * 5;
    const totalDelay = settleMs + Math.max(0, postFlapDelayMs) + interval;
    const startExit = window.setTimeout(() => {
      setPhase("exit");
      window.setTimeout(() => {
        setIdx((i) => (i + 1) % total);
        setPhase("enter");
      }, 400);
    }, totalDelay);
    return () => clearTimeout(startExit);
  }, [total, interval, postFlapDelayMs, phase, idx, groups]);

  const current = groups[idx] || [];
  const cls =
    phase === "enter" ? "opacity-0 translate-y-5" :
    phase === "exit"  ? "opacity-0 -translate-y-5" :
                        "opacity-100 translate-y-0";

  return (
    <>
      <ul className="flex-1 overflow-hidden mt-2 divide-y divide-border/30 relative">
        <div className={cn("transition-all duration-[400ms] ease-out", cls)}>
          {current.map((p, i) => (
            <li key={`${idx}-${p.part_number}-${i}`} className="grid grid-cols-[1fr_auto] items-center gap-4 py-2">
              <div className="min-w-0">
                <SplitFlapText value={p.part_number} size={Math.round(26 * fontScale)} maxChars={16} className="font-mono" gapPx={gapPx} />
                {p.part_name && <div className="mt-1.5"><SplitFlapText value={p.part_name} size={Math.round(18 * fontScale)} maxChars={26} className="text-muted-foreground" gapPx={gapPx} /></div>}
              </div>
              <SplitFlapNumber value={p.qty} size={qtySize} gapPx={gapPx} />
            </li>
          ))}
        </div>
      </ul>
      {total > 1 && (
        <div className="absolute bottom-2 right-3 flex gap-1.5 z-10">
          {groups.map((_, i) => (
            <span
              key={i}
              className={cn(
                "rounded-full transition-all duration-300",
                i === idx ? "w-2.5 h-2.5 bg-cyan-400" : "w-2 h-2 bg-white/25",
              )}
            />
          ))}
        </div>
      )}
    </>
  );
};




const Monitor = () => {
  // Preview-embed mode: when ?preview=<blockId>&chrome=off is set, render a single
  // block without header/footer/ticker and without auto-fullscreen — so the page can be
  // safely iframed from the MonitorDialog preview.
  const _qp = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const previewBlock = _qp.get("preview") as MonitorBlock | null;
  const chromeOff = _qp.get("chrome") === "off";
  const isPreviewMode = !!previewBlock;

  const [prefs, setPrefs] = useState<MonitorPreferences>(() => {
    const base = loadPrefs();
    if (previewBlock) {
      return { ...base, blocks: [previewBlock] };
    }
    return base;
  });

  // Fetch shared default preferences (saved by admin) once on mount and apply
  // them — so every profile sees what the admin defined as the default layout.
  useEffect(() => {
    if (isPreviewMode) return;
    let cancelled = false;
    void loadGlobalPrefs().then((g) => {
      if (cancelled || !g) return;
      savePrefs(g);
      setPrefs(g);
      setSlideIdx(0);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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

  const systemReducedMotion = useReducedMotion();
  const globalAnimationsEnabled = prefs.animationsEnabled ?? true;
  const globalSlideDurationMs = prefs.slideDurationMs ?? DEFAULT_slideDurationMs;

  const { isFs, toggle: toggleFullscreen } = useFullscreen();
  const navigate = useNavigate();
  const autoFsTried = useRef(false);
  const [needsFsGesture, setNeedsFsGesture] = useState(false);

  const [apontamentos, setApontamentos] = useState<any[]>([]);
  const [alertas, setAlertas] = useState<any[]>([]);
  const [contencoes, setContencoes] = useState<any[]>([]);
  const [consumiveis, setConsumiveis] = useState<any[]>([]);
  const [slidesMedia, setSlidesMedia] = useState<any[]>([]);
  const [ngPhotos, setNgPhotos] = useState<Record<string, string[]>>({});
  const [apontamentosMonth, setApontamentosMonth] = useState<any[]>([]);
  const isV2 = true;

  const range = useMemo(() => periodRange(prefs), [prefs.period, prefs.customFrom, prefs.customTo]);
  const rangeKey = `${range.start.toISOString()}|${range.end?.toISOString() ?? ""}`;

  // Kiosk Lockdown — blindado. Activated on /monitor (skipped in preview iframe).
  const { isKioskMode, enterKiosk, exitKiosk, enterFullscreen } = useKioskMode(false);

  // Auto-enter fullscreen + kiosk lockdown on mount; if the browser blocks
  // fullscreen (no gesture), show a one-tap prompt while kiosk listeners stay armed.
  useEffect(() => {
    if (isPreviewMode) return;
    if (autoFsTried.current) return;
    autoFsTried.current = true;
    (async () => {
      await enterKiosk();
      if (!document.fullscreenElement) setNeedsFsGesture(true);
    })();
  }, [isPreviewMode, enterKiosk]);

  useEffect(() => {
    if (isFs) setNeedsFsGesture(false);
  }, [isFs]);

  const exitMonitor = async () => {
    const ok = window.confirm("Deseja realmente sair do Monitor? A janela será fechada.");
    if (!ok) return;
    // Single exit point — fully tear down kiosk lockdown before closing.
    await exitKiosk();
    try { window.close(); } catch { /* noop */ }
    setTimeout(() => {
      if (!window.closed) {
        if (window.history.length > 1) window.history.back();
        else navigate("/apontamentos");
      }
    }, 100);
  };


  useEffect(() => {
    const root = document.documentElement;
    const had = root.classList.contains("dark");
    if (prefs.theme === "dark") root.classList.add("dark");
    return () => { if (!had && prefs.theme === "dark") root.classList.remove("dark"); };
  }, [prefs.theme]);

  // Sync split-flap speed from prefs.
  useEffect(() => {
    setFlapHalfMs(prefs.flapSpeedMs ?? 70);
  }, [prefs.flapSpeedMs]);

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
      const { data } = await supabase.from("contencao").select("*").order("created_at", { ascending: false }).limit(100);
      if (data) setContencoes(data);
    } else if (table === "consumable_items") {
      const { data } = await supabase.from("consumable_items").select("*").eq("active", true);
      if (data) setConsumiveis(data);
    } else if (table === "monitor_slides_media") {
      const { data } = await supabase.from("monitor_slides_media").select("*").eq("ativo", true).order("ordem", { ascending: true });
      if (data) setSlidesMedia(data);
    }
    setLastFetchAt((prev) => ({ ...prev, [table]: Date.now() }));
  };

  useEffect(() => {
    Promise.all([fetchTable("apontamentos"), fetchTable("alertas_qualidade"), fetchTable("contencao"), fetchTable("consumable_items"), fetchTable("monitor_slides_media")]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey]);

  // Monthly accumulated apontamentos for the "resumo_acumulado" slide.
  // Refetched daily (or on realtime apontamento changes).
  const fetchMonth = useCallback(async () => {
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString();
    const { data } = await supabase
      .from("apontamentos")
      .select("created_at,fornecedor,turno,modo_falha,quantidade_ng,quantidade_inspecionada,quantidade")
      .gte("created_at", start).lt("created_at", end);
    if (data) setApontamentosMonth(data);
  }, []);
  useEffect(() => {
    if (!prefs.blocks.includes("resumo_acumulado")) return;
    fetchMonth();
    const id = setInterval(fetchMonth, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [prefs.blocks, fetchMonth]);

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
      .on("postgres_changes", { event: "*", schema: "public", table: "apontamentos" }, () => { debouncedRefetch("apontamentos"); fetchMonth(); })
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

  // Resolve signed URLs for monitor-comunicados media (bucket is private but has anon-read RLS).
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const updates: Record<string, string> = {};
      for (const m of slidesMedia) {
        if (mediaUrls[m.file_path]) continue;
        const { data } = await supabase.storage.from("monitor-comunicados").createSignedUrl(m.file_path, 60 * 60 * 6);
        if (data?.signedUrl) updates[m.file_path] = data.signedUrl;
      }
      if (!cancelled && Object.keys(updates).length) setMediaUrls((prev) => ({ ...prev, ...updates }));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slidesMedia]);

  // Fetch NG checklist_photos for "Últimos Defeitos Detectados"
  const ngApontamentos = useMemo(
    () => apontamentos.filter((a) => (a.quantidade_ng || 0) > 0).slice(0, 12),
    [apontamentos]
  );
  useEffect(() => {
    if (!ngApontamentos.length) return;
    let cancelled = false;
    (async () => {
      const ids = ngApontamentos.map((a) => a.id);
      const { data } = await supabase
        .from("checklist_photos")
        .select("checklist_id,file_path")
        .eq("checklist_type", "apontamento")
        .in("checklist_id", ids);
      if (!data || cancelled) return;
      const byId: Record<string, string[]> = {};
      for (const ph of data) {
        const { data: signed } = await supabase.storage.from("checklist-photos").createSignedUrl(ph.file_path, 60 * 60 * 6);
        if (signed?.signedUrl) {
          (byId[ph.checklist_id] ||= []).push(signed.signedUrl);
        }
      }
      if (!cancelled) setNgPhotos(byId);
    })();
    return () => { cancelled = true; };
  }, [ngApontamentos]);

  const blocks = prefs.blocks;
  const safeIdx = blocks.length ? slideIdx % blocks.length : 0;
  const currentBlock = blocks[safeIdx];
  const nextBlock = blocks.length ? blocks[(safeIdx + 1) % blocks.length] : undefined;

  // Per-slide effective config (duration + animations override globals)
  const { durationMs: slideDurationMs, animations: blockAnimations } = currentBlock
    ? getBlockSlideConfig(prefs, currentBlock)
    : { durationMs: globalSlideDurationMs, animations: globalAnimationsEnabled };
  const reducedMotion = systemReducedMotion || !blockAnimations;

  // Pause slideshow when modal/settings open
  const isPaused = paused || !!photoSource || showSettings;

  useEffect(() => {
    if (isPaused || blocks.length <= 1) return;
    const id = setInterval(() => {
      setDirection(1);
      setSlideIdx((i) => (i + 1) % blocks.length);
    }, slideDurationMs);
    return () => clearInterval(id);
  }, [isPaused, blocks.length, slideDurationMs]);

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
                  {isV2 && <th className="text-right py-5 px-5">Rate Aprov.</th>}
                  <th className="text-right py-5 px-5">Hora</th>
                </tr>
              </thead>
              <tbody>
                {apontamentos.slice(0, isV2 ? 10 : 11).map((a, i) => {
                  const insp = a.quantidade_inspecionada || a.quantidade || 0;
                  const ok = a.quantidade_ok ?? Math.max(insp - (a.quantidade_ng || 0), 0);
                  const rate = insp > 0 ? (ok / insp) * 100 : 0;
                  const rateColor = rate >= 98 ? "text-emerald-400" : rate >= 90 ? "text-amber-400" : "text-red-500";
                  return (
                    <tr key={a.id} className="border-t border-border/40" style={reducedMotion ? undefined : { animation: `fade-in 0.4s ease-out ${i * 60}ms both` }}>
                      <td className="py-4 px-5 font-mono text-xl">{a.numero || "—"}</td>
                      <td className="py-4 px-5 truncate max-w-[260px]">{a.part_number || "—"}</td>
                      <td className="py-4 px-5 truncate max-w-[280px]">{a.fornecedor || "—"}</td>
                      <td className="py-4 px-5 truncate max-w-[300px] text-amber-300">{(a.modo_falha || "—").replace(/^\s*\d+\s*-\s*/, "")}</td>
                      <td className="py-4 px-5 text-right font-bold tabular-nums text-cyan-300">{fmtNum(insp)}</td>
                      <td className="py-4 px-5 text-right font-bold tabular-nums text-emerald-400">{fmtNum(ok)}</td>
                      <td className={cn("py-4 px-5 text-right font-black text-3xl tabular-nums", a.quantidade_ng > 0 ? "text-red-500" : "text-emerald-400")}>{a.quantidade_ng || 0}</td>
                      {isV2 && (
                        <td className={cn("py-4 px-5 text-right font-black text-2xl tabular-nums", rateColor)}>
                          {insp > 0 ? `${rate.toFixed(1)}%` : "—"}
                        </td>
                      )}
                      <td className="py-4 px-5 text-right text-xl text-muted-foreground">{new Date(a.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
                    </tr>
                  );
                })}
                {apontamentos.length === 0 && (
                  <tr><td colSpan={isV2 ? 9 : 8} className="text-center py-20 text-4xl text-muted-foreground">Sem registros no período.</td></tr>
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
      case "contencao": {
        const ativas = contencoes.filter((c) => ["aberta", "em_andamento", "iniciada", "ativo"].includes(c.status));
        const finalizadas = contencoes.filter((c) => ["concluida", "encerrada", "fechada", "cancelada"].includes(c.status));
        if (!isV2) {
          const list = ativas.slice(0, 6);
          return (
            <div className="grid grid-cols-3 grid-rows-2 gap-6 w-full h-full">
              {list.length === 0 && <div className="col-span-3 row-span-2 flex items-center justify-center text-5xl text-muted-foreground">Nenhuma contenção ativa.</div>}
              {list.map((c, i) => {
                const photos = allPhotos(c);
                const photo = photos[0];
                const hasPhotos = photos.length > 0;
                return (
                  <div key={c.id} onClick={() => hasPhotos && openPhotoModal(c, "contencao")} className={cn("relative overflow-hidden rounded-2xl bg-card/60 backdrop-blur-md border border-red-500/40 flex flex-col", hasPhotos && "cursor-pointer transition-transform hover:scale-[1.02]")} style={reducedMotion ? undefined : { animation: `fade-in 0.5s ease-out ${i * 80}ms both` }}>
                    {photo && <img src={photo} alt="" className="w-full h-44 object-cover" loading="lazy" />}
                    <div className="p-5 flex-1 flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-3"><h3 className="text-2xl font-bold truncate">{c.titulo || c.numero || "Contenção"}</h3><span className="text-base px-3 py-1 rounded-full bg-red-500/20 text-red-400 font-semibold uppercase">{c.status}</span></div>
                      <p className="text-xl text-muted-foreground line-clamp-2">{c.part_number} · {c.fornecedor || ""}</p>
                    </div>
                    <div className="absolute left-0 top-0 bottom-0 w-2 bg-red-500" />
                  </div>
                );
              })}
            </div>
          );
        }
        const Row = ({ c, i, color }: { c: any; i: number; color: string }) => (
          <li key={c.id}
              onClick={() => allPhotos(c).length && openPhotoModal(c, "contencao")}
              className={cn("grid grid-cols-[auto_1fr_auto] items-center gap-4 py-3 px-4 rounded-xl border", color, "bg-card/40 hover:bg-card/70 cursor-pointer")}
              style={reducedMotion ? undefined : { animation: `slide-in-right 0.45s ease-out ${i * 60}ms both` }}>
            <span className="font-mono text-lg text-muted-foreground">{c.numero || "—"}</span>
            <div className="min-w-0">
              <p className="text-xl font-bold truncate">{c.titulo || "Contenção"}</p>
              <p className="text-sm text-muted-foreground truncate">{c.part_number} · {c.fornecedor || "—"}</p>
            </div>
            <span className="text-xs uppercase tracking-wider px-2 py-1 rounded-full bg-background/60 font-semibold">{c.status}</span>
          </li>
        );
        return (
          <div className="grid grid-cols-2 gap-6 w-full h-full">
            <div className="rounded-3xl bg-card/60 backdrop-blur-md border border-red-500/30 p-6 flex flex-col">
              <h3 className="text-2xl font-bold mb-3 flex items-center gap-2 text-red-400"><ShieldAlert className="w-7 h-7 animate-pulse" /> Em Andamento ({ativas.length})</h3>
              <ul className="space-y-2 overflow-hidden flex-1">
                {ativas.length === 0 && <li className="h-full flex items-center justify-center text-2xl text-muted-foreground">Nenhuma</li>}
                {ativas.slice(0, 10).map((c, i) => <Row key={c.id} c={c} i={i} color="border-red-500/30" />)}
              </ul>
            </div>
            <div className="rounded-3xl bg-card/60 backdrop-blur-md border border-emerald-500/30 p-6 flex flex-col">
              <h3 className="text-2xl font-bold mb-3 flex items-center gap-2 text-emerald-400"><CheckCircle2 className="w-7 h-7" /> Finalizadas ({finalizadas.length})</h3>
              <ul className="space-y-2 overflow-hidden flex-1">
                {finalizadas.length === 0 && <li className="h-full flex items-center justify-center text-2xl text-muted-foreground">Nenhuma</li>}
                {finalizadas.slice(0, 10).map((c, i) => <Row key={c.id} c={c} i={i} color="border-emerald-500/30" />)}
              </ul>
            </div>
          </div>
        );
      }
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
          <div className="w-full h-full overflow-hidden rounded-3xl bg-card/60 backdrop-blur-md border border-border/60 px-8 py-6 flex flex-col">
            <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_6rem_5rem_9rem] gap-4 text-xs uppercase tracking-wider text-muted-foreground pb-2 border-b border-border/40 tabular-nums">
              <span className="text-center">#</span>
              <span>Fornecedor</span>
              <span className="text-right">Insp.</span>
              <span className="text-right">NG</span>
              <span className="text-right">PPM</span>
            </div>
            <ol className="divide-y divide-border/30 flex-1 overflow-hidden">
              {supplierRanking.length === 0 && <li className="h-full flex items-center justify-center text-5xl text-muted-foreground">Sem dados no período.</li>}
              {supplierRanking.slice(0, 8).map((s, i) => {
                const isWorst = isV2 && i < 3 && s.ng > 0;
                return (
                  <li key={s.fornecedor} className={cn("grid grid-cols-[3.5rem_minmax(0,1fr)_6rem_5rem_9rem] items-center gap-4 py-2.5 tabular-nums", isWorst && "rounded-xl px-2 -mx-2 bg-red-500/5 border border-red-500/30")}
                      style={reducedMotion ? undefined : { animation: `fade-in 0.4s ease-out ${i * 70}ms both${isWorst ? ", pulse-danger 2.4s ease-in-out infinite" : ""}` }}>
                    <span className={cn("text-3xl font-black text-center", i === 0 ? "text-red-500" : i === 1 ? "text-orange-400" : i === 2 ? "text-amber-400" : "text-muted-foreground")}>{i + 1}</span>
                    <div className="min-w-0">
                      <p className="font-semibold text-2xl truncate">{s.fornecedor}{isWorst && (() => { const rate = s.insp > 0 ? (s.ng / s.insp) * 100 : 0; return (<span title={`NG: ${fmtNum(s.ng)} de ${fmtNum(s.insp)} insp. (${rate.toFixed(2)}%)`} className="ml-2 text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 align-middle whitespace-nowrap">Top Worst · {fmtNum(s.ng)} NG · {rate.toFixed(1)}%</span>); })()}</p>
                      <div className="h-2 rounded-full bg-muted/40 overflow-hidden mt-1.5">
                        <div className="h-full bg-gradient-to-r from-red-600 to-amber-500 transition-all duration-700" style={{ width: `${(s.ppm / max) * 100}%` }} />
                      </div>
                    </div>
                    <span className="text-2xl font-bold text-cyan-300 text-right">{fmtNum(s.insp)}</span>
                    <span className={cn("text-2xl font-bold text-right", s.ng === 0 ? "text-emerald-400" : "text-red-400")}>{fmtNum(s.ng)}</span>
                    <span className={cn("text-3xl font-black text-right", s.ng === 0 ? "text-emerald-400" : "text-red-500")}>{fmtNum(s.ppm)}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        );
      }

      case "defects": {
        const stripNum = (s: string) => (s || "").replace(/^\s*\d+\s*[-–.)]\s*/, "");
        const data = defectsData.map((d) => ({ ...d, name: stripNum(d.name) }));
        return (
          <div className="w-full h-full overflow-hidden rounded-3xl bg-card/60 backdrop-blur-md border border-border/60 p-8">
            {data.length === 0 ? (
              <div className="h-full flex items-center justify-center text-5xl text-muted-foreground">Sem defeitos no período.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical" margin={{ left: 200, right: 120, top: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={20} />
                  <YAxis dataKey="name" type="category" width={260} stroke="hsl(var(--muted-foreground))" fontSize={20} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 18 }} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} isAnimationActive={!reducedMotion} animationDuration={isV2 ? 1400 : 800} animationEasing="ease-out">
                    {data.map((_, i) => <Cell key={i} fill={`hsl(${10 + i * 8}, 85%, ${55 - i * 2}%)`} />)}
                    <LabelList dataKey="value" position="right" fill="hsl(var(--foreground))" fontSize={26} fontWeight={900} formatter={(v: number) => fmtNum(v)} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        );
      }
      case "inspecionado": {
        const inspSetting = prefs.blockSettings?.inspecionado ?? {};
        const supsPerSlide = inspSetting.inspSuppliersPerSlide ?? (isV2 ? 9 : 4);
        const partsPerGroup = inspSetting.inspPartsPerGroup ?? 2;
        const fontScale = inspSetting.inspFontScale ?? 1;
        const rotateMs = inspSetting.inspRotateMs;
        const postFlapDelayMs = inspSetting.inspPostFlapDelayMs ?? 0;
        const layoutCols = inspSetting.inspLayoutCols ?? "auto";
        const gapPx = inspSetting.inspLetterGap ?? 2;
        const suppliers = inspecionadoData.slice(0, supsPerSlide);
        const autoCols =
          suppliers.length <= 1 ? "grid-cols-1" :
          suppliers.length === 2 ? "grid-cols-2" :
          suppliers.length <= 4 ? "grid-cols-2 grid-rows-2" :
          suppliers.length <= 6 ? "grid-cols-3 grid-rows-2" :
                                  "grid-cols-3 grid-rows-3";
        const forcedCols =
          layoutCols === 1 ? "grid-cols-1" :
          layoutCols === 2 ? "grid-cols-2" :
          layoutCols === 3 ? "grid-cols-3" :
          layoutCols === 4 ? "grid-cols-4" : null;
        const cols = forcedCols ?? autoCols;
        const sz = (n: number) => Math.round(n * fontScale);
        return (
          <div className="w-full h-full overflow-hidden">
            {suppliers.length === 0 ? (
              <div className="h-full flex items-center justify-center text-5xl text-muted-foreground rounded-3xl bg-card/60 backdrop-blur-md border border-border/60">
                Sem peças inspecionadas no período.
              </div>
            ) : (
              <div className={cn("grid gap-6 w-full h-full", cols)}>
                {suppliers.map((sup, si) => (
                  <div key={sup.fornecedor} className="relative overflow-hidden rounded-2xl bg-card/60 backdrop-blur-md border border-cyan-500/30 p-6 pb-8 flex flex-col" style={reducedMotion ? undefined : { animation: `fade-in 0.5s ease-out ${si * 100}ms both` }}>
                    <div className="flex items-center justify-between gap-3 pb-3 border-b border-border/40">
                      <SplitFlapText value={sup.fornecedor} size={sz(32)} maxChars={18} className="text-cyan-300 font-bold" gapPx={gapPx} />
                      <SplitFlapNumber value={sup.total} size={sz(isV2 ? 44 : 48)} gapPx={gapPx} />
                    </div>
                    <RotatingParts
                      parts={sup.parts}
                      qtySize={sz(26)}
                      perGroup={partsPerGroup}
                      fontScale={fontScale}
                      intervalMs={rotateMs}
                      postFlapDelayMs={postFlapDelayMs}
                      gapPx={gapPx}
                      storageKey={`insp::${sup.fornecedor}`}
                    />
                    <div className="absolute left-0 top-0 bottom-0 w-2 bg-cyan-500" />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }
      case "comunicados":
      case "alteracoes_4m":
      case "retrabalhos": {
        const tipo = id === "comunicados" ? "comunicado" : id === "retrabalhos" ? "retrabalho" : "alteracao_4m";
        const emptyLabel = id === "comunicados" ? "comunicado" : id === "retrabalhos" ? "retrabalho" : "aviso";
        const nowMs = now.getTime();
        const allItems = slidesMedia.filter((m) => {
          if (m.tipo !== tipo) return false;
          const ini = m.vigencia_inicio ? new Date(m.vigencia_inicio).getTime() : null;
          const fim = m.vigencia_fim ? new Date(m.vigencia_fim).getTime() : null;
          if (ini && nowMs < ini) return false;
          if (fim && nowMs > fim) return false;
          return true;
        });
        if (!allItems.length) {
          return <div className="w-full h-full flex items-center justify-center text-5xl text-muted-foreground rounded-3xl bg-card/60 backdrop-blur-md border border-border/60">Nenhum {emptyLabel} publicado.</div>;
        }
        // Group by slot (comunicados and retrabalhos use multi-slot; alteracoes_4m always single)
        const slotsWithItems: { slot: number; items: any[] }[] = [];
        if (tipo === "comunicado" || tipo === "retrabalho") {
          for (const s of [1, 2, 3, 4]) {
            const its = allItems.filter((m) => (m.slot || 1) === s);
            if (its.length) slotsWithItems.push({ slot: s, items: its });
          }
          if (!slotsWithItems.length) slotsWithItems.push({ slot: 1, items: allItems });
        } else {
          slotsWithItems.push({ slot: 1, items: allItems });
        }
        const gridClass =
          slotsWithItems.length === 1 ? "grid-cols-1 grid-rows-1" :
          slotsWithItems.length === 2 ? "grid-cols-2 grid-rows-1" :
          slotsWithItems.length === 3 ? "grid-cols-3 grid-rows-1" :
          "grid-cols-2 grid-rows-2";
        return (
          <div className={cn("w-full h-full grid gap-4", gridClass)}>
            {slotsWithItems.map(({ slot, items }) => {
              const mi = Math.floor(nowMs / 8000) % items.length;
              const current = items[mi];
              const url = current ? mediaUrls[current.file_path] : undefined;
              const isPdf = /\.pdf($|\?)/i.test(current?.file_name || current?.file_path || "");
              const multi = slotsWithItems.length > 1;
              return (
                <div key={`${slot}-${current?.id}`} className="grid grid-rows-[1fr_auto] gap-3 rounded-3xl bg-card/60 backdrop-blur-md border border-border/60 p-4 animate-fade-in min-h-0 min-w-0 overflow-hidden">
                  <div className="relative overflow-hidden rounded-2xl bg-black/40 flex items-center justify-center min-h-0">
                    {!url
                      ? <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
                      : isPdf
                        ? <iframe title={current?.titulo || "PDF"} src={`${url}#toolbar=0&navpanes=0&view=FitH`} className="w-full h-full bg-white rounded-xl" />
                        : <img src={url} alt={current?.titulo || ""} className="max-w-full max-h-full object-contain animate-scale-in" />}
                  </div>
                  <div className="flex items-center justify-between gap-3 min-w-0">
                    <div className="min-w-0">
                      {current?.titulo && <h3 className={cn("font-bold truncate", multi ? "text-xl" : "text-3xl")}>{current.titulo}</h3>}
                      {current?.descricao && <p className={cn("text-muted-foreground truncate", multi ? "text-sm" : "text-xl")}>{current.descricao}</p>}
                    </div>
                    <span className="text-xs uppercase tracking-widest text-muted-foreground tabular-nums shrink-0">
                      {multi && <>Pos. {slot} · </>}{mi + 1}/{items.length}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        );
      }
      case "ultimos_defeitos": {
        const all = ngApontamentos;
        if (!all.length) {
          return <div className="w-full h-full flex items-center justify-center text-5xl text-muted-foreground rounded-3xl bg-card/60 backdrop-blur-md border border-border/60">Sem defeitos detectados no período.</div>;
        }
        const udSetting = prefs.blockSettings?.ultimos_defeitos ?? {};
        const pageSize = udSetting.perSlide ?? 4;
        const totalPages = Math.max(1, Math.ceil(all.length / pageSize));
        const page = Math.floor(now.getTime() / 12000) % totalPages;
        const items = all.slice(page * pageSize, page * pageSize + pageSize);
        const gridCols = pageSize === 2 ? "grid-cols-2" : pageSize === 3 ? "grid-cols-3" : pageSize === 5 ? "grid-cols-5" : "grid-cols-4";
        const descCls = descStyleClasses(udSetting.descStyle);
        return (
          <div key={page} className={cn("grid gap-5 w-full h-full", gridCols)}>
            {items.map((a, i) => {
              const photos = ngPhotos[a.id] || [];
              const photo = photos[0];
              return (
                <div key={a.id} onClick={() => photos.length && setPhotoSource({ photos, title: a.modo_falha || "Defeito", meta: [
                  { label: "Modo de Falha", value: a.modo_falha || "" },
                  { label: "Descrição", value: a.descricao_problema || a.descricao || "" },
                  { label: "Fornecedor", value: a.fornecedor || "" },
                  { label: "Part Number", value: a.part_number || "" },
                  { label: "NG", value: String(a.quantidade_ng || 0) },
                  { label: "Data", value: new Date(a.created_at).toLocaleString("pt-BR") },
                ] })}
                  className={cn("relative overflow-hidden rounded-2xl bg-card/60 backdrop-blur-md border border-rose-500/40 flex flex-col", photo && "cursor-pointer transition-transform hover:scale-[1.02]")}
                  style={reducedMotion ? undefined : { animation: `fade-in 0.5s ease-out ${i * 80}ms both` }}>
                  {photo
                    ? <img src={photo} alt="" className="w-full h-72 object-cover" loading="lazy" />
                    : <div className="w-full h-72 bg-muted/30 flex items-center justify-center text-muted-foreground"><Microscope className="w-16 h-16" /></div>}
                  <div className="p-5 flex-1 flex flex-col gap-2">
                    <div className="flex items-center justify-end">
                      <span className="text-sm uppercase px-3 py-1 rounded-full bg-red-500/20 text-red-300 font-bold tabular-nums">NG {a.quantidade_ng}</span>
                    </div>
                    <p className="text-2xl font-bold text-rose-300 line-clamp-2">{a.modo_falha || "—"}</p>
                    {(a.descricao_problema || a.descricao) && (
                      <p className={cn("line-clamp-3", descCls)}>{a.descricao_problema || a.descricao}</p>
                    )}
                    <p className="text-sm text-muted-foreground truncate">{a.part_number || "—"} · {a.fornecedor || "—"}</p>
                    <p className="text-xs text-muted-foreground mt-auto">{new Date(a.created_at).toLocaleString("pt-BR")}</p>
                  </div>
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-rose-500" />
                </div>
              );
            })}
          </div>
        );
      }

      case "resumo_acumulado": {
        const SHIFTS: Array<{ id: "all" | "1T" | "2T" | "3T"; label: string }> = [
          { id: "all", label: "Todos os turnos" },
          { id: "1T", label: "1º Turno" },
          { id: "2T", label: "2º Turno" },
          { id: "3T", label: "3º Turno" },
        ];
        const resumoSetting = prefs.blockSettings?.resumo_acumulado ?? {};
        const shiftPref = resumoSetting.resumoShift ?? "auto";
        // In "auto" rotate every 7s; otherwise pin to the user-selected shift.
        const shiftIdx = shiftPref === "auto"
          ? Math.floor(now.getTime() / 7000) % SHIFTS.length
          : SHIFTS.findIndex((s) => s.id === shiftPref);
        const activeShift = SHIFTS[shiftIdx >= 0 ? shiftIdx : 0];
        const filtered = activeShift.id === "all"
          ? apontamentosMonth
          : apontamentosMonth.filter((a) => a.turno === activeShift.id);


        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const lastDay = new Date(year, month + 1, 0).getDate();
        const monthLabel = today.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

        // Trend day 1..lastDay
        const trend: { day: number; ng: number; insp: number; ppm: number }[] = [];
        for (let d = 1; d <= lastDay; d++) trend.push({ day: d, ng: 0, insp: 0, ppm: 0 });
        filtered.forEach((a) => {
          const dt = new Date(a.created_at);
          if (dt.getMonth() !== month || dt.getFullYear() !== year) return;
          const idx = dt.getDate() - 1;
          trend[idx].ng += a.quantidade_ng || 0;
          trend[idx].insp += a.quantidade_inspecionada || a.quantidade || 0;
        });
        trend.forEach((t) => { t.ppm = t.insp > 0 ? Math.round((t.ng / t.insp) * 1_000_000) : 0; });

        // Supplier aggregation
        type SupAgg = { fornecedor: string; ng: number; insp: number; ppm: number; defects: Map<string, number> };
        const supMap = new Map<string, SupAgg>();
        filtered.forEach((a) => {
          const f = a.fornecedor || "—";
          const cur = supMap.get(f) || { fornecedor: f, ng: 0, insp: 0, ppm: 0, defects: new Map() };
          cur.ng += a.quantidade_ng || 0;
          cur.insp += a.quantidade_inspecionada || a.quantidade || 0;
          if ((a.quantidade_ng || 0) > 0 && a.modo_falha) {
            cur.defects.set(a.modo_falha, (cur.defects.get(a.modo_falha) || 0) + a.quantidade_ng);
          }
          supMap.set(f, cur);
        });
        const sups = Array.from(supMap.values())
          .filter((s) => s.insp > 0)
          .map((s) => ({ ...s, ppm: Math.round((s.ng / s.insp) * 1_000_000) }));
        const best = [...sups].filter((s) => s.ng === 0 || s.ppm < 5000).sort((a, b) => a.ppm - b.ppm).slice(0, 3);
        const worst = [...sups].filter((s) => s.ng > 0).sort((a, b) => b.ppm - a.ppm).slice(0, 3);

        // Month totals
        const totInsp = filtered.reduce((s, a) => s + (a.quantidade_inspecionada || a.quantidade || 0), 0);
        const totNg = filtered.reduce((s, a) => s + (a.quantidade_ng || 0), 0);
        const totPpm = totInsp > 0 ? Math.round((totNg / totInsp) * 1_000_000) : 0;

        const PIE_COLORS = ["#f87171", "#fb923c", "#facc15", "#a3a3a3"];

        const SupCard = ({ s, kind }: { s: SupAgg & { ppm: number }; kind: "best" | "worst" }) => {
          const topDefects = Array.from(s.defects.entries())
            .map(([name, value]) => ({ name: name.replace(/^\s*\d+\s*-\s*/, ""), value }))
            .sort((a, b) => b.value - a.value).slice(0, 3);
          const otherSum = Array.from(s.defects.entries()).reduce((sum, [, v]) => sum + v, 0) - topDefects.reduce((sum, d) => sum + d.value, 0);
          const pieData = topDefects.length ? [...topDefects, ...(otherSum > 0 ? [{ name: "Outros", value: otherSum }] : [])] : [];
          const totalDef = pieData.reduce((a, b) => a + b.value, 0);
          const accent = kind === "best" ? "border-emerald-500/50 from-emerald-500/10" : "border-red-500/50 from-red-500/10";
          const ppmColor = kind === "best" ? "text-emerald-400" : "text-red-400";
          return (
            <div className={cn("rounded-2xl border bg-gradient-to-br to-transparent backdrop-blur-md p-2.5 sm:p-3 flex items-center gap-2.5 sm:gap-3 lg:gap-4 min-w-0 shrink-0", accent)}>
              {/* Left: Pie chart (fixed responsive square) */}
              {pieData.length > 0 ? (
                <div className="shrink-0 aspect-square w-16 sm:w-20 lg:w-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="50%"
                        outerRadius="100%"
                        paddingAngle={2}
                        isAnimationActive={false}
                      >
                        {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="shrink-0 aspect-square w-16 sm:w-20 lg:w-24 flex items-center justify-center text-emerald-400 text-2xl sm:text-3xl font-black">✓</div>
              )}

              {/* Middle: name + defects legend */}
              <div className="flex-1 basis-0 min-w-0 flex flex-col justify-center gap-1 overflow-hidden">
                <h4 className="text-sm sm:text-base lg:text-lg font-bold leading-tight truncate" title={s.fornecedor}>
                  {s.fornecedor}
                </h4>
                <p className="text-[10px] sm:text-xs text-muted-foreground tabular-nums truncate">
                  {fmtNum(s.ng)} NG · {fmtNum(s.insp)} insp.
                </p>
                {pieData.length > 0 ? (
                  <ul className="min-w-0 space-y-0.5 text-[10px] sm:text-[11px] lg:text-xs mt-0.5">
                    {pieData.map((d, i) => {
                      const p = totalDef > 0 ? Math.round((d.value / totalDef) * 100) : 0;
                      return (
                        <li key={d.name} className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="truncate flex-1 min-w-0" title={d.name}>{d.name}</span>
                          <span className="tabular-nums text-muted-foreground shrink-0 font-semibold w-8 text-right">{p}%</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-emerald-400 text-[11px] sm:text-xs font-semibold truncate">Sem defeitos no mês</p>
                )}
              </div>

              {/* Right: PPM */}
              <div className="shrink-0 text-right leading-none self-center min-w-[48px] sm:min-w-[56px] lg:min-w-[64px]">
                <div className={cn("text-base sm:text-xl lg:text-2xl font-black tabular-nums whitespace-nowrap", ppmColor)}>
                  {fmtNum(s.ppm)}
                </div>
                <div className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">PPM</div>
              </div>
            </div>
          );
        };


        return (
          <div key={activeShift.id} className="w-full h-full flex flex-col gap-3 sm:gap-4 min-w-0" style={reducedMotion ? undefined : { animation: "fade-in 0.5s ease-out both" }}>
            {/* Header — stacks on mobile, 3-col on desktop */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-3 md:gap-4 rounded-2xl bg-card/60 backdrop-blur-md border border-border/60 px-4 sm:px-6 py-3 sm:py-4">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs uppercase tracking-[0.25em] text-muted-foreground">Mês de referência</p>
                <p className="text-xl sm:text-2xl lg:text-3xl font-black capitalize truncate">{monthLabel}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Dia 1 a {lastDay}</p>
              </div>
              <div className="flex items-center justify-center gap-2 md:justify-self-center">
                <span className="px-3 sm:px-5 py-1.5 sm:py-2 rounded-full text-sm sm:text-base font-semibold border bg-emerald-500/20 border-emerald-400/70 text-emerald-300 shadow-lg shadow-emerald-500/20 whitespace-nowrap">
                  {activeShift.label}
                </span>
                {shiftPref === "auto" && (
                  <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground">Auto</span>
                )}
              </div>
              <div className="md:text-right min-w-0">
                <p className="text-[10px] sm:text-xs uppercase tracking-[0.25em] text-muted-foreground">Acumulado</p>
                <div className="flex items-baseline gap-3 sm:gap-4 md:justify-end flex-wrap">
                  <span className="text-lg sm:text-2xl lg:text-3xl font-black text-cyan-300 tabular-nums">{fmtNum(totInsp)}<span className="text-[10px] sm:text-sm text-muted-foreground ml-1">insp.</span></span>
                  <span className={cn("text-lg sm:text-2xl lg:text-3xl font-black tabular-nums", totNg > 0 ? "text-red-400" : "text-emerald-400")}>{fmtNum(totNg)}<span className="text-[10px] sm:text-sm text-muted-foreground ml-1">NG</span></span>
                  <span className={cn("text-lg sm:text-2xl lg:text-3xl font-black tabular-nums", totPpm > 0 ? "text-amber-400" : "text-emerald-400")}>{fmtNum(totPpm)}<span className="text-[10px] sm:text-sm text-muted-foreground ml-1">PPM</span></span>
                </div>
              </div>
            </div>

            {/* Trend chart */}
            <div className="rounded-2xl bg-card/60 backdrop-blur-md border border-border/60 px-3 sm:px-5 py-3 sm:py-4 flex-shrink-0 h-[200px] sm:h-[240px] lg:h-[280px]">
              <p className="text-[11px] sm:text-sm uppercase tracking-[0.2em] text-muted-foreground mb-1 sm:mb-2 truncate">Tendência de NG por dia — {activeShift.label}</p>
              <ResponsiveContainer width="100%" height="88%">
                <AreaChart data={trend} margin={{ top: 22, right: 14, left: 0, bottom: 8 }}>
                  <defs>
                    <linearGradient id="ngFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f87171" stopOpacity={0.7} />
                      <stop offset="100%" stopColor="#f87171" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} interval="preserveStartEnd" minTickGap={8} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={32} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Area type="monotone" dataKey="ng" stroke="#f87171" strokeWidth={2.5} fill="url(#ngFill)" isAnimationActive={!reducedMotion} animationDuration={800}>
                    <LabelList
                      dataKey="ng"
                      position="top"
                      fill="hsl(var(--foreground))"
                      fontSize={10}
                      fontWeight={700}
                      formatter={(v: number) => (v > 0 ? fmtNum(v) : "")}
                    />
                  </Area>
                </AreaChart>
              </ResponsiveContainer>
            </div>


            {/* Best vs Worst — stacks on mobile, 2 cols on desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 min-h-0">
              <div className="flex flex-col gap-2 sm:gap-3 min-w-0">
                <h3 className="text-base sm:text-lg lg:text-xl font-bold text-emerald-400 flex items-center gap-2"><Trophy className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" /> <span className="truncate">Melhores Fornecedores</span></h3>
                <div className="flex flex-col gap-2 sm:gap-3">
                  {best.length === 0 ? <div className="flex items-center justify-center text-muted-foreground text-sm py-6">Sem dados</div>
                    : best.map((s) => <SupCard key={s.fornecedor} s={s} kind="best" />)}
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:gap-3 min-w-0">
                <h3 className="text-base sm:text-lg lg:text-xl font-bold text-red-400 flex items-center gap-2"><AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" /> <span className="truncate">Piores Fornecedores</span></h3>
                <div className="flex flex-col gap-2 sm:gap-3">
                  {worst.length === 0 ? <div className="flex items-center justify-center text-muted-foreground text-sm py-6">Sem defeitos no mês ✓</div>
                    : worst.map((s) => <SupCard key={s.fornecedor} s={s} kind="worst" />)}
                </div>
              </div>
            </div>
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
        @keyframes flap-down { 0% { transform: rotateX(-90deg); opacity: 0 } 60% { transform: rotateX(10deg); opacity: 1 } 100% { transform: rotateX(0deg); opacity: 1 } }
        @keyframes flap-top { 0% { transform: rotateX(0deg) } 100% { transform: rotateX(-90deg) } }
        @keyframes flap-bottom { 0% { transform: rotateX(90deg) } 100% { transform: rotateX(0deg) } }
        @keyframes pulse-danger { 0%, 100% { box-shadow: 0 0 0 0 hsl(0 90% 55% / 0.45) } 50% { box-shadow: 0 0 0 14px hsl(0 90% 55% / 0) } }
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
        {!chromeOff && (
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
        )}

        {/* Auto-advance progress bar */}
        {!chromeOff && !isPaused && blocks.length > 1 && (
          <div className="relative z-10 h-1.5 bg-muted/30">
            <div
              key={`pb-${safeIdx}-${rangeKey}`}
              className="h-full bg-gradient-to-r from-primary via-cyan-400 to-primary"
              style={{ animation: reducedMotion ? undefined : `slide-in-right ${slideDurationMs}ms linear forwards`, transformOrigin: "left" }}
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
        {!chromeOff && apontamentos.length > 0 && (
          <div className="relative z-10 overflow-hidden border-t border-border/40 bg-background/60 backdrop-blur-md py-3">
            <div className="flex gap-14 whitespace-nowrap" style={{ animation: reducedMotion ? undefined : `ticker ${prefs.tickerSpeedSec ?? 45}s linear infinite`, width: "max-content" }}>
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
        {!chromeOff && (
        <footer className="relative z-10 flex items-center justify-between px-10 py-4 border-t border-border/40 bg-background/60 backdrop-blur-md text-xl">
          <span className="font-mono">
            {now.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })} · <span className="font-bold">{now.toLocaleTimeString("pt-BR")}</span>
          </span>
          <span className="text-muted-foreground text-base uppercase tracking-widest">
            Slide {safeIdx + 1} / {blocks.length} · {isPaused ? "Pausado" : `Auto ${slideDurationMs / 1000}s`}{isFs ? " · Kiosk" : ""}
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
        )}
      </div>

      {photoSource && <PhotoModal source={photoSource} onClose={() => setPhotoSource(null)} />}

      {logoutToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] px-4 py-2 rounded-lg bg-black/80 text-white text-sm shadow-lg animate-fade-in">
          {logoutToast}
        </div>
      )}

      {/* Debug panel — toggle with `D` key or ?debug query param */}
      {!isPreviewMode && (
        <>
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
        </>
      )}

      {needsFsGesture && !isFs && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-card border border-border rounded-2xl p-8 max-w-md text-center space-y-4 shadow-2xl">
            <Maximize2 className="w-12 h-12 mx-auto text-primary" />
            <h2 className="text-2xl font-bold">Ativar modo Kiosk</h2>
            <p className="text-muted-foreground">O navegador exige um clique para entrar em tela cheia.</p>
            <Button size="lg" className="w-full" onClick={async () => { await enterFullscreen(); if (!isKioskMode) await enterKiosk(); setNeedsFsGesture(false); }}>
              Entrar em tela cheia
            </Button>
          </div>
        </div>
      )}

      <MonitorDialog
        open={showSettings}
        onOpenChange={(v) => {
          setShowSettings(v);
          if (!v) {
            // Pull any autosaved per-slide changes back into Monitor state.
            const fresh = loadPrefs();
            setPrefs(fresh);
            setSlideIdx(0);
          }
        }}
        initial={prefs}
        initialTab={currentBlock ? `b:${currentBlock}` : undefined}
        confirmLabel="Aplicar"
        onConfirm={(p) => { setPrefs(p); setSlideIdx(0); }}
      />
    </ScaledStage>
  );
};

export default Monitor;
