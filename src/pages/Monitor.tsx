import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MonitorDialog, loadPrefs, MonitorPreferences, MonitorPeriod } from "@/components/apontamento/MonitorDialog";
import { Settings, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

const periodStart = (p: MonitorPeriod): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (p === "today") return d;
  if (p === "week") {
    const dow = d.getDay();
    d.setDate(d.getDate() - dow);
    return d;
  }
  // month
  d.setDate(1);
  return d;
};

const fmtNum = (n: number) => new Intl.NumberFormat("pt-BR").format(n);

const Card = ({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) => (
  <div className={`bg-card border border-border rounded-xl p-4 flex flex-col min-h-0 ${className}`}>
    <h2 className="text-xl font-heading font-bold mb-3 text-foreground/90">{title}</h2>
    <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
  </div>
);

const Stat = ({ label, value, accent }: { label: string; value: string; accent?: string }) => (
  <div className="flex-1 text-center px-2 py-3 rounded-lg bg-muted/30">
    <p className="text-sm uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className={`text-4xl md:text-5xl font-bold mt-1 ${accent ?? "text-foreground"}`}>{value}</p>
  </div>
);

const Monitor = () => {
  const [prefs, setPrefs] = useState<MonitorPreferences>(loadPrefs());
  const [showSettings, setShowSettings] = useState(false);
  const [now, setNow] = useState(new Date());
  const [connected, setConnected] = useState(true);

  const [apontamentos, setApontamentos] = useState<any[]>([]);
  const [alertas, setAlertas] = useState<any[]>([]);
  const [contencoes, setContencoes] = useState<any[]>([]);
  const [consumiveis, setConsumiveis] = useState<any[]>([]);

  const startDate = useMemo(() => periodStart(prefs.period), [prefs.period]);

  // Tick clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Initial fetch (depends on period)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const iso = startDate.toISOString();
      const [a, al, ct, cs] = await Promise.all([
        supabase.from("apontamentos").select("*").gte("created_at", iso).order("created_at", { ascending: false }),
        supabase.from("alertas_qualidade").select("*").neq("status", "rascunho").order("created_at", { ascending: false }).limit(50),
        supabase.from("contencao").select("*").in("status", ["aberta", "em_andamento", "iniciada", "ativo"]).order("created_at", { ascending: false }).limit(50),
        supabase.from("consumable_items").select("*").eq("active", true),
      ]);
      if (cancelled) return;
      if (!a.error && a.data) setApontamentos(a.data);
      if (!al.error && al.data) setAlertas(al.data);
      if (!ct.error && ct.data) setContencoes(ct.data);
      if (!cs.error && cs.data) setConsumiveis(cs.data);
    };
    load();
    return () => { cancelled = true; };
  }, [startDate]);

  // Realtime subscriptions
  useEffect(() => {
    const refetch = async (table: string) => {
      const iso = startDate.toISOString();
      if (table === "apontamentos") {
        const { data } = await supabase.from("apontamentos").select("*").gte("created_at", iso).order("created_at", { ascending: false });
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

    const channel = supabase
      .channel("monitor-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "apontamentos" }, () => refetch("apontamentos"))
      .on("postgres_changes", { event: "*", schema: "public", table: "alertas_qualidade" }, () => refetch("alertas_qualidade"))
      .on("postgres_changes", { event: "*", schema: "public", table: "contencao" }, () => refetch("contencao"))
      .on("postgres_changes", { event: "*", schema: "public", table: "consumable_items" }, () => refetch("consumable_items"))
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [startDate]);

  // Derived KPIs
  const totalReg = apontamentos.length;
  const totalOk = apontamentos.reduce((s, a) => s + (a.quantidade_ok || 0), 0);
  const totalNg = apontamentos.reduce((s, a) => s + (a.quantidade_ng || 0), 0);
  const totalInsp = apontamentos.reduce((s, a) => s + (a.quantidade_inspecionada || a.quantidade || 0), 0);
  const ppm = totalInsp > 0 ? Math.round((totalNg / totalInsp) * 1_000_000) : 0;

  const criticalConsum = consumiveis.filter((c) => (c.stock_qty ?? 0) <= (c.min_qty ?? 0));

  const supplierRanking = useMemo(() => {
    const map = new Map<string, number>();
    apontamentos.forEach((a) => {
      const ng = a.quantidade_ng || 0;
      if (!ng) return;
      const key = a.fornecedor || "—";
      map.set(key, (map.get(key) || 0) + ng);
    });
    return Array.from(map.entries())
      .map(([fornecedor, ng]) => ({ fornecedor, ng }))
      .sort((a, b) => b.ng - a.ng)
      .slice(0, 8);
  }, [apontamentos]);

  const defectsData = useMemo(() => {
    const map = new Map<string, number>();
    apontamentos.forEach((a) => {
      const ng = a.quantidade_ng || 0;
      if (!ng || !a.modo_falha) return;
      map.set(a.modo_falha, (map.get(a.modo_falha) || 0) + ng);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [apontamentos]);

  // Layout: auto grid based on number of selected blocks
  const cols = prefs.blocks.length <= 2 ? "grid-cols-1 md:grid-cols-2" : prefs.blocks.length <= 4 ? "grid-cols-2" : "grid-cols-2 xl:grid-cols-3";

  const renderBlock = (id: string) => {
    switch (id) {
      case "summary":
        return (
          <Card key={id} title="📊 Resumo do Dia">
            <div className="flex gap-3 h-full items-center">
              <Stat label="Registros" value={fmtNum(totalReg)} />
              <Stat label="OK" value={fmtNum(totalOk)} accent="text-emerald-500" />
              <Stat label="NG" value={fmtNum(totalNg)} accent="text-red-500" />
              <Stat label="PPM" value={fmtNum(ppm)} accent="text-amber-500" />
            </div>
          </Card>
        );
      case "recent":
        return (
          <Card key={id} title="📋 Últimos Registros" className="col-span-full xl:col-span-2">
            <div className="overflow-y-auto h-full">
              <table className="w-full text-base">
                <thead className="sticky top-0 bg-card">
                  <tr className="text-muted-foreground text-sm">
                    <th className="text-left py-2 px-2">Nº</th>
                    <th className="text-left py-2 px-2">Tipo</th>
                    <th className="text-left py-2 px-2">Part Number</th>
                    <th className="text-left py-2 px-2">Fornecedor</th>
                    <th className="text-right py-2 px-2">NG</th>
                    <th className="text-right py-2 px-2">Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {apontamentos.slice(0, 15).map((a) => (
                    <tr key={a.id} className="border-t border-border/40">
                      <td className="py-2 px-2 font-mono text-sm">{a.numero || "—"}</td>
                      <td className="py-2 px-2 uppercase text-sm">{a.tipo}</td>
                      <td className="py-2 px-2">{a.part_number || "—"}</td>
                      <td className="py-2 px-2 truncate max-w-[200px]">{a.fornecedor || "—"}</td>
                      <td className={`py-2 px-2 text-right font-bold ${a.quantidade_ng > 0 ? "text-red-500" : "text-emerald-500"}`}>{a.quantidade_ng || 0}</td>
                      <td className="py-2 px-2 text-right text-sm text-muted-foreground">{new Date(a.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
                    </tr>
                  ))}
                  {apontamentos.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">Sem registros no período.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        );
      case "alerts":
        return (
          <Card key={id} title="⚠️ Alertas Vigentes">
            <ul className="space-y-2 overflow-y-auto h-full">
              {alertas.length === 0 && <li className="text-muted-foreground">Sem alertas vigentes.</li>}
              {alertas.map((a) => (
                <li key={a.id} className="border-l-4 border-amber-500 pl-3 py-2 bg-muted/20 rounded">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-base truncate">{a.titulo || a.numero_alerta || "Alerta"}</p>
                    <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-500">{a.status || "ativo"}</span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{a.descricao_problema || a.fornecedor || ""}</p>
                </li>
              ))}
            </ul>
          </Card>
        );
      case "contencao":
        return (
          <Card key={id} title="🔴 Contenções Ativas">
            <ul className="space-y-2 overflow-y-auto h-full">
              {contencoes.length === 0 && <li className="text-muted-foreground">Nenhuma contenção ativa.</li>}
              {contencoes.map((c) => (
                <li key={c.id} className="border-l-4 border-red-500 pl-3 py-2 bg-muted/20 rounded">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-base truncate">{c.titulo || c.numero || "Contenção"}</p>
                    <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-500">{c.status}</span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{c.part_number} · {c.fornecedor || ""}</p>
                </li>
              ))}
            </ul>
          </Card>
        );
      case "consumiveis":
        return (
          <Card key={id} title="📦 Consumíveis Críticos">
            <ul className="space-y-2 overflow-y-auto h-full">
              {criticalConsum.length === 0 && <li className="text-muted-foreground">Estoque saudável.</li>}
              {criticalConsum.map((c) => (
                <li key={c.id} className="flex items-center justify-between border-b border-border/40 py-2">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-red-500 font-bold text-lg">{c.stock_qty} / {c.min_qty} {c.unit}</span>
                </li>
              ))}
            </ul>
          </Card>
        );
      case "ranking":
        return (
          <Card key={id} title="🏆 Ranking de Fornecedores (NG)">
            <ol className="space-y-2 overflow-y-auto h-full">
              {supplierRanking.length === 0 && <li className="text-muted-foreground">Sem dados.</li>}
              {supplierRanking.map((s, i) => (
                <li key={s.fornecedor} className="flex items-center justify-between border-b border-border/40 py-2">
                  <span className="flex items-center gap-3">
                    <span className="font-mono text-xl text-muted-foreground w-8">{i + 1}.</span>
                    <span className="font-medium truncate">{s.fornecedor}</span>
                  </span>
                  <span className="text-red-500 font-bold text-xl">{fmtNum(s.ng)}</span>
                </li>
              ))}
            </ol>
          </Card>
        );
      case "defects":
        return (
          <Card key={id} title="📈 Gráfico de Defeitos">
            {defectsData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">Sem defeitos no período.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={defectsData} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                  <YAxis dataKey="name" type="category" width={120} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="value" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-background text-foreground flex flex-col group">
      {/* Settings button (top-right, hover-revealed) */}
      <button
        type="button"
        onClick={() => setShowSettings(true)}
        className="absolute top-3 right-3 z-30 p-2 rounded-full bg-card/60 border border-border opacity-0 group-hover:opacity-100 transition-opacity"
        title="Configurações do monitor"
      >
        <Settings className="w-5 h-5" />
      </button>

      {/* Grid */}
      <main className={`flex-1 grid ${cols} gap-3 p-3 min-h-0`}>
        {prefs.blocks.length === 0 ? (
          <div className="col-span-full flex items-center justify-center text-2xl text-muted-foreground">
            Nenhum bloco selecionado.
            <Button className="ml-4" onClick={() => setShowSettings(true)}>Configurar</Button>
          </div>
        ) : (
          prefs.blocks.map((b) => renderBlock(b))
        )}
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-between px-4 py-2 border-t border-border bg-card/50 text-sm">
        <span className="font-mono">
          {now.toLocaleDateString("pt-BR")} · {now.toLocaleTimeString("pt-BR")}
        </span>
        <span className="flex items-center gap-2">
          {connected ? (
            <><Wifi className="w-4 h-4 text-emerald-500" /><span className="text-emerald-500">Conectado</span></>
          ) : (
            <><WifiOff className="w-4 h-4 text-red-500" /><span className="text-red-500">Sem conexão</span></>
          )}
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: connected ? "#10b981" : "#ef4444" }} />
        </span>
      </footer>

      <MonitorDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        initial={prefs}
        confirmLabel="Aplicar"
        onConfirm={(p) => setPrefs(p)}
      />
    </div>
  );
};

export default Monitor;
