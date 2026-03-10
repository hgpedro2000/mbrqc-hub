import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, ShieldCheck, Loader2 } from "lucide-react";
import { useDropdownOptions } from "@/hooks/useDropdownOptions";
import { useAuth } from "@/contexts/AuthContext";
import SupplierPartSelector from "@/components/SupplierPartSelector";
import { toast } from "sonner";
import logo from "@/assets/hyundai-mobis-logo.png";
import { useTranslation } from "react-i18next";

type Conformidade = "conforme" | "nao_conforme" | "na" | "parcial";

const AuditoriaForm = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const { profile } = useAuth();
  const [tipo, setTipo] = useState<string>("processo");
  const [titulo, setTitulo] = useState("");
  const [auditor, setAuditor] = useState(profile?.full_name || "");
  const [data, setData] = useState(new Date().toISOString().split("T")[0]);
  const [setor, setSetor] = useState("");
  const [linha, setLinha] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [status, setStatus] = useState("aberta");
  const [responses, setResponses] = useState<Record<string, { conformidade: Conformidade; observacao: string }>>({});
  const [saving, setSaving] = useState(false);

  const { data: setores = [] } = useDropdownOptions("setor");
  const { data: linhas = [] } = useDropdownOptions("linha");

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ["auditoria-edit", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("auditorias").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: isEdit,
  });

  const { data: existingResponses = [] } = useQuery({
    queryKey: ["auditoria-responses-edit", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_responses").select("*").eq("auditoria_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing) {
      setTipo(existing.tipo); setTitulo(existing.titulo); setAuditor(existing.auditor);
      setData(existing.data); setSetor(existing.setor || ""); setLinha(existing.linha || "");
      setFornecedor(existing.fornecedor || ""); setObservacoes(existing.observacoes || ""); setStatus(existing.status);
    }
  }, [existing]);

  useEffect(() => {
    if (existingResponses.length > 0) {
      const mapped: Record<string, { conformidade: Conformidade; observacao: string }> = {};
      existingResponses.forEach((r) => {
        mapped[r.audit_item_id] = { conformidade: (r.conformidade || "na") as Conformidade, observacao: r.observacao || "" };
      });
      setResponses(mapped);
    }
  }, [existingResponses]);

  const { data: auditItems = [] } = useQuery({
    queryKey: ["audit_items", tipo],
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_items").select("*").eq("audit_type", tipo).eq("active", true).order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const categories = [...new Set(auditItems.map((i) => i.category))];

  const setResponse = (itemId: string, field: "conformidade" | "observacao", value: string) => {
    setResponses((prev) => ({ ...prev, [itemId]: { ...prev[itemId], [field]: value } }));
  };

  const handleSave = async () => {
    if (!titulo || !auditor || !data) { toast.error(t("auditorias.fillRequired")); return; }
    setSaving(true);
    try {
      const answered = Object.values(responses);
      const total = answered.filter((r) => r.conformidade && r.conformidade !== "na").length;
      const obtained = answered.filter((r) => r.conformidade === "conforme").length + answered.filter((r) => r.conformidade === "parcial").length * 0.5;
      const payload = { tipo, titulo, auditor, data, setor: setor || null, linha: linha || null, fornecedor: fornecedor || null, observacoes: observacoes || null, status: isEdit ? status : "concluida", pontuacao_total: total, pontuacao_obtida: obtained };

      if (isEdit) {
        const { error } = await supabase.from("auditorias").update(payload).eq("id", id!);
        if (error) throw error;
        await supabase.from("audit_responses").delete().eq("auditoria_id", id!);
        const responsesToInsert = Object.entries(responses).filter(([_, r]) => r.conformidade).map(([itemId, r]) => ({ auditoria_id: id!, audit_item_id: itemId, conformidade: r.conformidade, observacao: r.observacao || null, score: r.conformidade === "conforme" ? 1 : 0 }));
        if (responsesToInsert.length > 0) { const { error: respError } = await supabase.from("audit_responses").insert(responsesToInsert); if (respError) throw respError; }
        toast.success(t("auditorias.updateSuccess"));
      } else {
        const { data: auditoria, error } = await supabase.from("auditorias").insert(payload).select().single();
        if (error) throw error;
        const responsesToInsert = Object.entries(responses).filter(([_, r]) => r.conformidade).map(([itemId, r]) => ({ auditoria_id: auditoria.id, audit_item_id: itemId, conformidade: r.conformidade, observacao: r.observacao || null, score: r.conformidade === "conforme" ? 1 : 0 }));
        if (responsesToInsert.length > 0) { const { error: respError } = await supabase.from("audit_responses").insert(responsesToInsert); if (respError) throw respError; }
        toast.success(t("auditorias.saveSuccess"));
      }
      navigate("/auditorias");
    } catch (err: any) { toast.error(err.message || "Erro ao salvar"); } finally { setSaving(false); }
  };

  const conformidadeColors: Record<string, string> = { conforme: "border-emerald-500 bg-emerald-500/10", nao_conforme: "border-red-500 bg-red-500/10", parcial: "border-amber-500 bg-amber-500/10", na: "border-muted bg-muted/10" };

  if (isEdit && loadingExisting) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/auditorias")} className="text-primary-foreground/70 hover:text-primary-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" /> {t("common.back")}
            </Button>
            <img src={logo} alt="Hyundai Mobis" className="h-8 object-contain bg-white rounded-md px-2 py-0.5" />
          </div>
          <div className="flex items-center gap-3 mt-4">
            <ShieldCheck className="w-8 h-8" />
            <h1 className="text-2xl font-heading font-bold">{isEdit ? t("auditorias.editAudit") : t("auditorias.newAudit")}</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6 max-w-4xl">
        <div className="form-section">
          <h2 className="form-section-title">{t("auditorias.generalInfo")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("auditorias.auditType")}</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="processo">{t("auditorias.process")}</SelectItem>
                  <SelectItem value="produto">{t("auditorias.product")}</SelectItem>
                  <SelectItem value="fornecedor">{t("auditorias.supplierType")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isEdit && (
              <div className="space-y-2">
                <Label>{t("common.status")}</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aberta">{t("auditorias.status.aberta")}</SelectItem>
                    <SelectItem value="em_andamento">{t("auditorias.status.em_andamento")}</SelectItem>
                    <SelectItem value="concluida">{t("auditorias.status.concluida")}</SelectItem>
                    <SelectItem value="cancelada">{t("auditorias.status.cancelada")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2"><Label>{t("common.title")}</Label><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
            <div className="space-y-2"><Label>{t("auditorias.auditor")}</Label><Input value={auditor} onChange={(e) => setAuditor(e.target.value)} className={isEdit ? "" : "bg-muted"} readOnly={!isEdit} /></div>
            <div className="space-y-2"><Label>{t("common.date")}</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
            {tipo !== "fornecedor" && (
              <>
                <div className="space-y-2">
                  <Label>{t("common.sector")}</Label>
                  <Select value={setor} onValueChange={setSetor}><SelectTrigger><SelectValue placeholder={t("common.select")} /></SelectTrigger><SelectContent>{setores.map((s) => <SelectItem key={s.id} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("common.line")}</Label>
                  <Select value={linha} onValueChange={setLinha}><SelectTrigger><SelectValue placeholder={t("common.select")} /></SelectTrigger><SelectContent>{linhas.map((l) => <SelectItem key={l.id} value={l.value}>{l.label}</SelectItem>)}</SelectContent></Select>
                </div>
              </>
            )}
            {tipo === "fornecedor" && (
              <SupplierPartSelector fornecedor={fornecedor} partNumber="" partName="" onFornecedorChange={setFornecedor} onPartNumberChange={() => {}} onPartDataChange={() => {}} />
            )}
          </div>
        </div>

        {categories.map((cat) => (
          <div key={cat} className="form-section">
            <h2 className="form-section-title">{cat}</h2>
            <div className="space-y-3">
              {auditItems.filter((i) => i.category === cat).map((item) => {
                const resp = responses[item.id];
                return (
                  <div key={item.id} className={`rounded-lg border p-4 transition-colors ${resp?.conformidade ? conformidadeColors[resp.conformidade] : "border-border"}`}>
                    <p className="text-sm font-medium text-foreground mb-3">{item.description}</p>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {(["conforme", "parcial", "nao_conforme", "na"] as Conformidade[]).map((c) => (
                        <Button key={c} type="button" size="sm" variant={resp?.conformidade === c ? "default" : "outline"} className="text-xs" onClick={() => setResponse(item.id, "conformidade", c)}>
                          {c === "conforme" ? t("auditorias.conformeBtn") : c === "nao_conforme" ? t("auditorias.naoConformeBtn") : c === "parcial" ? t("auditorias.parcialBtn") : t("auditorias.naBtn")}
                        </Button>
                      ))}
                    </div>
                    <Input placeholder={t("auditorias.obsPlaceholder")} className="text-sm" value={resp?.observacao || ""} onChange={(e) => setResponse(item.id, "observacao", e.target.value)} />
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="form-section">
          <h2 className="form-section-title">{t("auditorias.generalObs")}</h2>
          <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder={t("common.additionalObs")} rows={4} />
        </div>

        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="w-4 h-4" /> {saving ? t("common.saving") : isEdit ? t("auditorias.updateAudit") : t("auditorias.saveAudit")}
          </Button>
          <Button variant="outline" onClick={() => navigate("/auditorias")}>{t("common.cancel")}</Button>
        </div>
      </main>
    </div>
  );
};

export default AuditoriaForm;
