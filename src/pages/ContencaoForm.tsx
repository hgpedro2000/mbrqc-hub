import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, ShieldAlert } from "lucide-react";
import { useDropdownOptions } from "@/hooks/useDropdownOptions";
import { toast } from "sonner";
import logo from "@/assets/hyundai-mobis-logo.png";

const ContencaoForm = () => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    tipo: "interno_mbr",
    titulo: "",
    responsavel: "",
    data: new Date().toISOString().split("T")[0],
    setor: "",
    linha: "",
    part_number: "",
    part_name: "",
    fornecedor: "",
    quantidade_contida: 0,
    quantidade_aprovada: 0,
    quantidade_rejeitada: 0,
    motivo: "",
    acao_contencao: "",
    observacoes: "",
  });

  const { data: setores = [] } = useDropdownOptions("setor");
  const { data: linhas = [] } = useDropdownOptions("linha");

  const set = (field: string, value: any) => setForm((p) => ({ ...p, [field]: value }));

  const handleSave = async () => {
    if (!form.titulo || !form.responsavel) {
      toast.error("Preencha título e responsável");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("contencao").insert({
        ...form,
        setor: form.setor || null,
        linha: form.linha || null,
        fornecedor: form.fornecedor || null,
        observacoes: form.observacoes || null,
        motivo: form.motivo || null,
        acao_contencao: form.acao_contencao || null,
      });
      if (error) throw error;
      toast.success("Contenção registrada!");
      navigate("/contencao");
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
            <Button variant="ghost" size="sm" onClick={() => navigate("/contencao")} className="text-primary-foreground/70 hover:text-primary-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <img src={logo} alt="Hyundai Mobis" className="h-8 object-contain bg-white rounded-md px-2 py-0.5" />
          </div>
          <div className="flex items-center gap-3 mt-4">
            <ShieldAlert className="w-8 h-8" />
            <h1 className="text-2xl font-heading font-bold">Nova Contenção</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6 max-w-4xl">
        <div className="form-section">
          <h2 className="form-section-title">Informações Gerais</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => set("tipo", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="interno_mbr">Estoque Interno MBR</SelectItem>
                  <SelectItem value="externo_hmb">Externo HMB</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={form.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Descrição da contenção" />
            </div>
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Input value={form.responsavel} onChange={(e) => set("responsavel", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={form.data} onChange={(e) => set("data", e.target.value)} />
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
            <div className="space-y-2">
              <Label>Part Number</Label>
              <Input value={form.part_number} onChange={(e) => set("part_number", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Part Name</Label>
              <Input value={form.part_name} onChange={(e) => set("part_name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fornecedor</Label>
              <Input value={form.fornecedor} onChange={(e) => set("fornecedor", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2 className="form-section-title">Quantidades</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Qtd Contida</Label>
              <Input type="number" value={form.quantidade_contida} onChange={(e) => set("quantidade_contida", Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Qtd Aprovada</Label>
              <Input type="number" value={form.quantidade_aprovada} onChange={(e) => set("quantidade_aprovada", Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Qtd Rejeitada</Label>
              <Input type="number" value={form.quantidade_rejeitada} onChange={(e) => set("quantidade_rejeitada", Number(e.target.value))} />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2 className="form-section-title">Detalhes</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Textarea value={form.motivo} onChange={(e) => set("motivo", e.target.value)} placeholder="Motivo da contenção..." rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Ação de Contenção</Label>
              <Textarea value={form.acao_contencao} onChange={(e) => set("acao_contencao", e.target.value)} placeholder="Ação tomada..." rows={3} />
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
          <Button variant="outline" onClick={() => navigate("/contencao")}>Cancelar</Button>
        </div>
      </main>
    </div>
  );
};

export default ContencaoForm;
