import { useState, useEffect, useMemo, useRef } from "react";
import { getLocalDateString } from "@/lib/localDate";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Loader2, FileBarChart, Plus, Trash2, Camera, AlertTriangle, Search, X, Clock, Tag, ImagePlus } from "lucide-react";
import { QRScannerButton, type QRScannerButtonHandle } from "@/components/apontamento/QRScannerButton";
import { HyundaiQRData, extractAlcFromPartNumber } from "@/lib/parseHyundaiQR";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import SupplierPartSelector from "@/components/SupplierPartSelector";
import { toast } from "sonner";
import logo from "@/assets/hyundai-mobis-logo.png";
import { uploadPhotos } from "@/lib/uploadPhotos";
import { compressImage } from "@/lib/compressImage";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import ImageAnnotationEditor from "@/components/ImageAnnotationEditor";
import InAppCamera from "@/components/InAppCamera";
import { useFormAutosave, readFormAutosave, clearFormAutosave } from "@/hooks/useFormAutosave";

type ApontamentoTipo = "incoming" | "peca" | "processo" | "oem";

const typeLabels: Record<ApontamentoTipo, string> = {
  incoming: "Incoming",
  peca: "Peça",
  processo: "Processo",
  oem: "OEM",
};

const TURNOS = ["1T", "2T", "3T"];
const FASES = ["Novo Carro", "Carro Corrente"];
const OEM_LOCAL_DETECCAO = ["Trim", "FS", "Final 1", "Final 2", "Ok Line", "Deck", "Roll", "Road Test", "Shower", "VPC"];
const OEM_LANCAMENTO = ["In Line", "Off Line"];

interface SegundoDefeito {
  part_number: string;
  part_name: string;
  qty: number;
}

interface DefeitoDetalhe {
  modo_falha: string;
  descricao: string;
  qty_ng: number;
  tag_number: string;
  photoFiles: File[];
  photoPreviews: string[];
}

const ApontamentoForm = () => {
  const navigate = useNavigate();
  const { id, tipo: paramTipo } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = !!id;
  const { profile, user } = useAuth();
  const { isAdmin } = useUserRole();
  const { impersonating } = useImpersonation();
  const activeProfile = impersonating || profile;
  const queryClient = useQueryClient();

  const tipo = (isEdit ? undefined : paramTipo) as ApontamentoTipo | undefined;

  const [saving, setSaving] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [annotatingFile, setAnnotatingFile] = useState<File | null>(null);
  const [annotationQueue, setAnnotationQueue] = useState<File[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [validationMessages, setValidationMessages] = useState<string[]>([]);

  // Form state
  const [formTipo, setFormTipo] = useState<ApontamentoTipo>(tipo || "incoming");
  const [data, setData] = useState(getLocalDateString());
  const [turno, setTurno] = useState("");
  const [fase, setFase] = useState("");
  const [projeto, setProjeto] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [partName, setPartName] = useState("");
  const [modulo, setModulo] = useState("");
  const [alcCode, setAlcCode] = useState("N/A");
  const [alcExpected, setAlcExpected] = useState<string>(""); // expected ALC from part_numbers
  const [alcStatus, setAlcStatus] = useState<"idle" | "match" | "mismatch" | "manual">("idle");
  const [showAlcMismatchDialog, setShowAlcMismatchDialog] = useState(false);
  const [alcMismatchScanned, setAlcMismatchScanned] = useState("");
  const [alcMismatchAttempts, setAlcMismatchAttempts] = useState(0);
  const [showAlcValidateDialog, setShowAlcValidateDialog] = useState(false);
  const [alcManualInput, setAlcManualInput] = useState("");
  const qrScannerRef = useRef<QRScannerButtonHandle | null>(null);
  const [quantidadeInspecionada, setQuantidadeInspecionada] = useState<number>(0);
  const [quantidadeNg, setQuantidadeNg] = useState<number>(0);
  const [quantidadeOk, setQuantidadeOk] = useState<number>(0);
  const [loteInspecionado, setLoteInspecionado] = useState("");
  const [modoFalha, setModoFalha] = useState("");
  const [paradaLinha, setParadaLinha] = useState("nao");
  const [paradaLinhaTempo, setParadaLinhaTempo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [localDeteccao, setLocalDeteccao] = useState("");
  const [vinNumber, setVinNumber] = useState("");
  const [responsabilidadeDefeito, setResponsabilidadeDefeito] = useState("");
  const [quantidadeDetectado, setQuantidadeDetectado] = useState<number>(0);
  const [lancamento, setLancamento] = useState("");
  const [analiseInicial, setAnaliseInicial] = useState("");
  const [acaoImediata, setAcaoImediata] = useState("");
  const [comentarioAdicional, setComentarioAdicional] = useState("");
  const [segundoDefeitos, setSegundoDefeitos] = useState<SegundoDefeito[]>([]);
  const [temSegundoDefeito, setTemSegundoDefeito] = useState("nao");

  // New fields
  const [temCoInspecao, setTemCoInspecao] = useState("nao");
  const [coInspetores, setCoInspetores] = useState<string[]>([]);
  const [coInspetorSearch, setCoInspetorSearch] = useState("");
  const [showCoInspetorDialog, setShowCoInspetorDialog] = useState(false);
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFim, setHoraFim] = useState("");

  // Multiple NG failure modes
  const [ngMultiploDecisao, setNgMultiploDecisao] = useState<"mesmo" | "diferente" | null>(null);
  const [showNgDecisionDialog, setShowNgDecisionDialog] = useState(false);
  const [defeitosDetalhes, setDefeitosDetalhes] = useState<DefeitoDetalhe[]>([]);
  const [tagNumber, setTagNumber] = useState("");

  // Suffix picker state
  const [suffixPickerOpen, setSuffixPickerOpen] = useState(false);
  const [suffixOptions, setSuffixOptions] = useState<Array<{
    part_number: string;
    part_name: string;
    project: string;
    line_module: string;
    supplier_name: string;
  }>>([]);
  const [pendingLot, setPendingLot] = useState("");
  const [selectedSuffixPn, setSelectedSuffixPn] = useState("");

  // Re-scan confirmation state
  const [pendingQRData, setPendingQRData] = useState<HyundaiQRData | null>(null);
  const [showRescanConfirm, setShowRescanConfirm] = useState(false);

  // ----- Autosave (anti-WebView-kill no Android) -----
  // Em Android, ao abrir a câmera nativa o SO pode matar o WebView por falta
  // de memória. Quando o usuário volta, o React re-monta zerado. Salvamos
  // snapshot em sessionStorage e restauramos na primeira montagem.
  const autosaveKey = isEdit ? `apontamento:edit:${id}` : `apontamento:novo:${tipo || "incoming"}`;
  const MAX_AGE_MS = 60 * 60 * 1000; // 1h

  // Restaurar snapshot uma única vez na montagem
  useEffect(() => {
    const snap = readFormAutosave<{ __ts: number; data: any }>(autosaveKey);
    if (!snap?.data) return;
    if (Date.now() - (snap.__ts || 0) > MAX_AGE_MS) {
      clearFormAutosave(autosaveKey);
      return;
    }
    const d = snap.data;
    try {
      if (d.formTipo) setFormTipo(d.formTipo);
      if (d.data) setData(d.data);
      if (d.turno) setTurno(d.turno);
      if (d.fase) setFase(d.fase);
      if (d.projeto) setProjeto(d.projeto);
      if (d.fornecedor) setFornecedor(d.fornecedor);
      if (d.partNumber) setPartNumber(d.partNumber);
      if (d.partName) setPartName(d.partName);
      if (d.modulo) setModulo(d.modulo);
      if (typeof d.quantidadeInspecionada === "number") setQuantidadeInspecionada(d.quantidadeInspecionada);
      if (typeof d.quantidadeNg === "number") setQuantidadeNg(d.quantidadeNg);
      if (typeof d.quantidadeOk === "number") setQuantidadeOk(d.quantidadeOk);
      if (d.loteInspecionado) setLoteInspecionado(d.loteInspecionado);
      if (d.modoFalha) setModoFalha(d.modoFalha);
      if (d.paradaLinha) setParadaLinha(d.paradaLinha);
      if (d.paradaLinhaTempo) setParadaLinhaTempo(d.paradaLinhaTempo);
      if (d.descricao) setDescricao(d.descricao);
      if (d.localDeteccao) setLocalDeteccao(d.localDeteccao);
      if (d.vinNumber) setVinNumber(d.vinNumber);
      if (d.responsabilidadeDefeito) setResponsabilidadeDefeito(d.responsabilidadeDefeito);
      if (typeof d.quantidadeDetectado === "number") setQuantidadeDetectado(d.quantidadeDetectado);
      if (d.lancamento) setLancamento(d.lancamento);
      if (d.analiseInicial) setAnaliseInicial(d.analiseInicial);
      if (d.acaoImediata) setAcaoImediata(d.acaoImediata);
      if (d.comentarioAdicional) setComentarioAdicional(d.comentarioAdicional);
      if (Array.isArray(d.segundoDefeitos)) setSegundoDefeitos(d.segundoDefeitos);
      if (d.temSegundoDefeito) setTemSegundoDefeito(d.temSegundoDefeito);
      if (d.temCoInspecao) setTemCoInspecao(d.temCoInspecao);
      if (Array.isArray(d.coInspetores)) setCoInspetores(d.coInspetores);
      if (d.horaInicio) setHoraInicio(d.horaInicio);
      if (d.horaFim) setHoraFim(d.horaFim);
      if (d.ngMultiploDecisao) setNgMultiploDecisao(d.ngMultiploDecisao);
      if (Array.isArray(d.defeitosDetalhes)) setDefeitosDetalhes(d.defeitosDetalhes);
      if (d.tagNumber) setTagNumber(d.tagNumber);
      // Restaurar previews de fotos (data URLs). Os arquivos em si são
      // recriados a partir das data URLs para upload futuro.
      if (Array.isArray(d.photoPreviews) && d.photoPreviews.length) {
        setPhotoPreviews(d.photoPreviews);
        const files: File[] = [];
        d.photoPreviews.forEach((url: string, idx: number) => {
          try {
            const m = /^data:(.*?);base64,(.*)$/.exec(url);
            if (!m) return;
            const mime = m[1] || "image/jpeg";
            const bin = atob(m[2]);
            const arr = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
            files.push(new File([arr], `restored-${idx}.jpg`, { type: mime }));
          } catch { /* skip broken */ }
        });
        if (files.length) setPhotoFiles(files);
      }
      toast.info("Formulário restaurado após reinício");
    } catch (err) {
      console.warn("[autosave] restore failed", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Snapshot debounced em sessionStorage
  useFormAutosave(autosaveKey, {
    formTipo, data, turno, fase, projeto, fornecedor, partNumber, partName, modulo,
    quantidadeInspecionada, quantidadeNg, quantidadeOk, loteInspecionado, modoFalha,
    paradaLinha, paradaLinhaTempo, descricao, localDeteccao, vinNumber,
    responsabilidadeDefeito, quantidadeDetectado, lancamento, analiseInicial,
    acaoImediata, comentarioAdicional, segundoDefeitos, temSegundoDefeito,
    temCoInspecao, coInspetores, horaInicio, horaFim, ngMultiploDecisao,
    defeitosDetalhes, tagNumber, photoPreviews,
  }, !isEdit);

  const applySuffixSelection = (option: typeof suffixOptions[number]) => {
    setPartNumber(option.part_number);
    if (option.part_name) setPartName(option.part_name);
    if (option.project) setProjeto(option.project);
    if (option.line_module) setModulo(option.line_module);
    if (option.supplier_name) setFornecedor(option.supplier_name);
    setSuffixPickerOpen(false);
  };

  const applyQRScan = async (qrData: HyundaiQRData) => {
    const pn = qrData.partNumber;
    if (pn) setPartNumber(pn);
    if (qrData.lotNumber) setLoteInspecionado(qrData.lotNumber);
    setPendingLot(qrData.lotNumber || "");
    setValidationErrors((prev) => {
      const next = new Set(prev);
      if (pn) next.delete("partNumber");
      if (qrData.lotNumber) next.delete("loteInspecionado");
      return next;
    });

    // Partial scan (only lot read from linear barcode) — guide user to complete PN.
    if (!pn) {
      toast.info("Lote capturado. Aponte para o QR/DataMatrix 2D ou preencha o Part Number manualmente.", { duration: 5000 });
      return;
    }

    // ALC scanned from label (sequence/suffix) — compare against engineering's expected ALC
    const scannedAlc = (qrData.alc || "").toUpperCase().trim();

    try {
      const pnNormalized = pn.replace(/-/g, "");

      // Try exact match first
      let { data: partData } = await supabase
        .from("part_numbers")
        .select("part_name, project, line_module, supplier_id, part_number, alc_code, suppliers(name)")
        .eq("part_number", pn)
        .eq("active", true)
        .limit(1)
        .maybeSingle();

      // Try normalized exact match
      if (!partData) {
        const { data: allActive } = await supabase
          .from("part_numbers")
          .select("part_name, project, line_module, supplier_id, part_number, alc_code, suppliers(name)")
          .eq("active", true);
        if (allActive) {
          partData = allActive.find((p) => p.part_number.replace(/-/g, "") === pnNormalized) || null;
        }
      }

      if (partData) {
        // Exact match found — auto-fill
        if (partData.part_name) setPartName(partData.part_name);
        if (partData.project) setProjeto(partData.project);
        if (partData.line_module) setModulo(partData.line_module);
        const supplierName = (partData as any).suppliers?.name;
        if (supplierName) setFornecedor(supplierName);

        // ALC comparison
        const expectedAlc = ((partData as any).alc_code || "").toUpperCase().trim();
        setAlcExpected(expectedAlc);
        if (scannedAlc) {
          setAlcCode(scannedAlc);
          if (!expectedAlc || expectedAlc === "N/A") {
            setAlcStatus("manual");
          } else if (expectedAlc === scannedAlc) {
            setAlcStatus("match");
          } else {
            setAlcStatus("mismatch");
            setAlcMismatchAttempts((prev) => (alcMismatchScanned === scannedAlc ? prev + 1 : 1));
            setAlcMismatchScanned(scannedAlc);
            setShowAlcMismatchDialog(true);
          }
        } else {
          setAlcCode(expectedAlc || "N/A");
          setAlcStatus("idle");
        }
        return;
      }

      // No exact match — check for variants
      // Strategy 1: scanned PN is the BASE, DB has base+suffix (e.g., 84852R1520 → 84852R1520NNB)
      // Strategy 2: scanned PN has a suffix, strip last 3 chars to find base variants
      const { data: allActive } = await supabase
        .from("part_numbers")
        .select("part_name, project, line_module, part_number, alc_code, suppliers(name)")
        .eq("active", true);

      if (allActive) {
        // First try: PN is the base — find entries that start with it and have a suffix
        let matches = allActive.filter((p) => {
          const norm = p.part_number.replace(/-/g, "");
          return norm.length > pnNormalized.length && norm.startsWith(pnNormalized);
        });

        // Second try: PN might have a suffix — strip last 3 chars and find siblings
        if (matches.length === 0 && pnNormalized.length > 3) {
          const baseNormalized = pnNormalized.slice(0, -3);
          matches = allActive.filter((p) => {
            const norm = p.part_number.replace(/-/g, "");
            return norm.length > 3 && norm.startsWith(baseNormalized) && norm.length === baseNormalized.length + 3;
          });
        }

        // Third try: fuzzy match — handle OCR misreads (B↔8, 0↔O, 1↔I, 5↔S)
        if (matches.length === 0 && pnNormalized.length >= 6) {
          const fuzzyNormalize = (s: string) =>
            s.toUpperCase().replace(/8/g, "B").replace(/0/g, "O").replace(/1/g, "I").replace(/5/g, "S");
          const fuzzyScanned = fuzzyNormalize(pnNormalized);
          matches = allActive.filter((p) => {
            const norm = p.part_number.replace(/-/g, "");
            return fuzzyNormalize(norm) === fuzzyScanned;
          });
          if (matches.length === 0) {
            const fuzzyBase = fuzzyScanned.slice(0, -3);
            matches = allActive.filter((p) => {
              const norm = p.part_number.replace(/-/g, "");
              const fuzzyNorm = fuzzyNormalize(norm);
              return fuzzyNorm.length >= fuzzyBase.length && fuzzyNorm.startsWith(fuzzyBase);
            });
          }
        }

        const applyAlcFor = (m: any) => {
          const expectedAlc = ((m as any).alc_code || "").toUpperCase().trim();
          setAlcExpected(expectedAlc);
          if (scannedAlc) {
            setAlcCode(scannedAlc);
            if (!expectedAlc || expectedAlc === "N/A") {
              setAlcStatus("manual");
            } else if (expectedAlc === scannedAlc) {
              setAlcStatus("match");
            } else {
              setAlcStatus("mismatch");
              setAlcMismatchAttempts((prev) => (alcMismatchScanned === scannedAlc ? prev + 1 : 1));
              setAlcMismatchScanned(scannedAlc);
              setShowAlcMismatchDialog(true);
            }
          } else {
            setAlcCode(expectedAlc || "N/A");
            setAlcStatus("idle");
          }
        };

        if (matches.length === 1) {
          const m = matches[0];
          setPartNumber(m.part_number);
          if (m.part_name) setPartName(m.part_name);
          if (m.project) setProjeto(m.project);
          if (m.line_module) setModulo(m.line_module);
          const supplierName = (m as any).suppliers?.name;
          if (supplierName) setFornecedor(supplierName);
          applyAlcFor(m);
        } else if (matches.length > 1) {
          const options = matches.map((m) => ({
            part_number: m.part_number,
            part_name: m.part_name || "",
            project: m.project || "",
            line_module: m.line_module || "",
            supplier_name: (m as any).suppliers?.name || "",
          }));
          setSuffixOptions(options);
          setSelectedSuffixPn("");
          setSuffixPickerOpen(true);
          toast.warning("Part Number lido não encontrado exatamente. Selecione a variante correta.", { duration: 5000 });
        } else if (scannedAlc) {
          setAlcCode(scannedAlc);
          setAlcStatus("manual");
        }
      }
    } catch {
      // Silently fail — user can fill manually
    }
  };

  const alcRescanInProgress = useRef(false);

  const handleQRScan = (qrData: HyundaiQRData) => {
    // Bypass "Nova Leitura Detectada" when the rescan was triggered from the ALC mismatch flow
    if (alcRescanInProgress.current) {
      alcRescanInProgress.current = false;
      void applyQRScan(qrData);
      return;
    }
    if (partNumber && partNumber.trim() !== "") {
      setPendingQRData(qrData);
      setShowRescanConfirm(true);
      return;
    }
    void applyQRScan(qrData);
  };

  const confirmRescan = () => {
    if (pendingQRData) {
      setPartNumber("");
      setPartName("");
      setProjeto("");
      setFornecedor("");
      setModulo("");
      setLoteInspecionado("");
      setDescricao("");
      setModoFalha("");
      setResponsabilidadeDefeito("");
      setQuantidadeInspecionada(0);
      setQuantidadeNg(0);
      setQuantidadeOk(0);
      setQuantidadeDetectado(0);
      setDefeitosDetalhes([]);
      setSegundoDefeitos([]);
      setTemSegundoDefeito("nao");
      setNgMultiploDecisao(null);
      setTagNumber("");
      void applyQRScan(pendingQRData);
    }
    setShowRescanConfirm(false);
    setPendingQRData(null);
  };

  // ALC mismatch — option 1: keep manual entry (with photo) and continue
  const handleAlcManualKeep = () => {
    setShowAlcMismatchDialog(false);
    setAlcStatus("manual");
    toast.warning("ALC registrado manualmente. Anexe foto da etiqueta física para evidência.", { duration: 6000 });
  };

  // ALC mismatch — option 2: confirm divergence and auto-open NG defect with modo_falha required
  const handleAlcConfirmError = () => {
    setShowAlcMismatchDialog(false);
    setAlcStatus("mismatch");
    // Force at least 1 NG and require modo_falha
    if (quantidadeInspecionada <= 0) setQuantidadeInspecionada(1);
    if (quantidadeNg < 1) setQuantidadeNg(1);
    // Pre-fill description with the divergence context
    const ctx = `Divergência de ALC: lido "${alcMismatchScanned}" — esperado "${alcExpected || "N/A"}" para PN ${partNumber}.`;
    setDescricao((prev) => (prev && prev !== "Sem defeito encontrado durante essa inspeção" ? `${ctx}\n${prev}` : ctx));
    // Highlight modo_falha as required
    setValidationErrors((p) => { const n = new Set(p); n.add("modoFalha"); return n; });
    toast.error("Defeito de ALC registrado. Selecione o Modo de Falha e anexe foto da etiqueta.", { duration: 7000 });
  };

  const cancelRescan = () => {
    setShowRescanConfirm(false);
    setPendingQRData(null);
    toast.info("Leitura atual mantida.");
  };

  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const requestExit = () => setShowExitConfirm(true);
  const confirmExit = () => {
    try { clearFormAutosave(autosaveKey); } catch {}
    setShowExitConfirm(false);
    navigate("/apontamentos");
  };

  // Load existing data
  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ["apontamento-edit", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("apontamentos").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: isEdit,
  });

  // Permission guard: only owner or admin can edit.
  // In test mode (impersonation), the effective owner is the impersonated user,
  // so the apontamento's created_by must match the impersonated id — admin bypass
  // is intentionally disabled while impersonating to truly simulate the user.
  useEffect(() => {
    if (!isEdit || !existing || !user) return;
    const effectiveUserId = impersonating?.id || user.id;
    const isOwner = existing.created_by === effectiveUserId;
    const adminBypass = isAdmin && !impersonating;
    if (!isOwner && !adminBypass) {
      toast.error(
        impersonating
          ? "Modo teste: este apontamento não pertence ao usuário simulado."
          : "Você só pode editar apontamentos que você mesmo criou."
      );
      navigate("/apontamentos", { replace: true });
    }
  }, [isEdit, existing, user, isAdmin, impersonating, navigate]);


  // Load defects for modo_falha
  const { data: defects = [] } = useQuery({
    queryKey: ["defects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("defects").select("*").eq("active", true).order("code");
      if (error) throw error;
      return data;
    },
  });

  // Load responsibilities
  const { data: responsibilities = [] } = useQuery({
    queryKey: ["responsibilities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("responsibilities").select("*").eq("active", true).order("code");
      if (error) throw error;
      return data;
    },
  });

  // Load users for co-inspection - only Mobis Brasil users
  const {
    data: allProfiles = [],
    isLoading: loadingCoInspetores,
    isError: errorCoInspetores,
    refetch: refetchCoInspetores,
  } = useQuery({
    queryKey: ["profiles-for-coinspecao"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .rpc("get_co_inspection_profiles");
      if (error) {
        console.error("Error loading profiles for co-inspection:", error);
        throw error;
      }
      return data || [];
    },
    enabled: activeProfile?.empresa !== "empresa_terceira",
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });

  // Load existing photos
  const { data: existingPhotos = [] } = useQuery({
    queryKey: ["apontamento-photos", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("checklist_photos").select("*").eq("checklist_id", id!).eq("checklist_type", "apontamento");
      if (error) throw error;
      return data;
    },
    enabled: isEdit,
  });

  // Auto-fill turno from profile
  useEffect(() => {
    if (activeProfile && !isEdit && activeProfile.turno) {
      setTurno(activeProfile.turno);
    }
  }, [activeProfile, isEdit]);

  // Auto-set responsabilidade for terceira users on incoming
  useEffect(() => {
    if (!isEdit && tipo === "incoming" && (activeProfile?.empresa === "empresa_terceira" || activeProfile?.empresa_terceira)) {
      setResponsabilidadeDefeito("Sorting");
    }
  }, [activeProfile, isEdit, tipo]);

  // Auto-fill Local de Inspeção from URL param for incoming
  useEffect(() => {
    if (!isEdit && tipo === "incoming") {
      const localParam = searchParams.get("local");
      if (localParam) {
        setLocalDeteccao(localParam);
        setFase(localParam);
      }
    }
  }, [isEdit, tipo, searchParams]);

  useEffect(() => {
    if (existing) {
      setFormTipo(existing.tipo as ApontamentoTipo);
      setData(existing.data);
      setTurno(existing.turno || "");
      setFase(existing.fase || "");
      setProjeto(existing.projeto || "");
      setFornecedor(existing.fornecedor || "");
      setPartNumber(existing.part_number || "");
      setPartName(existing.part_name || "");
      setAlcCode((existing as any).alc_code || "N/A");
      setAlcStatus("idle");
      setQuantidadeInspecionada(existing.quantidade_inspecionada || 0);
      setQuantidadeNg(existing.quantidade_ng || 0);
      setQuantidadeOk(existing.quantidade_ok || 0);
      setLoteInspecionado(existing.lote_inspecionado || "");
      setModoFalha(existing.modo_falha || "");
      setParadaLinha(existing.parada_linha || "nao");
      setParadaLinhaTempo(existing.parada_linha_tempo || "");
      setDescricao(existing.descricao || "");
      setLocalDeteccao(existing.local_deteccao || "");
      setVinNumber(existing.vin_number || "");
      setResponsabilidadeDefeito(existing.responsabilidade_defeito || "");
      setQuantidadeDetectado(existing.quantidade_detectado || 0);
      setLancamento(existing.lancamento || "");
      setAnaliseInicial(existing.analise_inicial || "");
      setAcaoImediata(existing.acao_imediata || "");
      setComentarioAdicional(existing.comentario_adicional || "");
      const sd = (existing.segundo_defeitos as any[]) || [];
      // Distinguish "diferente" defeitos (with modo_falha) from "segundo defeito" (with part_number)
      const defeitosDiferente = sd.filter((d: any) => d?.modo_falha);
      const segundosDefeitosLegacy = sd.filter((d: any) => !d?.modo_falha);
      if (defeitosDiferente.length > 0) {
        setNgMultiploDecisao("diferente");
        setDefeitosDetalhes(defeitosDiferente.map((d: any) => ({
          modo_falha: d.modo_falha || "",
          descricao: d.descricao || "",
          qty_ng: Number(d.qty) || 0,
          tag_number: d.tag || "",
          photoFiles: [],
          photoPreviews: [],
        })));
        setSegundoDefeitos([]);
        setTemSegundoDefeito("nao");
      } else {
        setSegundoDefeitos(segundosDefeitosLegacy);
        setTemSegundoDefeito(segundosDefeitosLegacy.length > 0 ? "sim" : "nao");
      }
      const ci = (existing as any).co_inspetores as string[] || [];
      setCoInspetores(ci);
      setTemCoInspecao(ci.length > 0 ? "sim" : "nao");
      setTagNumber((existing as any).numero_tag || (existing as any).tag_number || "");
      const ti = (existing as any).tempo_inspecao || "";
      if (ti.includes(" - ")) {
        const parts = ti.split(" - ");
        setHoraInicio(parts[0]?.trim() || "");
        setHoraFim(parts[1]?.split(" ")[0]?.trim() || "");
      }
    }
  }, [existing]);

  // Auto-calculate OK from Incoming
  useEffect(() => {
    if (formTipo === "incoming") {
      setQuantidadeOk(Math.max(0, quantidadeInspecionada - quantidadeNg));
    }
  }, [quantidadeInspecionada, quantidadeNg, formTipo]);

  // Auto-fill description if NG = 0 for Incoming
  useEffect(() => {
    if (formTipo === "incoming" && quantidadeNg === 0) {
      setDescricao("Sem defeito encontrado durante essa inspeção");
    } else if (formTipo === "incoming" && quantidadeNg > 0) {
      // Clear default text when NG > 0
      if (descricao === "Sem defeito encontrado durante essa inspeção") {
        setDescricao("");
      }
    }
  }, [quantidadeNg, formTipo]);

  // Trigger NG decision dialog for Incoming when NG > 1
  useEffect(() => {
    if (isIncoming && quantidadeNg > 1 && ngMultiploDecisao === null) {
      setShowNgDecisionDialog(true);
    }
    if (isIncoming && quantidadeNg <= 1) {
      setNgMultiploDecisao(null);
      setDefeitosDetalhes([]);
    }
  }, [quantidadeNg]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    const totalPhotos = photoFiles.length + existingPhotos.length;
    const maxNew = 4 - totalPhotos;
    if (files.length > maxNew) { toast.error(`Máximo 4 fotos. Você pode adicionar mais ${maxNew}.`); return; }
    if (files.length === 0) return;
    // Compress and queue for annotation one-by-one
    const compressed = await Promise.all(files.map((f) => compressImage(f)));
    setAnnotatingFile(compressed[0]);
    setAnnotationQueue(compressed.slice(1));
  };

  const handleInAppCapture = async (file: File) => {
    setCameraOpen(false);
    const totalPhotos = photoFiles.length + existingPhotos.length;
    if (totalPhotos >= 4) { toast.error("Máximo 4 fotos."); return; }
    const compressed = await compressImage(file);
    setAnnotatingFile(compressed);
  };

  const addAnnotatedPhoto = (file: File) => {
    setPhotoFiles((prev) => [...prev, file]);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreviews((prev) => [...prev, ev.target?.result as string]);
    reader.readAsDataURL(file);
  };

  const handleAnnotationConfirm = (annotatedFile: File) => {
    addAnnotatedPhoto(annotatedFile);
    if (annotationQueue.length > 0) {
      setAnnotatingFile(annotationQueue[0]);
      setAnnotationQueue((q) => q.slice(1));
    } else {
      setAnnotatingFile(null);
    }
  };

  const handleAnnotationCancel = () => {
    // Use original (compressed) image without annotation
    if (annotatingFile) addAnnotatedPhoto(annotatingFile);
    if (annotationQueue.length > 0) {
      setAnnotatingFile(annotationQueue[0]);
      setAnnotationQueue((q) => q.slice(1));
    } else {
      setAnnotatingFile(null);
    }
  };

  const removeNewPhoto = (index: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const addSegundoDefeito = () => {
    if (segundoDefeitos.length >= 8) { toast.error("Máximo 8 linhas"); return; }
    setSegundoDefeitos((prev) => [...prev, { part_number: "", part_name: "", qty: 0 }]);
  };

  const removeSegundoDefeito = (index: number) => setSegundoDefeitos((prev) => prev.filter((_, i) => i !== index));
  const updateSegundoDefeito = (index: number, field: keyof SegundoDefeito, value: any) => setSegundoDefeitos((prev) => prev.map((d, i) => i === index ? { ...d, [field]: value } : d));

  const addCoInspetor = (name: string) => {
    if (coInspetores.length >= 5) { toast.error("Máximo 5 co-inspetores"); return; }
    if (coInspetores.includes(name)) return;
    setCoInspetores((prev) => [...prev, name]);
    setCoInspetorSearch("");
    // no-op, dialog stays open for multiple selections
  };

  const removeCoInspetor = (name: string) => setCoInspetores((prev) => prev.filter((n) => n !== name));

  // Show all users when no search, filter when typing
  const filteredProfiles = useMemo(() => {
    const term = coInspetorSearch.toLowerCase().trim();
    return allProfiles
      .filter((p: any) => p.full_name !== profile?.full_name && !coInspetores.includes(p.full_name))
      .filter((p: any) => !term || p.full_name?.toLowerCase().includes(term))
      .slice(0, 20);
  }, [coInspetorSearch, allProfiles, coInspetores, profile]);

  // Handle NG decision
  const handleNgDecision = (decision: "mesmo" | "diferente") => {
    setNgMultiploDecisao(decision);
    setShowNgDecisionDialog(false);
    if (decision === "diferente") {
      setDefeitosDetalhes([
        { modo_falha: "", descricao: "", qty_ng: 0, tag_number: "", photoFiles: [], photoPreviews: [] },
        { modo_falha: "", descricao: "", qty_ng: 0, tag_number: "", photoFiles: [], photoPreviews: [] },
      ]);
    } else {
      setDefeitosDetalhes([]);
    }
  };

  const addDefeitoDetalhe = () => {
    if (defeitosDetalhes.length >= quantidadeNg) { toast.error(`Máximo ${quantidadeNg} detalhes de defeito`); return; }
    setDefeitosDetalhes((prev) => [...prev, { modo_falha: "", descricao: "", qty_ng: 0, tag_number: "", photoFiles: [], photoPreviews: [] }]);
  };

  const removeDefeitoDetalhe = (index: number) => {
    if (defeitosDetalhes.length <= 2) return;
    setDefeitosDetalhes((prev) => prev.filter((_, i) => i !== index));
  };

  const updateDefeitoDetalhe = (index: number, field: string, value: any) => {
    setDefeitosDetalhes((prev) => prev.map((d, i) => i === index ? { ...d, [field]: value } : d));
  };

  const totalDefeitosQty = defeitosDetalhes.reduce((s, d) => s + d.qty_ng, 0);

  const errClass = (field: string) => validationErrors.has(field) ? "border-destructive ring-1 ring-destructive" : "";
  const errLabelClass = (field: string) => validationErrors.has(field) ? "text-destructive font-semibold" : "";

  const isIncoming = formTipo === "incoming";
  const isPeca = formTipo === "peca";
  const isProcesso = formTipo === "processo";
  const isOem = formTipo === "oem";
  const ngIsZero = isIncoming && quantidadeNg === 0;
  const adminEdit = isEdit && isAdmin && !impersonating;
  const today = getLocalDateString();

  const calcDuration = (start: string, end: string): string => {
    if (!start || !end) return "0min";
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff < 0) diff += 24 * 60;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return h > 0 ? `${h}h${m > 0 ? String(m).padStart(2, "0") + "min" : ""}` : `${m}min`;
  };

  const validate = (): boolean => {
    const errors = new Set<string>();
    const msgs: string[] = [];

    if (!data) { errors.add("data"); msgs.push("Data"); }
    if (!turno) { errors.add("turno"); msgs.push("Turno"); }
    if (!projeto) { errors.add("projeto"); msgs.push("Projeto"); }
    if (!fornecedor) { errors.add("fornecedor"); msgs.push("Fornecedor"); }
    if (!partNumber) { errors.add("partNumber"); msgs.push("Part Number"); }

    if (!isOem && !isIncoming && !fase) { errors.add("fase"); msgs.push("Fase"); }
    if (isOem && !vinNumber) { errors.add("vinNumber"); msgs.push("VIN"); }

    if (isIncoming) {
      if (quantidadeInspecionada <= 0) { errors.add("quantidadeInspecionada"); msgs.push("Quantidade Inspecionada"); }
      if (!loteInspecionado) { errors.add("loteInspecionado"); msgs.push("Lote Inspecionado"); }
      if (!horaInicio) { errors.add("horaInicio"); msgs.push("Horário Inicial"); }
      if (!horaFim) { errors.add("horaFim"); msgs.push("Horário Final"); }
      if (alcExpected && alcExpected !== "N/A" && alcStatus !== "match" && alcStatus !== "mismatch") {
        errors.add("alcCode"); msgs.push("Validação do ALC (clique em \"Validar ALC manual\")");
      }
      if (quantidadeNg > 0 && ngMultiploDecisao !== "diferente" && !descricao) { errors.add("descricao"); msgs.push("Descrição do Problema"); }
      if (quantidadeNg > 0 && ngMultiploDecisao !== "diferente" && !modoFalha) { errors.add("modoFalha"); msgs.push("Modo de Falha"); }
      if (quantidadeNg > 0 && photoFiles.length === 0 && existingPhotos.length === 0) { errors.add("fotos"); msgs.push("Foto do Defeito (mínimo 1)"); }
      if (ngMultiploDecisao === "diferente" && totalDefeitosQty !== quantidadeNg) {
        errors.add("defeitosQty"); msgs.push(`Soma dos NG nos detalhes (${totalDefeitosQty}) deve ser igual ao total NG (${quantidadeNg})`);
      }
      if (ngMultiploDecisao === "diferente") {
        defeitosDetalhes.forEach((d, idx) => {
          if (!d.modo_falha) { errors.add(`defeito-${idx}-modoFalha`); msgs.push(`Defeito ${idx + 1}: Modo de Falha`); }
        });
      }
      // Co-inspeção validation: only Mobis Brasil
      if (activeProfile?.empresa !== "empresa_terceira") {
        if (temCoInspecao === "sim" && coInspetores.length === 0) {
          errors.add("coInspetores"); msgs.push("Selecione ao menos 1 co-inspetor ou marque 'Não'");
        }
        if (coInspetores.length > 5) {
          errors.add("coInspetores"); msgs.push("Máximo 5 co-inspetores");
        }
        // Ensure all selected co-inspectors still exist in the loaded list
        if (coInspetores.length > 0 && allProfiles.length > 0) {
          const validNames = new Set(allProfiles.map((p: any) => p.full_name));
          const invalid = coInspetores.filter((n) => !validNames.has(n));
          if (invalid.length > 0) {
            errors.add("coInspetores");
            msgs.push(`Co-inspetor(es) inválido(s): ${invalid.join(", ")}`);
          }
        }
      }
    }

    if (isPeca) {
      if (quantidadeNg < 0) { errors.add("quantidadeNg"); msgs.push("Quantidade NG"); }
      if (!descricao) { errors.add("descricao"); msgs.push("Descrição do Problema"); }
      if (quantidadeNg > 0 && !modoFalha) { errors.add("modoFalha"); msgs.push("Modo de Falha"); }
      if (photoFiles.length === 0 && existingPhotos.length === 0) { errors.add("fotos"); msgs.push("Foto do Defeito (mínimo 1)"); }
    }

    if (isProcesso) {
      if (quantidadeNg <= 0) { errors.add("quantidadeNg"); msgs.push("Quantidade NG (deve ser > 0)"); }
      if (!descricao) { errors.add("descricao"); msgs.push("Descrição do Problema"); }
      if (!modoFalha) { errors.add("modoFalha"); msgs.push("Modo de Falha"); }
      if (photoFiles.length === 0 && existingPhotos.length === 0) { errors.add("fotos"); msgs.push("Foto do Defeito (mínimo 1)"); }
    }

    if (isOem) {
      if (!descricao) { errors.add("descricao"); msgs.push("Descrição do Problema"); }
      if (!modoFalha) { errors.add("modoFalha"); msgs.push("Modo de Falha"); }
      if (!localDeteccao) { errors.add("localDeteccao"); msgs.push("Local de Detecção"); }
      if (!analiseInicial) { errors.add("analiseInicial"); msgs.push("Análise Inicial"); }
      if (!acaoImediata) { errors.add("acaoImediata"); msgs.push("Ação Imediata"); }
      if (photoFiles.length === 0 && existingPhotos.length === 0) { errors.add("fotos"); msgs.push("Foto do Defeito (mínimo 1)"); }
    }

    setValidationErrors(errors);
    if (errors.size > 0) { setValidationMessages(msgs); setShowValidationDialog(true); return false; }
    return true;
  };

  const handleSave = async (asDraft: boolean) => {
    if (!asDraft && !validate()) return;
    if (asDraft) setValidationErrors(new Set());
    setSaving(true);
    try {
      const payload: any = {
        tipo: formTipo,
        titulo: `${typeLabels[formTipo]} - ${partNumber || "Sem PN"}`,
        responsavel: activeProfile?.full_name || "Desconhecido",
        data,
        turno: turno || null,
        fase: fase || null,
        projeto: projeto || null,
        fornecedor: fornecedor || null,
        part_number: partNumber || null,
        part_name: partName || null,
        alc_code: (alcCode && alcCode.trim()) ? alcCode.trim() : "N/A",
        descricao: descricao || "Sem descrição",
        quantidade_inspecionada: quantidadeInspecionada,
        quantidade_ng: quantidadeNg,
        quantidade_ok: quantidadeOk,
        lote_inspecionado: loteInspecionado || null,
        modo_falha: modoFalha || null,
        parada_linha: paradaLinha,
        parada_linha_tempo: paradaLinha === "sim" ? paradaLinhaTempo : null,
        local_deteccao: localDeteccao || null,
        vin_number: vinNumber || null,
        responsabilidade_defeito: responsabilidadeDefeito || null,
        quantidade_detectado: quantidadeDetectado,
        lancamento: lancamento || null,
        analise_inicial: analiseInicial || null,
        acao_imediata: acaoImediata || null,
        comentario_adicional: comentarioAdicional || null,
        segundo_defeitos: temSegundoDefeito === "sim" ? segundoDefeitos :
          ngMultiploDecisao === "diferente" ? defeitosDetalhes.map((d) => ({ modo_falha: d.modo_falha, descricao: d.descricao, qty: d.qty_ng, tag: d.tag_number || null })) : [],
        status: asDraft ? "draft" : "submitted",
        created_by: user?.id || null,
        co_inspetores: temCoInspecao === "sim" ? coInspetores : [],
        tempo_inspecao: horaInicio && horaFim ? `${horaInicio} - ${horaFim} (${calcDuration(horaInicio, horaFim)})` : null,
        numero_tag: isIncoming ? (quantidadeNg > 0 && ngMultiploDecisao !== "diferente" ? (tagNumber || null) : null) : null,
      } as any;

      let recordId = id;

      if (isEdit) {
        // Re-validate ownership against the effective user (handles impersonation)
        const effectiveUserId = impersonating?.id || user?.id;
        const isOwner = existing?.created_by === effectiveUserId;
        const adminBypass = isAdmin && !impersonating;
        if (!isOwner && !adminBypass) {
          throw new Error(
            impersonating
              ? "Modo teste: este apontamento não pertence ao usuário simulado."
              : "Você não tem permissão para editar este apontamento."
          );
        }
        // Server-side authoritative check + update via edge function.
        // The function validates created_by against the impersonated id (admin only)
        // or against auth.uid(), and strips protected fields.
        const { data: fnData, error: fnErr } = await supabase.functions.invoke("update-apontamento", {
          body: {
            id,
            payload,
            impersonatedUserId: impersonating?.id || null,
          },
        });

        // Try to extract structured error body (status + code + fields)
        let errBody: any = null;
        let status: number | null = null;
        const ctx: any = (fnErr as any)?.context;
        if (ctx) {
          status = typeof ctx.status === "number" ? ctx.status : null;
          try {
            if (typeof ctx.json === "function") errBody = await ctx.json();
            else if (typeof ctx.text === "function") {
              const t = await ctx.text();
              try { errBody = JSON.parse(t); } catch { errBody = { error: t }; }
            }
          } catch { /* ignore */ }
        }
        if (!errBody && (fnData as any)?.error) errBody = fnData;

        if (fnErr || errBody?.error) {
          const code = errBody?.code as string | undefined;
          const serverMsg = errBody?.error as string | undefined;
          const fields = errBody?.fields as Record<string, string[]> | undefined;

          // Map by HTTP status / code to friendly messages
          let friendly = serverMsg || fnErr?.message || "Falha ao atualizar apontamento";
          if (status === 401 || code === "UNAUTHENTICATED" || code === "INVALID_SESSION") {
            friendly = "Sua sessão expirou. Faça login novamente para continuar.";
          } else if (status === 403) {
            friendly = code === "IMPERSONATION_OWNERSHIP_MISMATCH"
              ? "Modo teste: este apontamento não pertence ao usuário simulado."
              : code === "IMPERSONATION_FORBIDDEN"
              ? "Apenas administradores podem usar o modo teste."
              : "Você não tem permissão para editar este apontamento.";
          } else if (status === 404 || code === "NOT_FOUND") {
            friendly = "Apontamento não encontrado. Pode ter sido excluído por outro usuário.";
          } else if (status === 400) {
            if (code === "VALIDATION_FAILED" && fields) {
              const parts = Object.entries(fields)
                .slice(0, 3)
                .map(([f, msgs]) => `${f}: ${msgs?.[0] ?? "inválido"}`)
                .join(" • ");
              friendly = `Dados inválidos — ${parts}`;
            } else if (code === "INVALID_ID") friendly = "ID do apontamento inválido.";
            else if (code === "INVALID_IMPERSONATION") friendly = "Usuário simulado inválido.";
            else if (code === "INVALID_BODY" || code === "INVALID_PAYLOAD") friendly = "Dados enviados estão incompletos ou malformados.";
            else if (code === "DB_UPDATE_ERROR") friendly = `Erro ao salvar no banco: ${serverMsg}`;
            else friendly = serverMsg || "Requisição inválida.";
          } else if ((status && status >= 500) || code === "INTERNAL_ERROR" || code === "DB_READ_ERROR") {
            friendly = "Erro no servidor. Tente novamente em instantes.";
          }
          throw new Error(friendly);
        }
      } else {
        const { data: inserted, error } = await supabase.from("apontamentos").insert(payload).select("id").single();
        if (error) throw error;
        recordId = inserted.id;
      }

      if (photoFiles.length > 0 && recordId) {
        await uploadPhotos(photoFiles, recordId, "apontamento");
      }

      toast.success(isEdit ? "Registro atualizado!" : asDraft ? "Rascunho salvo!" : "Registro finalizado!");
      clearFormAutosave(autosaveKey);
      navigate("/apontamentos");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  if (isEdit && loadingExisting) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <header className="gradient-header">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-6">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={requestExit} className="text-primary-foreground/70 hover:text-primary-foreground px-2"><ArrowLeft className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">Voltar</span></Button>
            <img src={logo} alt="Hyundai Mobis" className="h-5 sm:h-8 object-contain bg-white rounded-md px-2 py-0.5" />
          </div>
          <div className="flex items-center gap-2 mt-2 sm:mt-4">
            <FileBarChart className="w-5 h-5 sm:w-8 sm:h-8" />
            <h1 className="text-lg sm:text-2xl font-heading font-bold">{isEdit ? "Editar" : "Novo"} Apontamento — {typeLabels[formTipo]}</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 max-w-5xl overflow-x-hidden overflow-y-auto">
        {/* IDENTIFICAÇÃO */}
        <div className="form-section">
          <h2 className="form-section-title">Identificação</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="space-y-1.5">
              <Label className={errLabelClass("data")}>Data *</Label>
              <Input type="date" value={data} max={today} onChange={(e) => { setData(e.target.value); setValidationErrors((p) => { const n = new Set(p); n.delete("data"); return n; }); }} className={errClass("data")} />
            </div>
            <div className="space-y-1.5">
              <Label>Apontado por</Label>
              <Input value={activeProfile?.full_name || ""} readOnly className="bg-muted" />
            </div>
            <div className="space-y-1.5">
              <Label className={errLabelClass("turno")}>Turno *</Label>
              {adminEdit ? (
                <Select value={turno} onValueChange={setTurno}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{TURNOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <Input value={turno || "—"} readOnly className="bg-muted" />
              )}
            </div>
            {!isOem && !isIncoming && (
              <div className="space-y-1.5">
                <Label className={errLabelClass("fase")}>Fase *</Label>
                <Select value={fase} onValueChange={(v) => { setFase(v); setValidationErrors((p) => { const n = new Set(p); n.delete("fase"); return n; }); }}>
                  <SelectTrigger className={errClass("fase")}><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{FASES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {isIncoming && (
              <div className="space-y-1.5">
                <Label>Local de Inspeção</Label>
                {adminEdit ? (
                  <Select value={fase} onValueChange={setFase}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sala do Audio">Sala do Audio</SelectItem>
                      <SelectItem value="Área de Incoming">Área de Incoming</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={fase || "—"} readOnly className="bg-muted" />
                )}
              </div>
            )}
            {isOem && (
              <div className="space-y-1.5">
                <Label className={errLabelClass("vinNumber")}>VIN *</Label>
                <Input value={vinNumber} onChange={(e) => { setVinNumber(e.target.value); setValidationErrors((p) => { const n = new Set(p); n.delete("vinNumber"); return n; }); }} placeholder="XXX 123456" className={errClass("vinNumber")} />
              </div>
            )}
          </div>

          {/* QR Scanner - mobile only, Incoming only */}
          {isIncoming && (
            <div className="mt-3 sm:hidden">
              <QRScannerButton ref={qrScannerRef} onScan={handleQRScan} />
            </div>
          )}

          {/* Projeto, Fornecedor, Part Number, Part Name (Módulo rendered abaixo) */}
          <div className="mt-3 sm:mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <SupplierPartSelector
              fornecedor={fornecedor}
              partNumber={partNumber}
              partName={partName}
              projeto={projeto}
              onFornecedorChange={(v) => { setFornecedor(v); setValidationErrors((p) => { const n = new Set(p); n.delete("fornecedor"); return n; }); }}
              onPartNumberChange={(v) => { setPartNumber(v); setValidationErrors((p) => { const n = new Set(p); n.delete("partNumber"); return n; }); }}
              onPartDataChange={(d) => {
                setPartName(d.part_name);
                setModulo(d.line_module);
                setProjeto(d.project);
                const exp = (d.alc_code || "").toUpperCase().trim();
                setAlcExpected(exp);
                if (!exp || exp === "N/A") {
                  setAlcCode("N/A");
                  setAlcStatus("idle");
                } else {
                  setAlcCode(exp);
                  setAlcStatus("idle");
                }
                setValidationErrors((p) => { const n = new Set(p); n.delete("projeto"); return n; });
              }}
            />
          </div>

          {/* MÓDULO + ALC + RESPONSABILIDADE - linha simétrica de 3 colunas (Incoming) */}
          {isIncoming ? (
            <div className="mt-3 sm:mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 items-end">
              <div className="space-y-1.5">
                <Label>Módulo</Label>
                <Input value={modulo} readOnly className="bg-muted" placeholder="Preenchido automaticamente" />
              </div>
              <div className="space-y-1.5">
                <Label className={`flex items-center gap-2 ${validationErrors.has("alcCode") ? "text-destructive font-semibold" : ""}`}>
                  <span>ALC</span>
                  {alcExpected && alcExpected !== "N/A" && <span className="text-destructive">*</span>}
                  {alcStatus === "match" && <span className="text-[10px] font-semibold text-emerald-600">✓ OK</span>}
                  {alcStatus === "mismatch" && <span className="text-[10px] font-semibold text-destructive">✗ Divergente</span>}
                  {alcStatus === "manual" && <span className="text-[10px] font-semibold text-amber-600">Manual</span>}
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={alcCode}
                    readOnly
                    placeholder="N/A"
                    className={
                      "bg-muted " + (
                        alcStatus === "match"
                          ? "border-emerald-500 ring-1 ring-emerald-500/40 text-emerald-700 font-semibold"
                          : alcStatus === "mismatch"
                          ? "border-destructive ring-1 ring-destructive/40 text-destructive font-semibold"
                          : validationErrors.has("alcCode")
                          ? "border-destructive ring-1 ring-destructive"
                          : ""
                      )
                    }
                  />
                  {alcStatus === "match" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled
                      className="shrink-0 whitespace-nowrap border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold disabled:opacity-100 dark:bg-emerald-950/30 dark:text-emerald-300"
                      title="ALC já validado"
                    >
                      ✓ Validado
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={`shrink-0 whitespace-nowrap ${validationErrors.has("alcCode") ? "border-destructive text-destructive" : ""}`}
                      disabled={!alcExpected || alcExpected === "N/A"}
                      onClick={() => {
                        setAlcManualInput("");
                        setShowAlcValidateDialog(true);
                      }}
                      title={!alcExpected || alcExpected === "N/A" ? "Sem ALC cadastrado para este Part Number" : "Validar ALC manualmente"}
                    >
                      Validar ALC manual
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Responsabilidade</Label>
                {(activeProfile?.empresa === "empresa_terceira" || activeProfile?.empresa_terceira) && !adminEdit ? (
                  <Input value="Sorting" readOnly className="bg-muted" />
                ) : (
                  <Select value={responsabilidadeDefeito} onValueChange={setResponsabilidadeDefeito}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {responsibilities.map((r: any) => (
                        <SelectItem key={r.id} value={r.description}>{r.description}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-3 sm:mt-4 space-y-1.5">
              <Label>Módulo</Label>
              <Input value={modulo} readOnly className="bg-muted" placeholder="Preenchido automaticamente" />
            </div>
          )}
        </div>

        {/* CO-INSPEÇÃO - Incoming only, Mobis Brasil only */}
        {isIncoming && activeProfile?.empresa !== "empresa_terceira" && (
          <div className="form-section">
            <h2 className="form-section-title">Co-Inspeção</h2>
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2 sm:items-start">
                <Select value={temCoInspecao} onValueChange={(v) => { setTemCoInspecao(v); if (v === "nao") { setCoInspetores([]); } }}>
                  <SelectTrigger className="w-full sm:w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nao">Não</SelectItem>
                    <SelectItem value="sim">Sim</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (temCoInspecao !== "sim") setTemCoInspecao("sim");
                    setShowCoInspetorDialog(true);
                  }}
                  className="w-full sm:w-auto gap-2"
                >
                  <Search className="w-4 h-4" /> Selecionar Co-Inspetores
                </Button>
                {temCoInspecao === "sim" && coInspetores.length > 0 && (
                  <div className="flex-1 flex flex-col gap-1.5">
                    {coInspetores.map((name) => (
                      <Badge key={name} variant="secondary" className="gap-1 justify-between w-full sm:w-auto sm:self-start px-2 py-1">
                        <span className="truncate">{name}</span>
                        <button type="button" onClick={() => removeCoInspetor(name)} className="shrink-0"><X className="w-3 h-3" /></button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              {temCoInspecao === "sim" && (
                <p className="text-xs text-muted-foreground">Até 5 co-inspetores ({coInspetores.length}/5)</p>
              )}
            </div>
          </div>
        )}

        {/* TEMPO + QUANTIDADES - Incoming - side by side on PC */}
        {isIncoming && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* TEMPO DE INSPEÇÃO */}
            <div className="form-section">
              <h2 className="form-section-title">Tempo de Inspeção</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="space-y-1.5">
                  <Label className={errLabelClass("horaInicio")}>Horário Inicial *</Label>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                    <Input type="time" value={horaInicio} onChange={(e) => { setHoraInicio(e.target.value); setValidationErrors((p) => { const n = new Set(p); n.delete("horaInicio"); return n; }); }} className={errClass("horaInicio")} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className={errLabelClass("horaFim")}>Horário Final *</Label>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                    <Input type="time" value={horaFim} onChange={(e) => { setHoraFim(e.target.value); setValidationErrors((p) => { const n = new Set(p); n.delete("horaFim"); return n; }); }} className={errClass("horaFim")} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Duração</Label>
                  <div className="flex items-center gap-2 h-10 px-3 rounded-md border bg-muted text-sm font-medium">
                    {horaInicio && horaFim ? calcDuration(horaInicio, horaFim) : "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* QUANTIDADES */}
            <div className="form-section">
              <h2 className="form-section-title">Quantidades</h2>
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                <div className="space-y-1.5">
                  <Label className={errLabelClass("quantidadeInspecionada")}>Inspecionada *</Label>
                  <Input type="number" min={1} value={quantidadeInspecionada || ""} onChange={(e) => setQuantidadeInspecionada(e.target.value === "" ? 0 : Number(e.target.value))} className={errClass("quantidadeInspecionada")} />
                </div>
                <div className="space-y-1.5">
                  <Label>NG *</Label>
                  <Input type="number" min={0} value={quantidadeNg || ""} onChange={(e) => setQuantidadeNg(e.target.value === "" ? 0 : Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label>OK</Label>
                  <Input type="number" value={quantidadeOk} readOnly className="bg-muted" />
                </div>
              </div>
              <div className="mt-3 sm:mt-4 space-y-1.5">
                <Label className={errLabelClass("loteInspecionado")}>Lote Inspecionado *</Label>
                <Input value={loteInspecionado} onChange={(e) => { setLoteInspecionado(e.target.value); setValidationErrors((p) => { const n = new Set(p); n.delete("loteInspecionado"); return n; }); }} placeholder="Ex: A1234" className={errClass("loteInspecionado")} />
              </div>
            </div>
          </div>
        )}

        {/* QUANTIDADES - Peça/Processo */}
        {(isPeca || isProcesso) && (
          <div className="form-section">
            <h2 className="form-section-title">Quantidade</h2>
            <div className="space-y-1.5">
              <Label className={errLabelClass("quantidadeNg")}>Quantidade de peça NG *</Label>
              <Input type="number" min={isProcesso ? 1 : 0} value={quantidadeNg || ""} onChange={(e) => setQuantidadeNg(e.target.value === "" ? 0 : Number(e.target.value))} className={errClass("quantidadeNg")} />
            </div>
          </div>
        )}

        {/* QUANTIDADES - OEM */}
        {isOem && (
          <div className="form-section">
            <h2 className="form-section-title">Quantidade</h2>
            <div className="space-y-1.5">
              <Label>Quantidade Detectado *</Label>
              <Input type="number" min={0} value={quantidadeDetectado || ""} onChange={(e) => setQuantidadeDetectado(e.target.value === "" ? 0 : Number(e.target.value))} />
            </div>
          </div>
        )}

        {/* DETALHES DO DEFEITO */}
        <div className="form-section">
          <h2 className="form-section-title">{isIncoming ? "Registro de Ocorrência" : "Detalhes do Defeito"}</h2>
          <div className="space-y-3 sm:space-y-4">
            {/* Modo de Falha - single mode or when NG <= 1 or same mode */}
            {(isIncoming || isPeca || isProcesso) && (ngMultiploDecisao !== "diferente") && (
              <div className="space-y-1.5">
                <Label>Modo de Falha {!ngIsZero && "*"}</Label>
                <Select value={modoFalha} onValueChange={setModoFalha} disabled={ngIsZero}>
                  <SelectTrigger><SelectValue placeholder={ngIsZero ? "N/A" : "Selecione"} /></SelectTrigger>
                  <SelectContent>{defects.map((d) => <SelectItem key={d.id} value={`${d.code} - ${d.description}`}>{d.description}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            {/* Multiple NG failure modes */}
            {isIncoming && ngMultiploDecisao === "diferente" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold">Detalhes de Defeito por Modo de Falha</Label>
                  <Badge variant={totalDefeitosQty === quantidadeNg ? "default" : "destructive"} className="text-xs">
                    {totalDefeitosQty}/{quantidadeNg} NG
                  </Badge>
                </div>
                {defeitosDetalhes.map((detalhe, idx) => (
                  <div key={idx} className="border rounded-lg p-3 space-y-3 bg-muted/10">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Defeito {idx === 0 ? "Principal" : `#${idx + 1}`}</span>
                      {idx >= 2 && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeDefeitoDetalhe(idx)}><Trash2 className="w-4 h-4" /></Button>}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Modo de Falha *</Label>
                      <Select value={detalhe.modo_falha} onValueChange={(v) => updateDefeitoDetalhe(idx, "modo_falha", v)}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>{defects.map((d) => <SelectItem key={d.id} value={`${d.code} - ${d.description}`}>{d.description}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Descrição *</Label>
                      <Textarea value={detalhe.descricao} onChange={(e) => updateDefeitoDetalhe(idx, "descricao", e.target.value)} placeholder="Descrição do defeito" rows={2} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5 w-full">
                        <Label className="text-xs">Qty NG *</Label>
                        <Input type="number" inputMode="numeric" min={1} value={detalhe.qty_ng || ""} onChange={(e) => updateDefeitoDetalhe(idx, "qty_ng", e.target.value === "" ? 0 : Number(e.target.value))} className="w-full" />
                      </div>
                      <div className="space-y-1.5 w-full">
                        <Label className="text-xs flex items-center gap-1"><Tag className="w-3 h-3" /> Número da TAG</Label>
                        <Input value={detalhe.tag_number} onChange={(e) => updateDefeitoDetalhe(idx, "tag_number", e.target.value)} placeholder="Opcional" className="w-full" />
                      </div>
                    </div>
                  </div>
                ))}
                {defeitosDetalhes.length < quantidadeNg && (
                  <Button variant="outline" size="sm" onClick={addDefeitoDetalhe} className="gap-2 w-full sm:w-auto"><Plus className="w-4 h-4" /> Adicionar Defeito</Button>
                )}
                {totalDefeitosQty !== quantidadeNg && (
                  <p className="text-xs text-destructive font-medium">⚠ A soma dos NG ({totalDefeitosQty}) deve ser igual ao total NG ({quantidadeNg})</p>
                )}
              </div>
            )}

            {/* Parada de Linha - only Peça */}
            {isPeca && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5">
                  <Label>Parada de Linha</Label>
                  <Select value={paradaLinha} onValueChange={setParadaLinha} disabled={ngIsZero}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="nao">Não</SelectItem><SelectItem value="sim">Sim</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Tempo de Parada</Label>
                  {paradaLinha === "sim" ? <Input type="time" value={paradaLinhaTempo} onChange={(e) => setParadaLinhaTempo(e.target.value)} /> : <Input value="N/A" readOnly className="bg-muted" />}
                </div>
              </div>
            )}

            {(isPeca || isProcesso) && (
              <div className="space-y-1.5"><Label>Local de Detecção</Label><Input value={localDeteccao} onChange={(e) => setLocalDeteccao(e.target.value)} placeholder="Estação de Detecção" /></div>
            )}
            {(isPeca || isProcesso) && (
              <div className="space-y-1.5"><Label>VIN Number</Label><Input value={vinNumber} onChange={(e) => setVinNumber(e.target.value)} placeholder="Opcional" /></div>
            )}
            {(isPeca || isProcesso) && (
              <div className="space-y-1.5">
                <Label>Responsabilidade do Defeito</Label>
                <Select value={responsabilidadeDefeito} onValueChange={setResponsabilidadeDefeito}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{responsibilities.map((r) => <SelectItem key={r.id} value={`${r.code} - ${r.description}`}>{r.description}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            {isOem && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5">
                  <Label className={errLabelClass("localDeteccao")}>Local de Detecção *</Label>
                  <Select value={localDeteccao} onValueChange={(v) => { setLocalDeteccao(v); setValidationErrors((p) => { const n = new Set(p); n.delete("localDeteccao"); return n; }); }}>
                    <SelectTrigger className={errClass("localDeteccao")}><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{OEM_LOCAL_DETECCAO.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Lançamento *</Label>
                  <Select value={lancamento} onValueChange={setLancamento}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{OEM_LANCAMENTO.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Descrição - only when not multiple mode */}
            {ngMultiploDecisao !== "diferente" && (
              <div className="space-y-1.5">
                <Label className={errLabelClass("descricao")}>Descrição do Problema {!ngIsZero && "*"}</Label>
                <Textarea
                  value={descricao}
                  onChange={(e) => { setDescricao(e.target.value); setValidationErrors((p) => { const n = new Set(p); n.delete("descricao"); return n; }); }}
                  placeholder={ngIsZero ? "" : "Detalhar o problema/defeito encontrado"}
                  rows={3}
                  disabled={ngIsZero}
                  className={errClass("descricao")}
                />
              </div>
            )}

            {isOem && (
              <>
                <div className="space-y-1.5">
                  <Label className={errLabelClass("analiseInicial")}>Análise Inicial *</Label>
                  <Textarea value={analiseInicial} onChange={(e) => { setAnaliseInicial(e.target.value); setValidationErrors((p) => { const n = new Set(p); n.delete("analiseInicial"); return n; }); }} placeholder="Descrição obrigatória" rows={3} className={errClass("analiseInicial")} />
                </div>
                <div className="space-y-1.5">
                  <Label className={errLabelClass("acaoImediata")}>Ação Imediata *</Label>
                  <Textarea value={acaoImediata} onChange={(e) => { setAcaoImediata(e.target.value); setValidationErrors((p) => { const n = new Set(p); n.delete("acaoImediata"); return n; }); }} placeholder="Descrição obrigatória" rows={3} className={errClass("acaoImediata")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Comentário Adicional</Label>
                  <Textarea value={comentarioAdicional} onChange={(e) => setComentarioAdicional(e.target.value)} placeholder="Opcional" rows={2} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* 2° DEFEITO - Peça, Processo */}
        {(isPeca || isProcesso) && (
          <div className="form-section">
            <h2 className="form-section-title">2° Defeito</h2>
            <div className="space-y-3 sm:space-y-4">
              <Select value={temSegundoDefeito} onValueChange={(v) => { setTemSegundoDefeito(v); if (v === "nao") setSegundoDefeitos([]); }}>
                <SelectTrigger className="w-32 sm:w-40"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="nao">Não</SelectItem><SelectItem value="sim">Sim</SelectItem></SelectContent>
              </Select>
              {temSegundoDefeito === "sim" && (
                <>
                  {segundoDefeitos.map((sd, idx) => (
                    <div key={idx} className="border rounded-lg p-2 sm:p-3 space-y-2 sm:space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Defeito #{idx + 1}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeSegundoDefeito(idx)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                        <div className="space-y-1"><Label className="text-xs">Part Number</Label><Input value={sd.part_number} onChange={(e) => updateSegundoDefeito(idx, "part_number", e.target.value)} placeholder="Digitar PN" /></div>
                        <div className="space-y-1"><Label className="text-xs">Part Name</Label><Input value={sd.part_name} onChange={(e) => updateSegundoDefeito(idx, "part_name", e.target.value)} placeholder="Nome da peça" /></div>
                        <div className="space-y-1"><Label className="text-xs">Qty</Label><Input type="number" min={0} value={sd.qty} onChange={(e) => updateSegundoDefeito(idx, "qty", Number(e.target.value))} /></div>
                      </div>
                    </div>
                  ))}
                  {segundoDefeitos.length < 8 && <Button variant="outline" size="sm" onClick={addSegundoDefeito} className="gap-2"><Plus className="w-4 h-4" /> Adicionar Defeito</Button>}
                </>
              )}
            </div>
          </div>
        )}

        {/* FOTOS */}
        <div className="form-section">
          <h2 className="form-section-title">
            Foto do Defeito {!ngIsZero && "*"}
            {validationErrors.has("fotos") && <span className="text-destructive text-sm ml-2">(obrigatório)</span>}
          </h2>
          <p className="text-xs text-muted-foreground mb-2 sm:mb-3 text-center sm:text-left">Mínimo 1, máximo 4 fotos</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 justify-items-center sm:justify-items-stretch max-w-md sm:max-w-none mx-auto sm:mx-0 w-full">
            {existingPhotos.map((photo) => (
              <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden border">
                <img src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/checklist-photos/${photo.file_path}`} alt={photo.file_name} className="w-full h-full object-cover" />
              </div>
            ))}
            {photoPreviews.map((preview, idx) => (
              <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border">
                <img src={preview} alt={`Nova foto ${idx + 1}`} className="w-full h-full object-cover" />
                <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => removeNewPhoto(idx)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            ))}
            {(existingPhotos.length + photoFiles.length) < 4 && !ngIsZero && (
              <>
                <button
                  type="button"
                  onClick={() => setCameraOpen(true)}
                  className={`w-full aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:border-accent transition-colors ${validationErrors.has("fotos") ? "border-destructive" : "border-muted-foreground/30"}`}
                >
                  <Camera className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">Câmera</span>
                </button>
                {(existingPhotos.length + photoFiles.length) < 3 && (
                  <label className={`w-full aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:border-accent transition-colors ${validationErrors.has("fotos") ? "border-destructive" : "border-muted-foreground/30"}`}>
                    <ImagePlus className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground mb-1" />
                    <span className="text-xs text-muted-foreground">Galeria</span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoChange} />
                  </label>
                )}
              </>
            )}
          </div>
        </div>

        {/* TAG NUMBER - Incoming only (hidden when defeitos diferentes, since each defeito has its own tag) */}
        {isIncoming && ngMultiploDecisao !== "diferente" && (
          <div className="form-section">
            <h2 className="form-section-title flex items-center gap-2">
              <Tag className="w-4 h-4" /> Número da TAG
            </h2>
            {quantidadeNg === 0 ? (
              <Input value="N/A" readOnly className="bg-muted w-full sm:max-w-xs" />
            ) : (
              <div className="space-y-1.5">
                <Input
                  value={tagNumber}
                  onChange={(e) => setTagNumber(e.target.value)}
                  placeholder="Digite o número da TAG (opcional)"
                  className="w-full sm:max-w-md"
                />
                <p className="text-xs text-muted-foreground">
                  {tagNumber ? "" : "Se não preenchido, ficará como \"Aguardando número de TAG\""}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pb-6">
          <Button onClick={() => handleSave(false)} disabled={saving} className="gap-2 flex-1 sm:flex-none min-h-[44px]"><Save className="w-4 h-4" /> {saving ? "Salvando..." : isEdit ? "Atualizar" : "Finalizar"}</Button>
          <Button variant="outline" onClick={() => handleSave(true)} disabled={saving} className="gap-2 flex-1 sm:flex-none min-h-[44px]">Salvar Rascunho</Button>
          <Button variant="ghost" onClick={requestExit} className="flex-1 sm:flex-none min-h-[44px]">Cancelar</Button>
        </div>
      </main>

      {/* Validation Error Dialog */}
      <Dialog open={showValidationDialog} onOpenChange={setShowValidationDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="w-5 h-5" />Campos Obrigatórios</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Preencha os seguintes campos:</p>
            <ul className="list-disc pl-5 space-y-1">{validationMessages.map((msg, i) => <li key={i} className="text-sm font-medium text-destructive">{msg}</li>)}</ul>
          </div>
          <Button onClick={() => setShowValidationDialog(false)} className="w-full mt-2">Entendi</Button>
        </DialogContent>
      </Dialog>

      {/* NG Decision Dialog */}
      <Dialog open={showNgDecisionDialog} onOpenChange={setShowNgDecisionDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-500" />Múltiplas peças NG</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Foram apontadas {quantidadeNg} peças NG. Todas possuem o mesmo modo de falha?</p>
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={() => handleNgDecision("mesmo")} variant="outline" className="h-auto py-3 flex flex-col gap-1">
                <span className="font-semibold">Sim</span>
                <span className="text-xs text-muted-foreground">Mesmo defeito</span>
              </Button>
              <Button onClick={() => handleNgDecision("diferente")} variant="outline" className="h-auto py-3 flex flex-col gap-1">
                <span className="font-semibold">Não</span>
                <span className="text-xs text-muted-foreground">Defeitos diferentes</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Co-Inspeção Dialog */}
      <Dialog open={showCoInspetorDialog} onOpenChange={setShowCoInspetorDialog}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Selecionar Co-Inspetores</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={coInspetorSearch}
                onChange={(e) => setCoInspetorSearch(e.target.value)}
                placeholder="Buscar usuário..."
                className="pl-9"
                autoComplete="off"
              />
            </div>
            <div className="flex flex-wrap gap-2 min-h-[32px]">
              {coInspetores.map((name) => (
                <Badge key={name} variant="secondary" className="gap-1">
                  {name}
                  <button onClick={() => removeCoInspetor(name)}><X className="w-3 h-3" /></button>
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{coInspetores.length}/5 selecionados</p>
            <div className="border rounded-lg max-h-60 overflow-y-auto">
              {loadingCoInspetores ? (
                <div className="px-3 py-6 text-sm text-muted-foreground text-center flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Carregando inspetores...
                </div>
              ) : errorCoInspetores ? (
                <div className="px-3 py-4 text-sm text-center space-y-2">
                  <p className="text-destructive">Erro ao carregar lista de inspetores.</p>
                  <Button size="sm" variant="outline" onClick={() => refetchCoInspetores()} className="gap-1">
                    <Loader2 className="w-3 h-3" /> Tentar novamente
                  </Button>
                </div>
              ) : filteredProfiles.length > 0 ? filteredProfiles.map((p: any) => (
                <button
                  key={p.full_name}
                  type="button"
                  onClick={() => addCoInspetor(p.full_name)}
                  className="w-full text-left px-3 py-3 text-sm hover:bg-muted transition-colors border-b border-border/50 last:border-b-0 flex items-center justify-between"
                >
                  <span>{p.full_name} {p.turno && <span className="text-muted-foreground">({p.turno})</span>}</span>
                  {coInspetores.includes(p.full_name) && <Badge variant="outline" className="text-[10px]">Selecionado</Badge>}
                </button>
              )) : (
                <div className="px-3 py-3 text-sm text-muted-foreground text-center">Nenhum usuário encontrado</div>
              )}
            </div>
            <Button onClick={() => setShowCoInspetorDialog(false)} className="w-full">Confirmar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Suffix Picker Dialog */}
      <Dialog open={suffixPickerOpen} onOpenChange={setSuffixPickerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Selecionar Variante
            </DialogTitle>
            <DialogDescription className="text-sm">
              O Part Number lido possui variantes de cor/sufixo. Selecione o correto:
            </DialogDescription>
          </DialogHeader>
          <RadioGroup value={selectedSuffixPn} onValueChange={setSelectedSuffixPn} className="space-y-2">
            {suffixOptions.map((opt) => {
              const suffix = opt.part_number.replace(/-/g, "").slice(-3);
              return (
                <label
                  key={opt.part_number}
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    selectedSuffixPn === opt.part_number ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <RadioGroupItem value={opt.part_number} className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-sm">{opt.part_number}</span>
                      <Badge variant="outline" className="text-[10px]">{suffix}</Badge>
                    </div>
                    {opt.part_name && <p className="text-xs text-muted-foreground mt-0.5 truncate">{opt.part_name}</p>}
                    {opt.supplier_name && <p className="text-xs text-muted-foreground truncate">{opt.supplier_name}</p>}
                  </div>
                </label>
              );
            })}
          </RadioGroup>
          <Button
            onClick={() => {
              const selected = suffixOptions.find((o) => o.part_number === selectedSuffixPn);
              if (selected) applySuffixSelection(selected);
            }}
            disabled={!selectedSuffixPn}
            className="w-full mt-2"
          >
            Confirmar
          </Button>
        </DialogContent>
      </Dialog>

      {/* Re-scan Confirmation Dialog */}
      <Dialog open={showRescanConfirm} onOpenChange={setShowRescanConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Nova Leitura Detectada
            </DialogTitle>
            <DialogDescription className="text-sm">
              Já existe uma leitura carregada. O que deseja fazer?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border p-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Leitura atual</p>
              <p className="font-mono text-sm font-semibold">{partNumber}</p>
              {partName && <p className="text-xs text-muted-foreground">{partName}</p>}
            </div>
            {pendingQRData && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1">
                <p className="text-xs font-medium text-primary">Nova leitura</p>
                <p className="font-mono text-sm font-semibold">{pendingQRData.partNumber}</p>
                {pendingQRData.lotNumber && <p className="text-xs text-muted-foreground">Lote: {pendingQRData.lotNumber}</p>}
              </div>
            )}
            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={confirmRescan} className="w-full">
                Carregar nova leitura
              </Button>
              <Button onClick={cancelRescan} variant="outline" className="w-full">
                Manter leitura atual
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ALC Mismatch Dialog */}
      <Dialog
        open={showAlcMismatchDialog}
        onOpenChange={(open) => {
          if (!open && alcMismatchAttempts >= 3) {
            // 3ª tentativa: fechar no X descarta dados e volta para a tela de apontamentos
            setShowAlcMismatchDialog(false);
            try { clearFormAutosave(autosaveKey); } catch {}
            toast.info("Leitura descartada. Reinicie o apontamento.");
            navigate("/apontamentos");
            return;
          }
          setShowAlcMismatchDialog(open);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" /> Divergência de ALC
            </DialogTitle>
            <DialogDescription className="text-sm">
              O ALC lido na etiqueta diverge do cadastrado em Engenharia para este Part Number. Verifique fisicamente a peça antes de prosseguir.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {/* Attempt counter — pílulas 1·2·3 */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase">Leituras com o mesmo ALC divergente</p>
                <p className="text-[11px] font-bold">{Math.min(alcMismatchAttempts, 3)} / 3</p>
              </div>
              <div className="flex gap-1.5">
                {[1, 2, 3].map((n) => {
                  const reached = alcMismatchAttempts >= n;
                  const isFinal = n === 3;
                  return (
                    <div
                      key={n}
                      className={`flex-1 h-8 rounded-md border flex items-center justify-center text-xs font-bold ${
                        reached
                          ? isFinal
                            ? "bg-destructive text-destructive-foreground border-destructive"
                            : "bg-amber-500 text-white border-amber-600"
                          : "bg-background text-muted-foreground border-border"
                      }`}
                    >
                      {n}ª
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                {alcMismatchAttempts >= 3
                  ? "3ª leitura idêntica: a opção de reler foi removida — só é possível Confirmar erro de ALC."
                  : `Você pode reler até 2× mais. Na 3ª leitura com o mesmo ALC, o botão "Ler QR Code novamente" desaparece e resta apenas "Confirmar erro de ALC".`}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase">ALC lido</p>
                <p className="font-mono text-sm font-bold text-destructive">{alcMismatchScanned || "—"}</p>
              </div>
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase">ALC esperado</p>
                <p className="font-mono text-sm font-bold text-emerald-700">{alcExpected || "N/A"}</p>
              </div>
            </div>
            <div className="rounded-lg border p-3 bg-muted/30 space-y-0.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase">Part Number</p>
              <p className="font-mono text-sm">{partNumber || "—"}</p>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              {alcMismatchAttempts < 3 && (
                <Button
                  onClick={() => {
                    setShowAlcMismatchDialog(false);
                    alcRescanInProgress.current = true;
                    setTimeout(() => qrScannerRef.current?.openScanner(), 150);
                  }}
                  variant="outline"
                  className="w-full h-auto py-3 flex flex-col gap-0.5"
                >
                  <span className="font-semibold">Ler QR Code novamente</span>
                  <span className="text-[11px] text-muted-foreground font-normal">
                    {alcMismatchAttempts === 1
                      ? "1ª divergência — restam 2 releituras antes de bloquear"
                      : "2ª divergência — última releitura antes de bloquear"}
                  </span>
                </Button>
              )}
              <Button onClick={handleAlcConfirmError} variant="destructive" className="w-full h-auto py-3 flex flex-col gap-0.5">
                <span className="font-semibold">Confirmar erro de ALC</span>
                <span className="text-[11px] font-normal opacity-90">
                  {alcMismatchAttempts >= 3
                    ? "Mesma divergência confirmada 3× — abrir defeito NG"
                    : "Abre defeito NG e exige Modo de Falha"}
                </span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual ALC validation dialog (PC) */}
      <Dialog open={showAlcValidateDialog} onOpenChange={setShowAlcValidateDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Validar ALC manual</DialogTitle>
            <DialogDescription className="text-sm">
              Digite o ALC lido fisicamente na etiqueta para comparar com o ALC esperado em Engenharia.
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const checked = alcManualInput.trim().toUpperCase();
            const expected = (alcExpected || "").toUpperCase();
            const hasInput = checked.length > 0;
            const match = hasInput && checked === expected;
            const mismatch = hasInput && !match;
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border p-3 space-y-1 bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800">
                    <p className="text-[10px] font-semibold uppercase text-blue-700 dark:text-blue-300">ALC Esperado</p>
                    <p className="font-mono text-base font-bold text-blue-700 dark:text-blue-300">{expected || "—"}</p>
                  </div>
                  <div className={`rounded-lg border p-3 space-y-1 ${
                    match ? "bg-emerald-50 border-emerald-500 dark:bg-emerald-950/30"
                    : mismatch ? "bg-red-50 border-destructive dark:bg-red-950/30"
                    : "bg-muted/30"
                  }`}>
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">ALC Checado</p>
                    <Input
                      value={alcManualInput}
                      onChange={(e) => setAlcManualInput(e.target.value.toUpperCase())}
                      placeholder="Digite o ALC"
                      className={`font-mono text-base font-bold h-9 px-2 ${
                        match ? "text-emerald-700 border-emerald-500"
                        : mismatch ? "text-destructive border-destructive"
                        : ""
                      }`}
                      autoFocus
                    />
                  </div>
                </div>

                {match && (
                  <div className="rounded-md border border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 p-2 text-center">
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">✓ ALC confere com o cadastrado</p>
                  </div>
                )}
                {mismatch && (
                  <div className="rounded-md border border-destructive bg-red-50 dark:bg-red-950/30 p-2 text-center">
                    <p className="text-sm font-semibold text-destructive">✗ ALC divergente</p>
                  </div>
                )}

                <div className="flex flex-col gap-2 pt-1">
                  {match && (
                    <Button
                      variant="default"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => {
                        setAlcCode(checked);
                        setAlcStatus("match");
                        setValidationErrors((p) => { const n = new Set(p); n.delete("alcCode"); return n; });
                        setShowAlcValidateDialog(false);
                        toast.success("ALC validado com sucesso e registrado no checklist.");
                      }}
                    >
                      Registrar no checklist
                    </Button>
                  )}
                  {mismatch && (
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={() => {
                        setAlcCode(checked);
                        setAlcMismatchScanned(checked);
                        setAlcMismatchAttempts(1);
                        setShowAlcValidateDialog(false);
                        handleAlcConfirmError();
                      }}
                    >
                      Confirmar erro de ALC (abrir defeito NG)
                    </Button>
                  )}
                  <Button variant="outline" className="w-full" onClick={() => setShowAlcValidateDialog(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Image Annotation Editor */}
      <ImageAnnotationEditor
        open={!!annotatingFile}
        imageFile={annotatingFile}
        onConfirm={handleAnnotationConfirm}
        onCancel={handleAnnotationCancel}
      />

      {/* In-app camera (avoids Android WebView kill on capture intent) */}
      <InAppCamera
        open={cameraOpen}
        onCapture={handleInAppCapture}
        onClose={() => setCameraOpen(false)}
      />
      <AlertDialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair sem salvar?</AlertDialogTitle>
            <AlertDialogDescription>
              Os dados preenchidos no checklist serão descartados. Deseja realmente sair?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não, continuar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmExit} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sim, sair e descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ApontamentoForm;
