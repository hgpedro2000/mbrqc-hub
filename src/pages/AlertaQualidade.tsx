import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, AlertTriangle, Camera, Search, Download, CheckCircle2, Pencil, Trash2, Archive, FileSpreadsheet, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useUserRole } from "@/hooks/useUserRole";
import QrScannerModal from "@/components/QrScannerModal";
import logo from "@/assets/hyundai-mobis-logo.png";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Settings2 } from "lucide-react";
import { logAction } from "@/lib/logAction";

const lineAreaMap: Record<string, string> = {
  "CP": "cp", "BP": "bp", "CH": "ch", "OEM": "oem",
  "Incoming": "incoming", "Pintura": "pintura", "Injeção": "injecao",
  "Sala do Áudio": "sala_audio", "Inspeção de Peça": "inspecao_peca",
};

// Cargos that can CREATE alerts
const CARGOS_CRIAR_ALERTA = [
  "Lider de Qualidade",
  "Assistente de Qualidade",
  "Analista de Qualidade",
  "Supervisor de Qualidade",
  "Gerente de Qualidade",
  "Diretor de Qualidade",
];

const AlertaQualidade = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { impersonating } = useImpersonation();
  const { isAdmin } = useUserRole();
  const qc = useQueryClient();
  // When impersonating, treat all checks as if the impersonated user were logged in
  const effectiveUserId = impersonating?.id || user?.id;
  const effectiveCargo = impersonating?.cargo ?? profile?.cargo ?? "";
  const [scanAlertaId, setScanAlertaId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [archiveTab, setArchiveTab] = useState<"vigentes" | "arquivados">("vigentes");
  const [exportAlertaId, setExportAlertaId] = useState<string | null>(null);
  const [includeCiencias, setIncludeCiencias] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [successPopup, setSuccessPopup] = useState<{ name: string } | null>(null);
  const [deleteAlertaId, setDeleteAlertaId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [statusEditAlert, setStatusEditAlert] = useState<any>(null);
  const [newStatus, setNewStatus] = useState("");
  const [trainingWarning, setTrainingWarning] = useState<{ name: string; date: string; type: "vencido" | "vencendo" } | null>(null);
  const [justifyAlert, setJustifyAlert] = useState<any>(null);
  const [justifySelections, setJustifySelections] = useState<Record<string, string>>({});
  const [justifyCustom, setJustifyCustom] = useState<Record<string, string>>({});
  const [justifySaving, setJustifySaving] = useState(false);
  // Filters / sort — persisted in localStorage
  const LS_KEY = "alertaQualidade.listMaster.v1";
  const persisted = (() => { try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; } })();
  const [statusFilter, setStatusFilter] = useState<string>(persisted.statusFilter ?? "todos");
  const [respFilter, setRespFilter] = useState<string>(persisted.respFilter ?? "todos");
  const [lineFilter, setLineFilter] = useState<string>(persisted.lineFilter ?? "todos");
  const [sortBy, setSortBy] = useState<string>(persisted.sortBy ?? "recentes");
  const [compact, setCompact] = useState<boolean>(persisted.compact ?? false);
  const defaultColVis = { projeto: true, linhaPeca: true, responsabilidade: true, deteccao: true, ocorrencia: true, validade: true, situacao: true };
  const [colVis, setColVis] = useState<Record<string, boolean>>({ ...defaultColVis, ...(persisted.colVis ?? {}) });
  const [expandedDesc, setExpandedDesc] = useState<Set<string>>(new Set());
  const toggleDesc = (id: string) => setExpandedDesc((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Persist filters/compact/columns
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ statusFilter, respFilter, lineFilter, sortBy, compact, colVis }));
    } catch {}
  }, [statusFilter, respFilter, lineFilter, sortBy, compact, colVis]);

  // Persist & restore horizontal scroll position (survives refetch/realtime re-renders)
  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    const saved = Number(sessionStorage.getItem(LS_KEY + ".scrollX") || 0);
    if (saved) el.scrollLeft = saved;
    const onScroll = () => sessionStorage.setItem(LS_KEY + ".scrollX", String(el.scrollLeft));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);



  const { data: roles = [] } = useQuery({
    queryKey: ["my-roles-alerta", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", effectiveUserId);
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveUserId,
  });

  // While impersonating, ignore the real admin role
  const effectiveIsAdmin = impersonating ? roles.some((r: any) => r.role === "admin") : isAdmin;
  const isLider = effectiveIsAdmin || roles.some((r: any) => r.role === "lider");
  const isInspetor = roles.some((r: any) => r.role === "inspetor") || /inspetor/i.test(effectiveCargo);

  // Can CREATE alerts: admin OR has a quality cargo
  const canCreateAlert = effectiveIsAdmin || CARGOS_CRIAR_ALERTA.includes(effectiveCargo);

  // Can SCAN QR: any leader role (regardless of cargo)
  const canScanQr = isLider;

  // Can VIEW ALL alerts: admin, lider role, or quality management cargos
  const canViewAll = effectiveIsAdmin || isLider || CARGOS_CRIAR_ALERTA.includes(effectiveCargo);

  useEffect(() => {
    // Inspectors (or anyone without view-all permission) go to the personal feed
    if (!canViewAll) {
      navigate("/alerta-qualidade/feed", { replace: true });
    }
  }, [canViewAll, navigate]);

  const { data: alertas = [], isLoading, isFetching: alertasFetching, error: alertasError, refetch: refetchAlertas } = useQuery({
    queryKey: ["alertas-lista-mestra"],
    queryFn: async () => {
      const { data, error } = await supabase.from("alertas").select("*").order("sequencial", { ascending: false });
      if (error) throw error;
      return data;
    },
    retry: 2,
  });

  const { data: ciencias = [], isFetching: cienciasFetching, error: cienciasError } = useQuery({
    queryKey: ["ciencias-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ciencias").select("*");
      if (error) throw error;
      return data;
    },
    retry: 2,
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

  const { data: profilesList = [] } = useQuery({
    queryKey: ["profiles-name-map"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("public_profiles").select("id, full_name");
      if (error) throw error;
      return data || [];
    },
  });
  const profileNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of profilesList as any[]) m[p.id] = p.full_name;
    return m;
  }, [profilesList]);

  useEffect(() => {
    const channel = supabase
      .channel("alertas-lista-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "ciencias" }, () => {
        qc.invalidateQueries({ queryKey: ["ciencias-all"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "alertas" }, () => {
        qc.invalidateQueries({ queryKey: ["alertas-lista-mestra"] });
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

  // Visibility: admin/lider/quality cargos see all; inspetores only see alerts for their qualified areas
  const filteredByVisibility = useMemo(() => {
    if (canViewAll) return alertas;
    if (!effectiveUserId) return [];
    return alertas.filter((a: any) => {
      const qualifiedInspectors = getQualifiedInspectors(a.linha_peca);
      return qualifiedInspectors.includes(effectiveUserId);
    });
  }, [alertas, canViewAll, effectiveUserId, qualifications, partNumbers]);

  const isExpired = (validade: string | null) => {
    if (!validade) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const v = new Date(validade + "T12:00:00");
    return v < today;
  };

  const byTab = useMemo(() => {
    return filteredByVisibility.filter((a: any) => {
      const expired = isExpired(a.data_validade);
      return archiveTab === "arquivados" ? expired : !expired;
    });
  }, [filteredByVisibility, archiveTab]);

  const tabCounts = useMemo(() => {
    let v = 0, ar = 0;
    for (const a of filteredByVisibility as any[]) {
      if (isExpired(a.data_validade)) ar++; else v++;
    }
    return { vigentes: v, arquivados: ar };
  }, [filteredByVisibility]);

  const respOptions = useMemo(() => {
    const s = new Set<string>();
    for (const a of filteredByVisibility as any[]) if (a.responsabilidade) s.add(a.responsabilidade);
    return Array.from(s).sort();
  }, [filteredByVisibility]);

  const lineOptions = useMemo(() => {
    const s = new Set<string>();
    for (const a of filteredByVisibility as any[]) if (a.linha_peca) s.add(a.linha_peca);
    return Array.from(s).sort();
  }, [filteredByVisibility]);

  const filtered = useMemo(() => {
    let list = byTab as any[];
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter((a: any) =>
        formatSeq(a.sequencial).toLowerCase().includes(term) ||
        a.descricao?.toLowerCase().includes(term) ||
        a.modo_falha?.toLowerCase().includes(term) ||
        a.modelo?.toLowerCase().includes(term)
      );
    }
    if (statusFilter !== "todos") {
      list = list.filter((a: any) => {
        const st = getCienciaStatus(a.id, a.linha_peca, a.created_at).label;
        const displayStatus = a.status && a.status !== "ativo" ? a.status : st;
        return displayStatus === statusFilter;
      });
    }
    if (respFilter !== "todos") list = list.filter((a: any) => a.responsabilidade === respFilter);
    if (lineFilter !== "todos") list = list.filter((a: any) => a.linha_peca === lineFilter);
    const sorted = [...list];
    if (sortBy === "recentes") sorted.sort((a, b) => (b.sequencial || 0) - (a.sequencial || 0));
    else if (sortBy === "antigos") sorted.sort((a, b) => (a.sequencial || 0) - (b.sequencial || 0));
    else if (sortBy === "responsabilidade") sorted.sort((a, b) => (a.responsabilidade || "").localeCompare(b.responsabilidade || ""));
    else if (sortBy === "linha") sorted.sort((a, b) => (a.linha_peca || "").localeCompare(b.linha_peca || ""));
    else if (sortBy === "validade") sorted.sort((a, b) => (a.data_validade || "").localeCompare(b.data_validade || ""));
    return sorted;
  }, [byTab, searchTerm, statusFilter, respFilter, lineFilter, sortBy, ciencias, qualifications, partNumbers]);


  const handleQrScan = async (qrValue: string) => {
    if (!scanAlertaId) return;
    const alertaId = scanAlertaId;
    try {
      const { data: inspetorRaw, error: findErr } = await (supabase as any)
        .from("public_profiles").select("id, full_name").eq("qr_code_id", qrValue).maybeSingle();
      const inspetor = inspetorRaw as { id: string; full_name: string } | null;
      if (findErr || !inspetor) { toast.error("QR Code não reconhecido."); return; }

      // Check training status (informational only — does NOT block ciência)
      const { data: quals } = await supabase
        .from("inspector_qualifications")
        .select("next_evaluation_date")
        .eq("user_id", inspetor.id)
        .eq("habilitado", true);
      let worst: { date: Date; type: "vencido" | "vencendo" } | null = null;
      if (quals && quals.length > 0) {
        const today = new Date(); today.setHours(0,0,0,0);
        const in30 = new Date(today); in30.setDate(in30.getDate() + 30);
        for (const q of quals as any[]) {
          if (!q.next_evaluation_date) continue;
          const d = new Date(q.next_evaluation_date + "T12:00:00");
          if (d < today) {
            if (!worst || worst.type !== "vencido" || d < worst.date) worst = { date: d, type: "vencido" };
          } else if (d <= in30) {
            if (!worst) worst = { date: d, type: "vencendo" };
            else if (worst.type === "vencendo" && d < worst.date) worst = { date: d, type: "vencendo" };
          }
        }
      }

      const { data: existing } = await supabase.from("ciencias").select("id").eq("alerta_id", alertaId).eq("inspetor_id", inspetor.id).maybeSingle();
      if (existing) {
        toast.info(`${inspetor.full_name} já havia dado ciência neste alerta.`);
        setScanAlertaId(null);
        if (worst) setTrainingWarning({ name: inspetor.full_name, date: worst.date.toLocaleDateString("pt-BR"), type: worst.type });
        return;
      }
      const { error: insertErr } = await supabase.from("ciencias").insert({
        alerta_id: alertaId, inspetor_id: inspetor.id, metodo: "qr_lider", registrado_por_id: user?.id,
      } as any);
      if (insertErr) throw insertErr;
      logAction("validate_qr", "alerta_qualidade", {
        alerta_id: alertaId, inspetor_id: inspetor.id, inspetor_name: inspetor.full_name,
      });
      qc.invalidateQueries({ queryKey: ["ciencias-all"] });
      setScanAlertaId(null);
      // Always confirm success; if training is overdue/expiring, also show informational popup
      setSuccessPopup({ name: inspetor.full_name });
      if (worst) {
        setTrainingWarning({ name: inspetor.full_name, date: worst.date.toLocaleDateString("pt-BR"), type: worst.type });
      }
    } catch (e: any) { toast.error(e.message); }
  };

  const handleExportConfirm = async (format: "jpg" | "pdf" | "pptx") => {
    if (!exportAlertaId) return;
    setExporting(true);
    const params = new URLSearchParams({ export: format });
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
      logAction("delete", "alerta_qualidade", { alerta_id: deleteAlertaId });
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

  // Edit: only admin or who created the alert (respects impersonation)
  const canEdit = (alerta: any) => effectiveIsAdmin || alerta.criado_por_id === effectiveUserId;

  const handleExportCsv = () => {
    try {
      const headers = ["Nº", "Projeto", "Descrição", "Modo de Falha", "Linha/Peça", "Responsabilidade", "Detecção", "Ocorrência", "Validade", "Situação", "Status", "Ciência %", "Ciência (assin./total)"];
      const escape = (v: any) => {
        const s = v == null ? "" : String(v);
        return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const rows = (filtered as any[]).map((a) => {
        const prog = getCienciaProgress(a.id, a.linha_peca);
        const st = getCienciaStatus(a.id, a.linha_peca, a.created_at);
        const displayStatus = a.status && a.status !== "ativo" ? a.status : st.label;
        const situacao = a.status === "rascunho" ? "Rascunho" : "Emitido";
        return [
          formatSeq(a.sequencial), a.modelo || "", a.descricao || "", a.modo_falha || "",
          a.linha_peca || "", a.responsabilidade || "", a.local_detectado || "",
          a.data_ocorrencia ? new Date(a.data_ocorrencia).toLocaleDateString("pt-BR") : "",
          a.data_validade ? new Date(a.data_validade).toLocaleDateString("pt-BR") : "",
          situacao, displayStatus, `${prog.pct}%`, `${prog.count}/${prog.total}`,
        ].map(escape).join(";");
      });
      const csv = "\ufeff" + headers.map(escape).join(";") + "\n" + rows.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `lista-mestra-alertas-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`${rows.length} alerta(s) exportado(s)`);
    } catch (e: any) {
      toast.error(`Falha ao exportar: ${e.message}`);
    }
  };

  const getPendingInspectors = (alertaId: string, linhaPeca: string | null) => {
    const qualified = getQualifiedInspectors(linhaPeca);
    const signed = new Set(ciencias.filter((c: any) => c.alerta_id === alertaId).map((c: any) => c.inspetor_id));
    return qualified.filter((uid) => !signed.has(uid));
  };

  const openJustifyDialog = (alerta: any) => {
    setJustifyAlert(alerta);
    setJustifySelections({});
    setJustifyCustom({});
  };

  const handleJustifySubmit = async () => {
    if (!justifyAlert) return;
    const pending = getPendingInspectors(justifyAlert.id, justifyAlert.linha_peca);
    const rows = pending
      .map((uid) => {
        const sel = justifySelections[uid];
        if (!sel) return null;
        const just = sel === "outro" ? (justifyCustom[uid] || "").trim() : sel;
        if (!just) return null;
        return {
          alerta_id: justifyAlert.id,
          inspetor_id: uid,
          metodo: "justificado",
          justificativa: just,
          registrado_por_id: user?.id,
        };
      })
      .filter(Boolean);
    if (rows.length === 0) {
      toast.error("Selecione ao menos uma justificativa");
      return;
    }
    setJustifySaving(true);
    try {
      // Use upsert to avoid duplicate-key failures on retries / page reloads
      const { error } = await (supabase as any)
        .from("ciencias")
        .upsert(rows as any, { onConflict: "alerta_id,inspetor_id", ignoreDuplicates: false });
      if (error) throw error;
      logAction("justify", "alerta_qualidade", { alerta_id: justifyAlert.id, total: rows.length });
      // Force refetch so the master list + Ciência bar reflect new status immediately
      await Promise.all([
        qc.refetchQueries({ queryKey: ["ciencias-all"] }),
        qc.refetchQueries({ queryKey: ["alertas-lista-mestra"] }),
      ]);
      toast.success(`${rows.length} justificativa(s) registrada(s)`);
      setJustifyAlert(null);
      setJustifySelections({});
      setJustifyCustom({});
    } catch (e: any) {
      toast.error(`Falha ao salvar: ${e.message}. Tente novamente.`);
    } finally {
      setJustifySaving(false);
    }
  };

  const CienciaBar = ({ pct, count, total, onClick, clickable }: { pct: number; count: number; total: number; onClick?: () => void; clickable?: boolean }) => (
    <div className="flex items-center gap-2 w-full">
      <div
        className={`relative flex-1 h-5 rounded-full overflow-hidden border border-border ${clickable ? "cursor-pointer hover:ring-2 hover:ring-amber-400" : ""}`}
        style={{ background: "linear-gradient(90deg,#ef4444 0%,#f59e0b 50%,#10b981 100%)" }}
        onClick={onClick}
        title={clickable ? "Clique para justificar pendências" : undefined}
      >
        {/* Dim overlay on the unfilled portion */}
        <div className="absolute inset-y-0 right-0 bg-black/55" style={{ width: `${100 - pct}%` }} />
        {/* Indicator marker */}
        <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow" style={{ left: `calc(${pct}% - 1px)` }} />
        {/* Centered percentage */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] font-bold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
            {pct}%
          </span>
        </div>
      </div>
      <span className="text-[11px] font-semibold text-muted-foreground tabular-nums whitespace-nowrap">
        {count}/{total}
      </span>
    </div>
  );

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

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 max-w-[1600px]">
        <div className="flex flex-col sm:flex-row justify-between gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar..." className="pl-9 h-9" />
          </div>
          <Button
            variant="outline"
            onClick={() => navigate("/alerta-qualidade/feed")}
            className="gap-2 shrink-0"
            title="Dar ciência diretamente pelo app"
          >
            <CheckCircle2 className="w-4 h-4" /> Meus Pendentes
          </Button>
          <Button
            variant="outline"
            onClick={handleExportCsv}
            className="gap-2 shrink-0"
            title="Exportar lista filtrada em CSV (abre no Excel)"
            disabled={filtered.length === 0}
          >
            <FileSpreadsheet className="w-4 h-4" /> Exportar CSV
          </Button>
          {canCreateAlert && (
            <Button onClick={() => navigate("/alerta-qualidade/novo")} className="gap-2 bg-[#c0392b] hover:bg-[#a93226] shrink-0">
              <Plus className="w-4 h-4" /> Novo Alerta
            </Button>
          )}
        </div>

        {(alertasError || cienciasError) && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 text-destructive px-3 py-2 text-xs flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Falha ao carregar dados. Verifique sua conexão.
            </span>
            <Button size="sm" variant="outline" className="h-7" onClick={() => refetchAlertas()}>Tentar novamente</Button>
          </div>
        )}

        {(alertasFetching || cienciasFetching) && !isLoading && (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" /> Atualizando…
          </div>
        )}

        <Tabs value={archiveTab} onValueChange={(v) => setArchiveTab(v as "vigentes" | "arquivados")}>
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="vigentes" className="gap-2">
              <AlertTriangle className="w-4 h-4" />
              Vigentes <span className="text-xs opacity-70">({tabCounts.vigentes})</span>
            </TabsTrigger>
            <TabsTrigger value="arquivados" className="gap-2">
              <Archive className="w-4 h-4" />
              Arquivados <span className="text-xs opacity-70">({tabCounts.arquivados})</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Filters & sort */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="Em andamento">Em andamento</SelectItem>
              <SelectItem value="Atrasado">Atrasado</SelectItem>
              <SelectItem value="Completo">Completo</SelectItem>
              <SelectItem value="Sem destino">Sem destino</SelectItem>
            </SelectContent>
          </Select>
          <Select value={respFilter} onValueChange={setRespFilter}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Responsabilidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas responsab.</SelectItem>
              {respOptions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={lineFilter} onValueChange={setLineFilter}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Linha/Peça" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas linhas/peças</SelectItem>
              {lineOptions.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Ordenar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recentes">Mais recentes</SelectItem>
              <SelectItem value="antigos">Mais antigos</SelectItem>
              <SelectItem value="responsabilidade">Responsabilidade (A-Z)</SelectItem>
              <SelectItem value="linha">Linha/Peça (A-Z)</SelectItem>
              <SelectItem value="validade">Validade</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="text-[11px] px-2.5 py-1 rounded border border-border bg-muted/40 hover:bg-muted text-foreground/80 inline-flex items-center gap-1"
                title="Mostrar/ocultar colunas"
              >
                <Settings2 className="w-3 h-3" /> Colunas
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52 p-2 space-y-1">
              <p className="text-[11px] font-semibold text-muted-foreground px-1 pb-1">Mostrar colunas</p>
              {[
                ["projeto", "Projeto"],
                ["linhaPeca", "Linha/Peça"],
                ["responsabilidade", "Responsabilidade"],
                ["deteccao", "Detecção"],
                ["ocorrencia", "Ocorrência"],
                ["validade", "Validade"],
                ["situacao", "Situação"],
              ].map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 text-xs px-1 py-1 rounded hover:bg-muted/50 cursor-pointer">
                  <Checkbox checked={!!colVis[k]} onCheckedChange={(v) => setColVis((p) => ({ ...p, [k]: !!v }))} />
                  {label}
                </label>
              ))}
            </PopoverContent>
          </Popover>
          <button
            type="button"
            onClick={() => setCompact((c) => !c)}
            className="text-[11px] px-2.5 py-1 rounded border border-border bg-muted/40 hover:bg-muted text-foreground/80"
            title="Alterna entre modo normal e compacto"
          >
            {compact ? "Modo normal" : "Modo compacto"}
          </button>
        </div>



        {isLoading ? (
          <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" /></div>
        ) : filtered.length === 0 ? (
          <div className="form-section text-center py-12">
            <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum alerta encontrado</p>
          </div>
        ) : (
          <>
            {/* Desktop / tablet table */}
            <div ref={scrollRef} className="hidden md:block overflow-x-auto max-h-[70vh] overflow-y-auto rounded border border-border/40">
              <table className="w-full min-w-0 text-sm table-fixed">
                <colgroup>
                  <col className="w-[70px]" />
                  {colVis.projeto && <col className="w-[70px]" />}
                  <col />
                  {colVis.linhaPeca && <col className="w-[130px]" />}
                  {colVis.responsabilidade && <col className="w-[130px]" />}
                  {colVis.deteccao && <col className="w-[100px]" />}
                  {colVis.ocorrencia && <col className="w-[72px] hidden lg:table-column" />}
                  {colVis.validade && <col className="w-[72px] hidden lg:table-column" />}
                  {colVis.situacao && <col className="w-[85px]" />}
                  <col className="w-[95px]" />
                  <col className="w-[110px]" />
                  <col className="w-[110px]" />
                </colgroup>
                <thead className="bg-muted/30 sticky top-0 z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                  <tr className="border-b border-border">
                    <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">Nº</th>
                    {colVis.projeto && <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">Projeto</th>}
                    <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">Descrição</th>
                    {colVis.linhaPeca && <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">Linha/Peça</th>}
                    {colVis.responsabilidade && <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">Responsabilidade</th>}
                    {colVis.deteccao && <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">Detecção</th>}
                    {colVis.ocorrencia && <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground hidden lg:table-cell whitespace-nowrap">Ocorrência</th>}
                    {colVis.validade && <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground hidden lg:table-cell whitespace-nowrap">Validade</th>}
                    {colVis.situacao && <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">Situação</th>}
                    <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">Status</th>
                    <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">Ciência</th>
                    <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground whitespace-nowrap">Ações</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((a: any) => {
                    const prog = getCienciaProgress(a.id, a.linha_peca);
                    const status = getCienciaStatus(a.id, a.linha_peca, a.created_at);
                    const displayStatus = a.status && a.status !== "ativo" ? a.status : status.label;
                    const isExpanded = expandedDesc.has(a.id);
                    const rowPad = compact ? "py-2.5" : "py-4";
                    const descPad = rowPad;
                    const descSize = compact ? "text-[10px]" : "text-[11px]";
                    const descClamp = isExpanded ? "" : (compact ? "line-clamp-3" : "line-clamp-4");
                    return (
                      <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer align-middle" onClick={() => navigate(`/alerta-qualidade/ver/${a.id}`)}>
                        <td className={`${rowPad} px-2 font-mono text-xs font-bold text-[#c0392b] text-center`}>{formatSeq(a.sequencial)}</td>
                        {colVis.projeto && (
                          <td className={`${rowPad} px-2 text-center`}>
                            {a.modelo && <Badge variant="outline" className="text-[10px] border-emerald-400 text-emerald-700 bg-emerald-50">{a.modelo}</Badge>}
                          </td>
                        )}
                        <td className={`${descPad} px-2`} title={a.descricao || a.modo_falha || ""}>
                          <p className={`font-medium text-foreground ${descSize} ${descClamp} leading-snug break-words`}>
                            {a.descricao || a.modo_falha || "—"}
                          </p>
                          {(a.descricao || a.modo_falha || "").length > 80 && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); toggleDesc(a.id); }}
                              className="mt-0.5 text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted/40 hover:bg-muted text-foreground/70"
                            >
                              {isExpanded ? "recolher" : "ver mais"}
                            </button>
                          )}
                        </td>
                        {colVis.linhaPeca && (
                          <td className={`${rowPad} px-2 text-[10px] text-foreground/80 text-center break-words whitespace-normal leading-tight`} title={a.linha_peca || ""}>
                            {a.linha_peca || "—"}
                          </td>
                        )}
                        {colVis.responsabilidade && (
                          <td className={`${rowPad} px-2 text-[10px] text-foreground/80 truncate text-center`} title={a.responsabilidade || ""}>
                            {a.responsabilidade || "—"}
                          </td>
                        )}
                        {colVis.deteccao && (
                          <td className={`${rowPad} px-2 text-[10px] text-foreground/80 truncate text-center`} title={a.local_detectado || ""}>
                            {a.local_detectado || "—"}
                          </td>
                        )}
                        {colVis.ocorrencia && (
                          <td className={`${rowPad} px-1 text-[10px] text-muted-foreground text-center hidden lg:table-cell whitespace-nowrap`}>
                            {a.data_ocorrencia ? new Date(a.data_ocorrencia).toLocaleDateString("pt-BR") : "—"}
                          </td>
                        )}
                        {colVis.validade && (
                          <td className={`${rowPad} px-1 text-[10px] text-muted-foreground text-center hidden lg:table-cell whitespace-nowrap`}>
                            {a.data_validade ? new Date(a.data_validade).toLocaleDateString("pt-BR") : "—"}
                          </td>
                        )}
                        {colVis.situacao && (
                          <td className={`${rowPad} px-2 text-center`}>
                            {a.status === "rascunho" ? (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-[10px]">Rascunho</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px]">Emitido</Badge>
                            )}
                          </td>
                        )}

                        <td className={`${rowPad} px-2 text-center`} onClick={(e) => e.stopPropagation()}>
                          {effectiveIsAdmin ? (
                            <button onClick={() => { setStatusEditAlert(a); setNewStatus(displayStatus); }}>
                              <Badge variant="outline" className={`${status.color} cursor-pointer hover:opacity-80`}>{displayStatus}</Badge>
                            </button>
                          ) : (
                            <Badge variant="outline" className={status.color}>{displayStatus}</Badge>
                          )}
                        </td>
                        <td className={`${rowPad} px-2`} onClick={(e) => e.stopPropagation()}>
                          <CienciaBar
                            pct={prog.pct}
                            count={prog.count}
                            total={prog.total}
                            clickable={isLider && status.label === "Atrasado"}
                            onClick={isLider && status.label === "Atrasado" ? () => openJustifyDialog(a) : undefined}
                          />
                        </td>
                        <td className={`${rowPad} px-2`} onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            {canEdit(a) && (
                              <Button variant="outline" size="sm" className="h-7 w-7 p-0" title="Editar" onClick={() => navigate(`/alerta-qualidade/editar/${a.id}`)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {canScanQr && (
                              <Button variant="outline" size="sm" className="h-7 w-7 p-0" title="Escanear QR" onClick={() => setScanAlertaId(a.id)}>
                                <Camera className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <Button variant="outline" size="sm" className="h-7 w-7 p-0" title="Exportar" onClick={() => { setExportAlertaId(a.id); setIncludeCiencias(true); }}>
                              <Download className="w-3.5 h-3.5" />
                            </Button>
                            {effectiveIsAdmin && (
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

            {/* Mobile cards — stacked, no overflow */}
            <div className="md:hidden space-y-2">
              {filtered.map((a: any) => {
                const prog = getCienciaProgress(a.id, a.linha_peca);
                const status = getCienciaStatus(a.id, a.linha_peca, a.created_at);
                const displayStatus = a.status && a.status !== "ativo" ? a.status : status.label;
                const isExpanded = expandedDesc.has(a.id);
                const descClamp = isExpanded ? "" : (compact ? "line-clamp-2" : "line-clamp-3");
                const descText = a.descricao || a.modo_falha || "—";
                return (
                  <div
                    key={a.id}
                    onClick={() => navigate(`/alerta-qualidade/ver/${a.id}`)}
                    className="rounded-lg border border-border/60 bg-card p-3 shadow-sm active:bg-muted/40 cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-xs font-bold text-[#c0392b]">{formatSeq(a.sequencial)}</span>
                        {a.modelo && <Badge variant="outline" className="text-[10px] border-emerald-400 text-emerald-700 bg-emerald-50">{a.modelo}</Badge>}
                        {a.status === "rascunho" ? (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-[10px]">Rascunho</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px]">Emitido</Badge>
                        )}
                      </div>
                      <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                        {effectiveIsAdmin ? (
                          <button onClick={() => { setStatusEditAlert(a); setNewStatus(displayStatus); }}>
                            <Badge variant="outline" className={`${status.color} text-[10px] cursor-pointer hover:opacity-80`}>{displayStatus}</Badge>
                          </button>
                        ) : (
                          <Badge variant="outline" className={`${status.color} text-[10px]`}>{displayStatus}</Badge>
                        )}
                      </div>
                    </div>

                    <p className={`text-[12px] font-medium text-foreground ${descClamp} leading-snug break-words`}>
                      {descText}
                    </p>
                    {descText.length > 80 && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleDesc(a.id); }}
                        className="mt-1 text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted/40 text-foreground/70"
                      >
                        {isExpanded ? "recolher" : "ver mais"}
                      </button>
                    )}

                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                      {a.linha_peca && (
                        <div className="col-span-2 min-w-0">
                          <span className="text-muted-foreground">Linha/Peça: </span>
                          <span className="text-foreground/90 break-words">{a.linha_peca}</span>
                        </div>
                      )}
                      {a.responsabilidade && (
                        <div className="min-w-0 truncate">
                          <span className="text-muted-foreground">Resp.: </span>
                          <span className="text-foreground/90">{a.responsabilidade}</span>
                        </div>
                      )}
                      {a.local_detectado && (
                        <div className="min-w-0 truncate">
                          <span className="text-muted-foreground">Detecção: </span>
                          <span className="text-foreground/90">{a.local_detectado}</span>
                        </div>
                      )}
                      {a.data_ocorrencia && (
                        <div className="min-w-0">
                          <span className="text-muted-foreground">Ocor.: </span>
                          <span className="text-foreground/90">{new Date(a.data_ocorrencia).toLocaleDateString("pt-BR")}</span>
                        </div>
                      )}
                      {a.data_validade && (
                        <div className="min-w-0">
                          <span className="text-muted-foreground">Validade: </span>
                          <span className="text-foreground/90">{new Date(a.data_validade).toLocaleDateString("pt-BR")}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                      <CienciaBar
                        pct={prog.pct}
                        count={prog.count}
                        total={prog.total}
                        clickable={isLider && status.label === "Atrasado"}
                        onClick={isLider && status.label === "Atrasado" ? () => openJustifyDialog(a) : undefined}
                      />
                    </div>

                    <div className="mt-2 flex items-center justify-end gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
                      {canEdit(a) && (
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0" title="Editar" onClick={() => navigate(`/alerta-qualidade/editar/${a.id}`)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {canScanQr && (
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0" title="Escanear QR" onClick={() => setScanAlertaId(a.id)}>
                          <Camera className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0" title="Exportar" onClick={() => { setExportAlertaId(a.id); setIncludeCiencias(true); }}>
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                      {effectiveIsAdmin && (
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10" title="Excluir" onClick={() => setDeleteAlertaId(a.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>

      <QrScannerModal open={!!scanAlertaId} onClose={() => setScanAlertaId(null)} onScan={handleQrScan} title="Registrar Ciência via QR" />

      {/* Training expiry warning */}
      <Dialog open={!!trainingWarning} onOpenChange={(o) => { if (!o) setTrainingWarning(null); }}>
        <DialogContent className={`max-w-sm border-2 ${trainingWarning?.type === "vencido" ? "border-destructive" : "border-amber-500"}`}>
          <div className={`flex flex-col items-center gap-3 py-4 ${trainingWarning?.type === "vencido" ? "bg-destructive/10" : "bg-amber-50"} -m-6 p-6 rounded-lg`}>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${trainingWarning?.type === "vencido" ? "bg-destructive/20" : "bg-amber-200"}`}>
              <AlertTriangle className={`w-10 h-10 ${trainingWarning?.type === "vencido" ? "text-destructive" : "text-amber-700"}`} />
            </div>
            <h3 className={`text-lg font-bold ${trainingWarning?.type === "vencido" ? "text-destructive" : "text-amber-800"}`}>
              {trainingWarning?.type === "vencido" ? "⚠️ Treinamento Vencido" : "⚠️ Treinamento a Vencer"}
            </h3>
            <p className="text-sm text-center text-foreground">
              <strong>{trainingWarning?.name}</strong>{" "}
              {trainingWarning?.type === "vencido"
                ? `está com treinamento vencido desde ${trainingWarning.date}. Regularize antes de prosseguir.`
                : `tem treinamento vencendo em ${trainingWarning?.date}. Programe a renovação.`}
            </p>
            <Button onClick={() => setTrainingWarning(null)} className={trainingWarning?.type === "vencido" ? "bg-destructive hover:bg-destructive/90" : "bg-amber-600 hover:bg-amber-700"}>
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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

      {/* Export dialog — JPG / PDF / PPTX */}
      <Dialog open={!!exportAlertaId} onOpenChange={(o) => { if (!o) setExportAlertaId(null); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Exportar Alerta</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground py-1">
            Documento profissional A4 (retrato) com layout oficial.
          </p>
          <DialogFooter className="grid grid-cols-3 gap-2 sm:gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExportConfirm("jpg")} disabled={exporting}>JPG</Button>
            <Button variant="outline" size="sm" onClick={() => handleExportConfirm("pdf")} disabled={exporting}>PDF</Button>
            <Button variant="outline" size="sm" onClick={() => handleExportConfirm("pptx")} disabled={exporting}>PPTX</Button>
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

      {/* Justify pending signatures dialog (Atrasado) */}
      <Dialog open={!!justifyAlert} onOpenChange={(o) => { if (!o) setJustifyAlert(null); }}>
        <DialogContent className="max-w-lg max-h-[85dvh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Justificar pendências de ciência</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Selecione uma justificativa para os colaboradores que ainda não assinaram este alerta.
          </p>
          <div className="flex-1 overflow-auto space-y-2 pr-1">
            {justifyAlert && getPendingInspectors(justifyAlert.id, justifyAlert.linha_peca).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma pendência.</p>
            ) : justifyAlert && getPendingInspectors(justifyAlert.id, justifyAlert.linha_peca).map((uid) => (
              <div key={uid} className="border rounded-md p-2 space-y-2">
                <p className="text-sm font-medium">{profileNameMap[uid] || uid}</p>
                <Select
                  value={justifySelections[uid] || ""}
                  onValueChange={(v) => setJustifySelections((p) => ({ ...p, [uid]: v }))}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione justificativa" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Colaborador em Afastamento Médico">Colaborador em Afastamento Médico</SelectItem>
                    <SelectItem value="Colaborador em Afastamento INSS">Colaborador em Afastamento INSS</SelectItem>
                    <SelectItem value="Colaborador de Férias">Colaborador de Férias</SelectItem>
                    <SelectItem value="Colaborador Desligado">Colaborador Desligado</SelectItem>
                    <SelectItem value="outro">Outro (especificar)</SelectItem>
                  </SelectContent>
                </Select>
                {justifySelections[uid] === "outro" && (
                  <Input
                    placeholder="Descreva a justificativa"
                    className="h-8 text-xs"
                    value={justifyCustom[uid] || ""}
                    onChange={(e) => setJustifyCustom((p) => ({ ...p, [uid]: e.target.value }))}
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" size="sm" onClick={() => setJustifyAlert(null)}>Cancelar</Button>
            <Button size="sm" onClick={handleJustifySubmit} disabled={justifySaving}>
              {justifySaving ? "Salvando..." : "Salvar Justificativas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AlertaQualidade;
