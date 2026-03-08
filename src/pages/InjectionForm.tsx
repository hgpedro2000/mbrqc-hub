import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Send, X, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uploadPhotos } from "@/lib/uploadPhotos";

const InjectionForm = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<{ name: string; url: string; file: File }[]>([]);
  const [needsImprovement, setNeedsImprovement] = useState<string>("");
  const [improvementCategory, setImprovementCategory] = useState<string>("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newPhotos = Array.from(files).map((f) => ({
      name: f.name,
      url: URL.createObjectURL(f),
      file: f,
    }));
    setPhotos((prev) => [...prev, ...newPhotos]);
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);

      const { data, error } = await supabase
        .from("injection_checklists")
        .insert({
          nome: formData.get("nome") as string,
          data: formData.get("data") as string,
          fornecedor: formData.get("fornecedor") as string,
          projeto: formData.get("projeto") as string,
          part_number: formData.get("partNumber") as string,
          part_name: formData.get("partName") as string,
          modulo: formData.get("modulo") as string,
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
        })
        .select("id")
        .single();

      if (error) throw error;

      if (photos.length > 0 && data) {
        await uploadPhotos(
          photos.map((p) => p.file),
          data.id,
          "injection"
        );
      }

      setSubmitted(true);
      toast.success("Checklist enviado com sucesso!", {
        description: "Os dados foram registrados.",
      });
      setTimeout(() => {
        setSubmitted(false);
        navigate("/");
      }, 2000);
    } catch (error: any) {
      console.error("Submit error:", error);
      toast.error("Erro ao enviar checklist", {
        description: error.message,
      });
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
          <h2 className="text-2xl font-heading font-bold text-foreground">Enviado!</h2>
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
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-primary-foreground/70 hover:text-primary-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Voltar</span>
          </button>
          <h1 className="text-2xl md:text-3xl font-heading font-bold">
            Processo de Injeção Plástica
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
                <Input id="nome" name="nome" required placeholder="Seu nome" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data">Data *</Label>
                <Input id="data" name="data" type="date" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fornecedor">Fornecedor *</Label>
                <Input id="fornecedor" name="fornecedor" required placeholder="Nome do fornecedor" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="projeto">Projeto *</Label>
                <Input id="projeto" name="projeto" required placeholder="Nome do projeto" />
              </div>
            </div>
          </div>

          {/* Peça */}
          <div className="form-section">
            <h3 className="form-section-title">Dados da Peça</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="partNumber">Part Number *</Label>
                <Input id="partNumber" name="partNumber" required placeholder="Ex: ABC-12345" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="partName">Part Name *</Label>
                <Input id="partName" name="partName" required placeholder="Nome da peça" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="modulo">Módulo *</Label>
                <Input id="modulo" name="modulo" required placeholder="Módulo" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qtdTryout">Quantidade de Try-Out *</Label>
                <Input id="qtdTryout" name="qtdTryout" type="number" required min={1} placeholder="0" />
              </div>
            </div>
          </div>

          {/* Parâmetros */}
          <div className="form-section">
            <h3 className="form-section-title">Parâmetros de Processo</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="materiaPrima">Matéria-Prima *</Label>
                <Input id="materiaPrima" name="materiaPrima" required placeholder="Tipo de material" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="injetora">Injetora *</Label>
                <Input id="injetora" name="injetora" required placeholder="Identificação da injetora" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tonelagem">Tonelagem da Máquina *</Label>
                <Input id="tonelagem" name="tonelagem" type="number" required placeholder="Em toneladas" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cycleTime">Cycle Time (s) *</Label>
                <Input id="cycleTime" name="cycleTime" type="number" step="0.1" required placeholder="Segundos" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coolingTime">Cooling Time (s) *</Label>
                <Input id="coolingTime" name="coolingTime" type="number" step="0.1" required placeholder="Segundos" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weight">Weight (g) *</Label>
                <Input id="weight" name="weight" type="number" step="0.01" required placeholder="Gramas" />
              </div>
            </div>
          </div>

          {/* Dimensional e Melhorias */}
          <div className="form-section">
            <h3 className="form-section-title">Avaliação</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dimensional">Dimensional *</Label>
                <Input id="dimensional" name="dimensional" required placeholder="Resultado dimensional" />
              </div>
              <div className="space-y-2">
                <Label>Será necessária alguma melhoria? *</Label>
                <Select required onValueChange={setNeedsImprovement} value={needsImprovement}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
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
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          Categoria {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="comentarios">Comentários gerais</Label>
                <Textarea id="comentarios" name="comentarios" placeholder="Observações adicionais..." rows={4} />
              </div>
            </div>
          </div>

          {/* Fotos */}
          <div className="form-section">
            <h3 className="form-section-title">
              <Camera className="w-5 h-5" />
              Fotos
            </h3>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handlePhotoUpload}
            />
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

          {/* Submit */}
          <Button
            type="submit"
            size="lg"
            disabled={loading}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-heading font-semibold text-base h-14"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="w-5 h-5 mr-2" />
                Enviar Checklist
              </>
            )}
          </Button>
        </form>
      </main>
    </div>
  );
};

export default InjectionForm;
