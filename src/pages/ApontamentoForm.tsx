import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, FileBarChart } from "lucide-react";
import { useDropdownOptions } from "@/hooks/useDropdownOptions";
import { useAuth } from "@/contexts/AuthContext";
import SupplierPartSelector from "@/components/SupplierPartSelector";
import { toast } from "sonner";
import logo from "@/assets/hyundai-mobis-logo.png";

const ApontamentoForm = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    tipo: "defeito_processo",
    titulo: "",
    responsavel: profile?.full_name || "",
    data: new Date().toISOString().split("T")[0],
    setor: "",
    linha: "",
    part_number: "",
    part_name: "",
    descricao: "",
    quantidade: 1,
    causa_raiz: "",
    acao_corretiva: "",
    responsavel_acao: "",
    prazo: "",
    severidade: "media",
    observacoes: "",
  });

  const { data: setores = [] } = useDropdownOptions("setor");
  const { data: linhas = [] } = useDropdownOptions("linha");

  const set = (field: string, value: any) => setForm((p) => ({ ...p, [field]: value }));

  const handleSave = async () => {
    if (!form.titulo || !form.responsavel || !form.descricao) {
      toast.error("Preencha título, responsável e descrição");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("apontamentos").insert({
        ...form,
        setor: form.setor || null,
        linha: form.linha || null,
        prazo: form.prazo || null,
        observacoes: form.observacoes || null,
        causa_raiz: form.causa_raiz || null,
        acao_corretiva: form.acao_corretiva || null,
        responsavel_acao: form.responsavel_acao || null,
      });
      if (error) throw error;
      toast.success("Apontamento registrado!");
      navigate("/apontamentos");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/apontamentos")} className="text-primary-foreground/70 hover:text-primary-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <img src={logo} alt="Hyundai Mobis" className="h-8 object-contain bg-white rounded-md px-2 py-0.5" />
          </div>
          <div className="flex items-center gap-3 mt-4">
            <FileBarChart className="w-8 h-8" />
            <h1 className="text-2xl font-heading font-bold">Novo Apontamento</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6 max-w-4xl">
        <div className="form-section">
          <h2 className="form-section-title">Identificação</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => set("tipo", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="defeito_processo">Defeito de Processo</SelectItem>
                  <SelectItem value="defeito_peca">Defeito de Peça</SelectItem>
                  <SelectItem value="parada_linha">Parada de Linha</SelectItem>
                </SelectContent>
              </Select>
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
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={form.titulo} onChange={(e) => set("titulo", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Input value={form.responsavel} readOnly className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={form.data} onChange={(e) => set("data", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input type="number" value={form.quantidade} onChange={(e) => set("quantidade", Number(e.target.value))} />
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
              fornecedor=""
              partNumber={form.part_number}
              partName={form.part_name}
              onFornecedorChange={() => {}}
              onPartNumberChange={(v) => set("part_number", v)}
              onPartDataChange={(d) => set("part_name", d.part_name)}
            />
          </div>
        </div>

        <div className="form-section">
          <h2 className="form-section-title">Descrição do Problema</h2>
          <Textarea value={form.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder="Descreva o defeito ou problema em detalhes..." rows={4} />
        </div>

        <div className="form-section">
          <h2 className="form-section-title">Análise e Ação Corretiva</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Causa Raiz</Label>
              <Textarea value={form.causa_raiz} onChange={(e) => set("causa_raiz", e.target.value)} placeholder="Análise da causa raiz..." rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Ação Corretiva</Label>
              <Textarea value={form.acao_corretiva} onChange={(e) => set("acao_corretiva", e.target.value)} placeholder="Ação corretiva proposta..." rows={3} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Responsável pela Ação</Label>
                <Input value={form.responsavel_acao} onChange={(e) => set("responsavel_acao", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Prazo</Label>
                <Input type="date" value={form.prazo} onChange={(e) => set("prazo", e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} rows={3} />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar"}
          </Button>
          <Button variant="outline" onClick={() => navigate("/apontamentos")}>Cancelar</Button>
        </div>
      </main>
    </div>
  );
};

export default ApontamentoForm;
