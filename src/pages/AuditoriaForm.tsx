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

type Conformidade = "conforme" | "nao_conforme" | "na" | "parcial";

const AuditoriaForm = () => {
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

  // Load existing auditoria for edit
  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ["auditoria-edit", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("auditorias").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: isEdit,
  });

  // Load existing responses for edit
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
      setTipo(existing.tipo);
      setTitulo(existing.titulo);
      setAuditor(existing.auditor);
      setData(existing.data);
      setSetor(existing.setor || "");
      setLinha(existing.linha || "");
      setFornecedor(existing.fornecedor || "");
      setObservacoes(existing.observacoes || "");
      setStatus(existing.status);
    }
  }, [existing]);

  useEffect(() => {
    if (existingResponses.length > 0) {
      const mapped: Record<string, { conformidade: Conformidade; observacao: string }> = {};
      existingResponses.forEach((r) => {
        mapped[r.audit_item_id] = {
          conformidade: (r.conformidade || "na") as Conformidade,
          observacao: r.observacao || "",
        };
      });
      setResponses(mapped);
    }
  }, [existingResponses]);

  const { data: auditItems = [] } = useQuery({
    queryKey: ["audit_items", tipo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_items")
        .select("*")
        .eq("audit_type", tipo)
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const categories = [...new Set(auditItems.map((i) => i.category))];

  const setResponse = (itemId: string, field: "conformidade" | "observacao", value: string) => {
    setResponses((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }));
  };

  const handleSave = async () => {
    if (!titulo || !auditor || !data) {
      toast.error("Preencha título, auditor e data");
      return;
    }
    setSaving(true);

    try {
      const answered = Object.values(responses);
      const total = answered.filter((r) => r.conformidade && r.conformidade !== "na").length;
      const obtained = answered.filter((r) => r.conformidade === "conforme").length +
        answered.filter((r) => r.conformidade === "parcial").length * 0.5;

      const payload = {
        tipo,
        titulo,
        auditor,
        data,
        setor: setor || null,
        linha: linha || null,
        fornecedor: fornecedor || null,
        observacoes: observacoes || null,
        status: isEdit ? status : "concluida",
        pontuacao_total: total,
        pontuacao_obtida: obtained,
      };

      if (isEdit) {
        const { error } = await supabase.from("auditorias").update(payload).eq("id", id!);
        if (error) throw error;

        // Delete old responses and insert new ones
        await supabase.from("audit_responses").delete().eq("auditoria_id", id!);

        const responsesToInsert = Object.entries(responses)
          .filter(([_, r]) => r.conformidade)
          .map(([itemId, r]) => ({
            auditoria_id: id!,
            audit_item_id: itemId,
            conformidade: r.conformidade,
            observacao: r.observacao || null,
            score: r.conformidade === "conforme" ? 1 : r.conformidade === "parcial" ? 0 : 0,
          }));

        if (responsesToInsert.length > 0) {
          const { error: respError } = await supabase.from("audit_responses").insert(responsesToInsert);
          if (respError) throw respError;
        }

        toast.success("Auditoria atualizada!");
      } else {
        const { data: auditoria, error } = await supabase
          .from("auditorias")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;

        const responsesToInsert = Object.entries(responses)
          .filter(([_, r]) => r.conformidade)
          .map(([itemId, r]) => ({
            auditoria_id: auditoria.id,
            audit_item_id: itemId,
            conformidade: r.conformidade,
            observacao: r.observacao || null,
            score: r.conformidade === "conforme" ? 1 : r.conformidade === "parcial" ? 0 : 0,
          }));

        if (responsesToInsert.length > 0) {
          const { error: respError } = await supabase.from("audit_responses").insert(responsesToInsert);
          if (respError) throw respError;
        }

        toast.success("Auditoria salva com sucesso!");
      }

      navigate("/auditorias");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const conformidadeColors: Record<string, string> = {
    conforme: "border-emerald-500 bg-emerald-500/10",
    nao_conforme: "border-red-500 bg-red-500/10",
    parcial: "border-amber-500 bg-amber-500/10",
    na: "border-muted bg-muted/10",
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
            <Button variant="ghost" size="sm" onClick={() => navigate("/auditorias")} className="text-primary-foreground/70 hover:text-primary-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <img src={logo} alt="Hyundai Mobis" className="h-8 object-contain bg-white rounded-md px-2 py-0.5" />
          </div>
          <div className="flex items-center gap-3 mt-4">
            <ShieldCheck className="w-8 h-8" />
            <h1 className="text-2xl font-heading font-bold">{isEdit ? "Editar Auditoria" : "Nova Auditoria"}</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6 max-w-4xl">
        <div className="form-section">
          <h2 className="form-section-title">Informações Gerais</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Auditoria</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="processo">Processo</SelectItem>
                  <SelectItem value="produto">Produto</SelectItem>
                  <SelectItem value="fornecedor">Fornecedor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isEdit && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aberta">Aberta</SelectItem>
                    <SelectItem value="em_andamento">Em Andamento</SelectItem>
                    <SelectItem value="concluida">Concluída</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Auditoria Linha 1 - Março" />
            </div>
            <div className="space-y-2">
              <Label>Auditor</Label>
              <Input value={auditor} onChange={(e) => setAuditor(e.target.value)} className={isEdit ? "" : "bg-muted"} readOnly={!isEdit} />
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            {tipo !== "fornecedor" && (
              <>
                <div className="space-y-2">
                  <Label>Setor</Label>
                  <Select value={setor} onValueChange={setSetor}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {setores.map((s) => (
                        <SelectItem key={s.id} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Linha</Label>
                  <Select value={linha} onValueChange={setLinha}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {linhas.map((l) => (
                        <SelectItem key={l.id} value={l.value}>{l.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            {tipo === "fornecedor" && (
              <SupplierPartSelector
                fornecedor={fornecedor}
                partNumber=""
                partName=""
                onFornecedorChange={setFornecedor}
                onPartNumberChange={() => {}}
                onPartDataChange={() => {}}
              />
            )}
          </div>
        </div>

        {categories.map((cat) => (
          <div key={cat} className="form-section">
            <h2 className="form-section-title">{cat}</h2>
            <div className="space-y-3">
              {auditItems
                .filter((i) => i.category === cat)
                .map((item) => {
                  const resp = responses[item.id];
                  return (
                    <div key={item.id} className={`rounded-lg border p-4 transition-colors ${resp?.conformidade ? conformidadeColors[resp.conformidade] : "border-border"}`}>
                      <p className="text-sm font-medium text-foreground mb-3">{item.description}</p>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {(["conforme", "parcial", "nao_conforme", "na"] as Conformidade[]).map((c) => (
                          <Button
                            key={c}
                            type="button"
                            size="sm"
                            variant={resp?.conformidade === c ? "default" : "outline"}
                            className="text-xs"
                            onClick={() => setResponse(item.id, "conformidade", c)}
                          >
                            {c === "conforme" ? "✓ Conforme" : c === "nao_conforme" ? "✗ Não Conforme" : c === "parcial" ? "◐ Parcial" : "N/A"}
                          </Button>
                        ))}
                      </div>
                      <Input
                        placeholder="Observação (opcional)"
                        className="text-sm"
                        value={resp?.observacao || ""}
                        onChange={(e) => setResponse(item.id, "observacao", e.target.value)}
                      />
                    </div>
                  );
                })}
            </div>
          </div>
        ))}

        <div className="form-section">
          <h2 className="form-section-title">Observações Gerais</h2>
          <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Observações adicionais..." rows={4} />
        </div>

        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="w-4 h-4" />
            {saving ? "Salvando..." : isEdit ? "Atualizar Auditoria" : "Salvar Auditoria"}
          </Button>
          <Button variant="outline" onClick={() => navigate("/auditorias")}>Cancelar</Button>
        </div>
      </main>
    </div>
  );
};

export default AuditoriaForm;
