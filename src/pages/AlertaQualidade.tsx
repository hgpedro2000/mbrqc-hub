import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, AlertTriangle, Camera, Search, Download, CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import QrScannerModal from "@/components/QrScannerModal";
import logo from "@/assets/hyundai-mobis-logo.png";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const lineAreaMap: Record<string, string> = {
  "CP": "cp", "BP": "bp", "CH": "ch", "OEM": "oem",
  "Incoming": "incoming", "Pintura": "pintura", "Injeção": "injecao",
  "Sala do Áudio": "sala_audio", "Inspeção de Peça": "inspecao_peca",
};

const AlertaQualidade = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const qc = useQueryClient();
  const [scanAlertaId, setScanAlertaId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [exportAlertaId, setExportAlertaId] = useState<string | null>(null);
  const [includeCiencias, setIncludeCiencias] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [successPopup, setSuccessPopup] = useState<{ name: string } | null>(null);
  const [deleteAlertaId, setDeleteAlertaId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [statusEditAlert, setStatusEditAlert] = useState<any>(null);
  const [newStatus, setNewStatus] = useState("");

  const { data: roles = [] } = useQuery({
    queryKey: ["my-roles-alerta", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const isLider = isAdmin || roles.some((r: any) => r.role === "lider");
  const isInspetor = roles.some((r: any) => r.role === "inspetor");

  useEffect(() => {
    if (!isLider && isInspetor) {
      navigate("/alerta-qualidade/feed", { replace: true });
    }
  }, [isLider, isInspetor, navigate]);

  const { data: alertas = [], isLoading } = useQuery({
    queryKey: ["alertas-lista-mestra"],
    queryFn: async () => {
      const { data, error } = await supabase.from("alertas").select("*").order("sequencial", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: ciencias = [] } = useQuery({
    queryKey: ["ciencias-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ciencias").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: qualifications = [] } = useQuery({
    queryKey: ["inspector-qualifications-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inspector_qualifications").select("user_id, area").eq("habilitado", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: partNumbers = [] } = useQuery({
    queryKey: ["part-numbers-line-map"],
    queryFn: async () => {
      const { data, error } = await supabase.from("part_numbers").select("part_name, line_module").eq("active", true);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("ciencias-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "ciencias" }, () => {
        qc.invalidateQueries({ queryKey: ["ciencias-all"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const resolveArea = (linhaPeca: string | null): string | null => {
    if (!linhaPeca) return null;
    const direct = lineAreaMap[linhaPeca];
    if (direct) return direct;
    const part = partNumbers.find((p: any) => p.part_name === linhaPeca);
    if (part) {
      const mapped = lineAreaMap[part.line_module];
      if (mapped) return mapped;
    }
    return null;
  };

  const getQualifiedInspectors = (linhaPeca: string | null): string[] => {
    const areaKey = resolveArea(linhaPeca);
    if (!areaKey) return [];
    return [...new Set(qualifications.filter((q: any) => q.area === areaKey).map((q: any) => q.user_id))];
  };

  const getQualifiedCount = (linhaPeca: string | null): number => {
    return getQualifiedInspectors(linhaPeca).length;
  };

  const getCienciaProgress = (alertaId: string, linhaPeca: string | null) => {
    const count = ciencias.filter((c: any) => c.alerta_id === alertaId).length;
    const total = getQualifiedCount(linhaPeca);
    const pending = Math.max(total - count, 0);
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return { count, total, pending, pct };
  };

  const getCienciaStatus = (alertaId: string, linhaPeca: string | null, createdAt: string) => {
    const { total, pending } = getCienciaProgress(alertaId, linhaPeca);
    if (total === 0) return { label: "Sem destino", color: "border-muted text-muted-foreground bg-muted/20" };
    if (pending === 0) return { label: "Completo", color: "border-emerald-500 text-emerald-600 bg-emerald-500/10" };
    const diffDays = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays >= 3) return { label: "Atrasado", color: "border-red-500 text-red-600 bg-red-500/10" };
    return { label: "Em andamento", color: "border-amber-500 text-amber-600 bg-amber-500/10" };
  };

  const formatSeq = (seq: number) => `AQ-${String(seq).padStart(5, "0")}`;

  // Filter: inspectors/auxiliars only see alerts where they are in the ciência list
  const filteredByVisibility = useMemo(() => {
    if (isAdmin || isLider) return alertas;
    // For inspectors: only show alerts where they are a qualified inspector for that area
    if (!user?.id) return [];
    return alertas.filter((a: any) => {
      const qualifiedInspectors = getQualifiedInspectors(a.linha_peca);
      return qualifiedInspectors.includes(user.id);
    });
  }, [alertas, isAdmin, isLider, user?.id, qualifications, partNumbers]);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return filteredByVisibility;
    const term = searchTerm.toLowerCase();
    return filteredByVisibility.filter((a: any) =>
      formatSeq(a.sequencial).toLowerCase().includes(term) ||
      a.descricao?.toLowerCase().includes(term) ||
      a.modo_falha?.toLowerCase().includes(term) ||
      a.modelo?.toLowerCase().includes(term)
    );
  }, [filteredByVisibility, searchTerm]);

  const handleQrScan = async (qrValue: string) => {
    if (!scanAlertaId) return;
    try {
      const { data: inspetor, error: findErr } = await supabase
        .from("profiles").select("id, full_name").eq("qr_code_id", qrValue).maybeSingle();
      if (findErr || !inspetor) { toast.error("QR Code não reconhecido."); return; }
      const { data: existing } = await supabase.from("ciencias").select("id").eq("alerta_id", scanAlertaId).eq("inspetor_id", inspetor.id).maybeSingle();
      if (existing) { toast.info(`${inspetor.full_name} já havia dado ciência neste alerta.`); setScanAlertaId(null); return; }
      const { error: insertErr } = await supabase.from("ciencias").insert({
        alerta_id: scanAlertaId, inspetor_id: inspetor.id, metodo: "qr_lider", registrado_por_id: user?.id,
      } as any);
      if (insertErr) throw insertErr;
      qc.invalidateQueries({ queryKey: ["ciencias-all"] });
      setScanAlertaId(null);
      setSuccessPopup({ name: inspetor.full_name });
    } catch (e: any) { toast.error(e.message); }
  };

  const handleExportConfirm = async (format: "jpg" | "pdf") => {
    if (!exportAlertaId) return;
    setExporting(true);
    const params = new URLSearchParams({ export: format, ciencias: includeCiencias ? "1" : "0" });
    navigate(`/alerta-qualidade/ver/${exportAlertaId}?${params.toString()}`);
    setExportAlertaId(null);
    setExporting(false);
  };

  const handleDelete = async () => {
    if (!deleteAlertaId) return;
    setDeleting(true);
    try {
      await supabase.from("ciencias").delete().eq("alerta_id", deleteAlertaId);
      const { error } = await supabase.from("alertas").delete().eq("id", deleteAlertaId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["alertas-lista-mestra"] });
      toast.success("Alerta excluído com sucesso");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeleting(false);
      setDeleteAlertaId(null);
    }
  };

  const handleStatusChange = async () => {
    if (!statusEditAlert || !newStatus) return;
    try {
      const { error } = await supabase.from("alertas").update({ status: newStatus } as any).eq("id", statusEditAlert.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["alertas-lista-mestra"] });
      toast.success("Status atualizado");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setStatusEditAlert(null);
      setNewStatus("");
    }
  };

  const canEdit = (alerta: any) => isAdmin || alerta.criado_por_id === user?.id;

  const statusOptions = [
    { value: "Em andamento", label: "Em andamento" },
    { value: "Completo", label: "Completo" },
    { value: "Atrasado", label: "Atrasado" },
    { value: "Sem destino", label: "Sem destino" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-primary-foreground/70 hover:text-primary-foreground px-2">
                <ArrowLeft className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Hub</span>
              </Button>
              <img src={logo} alt="Hyundai Mobis" className="h-6 sm:h-8 object-contain bg-white rounded-md px-2 py-0.5" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <AlertTriangle className="w-6 h-6" />
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-heading font-bold">Lista Mestra de Alertas</h1>
              <p className="text-primary-foreground/70 text-xs">Gestão de Alertas de Qualidade</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 max-w-5xl">
        <div className="flex flex-col sm:flex-row justify-between gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar..." className="pl-9 h-9" />
          </div>
          {isLider && (
            <Button onClick={() => navigate("/alerta-qualidade/novo")} className="gap-2 bg-[#c0392b] hover:bg-[#a93226] shrink-0">
              <Plus className="w-4 h-4" /> Novo Alerta
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" /></div>
        ) : filtered.length === 0 ? (
          <div className="form-section text-center py-12">
            <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum alerta encontrado</p>
          </div>
        ) : (
          /* Mobile: card layout, Desktop: table */
          <>
            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {filtered.map((a: any) => {
                const prog = getCienciaProgress(a.id, a.linha_peca);
                const status = getCienciaStatus(a.id, a.linha_peca, a.created_at);
                const displayStatus = a.status && a.status !== "ativo" ? a.status : status.label;
                return (
                  <div
                    key={a.id}
                    className="form-section p-3 space-y-2 cursor-pointer"
                    onClick={() => navigate(`/alerta-qualidade/ver/${a.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-[#c0392b]">{formatSeq(a.sequencial)}</span>
                      {isAdmin ? (
                        <button onClick={(e) => { e.stopPropagation(); setStatusEditAlert(a); setNewStatus(displayStatus); }}>
                          <Badge variant="outline" className={`${status.color} text-[10px] cursor-pointer`}>{displayStatus}</Badge>
                        </button>
                      ) : (
                        <Badge variant="outline" className={`${status.color} text-[10px]`}>{displayStatus}</Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium text-foreground line-clamp-2">{a.descricao || a.modo_falha || "—"}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {a.modelo && <Badge variant="outline" className="text-[9px] border-emerald-400 text-emerald-700 bg-emerald-50 py-0">{a.modelo}</Badge>}
                      <span>{a.data_ocorrencia ? new Date(a.data_ocorrencia).toLocaleDateString("pt-BR") : ""}</span>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Progress value={prog.pct} className="h-1.5 flex-1" />
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{prog.pending}p / {prog.count}c</span>
                    </div>
                    <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                      {canEdit(a) && (
                        <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => navigate(`/alerta-qualidade/editar/${a.id}`)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                      )}
                      {isLider && (
                        <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setScanAlertaId(a.id)}>
                          <Camera className="w-3 h-3" />
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => { setExportAlertaId(a.id); setIncludeCiencias(true); }}>
                        <Download className="w-3 h-3" />
                      </Button>
                      {isAdmin && (
                        <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-destructive border-destructive/30" onClick={() => setDeleteAlertaId(a.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Nº</th>
                    <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Projeto</th>
                    <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Descrição</th>
                    <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground hidden md:table-cell">Ocorrência</th>
                    <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground hidden md:table-cell">Validade</th>
                    <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground">Ciência</th>
                    <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a: any) => {
                    const prog = getCienciaProgress(a.id, a.linha_peca);
                    const status = getCienciaStatus(a.id, a.linha_peca, a.created_at);
                    const displayStatus = a.status && a.status !== "ativo" ? a.status : status.label;
                    return (
                      <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/alerta-qualidade/ver/${a.id}`)}>
                        <td className="py-2.5 px-2 font-mono text-xs font-bold text-[#c0392b]">{formatSeq(a.sequencial)}</td>
                        <td className="py-2.5 px-2">
                          {a.modelo && <Badge variant="outline" className="text-[10px] border-emerald-400 text-emerald-700 bg-emerald-50">{a.modelo}</Badge>}
                        </td>
                        <td className="py-2.5 px-2">
                          <p className="font-medium text-foreground line-clamp-1">{a.descricao || a.modo_falha || "—"}</p>
                        </td>
                        <td className="py-2.5 px-2 text-xs text-muted-foreground hidden md:table-cell">
                          {a.data_ocorrencia ? new Date(a.data_ocorrencia).toLocaleDateString("pt-BR") : "—"}
                        </td>
                        <td className="py-2.5 px-2 text-xs text-muted-foreground hidden md:table-cell">
                          {a.data_validade ? new Date(a.data_validade).toLocaleDateString("pt-BR") : "—"}
                        </td>
                        <td className="py-2.5 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                          {isAdmin ? (
                            <button onClick={() => { setStatusEditAlert(a); setNewStatus(displayStatus); }}>
                              <Badge variant="outline" className={`${status.color} cursor-pointer hover:opacity-80`}>{displayStatus}</Badge>
                            </button>
                          ) : (
                            <Badge variant="outline" className={status.color}>{displayStatus}</Badge>
                          )}
                        </td>
                        <td className="py-2.5 px-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col items-center gap-1 min-w-[90px]">
                            <Progress value={prog.pct} className="h-2 w-full" />
                            <span className="text-[10px] text-muted-foreground">{prog.pending}p / {prog.count}c</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            {canEdit(a) && (
                              <Button variant="outline" size="sm" className="h-7 w-7 p-0" title="Editar" onClick={() => navigate(`/alerta-qualidade/editar/${a.id}`)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {isLider && (
                              <Button variant="outline" size="sm" className="h-7 w-7 p-0" title="Escanear QR" onClick={() => setScanAlertaId(a.id)}>
                                <Camera className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <Button variant="outline" size="sm" className="h-7 w-7 p-0" title="Exportar" onClick={() => { setExportAlertaId(a.id); setIncludeCiencias(true); }}>
                              <Download className="w-3.5 h-3.5" />
                            </Button>
                            {isAdmin && (
                              <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10" title="Excluir" onClick={() => setDeleteAlertaId(a.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      <QrScannerModal open={!!scanAlertaId} onClose={() => setScanAlertaId(null)} onScan={handleQrScan} title="Registrar Ciência via QR" />

      {/* Success popup */}
      <Dialog open={!!successPopup} onOpenChange={(o) => { if (!o) setSuccessPopup(null); }}>
        <DialogContent className="max-w-xs text-center">
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Ciência Registrada!</h3>
            <p className="text-sm text-muted-foreground">
              Captura realizada com sucesso. O registro de <strong>{successPopup?.name}</strong> foi validado.
            </p>
            <Button onClick={() => setSuccessPopup(null)} className="bg-emerald-600 hover:bg-emerald-700 mt-2">OK</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Export dialog */}
      <Dialog open={!!exportAlertaId} onOpenChange={(o) => { if (!o) setExportAlertaId(null); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Exportar Alerta</DialogTitle></DialogHeader>
          <div className="flex items-center gap-2 py-2">
            <Checkbox id="include-ciencias" checked={includeCiencias} onCheckedChange={(c) => setIncludeCiencias(!!c)} />
            <Label htmlFor="include-ciencias" className="text-sm cursor-pointer">Incluir lista de ciências</Label>
          </div>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExportConfirm("jpg")} disabled={exporting}>JPG</Button>
            <Button variant="outline" size="sm" onClick={() => handleExportConfirm("pdf")} disabled={exporting}>PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteAlertaId} onOpenChange={(o) => { if (!o) setDeleteAlertaId(null); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Confirmar Exclusão</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir este alerta? Esta ação não pode ser desfeita.</p>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteAlertaId(null)}>Cancelar</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin status edit dialog */}
      <Dialog open={!!statusEditAlert} onOpenChange={(o) => { if (!o) setStatusEditAlert(null); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Alterar Status</DialogTitle></DialogHeader>
          <Select value={newStatus} onValueChange={setNewStatus}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Selecione o status" /></SelectTrigger>
            <SelectContent>
              {statusOptions.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" size="sm" onClick={() => setStatusEditAlert(null)}>Cancelar</Button>
            <Button size="sm" onClick={handleStatusChange} disabled={!newStatus}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AlertaQualidade;
