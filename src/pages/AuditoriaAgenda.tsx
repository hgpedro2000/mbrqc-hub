import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CalendarClock, List as ListIcon, Grid3x3, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import logo from "@/assets/hyundai-mobis-logo.png";

const STATUS_DOT: Record<string, string> = {
  planejada: "bg-slate-400",
  em_andamento: "bg-amber-400",
  aguardando_fornecedor: "bg-blue-400",
  respondida: "bg-violet-400",
  concluida: "bg-emerald-400",
  atrasada: "bg-red-500",
};
const STATUS_LABELS: Record<string, string> = {
  planejada: "Planejada",
  em_andamento: "Em andamento",
  aguardando_fornecedor: "Aguardando fornecedor",
  respondida: "Respondida",
  concluida: "Concluída",
  atrasada: "Atrasada",
};

type A = { id: string; code: string | null; title: string; supplier_name: string; status: string; audit_date_start: string | null; audit_date_end: string | null };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const parse = (s: string) => new Date(s + "T12:00:00");
const daysBetween = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / 86400000);

export default function AuditoriaAgenda() {
  const navigate = useNavigate();
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });

  const { data: audits = [] } = useQuery({
    queryKey: ["audits-agenda"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audits")
        .select("id, code, title, supplier_name, status, audit_date_start, audit_date_end")
        .not("audit_date_start", "is", null)
        .order("audit_date_start", { ascending: true });
      if (error) throw error;
      return (data ?? []) as A[];
    },
  });

  const byDay = useMemo(() => {
    const m = new Map<string, A[]>();
    for (const a of audits) {
      if (!a.audit_date_start) continue;
      const start = parse(a.audit_date_start);
      const end = a.audit_date_end ? parse(a.audit_date_end) : start;
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = iso(d);
        if (!m.has(key)) m.set(key, []);
        m.get(key)!.push(a);
      }
    }
    return m;
  }, [audits]);

  // Calendar grid
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const todayStr = iso(new Date());

  // List grouping
  const today = parse(iso(new Date()));
  const groups = useMemo(() => {
    const g: Record<string, A[]> = { "Esta semana": [], "Próximas 2 semanas": [], "Este mês": [], "Futuras": [] };
    for (const a of audits) {
      if (!a.audit_date_start) continue;
      const d = parse(a.audit_date_start);
      const diff = daysBetween(d, today);
      if (diff < -1) continue; // hide long past
      if (diff <= 7) g["Esta semana"].push(a);
      else if (diff <= 14) g["Próximas 2 semanas"].push(a);
      else if (diff <= 30) g["Este mês"].push(a);
      else g["Futuras"].push(a);
    }
    return g;
  }, [audits, today]);

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <Button variant="ghost" onClick={() => navigate("/auditorias")} className="header-btn header-btn-back">
                <ArrowLeft className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Auditorias</span>
              </Button>
              <img src={logo} alt="Hyundai Mobis" className="h-6 sm:h-8 object-contain bg-white rounded-md px-2 py-0.5" />
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 mt-3 md:mt-4">
            <CalendarClock className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8" />
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-heading font-bold">Agenda de Auditorias</h1>
              <p className="text-primary-foreground/70 text-xs md:text-sm">Visualização mensal e por prazo</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <Button variant={view === "calendar" ? "default" : "outline"} size="sm" onClick={() => setView("calendar")} className="gap-2">
              <Grid3x3 className="w-4 h-4" /> Calendário
            </Button>
            <Button variant={view === "list" ? "default" : "outline"} size="sm" onClick={() => setView("list")} className="gap-2">
              <ListIcon className="w-4 h-4" /> Lista
            </Button>
          </div>
          {view === "calendar" && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setCursor(new Date(year, month - 1, 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="text-sm font-semibold min-w-[140px] text-center capitalize">
                {cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
              </div>
              <Button variant="ghost" size="icon" onClick={() => setCursor(new Date(year, month + 1, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); }}>
                Hoje
              </Button>
            </div>
          )}
        </div>

        {view === "calendar" ? (
          <div className="form-section p-2 md:p-4">
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-2">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => <div key={d} className="py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, i) => {
                if (!d) return <div key={i} className="h-16 md:h-24 bg-muted/5 rounded" />;
                const key = iso(d);
                const items = byDay.get(key) ?? [];
                const isToday = key === todayStr;
                return (
                  <Popover key={i}>
                    <PopoverTrigger asChild>
                      <button
                        className={`h-16 md:h-24 p-1 rounded border transition text-left ${
                          isToday ? "border-accent bg-accent/10" : "border-border bg-card/50 hover:bg-muted/20"
                        } ${items.length === 0 ? "opacity-70" : ""}`}
                      >
                        <div className={`text-xs font-semibold mb-1 ${isToday ? "text-accent" : ""}`}>{d.getDate()}</div>
                        <div className="flex flex-wrap gap-0.5">
                          {items.slice(0, 4).map((a) => (
                            <span key={a.id} className={`w-2 h-2 rounded-full ${STATUS_DOT[a.status] ?? "bg-slate-400"}`} />
                          ))}
                          {items.length > 4 && <span className="text-[10px] text-muted-foreground">+{items.length - 4}</span>}
                        </div>
                      </button>
                    </PopoverTrigger>
                    {items.length > 0 && (
                      <PopoverContent className="w-72 p-2 bg-card border border-border">
                        <div className="text-xs text-muted-foreground mb-2 px-1">
                          {d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                        </div>
                        <div className="space-y-1">
                          {items.map((a) => (
                            <button
                              key={a.id}
                              onClick={() => navigate(`/auditorias/${a.id}`)}
                              className="w-full text-left p-2 rounded hover:bg-muted/30 flex items-start gap-2"
                            >
                              <span className={`w-2 h-2 mt-1.5 rounded-full ${STATUS_DOT[a.status] ?? "bg-slate-400"}`} />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{a.title}</div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {a.supplier_name} · {STATUS_LABELS[a.status] ?? a.status}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    )}
                  </Popover>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <span key={k} className="inline-flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${STATUS_DOT[k]}`} /> {v}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groups).map(([label, items]) => (
              <div key={label} className="form-section">
                <h3 className="font-heading font-semibold text-sm mb-3">{label} <span className="text-muted-foreground">({items.length})</span></h3>
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma auditoria</p>
                ) : (
                  <div className="space-y-2">
                    {items.map((a) => {
                      const d = parse(a.audit_date_start!);
                      const diff = daysBetween(d, today);
                      const urgent = diff >= 0 && diff < 3;
                      return (
                        <button
                          key={a.id}
                          onClick={() => navigate(`/auditorias/${a.id}`)}
                          className="w-full text-left p-3 rounded border border-border bg-card/50 hover:border-accent/30 flex items-center gap-3"
                        >
                          <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[a.status] ?? "bg-slate-400"}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {a.code && <span className="text-xs font-mono text-muted-foreground">#{a.code}</span>}
                              <span className="font-medium text-sm">{a.title}</span>
                              {urgent && (
                                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30">
                                  <AlertTriangle className="w-3 h-3" /> Urgente
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {a.supplier_name} · {d.toLocaleDateString("pt-BR")} · {STATUS_LABELS[a.status] ?? a.status}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
