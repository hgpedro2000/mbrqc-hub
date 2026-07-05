import { useState, useRef, useEffect } from "react";
import { getLocalDateString } from "@/lib/localDate";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Save, Loader2, Upload, CalendarIcon, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/hyundai-mobis-logo.png";
import { toast } from "sonner";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import ImageAnnotationEditor from "@/components/ImageAnnotationEditor";
import AutoFitText from "@/components/AutoFitText";
import { compressImage } from "@/lib/compressImage";
import { logAction } from "@/lib/logAction";

const AlertaQualidadeForm = () => {
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const isEdit = !!editId;
  const { user, profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string>("ativo");
  const ngInputRef = useRef<HTMLInputElement>(null);
  const okInputRef = useRef<HTMLInputElement>(null);
  const [ngFile, setNgFile] = useState<File | null>(null);
  const [okFile, setOkFile] = useState<File | null>(null);
  const [ngPreview, setNgPreview] = useState("");
  const [okPreview, setOkPreview] = useState("");
  const [linhaPecaOpen, setLinhaPecaOpen] = useState(false);
  const [linhaPecaStep, setLinhaPecaStep] = useState<"menu" | "fornecedor" | "peca">("menu");
  const [linhaPecaSearch, setLinhaPecaSearch] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
  const [ocorrenciaOpen, setOcorrenciaOpen] = useState(false);
  const [validadeOpen, setValidadeOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Image annotation editor state
  const [annotatingFile, setAnnotatingFile] = useState<File | null>(null);
  const [annotatingType, setAnnotatingType] = useState<"ng" | "ok">("ng");
  const [photoActionType, setPhotoActionType] = useState<"ng" | "ok" | null>(null);

  const [form, setForm] = useState({
    modelo: "", modo_falha: "", linha_peca: "", local_detectado: "",
    data_ocorrencia: getLocalDateString(),
    data_validade: "",
    turno: "Todos", descricao: "", responsabilidade: "",
    vin: "", observacoes: "", sequencia_bp: "", vin_bp: "",
  });

  // Load existing alert for editing
  useEffect(() => {
    if (!editId || loaded) return;
    (async () => {
      const { data, error } = await supabase.from("alertas").select("*").eq("id", editId).single();
      if (error || !data) { toast.error("Alerta não encontrado"); navigate("/alerta-qualidade"); return; }
      setForm({
        modelo: data.modelo || "", modo_falha: data.modo_falha || "", linha_peca: data.linha_peca || "",
        local_detectado: data.local_detectado || "", data_ocorrencia: data.data_ocorrencia || "",
        data_validade: data.data_validade || "", turno: data.turno || "Todos",
        descricao: data.descricao || "", responsabilidade: data.responsabilidade || "",
        vin: data.vin || "", observacoes: data.observacoes || "",
        sequencia_bp: data.sequencia_bp || "", vin_bp: data.vin_bp || "",
      });
      if (data.foto_ng_url) setNgPreview(data.foto_ng_url);
      if (data.foto_ok_url) setOkPreview(data.foto_ok_url);
      setCurrentStatus((data as any).status || "ativo");
      setLoaded(true);
    })();
  }, [editId, loaded, navigate]);

  useEffect(() => {
    if (form.data_ocorrencia && !isEdit) {
      const d = new Date(form.data_ocorrencia + "T12:00:00");
      const val = addMonths(d, 3);
      setForm(p => ({ ...p, data_validade: format(val, "yyyy-MM-dd") }));
    }
  }, [form.data_ocorrencia, isEdit]);

  const { data: projetos } = useQuery({
    queryKey: ["projetos-alerta"],
    queryFn: async () => {
      const { data } = await supabase.from("part_numbers").select("project").eq("active", true);
      return [...new Set((data || []).map(d => d.project).filter(Boolean))].sort();
    },
  });

  const { data: defeitos } = useQuery({
    queryKey: ["defeitos-alerta"],
    queryFn: async () => {
      const { data } = await supabase.from("defects").select("code, description").eq("active", true).order("code");
      return data || [];
    },
  });

  // Fetch suppliers filtered by selected project
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-alerta", form.modelo],
    queryFn: async () => {
      if (!form.modelo) return [];
      const { data: partData } = await supabase.from("part_numbers").select("supplier_id").eq("active", true).eq("project", form.modelo);
      const supplierIds = [...new Set((partData || []).map(p => p.supplier_id))];
      if (supplierIds.length === 0) return [];
      const { data } = await supabase.from("suppliers").select("id, name, code").eq("active", true).in("id", supplierIds);
      return (data || []).sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!form.modelo,
  });

  // Fetch part numbers filtered by selected supplier + project
  const { data: partNumbers = [] } = useQuery({
    queryKey: ["parts-alerta", form.modelo, selectedSupplier],
    queryFn: async () => {
      if (!form.modelo || !selectedSupplier) return [];
      const supplier = suppliers.find(s => s.name === selectedSupplier);
      if (!supplier) return [];
      const { data } = await supabase.from("part_numbers").select("part_number, part_name").eq("active", true).eq("project", form.modelo).eq("supplier_id", supplier.id);
      return (data || []).sort((a, b) => a.part_name.localeCompare(b.part_name));
    },
    enabled: !!form.modelo && !!selectedSupplier,
  });

  const { data: linhas } = useQuery({
    queryKey: ["linhas-alerta"],
    queryFn: async () => {
      const { data } = await supabase.from("part_numbers").select("line_module").eq("active", true);
      return [...new Set((data || []).map(d => d.line_module).filter(Boolean))].sort();
    },
  });

  const { data: responsabilidades } = useQuery({
    queryKey: ["responsabilidades-alerta"],
    queryFn: async () => {
      const { data } = await supabase.from("responsibilities").select("code, description").eq("active", true).order("code");
      return data || [];
    },
  });

  const set = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const handleFileSelected = async (file: File | null, type: "ng" | "ok") => {
    if (!file) return;
    const compressed = await compressImage(file);
    setAnnotatingFile(compressed);
    setAnnotatingType(type);
  };

  const handleAnnotationConfirm = (annotatedFile: File) => {
    if (annotatingType === "ng") {
      setNgFile(annotatedFile);
      setNgPreview(URL.createObjectURL(annotatedFile));
    } else {
      setOkFile(annotatedFile);
      setOkPreview(URL.createObjectURL(annotatedFile));
    }
    setAnnotatingFile(null);
  };

  const handleAnnotationCancel = () => {
    // Use image without annotation
    if (annotatingFile) {
      if (annotatingType === "ng") {
        setNgFile(annotatingFile);
        setNgPreview(URL.createObjectURL(annotatingFile));
      } else {
        setOkFile(annotatingFile);
        setOkPreview(URL.createObjectURL(annotatingFile));
      }
    }
    setAnnotatingFile(null);
  };

  const urlToFile = async (url: string, name = "image.jpg"): Promise<File> => {
    const res = await fetch(url);
    const blob = await res.blob();
    return new File([blob], name, { type: blob.type || "image/jpeg" });
  };

  const handleEditExisting = async () => {
    if (!photoActionType) return;
    const type = photoActionType;
    const existing = type === "ng" ? ngFile : okFile;
    const previewUrl = type === "ng" ? ngPreview : okPreview;
    setPhotoActionType(null);
    try {
      const file = existing || (previewUrl ? await urlToFile(previewUrl, `${type}.jpg`) : null);
      if (!file) return;
      setAnnotatingType(type);
      setAnnotatingFile(file);
    } catch {
      toast.error("Não foi possível carregar a imagem");
    }
  };

  const handleChangeExisting = () => {
    const type = photoActionType;
    setPhotoActionType(null);
    if (type === "ng") ngInputRef.current?.click();
    else if (type === "ok") okInputRef.current?.click();
  };

  const uploadPhoto = async (file: File, prefix: string) => {
    const ext = file.name.split(".").pop();
    const path = `${prefix}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("alertas-fotos").upload(path, file);
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("alertas-fotos").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleSave = async (mode: "rascunho" | "emitido" = "emitido") => {
    const isDraft = mode === "rascunho";
    const missing: string[] = [];
    if (!form.modelo) missing.push("Modelo do Carro");
    if (!form.modo_falha) missing.push("Modo de Falha");
    if (!form.linha_peca) missing.push("Linha/Peça");
    if (!form.local_detectado) missing.push("Local Detectado");
    if (!form.data_ocorrencia) missing.push("Data Ocorrência");
    if (!isDraft && !form.data_validade) missing.push("Data Validade");
    if (!form.turno) missing.push("Turno");
    if (!isDraft && !form.descricao) missing.push("Descrição");
    if (!isDraft && !form.responsabilidade) missing.push("Responsabilidade");
    if (!isDraft && !isEdit && !ngFile) missing.push("Foto NG");
    if (!isDraft && !isEdit && !okFile) missing.push("Foto OK");

    if (missing.length > 0) {
      toast.error(`Campos obrigatórios: ${missing.join(", ")}`);
      return;
    }
    if (isDraft) setSavingDraft(true); else setSaving(true);
    try {
      let foto_ng_url = ngPreview || "";
      let foto_ok_url = okPreview || "";
      if (ngFile) foto_ng_url = await uploadPhoto(ngFile, "ng");
      if (okFile) foto_ok_url = await uploadPhoto(okFile, "ok");

      const newStatus = isDraft ? "rascunho" : "ativo";

      if (isEdit) {
        const { error } = await supabase.from("alertas").update({
          modelo: form.modelo, modo_falha: form.modo_falha, linha_peca: form.linha_peca,
          local_detectado: form.local_detectado, data_ocorrencia: form.data_ocorrencia,
          data_validade: form.data_validade, turno: form.turno, descricao: form.descricao,
          responsabilidade: form.responsabilidade, vin: form.vin, foto_ng_url, foto_ok_url,
          observacoes: form.observacoes, sequencia_bp: form.sequencia_bp, vin_bp: form.vin_bp,
          status: newStatus,
        } as any).eq("id", editId!);
        if (error) throw error;
        logAction("update", "alerta_qualidade", {
          alerta_id: editId, modelo: form.modelo, linha_peca: form.linha_peca, status: newStatus,
        });
        toast.success(isDraft ? "Rascunho salvo!" : "Alerta emitido com sucesso!");
      } else {
        const { count } = await supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "inspetor");
        const { data: created, error } = await supabase.from("alertas").insert({
          modelo: form.modelo, modo_falha: form.modo_falha, linha_peca: form.linha_peca,
          local_detectado: form.local_detectado, data_ocorrencia: form.data_ocorrencia,
          data_validade: form.data_validade, turno: form.turno, descricao: form.descricao,
          responsabilidade: form.responsabilidade, vin: form.vin, foto_ng_url, foto_ok_url,
          observacoes: form.observacoes, sequencia_bp: form.sequencia_bp, vin_bp: form.vin_bp,
          emitido_por: profile?.full_name || "", criado_por_id: user?.id,
          total_destinatarios: count || 0,
          status: newStatus,
        } as any).select("id, sequencial").maybeSingle();
        if (error) throw error;
        logAction("create", "alerta_qualidade", {
          alerta_id: created?.id, sequencial: created?.sequencial,
          modelo: form.modelo, linha_peca: form.linha_peca, status: newStatus,
        });
        toast.success(isDraft ? "Rascunho salvo!" : "Alerta emitido com sucesso!");
      }
      navigate("/alerta-qualidade");
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); setSavingDraft(false); }
  };

  const reqLabel = (text: string) => (
    <span className="text-[#c0392b] font-bold text-[10px] sm:text-xs uppercase leading-tight block">{text} *</span>
  );
  const normLabel = (text: string) => (
    <span className="text-[#1a5276] font-bold text-[10px] sm:text-xs uppercase leading-tight block">{text}</span>
  );

  const parseDate = (s: string) => s ? new Date(s + "T12:00:00") : undefined;
  const formatDateBR = (s: string) => {
    if (!s) return "";
    return format(new Date(s + "T12:00:00"), "dd/MM/yyyy");
  };

  const filteredSuppliers = suppliers.filter(s => s.name.toLowerCase().includes(linhaPecaSearch.toLowerCase()) || s.code.toLowerCase().includes(linhaPecaSearch.toLowerCase()));
  const filteredParts = partNumbers.filter(p => p.part_name.toLowerCase().includes(linhaPecaSearch.toLowerCase()) || p.part_number.toLowerCase().includes(linhaPecaSearch.toLowerCase()));
  const filteredLinhas = (linhas || []).filter(l => l.toLowerCase().includes(linhaPecaSearch.toLowerCase()));

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-[#c0392b] text-white">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => navigate("/alerta-qualidade")} className="header-btn header-btn-back">
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <img src={logo} alt="Hyundai Mobis" className="h-6 sm:h-8 object-contain bg-white rounded-md px-2 py-0.5" />
          </div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold mt-2 text-center tracking-wide" style={{ fontFamily: "Arial, sans-serif" }}>
            {isEdit ? "EDITAR ALERTA DE QUALIDADE" : "ALERTA DE QUALIDADE"}
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-5xl lg:max-w-6xl xl:max-w-7xl space-y-4">
        {/* Row 1: Header fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2 sm:gap-3">
          <div className="space-y-1">
            {reqLabel("Modelo do Carro")}
            <Select value={form.modelo} onValueChange={(v) => set("modelo", v)}>
              <SelectTrigger className={cn("text-sm h-9", !form.modelo && "border-[#c0392b]/30")}><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {(projetos || []).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            {reqLabel("Modo de Falha")}
            <Select value={form.modo_falha} onValueChange={(v) => set("modo_falha", v)}>
              <SelectTrigger className={cn("text-sm h-9", !form.modo_falha && "border-[#c0392b]/30")}><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {(defeitos || []).map(d => <SelectItem key={d.code} value={d.description}>{d.description}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            {reqLabel("Linha/Peça")}
            <Button variant="outline" className={cn("w-full text-sm h-9 px-3 justify-start font-normal overflow-hidden", !form.linha_peca && "border-[#c0392b]/30")} onClick={() => { setLinhaPecaStep("menu"); setLinhaPecaSearch(""); setSelectedSupplier(null); setLinhaPecaOpen(true); }}>
              <AutoFitText text={form.linha_peca || "Selecione"} maxFontPx={14} minFontPx={9} className="text-left" />
            </Button>
          </div>

          <div className="space-y-1">
            {reqLabel("Local Detectado")}
            <Input value={form.local_detectado} onChange={(e) => set("local_detectado", e.target.value)} className={cn("text-sm h-9", !form.local_detectado && "border-[#c0392b]/30")} />
          </div>

          <div className="space-y-1">
            {reqLabel("Data Ocorrência")}
            <Popover open={ocorrenciaOpen} onOpenChange={setOcorrenciaOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full text-sm h-9 justify-start font-normal", !form.data_ocorrencia && "border-[#c0392b]/30 text-muted-foreground")}>
                  <CalendarIcon className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                  <span className="truncate">{form.data_ocorrencia ? formatDateBR(form.data_ocorrencia) : "Selecione"}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={parseDate(form.data_ocorrencia)} onSelect={(d) => { if (d) { set("data_ocorrencia", format(d, "yyyy-MM-dd")); setOcorrenciaOpen(false); } }} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1">
            {reqLabel("Data Validade")}
            <Popover open={validadeOpen} onOpenChange={setValidadeOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full text-sm h-9 justify-start font-normal", !form.data_validade && "border-[#c0392b]/30 text-muted-foreground")}>
                  <CalendarIcon className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                  <span className="truncate">{form.data_validade ? formatDateBR(form.data_validade) : "Selecione"}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={parseDate(form.data_validade)} onSelect={(d) => { if (d) { set("data_validade", format(d, "yyyy-MM-dd")); setValidadeOpen(false); } }} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1">
            {reqLabel("Turno")}
            <Select value={form.turno} onValueChange={(v) => set("turno", v)}>
              <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                <SelectItem value="1º Turno">1º Turno</SelectItem>
                <SelectItem value="2º Turno">2º Turno</SelectItem>
                <SelectItem value="3º Turno">3º Turno</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 2: Descrição + Responsabilidade/VIN */}
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-2 sm:gap-3">
          <div className="lg:col-span-5 space-y-1">
            {reqLabel("Descrição")}
            <Textarea value={form.descricao} onChange={(e) => set("descricao", e.target.value)} className={cn("min-h-[100px] text-sm", !form.descricao && "border-[#c0392b]/30")} />
          </div>
          <div className="lg:col-span-2 space-y-3">
            <div className="space-y-1">
              {reqLabel("Responsabilidade")}
              <Select value={form.responsabilidade} onValueChange={(v) => set("responsabilidade", v)}>
                <SelectTrigger className={cn("text-sm h-9", !form.responsabilidade && "border-[#c0392b]/30")}><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(responsabilidades || []).map(r => <SelectItem key={r.code} value={r.description}>{r.description}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              {normLabel("VIN")}
              <Input value={form.vin} onChange={(e) => set("vin", e.target.value)} className="text-sm h-9" />
            </div>
          </div>
        </div>

        {/* Fotos NG / OK */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-[#c0392b] text-white text-xs font-bold px-3 py-1 rounded">NG *</span>
              <span className="text-xs text-muted-foreground">Foto da não conformidade</span>
            </div>
            <div onClick={() => ngPreview ? setPhotoActionType("ng") : ngInputRef.current?.click()} className={cn("border-[3px] border-dashed rounded-lg min-h-[180px] flex items-center justify-center cursor-pointer hover:bg-[#c0392b]/5 transition-colors overflow-hidden", ngFile ? "border-[#c0392b]" : "border-[#c0392b]/40")}>
              {ngPreview ? <img src={ngPreview} alt="NG" className="w-full h-full object-contain max-h-[200px]" /> : (
                <div className="text-center text-muted-foreground"><Upload className="w-8 h-8 mx-auto mb-1" /><p className="text-xs">Clique para upload</p></div>
              )}
            </div>
            <input ref={ngInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelected(e.target.files?.[0] || null, "ng")} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-[#1e8449] text-white text-xs font-bold px-3 py-1 rounded">OK *</span>
              <span className="text-xs text-muted-foreground">Foto da referência correta</span>
            </div>
            <div onClick={() => okPreview ? setPhotoActionType("ok") : okInputRef.current?.click()} className={cn("border-[3px] border-dashed rounded-lg min-h-[180px] flex items-center justify-center cursor-pointer hover:bg-[#1e8449]/5 transition-colors overflow-hidden", okFile ? "border-[#1e8449]" : "border-[#1e8449]/40")}>
              {okPreview ? <img src={okPreview} alt="OK" className="w-full h-full object-contain max-h-[200px]" /> : (
                <div className="text-center text-muted-foreground"><Upload className="w-8 h-8 mx-auto mb-1" /><p className="text-xs">Clique para upload</p></div>
              )}
            </div>
            <input ref={okInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelected(e.target.files?.[0] || null, "ok")} />
          </div>
        </div>

        {/* Observações */}
        <div className="space-y-1">
          <span className="text-sm font-bold underline text-foreground">Observações:</span>
          <Textarea value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} className="min-h-[60px] text-sm text-[#c0392b] font-semibold" />
        </div>

        {/* Brake Point */}
        <div className="bg-[#c0392b] text-white rounded-lg p-3">
          <p className="text-xs font-bold mb-2">Brake Point</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <span className="text-[10px] opacity-80">Sequência</span>
              <Input value={form.sequencia_bp} onChange={(e) => set("sequencia_bp", e.target.value)} className="text-sm h-9 bg-white/10 border-white/20 text-white placeholder:text-white/40" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] opacity-80">VIN</span>
              <Input value={form.vin_bp} onChange={(e) => set("vin_bp", e.target.value)} className="text-sm h-9 bg-white/10 border-white/20 text-white placeholder:text-white/40" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] opacity-80">Emitido Por</span>
              <p className="text-sm font-medium text-[#1a5276] bg-white rounded px-2 py-1.5">{profile?.full_name || "—"}</p>
              <p className="text-[10px] text-white/80 font-bold">{new Date().toLocaleDateString("pt-BR")}</p>
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 pb-8">
          <Button
            type="button"
            onClick={() => handleSave("rascunho")}
            disabled={saving || savingDraft}
            className="gap-2 bg-amber-500 hover:bg-amber-600 text-white border-0 w-full sm:w-auto sm:min-w-[200px]"
          >
            {savingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Rascunho
          </Button>
          <Button
            type="button"
            onClick={() => handleSave("emitido")}
            disabled={saving || savingDraft}
            className="gap-2 bg-[#1a5276] hover:bg-[#154360] w-full sm:w-auto sm:min-w-[200px]"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEdit && currentStatus !== "rascunho" ? "Salvar Alterações" : "Emitir Alerta"}
          </Button>
        </div>
      </main>

      {/* Dialog Linha/Peça - Supplier → Part Number flow */}
      <Dialog open={linhaPecaOpen} onOpenChange={setLinhaPecaOpen}>
        <DialogContent className="max-w-sm sm:max-w-md p-0 max-h-[90dvh] flex flex-col">
          <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
            <DialogTitle>Selecionar Linha ou Peça</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col px-4 pb-4">
            {linhaPecaStep === "menu" ? (
              <div className="flex flex-col gap-3">
                <Button variant="outline" className="h-auto py-4 text-left flex flex-col items-start w-full" onClick={() => { setLinhaPecaStep("fornecedor"); setLinhaPecaSearch(""); }}>
                  <span className="font-bold text-[#1a5276]">PEÇA (por Fornecedor)</span>
                  <span className="text-xs text-muted-foreground">Selecione Fornecedor → Part Number</span>
                </Button>
                <Button variant="outline" className="h-auto py-4 text-left flex flex-col items-start w-full" onClick={() => {
                  // Direct line selection (legacy)
                  setLinhaPecaStep("peca");
                  setSelectedSupplier(null);
                  setLinhaPecaSearch("");
                }}>
                  <span className="font-bold text-[#1a5276]">LINHA (Módulo)</span>
                  <span className="text-xs text-muted-foreground">Selecionar da tabela de Módulos</span>
                </Button>
              </div>
            ) : linhaPecaStep === "fornecedor" ? (
              <div className="flex flex-col flex-1 min-h-0 gap-2">
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => { setLinhaPecaStep("menu"); setLinhaPecaSearch(""); }} className="header-btn header-btn-back">
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <span className="font-bold text-sm text-[#1a5276]">Selecione o Fornecedor</span>
                </div>
                {!form.modelo && (
                  <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5">Selecione o Modelo do Carro primeiro</p>
                )}
                <div className="relative shrink-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={linhaPecaSearch} onChange={(e) => setLinhaPecaSearch(e.target.value)} placeholder="Buscar fornecedor..." className="pl-9 h-9" autoFocus />
                </div>
                <ScrollArea className="flex-1 min-h-0" style={{ maxHeight: "calc(90dvh - 220px)" }}>
                  <div className="space-y-0.5">
                    {filteredSuppliers.map(s => (
                      <Button key={s.id} variant="ghost" size="sm" className="w-full justify-start text-sm h-10 font-normal" onClick={() => { setSelectedSupplier(s.name); setLinhaPecaStep("peca"); setLinhaPecaSearch(""); }}>
                        <span className="font-semibold mr-2 text-muted-foreground">{s.code}</span> {s.name}
                      </Button>
                    ))}
                    {filteredSuppliers.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhum fornecedor encontrado</p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="flex flex-col flex-1 min-h-0 gap-2">
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => {
                    if (selectedSupplier) { setLinhaPecaStep("fornecedor"); }
                    else { setLinhaPecaStep("menu"); }
                    setLinhaPecaSearch("");
                  }} className="px-2">
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <span className="font-bold text-sm text-[#1a5276]">
                    {selectedSupplier ? `${selectedSupplier} — Part Numbers` : "LINHA (Módulo)"}
                  </span>
                </div>
                <div className="relative shrink-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={linhaPecaSearch} onChange={(e) => setLinhaPecaSearch(e.target.value)} placeholder="Buscar..." className="pl-9 h-9" autoFocus />
                </div>
                <ScrollArea className="flex-1 min-h-0" style={{ maxHeight: "calc(90dvh - 220px)" }}>
                  <div className="space-y-0.5">
                    {selectedSupplier ? (
                      filteredParts.map(p => (
                        <Button key={p.part_number} variant="ghost" size="sm" className="w-full justify-start text-sm h-auto py-2 font-normal flex flex-col items-start" onClick={() => { set("linha_peca", p.part_name); setLinhaPecaOpen(false); }}>
                          <span className="font-semibold text-foreground">{p.part_number}</span>
                          <span className="text-xs text-muted-foreground">{p.part_name}</span>
                        </Button>
                      ))
                    ) : (
                      filteredLinhas.map(item => (
                        <Button key={item} variant="ghost" size="sm" className="w-full justify-start text-sm h-9 font-normal" onClick={() => { set("linha_peca", item); setLinhaPecaOpen(false); }}>
                          {item}
                        </Button>
                      ))
                    )}
                    {((selectedSupplier && filteredParts.length === 0) || (!selectedSupplier && filteredLinhas.length === 0)) && (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhum resultado</p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Annotation Editor */}
      {/* Photo action popup (Alterar / Editar) */}
      <Dialog open={!!photoActionType} onOpenChange={(o) => !o && setPhotoActionType(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Foto {photoActionType?.toUpperCase()}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button variant="outline" onClick={handleChangeExisting}>Alterar Imagem</Button>
            <Button onClick={handleEditExisting} className="bg-[#1a5276] hover:bg-[#154360]">Editar Imagem</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ImageAnnotationEditor
        open={!!annotatingFile}
        imageFile={annotatingFile}
        onConfirm={handleAnnotationConfirm}
        onCancel={handleAnnotationCancel}
      />
    </div>
  );
};

export default AlertaQualidadeForm;
