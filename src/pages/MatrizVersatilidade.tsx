import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, Users, Search, QrCode, CalendarIcon, AlertTriangle, Download, ShieldCheck, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import logo from "@/assets/hyundai-mobis-logo.png";
import ReportErrorButton from "@/components/ReportErrorButton";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const AREAS = [
  { key: "inspecao_peca", label: "Inspeção de Peça" },
  { key: "incoming", label: "Incoming" },
  { key: "pintura", label: "Pintura" },
  { key: "injecao", label: "Injeção" },
  { key: "sala_audio", label: "Sala do Áudio" },
  { key: "cp", label: "CP" },
  { key: "bp", label: "BP" },
  { key: "ch", label: "CH" },
  { key: "oem", label: "OEM" },
];

const CARGOS_QUALIDADE = [
  "Auxiliar de Qualidade",
  "Inspetor de Qualidade",
  "Assistente de Qualidade",
  "Lider de Qualidade",
];

const MatrizVersatilidade = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const qc = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [turnoFilter, setTurnoFilter] = useState("");
  const [editDialog, setEditDialog] = useState<any>(null);
  const [editDates, setEditDates] = useState<{ lastDate: string; nextDate: string }>({ lastDate: "", nextDate: "" });
  const [lastDateOpen, setLastDateOpen] = useState(false);
  const [nextDateOpen, setNextDateOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exportingQrs, setExportingQrs] = useState(false);
  const qrExportRef = useRef<HTMLDivElement>(null);
  const [editorDialog, setEditorDialog] = useState(false);
  const [editorSearch, setEditorSearch] = useState("");
  const [savingEditors, setSavingEditors] = useState(false);

  const { data: roles = [] } = useQuery({
    queryKey: ["my-roles-matriz", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch authorized editors
  const { data: matrizEditors = [] } = useQuery({
    queryKey: ["matriz-editors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("matriz_editors").select("*");
      if (error) throw error;
      return data || [];
    },
  });

  const isAuthorizedEditor = isAdmin || matrizEditors.some((e: any) => e.user_id === user?.id);
  const isLider = isAdmin || roles.some((r: any) => r.role === "lider");
  // Can edit: admin, authorized editor, or leader
  const canEdit = isAuthorizedEditor || isLider;

  const { data: inspectors = [] } = useQuery({
    queryKey: ["matriz-inspectors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, cargo, turno, qr_code_id, employee_number")
        .eq("empresa", "mobis_brasil")
        .eq("status", "active")
        .in("cargo", CARGOS_QUALIDADE)
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  // All active profiles for editor selection
  const { data: allProfiles = [] } = useQuery({
    queryKey: ["all-profiles-for-editors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, employee_number, cargo").eq("status", "active").order("full_name");
      if (error) throw error;
      return data || [];
    },
    enabled: editorDialog,
  });

  const { data: qualifications = [] } = useQuery({
    queryKey: ["inspector-qualifications"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inspector_qualifications").select("*");
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    const populateQualifications = async () => {
      if (!canEdit || inspectors.length === 0) return;
      const existingUserIds = new Set(qualifications.map((q: any) => q.user_id));
      const newInspectors = inspectors.filter((i: any) => !existingUserIds.has(i.id));
      if (newInspectors.length === 0) return;
      const inserts: any[] = [];
      for (const ins of newInspectors) {
        for (const area of AREAS) {
          inserts.push({ user_id: ins.id, area: area.key, habilitado: false });
        }
      }
      if (inserts.length > 0) {
        await supabase.from("inspector_qualifications").insert(inserts as any);
        qc.invalidateQueries({ queryKey: ["inspector-qualifications"] });
      }
    };
    populateQualifications();
  }, [inspectors, qualifications, canEdit]);

  const getQual = (userId: string, area: string) => qualifications.find((q: any) => q.user_id === userId && q.area === area);

  const getTrainingStatus = (qual: any) => {
    if (!qual || !qual.habilitado) return "na";
    if (!qual.next_evaluation_date) return "sem_data";
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const next = new Date(qual.next_evaluation_date + "T12:00:00");
    return today > next ? "vencido" : "em_dia";
  };

  const getOverallStatus = (userId: string) => {
    const userQuals = qualifications.filter((q: any) => q.user_id === userId && q.habilitado);
    if (userQuals.length === 0) return "na";
    return userQuals.some((q: any) => getTrainingStatus(q) === "vencido") ? "atencao" : "apto";
  };

  const toggleHabilitado = async (userId: string, area: string) => {
    if (!canEdit) return;
    const existing = getQual(userId, area);
    if (existing) {
      await supabase.from("inspector_qualifications").update({ habilitado: !existing.habilitado } as any).eq("id", existing.id);
    } else {
      await supabase.from("inspector_qualifications").insert({ user_id: userId, area, habilitado: true } as any);
    }
    qc.invalidateQueries({ queryKey: ["inspector-qualifications"] });
  };

  const openEditDates = (userId: string, area: string) => {
    const qual = getQual(userId, area);
    setEditDialog({ userId, area });
    setEditDates({ lastDate: qual?.last_evaluation_date || "", nextDate: qual?.next_evaluation_date || "" });
  };

  const saveDates = async () => {
    if (!editDialog) return;
    const { userId, area } = editDialog;
    const existing = getQual(userId, area);
    const updateData = { last_evaluation_date: editDates.lastDate || null, next_evaluation_date: editDates.nextDate || null };
    if (existing) {
      await supabase.from("inspector_qualifications").update(updateData as any).eq("id", existing.id);
    } else {
      await supabase.from("inspector_qualifications").insert({ user_id: userId, area, habilitado: true, ...updateData } as any);
    }
    qc.invalidateQueries({ queryKey: ["inspector-qualifications"] });
    setEditDialog(null);
    toast.success("Datas atualizadas");
  };

  const filtered = useMemo(() => {
    let result = inspectors;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter((i: any) => i.full_name?.toLowerCase().includes(term) || i.employee_number?.toLowerCase().includes(term));
    }
    if (turnoFilter) result = result.filter((i: any) => i.turno === turnoFilter);
    return result;
  }, [inspectors, searchTerm, turnoFilter]);

  const expiredInspectors = useMemo(() => inspectors.filter((ins: any) => getOverallStatus(ins.id) === "atencao"), [inspectors, qualifications]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((i: any) => i.id)));
    }
  };

  const selectedInspectors = inspectors.filter((i: any) => selectedIds.has(i.id));

  const exportSelectedQrs = async (format: "jpg" | "pdf") => {
    if (selectedInspectors.length === 0) return;
    setExportingQrs(true);
    try {
      await new Promise(r => setTimeout(r, 300));
      if (!qrExportRef.current) return;
      const canvas = await html2canvas(qrExportRef.current, { backgroundColor: "#ffffff", scale: 3 });
      if (format === "jpg") {
        const link = document.createElement("a");
        link.download = `QR-Codes-${selectedInspectors.length}.jpg`;
        link.href = canvas.toDataURL("image/jpeg", 0.95);
        link.click();
      } else {
        const imgData = canvas.toDataURL("image/png");
        const ratio = canvas.height / canvas.width;
        const pdfW = 210;
        const pdfH = pdfW * ratio;
        const pdf = new jsPDF({ orientation: pdfH > pdfW ? "portrait" : "landscape", unit: "mm", format: [pdfW, Math.max(pdfH + 10, 100)] });
        pdf.addImage(imgData, "PNG", 5, 5, pdfW - 10, (pdfW - 10) * ratio);
        pdf.save(`QR-Codes-${selectedInspectors.length}.pdf`);
      }
      toast.success(`${selectedInspectors.length} QR Code(s) exportados`);
    } catch {
      toast.error("Erro ao exportar");
    } finally {
      setExportingQrs(false);
    }
  };

  // Editor management
  const editorUserIds = new Set(matrizEditors.map((e: any) => e.user_id));
  
  const toggleEditor = async (userId: string) => {
    setSavingEditors(true);
    try {
      if (editorUserIds.has(userId)) {
        const { error } = await supabase.from("matriz_editors").delete().eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("matriz_editors").insert({ user_id: userId, granted_by: user?.id } as any);
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ["matriz-editors"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingEditors(false);
    }
  };

  const filteredEditorProfiles = useMemo(() => {
    if (!editorSearch.trim()) return allProfiles;
    const term = editorSearch.toLowerCase();
    return allProfiles.filter((p: any) => p.full_name?.toLowerCase().includes(term) || p.employee_number?.includes(term));
  }, [allProfiles, editorSearch]);

  const parseDate = (s: string) => s ? new Date(s + "T12:00:00") : undefined;

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
            <div className="flex items-center gap-1">
              {isAdmin && (
                <Button variant="ghost" size="sm" onClick={() => setEditorDialog(true)} className="text-primary-foreground/70 hover:text-primary-foreground gap-1 text-xs px-2">
                  <ShieldCheck className="w-4 h-4" /> <span className="hidden sm:inline">Autorizar Editor</span>
                </Button>
              )}
              <ReportErrorButton moduleName="Matriz de Versatilidade" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Users className="w-6 h-6" />
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-heading font-bold">Matriz de Versatilidade</h1>
              <p className="text-primary-foreground/70 text-xs">Habilitações e treinamentos dos inspetores</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
        {canEdit && expiredInspectors.length > 0 && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <span className="text-sm font-semibold text-destructive">Treinamentos Vencidos</span>
            </div>
            <p className="text-xs text-destructive/80">
              {expiredInspectors.map((i: any) => i.full_name).join(", ")} — Verifique a matriz destes inspetores.
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar por nome ou número..." className="pl-9 h-9" />
          </div>
          <Select value={turnoFilter || "all"} onValueChange={(v) => setTurnoFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-full sm:w-40 h-9 text-xs"><SelectValue placeholder="Turno" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os turnos</SelectItem>
              <SelectItem value="1T">1T</SelectItem>
              <SelectItem value="2T">2T</SelectItem>
              <SelectItem value="3T">3T</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bulk QR export bar */}
        {selectedIds.size > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-accent/30 border border-accent rounded-lg p-3">
            <span className="text-sm font-medium">{selectedIds.size} inspetor(es) selecionado(s)</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportSelectedQrs("jpg")} disabled={exportingQrs} className="gap-1 text-xs">
                <Download className="w-3 h-3" /> JPG
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportSelectedQrs("pdf")} disabled={exportingQrs} className="gap-1 text-xs">
                <Download className="w-3 h-3" /> PDF
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} className="text-xs">
                Limpar
              </Button>
            </div>
          </div>
        )}

        {/* Mobile card layout */}
        <div className="sm:hidden space-y-3">
          {filtered.map((ins: any) => {
            const overall = getOverallStatus(ins.id);
            return (
              <div key={ins.id} className="form-section p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={selectedIds.has(ins.id)} onCheckedChange={() => toggleSelect(ins.id)} className="h-4 w-4" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{ins.full_name}</p>
                      <p className="text-[10px] text-muted-foreground">{ins.cargo || "—"} • {ins.turno || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigate("/meu-qr")}><QrCode className="w-3 h-3" /></Button>
                    {overall === "apto" ? (
                      <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-300 text-[9px] px-1.5">Apto</Badge>
                    ) : overall === "atencao" ? (
                      <Badge className="bg-red-500/10 text-red-700 border-red-300 text-[9px] px-1.5 animate-pulse">Atenção</Badge>
                    ) : (
                      <span className="text-muted-foreground text-[9px]">—</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {AREAS.map(area => {
                    const qual = getQual(ins.id, area.key);
                    const isHab = qual?.habilitado;
                    const status = getTrainingStatus(qual);
                    return (
                      <div key={area.key} className="flex items-center gap-1 text-[10px]">
                        <Checkbox
                          checked={isHab || false}
                          onCheckedChange={() => canEdit && toggleHabilitado(ins.id, area.key)}
                          disabled={!canEdit}
                          className="h-3.5 w-3.5"
                        />
                        <button
                          onClick={() => isHab && canEdit && openEditDates(ins.id, area.key)}
                          className={cn(
                            "truncate",
                            isHab && status === "vencido" ? "text-red-700 font-bold" :
                            isHab && status === "em_dia" ? "text-emerald-700" :
                            "text-muted-foreground"
                          )}
                        >
                          {area.label}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="form-section text-center py-8">
              <p className="text-muted-foreground text-sm">Nenhum inspetor encontrado</p>
            </div>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto -mx-3 px-3">
          <table className="w-full text-xs border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b-2 border-border">
                <th className="py-2 px-1 w-8">
                  <Checkbox checked={filtered.length > 0 && selectedIds.size === filtered.length} onCheckedChange={toggleSelectAll} className="h-4 w-4" />
                </th>
                <th className="text-left py-2 px-1.5 font-semibold text-muted-foreground w-16">INSP-ID</th>
                <th className="text-left py-2 px-1.5 font-semibold text-muted-foreground w-8">QR</th>
                <th className="text-left py-2 px-1.5 font-semibold text-muted-foreground min-w-[120px]">Nome</th>
                <th className="text-left py-2 px-1.5 font-semibold text-muted-foreground w-20">Cargo</th>
                <th className="text-center py-2 px-1.5 font-semibold text-muted-foreground w-10">Turno</th>
                {AREAS.map(a => (
                  <th key={a.key} className="text-center py-2 px-1 font-semibold text-muted-foreground w-16">
                    <span className="block text-[9px] leading-tight">{a.label}</span>
                  </th>
                ))}
                <th className="text-center py-2 px-1.5 font-semibold text-muted-foreground w-16">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ins: any) => {
                const overall = getOverallStatus(ins.id);
                return (
                  <tr key={ins.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2 px-1 text-center">
                      <Checkbox checked={selectedIds.has(ins.id)} onCheckedChange={() => toggleSelect(ins.id)} className="h-4 w-4" />
                    </td>
                    <td className="py-2 px-1.5 font-mono text-[10px] font-bold">{ins.qr_code_id || "—"}</td>
                    <td className="py-2 px-1.5">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigate("/meu-qr")} title="QR Code">
                        <QrCode className="w-3 h-3" />
                      </Button>
                    </td>
                    <td className="py-2 px-1.5 font-medium text-foreground">{ins.full_name}</td>
                    <td className="py-2 px-1.5 text-muted-foreground text-[10px]">{ins.cargo || "—"}</td>
                    <td className="py-2 px-1.5 text-center">{ins.turno || "—"}</td>
                    {AREAS.map(area => {
                      const qual = getQual(ins.id, area.key);
                      const isHab = qual?.habilitado;
                      const status = getTrainingStatus(qual);
                      return (
                        <td key={area.key} className="py-1 px-0.5 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <Checkbox
                              checked={isHab || false}
                              onCheckedChange={() => canEdit && toggleHabilitado(ins.id, area.key)}
                              disabled={!canEdit}
                              className="h-4 w-4"
                            />
                            {isHab && (
                              <button
                                onClick={() => canEdit && openEditDates(ins.id, area.key)}
                                className={cn(
                                  "text-[8px] leading-tight px-1 py-0.5 rounded cursor-pointer",
                                  status === "vencido" ? "bg-red-100 text-red-700 font-bold" :
                                  status === "em_dia" ? "bg-emerald-100 text-emerald-700" :
                                  "bg-muted text-muted-foreground"
                                )}
                              >
                                {status === "vencido" ? "Vencido" : status === "em_dia" ? "Em dia" : "—"}
                              </button>
                            )}
                            {isHab && qual?.next_evaluation_date && (
                              <span className="text-[7px] text-muted-foreground">
                                {new Date(qual.next_evaluation_date + "T12:00:00").toLocaleDateString("pt-BR")}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="py-2 px-1.5 text-center">
                      {overall === "apto" ? (
                        <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-300 text-[9px] px-1.5">Apto</Badge>
                      ) : overall === "atencao" ? (
                        <Badge className="bg-red-500/10 text-red-700 border-red-300 text-[9px] px-1.5 animate-pulse">Atenção</Badge>
                      ) : (
                        <span className="text-muted-foreground text-[9px]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6 + AREAS.length + 1} className="text-center text-muted-foreground py-8">Nenhum inspetor encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground text-center">{filtered.length} inspetor(es)</p>

        {/* Hidden QR cards for bulk export */}
        {selectedInspectors.length > 0 && (
          <div ref={qrExportRef} className="fixed left-[-9999px] top-0 bg-white p-4" style={{ width: `${Math.min(selectedInspectors.length, 4) * 200}px` }}>
            <div className="flex flex-wrap gap-4">
              {selectedInspectors.map((ins: any) => (
                <div key={ins.id} className="flex flex-col items-center p-3 border border-gray-200 rounded-lg" style={{ width: 180 }}>
                  <QRCodeSVG value={ins.qr_code_id || ""} size={120} level="H" />
                  <p className="text-xs font-bold mt-2 text-center" style={{ color: "#000" }}>{ins.full_name}</p>
                  <p className="text-[10px] text-gray-500">{ins.cargo}</p>
                  <p className="text-[9px] font-mono text-gray-400 mt-0.5">{ins.qr_code_id}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Edit dates dialog */}
      <Dialog open={!!editDialog} onOpenChange={(open) => { if (!open) setEditDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Datas de Treinamento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Última Avaliação</label>
              <Popover open={lastDateOpen} onOpenChange={setLastDateOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-sm h-9">
                    <CalendarIcon className="w-3.5 h-3.5 mr-2" />
                    {editDates.lastDate ? format(new Date(editDates.lastDate + "T12:00:00"), "dd/MM/yyyy") : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={parseDate(editDates.lastDate)} onSelect={(d) => { if (d) { setEditDates(p => ({ ...p, lastDate: format(d, "yyyy-MM-dd") })); setLastDateOpen(false); }}} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Próxima Avaliação</label>
              <Popover open={nextDateOpen} onOpenChange={setNextDateOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-sm h-9">
                    <CalendarIcon className="w-3.5 h-3.5 mr-2" />
                    {editDates.nextDate ? format(new Date(editDates.nextDate + "T12:00:00"), "dd/MM/yyyy") : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={parseDate(editDates.nextDate)} onSelect={(d) => { if (d) { setEditDates(p => ({ ...p, nextDate: format(d, "yyyy-MM-dd") })); setNextDateOpen(false); }}} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <Button onClick={saveDates} className="w-full">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Authorize Editors dialog (ADM only) */}
      <Dialog open={editorDialog} onOpenChange={setEditorDialog}>
        <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" /> Autorizar Editores
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Selecione os usuários autorizados a editar a Matriz de Versatilidade.</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={editorSearch} onChange={(e) => setEditorSearch(e.target.value)} placeholder="Buscar usuário..." className="pl-9 h-8 text-xs" />
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
            {filteredEditorProfiles.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={editorUserIds.has(p.id)}
                    onCheckedChange={() => toggleEditor(p.id)}
                    disabled={savingEditors}
                    className="h-4 w-4"
                  />
                  <div>
                    <p className="text-sm font-medium">{p.full_name}</p>
                    <p className="text-[10px] text-muted-foreground">{p.cargo || ""} • {p.employee_number}</p>
                  </div>
                </div>
                {editorUserIds.has(p.id) && (
                  <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-300 text-[9px]">Editor</Badge>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditorDialog(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MatrizVersatilidade;
