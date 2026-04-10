import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Loader2, Upload, ImageIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/hyundai-mobis-logo.png";
import { toast } from "sonner";

const AlertaQualidadeForm = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const ngInputRef = useRef<HTMLInputElement>(null);
  const okInputRef = useRef<HTMLInputElement>(null);
  const [ngFile, setNgFile] = useState<File | null>(null);
  const [okFile, setOkFile] = useState<File | null>(null);
  const [ngPreview, setNgPreview] = useState("");
  const [okPreview, setOkPreview] = useState("");

  const [form, setForm] = useState({
    modelo: "", modo_falha: "", linha_peca: "", local_detectado: "",
    data_ocorrencia: new Date().toISOString().split("T")[0],
    data_validade: "", turno: "Todos", descricao: "", responsabilidade: "",
    vin: "", observacoes: "", sequencia_bp: "", vin_bp: "",
  });

  const set = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const handleFile = (file: File | null, type: "ng" | "ok") => {
    if (!file) return;
    if (type === "ng") {
      setNgFile(file);
      setNgPreview(URL.createObjectURL(file));
    } else {
      setOkFile(file);
      setOkPreview(URL.createObjectURL(file));
    }
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
    if (!form.modo_falha || !form.local_detectado || !form.data_ocorrencia || !form.data_validade || !form.turno) {
      toast.error("Preencha todos os campos obrigatórios (*)");
      return;
    }
    setSaving(true);
    try {
      let foto_ng_url = "";
      let foto_ok_url = "";
      if (ngFile) foto_ng_url = await uploadPhoto(ngFile, "ng");
      if (okFile) foto_ok_url = await uploadPhoto(okFile, "ok");

      // Count inspetores for total_destinatarios
      const { count } = await supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "inspetor");

      const { error } = await supabase.from("alertas").insert({
        modelo: form.modelo,
        modo_falha: form.modo_falha,
        linha_peca: form.linha_peca,
        local_detectado: form.local_detectado,
        data_ocorrencia: form.data_ocorrencia,
        data_validade: form.data_validade,
        turno: form.turno,
        descricao: form.descricao,
        responsabilidade: form.responsabilidade,
        vin: form.vin,
        foto_ng_url,
        foto_ok_url,
        observacoes: form.observacoes,
        sequencia_bp: form.sequencia_bp,
        vin_bp: form.vin_bp,
        emitido_por: profile?.full_name || "",
        criado_por_id: user?.id,
        total_destinatarios: count || 0,
      } as any);

      if (error) throw error;
      toast.success("Alerta criado com sucesso!");
      navigate("/alerta-qualidade");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const requiredLabel = (text: string) => <span className="text-[#c0392b] font-bold text-xs uppercase">{text} *</span>;
  const normalLabel = (text: string) => <span className="text-[#1a5276] font-bold text-xs uppercase">{text}</span>;

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

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl space-y-4">
        {/* Grid 7 campos */}
        <div className="grid grid-cols-7 gap-3">
          <div className="space-y-1">
            {normalLabel("Modelo do Carro")}
            <Input value={form.modelo} onChange={(e) => set("modelo", e.target.value)} className="text-sm" />
          </div>
          <div className="space-y-1">
            {requiredLabel("Modo de Falha")}
            <Input value={form.modo_falha} onChange={(e) => set("modo_falha", e.target.value)} className="text-sm border-[#c0392b]/30" />
          </div>
          <div className="space-y-1">
            {normalLabel("Linha/Peça")}
            <Input value={form.linha_peca} onChange={(e) => set("linha_peca", e.target.value)} className="text-sm" />
          </div>
          <div className="space-y-1">
            {requiredLabel("Local Detectado")}
            <Input value={form.local_detectado} onChange={(e) => set("local_detectado", e.target.value)} className="text-sm border-[#c0392b]/30" />
          </div>
          <div className="space-y-1">
            {requiredLabel("Data Ocorrência")}
            <Input type="date" value={form.data_ocorrencia} onChange={(e) => set("data_ocorrencia", e.target.value)} className="text-sm border-[#c0392b]/30" />
          </div>
          <div className="space-y-1">
            {requiredLabel("Data Validade")}
            <Input type="date" value={form.data_validade} onChange={(e) => set("data_validade", e.target.value)} className="text-sm border-[#c0392b]/30" />
          </div>
          <div className="space-y-1">
            {requiredLabel("Turno")}
            <Select value={form.turno} onValueChange={(v) => set("turno", v)}>
              <SelectTrigger className="text-sm border-[#c0392b]/30"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                <SelectItem value="1º Turno">1º Turno</SelectItem>
                <SelectItem value="2º Turno">2º Turno</SelectItem>
                <SelectItem value="3º Turno">3º Turno</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Descrição e Responsabilidade */}
        <div className="grid grid-cols-7 gap-3">
          <div className="col-span-5 space-y-1">
            {normalLabel("Descrição")}
            <Textarea value={form.descricao} onChange={(e) => set("descricao", e.target.value)} className="min-h-[100px] text-sm" />
          </div>
          <div className="col-span-2 space-y-3">
            <div className="space-y-1">
              {requiredLabel("Responsabilidade")}
              <Input value={form.responsabilidade} onChange={(e) => set("responsabilidade", e.target.value)} className="text-sm border-[#c0392b]/30" />
            </div>
            <div className="space-y-1">
              {normalLabel("VIN")}
              <Input value={form.vin} onChange={(e) => set("vin", e.target.value)} className="text-sm" />
            </div>
          </div>
        </div>

        {/* Fotos NG / OK */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-[#c0392b] text-white text-xs font-bold px-3 py-1 rounded">NG</span>
              <span className="text-xs text-muted-foreground">Foto da não conformidade</span>
            </div>
            <div
              onClick={() => ngInputRef.current?.click()}
              className="border-[3px] border-[#c0392b] border-dashed rounded-lg min-h-[180px] flex items-center justify-center cursor-pointer hover:bg-[#c0392b]/5 transition-colors overflow-hidden"
            >
              {ngPreview ? (
                <img src={ngPreview} alt="NG" className="w-full h-full object-contain max-h-[200px]" />
              ) : (
                <div className="text-center text-muted-foreground">
                  <Upload className="w-8 h-8 mx-auto mb-1" />
                  <p className="text-xs">Clique para upload</p>
                </div>
              )}
            </div>
            <input ref={ngInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] || null, "ng")} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-[#1e8449] text-white text-xs font-bold px-3 py-1 rounded">OK</span>
              <span className="text-xs text-muted-foreground">Foto da referência correta</span>
            </div>
            <div
              onClick={() => okInputRef.current?.click()}
              className="border-[3px] border-[#1e8449] border-dashed rounded-lg min-h-[180px] flex items-center justify-center cursor-pointer hover:bg-[#1e8449]/5 transition-colors overflow-hidden"
            >
              {okPreview ? (
                <img src={okPreview} alt="OK" className="w-full h-full object-contain max-h-[200px]" />
              ) : (
                <div className="text-center text-muted-foreground">
                  <Upload className="w-8 h-8 mx-auto mb-1" />
                  <p className="text-xs">Clique para upload</p>
                </div>
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

        {/* Rodapé - Brake Point */}
        <div className="bg-[#c0392b] text-white rounded-lg p-3">
          <p className="text-xs font-bold mb-2">Brake Point</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <span className="text-[10px] opacity-80">Sequência</span>
              <Input value={form.sequencia_bp} onChange={(e) => set("sequencia_bp", e.target.value)} className="text-sm bg-white/10 border-white/20 text-white placeholder:text-white/40" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] opacity-80">VIN</span>
              <Input value={form.vin_bp} onChange={(e) => set("vin_bp", e.target.value)} className="text-sm bg-white/10 border-white/20 text-white placeholder:text-white/40" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] opacity-80">Emitido Por</span>
              <p className="text-sm font-medium text-[#1a5276] bg-white rounded px-2 py-1.5">{profile?.full_name || "—"}</p>
              <p className="text-[10px] text-[#c0392b] font-bold">{new Date().toLocaleDateString("pt-BR")}</p>
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end pt-2 pb-8">
          <Button onClick={handleSave} disabled={saving} className="gap-2 bg-[#1a5276] hover:bg-[#154360] min-w-[200px]">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Alerta
          </Button>
        </div>
      </main>
    </div>
  );
};

export default AlertaQualidadeForm;
