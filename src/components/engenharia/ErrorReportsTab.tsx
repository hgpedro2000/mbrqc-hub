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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Loader2, Eye, CheckCircle, Clock, X } from "lucide-react";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "border-yellow-500 text-yellow-600 bg-yellow-500/10" },
  em_andamento: { label: "Em Andamento", color: "border-blue-500 text-blue-600 bg-blue-500/10" },
  resolvido: { label: "Resolvido", color: "border-emerald-500 text-emerald-600 bg-emerald-500/10" },
};

const ErrorReportsTab = () => {
  const qc = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [viewItem, setViewItem] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [saving, setSaving] = useState(false);

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
    if (!searchTerm.trim()) return reports;
    const term = searchTerm.toLowerCase();
    return reports.filter((r: any) =>
      r.user_name?.toLowerCase().includes(term) ||
      r.module?.toLowerCase().includes(term) ||
      r.description?.toLowerCase().includes(term)
    );
  }, [reports, searchTerm]);

  const pendingCount = reports.filter((r: any) => r.status === "pendente").length;

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
      setViewItem(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-heading font-semibold">Relatórios de Erro</h2>
          {pendingCount > 0 && (
            <Badge className="bg-destructive text-destructive-foreground">{pendingCount} pendente{pendingCount > 1 ? "s" : ""}</Badge>
          )}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar por usuário, módulo..." className="pl-9" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="overflow-x-auto -mx-3 px-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Módulo</TableHead>
                <TableHead className="hidden md:table-cell">Descrição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r: any) => {
                const cfg = statusConfig[r.status] || statusConfig.pendente;
                return (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openView(r)}>
                    <TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-xs sm:text-sm">{r.user_name}</TableCell>
                    <TableCell className="text-xs sm:text-sm">{r.module}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[200px] truncate">{r.description}</TableCell>
                    <TableCell><Badge variant="outline" className={cfg.color}>{cfg.label}</Badge></TableCell>
                    <TableCell><Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="w-4 h-4" /></Button></TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum relatório encontrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!viewItem} onOpenChange={(v) => !v && setViewItem(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Erro</DialogTitle>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground text-xs">Usuário</span><p className="font-medium">{viewItem.user_name}</p></div>
                <div><span className="text-muted-foreground text-xs">Módulo</span><p className="font-medium">{viewItem.module}</p></div>
                <div className="col-span-2"><span className="text-muted-foreground text-xs">Data</span><p className="font-medium">{new Date(viewItem.created_at).toLocaleString("pt-BR")}</p></div>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Descrição</span>
                <p className="text-sm mt-1 whitespace-pre-wrap">{viewItem.description}</p>
              </div>
              {viewItem.photos && (viewItem.photos as string[]).length > 0 && (
                <div>
                  <span className="text-muted-foreground text-xs">Capturas de Tela</span>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {(viewItem.photos as string[]).map((url: string, i: number) => (
                      <img key={i} src={url} alt={`Screenshot ${i + 1}`} className="rounded-md border w-full object-cover max-h-40" />
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
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ErrorReportsTab;
