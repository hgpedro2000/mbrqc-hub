import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Camera, Send, X, CheckCircle2, Loader2 } from "lucide-react";
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

const InjectionForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const { profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<{ name: string; url: string; file: File }[]>([]);
  const [needsImprovement, setNeedsImprovement] = useState<string>("");
  const [improvementCategory, setImprovementCategory] = useState<string>("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const [fornecedor, setFornecedor] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [partName, setPartName] = useState("");
  const [projeto, setProjeto] = useState("");
  const [modulo, setModulo] = useState("");

  // Edit mode: form field defaults
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
      setNeedsImprovement(existing.needs_improvement ? "sim" : "nao");
      setImprovementCategory(existing.improvement_category ? String(existing.improvement_category) : "");
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const payload = {
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
        needs_improvement: needsImprovement === "sim",
        improvement_category: needsImprovement === "sim" ? Number(improvementCategory) : null,
        comentarios: (formData.get("comentarios") as string) || null,
      };

      let recordId: string;

      if (isEdit) {
        const { error } = await supabase.from("injection_checklists").update(payload).eq("id", id!);
        if (error) throw error;
        recordId = id!;
      } else {
        const { data, error } = await supabase.from("injection_checklists").insert(payload).select("id").single();
        if (error) throw error;
        recordId = data.id;
      }

      if (photos.length > 0) {
        await uploadPhotos(photos.map((p) => p.file), recordId, "injection");
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

          <div className="form-section">
            <h3 className="form-section-title">Dados da Peça</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="qtdTryout">Quantidade de Try-Out *</Label>
                <Input id="qtdTryout" name="qtdTryout" type="number" required min={1} placeholder="0" defaultValue={defaults.qtd_tryout || ""} key={`qt-${defaults.qtd_tryout}`} />
              </div>
            </div>
          </div>

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

          <div className="form-section">
            <h3 className="form-section-title">Avaliação</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dimensional">Dimensional *</Label>
                <Input id="dimensional" name="dimensional" required placeholder="Resultado dimensional" defaultValue={defaults.dimensional || ""} key={`dim-${defaults.dimensional}`} />
              </div>
              <div className="space-y-2">
                <Label>Será necessária alguma melhoria? *</Label>
                <Select required onValueChange={setNeedsImprovement} value={needsImprovement}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sim">Sim</SelectItem>
                    <SelectItem value="nao">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {needsImprovement === "sim" && (
                <div className="space-y-2 opacity-0 animate-fade-in">
                  <Label>Categoria da melhoria *</Label>
                  <Select required onValueChange={setImprovementCategory} value={improvementCategory}>
                    <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                        <SelectItem key={n} value={String(n)}>Categoria {n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="comentarios">Comentários gerais</Label>
                <Textarea id="comentarios" name="comentarios" placeholder="Observações adicionais..." rows={4} defaultValue={defaults.comentarios || ""} key={`com-${defaults.comentarios}`} />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3 className="form-section-title">
              <Camera className="w-5 h-5" />
              Fotos
            </h3>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-dashed border-2 h-20 text-muted-foreground hover:text-foreground hover:border-accent"
            >
              <Camera className="w-5 h-5 mr-2" />
              Clique para adicionar fotos
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
