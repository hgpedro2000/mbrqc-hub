import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertTriangle, Loader2, X, Send, Ticket, CheckCircle, Clock, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { uploadPhotos } from "@/lib/uploadPhotos";
import { compressImage } from "@/lib/compressImage";
import ImageAnnotationEditor from "@/components/ImageAnnotationEditor";

interface Props {
  moduleName: string;
}

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
  pendente: { label: "Pendente", icon: Clock, color: "border-yellow-500 text-yellow-600 bg-yellow-500/10" },
  em_andamento: { label: "Em Andamento", icon: Loader2, color: "border-blue-500 text-blue-600 bg-blue-500/10" },
  resolvido: { label: "Resolvido", icon: CheckCircle, color: "border-emerald-500 text-emerald-600 bg-emerald-500/10" },
};

const ReportErrorButton = ({ moduleName }: Props) => {
  const { user, profile } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [annotatingFile, setAnnotatingFile] = useState<File | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: myTickets = [], refetch: refetchTickets } = useQuery({
    queryKey: ["my-error-reports", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("error_reports")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const resolvedCount = myTickets.filter((t: any) => t.status === "resolvido").length;
  const hasNewResolved = resolvedCount > 0;

  const handlePhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = 4 - photos.length;
    const toAdd = files.slice(0, remaining);
    if (toAdd.length === 0) return;
    // Compress first, then open annotation for first one
    const compressed = await Promise.all(toAdd.map(compressImage));
    setPendingFiles(compressed.slice(1));
    setAnnotatingFile(compressed[0]);
  };

  const handleAnnotationConfirm = (annotatedFile: File) => {
    setPhotos((prev) => [...prev, annotatedFile]);
    const reader = new FileReader();
    reader.onload = (ev) => setPreviews((prev) => [...prev, ev.target?.result as string]);
    reader.readAsDataURL(annotatedFile);
    setAnnotatingFile(null);
    // Process next pending file
    if (pendingFiles.length > 0) {
      const [next, ...rest] = pendingFiles;
      setPendingFiles(rest);
      setAnnotatingFile(next);
    }
  };

  const handleAnnotationCancel = () => {
    // Skip annotation, add original
    if (annotatingFile) {
      setPhotos((prev) => [...prev, annotatingFile]);
      const reader = new FileReader();
      reader.onload = (ev) => setPreviews((prev) => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(annotatingFile);
    }
    setAnnotatingFile(null);
    if (pendingFiles.length > 0) {
      const [next, ...rest] = pendingFiles;
      setPendingFiles(rest);
      setAnnotatingFile(next);
    }
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
      toast.success("Chamado aberto com sucesso! A equipe será notificada.");
      setDescription("");
      setPhotos([]);
      setPreviews([]);
      setReportOpen(false);
      refetchTickets();
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar relatório");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Menu popup */}
      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10 text-xs relative">
            <AlertTriangle className="w-3.5 h-3.5 mr-1" />
            <span className="hidden sm:inline">Reportar Erro</span>
            <span className="sm:hidden">Erro</span>
            {hasNewResolved && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-background animate-pulse" />
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center">Help Desk</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Button variant="outline" className="h-16 flex flex-col items-center gap-1" onClick={() => { setMenuOpen(false); setReportOpen(true); }}>
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <span className="text-sm font-medium">Reportar Erro</span>
            </Button>
            <Button variant="outline" className="h-16 flex flex-col items-center gap-1 relative" onClick={() => { setMenuOpen(false); setStatusOpen(true); refetchTickets(); }}>
              <Ticket className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">Status de Chamados</span>
              {hasNewResolved && (
                <Badge className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[9px] px-1.5">{resolvedCount}</Badge>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Report form dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
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
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva o erro que encontrou..." rows={4} />
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
                  <button onClick={() => fileRef.current?.click()} className="w-16 h-16 rounded-md border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center hover:border-primary/50 transition-colors gap-0.5">
                    <ImagePlus className="w-4 h-4 text-muted-foreground" />
                    <span className="text-[8px] text-muted-foreground">Galeria</span>
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

      {/* Status dialog */}
      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="w-5 h-5 text-primary" />
              Meus Chamados
            </DialogTitle>
          </DialogHeader>
          {myTickets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum chamado aberto ainda.</p>
          ) : (
            <div className="space-y-2">
              {myTickets.map((t: any) => {
                const cfg = statusConfig[t.status] || statusConfig.pendente;
                const Icon = cfg.icon;
                return (
                  <div key={t.id} className="border rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-muted-foreground">{t.numero || "—"}</span>
                      <Badge variant="outline" className={`text-[10px] ${cfg.color}`}>
                        <Icon className="w-3 h-3 mr-1" />
                        {cfg.label}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium">{t.module}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(t.created_at).toLocaleDateString("pt-BR")}</p>
                    {t.admin_notes && t.status === "resolvido" && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded p-2 mt-1">
                        <p className="text-xs text-emerald-800"><span className="font-semibold">Resposta:</span> {t.admin_notes}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Image annotation editor */}
      <ImageAnnotationEditor
        open={!!annotatingFile}
        imageFile={annotatingFile}
        onConfirm={handleAnnotationConfirm}
        onCancel={handleAnnotationCancel}
      />
    </>
  );
};

export default ReportErrorButton;
