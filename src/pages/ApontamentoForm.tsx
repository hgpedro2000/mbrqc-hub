import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Loader2, FileBarChart, Plus, Trash2, Camera, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import SupplierPartSelector from "@/components/SupplierPartSelector";
import { toast } from "sonner";
import logo from "@/assets/hyundai-mobis-logo.png";
import { uploadPhotos } from "@/lib/uploadPhotos";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

const ApontamentoForm = () => {
  const navigate = useNavigate();
  const { id, tipo: paramTipo } = useParams();
  const isEdit = !!id;
  const { profile, user } = useAuth();

  const tipo = (isEdit ? undefined : paramTipo) as ApontamentoTipo | undefined;

  const [saving, setSaving] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [validationMessages, setValidationMessages] = useState<string[]>([]);

  // Form state
  const [formTipo, setFormTipo] = useState<ApontamentoTipo>(tipo || "incoming");
  const [data, setData] = useState(new Date().toISOString().split("T")[0]);
  const [turno, setTurno] = useState("");
  const [fase, setFase] = useState("");
  const [projeto, setProjeto] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [partName, setPartName] = useState("");
  const [modulo, setModulo] = useState("");
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
      setSegundoDefeitos(sd);
      setTemSegundoDefeito(sd.length > 0 ? "sim" : "nao");
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
    }
  }, [quantidadeNg, formTipo]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const totalPhotos = photoFiles.length + existingPhotos.length;
    const maxNew = 4 - totalPhotos;
    if (files.length > maxNew) {
      toast.error(`Máximo 4 fotos. Você pode adicionar mais ${maxNew}.`);
      return;
    }
    setPhotoFiles((prev) => [...prev, ...files]);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => setPhotoPreviews((prev) => [...prev, e.target?.result as string]);
      reader.readAsDataURL(file);
    });
  };

  const removeNewPhoto = (index: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const addSegundoDefeito = () => {
    if (segundoDefeitos.length >= 8) { toast.error("Máximo 8 linhas de 2° defeito"); return; }
    setSegundoDefeitos((prev) => [...prev, { part_number: "", part_name: "", qty: 0 }]);
  };

  const removeSegundoDefeito = (index: number) => {
    setSegundoDefeitos((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSegundoDefeito = (index: number, field: keyof SegundoDefeito, value: any) => {
    setSegundoDefeitos((prev) => prev.map((d, i) => i === index ? { ...d, [field]: value } : d));
  };

  // Helper for error class
  const errClass = (field: string) => validationErrors.has(field) ? "border-destructive ring-1 ring-destructive" : "";
  const errLabelClass = (field: string) => validationErrors.has(field) ? "text-destructive font-semibold" : "";

  const validate = (): boolean => {
    const errors = new Set<string>();
    const msgs: string[] = [];

    if (!data) { errors.add("data"); msgs.push("Data"); }
    if (!turno) { errors.add("turno"); msgs.push("Turno"); }
    if (!projeto) { errors.add("projeto"); msgs.push("Projeto"); }
    if (!fornecedor) { errors.add("fornecedor"); msgs.push("Fornecedor"); }
    if (!partNumber) { errors.add("partNumber"); msgs.push("Part Number"); }

    if (!isOem && !fase) { errors.add("fase"); msgs.push("Fase"); }
    if (isOem && !vinNumber) { errors.add("vinNumber"); msgs.push("VIN"); }

    if (isIncoming) {
      if (quantidadeInspecionada <= 0) { errors.add("quantidadeInspecionada"); msgs.push("Quantidade Inspecionada"); }
      if (!loteInspecionado) { errors.add("loteInspecionado"); msgs.push("Lote Inspecionado"); }
      if (quantidadeNg > 0 && !descricao) { errors.add("descricao"); msgs.push("Descrição do Problema"); }
      if (quantidadeNg > 0 && photoFiles.length === 0 && existingPhotos.length === 0) { errors.add("fotos"); msgs.push("Foto do Defeito (mínimo 1)"); }
    }

    if (isPeca) {
      if (quantidadeNg < 0) { errors.add("quantidadeNg"); msgs.push("Quantidade NG"); }
      if (!descricao) { errors.add("descricao"); msgs.push("Descrição do Problema"); }
      if (photoFiles.length === 0 && existingPhotos.length === 0) { errors.add("fotos"); msgs.push("Foto do Defeito (mínimo 1)"); }
    }

    if (isProcesso) {
      if (quantidadeNg <= 0) { errors.add("quantidadeNg"); msgs.push("Quantidade NG (deve ser > 0)"); }
      if (!descricao) { errors.add("descricao"); msgs.push("Descrição do Problema"); }
      if (photoFiles.length === 0 && existingPhotos.length === 0) { errors.add("fotos"); msgs.push("Foto do Defeito (mínimo 1)"); }
    }

    if (isOem) {
      if (!descricao) { errors.add("descricao"); msgs.push("Descrição do Problema"); }
      if (!localDeteccao) { errors.add("localDeteccao"); msgs.push("Local de Detecção"); }
      if (!analiseInicial) { errors.add("analiseInicial"); msgs.push("Análise Inicial"); }
      if (!acaoImediata) { errors.add("acaoImediata"); msgs.push("Ação Imediata"); }
      if (photoFiles.length === 0 && existingPhotos.length === 0) { errors.add("fotos"); msgs.push("Foto do Defeito (mínimo 1)"); }
    }

    setValidationErrors(errors);

    if (errors.size > 0) {
      setValidationMessages(msgs);
      setShowValidationDialog(true);
      return false;
    }

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
        responsavel: profile?.full_name || "Desconhecido",
        data,
        turno: turno || null,
        fase: fase || null,
        projeto: projeto || null,
        fornecedor: fornecedor || null,
        part_number: partNumber || null,
        part_name: partName || null,
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
        segundo_defeitos: temSegundoDefeito === "sim" ? segundoDefeitos : [],
        status: asDraft ? "draft" : "submitted",
        created_by: user?.id || null,
      };

      let recordId = id;

      if (isEdit) {
        const { error } = await supabase.from("apontamentos").update(payload).eq("id", id!);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase.from("apontamentos").insert(payload).select("id").single();
        if (error) throw error;
        recordId = inserted.id;
      }

      if (photoFiles.length > 0 && recordId) {
        await uploadPhotos(photoFiles, recordId, "apontamento");
      }

      toast.success(isEdit ? "Registro atualizado!" : asDraft ? "Rascunho salvo!" : "Registro finalizado!");
      navigate("/apontamentos");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  if (isEdit && loadingExisting) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;

  const isIncoming = formTipo === "incoming";
  const isPeca = formTipo === "peca";
  const isProcesso = formTipo === "processo";
  const isOem = formTipo === "oem";
  const ngIsZero = isIncoming && quantidadeNg === 0;
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-6">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/apontamentos")} className="text-primary-foreground/70 hover:text-primary-foreground px-2"><ArrowLeft className="w-4 h-4 sm:mr-1" /><span className="hidden sm:inline">Voltar</span></Button>
            <img src={logo} alt="Hyundai Mobis" className="h-5 sm:h-8 object-contain bg-white rounded-md px-2 py-0.5" />
          </div>
          <div className="flex items-center gap-2 mt-2 sm:mt-4">
            <FileBarChart className="w-5 h-5 sm:w-8 sm:h-8" />
            <h1 className="text-lg sm:text-2xl font-heading font-bold">
              {isEdit ? "Editar" : "Novo"} Apontamento — {typeLabels[formTipo]}
            </h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 max-w-4xl">
        {/* IDENTIFICAÇÃO */}
        <div className="form-section">
          <h2 className="form-section-title">Identificação</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            <div className="space-y-1.5">
              <Label className={errLabelClass("data")}>Data *</Label>
              <Input type="date" value={data} max={today} onChange={(e) => { setData(e.target.value); setValidationErrors((p) => { const n = new Set(p); n.delete("data"); return n; }); }} className={errClass("data")} />
            </div>
            <div className="space-y-1.5">
              <Label>Apontado por</Label>
              <Input value={profile?.full_name || ""} readOnly className="bg-muted" />
            </div>
            <div className="space-y-1.5">
              <Label className={errLabelClass("turno")}>Turno *</Label>
              <Select value={turno} onValueChange={(v) => { setTurno(v); setValidationErrors((p) => { const n = new Set(p); n.delete("turno"); return n; }); }}>
                <SelectTrigger className={errClass("turno")}><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{TURNOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {!isOem && (
              <div className="space-y-1.5">
                <Label className={errLabelClass("fase")}>Fase *</Label>
                <Select value={fase} onValueChange={(v) => { setFase(v); setValidationErrors((p) => { const n = new Set(p); n.delete("fase"); return n; }); }}>
                  <SelectTrigger className={errClass("fase")}><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{FASES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {isOem && (
              <div className="space-y-1.5">
                <Label className={errLabelClass("vinNumber")}>VIN *</Label>
                <Input value={vinNumber} onChange={(e) => { setVinNumber(e.target.value); setValidationErrors((p) => { const n = new Set(p); n.delete("vinNumber"); return n; }); }} placeholder="XXX 123456" className={errClass("vinNumber")} />
              </div>
            )}
          </div>

          {/* Fornecedor + Part Number via SupplierPartSelector (includes Projeto) */}
          <div className="mt-3 sm:mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <SupplierPartSelector
              fornecedor={fornecedor}
              partNumber={partNumber}
              partName={partName}
              projeto={projeto}
              modulo={modulo}
              onFornecedorChange={(v) => { setFornecedor(v); setValidationErrors((p) => { const n = new Set(p); n.delete("fornecedor"); return n; }); }}
              onPartNumberChange={(v) => { setPartNumber(v); setValidationErrors((p) => { const n = new Set(p); n.delete("partNumber"); return n; }); }}
              onPartDataChange={(d) => { setPartName(d.part_name); setModulo(d.line_module); setProjeto(d.project); setValidationErrors((p) => { const n = new Set(p); n.delete("projeto"); return n; }); }}
            />
          </div>
        </div>

        {/* QUANTIDADES - Incoming */}
        {isIncoming && (
          <div className="form-section">
            <h2 className="form-section-title">Quantidades</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="space-y-1.5">
                <Label className={errLabelClass("quantidadeInspecionada")}>Quantidade Inspecionada *</Label>
                <Input type="number" min={1} value={quantidadeInspecionada || ""} onChange={(e) => setQuantidadeInspecionada(e.target.value === "" ? 0 : Number(e.target.value))} className={errClass("quantidadeInspecionada")} />
              </div>
              <div className="space-y-1.5">
                <Label>Quantidade NG *</Label>
                <Input type="number" min={0} value={quantidadeNg || ""} onChange={(e) => setQuantidadeNg(e.target.value === "" ? 0 : Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Quantidade OK</Label>
                <Input type="number" value={quantidadeOk} readOnly className="bg-muted" />
              </div>
            </div>
            <div className="mt-3 sm:mt-4 space-y-1.5">
              <Label className={errLabelClass("loteInspecionado")}>Lote Inspecionado *</Label>
              <Input value={loteInspecionado} onChange={(e) => { setLoteInspecionado(e.target.value); setValidationErrors((p) => { const n = new Set(p); n.delete("loteInspecionado"); return n; }); }} placeholder="Ex: A1234" className={errClass("loteInspecionado")} />
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
          <h2 className="form-section-title">Detalhes do Defeito</h2>
          <div className="space-y-3 sm:space-y-4">
            {/* Modo de Falha */}
            {(isIncoming || isPeca || isProcesso) && (
              <div className="space-y-1.5">
                <Label>Modo de Falha {!ngIsZero && "*"}</Label>
                <Select value={modoFalha} onValueChange={setModoFalha} disabled={ngIsZero}>
                  <SelectTrigger><SelectValue placeholder={ngIsZero ? "N/A" : "Selecione"} /></SelectTrigger>
                  <SelectContent>{defects.map((d) => <SelectItem key={d.id} value={`${d.code} - ${d.description}`}>{d.code} - {d.description}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            {/* Parada de Linha - only Peça (removed from Incoming) */}
            {isPeca && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5">
                  <Label>Parada de Linha</Label>
                  <Select value={paradaLinha} onValueChange={setParadaLinha} disabled={ngIsZero}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nao">Não</SelectItem>
                      <SelectItem value="sim">Sim</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Tempo de Parada</Label>
                  {paradaLinha === "sim" ? (
                    <Input type="time" value={paradaLinhaTempo} onChange={(e) => setParadaLinhaTempo(e.target.value)} />
                  ) : (
                    <Input value="N/A" readOnly className="bg-muted" />
                  )}
                </div>
              </div>
            )}

            {/* Local de detecção - Peça, Processo */}
            {(isPeca || isProcesso) && (
              <div className="space-y-1.5">
                <Label>Local de Detecção</Label>
                <Input value={localDeteccao} onChange={(e) => setLocalDeteccao(e.target.value)} placeholder="Estação de Detecção" />
              </div>
            )}

            {/* VIN Number - Peça, Processo */}
            {(isPeca || isProcesso) && (
              <div className="space-y-1.5">
                <Label>VIN Number</Label>
                <Input value={vinNumber} onChange={(e) => setVinNumber(e.target.value)} placeholder="Opcional" />
              </div>
            )}

            {/* Responsabilidade do Defeito */}
            {(isPeca || isProcesso) && (
              <div className="space-y-1.5">
                <Label>Responsabilidade do Defeito</Label>
                <Select value={responsabilidadeDefeito} onValueChange={setResponsabilidadeDefeito}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{responsibilities.map((r) => <SelectItem key={r.id} value={`${r.code} - ${r.description}`}>{r.code} - {r.description}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            {/* Local de Detecção + Lançamento - OEM */}
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

            {/* Descrição */}
            <div className="space-y-1.5">
              <Label className={errLabelClass("descricao")}>Descrição do Problema {!ngIsZero && "*"}</Label>
              <Textarea value={descricao} onChange={(e) => { setDescricao(e.target.value); setValidationErrors((p) => { const n = new Set(p); n.delete("descricao"); return n; }); }} placeholder="Detalhar o problema/defeito encontrado" rows={3} disabled={ngIsZero} className={errClass("descricao")} />
            </div>

            {/* OEM specific fields */}
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
                <SelectContent>
                  <SelectItem value="nao">Não</SelectItem>
                  <SelectItem value="sim">Sim</SelectItem>
                </SelectContent>
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
                        <div className="space-y-1">
                          <Label className="text-xs">Part Number</Label>
                          <Input value={sd.part_number} onChange={(e) => updateSegundoDefeito(idx, "part_number", e.target.value)} placeholder="Digitar PN" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Part Name</Label>
                          <Input value={sd.part_name} onChange={(e) => updateSegundoDefeito(idx, "part_name", e.target.value)} placeholder="Nome da peça" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Qty</Label>
                          <Input type="number" min={0} value={sd.qty} onChange={(e) => updateSegundoDefeito(idx, "qty", Number(e.target.value))} />
                        </div>
                      </div>
                    </div>
                  ))}
                  {segundoDefeitos.length < 8 && (
                    <Button variant="outline" size="sm" onClick={addSegundoDefeito} className="gap-2"><Plus className="w-4 h-4" /> Adicionar Defeito</Button>
                  )}
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
          <p className="text-xs text-muted-foreground mb-2 sm:mb-3">Mínimo 1, máximo 4 fotos</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {existingPhotos.map((photo) => (
              <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden border">
                <img
                  src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/checklist-photos/${photo.file_path}`}
                  alt={photo.file_name}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
            {photoPreviews.map((preview, idx) => (
              <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border">
                <img src={preview} alt={`Nova foto ${idx + 1}`} className="w-full h-full object-cover" />
                <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => removeNewPhoto(idx)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
            {(existingPhotos.length + photoFiles.length) < 4 && !ngIsZero && (
              <label className={`aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:border-accent transition-colors ${validationErrors.has("fotos") ? "border-destructive" : "border-muted-foreground/30"}`}>
                <Camera className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground">Adicionar</span>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} />
              </label>
            )}
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pb-6">
          <Button onClick={() => handleSave(false)} disabled={saving} className="gap-2 flex-1 sm:flex-none min-h-[44px]">
            <Save className="w-4 h-4" /> {saving ? "Salvando..." : isEdit ? "Atualizar" : "Finalizar"}
          </Button>
          <Button variant="outline" onClick={() => handleSave(true)} disabled={saving} className="gap-2 flex-1 sm:flex-none min-h-[44px]">
            Salvar Rascunho
          </Button>
          <Button variant="ghost" onClick={() => navigate("/apontamentos")} className="flex-1 sm:flex-none min-h-[44px]">Cancelar</Button>
        </div>
      </main>

      {/* Validation Error Dialog */}
      <Dialog open={showValidationDialog} onOpenChange={setShowValidationDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Campos Obrigatórios
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Preencha os seguintes campos para finalizar:</p>
            <ul className="list-disc pl-5 space-y-1">
              {validationMessages.map((msg, i) => (
                <li key={i} className="text-sm font-medium text-destructive">{msg}</li>
              ))}
            </ul>
          </div>
          <Button onClick={() => setShowValidationDialog(false)} className="w-full mt-2">Entendi</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ApontamentoForm;
