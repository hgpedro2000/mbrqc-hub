import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, Search, Loader2, Shield } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

const PAGE_SIZE = 50;
const MAX_ROWS = 5000;

const toISODate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const firstDayOfMonth = (ref = new Date()) => toISODate(new Date(ref.getFullYear(), ref.getMonth(), 1));
const lastDayOfMonth = (ref = new Date()) => toISODate(new Date(ref.getFullYear(), ref.getMonth() + 1, 0));

const AuditLogsTab = () => {
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>(() => firstDayOfMonth());
  const [dateTo, setDateTo] = useState<string>(() => lastDayOfMonth());
  const [page, setPage] = useState(0);

  // When the user changes the month part of dateFrom, auto-adjust dateTo to that month's last day
  const handleDateFromChange = (v: string) => {
    setDateFrom(v);
    setPage(0);
    if (v) {
      const ref = new Date(`${v}T12:00:00`);
      setDateTo(lastDayOfMonth(ref));
    }
  };

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs", moduleFilter, actionFilter, dateFrom, dateTo],
    queryFn: async () => {
      let q = supabase.from("audit_logs" as any).select("*").order("created_at", { ascending: false }).limit(MAX_ROWS);
      if (moduleFilter !== "all") q = q.eq("module", moduleFilter);
      if (actionFilter !== "all") q = q.eq("action", actionFilter);
      if (dateFrom) q = q.gte("created_at", `${dateFrom}T00:00:00`);
      if (dateTo) q = q.lte("created_at", `${dateTo}T23:59:59`);
      const { data, error } = await q;
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return logs;
    const s = search.toLowerCase();
    return logs.filter(
      (l: any) =>
        l.user_email?.toLowerCase().includes(s) ||
        l.action?.toLowerCase().includes(s) ||
        l.module?.toLowerCase().includes(s) ||
        JSON.stringify(l.details || {}).toLowerCase().includes(s)
    );
  }, [logs, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const modules = useMemo(() => Array.from(new Set(logs.map((l: any) => l.module))).sort(), [logs]);
  const actions = useMemo(() => Array.from(new Set(logs.map((l: any) => l.action))).sort(), [logs]);

  const handleExport = () => {
    if (filtered.length === 0) return toast.error("Nenhum log para exportar");
    const rows = filtered.map((l: any) => ({
      "Data/Hora": new Date(l.created_at).toLocaleString("pt-BR"),
      Usuário: l.user_email || "—",
      Ação: l.action,
      Módulo: l.module,
      "IP": l.ip_address || "—",
      Detalhes: JSON.stringify(l.details || {}),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 20 }, { wch: 28 }, { wch: 18 }, { wch: 20 }, { wch: 16 }, { wch: 60 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Audit Logs");
    XLSX.writeFile(wb, `audit-logs-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`${filtered.length} registros exportados`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-base sm:text-lg font-heading font-bold">Logs de Auditoria</h3>
            <p className="text-xs text-muted-foreground">Histórico de ações do sistema</p>
          </div>
        </div>
        <Button onClick={handleExport} size="sm" className="gap-1.5">
          <Download className="w-4 h-4" /> Excel
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
        <div className="relative sm:col-span-2 lg:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Buscar por usuário, ação, detalhes..."
            className="pl-9 h-9"
          />
        </div>
        <Select value={moduleFilter} onValueChange={(v) => { setModuleFilter(v); setPage(0); }}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Módulo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os módulos</SelectItem>
            {modules.map((m) => <SelectItem key={m as string} value={m as string}>{m as string}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Ação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as ações</SelectItem>
            {actions.map((a) => <SelectItem key={a as string} value={a as string}>{a as string}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-1">
          <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} className="h-9 min-w-0" />
          <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} className="h-9 min-w-0" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 border border-border/60 rounded-lg">
          <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum log encontrado</p>
        </div>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="sm:hidden space-y-2">
            {pageRows.map((l: any) => (
              <div key={l.id} className="border border-border/60 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {new Date(l.created_at).toLocaleString("pt-BR")}
                  </span>
                  <Badge variant="outline" className="text-[10px] shrink-0">{l.action}</Badge>
                </div>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-xs font-medium break-all min-w-0 flex-1">{l.user_email || "—"}</p>
                  <Badge variant="secondary" className="text-[10px] shrink-0">{l.module}</Badge>
                </div>
                {l.ip_address && (
                  <p className="text-[10px] font-mono text-muted-foreground">IP: {l.ip_address}</p>
                )}
                {Object.keys(l.details || {}).length > 0 && (
                  <pre className="text-[10px] whitespace-pre-wrap break-words text-muted-foreground bg-muted/30 rounded p-1.5 max-h-24 overflow-auto">
                    {JSON.stringify(l.details, null, 0)}
                  </pre>
                )}
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto border border-border/60 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="py-2 px-3 font-semibold">Data/Hora</th>
                  <th className="py-2 px-3 font-semibold">Usuário</th>
                  <th className="py-2 px-3 font-semibold">Ação</th>
                  <th className="py-2 px-3 font-semibold">Módulo</th>
                  <th className="py-2 px-3 font-semibold">IP</th>
                  <th className="py-2 px-3 font-semibold">Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((l: any) => (
                  <tr key={l.id} className="border-t border-border/60 align-top hover:bg-muted/20">
                    <td className="py-2 px-3 whitespace-nowrap">{new Date(l.created_at).toLocaleString("pt-BR")}</td>
                    <td className="py-2 px-3 break-all">{l.user_email || <span className="text-muted-foreground">—</span>}</td>
                    <td className="py-2 px-3"><Badge variant="outline" className="text-[10px]">{l.action}</Badge></td>
                    <td className="py-2 px-3"><Badge variant="secondary" className="text-[10px]">{l.module}</Badge></td>
                    <td className="py-2 px-3 font-mono text-[10px]">{l.ip_address || "—"}</td>
                    <td className="py-2 px-3 max-w-md">
                      <pre className="text-[10px] whitespace-pre-wrap break-words text-muted-foreground">
                        {Object.keys(l.details || {}).length ? JSON.stringify(l.details, null, 0) : "—"}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{filtered.length} registros • Página {page + 1} de {pageCount}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={page >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}>Próxima</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AuditLogsTab;
