import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Users, Camera, Upload, X, Save, CheckCircle2, Search, AlertTriangle, Plus } from "lucide-react";
import { toast } from "sonner";
import { getLocalDateString } from "@/lib/localDate";
import { compressImage } from "@/lib/compressImage";
import { TURNOS, Inspetor, ContencaoRegistro } from "@/lib/contencao";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  open: boolean;
  onClose: () => void;
  contencaoId: string;
  defaultLocal?: string | null;
  initial?: ContencaoRegistro | null;
  contencaoConcluida: boolean;
}

const BUCKET = "containment-photos";

const ContencaoRegistroDialog = ({ open, onClose, contencaoId, defaultLocal, initial, contencaoConcluida }: Props) => {
  const qc = useQueryClient();
  const { profile, user } = useAuth();
  const markFileInputRef = useRef<HTMLInputElement>(null);
  const falhaFileInputRef = useRef<HTMLInputElement>(null);
  const [turno, setTurno] = useState<string>("1T");
  const [data, setData] = useState(getLocalDateString());
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFim, setHoraFim] = useState("");
  const [local, setLocal] = useState("");
  const [selectedInspetores, setSelectedInspetores] = useState<Inspetor[]>([]);
  const [inspetorSearch, setInspetorSearch] = useState("");
  const [qtdInspetores, setQtdInspetores] = useState(0);
  const [qtdInspecionada, setQtdInspecionada] = useState(0);
  const [qtdDiferenca, setQtdDiferenca] = useState(0);
  const [justificativaDiferenca, setJustificativaDiferenca] = useState("");
  const [showDiferenca, setShowDiferenca] = useState(false);
  const [observacoes, setObservacoes] = useState("");
  const [existingFotos, setExistingFotos] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [existingFotosFalha, setExistingFotosFalha] = useState<string[]>([]);
  const [newFilesFalha, setNewFilesFalha] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmFinalize, setConfirmFinalize] = useState(false);

  // Contenção info (mark_check + estoque_mobis = quantidade_aprovada)
  const { data: contencaoInfo } = useQuery({
    queryKey: ["contencao-info", contencaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contencao")
        .select("mark_check, quantidade_aprovada")
        .eq("id", contencaoId)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: open && !!contencaoId,
  });

  // Soma de inspecionado + diferença em outros registros
  const { data: somaInspecionada = 0 } = useQuery({
    queryKey: ["contencao-soma-inspecionada", contencaoId, initial?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contencao_registros" as any)
        .select("qtd_inspecionada, qtd_diferenca, id")
        .eq("contencao_id", contencaoId);
      if (error) throw error;
      const total = (data as any[]).reduce((sum, r) => {
        if (initial && r.id === initial.id) return sum;
        return sum + Number(r.qtd_inspecionada || 0) + Number(r.qtd_diferenca || 0);
      }, 0);
      return total;
    },
    enabled: open && !!contencaoId,
  });

  const markCheckObrig = !!contencaoInfo?.mark_check;
  const estoqueMobis = Number(contencaoInfo?.quantidade_aprovada || 0);
  const restante = Math.max(0, estoqueMobis - somaInspecionada);
  const estoqueAcabou = estoqueMobis > 0 && restante === 0;

  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ["profiles-for-coinspecao"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_co_inspection_profiles");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTurno(initial.turno);
      setData(initial.data);
      setHoraInicio(initial.hora_inicio?.slice(0, 5) || "");
      setHoraFim(initial.hora_fim?.slice(0, 5) || "");
      setLocal(initial.local || defaultLocal || "");
      setSelectedInspetores(Array.isArray(initial.inspetores) ? initial.inspetores : []);
      setQtdInspetores(initial.qtd_inspetores || 0);
      setQtdInspecionada(initial.qtd_inspecionada || 0);
      setQtdDiferenca(Number((initial as any).qtd_diferenca || 0));
      setJustificativaDiferenca((initial as any).justificativa_diferenca || "");
      setShowDiferenca(Number((initial as any).qtd_diferenca || 0) > 0);
      setObservacoes(initial.observacoes || "");
      setExistingFotos(Array.isArray(initial.fotos) ? initial.fotos : []);
      setExistingFotosFalha(Array.isArray((initial as any).fotos_falha) ? (initial as any).fotos_falha : []);
      setNewFiles([]);
      setNewFilesFalha([]);
    } else {
      setTurno(profile?.turno || "1T");
      setData(getLocalDateString());
      setHoraInicio("");
      setHoraFim("");
      setLocal(defaultLocal || "");
      setSelectedInspetores([]);
      setQtdInspetores(0);
      setQtdInspecionada(0);
      setQtdDiferenca(0);
      setJustificativaDiferenca("");
      setShowDiferenca(false);
      setObservacoes("");
      setExistingFotos([]);
      setExistingFotosFalha([]);
      setNewFiles([]);
      setNewFilesFalha([]);
    }
  }, [open, initial, defaultLocal, profile?.turno]);

  useEffect(() => {
    setQtdInspetores(selectedInspetores.length);
  }, [selectedInspetores]);

  // Trava qtd inspecionada ao restante quando há estoque definido
  useEffect(() => {
    if (!open || initial) return;
    if (estoqueMobis > 0 && qtdInspecionada > restante) {
      setQtdInspecionada(restante);
    }
  }, [restante, estoqueMobis, open, initial]);

  const filteredProfiles = useMemo(() => {
    const q = inspetorSearch.trim().toLowerCase();
    const list = (profiles as any[]).map((p) => ({ id: p.id, nome: p.full_name }));
    if (!q) return list;
    return list.filter((p) => p.nome?.toLowerCase().includes(q));
  }, [profiles, inspetorSearch]);

  const toggleInspetor = (insp: Inspetor) => {
    setSelectedInspetores((prev) => {
      const exists = prev.some((i) => i.id === insp.id);
      return exists ? prev.filter((i) => i.id !== insp.id) : [...prev, insp];
    });
  };

  const uploadFilesList = async (files: File[], registroId: string, kind: "mark" | "falha"): Promise<string[]> => {
    const paths: string[] = [];
    for (const file of files) {
      const compressed = await compressImage(file);
      const ext = (compressed.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${contencaoId}/${registroId}/${kind}-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, compressed);
      if (error) { console.error("upload error", error); continue; }
      paths.push(path);
    }
    return paths;
  };

  const validate = (): string | null => {
    if (!turno || !data || !horaInicio || !horaFim) return "Preencha turno, data e horários.";
    if (horaFim <= horaInicio) return "Hora fim deve ser maior que a hora início.";
    if (qtdInspecionada < 0) return "Quantidade não pode ser negativa.";
    if (showDiferenca) {
      if (qtdDiferenca <= 0) return "Informe a quantidade adicional (diferença).";
      if (!justificativaDiferenca.trim()) return "Informe a justificativa da diferença.";
      if (existingFotosFalha.length === 0 && newFilesFalha.length === 0)
        return "A foto da falha é obrigatória ao adicionar diferença.";
    }
    return null;
  };

  const persist = async (finalizar: boolean) => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSaving(true);
    try {
      const payload: any = {
        contencao_id: contencaoId,
        turno, data,
        hora_inicio: horaInicio, hora_fim: horaFim,
        local: local || null,
        inspetores: selectedInspetores,
        qtd_inspetores: qtdInspetores,
        qtd_inspecionada: qtdInspecionada,
        qtd_ok: 0,
        qtd_ng: 0,
        qtd_diferenca: showDiferenca ? qtdDiferenca : 0,
        justificativa_diferenca: showDiferenca ? justificativaDiferenca : null,
        mark_check: markCheckObrig,
        observacoes: observacoes || null,
        finaliza_contencao: finalizar,
        created_by: user?.id || null,
      };
      let registroId = initial?.id;
      if (initial) {
        const { error } = await supabase
          .from("contencao_registros" as any)
          .update({ ...payload, fotos: existingFotos, fotos_falha: existingFotosFalha })
          .eq("id", initial.id);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase
          .from("contencao_registros" as any)
          .insert({ ...payload, fotos: [], fotos_falha: [] })
          .select("id")
          .single();
        if (error) throw error;
        registroId = (inserted as any).id;
      }
      if (registroId && (newFiles.length || newFilesFalha.length)) {
        const uploadedMark = newFiles.length ? await uploadFilesList(newFiles, registroId, "mark") : [];
        const uploadedFalha = newFilesFalha.length ? await uploadFilesList(newFilesFalha, registroId, "falha") : [];
        const finalFotos = [...existingFotos, ...uploadedMark];
        const finalFotosFalha = [...existingFotosFalha, ...uploadedFalha];
        const { error: e2 } = await supabase
          .from("contencao_registros" as any)
          .update({ fotos: finalFotos, fotos_falha: finalFotosFalha })
          .eq("id", registroId);
        if (e2) throw e2;
      }
      toast.success(finalizar ? "Contenção finalizada" : "Registro salvo");
      qc.invalidateQueries({ queryKey: ["contencao"] });
      qc.invalidateQueries({ queryKey: ["contencao-registros", contencaoId] });
      qc.invalidateQueries({ queryKey: ["contencao-resumo-mensal"] });
      qc.invalidateQueries({ queryKey: ["contencao-soma-inspecionada", contencaoId] });
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar registro");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{initial ? "Editar Registro de Turno" : "Novo Registro de Turno"}</DialogTitle>
            <DialogDescription>
              Registre os dados do turno. O Mark Check segue a definição da contenção.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Turno</Label>
              <Select value={turno} onValueChange={setTurno}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TURNOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Início</Label>
              <Input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fim</Label>
              <Input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Local</Label>
            <Input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ex: Linha 3 — Posto 7" />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Co-inspetores</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Users className="w-4 h-4" />
                  {selectedInspetores.length > 0
                    ? `${selectedInspetores.length} selecionado(s)`
                    : "Selecionar Inspetores"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(360px,90vw)] p-2" align="start">
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={inspetorSearch}
                    onChange={(e) => setInspetorSearch(e.target.value)}
                    placeholder="Buscar..."
                    className="pl-7 h-8 text-sm"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto space-y-0.5">
                  {loadingProfiles && <p className="text-xs text-muted-foreground p-2">Carregando...</p>}
                  {!loadingProfiles && filteredProfiles.length === 0 && (
                    <p className="text-xs text-muted-foreground p-2">Nenhum usuário encontrado.</p>
                  )}
                  {filteredProfiles.map((p) => {
                    const checked = selectedInspetores.some((i) => i.id === p.id);
                    return (
                      <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                        <Checkbox checked={checked} onCheckedChange={() => toggleInspetor(p)} />
                        <span className="truncate">{p.nome}</span>
                      </label>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
            {selectedInspetores.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedInspetores.map((i) => (
                  <Badge key={i.id} variant="secondary" className="gap-1">
                    {i.nome}
                    <button type="button" onClick={() => toggleInspetor(i)} className="ml-1 hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Qtd. de inspetores</Label>
              <Input type="number" min={0} value={qtdInspetores} onChange={(e) => setQtdInspetores(Number(e.target.value) || 0)} />
            </div>
          </div>

          {/* Quantidade a Inspecionar */}
          <div className="rounded-md border p-3 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Label className="text-sm font-medium">Quantidade a Inspecionar</Label>
              {estoqueMobis > 0 && (
                <Badge variant={estoqueAcabou ? "destructive" : "secondary"}>
                  Restante: {restante} / {estoqueMobis}
                </Badge>
              )}
            </div>
            <Input
              type="number"
              min={0}
              max={estoqueMobis > 0 ? restante + (initial?.qtd_inspecionada || 0) : undefined}
              value={qtdInspecionada}
              disabled={estoqueMobis > 0 && estoqueAcabou && !initial}
              onChange={(e) => {
                const v = Number(e.target.value) || 0;
                if (estoqueMobis > 0) {
                  const limit = restante + (initial?.qtd_inspecionada || 0);
                  setQtdInspecionada(Math.min(v, limit));
                } else {
                  setQtdInspecionada(v);
                }
              }}
            />
            {estoqueMobis > 0 && estoqueAcabou && !showDiferenca && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
                <div className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p className="text-xs">
                    O estoque Mobis foi totalmente inspecionado. Caso precise adicionar mais peças, registre a diferença abaixo com justificativa e fotos.
                  </p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowDiferenca(true)} className="gap-2">
                  <Plus className="w-4 h-4" /> Adicionar diferença
                </Button>
              </div>
            )}

            {showDiferenca && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-amber-700 dark:text-amber-400">Diferença adicional</Label>
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setShowDiferenca(false); setQtdDiferenca(0); setJustificativaDiferenca(""); }}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Quantidade adicional</Label>
                  <Input type="number" min={1} value={qtdDiferenca} onChange={(e) => setQtdDiferenca(Number(e.target.value) || 0)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Justificativa</Label>
                  <Textarea rows={2} value={justificativaDiferenca} onChange={(e) => setJustificativaDiferenca(e.target.value)} placeholder="Por que foi necessário adicionar mais peças?" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Foto da falha <span className="text-red-500">*</span></Label>
                  <div className="flex flex-wrap gap-2">
                    {existingFotosFalha.map((path) => (
                      <FotoThumb key={path} path={path} onRemove={() => setExistingFotosFalha((p) => p.filter((x) => x !== path))} />
                    ))}
                    {newFilesFalha.map((file, idx) => (
                      <LocalThumb key={idx} file={file} onRemove={() => setNewFilesFalha((p) => p.filter((_, i) => i !== idx))} />
                    ))}
                  </div>
                  <input ref={falhaFileInputRef} type="file" accept="image/*" multiple hidden
                    onChange={(e) => { if (e.target.files) setNewFilesFalha((p) => [...p, ...Array.from(e.target.files!)]); e.target.value = ""; }} />
                  <Button variant="outline" size="sm" type="button" onClick={() => falhaFileInputRef.current?.click()} className="gap-2">
                    <Upload className="w-4 h-4" /> Adicionar foto da falha
                  </Button>
                </div>
              </div>
            )}
          </div>


          <div className="space-y-1">
            <Label className="text-xs">Observações do turno</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} />
          </div>

          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            {!contencaoConcluida && (
              <Button
                variant="default"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={saving}
                onClick={() => setConfirmFinalize(true)}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" /> Salvar e Finalizar
              </Button>
            )}
            <Button onClick={() => persist(false)} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar Registro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmFinalize} onOpenChange={setConfirmFinalize}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar Contenção?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja finalizar esta contenção? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => { setConfirmFinalize(false); persist(true); }}
            >
              Sim, finalizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const FotoThumb = ({ path, onRemove }: { path: string; onRemove: () => void }) => {
  const [url, setUrl] = useState<string>("");
  useEffect(() => {
    let active = true;
    supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60).then(({ data }) => {
      if (active && data?.signedUrl) setUrl(data.signedUrl);
    });
    return () => { active = false; };
  }, [path]);
  return (
    <div className="relative w-20 h-20 rounded overflow-hidden border bg-muted">
      {url && <img src={url} alt="foto" className="w-full h-full object-cover" />}
      <button type="button" onClick={onRemove} className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};

const LocalThumb = ({ file, onRemove }: { file: File; onRemove: () => void }) => {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <div className="relative w-20 h-20 rounded overflow-hidden border bg-muted">
      <img src={url} alt={file.name} className="w-full h-full object-cover" />
      <button type="button" onClick={onRemove} className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80">
        <X className="w-3 h-3" />
      </button>
      <Camera className="absolute bottom-1 left-1 w-3 h-3 text-white/90 drop-shadow" />
    </div>
  );
};

export default ContencaoRegistroDialog;
