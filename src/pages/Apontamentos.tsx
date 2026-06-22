import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2, Plus, BarChart3, Eye, LayoutList, LayoutGrid, LogOut, ClipboardCheck, ArrowRight, Package, Cog, Car, BoxSelect, FileBarChart, FileDown, Calendar, AlertTriangle, X, Filter, MoreVertical, MapPin, Tag, CalendarDays, Wrench, Layers, Gauge, Shield, ShieldAlert, Frame, Zap, Droplet } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import MasterListFilter, { useListFilters, FilterConfig } from "@/components/MasterListFilter";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import logo from "@/assets/hyundai-mobis-logo.png";
import { useTranslation } from "react-i18next";
import ApontamentoViewDialog from "@/components/apontamento/ApontamentoViewDialog";
import ApontamentoDailyReport from "@/components/apontamento/ApontamentoDailyReport";
import { formatLocalDateString, getLocalDateString } from "@/lib/localDate";
import { stripCode } from "@/lib/stripCode";
import ReportErrorButton from "@/components/ReportErrorButton";
import { TagBadge } from "@/components/apontamento/TagBadge";
import { DefectTagBadge } from "@/components/apontamento/DefectTagBadge";
import { useEnabledModules } from "@/hooks/useModulePermissions";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Input } from "@/components/ui/input";
const TYPES = ["incoming", "peca", "processo", "oem"] as const;
type ApontamentoTipo = typeof TYPES[number];

// Top-level grouping shown to the user
type TopTab = "incoming" | "processos" | "oem";
const TOP_TABS: TopTab[] = ["incoming", "processos", "oem"];

// Sub-tabs inside "Processos" (placeholders + the legacy Peça/Processo)
type ProcSub = "cockpit" | "bumper" | "chassis" | "injecao" | "pintura" | "peca" | "processo";
const PROC_SUBS: ProcSub[] = ["cockpit", "bumper", "chassis", "injecao", "pintura", "peca", "processo"];
const procSubConfig: Record<ProcSub, { label: string; icon: any; realType?: ApontamentoTipo }> = {
  cockpit: { label: "Cockpit", icon: Gauge },
  bumper: { label: "Bumper", icon: Shield },
  chassis: { label: "Chassis", icon: Frame },
  injecao: { label: "Injeção", icon: Zap },
  pintura: { label: "Pintura", icon: Droplet },
  peca: { label: "Peça", icon: Package, realType: "peca" },
  processo: { label: "Processo", icon: Cog, realType: "processo" },
};

const typeConfig: Record<ApontamentoTipo, { icon: any; label: string; description: string; color: string; prefix: string }> = {
  incoming: { icon: BoxSelect, label: "Incoming", description: "Inspeção de peças recebidas de fornecedores com controle de lote e quantidade.", color: "from-blue-500/10 to-blue-600/5", prefix: "INC" },
  peca: { icon: Package, label: "Peça", description: "Registro de defeitos encontrados em peças durante o processo produtivo.", color: "from-amber-500/10 to-orange-500/5", prefix: "PCA" },
  processo: { icon: Cog, label: "Processo", description: "Apontamento de falhas e não-conformidades no processo de produção.", color: "from-emerald-500/10 to-green-500/5", prefix: "PRC" },
  oem: { icon: Car, label: "OEM", description: "Registros de reclamações e defeitos detectados pela montadora (OEM).", color: "from-violet-500/10 to-purple-500/5", prefix: "OEM" },
};

const topTabConfig: Record<TopTab, { icon: any; label: string; description: string; color: string }> = {
  incoming: { icon: BoxSelect, label: "Incoming", description: "Inspeção de peças recebidas de fornecedores com controle de lote e quantidade.", color: "from-blue-500/10 to-blue-600/5" },
  processos: { icon: Layers, label: "Processos", description: "Apontamentos por área: Cockpit, Bumper, Chassis, Injeção e Pintura.", color: "from-emerald-500/10 to-green-500/5" },
  oem: { icon: Car, label: "OEM", description: "Registros de reclamações e defeitos detectados pela montadora (OEM).", color: "from-violet-500/10 to-purple-500/5" },
};

const Apontamentos = () => {
  const { t } = useTranslation();
  const { signOut, user, profile } = useAuth();
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const queryClient = useQueryClient();
  const { impersonating } = useImpersonation();
  const { enabledModules } = useEnabledModules(impersonating?.id);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const readSS = (k: string, fallback: any) => { try { const v = sessionStorage.getItem(`apontamentos:${k}`); return v != null ? JSON.parse(v) : fallback; } catch { return fallback; } };
  const writeSS = (k: string, v: any) => { try { sessionStorage.setItem(`apontamentos:${k}`, JSON.stringify(v)); } catch {} };
  const [topTab, _setTopTab] = useState<TopTab>(() => readSS("topTab", "incoming"));
  const setTopTab = (t: TopTab) => { _setTopTab(t); writeSS("topTab", t); };
  const [procSub, _setProcSub] = useState<ProcSub>(() => readSS("procSub", "peca"));
  const setProcSub = (s: ProcSub) => { _setProcSub(s); writeSS("procSub", s); };
  const [showProcessSelectionDialog, setShowProcessSelectionDialog] = useState(false);
  // Derived "active filter type" for list rendering. Placeholders fall back to "peca" but isPlaceholderSub blocks rendering.
  const activeTab: ApontamentoTipo = useMemo(() => {
    if (topTab === "incoming") return "incoming";
    if (topTab === "oem") return "oem";
    return procSubConfig[procSub].realType ?? "peca";
  }, [topTab, procSub]);
  const isPlaceholderSub = topTab === "processos" && !procSubConfig[procSub].realType;
  const { search, setSearch, filterValues, handleFilterChange, clearFilters, matchesSearch, matchesFilters } = useListFilters([], "apontamentos");
  const [viewMode, setViewMode] = useState<"detailed" | "compact">("detailed");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [viewTarget, setViewTarget] = useState<string | null>(null);
  const [dailyReportOpen, setDailyReportOpen] = useState(false);
  const [ngReportOpen, setNgReportOpen] = useState(false);
  const [ngLocationFilter, setNgLocationFilter] = useState<string | null>(null);
  const [showNgLocationDialog, setShowNgLocationDialog] = useState(false);
  const [photoLightbox, setPhotoLightbox] = useState<string | null>(null);
  const [galleryPhotos, setGalleryPhotos] = useState<string[] | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState<boolean>(() => readSS("filtersExpanded", false));
  const [showInspectionLocationDialog, setShowInspectionLocationDialog] = useState(false);
  const [showBC4bDialog, setShowBC4bDialog] = useState(false);
  const [pendingIncomingLocal, setPendingIncomingLocal] = useState<string>("");
  const [incomingLocationFilter, _setIncomingLocationFilter] = useState<string | null>(() => readSS("incomingLocationFilter", null));
  const setIncomingLocationFilter = (v: string | null) => { _setIncomingLocationFilter(v); writeSS("incomingLocationFilter", v); };
  const todayStr = getLocalDateString();
  const [dateFrom, _setDateFrom] = useState<string>(() => readSS("dateFrom", todayStr));
  const [dateTo, _setDateTo] = useState<string>(() => readSS("dateTo", todayStr));
  const setDateFrom = (v: string) => { _setDateFrom(v); writeSS("dateFrom", v); };
  const setDateTo = (v: string) => { _setDateTo(v); writeSS("dateTo", v); };

  // Which apontamento sub-types the user can see
  const visibleTypes = useMemo(() => {
    if (isAdmin) return [...TYPES];
    return TYPES.filter((t) => enabledModules.includes(`apontamentos_${t}` as any));
  }, [isAdmin, enabledModules]);

  // Top-level cards/tabs (Incoming, Processos, OEM) — "Processos" groups peca + processo
  const visibleCards = useMemo<TopTab[]>(() => {
    if (isAdmin) return [...TOP_TABS];
    const out: TopTab[] = [];
    if (enabledModules.includes("apontamentos_incoming" as any)) out.push("incoming");
    if (enabledModules.includes("apontamentos_peca" as any) || enabledModules.includes("apontamentos_processo" as any)) out.push("processos");
    if (enabledModules.includes("apontamentos_oem" as any)) out.push("oem");
    return out;
  }, [isAdmin, enabledModules]);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["apontamentos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("apontamentos").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: allPhotos = [] } = useQuery({
    queryKey: ["apontamento-list-photos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("checklist_photos").select("checklist_id, file_path, file_name").eq("checklist_type", "apontamento");
      if (error) throw error;
      return data;
    },
  });

  // Fetch suppliers for origem info
  const { data: suppliersList = [] } = useQuery({
    queryKey: ["suppliers-origem"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("name, origem").eq("active", true);
      if (error) throw error;
      return data;
    },
  });

  const origemByFornecedor = useMemo(() => {
    const map: Record<string, string> = {};
    (suppliersList as any[]).forEach((s: any) => { if (s.name) map[s.name] = s.origem || "LP"; });
    return map;
  }, [suppliersList]);

  // Fetch profiles for empresa info
  const { data: profilesList = [] } = useQuery({
    queryKey: ["profiles-empresa-map"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_creator_empresa_map");
      if (error) throw error;
      return data || [];
    },
  });

  const empresaByUserId = useMemo(() => {
    const map: Record<string, string> = {};
    (profilesList as any[]).forEach((p: any) => {
      if (p.empresa === "empresa_terceira") {
        map[p.id] = p.empresa_terceira || "Terceira";
      } else {
        map[p.id] = "Mobis Brasil";
      }
    });
    return map;
  }, [profilesList]);

  // Terceira restriction: users from outsourced companies (IL/Trigo/etc.) only see their own company's records
  // When impersonating (engineering mode), use the impersonated user's empresa to scope the view
  const effEmpresa = impersonating ? impersonating.empresa : profile?.empresa;
  const effEmpresaTerceira = impersonating ? impersonating.empresa_terceira : profile?.empresa_terceira;
  const isTerceira = effEmpresa === "empresa_terceira";
  const terceiraName = effEmpresaTerceira || null;
  const scopedItems = useMemo(() => {
    if (!isTerceira || !terceiraName) return items;
    return items.filter((i: any) => i.created_by && empresaByUserId[i.created_by] === terceiraName);
  }, [items, isTerceira, terceiraName, empresaByUserId]);

  const photosByItem = useMemo(() => {
    const map: Record<string, string[]> = {};
    allPhotos.forEach((p) => {
      const { data: urlData } = supabase.storage.from("checklist-photos").getPublicUrl(p.file_path);
      if (!map[p.checklist_id]) map[p.checklist_id] = [];
      map[p.checklist_id].push(urlData.publicUrl);
    });
    return map;
  }, [allPhotos]);
  const firstPhotoByItem = useMemo(() => {
    const map: Record<string, string> = {};
    Object.entries(photosByItem).forEach(([k, v]) => { if (v[0]) map[k] = v[0]; });
    return map;
  }, [photosByItem]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("checklist_photos").delete().eq("checklist_id", id);
      const { error } = await supabase.from("apontamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro excluído com sucesso");
      queryClient.invalidateQueries({ queryKey: ["apontamentos"] });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statusFilterOptions = ["draft", "submitted"];

  const filters: FilterConfig[] = useMemo(() => {
    const typeItems = scopedItems.filter((i) => i.tipo === activeTab);
    const projetos = [...new Set(typeItems.map((i) => i.projeto).filter(Boolean))] as string[];
    const fornecedores = [...new Set(typeItems.map((i) => i.fornecedor).filter(Boolean))] as string[];
    const responsaveis = [...new Set(typeItems.map((i) => i.responsavel).filter(Boolean))] as string[];
    // Build empresa options from created_by mapping
    const empresaSet = new Set<string>();
    typeItems.forEach((i) => {
      if (i.created_by && empresaByUserId[i.created_by]) {
        empresaSet.add(empresaByUserId[i.created_by]);
      }
    });
    const empresas = [...empresaSet].sort();
    
    const baseFilters: FilterConfig[] = [
      { key: "status", label: "Status", options: statusFilterOptions, labelMap: { draft: "Rascunho", submitted: "Finalizado" } },
      { key: "resultado", label: "Resultado", options: ["sem_defeito", "ng"], labelMap: { sem_defeito: "Sem defeito encontrado", ng: "NG (com defeito)" } },
      { key: "projeto", label: "Projeto", options: projetos },
      { key: "fornecedor", label: "Fornecedor", options: fornecedores },
      { key: "responsavel", label: "Apontado por", options: responsaveis },
    ];
    if (activeTab === "incoming") {
      baseFilters.push({ key: "empresa", label: "Empresa", options: empresas });
    }
    return baseFilters;
  }, [scopedItems, activeTab, empresaByUserId]);

  const countByType = useMemo(() => {
    const counts: Record<string, number> = {};
    TYPES.forEach((t) => { counts[t] = scopedItems.filter((i) => i.tipo === t).length; });
    return counts;
  }, [scopedItems]);

  // Helper to get the inspection location from either local_deteccao or fase (retrocompat)
  const getInspectionLocation = (item: any): string | null => {
    if (item.local_deteccao === "Sala do Audio" || item.local_deteccao === "Área de Incoming") return item.local_deteccao;
    if (item.fase === "Sala do Audio" || item.fase === "Área de Incoming") return item.fase;
    return null;
  };

  const filtered = useMemo(() =>
    scopedItems
      .filter((i) => i.tipo === activeTab)
      .filter((i) => {
        // Date range filter
        if (dateFrom && i.data < dateFrom) return false;
        if (dateTo && i.data > dateTo) return false;
        // Location filter for incoming tab
        if (activeTab === "incoming" && incomingLocationFilter) {
          const loc = getInspectionLocation(i);
          if (loc !== incomingLocationFilter) return false;
        }
        if (!matchesSearch(i, ["numero", "responsavel", "part_number", "part_name", "descricao", "fornecedor", "projeto"])) return false;
        // Custom empresa filter
        const empresaFilter = filterValues["empresa"];
        if (empresaFilter && empresaFilter !== "all") {
          const userEmpresa = i.created_by ? empresaByUserId[i.created_by] : undefined;
          if (userEmpresa !== empresaFilter) return false;
        }
        // Resultado filter (sem defeito vs NG)
        const resultadoFilter = filterValues["resultado"];
        if (resultadoFilter && resultadoFilter !== "all") {
          const isSemDefeito = (i.quantidade_ng ?? 0) === 0 || i.descricao === "Sem defeito encontrado durante essa inspeção";
          if (resultadoFilter === "sem_defeito" && !isSemDefeito) return false;
          if (resultadoFilter === "ng" && isSemDefeito) return false;
        }
        // Standard filters (except empresa and resultado)
        return Object.entries(filterValues).every(([key, value]) => {
          if (!value || value === "all" || key === "empresa" || key === "resultado") return true;
          return String((i as any)[key]) === value;
        });
      }),
    [scopedItems, activeTab, search, filterValues, empresaByUserId, incomingLocationFilter, dateFrom, dateTo]
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((filtered: any[]) => {
    setSelectedIds((prev) => {
      const allIds = filtered.map((i) => i.id);
      const allSelected = allIds.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(allIds);
    });
  }, []);

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      for (const id of selectedIds) {
        await supabase.from("checklist_photos").delete().eq("checklist_id", id);
        const { error } = await supabase.from("apontamentos").delete().eq("id", id);
        if (error) throw error;
      }
      toast.success(`${selectedIds.size} registros excluídos`);
      queryClient.invalidateQueries({ queryKey: ["apontamentos"] });
      setSelectedIds(new Set());
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setBulkDeleting(false);
      setBulkDeleteOpen(false);
    }
  };

  const StatusBadge = ({ status }: { status?: string }) => {
    if (status === "draft") return <Badge variant="outline" className="border-yellow-500 text-yellow-600 bg-yellow-500/10">Rascunho</Badge>;
    return <Badge variant="outline" className="border-emerald-500 text-emerald-600 bg-emerald-500/10">Finalizado</Badge>;
  };

  const EditActions = ({ id, createdBy, status }: { id: string; createdBy?: string | null; status?: string }) => {
    const effectiveUserId = impersonating?.id || user?.id;
    const isOwner = !!effectiveUserId && createdBy === effectiveUserId;
    const canEdit = isAdmin || isOwner;
    const isFinalized = status !== "draft";
    return (
      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => setViewTarget(id)}><Eye className="w-3.5 h-3.5 mr-2" />Visualizar</DropdownMenuItem>
            {isFinalized && <DropdownMenuItem onClick={() => setViewTarget(id)}><FileDown className="w-3.5 h-3.5 mr-2" />Exportar</DropdownMenuItem>}
            {canEdit && <DropdownMenuItem onClick={() => navigate(`/apontamentos/editar/${id}`)}><Pencil className="w-3.5 h-3.5 mr-2" />Editar</DropdownMenuItem>}
            {isAdmin && <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(id)}><Trash2 className="w-3.5 h-3.5 mr-2" />Excluir</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  // Parse segundo_defeitos for display
  const getDefectSummary = (item: any) => {
    const sd = item.segundo_defeitos as any[] | undefined;
    if (!sd || sd.length === 0) return null;
    // Check if it's failure mode type (from incoming diferente)
    if (sd[0]?.modo_falha) return sd;
    return null;
  };

  const renderDetailedList = () => {
    if (filtered.length === 0) {
      const Icon = typeConfig[activeTab].icon;
      return (
        <div className="form-section text-center py-8">
          <Icon className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Nenhum registro encontrado</p>
        </div>
      );
    }
    return (
      <div className="grid gap-3">
        {filtered.map((item) => {
          const defectDetails = getDefectSummary(item);
          const hasNg = (item.quantidade_ng || 0) > 0;
          const effectiveUserId = impersonating?.id || user?.id;
          const canShowActions = isAdmin || (!!effectiveUserId && item.created_by === effectiveUserId);

          return (
            <div key={item.id} className="form-section hover:border-accent/30 transition-colors cursor-pointer overflow-hidden" onClick={() => setViewTarget(item.id)}>
              <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                  {isAdmin && (
                    <div className="pt-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selectedIds.has(item.id)} onCheckedChange={() => toggleSelect(item.id)} />
                    </div>
                  )}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    {/* Header row */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {item.numero && <span className="text-xs font-mono text-muted-foreground bg-muted/20 px-1.5 py-0.5 rounded shrink-0">#{item.numero}</span>}
                      {item.part_number && <span className="font-heading font-semibold text-foreground text-sm truncate">{item.part_number}</span>}
                      {item.fornecedor && <Badge variant="secondary" className="text-[10px] shrink-0">{item.fornecedor}</Badge>}
                      <StatusBadge status={item.status} />
                      {/* Origem badge */}
                      {item.fornecedor && origemByFornecedor[item.fornecedor] && (() => {
                        const o = origemByFornecedor[item.fornecedor];
                        if (o === "CKD") return <Badge className="bg-purple-500/10 text-purple-700 border-purple-200 text-[9px] px-1.5">CKD</Badge>;
                        if (o === "CONSIGNADA") return <Badge className="bg-orange-500/10 text-orange-700 border-orange-200 text-[9px] px-1.5">CONSIG.</Badge>;
                        return <Badge className="bg-blue-500/10 text-blue-700 border-blue-200 text-[9px] px-1.5">LP</Badge>;
                      })()}
                      {/* Responsabilidade badge */}
                      {activeTab === "incoming" && (() => {
                        const resp = item.responsabilidade_defeito;
                        const semDefeito = (item.quantidade_ng ?? 0) === 0 || item.descricao === "Sem defeito encontrado durante essa inspeção";
                        if (semDefeito) {
                          return null;
                        }
                        const loc = getInspectionLocation(item);
                        const displayResp = resp
                          ? resp.replace(/^\d+\s*-\s*/, "").trim()
                          : loc === "Sala do Audio" ? "Part" : "Sorting";
                        const isPartR = displayResp.toLowerCase().includes("part");
                        const isSortingR = displayResp.toLowerCase().includes("sorting");
                        const cls = isPartR
                          ? "bg-blue-600/10 text-blue-600 border-blue-400"
                          : isSortingR
                          ? "bg-orange-600/10 text-orange-600 border-orange-400"
                          : "bg-violet-600/10 text-violet-600 border-violet-400";
                        return <Badge className={`text-[9px] px-1.5 ${cls}`}>{displayResp}</Badge>;
                      })()}
                      {/* Empresa badge */}
                      {item.created_by && empresaByUserId[item.created_by] && (
                        <Badge variant="outline" className={`text-[9px] px-1.5 ${empresaByUserId[item.created_by] === "Mobis Brasil" ? "border-sky-300 text-sky-700 bg-sky-50" : "border-amber-300 text-amber-700 bg-amber-50"}`}>
                          {empresaByUserId[item.created_by]}
                        </Badge>
                      )}
                      {/* Location badge */}
                      {activeTab === "incoming" && (() => {
                        const loc = getInspectionLocation(item);
                        if (loc === "Sala do Audio") return <Badge className="bg-indigo-500/10 text-indigo-700 border-indigo-200 text-[9px] px-1.5">🔊 Sala do Áudio</Badge>;
                        if (loc === "Área de Incoming") return <Badge className="bg-teal-500/10 text-teal-700 border-teal-200 text-[9px] px-1.5">📦 Incoming</Badge>;
                        return null;
                      })()}
                    </div>

                    {/* Part name */}
                    {item.part_name && (
                      <p className="text-sm text-foreground font-medium truncate">{item.part_name}</p>
                    )}

                    {/* Quantities row */}
                    {(item.quantidade_inspecionada > 0 || hasNg) && (
                      <div className="flex gap-3 text-xs">
                        {item.quantidade_inspecionada > 0 && (
                          <span className="text-muted-foreground">Insp: <span className="font-semibold text-foreground">{item.quantidade_inspecionada}</span></span>
                        )}
                        <span className="text-emerald-600">OK: <span className="font-semibold">{item.quantidade_ok || 0}</span></span>
                        <span className={hasNg ? "text-destructive font-semibold" : "text-muted-foreground"}>NG: <span className="font-semibold">{item.quantidade_ng || 0}</span></span>
                      </div>
                    )}

                    {/* Defect details */}
                    {hasNg && defectDetails && defectDetails.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {defectDetails.map((def: any, idx: number) => (
                          <div key={idx} className="bg-destructive/5 border border-destructive/20 rounded px-2 py-1 text-xs flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-destructive">{stripCode(def.modo_falha)}</span>
                            {def.descricao && <span className="text-muted-foreground">— {def.descricao.substring(0, 40)}{def.descricao.length > 40 ? "..." : ""}</span>}
                            <span className="text-muted-foreground">(×{def.qty})</span>
                            <DefectTagBadge
                              apontamentoId={item.id}
                              defects={defectDetails}
                              defectIndex={idx}
                              onSaved={() => queryClient.invalidateQueries({ queryKey: ["apontamentos"] })}
                            />
                          </div>
                        ))}
                      </div>
                    ) : hasNg && item.modo_falha ? (
                      <div className="bg-destructive/5 border border-destructive/20 rounded px-2 py-1 text-xs inline-block">
                        <span className="font-semibold text-destructive">{stripCode(item.modo_falha)}</span>
                        {item.descricao && item.descricao !== "Sem defeito encontrado durante essa inspeção" && (
                          <span className="text-muted-foreground ml-1">— {item.descricao.substring(0, 50)}{item.descricao.length > 50 ? "..." : ""}</span>
                        )}
                      </div>
                    ) : !hasNg ? (
                      <p className="text-xs text-blue-600 bg-blue-50 rounded px-2 py-1 line-clamp-1 border-l-2 border-blue-400 font-medium">
                        Sem defeito encontrado durante essa inspeção
                      </p>
                    ) : null}

                    {/* TAG badge - only show single global TAG when not using per-defect tags */}
                    {!(defectDetails && defectDetails.length > 0) && (
                      <TagBadge
                        apontamentoId={item.id}
                        numeroTag={(item as any).numero_tag || (item as any).tag_number || null}
                        quantidadeNg={item.quantidade_ng || 0}
                        onTagSaved={() => queryClient.invalidateQueries({ queryKey: ["apontamentos"] })}
                      />
                    )}

                    {/* Meta row */}
                    <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                      <span>{item.responsavel}</span>
                      <span>•</span>
                      <span>{formatLocalDateString(item.data)}</span>
                      {item.turno && <><span>•</span><span>{item.turno}</span></>}
                      {item.tempo_inspecao && <><span>•</span><span>⏱ {item.tempo_inspecao}</span></>}
                      {item.co_inspetores && Array.isArray(item.co_inspetores) && (item.co_inspetores as string[]).length > 0 && (
                        <><span>•</span><span>👥 +{(item.co_inspetores as string[]).length}</span></>
                      )}
                    </div>
                  </div>
                </div>

                {/* Main photo thumbnail */}
                {firstPhotoByItem[item.id] && (() => {
                  const all = photosByItem[item.id] || [];
                  const extra = Math.max(0, all.length - 1);
                  return (
                    <div
                      className="relative shrink-0 w-16 h-16 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-lg overflow-hidden border border-border cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (extra > 0) setGalleryPhotos(all);
                        else setPhotoLightbox(firstPhotoByItem[item.id]);
                      }}
                    >
                      <img src={firstPhotoByItem[item.id]} alt="Foto NG" className="w-full h-full object-cover" />
                      {extra > 0 && (
                        <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] sm:text-xs font-semibold px-1.5 py-0.5 rounded-md leading-none pointer-events-none">
                          +{extra}
                        </span>
                      )}
                    </div>
                  );
                })()}
                {(selectedIds.has(item.id) || canShowActions) && <EditActions id={item.id} createdBy={item.created_by} status={item.status} />}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderCompactList = () => {
    if (filtered.length === 0) {
      const Icon = typeConfig[activeTab].icon;
      return (
        <div className="form-section text-center py-8">
          <Icon className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Nenhum registro encontrado</p>
        </div>
      );
    }
    return (
      <div className="grid gap-3">
        {filtered.map((item) => {
          const hasNg = (item.quantidade_ng || 0) > 0;
          const photoUrl = firstPhotoByItem[item.id];
          const allPhotosForItem = photosByItem[item.id] || [];
          const extraCount = Math.max(0, allPhotosForItem.length - 1);
          return (
            <div key={item.id} className="form-section hover:border-accent/30 transition-colors cursor-pointer p-3" onClick={() => setViewTarget(item.id)}>
              <div className="flex items-start gap-3">
                {isAdmin && (
                  <div className="pt-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selectedIds.has(item.id)} onCheckedChange={() => toggleSelect(item.id)} />
                  </div>
                )}
                {/* Photo thumbnail */}
                {photoUrl && (
                  <div
                    className="relative shrink-0 w-12 h-12 rounded-lg overflow-hidden border border-border"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (extraCount > 0) setGalleryPhotos(allPhotosForItem);
                      else setPhotoLightbox(photoUrl);
                    }}
                  >
                    <img src={photoUrl} alt="Foto" className="w-full h-full object-cover" />
                    {extraCount > 0 && (
                      <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-white text-[9px] font-semibold px-1 py-0.5 rounded leading-none pointer-events-none">
                        +{extraCount}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {item.numero && <span className="text-xs font-mono text-muted-foreground">#{item.numero}</span>}
                    <span className="font-semibold text-sm truncate">{item.part_number || item.responsavel}</span>
                    <StatusBadge status={item.status} />
                    {activeTab === "incoming" && (() => {
                      const resp = item.responsabilidade_defeito;
                      const semDefeito = (item.quantidade_ng ?? 0) === 0 || item.descricao === "Sem defeito encontrado durante essa inspeção";
                      if (semDefeito) {
                        return null;
                      }
                      const loc = getInspectionLocation(item);
                      const displayResp = resp ? resp.replace(/^\d+\s*-\s*/, "").trim() : loc === "Sala do Audio" ? "Part" : "Sorting";
                      const isPartR = displayResp.toLowerCase().includes("part");
                      const isSortingR = displayResp.toLowerCase().includes("sorting");
                      const cls = isPartR ? "bg-blue-600/10 text-blue-600 border-blue-400" : isSortingR ? "bg-orange-600/10 text-orange-600 border-orange-400" : "bg-violet-600/10 text-violet-600 border-violet-400";
                      return <Badge className={`text-[9px] px-1.5 ${cls}`}>{displayResp}</Badge>;
                    })()}
                  </div>
                  {item.part_name && <p className="text-xs text-muted-foreground truncate">{item.part_name}</p>}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {item.fornecedor && <span>{item.fornecedor}</span>}
                    {hasNg && <span className="text-destructive font-semibold">NG: {item.quantidade_ng}</span>}
                    {!hasNg && <span className="text-emerald-600">OK</span>}
                    <span>{formatLocalDateString(item.data)}</span>
                    {item.turno && <span>{item.turno}</span>}
                  </div>
                  {hasNg && item.modo_falha && (
                    <p className="text-xs text-destructive truncate">{stripCode(item.modo_falha)}</p>
                  )}
                </div>
                <EditActions id={item.id} createdBy={item.created_by} status={item.status} />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-12">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-accent flex items-center justify-center">
                <FileBarChart className="w-4 h-4 md:w-5 md:h-5 text-accent-foreground" />
              </div>
              <span className="text-xs md:text-sm font-medium tracking-wider uppercase opacity-80">Apontamentos</span>
            </div>
            <div className="flex items-center gap-0.5 sm:gap-1 md:gap-2">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 h-8 w-8 md:h-9 md:w-auto md:px-3" title="Hub">
                <ArrowLeft className="w-4 h-4 md:mr-1" /> <span className="hidden md:inline text-sm">{t("common.hub")}</span>
              </Button>
              <Button variant="ghost" size="icon" onClick={() => navigate("/apontamentos/dashboard")} className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 h-8 w-8 md:h-9 md:w-auto md:px-3" title="Dashboard">
                <BarChart3 className="w-4 h-4 md:mr-1" /> <span className="hidden md:inline text-sm">Dashboard</span>
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setDailyReportOpen(true)} className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 h-8 w-8 md:h-9 md:w-auto md:px-3" title="Relatório do Dia">
                <Calendar className="w-4 h-4 md:mr-1" /> <span className="hidden md:inline text-sm">Relatório</span>
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setShowNgLocationDialog(true)} className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 h-8 w-8 md:h-9 md:w-auto md:px-3" title="Peças NG">
                <AlertTriangle className="w-4 h-4 md:mr-1" /> <span className="hidden md:inline text-sm">NG</span>
              </Button>
              {isAdmin && profile?.employee_number === "3501165" && (
                <Button variant="ghost" size="icon" onClick={() => navigate("/apontamentos/admin/part-name")} className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 h-8 w-8 md:h-9 md:w-auto md:px-3" title="Corrigir Part Name (INC)">
                  <Wrench className="w-4 h-4 md:mr-1" /> <span className="hidden md:inline text-sm">Corrigir PN</span>
                </Button>
              )}
              <ReportErrorButton moduleName="Apontamentos" />
              <Button variant="ghost" size="icon" onClick={signOut} className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 h-8 w-8 md:h-9 md:w-auto md:px-3" title="Sair">
                <LogOut className="w-4 h-4 md:mr-1" /> <span className="hidden md:inline text-sm">{t("common.logout")}</span>
              </Button>
            </div>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-4xl font-heading font-bold mt-3 md:mt-4">Apontamentos</h1>
          <p className="mt-1 md:mt-2 text-primary-foreground/70 max-w-xl text-xs sm:text-sm md:text-lg">Selecione o tipo de apontamento para registrar.</p>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-8 max-w-6xl w-full overflow-x-hidden" style={{ paddingBottom: "max(6rem, calc(6rem + env(safe-area-inset-bottom)))" }}>
        {/* Module cards */}
        <div className={`grid gap-4 sm:gap-6 grid-cols-2 ${visibleCards.length <= 2 ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
          {visibleCards.map((tab, i) => {
            const cfg = topTabConfig[tab];
            const Icon = cfg.icon;
            const count = tab === "processos"
              ? (countByType.peca || 0) + (countByType.processo || 0)
              : (countByType[tab] || 0);
            return (
              <div key={tab} className="module-card opacity-0 animate-fade-in" style={{ animationDelay: `${i * 100}ms` }} onClick={() => {
                if (tab === "incoming") setShowInspectionLocationDialog(true);
                else if (tab === "processos") setShowProcessSelectionDialog(true);
                else navigate(`/apontamentos/novo/${tab}`);
              }}>
                <div className={`absolute inset-0 bg-gradient-to-br ${cfg.color} pointer-events-none`} />
                <div className="relative">
                  <div className="module-card-icon"><Icon className="w-6 h-6 md:w-7 md:h-7" /></div>
                  <h2 className="text-base md:text-xl font-heading font-semibold text-card-foreground mb-1 md:mb-2">{cfg.label}</h2>
                  <p className="text-muted-foreground text-xs md:text-sm leading-relaxed mb-3 md:mb-4 line-clamp-2">{cfg.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="status-badge bg-secondary text-secondary-foreground text-xs">{count} registros</span>
                    <ArrowRight className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Contenção — realocada do Hub para dentro de Apontamentos */}
          <div
            className="module-card opacity-0 animate-fade-in"
            style={{ animationDelay: `${visibleCards.length * 100}ms` }}
            onClick={() => navigate("/contencao")}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/15 to-amber-500/5 pointer-events-none" />
            <div className="relative">
              <div className="module-card-icon"><ShieldAlert className="w-6 h-6 md:w-7 md:h-7" /></div>
              <h2 className="text-base md:text-xl font-heading font-semibold text-card-foreground mb-1 md:mb-2">Contenção</h2>
              <p className="text-muted-foreground text-xs md:text-sm leading-relaxed mb-3 md:mb-4 line-clamp-2">Registro e acompanhamento de ações de contenção de qualidade.</p>
              <div className="flex items-center justify-between">
                <span className="status-badge bg-secondary text-secondary-foreground text-xs">Abrir</span>
                <ArrowRight className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
              </div>
            </div>
          </div>
        </div>

        {/* Records section */}
        <div>
          {/* Row 1: title + date range + actions (Hoje/Filtros/Limpar) + view toggle */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3 px-1">
            <div className="flex items-center gap-2 shrink-0">
              <h2 className="text-lg sm:text-xl font-heading font-bold text-foreground shrink-0">Registros</h2>
              <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0 hidden md:block" />
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 text-xs w-[140px] px-2 hidden md:block"
                aria-label="Data de"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-8 text-xs w-[140px] px-2 hidden md:block"
                aria-label="Data até"
              />
              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground shrink-0 hidden md:inline-flex" onClick={() => { setDateFrom(""); setDateTo(""); }} title="Limpar datas">
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
              {isAdmin && selectedIds.size > 0 && (
                <Button variant="destructive" size="sm" className="gap-1.5 h-8 px-2" onClick={() => setBulkDeleteOpen(true)}>
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Excluir {selectedIds.size}</span>
                  <span className="sm:hidden">{selectedIds.size}</span>
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 sm:px-3 text-xs gap-1"
                onClick={() => { const t = getLocalDateString(); setDateFrom(t); setDateTo(t); }}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Hoje</span>
              </Button>
              <Button
                variant={filtersExpanded ? "default" : "outline"}
                size="sm"
                className="gap-1 text-xs h-8 px-2 sm:px-3"
                onClick={() => { const v = !filtersExpanded; setFiltersExpanded(v); writeSS("filtersExpanded", v); }}
              >
                <Filter className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Filtros</span>
              </Button>
              {(search || Object.values(filterValues).some((v) => v && v !== "all") || dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground h-8 px-2" onClick={() => { clearFilters(); setDateFrom(""); setDateTo(""); }}>
                  <X className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Limpar filtros</span>
                </Button>
              )}
              <div className="flex items-center border rounded-lg overflow-hidden">
                <Button variant={viewMode === "detailed" ? "default" : "ghost"} size="sm" className="rounded-none h-8 px-2" onClick={() => setViewMode("detailed")}>
                  <LayoutGrid className="w-4 h-4" />
                </Button>
                <Button variant={viewMode === "compact" ? "default" : "ghost"} size="sm" className="rounded-none h-8 px-2" onClick={() => setViewMode("compact")}>
                  <LayoutList className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Mobile-only date row */}
          <div className="flex items-center gap-2 mb-2 px-1 md:hidden">
            <div className={`grid ${(dateFrom || dateTo) ? "grid-cols-[1fr_1fr_auto]" : "grid-cols-2"} gap-1.5 items-center flex-1 min-w-0`}>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 text-xs w-full min-w-0 px-2" aria-label="Data de" />
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 text-xs w-full min-w-0 px-2" aria-label="Data até" />
              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-muted-foreground shrink-0" onClick={() => { setDateFrom(""); setDateTo(""); }} title="Limpar datas">
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
          {filtersExpanded && (
            <MasterListFilter searchValue={search} onSearchChange={setSearch} filters={filters} filterValues={filterValues} onFilterChange={handleFilterChange} onClearFilters={clearFilters} />
          )}

          <Tabs value={topTab} onValueChange={(v) => { setTopTab(v as TopTab); clearFilters(); setSelectedIds(new Set()); setIncomingLocationFilter(null); }} className="mt-4">
            <TabsList className={`grid w-full h-auto`} style={{ gridTemplateColumns: `repeat(${visibleCards.length + 1}, 1fr)` }}>
              {visibleCards.map((tab) => {
                const cfg = topTabConfig[tab];
                const Icon = cfg.icon;
                const count = tab === "processos"
                  ? (countByType.peca || 0) + (countByType.processo || 0)
                  : (countByType[tab] || 0);
                return (
                  <TabsTrigger key={tab} value={tab} className="gap-1 md:gap-2 text-xs md:text-sm px-1 md:px-3 py-2">
                    <Icon className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />
                    <span className="hidden sm:inline truncate">{cfg.label}</span>
                    <span className="text-xs">({count})</span>
                  </TabsTrigger>
                );
              })}
              {/* Contenção — navega para o módulo dedicado */}
              <button
                type="button"
                onClick={() => navigate("/contencao")}
                className="inline-flex items-center justify-center gap-1 md:gap-2 text-xs md:text-sm px-1 md:px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-background/60 transition-colors"
                title="Abrir Contenção"
              >
                <ShieldAlert className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />
                <span className="hidden sm:inline truncate">Contenção</span>
                <ArrowRight className="w-3 h-3 md:w-3.5 md:h-3.5 opacity-60" />
              </button>
            </TabsList>

            {/* Location filter buttons for INCOMING tab */}
            {topTab === "incoming" && (
              <div className="flex items-center gap-2 mt-3">
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                <Button
                  variant={incomingLocationFilter === null ? "default" : "outline"}
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => setIncomingLocationFilter(null)}
                >
                  Todos
                </Button>
                <Button
                  variant={incomingLocationFilter === "Sala do Audio" ? "default" : "outline"}
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => setIncomingLocationFilter("Sala do Audio")}
                >
                  🔊 Sala do Áudio
                </Button>
                <Button
                  variant={incomingLocationFilter === "Área de Incoming" ? "default" : "outline"}
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => setIncomingLocationFilter("Área de Incoming")}
                >
                  📦 Área de Incoming
                </Button>
              </div>
            )}

            {/* Sub-tabs for PROCESSOS group */}
            {topTab === "processos" && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {PROC_SUBS.map((sub) => {
                  const cfg = procSubConfig[sub];
                  const Icon = cfg.icon;
                  const active = procSub === sub;
                  const subCount = cfg.realType ? (countByType[cfg.realType] || 0) : 0;
                  return (
                    <Button
                      key={sub}
                      variant={active ? "default" : "outline"}
                      size="sm"
                      className="text-xs h-8 gap-1.5"
                      onClick={() => { setProcSub(sub); clearFilters(); setSelectedIds(new Set()); }}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{cfg.label}</span>
                      {cfg.realType && <span className="text-[10px] opacity-80">({subCount})</span>}
                    </Button>
                  );
                })}
              </div>
            )}

            {TOP_TABS.map((tab) => (
              <TabsContent key={tab} value={tab} className="mt-4">
                {isLoading ? (
                  <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" /></div>
                ) : tab === "processos" && isPlaceholderSub ? (
                  <div className="border border-dashed rounded-lg py-16 text-center text-muted-foreground">
                    <Layers className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm font-medium">Em breve: {procSubConfig[procSub].label}</p>
                    <p className="text-xs mt-1">Esta área será habilitada em uma próxima atualização.</p>
                  </div>
                ) : viewMode === "detailed" ? renderDetailedList() : renderCompactList()}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </main>

      {/* Single delete */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Confirmar exclusão</AlertDialogTitle><AlertDialogDescription>Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}>Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir {selectedIds.size} registros</AlertDialogTitle><AlertDialogDescription>Tem certeza? Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={bulkDeleting}>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleBulkDelete} disabled={bulkDeleting}>{bulkDeleting ? "Excluindo..." : "Excluir"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View dialog */}
      <ApontamentoViewDialog open={!!viewTarget} onOpenChange={(open) => !open && setViewTarget(null)} apontamentoId={viewTarget} />

      {/* Daily report */}
      <ApontamentoDailyReport open={dailyReportOpen} onOpenChange={setDailyReportOpen} items={scopedItems} mode="daily" onViewRecord={(id) => setViewTarget(id)} />

      {/* NG report */}
      <ApontamentoDailyReport open={ngReportOpen} onOpenChange={setNgReportOpen} items={scopedItems} mode="ng" onViewRecord={(id) => setViewTarget(id)} locationFilter={ngLocationFilter} />

      {/* NG Location Dialog */}
      <Dialog open={showNgLocationDialog} onOpenChange={setShowNgLocationDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-destructive" />Relatório de Peças NG</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Selecione o local para o relatório:</p>
          <div className="grid grid-cols-1 gap-3 mt-2">
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col gap-1 hover:border-blue-400 hover:bg-blue-50"
              onClick={() => {
                setNgLocationFilter("Sala do Audio");
                setShowNgLocationDialog(false);
                setNgReportOpen(true);
              }}
            >
              <span className="font-semibold text-base">🔊 Sala do Áudio</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col gap-1 hover:border-emerald-400 hover:bg-emerald-50"
              onClick={() => {
                setNgLocationFilter("Área de Incoming");
                setShowNgLocationDialog(false);
                setNgReportOpen(true);
              }}
            >
              <span className="font-semibold text-base">📦 Área de Incoming</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-3 hover:border-muted-foreground/30"
              onClick={() => {
                setNgLocationFilter(null);
                setShowNgLocationDialog(false);
                setNgReportOpen(true);
              }}
            >
              <span className="font-semibold text-sm">Todos os Locais</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Photo gallery dialog (multiple photos) */}
      {galleryPhotos && (
        <Dialog open={!!galleryPhotos} onOpenChange={() => setGalleryPhotos(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Fotos ({galleryPhotos.length})</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              {galleryPhotos.map((url, i) => (
                <div
                  key={i}
                  className="rounded-lg overflow-hidden border border-border aspect-square cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                  onClick={() => setPhotoLightbox(url)}
                >
                  <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Photo lightbox */}
      {photoLightbox && (
        <Dialog open={!!photoLightbox} onOpenChange={() => setPhotoLightbox(null)}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none [&>button:last-child]:hidden">
            <button onClick={() => setPhotoLightbox(null)} className="absolute right-3 top-3 z-50 rounded-full bg-white/20 backdrop-blur-sm w-10 h-10 flex items-center justify-center hover:bg-white/40 transition-colors">
              <X className="h-5 w-5 text-white" />
            </button>
            <div className="flex items-center justify-center w-full h-[90vh] p-4">
              <img src={photoLightbox} alt="Foto ampliada" className="max-w-full max-h-full object-contain rounded" />
            </div>
          </DialogContent>
        </Dialog>
      )}
      {/* Inspection Location Dialog */}
      <Dialog open={showInspectionLocationDialog} onOpenChange={setShowInspectionLocationDialog}>
        <DialogContent className="max-w-sm max-w-[95vw] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><MapPin className="w-5 h-5 text-blue-500" />Local de Inspeção</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Selecione o local onde a inspeção será realizada:</p>
          <div className="grid grid-cols-1 gap-3 mt-2">
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col gap-1 hover:border-blue-400 hover:bg-blue-50"
              onClick={() => {
                setShowInspectionLocationDialog(false);
                const isOutro = effEmpresa === "empresa_terceira";
                if (isOutro) {
                  setPendingIncomingLocal("Sala do Audio");
                  setShowBC4bDialog(true);
                } else {
                  navigate("/apontamentos/novo/incoming?local=Sala do Audio");
                }
              }}
            >
              <span className="font-semibold text-base">🔊 Sala do Audio</span>
              <span className="text-xs text-muted-foreground">Inspeção na sala de áudio</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col gap-1 hover:border-emerald-400 hover:bg-emerald-50"
              onClick={() => {
                setShowInspectionLocationDialog(false);
                const isOutro = effEmpresa === "empresa_terceira";
                if (isOutro) {
                  setPendingIncomingLocal("Área de Incoming");
                  setShowBC4bDialog(true);
                } else {
                  navigate("/apontamentos/novo/incoming?local=Área de Incoming");
                }
              }}
            >
              <span className="font-semibold text-base">📦 Área de Incoming</span>
              <span className="text-xs text-muted-foreground">Inspeção na área de recebimento</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* BC4b vs Outras Peças Dialog (only for "outros" terceira users) */}
      <Dialog open={showBC4bDialog} onOpenChange={setShowBC4bDialog}>
        <DialogContent className="max-w-sm max-w-[95vw] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><MapPin className="w-5 h-5 text-orange-500" />Tipo de Apontamento</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Selecione o tipo de apontamento que será realizado:</p>
          <div className="grid grid-cols-1 gap-3 mt-2">
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col gap-1 hover:border-orange-400 hover:bg-orange-50"
              onClick={() => {
                setShowBC4bDialog(false);
                navigate(`/apontamentos/novo/incoming?local=${encodeURIComponent(pendingIncomingLocal)}&bc4b=1`);
              }}
            >
              <span className="font-semibold text-base">🟠 Apontamento de Peças do BC4b</span>
              <span className="text-xs text-muted-foreground">Responsabilidade: Part</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col gap-1 hover:border-slate-400 hover:bg-slate-50"
              onClick={() => {
                setShowBC4bDialog(false);
                navigate(`/apontamentos/novo/incoming?local=${encodeURIComponent(pendingIncomingLocal)}&bc4b=0`);
              }}
            >
              <span className="font-semibold text-base">⚙️ Apontamento de Outras Peças</span>
              <span className="text-xs text-muted-foreground">Responsabilidade: Sorting</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Process Selection Dialog (sub-types inside Processos) */}
      <Dialog open={showProcessSelectionDialog} onOpenChange={setShowProcessSelectionDialog}>
        <DialogContent className="max-w-md max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Layers className="w-5 h-5 text-emerald-500" />Novo Apontamento — Processos</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Selecione a área do processo:</p>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {PROC_SUBS.map((sub) => {
              const cfg = procSubConfig[sub];
              const Icon = cfg.icon;
              const isReal = !!cfg.realType;
              return (
                <Button
                  key={sub}
                  variant="outline"
                  className="h-auto py-4 flex flex-col gap-1.5"
                  onClick={() => {
                    setShowProcessSelectionDialog(false);
                    if (isReal) {
                      navigate(`/apontamentos/novo/${cfg.realType}`);
                    } else {
                      toast.info(`${cfg.label}: em breve`);
                    }
                  }}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-semibold text-sm">{cfg.label}</span>
                  {!isReal && <span className="text-[10px] text-muted-foreground">em breve</span>}
                </Button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Apontamentos;
