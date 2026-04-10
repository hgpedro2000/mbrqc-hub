import { useState, useRef, useEffect } from "react";
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

const AlertaQualidadeForm = () => {
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const isEdit = !!editId;
  const { user, profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const ngInputRef = useRef<HTMLInputElement>(null);
  const okInputRef = useRef<HTMLInputElement>(null);
  const [ngFile, setNgFile] = useState<File | null>(null);
  const [okFile, setOkFile] = useState<File | null>(null);
  const [ngPreview, setNgPreview] = useState("");
  const [okPreview, setOkPreview] = useState("");
  const [linhaPecaOpen, setLinhaPecaOpen] = useState(false);
  const [linhaPecaMode, setLinhaPecaMode] = useState<"menu" | "linha" | "peca">("menu");
  const [linhaPecaSearch, setLinhaPecaSearch] = useState("");
  const [ocorrenciaOpen, setOcorrenciaOpen] = useState(false);
  const [validadeOpen, setValidadeOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [form, setForm] = useState({
    modelo: "", modo_falha: "", linha_peca: "", local_detectado: "",
    data_ocorrencia: new Date().toISOString().split("T")[0],
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
      setLoaded(true);
    })();
  }, [editId, loaded, navigate]);

  useEffect(() => {
    if (form.data_ocorrencia && !isEdit) {
      const d = new Date(form.data_ocorrencia + "T12:00:00");
      const val = addMonths(d, 3);
      setForm(p => ({ ...p, data_validade: format(val, "yyyy-MM-dd") }));
    }
    }
  }, [form.data_ocorrencia]);

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

  const { data: linhas } = useQuery({
    queryKey: ["linhas-alerta"],
    queryFn: async () => {
      const { data } = await supabase.from("part_numbers").select("line_module").eq("active", true);
      return [...new Set((data || []).map(d => d.line_module).filter(Boolean))].sort();
    },
  });

  const { data: pecas } = useQuery({
    queryKey: ["pecas-alerta"],
    queryFn: async () => {
      const { data } = await supabase.from("part_numbers").select("part_name").eq("active", true);
      return [...new Set((data || []).map(d => d.part_name).filter(Boolean))].sort();
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

  const handleFile = (file: File | null, type: "ng" | "ok") => {
    if (!file) return;
    if (type === "ng") { setNgFile(file); setNgPreview(URL.createObjectURL(file)); }
    else { setOkFile(file); setOkPreview(URL.createObjectURL(file)); }
  };

  const uploadPhoto = async (file: File, prefix: string) => {
    const ext = file.name.split(".").pop();
    const path = `${prefix}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("alertas-fotos").upload(path, file);
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("alertas-fotos").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleSave = async () => {
    const missing: string[] = [];
    if (!form.modelo) missing.push("Modelo do Carro");
    if (!form.modo_falha) missing.push("Modo de Falha");
    if (!form.linha_peca) missing.push("Linha/Peça");
    if (!form.local_detectado) missing.push("Local Detectado");
    if (!form.data_ocorrencia) missing.push("Data Ocorrência");
    if (!form.data_validade) missing.push("Data Validade");
    if (!form.turno) missing.push("Turno");
    if (!form.descricao) missing.push("Descrição");
    if (!form.responsabilidade) missing.push("Responsabilidade");
    if (!ngFile) missing.push("Foto NG");
    if (!okFile) missing.push("Foto OK");

    if (missing.length > 0) {
      toast.error(`Campos obrigatórios: ${missing.join(", ")}`);
      return;
    }
    setSaving(true);
    try {
      let foto_ng_url = "";
      let foto_ok_url = "";
      if (ngFile) foto_ng_url = await uploadPhoto(ngFile, "ng");
      if (okFile) foto_ok_url = await uploadPhoto(okFile, "ok");
      const { count } = await supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "inspetor");
      const { error } = await supabase.from("alertas").insert({
        modelo: form.modelo, modo_falha: form.modo_falha, linha_peca: form.linha_peca,
        local_detectado: form.local_detectado, data_ocorrencia: form.data_ocorrencia,
        data_validade: form.data_validade, turno: form.turno, descricao: form.descricao,
        responsabilidade: form.responsabilidade, vin: form.vin, foto_ng_url, foto_ok_url,
        observacoes: form.observacoes, sequencia_bp: form.sequencia_bp, vin_bp: form.vin_bp,
        emitido_por: profile?.full_name || "", criado_por_id: user?.id,
        total_destinatarios: count || 0,
      } as any);
      if (error) throw error;
      toast.success("Alerta criado com sucesso!");
      navigate("/alerta-qualidade");
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
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

  const filteredLinhas = (linhas || []).filter(l => l.toLowerCase().includes(linhaPecaSearch.toLowerCase()));
  const filteredPecas = (pecas || []).filter(p => p.toLowerCase().includes(linhaPecaSearch.toLowerCase()));

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-[#c0392b] text-white">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => navigate("/alerta-qualidade")} className="text-white/80 hover:text-white px-2">
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <img src={logo} alt="Hyundai Mobis" className="h-6 sm:h-8 object-contain bg-white rounded-md px-2 py-0.5" />
          </div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold mt-2 text-center tracking-wide" style={{ fontFamily: "Arial, sans-serif" }}>
            ALERTA DE QUALIDADE
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-5xl space-y-4">
        {/* Row 1: Header fields */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3">
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
                {(defeitos || []).map(d => <SelectItem key={d.code} value={d.description}>{d.code} - {d.description}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            {reqLabel("Linha/Peça")}
            <Button variant="outline" className={cn("w-full text-sm h-9 justify-start font-normal truncate", !form.linha_peca && "border-[#c0392b]/30")} onClick={() => { setLinhaPecaMode("menu"); setLinhaPecaSearch(""); setLinhaPecaOpen(true); }}>
              {form.linha_peca || "Selecione"}
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

        {/* Row 2: Descrição + Responsabilidade/VIN - same 7-col grid */}
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
                  {(responsabilidades || []).map(r => <SelectItem key={r.code} value={r.description}>{r.code} - {r.description}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              {normLabel("VIN")}
              <Input value={form.vin} onChange={(e) => set("vin", e.target.value)} className="text-sm h-9" />
            </div>
          </div>
        </div>

        {/* Fotos NG / OK - obrigatórias */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-[#c0392b] text-white text-xs font-bold px-3 py-1 rounded">NG *</span>
              <span className="text-xs text-muted-foreground">Foto da não conformidade</span>
            </div>
            <div onClick={() => ngInputRef.current?.click()} className={cn("border-[3px] border-dashed rounded-lg min-h-[180px] flex items-center justify-center cursor-pointer hover:bg-[#c0392b]/5 transition-colors overflow-hidden", ngFile ? "border-[#c0392b]" : "border-[#c0392b]/40")}>
              {ngPreview ? <img src={ngPreview} alt="NG" className="w-full h-full object-contain max-h-[200px]" /> : (
                <div className="text-center text-muted-foreground"><Upload className="w-8 h-8 mx-auto mb-1" /><p className="text-xs">Clique para upload</p></div>
              )}
            </div>
            <input ref={ngInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] || null, "ng")} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-[#1e8449] text-white text-xs font-bold px-3 py-1 rounded">OK *</span>
              <span className="text-xs text-muted-foreground">Foto da referência correta</span>
            </div>
            <div onClick={() => okInputRef.current?.click()} className={cn("border-[3px] border-dashed rounded-lg min-h-[180px] flex items-center justify-center cursor-pointer hover:bg-[#1e8449]/5 transition-colors overflow-hidden", okFile ? "border-[#1e8449]" : "border-[#1e8449]/40")}>
              {okPreview ? <img src={okPreview} alt="OK" className="w-full h-full object-contain max-h-[200px]" /> : (
                <div className="text-center text-muted-foreground"><Upload className="w-8 h-8 mx-auto mb-1" /><p className="text-xs">Clique para upload</p></div>
              )}
            </div>
            <input ref={okInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] || null, "ok")} />
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
        <div className="flex justify-end pt-2 pb-8">
          <Button onClick={handleSave} disabled={saving} className="gap-2 bg-[#1a5276] hover:bg-[#154360] min-w-[200px]">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Alerta
          </Button>
        </div>
      </main>

      {/* Dialog Linha/Peça - Redesigned */}
      <Dialog open={linhaPecaOpen} onOpenChange={setLinhaPecaOpen}>
        <DialogContent className="max-w-sm sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Selecionar Linha ou Peça</DialogTitle>
          </DialogHeader>

          {linhaPecaMode === "menu" ? (
            <div className="flex flex-col gap-3">
              <Button variant="outline" className="h-auto py-4 text-left flex flex-col items-start w-full" onClick={() => setLinhaPecaMode("linha")}>
                <span className="font-bold text-[#1a5276]">LINHA (Módulo)</span>
                <span className="text-xs text-muted-foreground">Selecionar da tabela de Módulos</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 text-left flex flex-col items-start w-full" onClick={() => setLinhaPecaMode("peca")}>
                <span className="font-bold text-[#1a5276]">PEÇA (Part Name)</span>
                <span className="text-xs text-muted-foreground">Selecionar da tabela de Part Numbers</span>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setLinhaPecaMode("menu"); setLinhaPecaSearch(""); }} className="px-2">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <span className="font-bold text-sm text-[#1a5276]">
                  {linhaPecaMode === "linha" ? "LINHA (Módulo)" : "PEÇA (Part Name)"}
                </span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={linhaPecaSearch} onChange={(e) => setLinhaPecaSearch(e.target.value)} placeholder="Buscar..." className="pl-9 h-9" autoFocus />
              </div>
              <ScrollArea className="h-[250px]">
                <div className="space-y-0.5">
                  {(linhaPecaMode === "linha" ? filteredLinhas : filteredPecas).map(item => (
                    <Button key={item} variant="ghost" size="sm" className="w-full justify-start text-sm h-9 font-normal" onClick={() => { set("linha_peca", item); setLinhaPecaOpen(false); }}>
                      {item}
                    </Button>
                  ))}
                  {(linhaPecaMode === "linha" ? filteredLinhas : filteredPecas).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum resultado</p>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AlertaQualidadeForm;
