import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, Users, Search, QrCode, CalendarIcon, AlertTriangle, Check, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import logo from "@/assets/hyundai-mobis-logo.png";
import ReportErrorButton from "@/components/ReportErrorButton";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

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

  // Check user role
  const { data: roles = [] } = useQuery({
    queryKey: ["my-roles-matriz", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      return data || [];
    },
    enabled: !!user?.id,
  });
  const isLider = isAdmin || roles.some((r: any) => r.role === "lider");

  // Get qualifying profiles (Mobis Brasil + quality cargos)
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

  // Get qualifications
  const { data: qualifications = [] } = useQuery({
    queryKey: ["inspector-qualifications"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inspector_qualifications").select("*");
      if (error) throw error;
      return data || [];
    },
  });

  // Auto-populate qualifications for new inspectors
  useEffect(() => {
    const populateQualifications = async () => {
      if (!isLider || inspectors.length === 0) return;
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
  }, [inspectors, qualifications, isLider]);

  const getQual = (userId: string, area: string) => {
    return qualifications.find((q: any) => q.user_id === userId && q.area === area);
  };

  const getTrainingStatus = (qual: any) => {
    if (!qual || !qual.habilitado) return "na";
    if (!qual.next_evaluation_date) return "sem_data";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next = new Date(qual.next_evaluation_date + "T12:00:00");
    return today > next ? "vencido" : "em_dia";
  };

  const getOverallStatus = (userId: string) => {
    const userQuals = qualifications.filter((q: any) => q.user_id === userId && q.habilitado);
    if (userQuals.length === 0) return "na";
    const hasVencido = userQuals.some((q: any) => {
      const status = getTrainingStatus(q);
      return status === "vencido";
    });
    return hasVencido ? "atencao" : "apto";
  };

  const toggleHabilitado = async (userId: string, area: string) => {
    if (!isLider) return;
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
    setEditDates({
      lastDate: qual?.last_evaluation_date || "",
      nextDate: qual?.next_evaluation_date || "",
    });
  };

  const saveDates = async () => {
    if (!editDialog) return;
    const { userId, area } = editDialog;
    const existing = getQual(userId, area);
    const updateData = {
      last_evaluation_date: editDates.lastDate || null,
      next_evaluation_date: editDates.nextDate || null,
    };
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
    if (turnoFilter) {
      result = result.filter((i: any) => i.turno === turnoFilter);
    }
    return result;
  }, [inspectors, searchTerm, turnoFilter]);

  // Alert for expired trainings
  const expiredInspectors = useMemo(() => {
    return inspectors.filter((ins: any) => getOverallStatus(ins.id) === "atencao");
  }, [inspectors, qualifications]);

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
            <ReportErrorButton moduleName="Matriz de Versatilidade" />
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
        {/* Expired training alert */}
        {isLider && expiredInspectors.length > 0 && (
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

        {/* Filters */}
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

        {/* Matrix table */}
        <div className="overflow-x-auto -mx-3 px-3">
          <table className="w-full text-xs border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b-2 border-border">
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
                              onCheckedChange={() => isLider && toggleHabilitado(ins.id, area.key)}
                              disabled={!isLider}
                              className="h-4 w-4"
                            />
                            {isHab && (
                              <button
                                onClick={() => isLider && openEditDates(ins.id, area.key)}
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
                <tr><td colSpan={5 + AREAS.length + 1} className="text-center text-muted-foreground py-8">Nenhum inspetor encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground text-center">{filtered.length} inspetor(es)</p>
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
    </div>
  );
};

export default MatrizVersatilidade;
