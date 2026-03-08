import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Send, X, Plus, Trash2, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uploadPhotos } from "@/lib/uploadPhotos";

interface ChecklistItem {
  id: string;
  label: string;
  type: "check" | "text";
}

const defaultPaintingItems: ChecklistItem[] = [
  { id: "1", label: "Superfície preparada corretamente", type: "check" },
  { id: "2", label: "Primer aplicado uniformemente", type: "check" },
  { id: "3", label: "Cor conforme especificação", type: "check" },
  { id: "4", label: "Espessura de camada dentro do padrão", type: "check" },
  { id: "5", label: "Sem escorrimento ou bolhas", type: "check" },
  { id: "6", label: "Aderência aprovada (teste cross-cut)", type: "check" },
  { id: "7", label: "Brilho dentro da especificação", type: "check" },
  { id: "8", label: "Sem contaminação ou partículas", type: "check" },
];

const defaultAssemblyItems: ChecklistItem[] = [
  { id: "1", label: "Encaixe correto de todos os componentes", type: "check" },
  { id: "2", label: "Torques aplicados conforme especificação", type: "check" },
  { id: "3", label: "Sem folgas ou ruídos", type: "check" },
  { id: "4", label: "Acabamento superficial conforme padrão", type: "check" },
  { id: "5", label: "Funcionalidade testada e aprovada", type: "check" },
  { id: "6", label: "Etiqueta de identificação aplicada", type: "check" },
];

interface EditableChecklistProps {
  title: string;
  headerLabel: string;
  defaultItems: ChecklistItem[];
  checklistType: "painting" | "assembly";
  tableName: "painting_checklists" | "assembly_checklists";
}

const EditableChecklistPage = ({ title, headerLabel, defaultItems, checklistType, tableName }: EditableChecklistProps) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<ChecklistItem[]>(defaultItems);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [newItemLabel, setNewItemLabel] = useState("");
  const [photos, setPhotos] = useState<{ name: string; url: string; file: File }[]>([]);
  const [comments, setComments] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nome, setNome] = useState("");
  const [data, setData] = useState("");

  const addItem = () => {
    if (!newItemLabel.trim()) return;
    setItems((prev) => [
      ...prev,
      { id: Date.now().toString(), label: newItemLabel.trim(), type: "check" },
    ]);
    setNewItemLabel("");
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setCheckedItems((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
  };

  const toggleCheck = (id: string) => {
    setCheckedItems((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setPhotos((prev) => [
      ...prev,
      ...Array.from(files).map((f) => ({ name: f.name, url: URL.createObjectURL(f), file: f })),
    ]);
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !data) {
      toast.error("Preencha nome e data.");
      return;
    }
    setLoading(true);

    try {
      const itemsData = items.map((item) => ({
        id: item.id,
        label: item.label,
      }));
      const checkedData = Array.from(checkedItems);

      const { data: record, error } = await supabase
        .from(tableName)
        .insert({
          nome,
          data,
          items: itemsData,
          checked_items: checkedData,
          comentarios: comments || null,
        })
        .select("id")
        .single();

      if (error) throw error;

      if (photos.length > 0 && record) {
        await uploadPhotos(
          photos.map((p) => p.file),
          record.id,
          checklistType
        );
      }

      setSubmitted(true);
      toast.success("Checklist enviado com sucesso!");
      setTimeout(() => navigate("/tryout"), 2000);
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
          <h1 className="text-2xl md:text-3xl font-heading font-bold">{title}</h1>
          <p className="text-primary-foreground/70 text-sm mt-1">{headerLabel}</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="form-section">
            <h3 className="form-section-title">Identificação</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
              </div>
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input type="date" required value={data} onChange={(e) => setData(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3 className="form-section-title">Checklist</h3>
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 group">
                  <Checkbox
                    checked={checkedItems.has(item.id)}
                    onCheckedChange={() => toggleCheck(item.id)}
                  />
                  <span className={`flex-1 text-sm ${checkedItems.has(item.id) ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {item.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <Input
                value={newItemLabel}
                onChange={(e) => setNewItemLabel(e.target.value)}
                placeholder="Adicionar novo item..."
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem())}
              />
              <Button type="button" variant="outline" onClick={addItem} size="icon">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="form-section">
            <h3 className="form-section-title">Comentários</h3>
            <Textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Observações adicionais..."
              rows={4}
            />
          </div>

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

export const PaintingPage = () => (
  <EditableChecklistPage
    title="Processo de Pintura"
    headerLabel="Checklist editável — adicione ou remova itens conforme necessário"
    defaultItems={defaultPaintingItems}
    checklistType="painting"
    tableName="painting_checklists"
  />
);

export const AssemblyPage = () => (
  <EditableChecklistPage
    title="Montagem e Finalização"
    headerLabel="Checklist editável — adicione ou remova itens conforme necessário"
    defaultItems={defaultAssemblyItems}
    checklistType="assembly"
    tableName="assembly_checklists"
  />
);
