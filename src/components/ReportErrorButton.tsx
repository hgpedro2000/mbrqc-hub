import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertTriangle, Camera, Loader2, X, Send } from "lucide-react";
import { toast } from "sonner";
import { uploadPhotos } from "@/lib/uploadPhotos";

interface Props {
  moduleName: string;
}

const ReportErrorButton = ({ moduleName }: Props) => {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = 4 - photos.length;
    const toAdd = files.slice(0, remaining);
    setPhotos((prev) => [...prev, ...toAdd]);
    toAdd.forEach((f) => {
      const reader = new FileReader();
      reader.onload = (ev) => setPreviews((prev) => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(f);
    });
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast.error("Descreva o erro encontrado");
      return;
    }
    setSending(true);
    try {
      const reportId = crypto.randomUUID();
      let photoUrls: string[] = [];
      if (photos.length > 0) {
        const results = await uploadPhotos(photos, reportId, "apontamento");
        photoUrls = results.map((r) => {
          const { data } = supabase.storage.from("checklist-photos").getPublicUrl(r.file_path);
          return data.publicUrl;
        });
      }
      const { error } = await supabase.from("error_reports").insert({
        id: reportId,
        user_id: user?.id,
        user_name: profile?.full_name || "",
        module: moduleName,
        description: description.trim(),
        photos: photoUrls,
      } as any);
      if (error) throw error;
      toast.success("Erro reportado com sucesso! A equipe será notificada.");
      setDescription("");
      setPhotos([]);
      setPreviews([]);
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar relatório");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 mr-1" />
          <span className="hidden sm:inline">Reportar Erro</span>
          <span className="sm:hidden">Erro</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Reportar Erro — {moduleName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Descrição do Erro *</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o erro que encontrou..."
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label>Capturas de Tela (máx. 4)</Label>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotos} />
            <div className="flex flex-wrap gap-2">
              {previews.map((src, i) => (
                <div key={i} className="relative w-16 h-16 rounded-md overflow-hidden border">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => removePhoto(i)} className="absolute top-0 right-0 bg-destructive text-white rounded-bl p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {photos.length < 4 && (
                <button onClick={() => fileRef.current?.click()} className="w-16 h-16 rounded-md border-2 border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-primary/50 transition-colors">
                  <Camera className="w-5 h-5 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
          <Button onClick={handleSubmit} disabled={sending} className="w-full">
            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
            Enviar Relatório
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReportErrorButton;
