import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Search, Loader2, Shield } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

const PAGE_SIZE = 50;

const AuditLogsPage = () => {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAuth();

  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs", moduleFilter, actionFilter, dateFrom, dateTo],
    queryFn: async () => {
      let q = supabase.from("audit_logs" as any).select("*").order("created_at", { ascending: false }).limit(1000);
      if (moduleFilter !== "all") q = q.eq("module", moduleFilter);
      if (actionFilter !== "all") q = q.eq("action", actionFilter);
      if (dateFrom) q = q.gte("created_at", `${dateFrom}T00:00:00`);
      if (dateTo) q = q.lte("created_at", `${dateTo}T23:59:59`);
      const { data, error } = await q;
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: isAdmin,
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <Shield className="w-12 h-12 text-muted-foreground mb-3" />
        <h2 className="text-xl font-heading font-bold">Acesso restrito</h2>
        <p className="text-muted-foreground mt-1">Apenas administradores podem visualizar esta página.</p>
        <Button onClick={() => navigate("/")} className="mt-4">Voltar ao Hub</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-3 sm:px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="header-btn header-btn-back">
              <ArrowLeft className="w-4 h-4 mr-1" /> Hub
            </Button>
            <Button onClick={handleExport} size="sm" className="gap-1.5">
              <Download className="w-4 h-4" /> Excel
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Shield className="w-6 h-6" />
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-heading font-bold">Logs de Auditoria</h1>
              <p className="text-primary-foreground/70 text-xs">Histórico de ações do sistema</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 max-w-7xl">
        <div className="form-section grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          <div className="relative lg:col-span-2">
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
          <div className="flex gap-2">
            <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} className="h-9" />
            <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} className="h-9" />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="form-section text-center py-12">
            <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum log encontrado</p>
          </div>
        ) : (
          <>
            <div className="form-section overflow-x-auto p-0">
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
      </main>
    </div>
  );
};

export default AuditLogsPage;
