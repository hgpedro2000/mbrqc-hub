import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Camera, Send, X, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uploadPhotos } from "@/lib/uploadPhotos";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import SupplierPartSelector from "@/components/SupplierPartSelector";
import { Separator } from "@/components/ui/separator";

interface DefectEntry {
  description: string;
  needs_improvement: boolean;
  improvement_category: string;
  failure_mode: string;
  photos: { name: string; url: string; file: File }[];
}

const InjectionForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const { profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const defectFileRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [photos, setPhotos] = useState<{ name: string; url: string; file: File }[]>([]);
  const [photoType, setPhotoType] = useState<string>("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const [fornecedor, setFornecedor] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [partName, setPartName] = useState("");
  const [projeto, setProjeto] = useState("");
  const [modulo, setModulo] = useState("");
  const [razaoTryout, setRazaoTryout] = useState("");
  const [razaoTryoutOutro, setRazaoTryoutOutro] = useState("");

  // Peças
  const [totalPecas, setTotalPecas] = useState<number>(0);
  const [pecasNG, setPecasNG] = useState<number>(0);
  const pecasOK = Math.max(0, totalPecas - pecasNG);
  const rate = totalPecas > 0 ? ((pecasOK / totalPecas) * 100).toFixed(1) : "0.0";

  // Defeitos
  const [defects, setDefects] = useState<DefectEntry[]>([]);

  // Edit mode defaults
  const [defaults, setDefaults] = useState<Record<string, any>>({});

  const { data: existing } = useQuery({
    queryKey: ["injection-edit", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("injection_checklists")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing) {
      setFornecedor(existing.fornecedor);
      setPartNumber(existing.part_number);
      setPartName(existing.part_name);
      setProjeto(existing.projeto);
      setModulo(existing.modulo);
      setTotalPecas((existing as any).total_pecas || 0);
      setPecasNG((existing as any).pecas_ng || 0);
      setRazaoTryout((existing as any).razao_tryout || "");
      setRazaoTryoutOutro((existing as any).razao_tryout_outro || "");
      const existingDefects = (existing as any).defects as any[] | undefined;
      if (existingDefects && existingDefects.length > 0) {
        setDefects(existingDefects.map((d: any) => ({
          description: d.description || "",
          needs_improvement: d.needs_improvement || false,
          improvement_category: d.improvement_category || "",
          failure_mode: d.failure_mode || "",
          photos: [],
        })));
      }
      setDefaults(existing);
    }
  }, [existing]);

  const handlePartDataChange = (data: { part_name: string; project: string; line_module: string }) => {
    setPartName(data.part_name);
    setProjeto(data.project);
    setModulo(data.line_module);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setPhotos((prev) => [...prev, ...Array.from(files).map((f) => ({ name: f.name, url: URL.createObjectURL(f), file: f }))]);
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Defect handlers
  const addDefect = () => {
    setDefects((prev) => [...prev, { description: "", needs_improvement: false, improvement_category: "", failure_mode: "", photos: [] }]);
  };

  const removeDefect = (index: number) => {
    setDefects((prev) => prev.filter((_, i) => i !== index));
  };

  const updateDefect = (index: number, field: keyof DefectEntry, value: any) => {
    setDefects((prev) => prev.map((d, i) => i === index ? { ...d, [field]: value } : d));
  };

  const addDefectPhoto = (defectIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newPhotos = Array.from(files).map((f) => ({ name: f.name, url: URL.createObjectURL(f), file: f }));
    setDefects((prev) => prev.map((d, i) => i === defectIndex ? { ...d, photos: [...d.photos, ...newPhotos] } : d));
  };

  const removeDefectPhoto = (defectIndex: number, photoIndex: number) => {
    setDefects((prev) => prev.map((d, i) => i === defectIndex ? { ...d, photos: d.photos.filter((_, pi) => pi !== photoIndex) } : d));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Validation: if NG > 0, at least one defect required
    if (pecasNG > 0 && defects.length === 0) {
      toast.error("É necessário registrar pelo menos um defeito quando há peças NG.");
      return;
    }

    // Validation: if NG = 0, photo required with type
    if (pecasNG === 0 && totalPecas > 0 && photos.length === 0) {
      toast.error("É necessário inserir pelo menos uma foto de Peça OK.");
      return;
    }
    if (pecasNG === 0 && totalPecas > 0 && !photoType) {
      toast.error("Selecione o tipo de foto (Peça Referência ou Peça Final).");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const payload: Record<string, any> = {
        nome: profile?.full_name || (formData.get("nome") as string),
        data: formData.get("data") as string,
        fornecedor,
        projeto,
        part_number: partNumber,
        part_name: partName,
        modulo,
        qtd_tryout: Number(formData.get("qtdTryout")),
        materia_prima: formData.get("materiaPrima") as string,
        injetora: formData.get("injetora") as string,
        tonelagem: Number(formData.get("tonelagem")),
        cycle_time: Number(formData.get("cycleTime")),
        cooling_time: Number(formData.get("coolingTime")),
        weight: Number(formData.get("weight")),
        dimensional: formData.get("dimensional") as string,
        comentarios: (formData.get("comentarios") as string) || null,
        razao_tryout: razaoTryout,
        razao_tryout_outro: razaoTryoutOutro,
        total_pecas: totalPecas,
        pecas_ok: pecasOK,
        pecas_ng: pecasNG,
        rate: totalPecas > 0 ? parseFloat(((pecasOK / totalPecas) * 100).toFixed(2)) : 0,
        needs_improvement: defects.some(d => d.needs_improvement),
        improvement_category: null,
        defects: defects.map((d) => ({
          description: d.description,
          needs_improvement: d.needs_improvement,
          improvement_category: d.needs_improvement ? d.improvement_category : null,
          failure_mode: d.failure_mode || null,
        })),
      };

      let recordId: string;

      if (isEdit) {
        const { error } = await supabase.from("injection_checklists").update(payload as any).eq("id", id!);
        if (error) throw error;
        recordId = id!;
      } else {
        const { data, error } = await supabase.from("injection_checklists").insert(payload as any).select("id").single();
        if (error) throw error;
        recordId = data.id;
      }

      // Upload general photos
      if (photos.length > 0) {
        await uploadPhotos(photos.map((p) => p.file), recordId, "injection");
      }

      // Upload defect photos
      for (const defect of defects) {
        if (defect.photos.length > 0) {
          await uploadPhotos(defect.photos.map((p) => p.file), recordId, "injection");
        }
      }

      setSubmitted(true);
      toast.success(isEdit ? "Checklist atualizado!" : "Checklist enviado com sucesso!");
      setTimeout(() => navigate("/tryout/registros"), 2000);
    } catch (error: any) {
      console.error("Submit error:", error);
      toast.error("Erro ao enviar checklist", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center opacity-0 animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10 text-success" />
          </div>
          <h2 className="text-2xl font-heading font-bold text-foreground">{isEdit ? "Atualizado!" : "Enviado!"}</h2>
          <p className="text-muted-foreground mt-2">Redirecionando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-4 py-6">
          <button
            onClick={() => navigate("/tryout")}
            className="flex items-center gap-2 text-primary-foreground/70 hover:text-primary-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Voltar</span>
          </button>
          <h1 className="text-2xl md:text-3xl font-heading font-bold">
            {isEdit ? "Editar Checklist de Injeção" : "Processo de Injeção Plástica"}
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identificação */}
          <div className="form-section">
            <h3 className="form-section-title">Identificação</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input id="nome" name="nome" required value={profile?.full_name || ""} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data">Data *</Label>
                <Input id="data" name="data" type="date" required defaultValue={defaults.data || ""} key={defaults.data || "new"} />
              </div>
              <SupplierPartSelector
                fornecedor={fornecedor}
                partNumber={partNumber}
                partName={partName}
                projeto={projeto}
                modulo={modulo}
                onFornecedorChange={setFornecedor}
                onPartNumberChange={setPartNumber}
                onPartDataChange={handlePartDataChange}
              />
            </div>
          </div>

          {/* Dados da Peça */}
          <div className="form-section">
            <h3 className="form-section-title">Dados da Peça</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Razão do Tryout *</Label>
                <Select value={razaoTryout} onValueChange={(v) => { setRazaoTryout(v); if (v !== "Outro") setRazaoTryoutOutro(""); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione a razão" /></SelectTrigger>
                  <SelectContent>
                    {["EO", "4M", "Melhoria", "Correção", "Novo Carro", "Outro"].map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{razaoTryout === "Outro" ? "Especifique *" : "Detalhe (opcional)"}</Label>
                <Input
                  placeholder={razaoTryout === "Outro" ? "Descreva a razão..." : "Detalhe adicional..."}
                  value={razaoTryoutOutro}
                  onChange={(e) => setRazaoTryoutOutro(e.target.value)}
                  required={razaoTryout === "Outro"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qtdTryout">Quantas vezes esse Tryout foi feito?*</Label>
                <Select name="qtdTryout" required defaultValue={defaults.qtd_tryout?.toString() || ""} key={`qt-${defaults.qtd_tryout}`}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1ª</SelectItem>
                    <SelectItem value="2">2ª</SelectItem>
                    <SelectItem value="3">3ª</SelectItem>
                    <SelectItem value="4">4ª</SelectItem>
                    <SelectItem value="5">5ª</SelectItem>
                    <SelectItem value="6">6ª</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="totalPecas">Total de Peças no Tryout *</Label>
                <Input id="totalPecas" type="number" required min={0} placeholder="0" value={totalPecas || ""} onChange={(e) => setTotalPecas(Number(e.target.value) || 0)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pecasNG">Peças NG *</Label>
                <Input id="pecasNG" type="number" required min={0} max={totalPecas} placeholder="0" value={pecasNG || ""} onChange={(e) => setPecasNG(Math.min(Number(e.target.value) || 0, totalPecas))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pecasOK">Peças OK</Label>
                <Input id="pecasOK" type="number" value={pecasOK} readOnly className="bg-muted font-semibold text-accent" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="rate">Rate (%)</Label>
                <div className="flex items-center gap-3">
                  <Input id="rate" type="text" value={`${rate}%`} readOnly className="bg-muted font-semibold text-accent max-w-[160px]" />
                  <div className="h-3 flex-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-300"
                      style={{ width: `${Math.min(parseFloat(rate), 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Parâmetros de Processo */}
          <div className="form-section">
            <h3 className="form-section-title">Parâmetros de Processo</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="materiaPrima">Matéria-Prima *</Label>
                <Input id="materiaPrima" name="materiaPrima" required placeholder="Tipo de material" defaultValue={defaults.materia_prima || ""} key={`mp-${defaults.materia_prima}`} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="injetora">Injetora *</Label>
                <Input id="injetora" name="injetora" required placeholder="Identificação da injetora" defaultValue={defaults.injetora || ""} key={`inj-${defaults.injetora}`} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tonelagem">Tonelagem da Máquina *</Label>
                <Input id="tonelagem" name="tonelagem" type="number" required placeholder="Em toneladas" defaultValue={defaults.tonelagem || ""} key={`ton-${defaults.tonelagem}`} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cycleTime">Cycle Time (s) *</Label>
                <Input id="cycleTime" name="cycleTime" type="number" step="0.1" required placeholder="Segundos" defaultValue={defaults.cycle_time || ""} key={`ct-${defaults.cycle_time}`} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coolingTime">Cooling Time (s) *</Label>
                <Input id="coolingTime" name="coolingTime" type="number" step="0.1" required placeholder="Segundos" defaultValue={defaults.cooling_time || ""} key={`cool-${defaults.cooling_time}`} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weight">Weight (g) *</Label>
                <Input id="weight" name="weight" type="number" step="0.01" required placeholder="Gramas" defaultValue={defaults.weight || ""} key={`w-${defaults.weight}`} />
              </div>
            </div>
          </div>

          {/* Avaliação - Dimensional + Comentários */}
          <div className="form-section">
            <h3 className="form-section-title">Avaliação</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dimensional">Dimensional *</Label>
                <Input id="dimensional" name="dimensional" required placeholder="Resultado dimensional" defaultValue={defaults.dimensional || ""} key={`dim-${defaults.dimensional}`} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="comentarios">Comentários gerais</Label>
                <Textarea id="comentarios" name="comentarios" placeholder="Observações adicionais..." rows={4} defaultValue={defaults.comentarios || ""} key={`com-${defaults.comentarios}`} />
              </div>
            </div>
          </div>

          {/* Defeitos */}
          <div className="form-section">
            <div className="flex items-center justify-between mb-3">
              <h3 className="form-section-title mb-0">Defeitos</h3>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={addDefect} 
                className="gap-1.5"
                disabled={pecasNG === 0}
              >
                <Plus className="w-4 h-4" /> Adicionar Defeito
              </Button>
            </div>

            {pecasNG === 0 && (
              <div className="text-sm text-muted-foreground text-center py-6 border border-border rounded-lg bg-muted/30">
                Defeitos bloqueados quando não há peças NG.
              </div>
            )}

            {pecasNG > 0 && defects.length === 0 && (
              <div className="text-sm text-destructive text-center py-6 border border-destructive/30 rounded-lg bg-destructive/5">
                ⚠️ É necessário registrar pelo menos um defeito quando há peças NG.
              </div>
            )}

            {pecasNG > 0 && defects.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6 border border-dashed border-border rounded-lg">
                Nenhum defeito registrado. Clique em "+ Adicionar Defeito" para incluir.
              </p>
            )}

            <div className="space-y-4">
              {defects.map((defect, idx) => (
                <div key={idx} className="border border-border rounded-lg p-4 space-y-3 bg-card">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">Defeito #{idx + 1}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeDefect(idx)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label>Descrição do defeito *</Label>
                    <Input
                      required
                      placeholder="Descreva o defeito encontrado"
                      value={defect.description}
                      onChange={(e) => updateDefect(idx, "description", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Será necessária alguma melhoria?</Label>
                    <Select
                      value={defect.needs_improvement ? "sim" : "nao"}
                      onValueChange={(v) => updateDefect(idx, "needs_improvement", v === "sim")}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sim">Sim</SelectItem>
                        <SelectItem value="nao">Não</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {defect.needs_improvement && (
                    <div className="space-y-2 opacity-0 animate-fade-in">
                      <Label>Categoria da melhoria *</Label>
                      <Select
                        required
                        value={defect.improvement_category}
                        onValueChange={(v) => updateDefect(idx, "improvement_category", v)}
                      >
                        <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                        <SelectContent>
                          {defectCategories?.map((cat) => (
                            <SelectItem key={cat.id} value={cat.code}>{cat.code} - {cat.description}</SelectItem>
                          ))}
                          {(!defectCategories || defectCategories.length === 0) && (
                            <SelectItem value="_empty" disabled>Nenhuma categoria cadastrada</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Modo de Falha</Label>
                    <Select
                      value={defect.failure_mode}
                      onValueChange={(v) => updateDefect(idx, "failure_mode", v)}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione o modo de falha" /></SelectTrigger>
                      <SelectContent>
                        {defectsList?.map((def) => (
                          <SelectItem key={def.id} value={def.code}>{def.code} - {def.description}</SelectItem>
                        ))}
                        {(!defectsList || defectsList.length === 0) && (
                          <SelectItem value="_empty" disabled>Nenhum defeito cadastrado</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Defect photos */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><Camera className="w-4 h-4" /> Fotos do defeito</Label>
                    <input
                      ref={(el) => { defectFileRefs.current[idx] = el; }}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => addDefectPhoto(idx, e)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => defectFileRefs.current[idx]?.click()}
                      className="w-full border-dashed border-2 h-12 text-muted-foreground hover:text-foreground hover:border-accent"
                    >
                      <Camera className="w-4 h-4 mr-2" /> Adicionar fotos
                    </Button>
                    {defect.photos.length > 0 && (
                      <div className="grid grid-cols-4 gap-2 mt-2">
                        {defect.photos.map((photo, pi) => (
                          <div key={pi} className="relative group rounded-lg overflow-hidden aspect-square border border-border">
                            <img src={photo.url} alt={photo.name} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => removeDefectPhoto(idx, pi)}
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Peça OK - somente quando NG = 0 */}
          <div className={`form-section ${pecasNG > 0 ? "opacity-50 pointer-events-none" : ""}`}>
            <h3 className="form-section-title">
              <Camera className="w-5 h-5" />
              Peça OK
              {pecasNG > 0 && <span className="text-xs text-muted-foreground ml-2">(Habilitado apenas quando NG = 0)</span>}
            </h3>
            
            {pecasNG === 0 && totalPecas > 0 && (
              <div className="mb-4 space-y-2">
                <Label>Tipo de Foto *</Label>
                <Select value={photoType} onValueChange={setPhotoType} disabled={pecasNG > 0}>
                  <SelectTrigger><SelectValue placeholder="Selecione o tipo de foto" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="peca_referencia">Peça Referência</SelectItem>
                    <SelectItem value="peca_final">Peça Final</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} disabled={pecasNG > 0} />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={pecasNG > 0}
              className="w-full border-dashed border-2 h-20 text-muted-foreground hover:text-foreground hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Camera className="w-5 h-5 mr-2" />
              {pecasNG > 0 ? "Fotos bloqueadas quando há peças NG" : "Clique para adicionar fotos"}
            </Button>
            {photos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-4">
                {photos.map((photo, i) => (
                  <div key={i} className="relative group rounded-lg overflow-hidden aspect-square border border-border">
                    <img src={photo.url} alt={photo.name} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={loading}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-heading font-semibold text-base h-14"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                {isEdit ? "Salvando..." : "Enviando..."}
              </>
            ) : (
              <>
                <Send className="w-5 h-5 mr-2" />
                {isEdit ? "Salvar Alterações" : "Enviar Checklist"}
              </>
            )}
          </Button>
        </form>
      </main>
    </div>
  );
};

export default InjectionForm;
