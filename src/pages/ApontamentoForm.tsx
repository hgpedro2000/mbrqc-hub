import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, FileBarChart, Loader2 } from "lucide-react";
import { useDropdownOptions } from "@/hooks/useDropdownOptions";
import { useAuth } from "@/contexts/AuthContext";
import SupplierPartSelector from "@/components/SupplierPartSelector";
import { toast } from "sonner";
import logo from "@/assets/hyundai-mobis-logo.png";
<<<<<<< HEAD

const ApontamentoForm = () => {
=======
import { useTranslation } from "react-i18next";

const ApontamentoForm = () => {
  const { t } = useTranslation();
>>>>>>> 853a538787cf446c7d01e628ea96edf722a8086f
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
<<<<<<< HEAD
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
    status: "aberto",
    observacoes: "",
=======
    tipo: "defeito_processo", titulo: "", responsavel: profile?.full_name || "",
    data: new Date().toISOString().split("T")[0], setor: "", linha: "",
    part_number: "", part_name: "", descricao: "", quantidade: 1,
    causa_raiz: "", acao_corretiva: "", responsavel_acao: "", prazo: "",
    severidade: "media", status: "aberto", observacoes: "",
>>>>>>> 853a538787cf446c7d01e628ea96edf722a8086f
  });

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ["apontamento-edit", id],
<<<<<<< HEAD
    queryFn: async () => {
      const { data, error } = await supabase.from("apontamentos").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
=======
    queryFn: async () => { const { data, error } = await supabase.from("apontamentos").select("*").eq("id", id!).single(); if (error) throw error; return data; },
>>>>>>> 853a538787cf446c7d01e628ea96edf722a8086f
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing) {
<<<<<<< HEAD
      setForm({
        tipo: existing.tipo,
        titulo: existing.titulo,
        responsavel: existing.responsavel,
        data: existing.data,
        setor: existing.setor || "",
        linha: existing.linha || "",
        part_number: existing.part_number || "",
        part_name: existing.part_name || "",
        descricao: existing.descricao,
        quantidade: existing.quantidade || 1,
        causa_raiz: existing.causa_raiz || "",
        acao_corretiva: existing.acao_corretiva || "",
        responsavel_acao: existing.responsavel_acao || "",
        prazo: existing.prazo || "",
        severidade: existing.severidade || "media",
        status: existing.status,
        observacoes: existing.observacoes || "",
      });
=======
      setForm({ tipo: existing.tipo, titulo: existing.titulo, responsavel: existing.responsavel, data: existing.data, setor: existing.setor || "", linha: existing.linha || "", part_number: existing.part_number || "", part_name: existing.part_name || "", descricao: existing.descricao, quantidade: existing.quantidade || 1, causa_raiz: existing.causa_raiz || "", acao_corretiva: existing.acao_corretiva || "", responsavel_acao: existing.responsavel_acao || "", prazo: existing.prazo || "", severidade: existing.severidade || "media", status: existing.status, observacoes: existing.observacoes || "" });
>>>>>>> 853a538787cf446c7d01e628ea96edf722a8086f
    }
  }, [existing]);

  const { data: setores = [] } = useDropdownOptions("setor");
  const { data: linhas = [] } = useDropdownOptions("linha");
<<<<<<< HEAD

  const set = (field: string, value: any) => setForm((p) => ({ ...p, [field]: value }));

  const handleSave = async () => {
    if (!form.titulo || !form.responsavel || !form.descricao) {
      toast.error("Preencha título, responsável e descrição");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        setor: form.setor || null,
        linha: form.linha || null,
        prazo: form.prazo || null,
        observacoes: form.observacoes || null,
        causa_raiz: form.causa_raiz || null,
        acao_corretiva: form.acao_corretiva || null,
        responsavel_acao: form.responsavel_acao || null,
      };

      if (isEdit) {
        const { error } = await supabase.from("apontamentos").update(payload).eq("id", id!);
        if (error) throw error;
        toast.success("Apontamento atualizado!");
      } else {
        const { error } = await supabase.from("apontamentos").insert(payload);
        if (error) throw error;
        toast.success("Apontamento registrado!");
      }
      navigate("/apontamentos");
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
=======
  const set = (field: string, value: any) => setForm((p) => ({ ...p, [field]: value }));

  const handleSave = async () => {
    if (!form.titulo || !form.responsavel || !form.descricao) { toast.error(t("apontamentos.fillRequired")); return; }
    setSaving(true);
    try {
      const payload = { ...form, setor: form.setor || null, linha: form.linha || null, prazo: form.prazo || null, observacoes: form.observacoes || null, causa_raiz: form.causa_raiz || null, acao_corretiva: form.acao_corretiva || null, responsavel_acao: form.responsavel_acao || null };
      if (isEdit) { const { error } = await supabase.from("apontamentos").update(payload).eq("id", id!); if (error) throw error; toast.success(t("apontamentos.updateSuccess")); }
      else { const { error } = await supabase.from("apontamentos").insert(payload); if (error) throw error; toast.success(t("apontamentos.saveSuccess")); }
      navigate("/apontamentos");
    } catch (err: any) { toast.error(err.message || "Erro ao salvar"); } finally { setSaving(false); }
  };

  if (isEdit && loadingExisting) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
>>>>>>> 853a538787cf446c7d01e628ea96edf722a8086f

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
<<<<<<< HEAD
            <Button variant="ghost" size="sm" onClick={() => navigate("/apontamentos")} className="text-primary-foreground/70 hover:text-primary-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <img src={logo} alt="Hyundai Mobis" className="h-8 object-contain bg-white rounded-md px-2 py-0.5" />
          </div>
          <div className="flex items-center gap-3 mt-4">
            <FileBarChart className="w-8 h-8" />
            <h1 className="text-2xl font-heading font-bold">{isEdit ? "Editar Apontamento" : "Novo Apontamento"}</h1>
          </div>
=======
            <Button variant="ghost" size="sm" onClick={() => navigate("/apontamentos")} className="text-primary-foreground/70 hover:text-primary-foreground"><ArrowLeft className="w-4 h-4 mr-1" /> {t("common.back")}</Button>
            <img src={logo} alt="Hyundai Mobis" className="h-8 object-contain bg-white rounded-md px-2 py-0.5" />
          </div>
          <div className="flex items-center gap-3 mt-4"><FileBarChart className="w-8 h-8" /><h1 className="text-2xl font-heading font-bold">{isEdit ? t("apontamentos.editApontamento") : t("apontamentos.newApontamento")}</h1></div>
>>>>>>> 853a538787cf446c7d01e628ea96edf722a8086f
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6 max-w-4xl">
        <div className="form-section">
<<<<<<< HEAD
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
            {isEdit && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aberto">Aberto</SelectItem>
                    <SelectItem value="em_analise">Em Análise</SelectItem>
                    <SelectItem value="acao_definida">Ação Definida</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={form.titulo} onChange={(e) => set("titulo", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Input value={form.responsavel} onChange={(e) => set("responsavel", e.target.value)} className={isEdit ? "" : "bg-muted"} readOnly={!isEdit} />
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
=======
          <h2 className="form-section-title">{t("apontamentos.identification")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>{t("common.type")}</Label><Select value={form.tipo} onValueChange={(v) => set("tipo", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="defeito_processo">{t("apontamentos.defeitoProcesso")}</SelectItem><SelectItem value="defeito_peca">{t("apontamentos.defeitoPeca")}</SelectItem><SelectItem value="parada_linha">{t("apontamentos.paradaLinha")}</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>{t("common.severity")}</Label><Select value={form.severidade} onValueChange={(v) => set("severidade", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="baixa">{t("apontamentos.severity.baixa")}</SelectItem><SelectItem value="media">{t("apontamentos.severity.media")}</SelectItem><SelectItem value="alta">{t("apontamentos.severity.alta")}</SelectItem><SelectItem value="critica">{t("apontamentos.severity.critica")}</SelectItem></SelectContent></Select></div>
            {isEdit && (<div className="space-y-2"><Label>{t("common.status")}</Label><Select value={form.status} onValueChange={(v) => set("status", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="aberto">{t("apontamentos.status.aberto")}</SelectItem><SelectItem value="em_analise">{t("apontamentos.status.em_analise")}</SelectItem><SelectItem value="acao_definida">{t("apontamentos.status.acao_definida")}</SelectItem><SelectItem value="concluido">{t("apontamentos.status.concluido")}</SelectItem><SelectItem value="cancelado">{t("apontamentos.status.cancelado")}</SelectItem></SelectContent></Select></div>)}
            <div className="space-y-2"><Label>{t("common.title")}</Label><Input value={form.titulo} onChange={(e) => set("titulo", e.target.value)} /></div>
            <div className="space-y-2"><Label>{t("common.responsible")}</Label><Input value={form.responsavel} onChange={(e) => set("responsavel", e.target.value)} className={isEdit ? "" : "bg-muted"} readOnly={!isEdit} /></div>
            <div className="space-y-2"><Label>{t("common.date")}</Label><Input type="date" value={form.data} onChange={(e) => set("data", e.target.value)} /></div>
            <div className="space-y-2"><Label>{t("common.quantity")}</Label><Input type="number" value={form.quantidade} onChange={(e) => set("quantidade", Number(e.target.value))} /></div>
            <div className="space-y-2"><Label>{t("common.sector")}</Label><Select value={form.setor} onValueChange={(v) => set("setor", v)}><SelectTrigger><SelectValue placeholder={t("common.select")} /></SelectTrigger><SelectContent>{setores.map((s) => <SelectItem key={s.id} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>{t("common.line")}</Label><Select value={form.linha} onValueChange={(v) => set("linha", v)}><SelectTrigger><SelectValue placeholder={t("common.select")} /></SelectTrigger><SelectContent>{linhas.map((l) => <SelectItem key={l.id} value={l.value}>{l.label}</SelectItem>)}</SelectContent></Select></div>
            <SupplierPartSelector fornecedor="" partNumber={form.part_number} partName={form.part_name} onFornecedorChange={() => {}} onPartNumberChange={(v) => set("part_number", v)} onPartDataChange={(d) => set("part_name", d.part_name)} />
>>>>>>> 853a538787cf446c7d01e628ea96edf722a8086f
          </div>
        </div>

        <div className="form-section">
<<<<<<< HEAD
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
=======
          <h2 className="form-section-title">{t("apontamentos.problemDescription")}</h2>
          <Textarea value={form.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder={t("apontamentos.problemPlaceholder")} rows={4} />
        </div>

        <div className="form-section">
          <h2 className="form-section-title">{t("apontamentos.analysisAction")}</h2>
          <div className="space-y-4">
            <div className="space-y-2"><Label>{t("apontamentos.rootCause")}</Label><Textarea value={form.causa_raiz} onChange={(e) => set("causa_raiz", e.target.value)} placeholder={t("apontamentos.rootCausePlaceholder")} rows={3} /></div>
            <div className="space-y-2"><Label>{t("apontamentos.correctiveAction")}</Label><Textarea value={form.acao_corretiva} onChange={(e) => set("acao_corretiva", e.target.value)} placeholder={t("apontamentos.correctiveActionPlaceholder")} rows={3} /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>{t("apontamentos.actionResponsible")}</Label><Input value={form.responsavel_acao} onChange={(e) => set("responsavel_acao", e.target.value)} /></div>
              <div className="space-y-2"><Label>{t("apontamentos.deadline")}</Label><Input type="date" value={form.prazo} onChange={(e) => set("prazo", e.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label>{t("common.observations")}</Label><Textarea value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} rows={3} /></div>
>>>>>>> 853a538787cf446c7d01e628ea96edf722a8086f
          </div>
        </div>

        <div className="flex gap-3">
<<<<<<< HEAD
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="w-4 h-4" /> {saving ? "Salvando..." : isEdit ? "Atualizar" : "Salvar"}
          </Button>
          <Button variant="outline" onClick={() => navigate("/apontamentos")}>Cancelar</Button>
=======
          <Button onClick={handleSave} disabled={saving} className="gap-2"><Save className="w-4 h-4" /> {saving ? t("common.saving") : isEdit ? t("common.update") : t("common.save")}</Button>
          <Button variant="outline" onClick={() => navigate("/apontamentos")}>{t("common.cancel")}</Button>
>>>>>>> 853a538787cf446c7d01e628ea96edf722a8086f
        </div>
      </main>
    </div>
  );
};

export default ApontamentoForm;
