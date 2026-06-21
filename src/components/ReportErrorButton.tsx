import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertTriangle, Loader2, X, Send, Ticket, CheckCircle, Clock, ImagePlus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { uploadPhotos } from "@/lib/uploadPhotos";
import { compressImage } from "@/lib/compressImage";
import ImageAnnotationEditor from "@/components/ImageAnnotationEditor";

interface Props {
  moduleName: string;
  showNewUserRequest?: boolean;
}

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
  pendente: { label: "Aberto", icon: Clock, color: "border-blue-500 text-blue-600 bg-blue-500/10" },
  em_andamento: { label: "Em Andamento", icon: Loader2, color: "border-amber-500 text-amber-600 bg-amber-500/10" },
  resolvido: { label: "Resolvido", icon: CheckCircle, color: "border-emerald-500 text-emerald-600 bg-emerald-500/10" },
  cancelado: { label: "Cancelado", icon: X, color: "border-red-500 text-red-600 bg-red-500/10" },
};

const TURNOS = ["1T", "2T", "3T", "ADM"];
const CARGOS = [
  "Auxiliar de Qualidade", "Inspetor de Qualidade", "Assistente de Qualidade",
  "Lider de Qualidade", "Analista de Qualidade", "Supervisor de Qualidade",
  "Gerente de Qualidade", "Diretor de Qualidade",
];

const ReportErrorButton = ({ moduleName, showNewUserRequest = false }: Props) => {
  const { user, profile, isAdmin } = useAuth();
  const { impersonating } = useImpersonation();
  const targetUserId = impersonating?.id || user?.id;
  const [activeModule, setActiveModule] = useState(moduleName);
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

  // New user request form state
  const [newUserEmpresa, setNewUserEmpresa] = useState("mobis_brasil");
  const [newUserEmpresaTerceira, setNewUserEmpresaTerceira] = useState("");
  const [newUserFullName, setNewUserFullName] = useState("");
  const [newUserTurno, setNewUserTurno] = useState("");
  const [newUserCargo, setNewUserCargo] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserEmployeeNumber, setNewUserEmployeeNumber] = useState("");
  const [isNewUserMode, setIsNewUserMode] = useState(false);

  // Suppliers for Residente
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-for-new-user"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id, name, code").eq("active", true).order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: isNewUserMode && newUserEmpresaTerceira === "Residente" || newUserEmpresaTerceira.startsWith("Residente - "),
  });

  const { data: myTickets = [], refetch: refetchTickets } = useQuery({
    queryKey: ["my-error-reports", targetUserId],
    queryFn: async () => {
      if (!targetUserId) return [];
      const { data, error } = await supabase
        .from("error_reports")
        .select("*")
        .eq("user_id", targetUserId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!targetUserId,
  });

  // Track which resolved tickets the user has already seen
  const seenKey = `hd-seen-resolved-${targetUserId}`;
  const getSeenIds = useCallback((): string[] => {
    try { return JSON.parse(localStorage.getItem(seenKey) || "[]"); } catch { return []; }
  }, [seenKey]);

  const [seenResolvedIds, setSeenResolvedIds] = useState<string[]>(() => getSeenIds());

  // Visible tickets: non-resolved + resolved-not-yet-seen
  const visibleTickets = myTickets.filter((t: any) => {
    if (t.status !== "resolvido") return true;
    return !seenResolvedIds.includes(t.id);
  });

  const newResolvedCount = myTickets.filter((t: any) => t.status === "resolvido" && !seenResolvedIds.includes(t.id)).length;
  const hasNewResolved = newResolvedCount > 0;

  // When user opens status dialog, mark current resolved tickets as seen
  const markResolvedAsSeen = useCallback(() => {
    const resolvedIds = myTickets.filter((t: any) => t.status === "resolvido").map((t: any) => t.id);
    if (resolvedIds.length === 0) return;
    const current = getSeenIds();
    const merged = Array.from(new Set([...current, ...resolvedIds]));
    localStorage.setItem(seenKey, JSON.stringify(merged));
    setSeenResolvedIds(merged);
  }, [myTickets, seenKey, getSeenIds]);

  const isResidente = newUserEmpresaTerceira === "Residente" || newUserEmpresaTerceira.startsWith("Residente - ");
  const residenteSupplier = newUserEmpresaTerceira.startsWith("Residente - ") ? newUserEmpresaTerceira.replace("Residente - ", "") : "";

  const handlePhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = 4 - photos.length;
    const toAdd = files.slice(0, remaining);
    if (toAdd.length === 0) return;
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
    if (pendingFiles.length > 0) {
      const [next, ...rest] = pendingFiles;
      setPendingFiles(rest);
      setAnnotatingFile(next);
    }
  };

  const handleAnnotationCancel = () => {
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

  const resetNewUserForm = () => {
    setNewUserEmpresa("mobis_brasil");
    setNewUserEmpresaTerceira("");
    setNewUserFullName("");
    setNewUserTurno("");
    setNewUserCargo("");
    setNewUserEmail("");
    setNewUserEmployeeNumber("");
    setIsNewUserMode(false);
    setDescription("");
    setPhotos([]);
    setPreviews([]);
  };

  const handleSubmit = async () => {
    if (isNewUserMode) {
      if (!newUserFullName.trim()) { toast.error("Preencha o nome completo"); return; }
      if (!newUserTurno) { toast.error("Selecione o turno"); return; }
      if (!newUserCargo) { toast.error("Selecione o cargo"); return; }
      if (newUserEmpresa === "mobis_brasil" && !newUserEmployeeNumber.trim()) { toast.error("Preencha o número do usuário"); return; }
      if (newUserEmpresa === "empresa_terceira" && !newUserEmpresaTerceira) { toast.error("Selecione o tipo de empresa terceira"); return; }
      if (newUserEmpresa === "empresa_terceira" && isResidente && !residenteSupplier) { toast.error("Selecione o fornecedor"); return; }

      const empresaLabel = newUserEmpresa === "mobis_brasil" 
        ? "Mobis Brasil" 
        : `Empresa Terceira - ${newUserEmpresaTerceira}`;
      const descLines = [
        `Empresa: ${empresaLabel}`,
        newUserEmpresa === "mobis_brasil" ? `Número do Usuário: ${newUserEmployeeNumber}` : null,
        `Nome Completo: ${newUserFullName}`,
        `Turno: ${newUserTurno}`,
        `Cargo: ${newUserCargo}`,
        newUserEmail ? `E-mail: ${newUserEmail}` : null,
        `Consulta de Peças: Sim (automático)`,
      ].filter(Boolean).join("\n");

      setSending(true);
      try {
        const reportId = crypto.randomUUID();
        const { error } = await supabase.from("error_reports").insert({
          id: reportId,
          user_id: user?.id,
          user_name: profile?.full_name || "",
          module: "Novo Usuário",
          description: descLines,
        } as any);
        if (error) throw error;
        toast.success("Solicitação de novo usuário enviada com sucesso!");
        resetNewUserForm();
        setReportOpen(false);
        refetchTickets();
      } catch (e: any) {
        toast.error(e.message || "Erro ao enviar solicitação");
      } finally {
        setSending(false);
      }
      return;
    }

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
        module: activeModule,
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

  const openNewUserForm = () => {
    setMenuOpen(false);
    setIsNewUserMode(true);
    setActiveModule("Novo Usuário");
    setReportOpen(true);
  };

  const openErrorForm = () => {
    setMenuOpen(false);
    setIsNewUserMode(false);
    setActiveModule(moduleName);
    setReportOpen(true);
  };

  return (
    <>
      {/* Menu popup */}
      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10 relative h-8 w-8 md:w-auto md:px-3 gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            <span className="hidden md:inline text-xs">Help Desk</span>
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
            <Button variant="outline" className="h-16 flex flex-col items-center gap-1" onClick={openErrorForm}>
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <span className="text-sm font-medium">Reportar Erro</span>
            </Button>
            <Button variant="outline" className="h-16 flex flex-col items-center gap-1 relative" onClick={() => { setMenuOpen(false); setStatusOpen(true); refetchTickets(); }}>
              <Ticket className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">Status de Chamados</span>
              {hasNewResolved && (
                <Badge className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[9px] px-1.5">{newResolvedCount}</Badge>
              )}
            </Button>
            {showNewUserRequest && (
              <Button variant="outline" className="h-16 flex flex-col items-center gap-1" onClick={openNewUserForm}>
                <UserPlus className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium">Solicitar Novo Usuário</span>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Report form / New user request dialog */}
      <Dialog open={reportOpen} onOpenChange={(v) => { if (!v) resetNewUserForm(); setReportOpen(v); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isNewUserMode ? (
                <><UserPlus className="w-5 h-5 text-blue-600" />Solicitar Novo Usuário</>
              ) : (
                <><AlertTriangle className="w-5 h-5 text-destructive" />Reportar Erro — {activeModule}</>
              )}
            </DialogTitle>
          </DialogHeader>

          {isNewUserMode ? (
            <div className="space-y-4">
              {/* Empresa */}
              <div className="space-y-2">
                <Label>Empresa *</Label>
                <Select value={newUserEmpresa} onValueChange={(v) => { setNewUserEmpresa(v); setNewUserEmpresaTerceira(""); setNewUserEmployeeNumber(""); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mobis_brasil">Mobis Brasil</SelectItem>
                    <SelectItem value="empresa_terceira">Empresa Terceira</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Número do Usuário - only for Mobis Brasil */}
              {newUserEmpresa === "mobis_brasil" && (
                <div className="space-y-2">
                  <Label>Número do Usuário *</Label>
                  <Input 
                    value={newUserEmployeeNumber} 
                    onChange={(e) => setNewUserEmployeeNumber(e.target.value)} 
                    placeholder="Ex: 3501165" 
                  />
                </div>
              )}

              {/* Tipo de Terceira */}
              {newUserEmpresa === "empresa_terceira" && (
                <div className="space-y-2">
                  <Label>Tipo de Empresa Terceira *</Label>
                  <Select value={isResidente ? "Residente" : newUserEmpresaTerceira} onValueChange={(v) => setNewUserEmpresaTerceira(v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IL AUTOMOTIVE">IL AUTOMOTIVE</SelectItem>
                      <SelectItem value="TRIGO INSPEÇÕES">TRIGO INSPEÇÕES</SelectItem>
                      <SelectItem value="Residente">Residente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Fornecedor - only for Residente */}
              {newUserEmpresa === "empresa_terceira" && isResidente && (
                <div className="space-y-2">
                  <Label>Fornecedor *</Label>
                  <Select value={residenteSupplier} onValueChange={(v) => setNewUserEmpresaTerceira(`Residente - ${v}`)}>
                    <SelectTrigger><SelectValue placeholder="Selecione o fornecedor" /></SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s: any) => (
                        <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Nome Completo */}
              <div className="space-y-2">
                <Label>Nome Completo *</Label>
                <Input value={newUserFullName} onChange={(e) => setNewUserFullName(e.target.value)} placeholder="Nome completo do novo usuário" />
              </div>

              {/* Turno */}
              <div className="space-y-2">
                <Label>Turno *</Label>
                <Select value={newUserTurno} onValueChange={setNewUserTurno}>
                  <SelectTrigger><SelectValue placeholder="Selecione o turno" /></SelectTrigger>
                  <SelectContent>
                    {TURNOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Cargo */}
              <div className="space-y-2">
                <Label>Cargo *</Label>
                <Select value={newUserCargo} onValueChange={setNewUserCargo}>
                  <SelectTrigger><SelectValue placeholder="Selecione o cargo" /></SelectTrigger>
                  <SelectContent>
                    {CARGOS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* E-mail */}
              <div className="space-y-2">
                <Label>E-mail <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="email@exemplo.com" />
              </div>

              {/* Consulta de Peças auto */}
              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <CheckCircle className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="text-xs text-blue-800">Consulta de Peças será habilitada automaticamente</span>
              </div>

              <Button onClick={handleSubmit} disabled={sending} className="w-full min-h-[44px]">
                {sending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                Enviar Solicitação
              </Button>
            </div>
          ) : (
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
              <Button onClick={handleSubmit} disabled={sending} className="w-full min-h-[44px]">
                {sending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                Enviar Relatório
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Status dialog */}
      <Dialog open={statusOpen} onOpenChange={(v) => { if (!v) markResolvedAsSeen(); setStatusOpen(v); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[80vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="w-5 h-5 text-primary shrink-0" />
              Meus Chamados
            </DialogTitle>
          </DialogHeader>
          {visibleTickets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum chamado aberto ainda.</p>
          ) : (
            <div className="space-y-2">
              {visibleTickets.map((t: any) => {
                const cfg = statusConfig[t.status] || statusConfig.pendente;
                const Icon = cfg.icon;
                return (
                  <div key={t.id} className="border rounded-lg p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground">{t.numero || "—"}</span>
                      <Badge variant="outline" className={`text-[10px] shrink-0 px-2 py-0.5 ${cfg.color}`}>
                        <Icon className="w-3 h-3 mr-1" />
                        {cfg.label}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium break-words">{t.module}</p>
                    <p className="text-xs text-muted-foreground whitespace-pre-line break-words line-clamp-4">{t.description}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(t.created_at).toLocaleDateString("pt-BR")}</p>
                    {t.admin_notes && t.status === "resolvido" && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded p-2 mt-1">
                        <p className="text-xs text-emerald-800 break-words"><span className="font-semibold">Resposta:</span> {t.admin_notes}</p>
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
