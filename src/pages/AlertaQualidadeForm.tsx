import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, AlertTriangle, Loader2 } from "lucide-react";
import { useDropdownOptions } from "@/hooks/useDropdownOptions";
import { useAuth } from "@/contexts/AuthContext";
import SupplierPartSelector from "@/components/SupplierPartSelector";
import { toast } from "sonner";
import logo from "@/assets/hyundai-mobis-logo.png";

const AlertaQualidadeForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    numero_alerta: `AQ-${Date.now().toString().slice(-6)}`,
    titulo: "",
    emitente: profile?.full_name || "",
    data_emissao: new Date().toISOString().split("T")[0],
    data_validade: "",
    setor: "",
    linha: "",
    part_number: "",
    part_name: "",
    fornecedor: "",
    descricao_problema: "",
    acao_imediata: "",
    acao_corretiva: "",
    responsavel: "",
    severidade: "media",
    status: "ativo",
    observacoes: "",
  });

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ["alerta-edit", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("alertas_qualidade").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        numero_alerta: existing.numero_alerta,
        titulo: existing.titulo,
        emitente: existing.emitente,
        data_emissao: existing.data_emissao,
        data_validade: existing.data_validade || "",
        setor: existing.setor || "",
        linha: existing.linha || "",
        part_number: existing.part_number || "",
        part_name: existing.part_name || "",
        fornecedor: existing.fornecedor || "",
        descricao_problema: existing.descricao_problema,
        acao_imediata: existing.acao_imediata || "",
        acao_corretiva: existing.acao_corretiva || "",
        responsavel: existing.responsavel || "",
        severidade: existing.severidade || "media",
        status: existing.status,
        observacoes: existing.observacoes || "",
      });
    }
  }, [existing]);

  const { data: setores = [] } = useDropdownOptions("setor");
  const { data: linhas = [] } = useDropdownOptions("linha");

  const set = (field: string, value: any) => setForm((p) => ({ ...p, [field]: value }));

  const handleSave = async () => {
    if (!form.titulo || !form.emitente || !form.descricao_problema) {
      toast.error("Preencha título, emitente e descrição do problema");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        data_validade: form.data_validade || null,
        setor: form.setor || null,
        linha: form.linha || null,
        fornecedor: form.fornecedor || null,
        acao_imediata: form.acao_imediata || null,
        acao_corretiva: form.acao_corretiva || null,
        responsavel: form.responsavel || null,
        observacoes: form.observacoes || null,
      };

      if (isEdit) {
        const { error } = await supabase.from("alertas_qualidade").update(payload).eq("id", id!);
        if (error) throw error;
        toast.success("Alerta atualizado!");
      } else {
        const { error } = await supabase.from("alertas_qualidade").insert(payload);
        if (error) throw error;
        toast.success("Alerta de qualidade emitido!");
      }
      navigate("/alerta-qualidade");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  if (isEdit && loadingExisting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/alerta-qualidade")} className="text-primary-foreground/70 hover:text-primary-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <img src={logo} alt="Hyundai Mobis" className="h-8 object-contain bg-white rounded-md px-2 py-0.5" />
          </div>
          <div className="flex items-center gap-3 mt-4">
            <AlertTriangle className="w-8 h-8" />
            <h1 className="text-2xl font-heading font-bold">{isEdit ? "Editar Alerta" : "Novo Alerta de Qualidade"}</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6 max-w-4xl">
        <div className="form-section">
          <h2 className="form-section-title">Identificação</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nº Alerta</Label>
              <Input value={form.numero_alerta} onChange={(e) => set("numero_alerta", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Severidade</Label>
              <Select value={form.severidade} onValueChange={(v) => set("severidade", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="critica">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isEdit && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="em_verificacao">Em Verificação</SelectItem>
                    <SelectItem value="encerrado">Encerrado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={form.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Título do alerta" />
            </div>
            <div className="space-y-2">
              <Label>Emitente</Label>
              <Input value={form.emitente} onChange={(e) => set("emitente", e.target.value)} className={isEdit ? "" : "bg-muted"} readOnly={!isEdit} />
            </div>
            <div className="space-y-2">
              <Label>Data Emissão</Label>
              <Input type="date" value={form.data_emissao} onChange={(e) => set("data_emissao", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Data Validade</Label>
              <Input type="date" value={form.data_validade} onChange={(e) => set("data_validade", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Setor</Label>
              <Select value={form.setor} onValueChange={(v) => set("setor", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {setores.map((s) => <SelectItem key={s.id} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Linha</Label>
              <Select value={form.linha} onValueChange={(v) => set("linha", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {linhas.map((l) => <SelectItem key={l.id} value={l.value}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <SupplierPartSelector
              fornecedor={form.fornecedor}
              partNumber={form.part_number}
              partName={form.part_name}
              onFornecedorChange={(v) => set("fornecedor", v)}
              onPartNumberChange={(v) => set("part_number", v)}
              onPartDataChange={(d) => set("part_name", d.part_name)}
            />
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Input value={form.responsavel} onChange={(e) => set("responsavel", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2 className="form-section-title">Problema e Ações</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Descrição do Problema</Label>
              <Textarea value={form.descricao_problema} onChange={(e) => set("descricao_problema", e.target.value)} placeholder="Descreva o problema em detalhes..." rows={4} />
            </div>
            <div className="space-y-2">
              <Label>Ação Imediata</Label>
              <Textarea value={form.acao_imediata} onChange={(e) => set("acao_imediata", e.target.value)} placeholder="Ação imediata tomada..." rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Ação Corretiva</Label>
              <Textarea value={form.acao_corretiva} onChange={(e) => set("acao_corretiva", e.target.value)} placeholder="Ação corretiva proposta..." rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} rows={3} />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="w-4 h-4" /> {saving ? "Salvando..." : isEdit ? "Atualizar" : "Emitir Alerta"}
          </Button>
          <Button variant="outline" onClick={() => navigate("/alerta-qualidade")}>Cancelar</Button>
        </div>
      </main>
    </div>
  );
};

export default AlertaQualidadeForm;
