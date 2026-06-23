import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

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

export interface MonitorPreferences {
  blocks: MonitorBlock[];
  period: MonitorPeriod;
  customFrom?: string;
  customTo?: string;
  theme: MonitorTheme;
  profile?: MonitorProfile;
}

const STORAGE_KEY = "monitor_preferences";

export const defaultPrefs: MonitorPreferences = {
  blocks: ["summary", "recent", "alerts"],
  period: "today",
  theme: "dark",
  profile: "default",
};

export const loadPrefs = (): MonitorPreferences => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPrefs;
    const p = JSON.parse(raw);
    if (!Array.isArray(p.blocks) || !p.period) return defaultPrefs;
    return { theme: "dark", ...p } as MonitorPreferences;
  } catch {
    return defaultPrefs;
  }
};

export const savePrefs = (p: MonitorPreferences) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* noop */ }
};

const BLOCK_OPTIONS: { id: MonitorBlock; emoji: string; title: string; desc: string }[] = [
  { id: "summary", emoji: "📊", title: "Resumo do Período", desc: "Total de registros, NG, OK e PPM" },
  { id: "recent", emoji: "📋", title: "Últimos Lançamentos", desc: "Tabela em tempo real (V2 mostra Rate de Aprovação)" },
  { id: "alerts", emoji: "⚠️", title: "Alertas de Qualidade", desc: "Lista mestra de alertas com detalhes" },
  { id: "contencao", emoji: "🔴", title: "Contenções", desc: "Em andamento e finalizadas (V2)" },
  { id: "consumiveis", emoji: "📦", title: "Consumíveis Críticos", desc: "Itens abaixo do estoque mínimo" },
  { id: "ranking", emoji: "🏆", title: "Performance de Fornecedores", desc: "Top piores em destaque (V2)" },
  { id: "defects", emoji: "📈", title: "Principais Modos de Falhas", desc: "Modos de falha mais detectados" },
  { id: "inspecionado", emoji: "🔍", title: "Monitoramento de Inspeção", desc: "Split-flap por fornecedor (V2)" },
  { id: "comunicados", emoji: "📣", title: "Comunicados", desc: "Imagens enviadas pela Mobis (V2)" },
  { id: "alteracoes_4m", emoji: "🛠️", title: "Alterações 4M/EO e Validações", desc: "Avisos de engenharia (V2)" },
  { id: "ultimos_defeitos", emoji: "🔬", title: "Últimos Defeitos Detectados", desc: "Últimos NG com fotos (V2)" },
];

const PERIOD_OPTIONS: { id: MonitorPeriod; label: string }[] = [
  { id: "today", label: "Hoje" },
  { id: "week", label: "Esta semana" },
  { id: "month", label: "Este mês" },
  { id: "custom", label: "Personalizado" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: MonitorPreferences;
  onConfirm: (prefs: MonitorPreferences) => void;
  confirmLabel?: string;
}

export const MonitorDialog = ({ open, onOpenChange, initial, onConfirm, confirmLabel = "Abrir Monitor" }: Props) => {
  const [prefs, setPrefs] = useState<MonitorPreferences>(initial ?? loadPrefs());

  useEffect(() => {
    if (open) setPrefs(initial ?? loadPrefs());
  }, [open, initial]);

  const toggle = (id: MonitorBlock) => {
    setPrefs((p) => ({
      ...p,
      blocks: p.blocks.includes(id) ? p.blocks.filter((b) => b !== id) : [...p.blocks, id],
    }));
  };

  const customValid = prefs.period !== "custom" || (!!prefs.customFrom && !!prefs.customTo && prefs.customFrom <= prefs.customTo);
  const canConfirm = prefs.blocks.length > 0 && customValid;

  const handleConfirm = () => {
    savePrefs(prefs);
    onConfirm(prefs);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>O que deseja exibir no monitor?</DialogTitle>
        </DialogHeader>

        {/* Theme */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Tema:</span>
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

        {/* Period */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Período:</span>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

        {/* Blocks grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 max-h-[45vh] overflow-y-auto pr-1">
          {BLOCK_OPTIONS.map((opt) => {
            const active = prefs.blocks.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggle(opt.id)}
                className={cn(
                  "text-left rounded-lg border p-3 transition-all duration-200 hover:scale-[1.02]",
                  active
                    ? "border-primary bg-primary/10 ring-1 ring-primary shadow-md shadow-primary/20"
                    : "border-border bg-card hover:bg-muted/50",
                )}
              >
                <div className="flex items-start gap-2">
                  <span className="text-xl leading-none">{opt.emoji}</span>
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{opt.title}</p>
                    <p className="text-xs text-muted-foreground leading-snug">{opt.desc}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!canConfirm} onClick={handleConfirm}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
