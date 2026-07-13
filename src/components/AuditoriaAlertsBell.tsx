import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CalendarClock, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { AuditAlertRow, dismissAlert, fetchActiveAlerts, refreshAuditAlerts } from "@/lib/auditAlerts";

export default function AuditoriaAlertsBell() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<AuditAlertRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      await refreshAuditAlerts();
      setAlerts(await fetchActiveAlerts());
    } catch (e) {
      console.error("audit alerts load", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("audit_alerts_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "audit_alerts" }, () => {
        fetchActiveAlerts().then(setAlerts).catch(() => {});
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const count = alerts.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="header-btn header-btn-back relative" aria-label="Alertas de auditoria">
          <Bell className="w-4 h-4" />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[320px] p-0 bg-card border border-border">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <span className="text-sm font-semibold">Alertas de Auditoria</span>
          <span className="text-xs text-muted-foreground">{loading ? "..." : `${count} ativo${count !== 1 ? "s" : ""}`}</span>
        </div>
        <div className="max-h-[360px] overflow-y-auto">
          {count === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Nenhum alerta ativo</div>
          ) : alerts.map((a) => {
            const Icon = a.type === "auditoria_proxima" ? CalendarClock : AlertTriangle;
            const color = a.type === "auditoria_proxima" ? "text-blue-400" : "text-red-400";
            return (
              <div key={a.id} className="flex items-start gap-2 p-3 border-b border-border/50 hover:bg-muted/20">
                <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${color}`} />
                <button
                  className="flex-1 text-left"
                  onClick={() => navigate(`/auditorias/${a.audit_id}`)}
                >
                  <div className="text-sm text-foreground">{a.message}</div>
                  {a.audit?.code && <div className="text-xs text-muted-foreground mt-0.5">#{a.audit.code} · {a.audit.title}</div>}
                </button>
                <button
                  onClick={() => dismissAlert(a.id).then(() => setAlerts((v) => v.filter((x) => x.id !== a.id)))}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                  aria-label="Dispensar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
