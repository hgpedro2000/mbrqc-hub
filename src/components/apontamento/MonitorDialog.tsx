import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Moon, Sun, Settings2, Megaphone, Wrench, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";

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

export interface MonitorBlockSetting {
  durationMs?: number;
  animations?: boolean;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" />
            Configurar Monitor
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              {activeCount} slide{activeCount === 1 ? "" : "s"} ativo{activeCount === 1 ? "" : "s"}
            </span>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex flex-col">
          <ScrollArea className="w-full border-b">
            <TabsList className="h-auto p-1 m-2 inline-flex w-max bg-muted/40">
              <TabsTrigger value="geral" className="gap-1.5">
                <Settings2 className="w-3.5 h-3.5" /> Geral
              </TabsTrigger>
              <TabsTrigger value="slides" className="gap-1.5">
                📑 Slides
                <span className="ml-1 text-[10px] rounded-full bg-primary/15 text-primary px-1.5 py-0.5">
                  {activeCount}
                </span>
              </TabsTrigger>
              {enabledBlocks.map((b) => (
                <TabsTrigger key={b.id} value={`b:${b.id}`} className="gap-1.5">
                  <span>{b.emoji}</span>
                  <span className="max-w-[140px] truncate">{b.title}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
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
                  <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                    <span className="text-3xl leading-none">{b.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{b.title}</p>
                      <p className="text-xs text-muted-foreground">{b.desc}</p>
                    </div>
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
                </TabsContent>
              );
            })}
          </div>
        </Tabs>

        <DialogFooter className="px-6 py-3 border-t bg-muted/30 gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!canConfirm} onClick={handleConfirm}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
      "flex-1 min-w-[180px] text-left rounded-lg border p-3 transition-all",
      active ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border bg-card hover:bg-muted/50",
    )}
  >
    <p className="text-sm font-medium flex items-center gap-1.5">
      {title}
      {active && <Check className="w-3.5 h-3.5 text-primary" />}
    </p>
    <p className="text-xs text-muted-foreground">{desc}</p>
  </button>
);
