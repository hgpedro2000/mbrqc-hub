import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Loader2, Eye, CheckCircle, Clock, X, Trash2, Pencil, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface ErrorReportsTabProps {
  onCreateUserFromRequest?: (data: any) => void;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "border-yellow-500 text-yellow-600 bg-yellow-500/10" },
  em_andamento: { label: "Em Andamento", color: "border-blue-500 text-blue-600 bg-blue-500/10" },
  resolvido: { label: "Resolvido", color: "border-emerald-500 text-emerald-600 bg-emerald-500/10" },
};

const moduleColors: Record<string, string> = {
  "Hub": "bg-indigo-500/15 text-indigo-700 border-indigo-300",
  "Try-Out": "bg-cyan-500/15 text-cyan-700 border-cyan-300",
  "Auditorias": "bg-purple-500/15 text-purple-700 border-purple-300",
  "Contenção": "bg-rose-500/15 text-rose-700 border-rose-300",
  "Apontamentos": "bg-amber-500/15 text-amber-700 border-amber-300",
  "Alerta de Qualidade": "bg-red-500/15 text-red-700 border-red-300",
  "Consumíveis": "bg-teal-500/15 text-teal-700 border-teal-300",
  "Consulta de Peças": "bg-sky-500/15 text-sky-700 border-sky-300",
  "Novo Usuário": "bg-blue-500/15 text-blue-700 border-blue-300",
};

const moduleOptions = [
  { value: "", label: "Todos" },
  { value: "Hub", label: "Hub" },
  { value: "Try-Out", label: "Try-Out" },
  { value: "Auditorias", label: "Auditorias" },
  { value: "Contenção", label: "Contenção" },
  { value: "Apontamentos", label: "Apontamentos" },
  { value: "Alerta de Qualidade", label: "Alerta de Qualidade" },
  { value: "Consumíveis", label: "Consumíveis" },
  { value: "Consulta de Peças", label: "Consulta de Peças" },
  { value: "Novo Usuário", label: "Novo Usuário" },
];

const ErrorReportsTab = ({ onCreateUserFromRequest }: ErrorReportsTabProps = {}) => {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [viewItem, setViewItem] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("aberto");

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["error-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("error_reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    let list = reports;
    // Tab filter
    if (activeTab === "aberto") {
      list = list.filter((r: any) => r.status === "pendente" || r.status === "em_andamento");
    } else {
      list = list.filter((r: any) => r.status === "resolvido");
    }
    if (moduleFilter) {
      list = list.filter((r: any) => r.module === moduleFilter);
    }
    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase();
    return list.filter((r: any) =>
      r.user_name?.toLowerCase().includes(term) ||
      r.module?.toLowerCase().includes(term) ||
      r.description?.toLowerCase().includes(term) ||
      r.numero?.toLowerCase().includes(term)
    );
  }, [reports, searchTerm, moduleFilter, activeTab]);

  const pendingCount = reports.filter((r: any) => r.status === "pendente" || r.status === "em_andamento").length;
  const resolvedCount = reports.filter((r: any) => r.status === "resolvido").length;

  const openView = (item: any) => {
    setViewItem(item);
    setAdminNotes(item.admin_notes || "");
    setNewStatus(item.status);
  };

  const handleSave = async () => {
    if (!viewItem) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("error_reports")
        .update({ status: newStatus, admin_notes: adminNotes } as any)
        .eq("id", viewItem.id);
      if (error) throw error;
      toast.success("Atualizado!");
      qc.invalidateQueries({ queryKey: ["error-reports"] });
      qc.invalidateQueries({ queryKey: ["pending-error-reports-count"] });
      setViewItem(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      for (const id of selectedIds) {
        const { error } = await supabase.from("error_reports").delete().eq("id", id);
        if (error) throw error;
      }
      toast.success(`${selectedIds.size} chamado(s) excluído(s)`);
      qc.invalidateQueries({ queryKey: ["error-reports"] });
      qc.invalidateQueries({ queryKey: ["pending-error-reports-count"] });
      setSelectedIds(new Set());
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const getModuleColor = (mod: string) => moduleColors[mod] || "bg-muted text-muted-foreground";

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-heading font-semibold">Help Desk</h2>
          {pendingCount > 0 && (
            <Badge className="bg-destructive text-destructive-foreground">{pendingCount} em aberto</Badge>
          )}
        </div>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <Button variant="destructive" size="sm" onClick={handleBulkDelete} className="gap-1">
              <Trash2 className="w-3.5 h-3.5" /> Excluir ({selectedIds.size})
            </Button>
          </div>
        )}
      </div>

      {/* Tabs: Em Aberto / Resolvido */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedIds(new Set()); }}>
        <TabsList className="grid w-full grid-cols-2 h-auto">
          <TabsTrigger value="aberto" className="text-xs sm:text-sm py-2">
            Em Aberto {pendingCount > 0 && <Badge className="ml-1.5 bg-destructive text-destructive-foreground text-[10px] px-1.5">{pendingCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="resolvido" className="text-xs sm:text-sm py-2">
            Resolvido {resolvedCount > 0 && <Badge className="ml-1.5 bg-emerald-500 text-white text-[10px] px-1.5">{resolvedCount}</Badge>}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar por nº, usuário, descrição..." className="pl-9" />
        </div>
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filtrar por módulo" />
          </SelectTrigger>
          <SelectContent>
            {moduleOptions.map((opt) => (
              <SelectItem key={opt.value || "all"} value={opt.value || "all"}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Mobile card layout */}
          <div className="sm:hidden space-y-2 overflow-x-hidden">
            {filtered.map((r: any) => {
              const cfg = statusConfig[r.status] || statusConfig.pendente;
              return (
                <div key={r.id} className="border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors overflow-hidden" onClick={() => openView(r)}>
                  <div className="flex items-start gap-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selectedIds.has(r.id)} onCheckedChange={() => toggleSelect(r.id)} className="mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0" onClick={() => openView(r)}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-mono text-muted-foreground shrink-0">#{r.numero || "—"}</span>
                          <Badge variant="outline" className={`text-[10px] shrink-0 ${getModuleColor(r.module)}`}>{r.module}</Badge>
                        </div>
                        <div className="mt-1">
                          <Badge variant="outline" className={`text-[10px] ${cfg.color}`}>{cfg.label}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">{r.user_name} • {new Date(r.created_at).toLocaleDateString("pt-BR")}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 break-words">{r.description}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => openView(r)}><Eye className="w-4 h-4" /></Button>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center text-muted-foreground py-8 text-sm">Nenhum chamado encontrado</div>
            )}
          </div>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto -mx-3 px-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"><Checkbox checked={filtered.length > 0 && filtered.every((r: any) => selectedIds.has(r.id))} onCheckedChange={() => {
                    if (filtered.every((r: any) => selectedIds.has(r.id))) setSelectedIds(new Set());
                    else setSelectedIds(new Set(filtered.map((r: any) => r.id)));
                  }} /></TableHead>
                  <TableHead className="text-xs">Nº</TableHead>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs">Usuário</TableHead>
                  <TableHead className="text-xs">Módulo</TableHead>
                  <TableHead className="hidden md:table-cell text-xs">Descrição</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r: any) => {
                  const cfg = statusConfig[r.status] || statusConfig.pendente;
                  return (
                    <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selectedIds.has(r.id)} onCheckedChange={() => toggleSelect(r.id)} />
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground" onClick={() => openView(r)}>{r.numero || "—"}</TableCell>
                      <TableCell className="text-xs" onClick={() => openView(r)}>{new Date(r.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-xs" onClick={() => openView(r)}>{r.user_name}</TableCell>
                      <TableCell onClick={() => openView(r)}>
                        <Badge variant="outline" className={`text-xs ${getModuleColor(r.module)}`}>{r.module}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[200px] truncate" onClick={() => openView(r)}>{r.description}</TableCell>
                      <TableCell onClick={() => openView(r)}><Badge variant="outline" className={cfg.color}>{cfg.label}</Badge></TableCell>
                      <TableCell><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openView(r)}><Eye className="w-4 h-4" /></Button></TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum chamado encontrado</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Detail dialog */}
      <Dialog open={!!viewItem} onOpenChange={(v) => !v && setViewItem(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-8">
              Chamado {viewItem?.numero || ""}
            </DialogTitle>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-4 overflow-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="min-w-0"><span className="text-muted-foreground text-xs">Usuário</span><p className="font-medium truncate">{viewItem.user_name}</p></div>
                <div className="min-w-0"><span className="text-muted-foreground text-xs">Módulo</span><p className="font-medium"><Badge variant="outline" className={`${getModuleColor(viewItem.module)} text-xs`}>{viewItem.module}</Badge></p></div>
                <div className="col-span-1 sm:col-span-2"><span className="text-muted-foreground text-xs">Data</span><p className="font-medium">{new Date(viewItem.created_at).toLocaleString("pt-BR")}</p></div>
              </div>
              <div className="min-w-0">
                <span className="text-muted-foreground text-xs">Descrição</span>
                <p className="text-sm mt-1 whitespace-pre-wrap break-words">{viewItem.description}</p>
              </div>
              {viewItem.photos && (viewItem.photos as string[]).length > 0 && (
                <div>
                  <span className="text-muted-foreground text-xs">Capturas de Tela</span>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {(viewItem.photos as string[]).map((url: string, i: number) => (
                      <img
                        key={i}
                        src={url}
                        alt={`Screenshot ${i + 1}`}
                        className="rounded-md border w-full object-cover max-h-40 cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                        onClick={() => setLightboxUrl(url)}
                      />
                    ))}
                  </div>
                </div>
              )}
              <hr />
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="em_andamento">Em Andamento</SelectItem>
                      <SelectItem value="resolvido">Resolvido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notas do Admin</Label>
                  <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder="Adicionar notas..." rows={3} />
                </div>
                <Button onClick={handleSave} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                  Salvar
                </Button>
                {viewItem.module === "Novo Usuário" && onCreateUserFromRequest && (
                  <Button variant="secondary" className="w-full mt-2 gap-2" onClick={() => {
                    const desc = viewItem.description || "";
                    const lines = desc.split("\n");
                    const parsed: Record<string, string> = {};
                    lines.forEach((l: string) => {
                      const [key, ...val] = l.split(": ");
                      if (key && val.length) parsed[key.trim()] = val.join(": ").trim();
                    });
                    onCreateUserFromRequest(parsed);
                    setViewItem(null);
                  }}>
                    <UserPlus className="w-4 h-4" /> Criar Usuário a partir desta solicitação
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Lightbox for images */}
      {lightboxUrl && (
        <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none [&>button:last-child]:hidden">
            <button onClick={() => setLightboxUrl(null)} className="absolute right-3 top-3 z-50 rounded-full bg-white/20 backdrop-blur-sm w-10 h-10 flex items-center justify-center hover:bg-white/40 transition-colors">
              <X className="h-5 w-5 text-white" />
            </button>
            <div className="flex items-center justify-center w-full h-[90vh] p-4">
              <img src={lightboxUrl} alt="Imagem ampliada" className="max-w-full max-h-full object-contain rounded" />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default ErrorReportsTab;
