import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Moon, Sun, Settings2, Megaphone, Wrench, Check, RotateCcw, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { monitorClient } from "@/integrations/supabase/monitor-client";

export type MonitorBlock =
  | "summary"
  | "recent"
  | "alerts"
  | "contencao"
  | "consumiveis"
  | "ranking"
  | "defects"
  | "inspecionado"
  | "comunicados"
  | "alteracoes_4m"
  | "ultimos_defeitos";

export type MonitorPeriod = "today" | "week" | "month" | "custom";
export type MonitorTheme = "dark" | "default";
export type MonitorProfile = "default" | "v2";

export type DescStyleColor = "default" | "rose" | "amber" | "emerald" | "sky" | "violet";
export type DescStyleWeight = "normal" | "semibold" | "bold";
export type DescStyleSize = "sm" | "md" | "lg";

export interface DefectsDescStyle {
  color?: DescStyleColor;
  weight?: DescStyleWeight;
  italic?: boolean;
  size?: DescStyleSize;
}

export interface MonitorBlockSetting {
  durationMs?: number;
  animations?: boolean;
  /** Used by "ultimos_defeitos": how many defect cards per slide (2–5). */
  perSlide?: 2 | 3 | 4 | 5;
  /** Used by "ultimos_defeitos": visual style for the "Descrição" text. */
  descStyle?: DefectsDescStyle;
  /** Used by "inspecionado": how many supplier cards to show per slide (1–9). */
  inspSuppliersPerSlide?: number;
  /** Used by "inspecionado": how many part lines per rotation group (1–6). */
  inspPartsPerGroup?: number;
  /** Used by "inspecionado": font scale multiplier (0.6 – 1.6). */
  inspFontScale?: number;
}

export interface MonitorPreferences {
  blocks: MonitorBlock[];
  period: MonitorPeriod;
  customFrom?: string;
  customTo?: string;
  theme: MonitorTheme;
  profile?: MonitorProfile;
  slideDurationMs?: number;
  animationsEnabled?: boolean;
  /** Split-flap (airport) half-flip duration in ms. Lower = faster. */
  flapSpeedMs?: number;
  blockSettings?: Partial<Record<MonitorBlock, MonitorBlockSetting>>;
}

const STORAGE_KEY = "monitor_preferences";

export const defaultPrefs: MonitorPreferences = {
  blocks: ["summary", "recent", "alerts"],
  period: "today",
  theme: "dark",
  profile: "default",
  slideDurationMs: 10000,
  animationsEnabled: true,
  flapSpeedMs: 70,
  blockSettings: {},
};


export const loadPrefs = (): MonitorPreferences => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPrefs;
    const p = JSON.parse(raw);
    if (!Array.isArray(p.blocks) || !p.period) return defaultPrefs;
    return {
      theme: "dark",
      slideDurationMs: 10000,
      animationsEnabled: true,
      blockSettings: {},
      ...p,
    } as MonitorPreferences;
  } catch {
    return defaultPrefs;
  }
};

export const savePrefs = (p: MonitorPreferences) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* noop */ }
};

/** Resolve effective duration/animation for a given block, using overrides + global defaults. */
export const getBlockSlideConfig = (
  prefs: MonitorPreferences,
  block: MonitorBlock,
): { durationMs: number; animations: boolean } => {
  const globalDur = prefs.slideDurationMs ?? 10000;
  const globalAnim = prefs.animationsEnabled ?? true;
  const s = prefs.blockSettings?.[block];
  return {
    durationMs: s?.durationMs ?? globalDur,
    animations: s?.animations ?? globalAnim,
  };
};

const BLOCK_OPTIONS: { id: MonitorBlock; emoji: string; title: string; desc: string }[] = [
  { id: "summary", emoji: "📊", title: "Resumo", desc: "Total de registros, NG, OK e PPM" },
  { id: "recent", emoji: "📋", title: "Últimos Lançamentos", desc: "Tabela em tempo real (V2 mostra Rate)" },
  { id: "alerts", emoji: "⚠️", title: "Alertas", desc: "Lista mestra de alertas de qualidade" },
  { id: "contencao", emoji: "🔴", title: "Contenções", desc: "Em andamento e finalizadas" },
  { id: "consumiveis", emoji: "📦", title: "Consumíveis", desc: "Itens abaixo do estoque mínimo" },
  { id: "ranking", emoji: "🏆", title: "Fornecedores", desc: "Performance — top piores em destaque" },
  { id: "defects", emoji: "📈", title: "Modos de Falha", desc: "Modos de falha mais detectados" },
  { id: "inspecionado", emoji: "🔍", title: "Inspeção", desc: "Split-flap por fornecedor" },
  { id: "comunicados", emoji: "📣", title: "Comunicados", desc: "Imagens / PDFs publicados" },
  { id: "alteracoes_4m", emoji: "🛠️", title: "Alterações 4M/EO", desc: "Avisos de engenharia / pontos de corte" },
  { id: "ultimos_defeitos", emoji: "🔬", title: "Últimos Defeitos", desc: "Últimos NG com fotos" },
];

const PERIOD_OPTIONS: { id: MonitorPeriod; label: string }[] = [
  { id: "today", label: "Hoje" },
  { id: "week", label: "Esta semana" },
  { id: "month", label: "Este mês" },
  { id: "custom", label: "Personalizado" },
];

const DURATION_OPTIONS = [5000, 8000, 10000, 15000, 20000, 30000, 45000, 60000];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: MonitorPreferences;
  onConfirm: (prefs: MonitorPreferences) => void;
  confirmLabel?: string;
}

export const MonitorDialog = ({ open, onOpenChange, initial, onConfirm, confirmLabel = "Abrir Monitor" }: Props) => {
  const { isAdmin } = useAuth();
  const [prefs, setPrefs] = useState<MonitorPreferences>(initial ?? loadPrefs());
  const [tab, setTab] = useState<string>("geral");

  useEffect(() => {
    if (open) {
      setPrefs(initial ?? loadPrefs());
      setTab("geral");
    }
  }, [open, initial]);

  // Auto-persist preferences (including per-slide overrides) so reloads keep them.
  // Show a subtle toast confirming save, debounced so rapid changes only fire once.
  const skipInitialSaveToast = useRef(true);
  useEffect(() => {
    if (!open) {
      skipInitialSaveToast.current = true;
      return;
    }
    savePrefs(prefs);
    if (skipInitialSaveToast.current) {
      skipInitialSaveToast.current = false;
      return;
    }
    const handle = window.setTimeout(() => {
      toast.success("Configurações salvas", {
        description: "Tempo e animação atualizados.",
        duration: 1500,
        id: "monitor-prefs-saved",
      });
    }, 400);
    return () => window.clearTimeout(handle);
  }, [prefs, open]);

  const toggle = (id: MonitorBlock) => {
    setPrefs((p) => ({
      ...p,
      blocks: p.blocks.includes(id) ? p.blocks.filter((b) => b !== id) : [...p.blocks, id],
    }));
  };

  const setBlockSetting = (id: MonitorBlock, patch: MonitorBlockSetting) => {
    setPrefs((p) => ({
      ...p,
      blockSettings: { ...(p.blockSettings ?? {}), [id]: { ...(p.blockSettings?.[id] ?? {}), ...patch } },
    }));
  };

  /** Remove all per-slide overrides for a block, falling back to global defaults. */
  const resetBlock = (id: MonitorBlock) => {
    setPrefs((p) => {
      const next = { ...(p.blockSettings ?? {}) };
      delete next[id];
      return { ...p, blockSettings: next };
    });
    toast.success("Slide redefinido", {
      description: "Voltou a usar o padrão global.",
      duration: 1800,
    });
  };

  const customValid = prefs.period !== "custom" || (!!prefs.customFrom && !!prefs.customTo && prefs.customFrom <= prefs.customTo);
  const canConfirm = prefs.blocks.length > 0 && customValid;

  const handleConfirm = () => {
    savePrefs(prefs);
    onConfirm(prefs);
    onOpenChange(false);
  };

  const activeCount = prefs.blocks.length;
  const globalDur = prefs.slideDurationMs ?? 10000;
  const globalAnim = prefs.animationsEnabled ?? true;

  const enabledBlocks = useMemo(
    () => BLOCK_OPTIONS.filter((b) => prefs.blocks.includes(b.id)),
    [prefs.blocks],
  );

  const previewData = usePreviewData(open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 gap-0 flex flex-col overflow-hidden",
          // Full-page on mobile, large centered panel on desktop
          "w-screen h-[100dvh] max-w-none rounded-none border-0",
          "sm:w-[96vw] sm:h-[92vh] sm:max-w-[1400px] sm:rounded-lg sm:border",
        )}
      >
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Settings2 className="w-5 h-5 text-primary shrink-0" />
            <span className="truncate">Configurar Monitor</span>
            <span className="ml-auto text-xs font-normal text-muted-foreground whitespace-nowrap">
              {activeCount} slide{activeCount === 1 ? "" : "s"}
            </span>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
          <ScrollArea className="w-full border-b shrink-0">
            <TabsList className="h-auto p-1 mx-2 my-2 inline-flex w-max bg-muted/40 gap-0.5">
              <TabsTrigger value="geral" className="gap-1.5 whitespace-nowrap">
                <Settings2 className="w-3.5 h-3.5" /> Geral
              </TabsTrigger>
              <TabsTrigger value="slides" className="gap-1.5 whitespace-nowrap">
                📑 Slides
                <span className="ml-1 text-[10px] rounded-full bg-primary/15 text-primary px-1.5 py-0.5">
                  {activeCount}
                </span>
              </TabsTrigger>
              {enabledBlocks.map((b) => (
                <TabsTrigger key={b.id} value={`b:${b.id}`} className="gap-1.5 whitespace-nowrap">
                  <span>{b.emoji}</span>
                  <span>{b.title}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4">
            {/* ======= GERAL ======= */}
            <TabsContent value="geral" className="mt-0 space-y-5">
              <Section title="Perfil do Monitor">
                <div className="flex gap-2 flex-wrap">
                  <ChoiceCard
                    active={(prefs.profile ?? "default") === "default"}
                    onClick={() => setPrefs((p) => ({ ...p, profile: "default" }))}
                    title="Padrão"
                    desc="Layout original com slides essenciais"
                  />
                  <ChoiceCard
                    active={prefs.profile === "v2"}
                    onClick={() => setPrefs((p) => ({ ...p, profile: "v2" }))}
                    title="V2 — Detalhado"
                    desc="Versão completa com Rate, Inspeção, Comunicados…"
                  />
                </div>
              </Section>

              <Section title="Tema">
                <div className="flex gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant={prefs.theme === "default" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPrefs((p) => ({ ...p, theme: "default" }))}
                  >
                    <Sun className="w-4 h-4 mr-1" /> Padrão
                  </Button>
                  <Button
                    type="button"
                    variant={prefs.theme === "dark" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPrefs((p) => ({ ...p, theme: "dark" }))}
                  >
                    <Moon className="w-4 h-4 mr-1" /> Dark (Dashboard)
                  </Button>
                </div>
              </Section>

              <Section title="Período dos dados">
                <div className="flex gap-2 flex-wrap">
                  {PERIOD_OPTIONS.map((p) => (
                    <Button
                      key={p.id}
                      type="button"
                      variant={prefs.period === p.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPrefs((prev) => ({ ...prev, period: p.id }))}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
                {prefs.period === "custom" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    <div className="space-y-1">
                      <Label htmlFor="mon-from" className="text-xs">De</Label>
                      <Input
                        id="mon-from"
                        type="date"
                        value={prefs.customFrom ?? ""}
                        onChange={(e) => setPrefs((p) => ({ ...p, customFrom: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="mon-to" className="text-xs">Até</Label>
                      <Input
                        id="mon-to"
                        type="date"
                        value={prefs.customTo ?? ""}
                        onChange={(e) => setPrefs((p) => ({ ...p, customTo: e.target.value }))}
                      />
                    </div>
                  </div>
                )}
              </Section>

              <Section title="Padrões globais" desc="Aplicados a todos os slides sem ajuste individual.">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-lg border bg-card p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Animações</p>
                      <p className="text-xs text-muted-foreground">Transição entre slides</p>
                    </div>
                    <Switch
                      checked={globalAnim}
                      onCheckedChange={(v) => setPrefs((p) => ({ ...p, animationsEnabled: v }))}
                    />
                  </div>
                  <div className="rounded-lg border bg-card p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Tempo por slide</p>
                        <p className="text-xs text-muted-foreground">Duração padrão</p>
                      </div>
                      <select
                        value={globalDur}
                        onChange={(e) => setPrefs((p) => ({ ...p, slideDurationMs: Number(e.target.value) }))}
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                      >
                        {DURATION_OPTIONS.map((v) => (
                          <option key={v} value={v}>{v / 1000}s</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="rounded-lg border bg-card p-3 sm:col-span-2">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div>
                        <p className="text-sm font-medium">Velocidade do efeito aeroporto (split-flap)</p>
                        <p className="text-xs text-muted-foreground">
                          Tempo de cada meio-giro. Menor = mais rápido. Atual: {prefs.flapSpeedMs ?? 70}ms
                        </p>
                      </div>
                      <span className="text-xs tabular-nums px-2 py-1 rounded bg-muted">{prefs.flapSpeedMs ?? 70}ms</span>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={250}
                      step={5}
                      value={prefs.flapSpeedMs ?? 70}
                      onChange={(e) => setPrefs((p) => ({ ...p, flapSpeedMs: Number(e.target.value) }))}
                      className="w-full accent-primary"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                      <span>Rápido (20ms)</span><span>Padrão (70ms)</span><span>Lento (250ms)</span>
                    </div>
                  </div>
                </div>
              </Section>


              {isAdmin && (
                <Section title="Gerenciamento (Admin)">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button asChild variant="outline" className="justify-start gap-2 h-auto py-3">
                      <Link to="/monitor/admin?tab=comunicados" onClick={() => onOpenChange(false)}>
                        <Megaphone className="w-4 h-4 text-primary" />
                        <div className="text-left">
                          <p className="text-sm font-medium">Comunicados</p>
                          <p className="text-xs text-muted-foreground">Publicar imagens / PDFs</p>
                        </div>
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="justify-start gap-2 h-auto py-3">
                      <Link to="/monitor/admin?tab=4meo" onClick={() => onOpenChange(false)}>
                        <Wrench className="w-4 h-4 text-primary" />
                        <div className="text-left">
                          <p className="text-sm font-medium">Alterações 4M/EO</p>
                          <p className="text-xs text-muted-foreground">Engenharia / pontos de corte</p>
                        </div>
                      </Link>
                    </Button>
                  </div>
                </Section>
              )}
            </TabsContent>

            {/* ======= SLIDES (lista master) ======= */}
            <TabsContent value="slides" className="mt-0 space-y-2">
              <p className="text-xs text-muted-foreground mb-2">
                Selecione os slides que devem aparecer no monitor. Use as abas acima para ajustar tempo e animação de cada um.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {BLOCK_OPTIONS.map((opt) => {
                  const active = prefs.blocks.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggle(opt.id)}
                      className={cn(
                        "text-left rounded-lg border p-3 transition-all duration-200 hover:scale-[1.01]",
                        active
                          ? "border-primary bg-primary/10 ring-1 ring-primary shadow-sm shadow-primary/20"
                          : "border-border bg-card hover:bg-muted/50",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-xl leading-none">{opt.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm flex items-center gap-1.5">
                            {opt.title}
                            {active && <Check className="w-3.5 h-3.5 text-primary" />}
                          </p>
                          <p className="text-xs text-muted-foreground leading-snug">{opt.desc}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </TabsContent>

            {/* ======= POR SLIDE ======= */}
            {enabledBlocks.map((b) => {
              const s = prefs.blockSettings?.[b.id] ?? {};
              const effDur = s.durationMs ?? globalDur;
              const effAnim = s.animations ?? globalAnim;
              const usingDurOverride = s.durationMs !== undefined;
              const usingAnimOverride = s.animations !== undefined;
              return (
                <TabsContent key={b.id} value={`b:${b.id}`} className="mt-0 space-y-4">
                  <div className="flex flex-wrap items-start gap-3 p-3 rounded-lg border bg-card">
                    <span className="text-3xl leading-none">{b.emoji}</span>
                    <div className="flex-1 min-w-[140px]">
                      <p className="font-medium">{b.title}</p>
                      <p className="text-xs text-muted-foreground">{b.desc}</p>
                    </div>
                    {(usingDurOverride || usingAnimOverride) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => resetBlock(b.id)}
                        title="Voltar a usar o tempo e animação globais"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Redefinir
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant={prefs.blocks.includes(b.id) ? "default" : "outline"}
                      onClick={() => toggle(b.id)}
                    >
                      {prefs.blocks.includes(b.id) ? "Ativo" : "Inativo"}
                    </Button>
                  </div>

                  <div className="rounded-lg border bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Tempo deste slide</p>
                        <p className="text-xs text-muted-foreground">
                          {usingDurOverride
                            ? `Sobrescrevendo o padrão (${globalDur / 1000}s)`
                            : `Usando o padrão global (${globalDur / 1000}s)`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={effDur}
                          onChange={(e) => setBlockSetting(b.id, { durationMs: Number(e.target.value) })}
                          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          {DURATION_OPTIONS.map((v) => (
                            <option key={v} value={v}>{v / 1000}s</option>
                          ))}
                        </select>
                        {usingDurOverride && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setBlockSetting(b.id, { durationMs: undefined })}
                          >
                            Padrão
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-3 border-t">
                      <div>
                        <p className="text-sm font-medium">Animação ao entrar</p>
                        <p className="text-xs text-muted-foreground">
                          {usingAnimOverride
                            ? `Sobrescrevendo (global: ${globalAnim ? "ativadas" : "desativadas"})`
                            : `Usando o padrão global (${globalAnim ? "ativadas" : "desativadas"})`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={effAnim}
                          onCheckedChange={(v) => setBlockSetting(b.id, { animations: v })}
                        />
                        {usingAnimOverride && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setBlockSetting(b.id, { animations: undefined })}
                          >
                            Padrão
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {b.id === "ultimos_defeitos" && (
                    <UltimosDefeitosExtras
                      setting={s}
                      onChange={(patch) => setBlockSetting(b.id, patch)}
                    />
                  )}

                  {b.id === "inspecionado" && (
                    <InspecionadoExtras
                      setting={s}
                      onChange={(patch) => setBlockSetting(b.id, patch)}
                    />
                  )}


                  <SlidePreview
                    blockId={b.id}
                    emoji={b.emoji}
                    title={b.title}
                    durationMs={effDur}
                    animations={effAnim}
                    data={previewData}
                  />
                </TabsContent>
              );
            })}
          </div>
        </Tabs>

        <DialogFooter className="px-4 sm:px-6 py-3 border-t bg-muted/30 gap-2 shrink-0 flex flex-col sm:flex-row sm:justify-between sm:items-center pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                savePrefs(prefs);
                toast.success("Configurações salvas", { description: "Estas serão usadas na próxima abertura.", duration: 1800 });
              }}
            >
              <Check className="w-3.5 h-3.5" /> Salvar configurações
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={() => {
                const reset = { ...defaultPrefs, blockSettings: {} };
                setPrefs(reset);
                savePrefs(reset);
                toast.success("Padrão de fábrica restaurado", { description: "Todas as configurações voltaram ao original.", duration: 2000 });
              }}
            >
              <RotateCcw className="w-3.5 h-3.5" /> Padrão de Fábrica
            </Button>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button disabled={!canConfirm} onClick={handleConfirm}>{confirmLabel}</Button>
          </div>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
};

const DESC_COLOR_OPTIONS: { id: DescStyleColor; label: string; sw: string }[] = [
  { id: "default", label: "Padrão", sw: "bg-foreground/80" },
  { id: "rose", label: "Rosa", sw: "bg-rose-400" },
  { id: "amber", label: "Âmbar", sw: "bg-amber-400" },
  { id: "emerald", label: "Verde", sw: "bg-emerald-400" },
  { id: "sky", label: "Azul", sw: "bg-sky-400" },
  { id: "violet", label: "Violeta", sw: "bg-violet-400" },
];

export const descStyleClasses = (style?: DefectsDescStyle): string => {
  const color = style?.color ?? "default";
  const weight = style?.weight ?? "normal";
  const size = style?.size ?? "md";
  const colorCls =
    color === "rose"    ? "text-rose-300"    :
    color === "amber"   ? "text-amber-300"   :
    color === "emerald" ? "text-emerald-300" :
    color === "sky"     ? "text-sky-300"     :
    color === "violet"  ? "text-violet-300"  :
                          "text-foreground/90";
  const weightCls = weight === "bold" ? "font-bold" : weight === "semibold" ? "font-semibold" : "font-normal";
  const sizeCls = size === "lg" ? "text-lg" : size === "sm" ? "text-sm" : "text-base";
  return cn(colorCls, weightCls, sizeCls, style?.italic && "italic");
};

const InspecionadoExtras = ({
  setting,
  onChange,
}: {
  setting: MonitorBlockSetting;
  onChange: (patch: MonitorBlockSetting) => void;
}) => {
  const sps = setting.inspSuppliersPerSlide ?? 6;
  const ppg = setting.inspPartsPerGroup ?? 2;
  const fs = setting.inspFontScale ?? 1;
  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-medium">Fornecedores por slide</p>
          <p className="text-xs text-muted-foreground">Quantos cards de fornecedor mostrar por vez.</p>
        </div>
        <div className="inline-flex rounded-md border bg-background p-0.5">
          {[2, 3, 4, 6, 9].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange({ inspSuppliersPerSlide: n })}
              className={cn(
                "h-8 w-10 text-sm rounded-sm transition-colors tabular-nums",
                sps === n ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap pt-3 border-t">
        <div>
          <p className="text-sm font-medium">Linhas (peças) por fornecedor</p>
          <p className="text-xs text-muted-foreground">Peças visíveis simultaneamente em cada card (rotaciona o restante).</p>
        </div>
        <div className="inline-flex rounded-md border bg-background p-0.5">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange({ inspPartsPerGroup: n })}
              className={cn(
                "h-8 w-10 text-sm rounded-sm transition-colors tabular-nums",
                ppg === n ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="pt-3 border-t space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-medium">Tamanho da fonte</p>
            <p className="text-xs text-muted-foreground">Escala do nome do fornecedor, peças e quantidades. Atual: {Math.round(fs * 100)}%</p>
          </div>
          <span className="text-xs tabular-nums px-2 py-1 rounded bg-muted">{Math.round(fs * 100)}%</span>
        </div>
        <input
          type="range"
          min={0.6}
          max={1.6}
          step={0.05}
          value={fs}
          onChange={(e) => onChange({ inspFontScale: Number(e.target.value) })}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>60%</span><span>100%</span><span>160%</span>
        </div>
      </div>
    </div>
  );
};

const UltimosDefeitosExtras = ({

  setting,
  onChange,
}: {
  setting: MonitorBlockSetting;
  onChange: (patch: MonitorBlockSetting) => void;
}) => {
  const perSlide = setting.perSlide ?? 4;
  const ds: DefectsDescStyle = setting.descStyle ?? {};
  const setDs = (patch: Partial<DefectsDescStyle>) =>
    onChange({ descStyle: { ...ds, ...patch } });

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-medium">Defeitos por slide</p>
          <p className="text-xs text-muted-foreground">Quantos cartões mostrar por vez (2 a 5).</p>
        </div>
        <div className="inline-flex rounded-md border bg-background p-0.5">
          {[2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange({ perSlide: n as 2 | 3 | 4 | 5 })}
              className={cn(
                "h-8 w-10 text-sm rounded-sm transition-colors tabular-nums",
                perSlide === n ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-3 border-t space-y-3">
        <div>
          <p className="text-sm font-medium">Estilo da Descrição</p>
          <p className="text-xs text-muted-foreground">Personaliza cor, peso e tamanho do texto de descrição.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {DESC_COLOR_OPTIONS.map((c) => {
            const active = (ds.color ?? "default") === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setDs({ color: c.id })}
                className={cn(
                  "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-xs",
                  active ? "border-primary ring-1 ring-primary bg-primary/5" : "border-border hover:bg-muted",
                )}
              >
                <span className={cn("w-3 h-3 rounded-full", c.sw)} />
                {c.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground mr-1">Peso:</span>
          {(["normal","semibold","bold"] as DescStyleWeight[]).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setDs({ weight: w })}
              className={cn(
                "h-8 px-3 rounded-md border text-xs",
                (ds.weight ?? "normal") === w ? "border-primary bg-primary/5" : "border-border hover:bg-muted",
                w === "bold" && "font-bold",
                w === "semibold" && "font-semibold",
              )}
            >
              {w === "normal" ? "Normal" : w === "semibold" ? "Semi" : "Negrito"}
            </button>
          ))}

          <span className="text-xs text-muted-foreground ml-3 mr-1">Tamanho:</span>
          {(["sm","md","lg"] as DescStyleSize[]).map((sz) => (
            <button
              key={sz}
              type="button"
              onClick={() => setDs({ size: sz })}
              className={cn(
                "h-8 px-3 rounded-md border text-xs",
                (ds.size ?? "md") === sz ? "border-primary bg-primary/5" : "border-border hover:bg-muted",
              )}
            >
              {sz === "sm" ? "P" : sz === "md" ? "M" : "G"}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setDs({ italic: !ds.italic })}
            className={cn(
              "h-8 px-3 rounded-md border text-xs italic ml-3",
              ds.italic ? "border-primary bg-primary/5" : "border-border hover:bg-muted",
            )}
          >
            Itálico
          </button>

          {(ds.color || ds.weight || ds.size || ds.italic) && (
            <Button size="sm" variant="ghost" className="h-8 ml-auto" onClick={() => onChange({ descStyle: undefined })}>
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Redefinir estilo
            </Button>
          )}
        </div>

        <p className={cn("rounded-md border bg-muted/30 px-3 py-2", descStyleClasses(ds))}>
          Exemplo: descrição do defeito detectado durante a inspeção.
        </p>
      </div>
    </div>
  );
};

const Section = ({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <div>
      <p className="text-sm font-semibold">{title}</p>
      {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
    </div>
    {children}
  </div>
);

const ChoiceCard = ({ active, onClick, title, desc }: { active: boolean; onClick: () => void; title: string; desc: string }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex-1 basis-[260px] min-w-0 text-left rounded-lg border p-3 transition-all",
      active ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border bg-card hover:bg-muted/50",
    )}
  >
    <p className="text-sm font-medium flex items-center gap-1.5">
      <span className="truncate">{title}</span>
      {active && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
    </p>
    <p className="text-xs text-muted-foreground">{desc}</p>
  </button>
);

/**
 * Live preview of how this slide will enter and how long it will stay on screen.
 * Replays automatically when duration/animations change, with a Repetir button.
 */
const SlidePreview = ({
  blockId,
  emoji,
  title,
  durationMs,
  animations,
  data,
}: {
  blockId: MonitorBlock;
  emoji: string;
  title: string;
  durationMs: number;
  animations: boolean;
  data: PreviewData;
}) => {
  const [runKey, setRunKey] = useState(0);
  const [phase, setPhase] = useState<"idle" | "running">("idle");
  const [remaining, setRemaining] = useState(durationMs);

  useEffect(() => {
    setRunKey((k) => k + 1);
    setPhase("running");
    setRemaining(durationMs);
  }, [durationMs, animations]);

  useEffect(() => {
    if (phase !== "running") return;
    const start = Date.now();
    const tick = window.setInterval(() => {
      const left = Math.max(0, durationMs - (Date.now() - start));
      setRemaining(left);
      if (left <= 0) {
        setPhase("idle");
        window.clearInterval(tick);
      }
    }, 100);
    return () => window.clearInterval(tick);
  }, [phase, durationMs, runKey]);

  const replay = () => {
    setRunKey((k) => k + 1);
    setPhase("running");
    setRemaining(durationMs);
  };

  const hasRealData = data.loading ? null : blockHasRealData(blockId, data);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Pré-visualização</p>
          <p className="text-xs text-muted-foreground">
            Veja como o slide entra e quanto tempo permanece ({(durationMs / 1000).toFixed(0)}s
            {animations ? ", com animação" : ", sem animação"}).
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={replay} className="gap-1.5">
          <RotateCcw className="w-3.5 h-3.5" />
          Repetir
        </Button>
      </div>

      {data.loading && (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground px-2 py-1.5 rounded border bg-muted/30">
          <Loader2 className="w-3 h-3 animate-spin" />
          Carregando dados reais do monitor…
        </div>
      )}
      {!data.loading && hasRealData === false && (
        <div className="flex items-center gap-2 text-[11px] text-amber-600 dark:text-amber-400 px-2 py-1.5 rounded border border-amber-500/30 bg-amber-500/10">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span>Sem dados reais para este slide — exibindo um exemplo ilustrativo.</span>
        </div>
      )}
      {!data.loading && hasRealData === true && (
        <div className="flex items-center gap-2 text-[11px] text-emerald-600 dark:text-emerald-400 px-2 py-1.5 rounded border border-emerald-500/30 bg-emerald-500/10">
          <Check className="w-3 h-3 shrink-0" />
          <span>Pré-visualizando com dados reais do monitor.</span>
        </div>
      )}

      <div className="relative h-64 sm:h-80 rounded-md border bg-gradient-to-br from-muted/40 to-muted/10 overflow-hidden">
        <div
          key={runKey}
          className={cn(
            "absolute inset-0 flex flex-col",
            animations && "animate-enter",
          )}
        >
          <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-background/60">
            <span className="text-base leading-none">{emoji}</span>
            <span className="text-xs font-semibold">{title}</span>
            <span className="ml-auto text-[9px] uppercase tracking-wider text-muted-foreground">
              espelho do monitor
            </span>
          </div>
          <div className="flex-1 min-h-0 bg-background">
            <iframe
              key={`iframe-${blockId}-${runKey}`}
              src={`/monitor?preview=${blockId}&chrome=off`}
              title={`Pré-visualização ${title}`}
              className="w-full h-full border-0"
              loading="lazy"
            />
          </div>
        </div>
      </div>


      <div className="space-y-1">
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            key={`bar-${runKey}`}
            className="h-full bg-primary"
            style={{
              width: phase === "running" ? "0%" : "100%",
              transition: phase === "running" ? `width ${durationMs}ms linear` : "none",
            }}
            ref={(el) => {
              if (el && phase === "running") {
                el.getBoundingClientRect();
                el.style.width = "100%";
              }
            }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
          <span>{phase === "running" ? "Em exibição…" : "Concluído"}</span>
          <span>{(remaining / 1000).toFixed(1)}s restantes</span>
        </div>
      </div>
    </div>
  );
};

// ---- Real-data fetching for previews -------------------------------------------------

interface PreviewData {
  loading: boolean;
  apontamentos: any[];
  alertas: any[];
  contencoes: any[];
  consumiveis: any[];
  slidesMedia: any[];
}

const EMPTY_PREVIEW: PreviewData = {
  loading: false,
  apontamentos: [],
  alertas: [],
  contencoes: [],
  consumiveis: [],
  slidesMedia: [],
};

const usePreviewData = (open: boolean): PreviewData => {
  const [data, setData] = useState<PreviewData>({ ...EMPTY_PREVIEW, loading: true });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setData((d) => ({ ...d, loading: true }));

    const startISO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    Promise.all([
      monitorClient.from("apontamentos").select("*").gte("created_at", startISO).order("created_at", { ascending: false }).limit(100),
      monitorClient.from("alertas_qualidade").select("*").neq("status", "rascunho").order("created_at", { ascending: false }).limit(10),
      monitorClient.from("contencao").select("*").order("created_at", { ascending: false }).limit(10),
      monitorClient.from("consumable_items").select("*").eq("active", true),
      monitorClient.from("monitor_slides_media").select("*").eq("ativo", true).order("ordem", { ascending: true }),
    ])
      .then(([ap, al, co, cs, sm]) => {
        if (cancelled) return;
        setData({
          loading: false,
          apontamentos: ap.data ?? [],
          alertas: al.data ?? [],
          contencoes: co.data ?? [],
          consumiveis: cs.data ?? [],
          slidesMedia: sm.data ?? [],
        });
      })
      .catch(() => {
        if (!cancelled) setData({ ...EMPTY_PREVIEW, loading: false });
      });

    return () => { cancelled = true; };
  }, [open]);

  return data;
};

const blockHasRealData = (id: MonitorBlock, d: PreviewData): boolean => {
  switch (id) {
    case "summary":
    case "recent":
    case "ranking":
    case "defects":
    case "inspecionado":
    case "ultimos_defeitos":
    case "alteracoes_4m":
      return d.apontamentos.length > 0;
    case "alerts": return d.alertas.length > 0;
    case "contencao": return d.contencoes.length > 0;
    case "consumiveis": return d.consumiveis.filter((c: any) => (c.stock_qty ?? 0) <= (c.min_qty ?? 0)).length > 0;
    case "comunicados": return d.slidesMedia.length > 0;
    default: return false;
  }
};

/**
 * Mini-mock of each Monitor block. Uses real data when present, falls back
 * to a stylized example otherwise (with a warning banner in SlidePreview).
 */
const BlockMock = ({ id, data }: { id: MonitorBlock; data: PreviewData }) => {
  const wrap = "h-full w-full text-[10px] leading-tight";
  const hasReal = blockHasRealData(id, data);
  switch (id) {
    case "summary": {
      const total = data.apontamentos.length;
      const ng = data.apontamentos.filter((a: any) => (a.ng_qty ?? a.qty_ng ?? 0) > 0).length;
      const ok = total - ng;
      const ppm = total ? ((ng / total) * 1_000_000).toFixed(0) : "0";
      const cells = hasReal
        ? [
            { l: "Total", v: total.toString(), c: "bg-primary/10 text-primary" },
            { l: "OK", v: ok.toString(), c: "bg-emerald-500/10 text-emerald-600" },
            { l: "NG", v: ng.toString(), c: "bg-destructive/10 text-destructive" },
            { l: "PPM", v: ppm, c: "bg-amber-500/10 text-amber-600" },
          ]
        : [
            { l: "Total", v: "1.248", c: "bg-primary/10 text-primary" },
            { l: "OK", v: "1.190", c: "bg-emerald-500/10 text-emerald-600" },
            { l: "NG", v: "58", c: "bg-destructive/10 text-destructive" },
            { l: "PPM", v: "46.5", c: "bg-amber-500/10 text-amber-600" },
          ];
      return (
        <div className={cn(wrap, "grid grid-cols-4 gap-2")}>
          {cells.map((k) => (
            <div key={k.l} className={cn("rounded-md p-2 flex flex-col justify-center", k.c)}>
              <span className="opacity-70">{k.l}</span>
              <span className="text-base font-bold">{k.v}</span>
            </div>
          ))}
        </div>
      );
    }
    case "recent": {
      const rows = hasReal
        ? data.apontamentos.slice(0, 4).map((a: any, i: number) => ({
            pn: a.part_number || a.pn || `PN-${i}`,
            forn: (a.supplier || a.fornecedor || "—").toString().slice(0, 6),
            qty: a.qty ?? a.total_qty ?? 0,
            ng: (a.ng_qty ?? 0) > 0,
          }))
        : ["A123","B477","C902","D118"].map((p, i) => ({ pn: `PN-${p}`, forn: `F${i+1}`, qty: [24,3,18,9][i], ng: i===1 }));
      return (
        <div className={cn(wrap, "space-y-1")}>
          <div className="flex gap-2 px-2 py-1 bg-muted/60 rounded text-[9px] font-semibold uppercase">
            <span className="flex-1">Peça</span><span className="w-12">Forn.</span><span className="w-10 text-right">Qtd</span>
          </div>
          {rows.map((r, i) => (
            <div key={i} className="flex gap-2 px-2 py-1 rounded bg-card border">
              <span className="flex-1 truncate">{r.pn}</span>
              <span className="w-12 truncate text-muted-foreground">{r.forn}</span>
              <span className={cn("w-10 text-right font-medium", r.ng && "text-destructive")}>{r.qty}</span>
            </div>
          ))}
        </div>
      );
    }
    case "alerts":
    case "contencao": {
      const list = id === "alerts" ? data.alertas : data.contencoes;
      const items = hasReal
        ? list.slice(0, 3).map((x: any) => ({
            c: x.severity === "alta" || x.criticidade === "alta" ? "bg-destructive" : x.severity === "media" ? "bg-amber-500" : "bg-primary",
            t: x.titulo || x.title || x.descricao || "Registro",
          }))
        : [
            { c: "bg-destructive", t: "Risco crítico — PN-B477" },
            { c: "bg-amber-500", t: "Atenção — PN-C902" },
            { c: "bg-primary", t: "Informativo — PN-D118" },
          ];
      return (
        <div className={cn(wrap, "space-y-1.5")}>
          {items.map((a, i) => (
            <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded border bg-card">
              <span className={cn("w-1.5 h-6 rounded-full", a.c)} />
              <span className="truncate">{a.t}</span>
            </div>
          ))}
        </div>
      );
    }
    case "consumiveis": {
      const crit = data.consumiveis.filter((c: any) => (c.stock_qty ?? 0) <= (c.min_qty ?? 0));
      const items = hasReal
        ? crit.slice(0, 4).map((c: any) => ({
            n: (c.name || c.nome || "Item").toString().slice(0, 10),
            qty: c.stock_qty ?? 0,
            pct: Math.min(100, ((c.stock_qty ?? 0) / Math.max(1, c.min_qty ?? 1)) * 100),
          }))
        : ["Luvas","Cones","Adesivo","Sacos"].map((n, i) => ({ n, qty: [2,5,1,3][i], pct: [15,30,8,22][i] }));
      return (
        <div className={cn(wrap, "grid grid-cols-2 gap-2")}>
          {items.map((c, i) => (
            <div key={i} className="rounded border bg-card p-2">
              <div className="flex justify-between"><span>{c.n}</span><span className="text-destructive font-bold">{c.qty}</span></div>
              <div className="h-1 mt-1 bg-muted rounded"><div className="h-full bg-destructive rounded" style={{ width: `${c.pct}%` }} /></div>
            </div>
          ))}
        </div>
      );
    }
    case "ranking": {
      const counts: Record<string, number> = {};
      data.apontamentos.forEach((a: any) => {
        const k = (a.supplier || a.fornecedor || "—").toString();
        if (!k) return;
        counts[k] = (counts[k] || 0) + ((a.ng_qty ?? 0) > 0 ? 1 : 0);
      });
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4);
      const max = sorted[0]?.[1] || 1;
      const rows = hasReal && sorted.length
        ? sorted.map(([n, v]) => ({ n: n.slice(0, 8), v, pct: (v / max) * 100 }))
        : ["Fornec. A","Fornec. B","Fornec. C","Fornec. D"].map((n, i) => ({ n, v: [18,42,67,93][i], pct: [90,70,50,30][i] }));
      return (
        <div className={cn(wrap, "space-y-1")}>
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-16 truncate">{r.n}</span>
              <div className="flex-1 h-2 bg-muted rounded"><div className="h-full bg-primary rounded" style={{ width: `${r.pct}%` }} /></div>
              <span className="w-8 text-right">{r.v}</span>
            </div>
          ))}
        </div>
      );
    }
    case "defects": {
      const counts: Record<string, number> = {};
      data.apontamentos.forEach((a: any) => {
        const fm = a.failure_mode || a.modo_falha;
        if (!fm) return;
        counts[fm] = (counts[fm] || 0) + 1;
      });
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
      const max = sorted[0]?.[1] || 1;
      const bars = hasReal && sorted.length
        ? sorted.map(([n, v]) => ({ h: (v / max) * 100, label: n.slice(0, 4) }))
        : [80,55,45,30,22,15].map((h, i) => ({ h, label: `MF${i+1}` }));
      return (
        <div className={cn(wrap, "flex items-end gap-2 h-full pb-4")}>
          {bars.map((b, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full bg-primary rounded-t" style={{ height: `${b.h}%` }} />
              <span className="text-[8px] truncate">{b.label}</span>
            </div>
          ))}
        </div>
      );
    }
    case "inspecionado": {
      const counts: Record<string, number> = {};
      data.apontamentos.forEach((a: any) => {
        const k = (a.supplier || a.fornecedor || "—").toString();
        counts[k] = (counts[k] || 0) + (a.qty ?? 1);
      });
      const cells = hasReal
        ? Object.entries(counts).slice(0, 6).map(([n, v]) => ({ n: n.slice(0, 6), v: v.toString().padStart(4, "0") }))
        : Array.from({ length: 6 }).map((_, i) => ({ n: `Forn. ${String.fromCharCode(65+i)}`, v: (123 + i*47).toString().padStart(4,"0") }));
      return (
        <div className={cn(wrap, "grid grid-cols-3 gap-1.5")}>
          {cells.map((c, i) => (
            <div key={i} className="rounded border bg-card p-1.5 text-center">
              <div className="text-[8px] text-muted-foreground">{c.n}</div>
              <div className="font-mono font-bold text-sm tabular-nums">{c.v}</div>
            </div>
          ))}
        </div>
      );
    }
    case "comunicados": {
      const items = hasReal
        ? data.slidesMedia.slice(0, 3).map((m: any, i: number) => ({ t: m.titulo || m.title || `Comunicado ${i+1}` }))
        : [1,2,3].map((i) => ({ t: `Comunicado ${i}` }));
      return (
        <div className={cn(wrap, "grid grid-cols-3 gap-1.5 h-full")}>
          {items.map((m, i) => (
            <div key={i} className="rounded border bg-card p-2 flex flex-col items-center justify-center gap-1">
              <div className="w-full h-8 bg-gradient-to-br from-primary/30 to-primary/10 rounded" />
              <span className="text-[9px] truncate w-full text-center">{m.t}</span>
            </div>
          ))}
        </div>
      );
    }
    case "alteracoes_4m":
      return (
        <div className={cn(wrap, "space-y-1")}>
          {["Material — Lote X","Método — Setup A","Máquina — Inj. 03"].map((t) => (
            <div key={t} className="flex items-center gap-2 px-2 py-1.5 rounded border bg-card">
              <span className="w-6 h-6 rounded bg-primary/15 text-primary flex items-center justify-center font-bold">M</span>
              <span className="flex-1 truncate">{t}</span>
            </div>
          ))}
        </div>
      );
    case "ultimos_defeitos": {
      const ngs = data.apontamentos.filter((a: any) => (a.ng_qty ?? 0) > 0).slice(0, 4);
      const cards = hasReal && ngs.length
        ? ngs.map((a: any, i: number) => ({ label: `NG #${a.sequence_number ?? a.id?.toString().slice(0, 4) ?? 1000 + i}` }))
        : Array.from({ length: 4 }).map((_, i) => ({ label: `NG #${1000 + i}` }));
      return (
        <div className={cn(wrap, "grid grid-cols-4 gap-1.5 h-full")}>
          {cards.map((c, i) => (
            <div key={i} className="rounded border bg-card overflow-hidden flex flex-col">
              <div className="flex-1 bg-gradient-to-br from-destructive/30 to-destructive/10" />
              <div className="px-1 py-0.5 text-[9px] truncate">{c.label}</div>
            </div>
          ))}
        </div>
      );
    }
    default:
      return <div className="h-full w-full bg-muted/30 rounded" />;
  }
};

