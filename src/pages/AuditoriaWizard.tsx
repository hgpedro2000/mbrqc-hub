import { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, ArrowRight, Camera, Check, Image as ImageIcon, Plus, Trash2, Upload, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/hyundai-mobis-logo.png";
import InAppCamera from "@/components/InAppCamera";
import { compressImage } from "@/lib/compressImage";
import { getAuditPhotoUrl, useAuditPhotoUrl } from "@/lib/auditPhoto";
import { SignedAuditImg } from "@/components/auditoria/SignedAuditImg";


type Participant = { name: string; role?: string; company?: string };
type NcDraft = {
  tempId: string;
  problem_description: string;
  issue_category: string;
  in_charge: string;
  due_date: string;
  before_photo?: File | null;
  before_photo_url?: string | null;
  before_preview?: string | null;
};

const PURPOSE_OPTIONS = ["T/Out", "TFT", "New Car", "CM Validation", "Process Check"];
const PROCESS_OPTIONS = ["Injection", "Assembly", "Paint", "Other"];

const uploadPhotoToBucket = async (file: File, folder: string): Promise<string> => {
  const compressed = await compressImage(file);
  const ext = compressed.name.split(".").pop() || "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("audit-photos").upload(path, compressed);
  if (error) throw error;
  return path;
};

const AuditoriaWizard = () => {
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const { profile, user } = useAuth();
  const qc = useQueryClient();

  const [step, setStep] = useState(1);
  const [cameraOpen, setCameraOpen] = useState<null | "product" | string>(null);

  // Step 1
  const [title, setTitle] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [type, setType] = useState<"processo" | "produto" | "fornecedor">("fornecedor");
  const [place, setPlace] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [auditorName, setAuditorName] = useState(profile?.full_name || "");
  const [picName, setPicName] = useState("");
  const [purpose, setPurpose] = useState<string[]>([]);
  const [processList, setProcessList] = useState<string[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [productName, setProductName] = useState("");
  const [productImage, setProductImage] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null);
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null);

  // Step 2
  const [ncs, setNcs] = useState<NcDraft[]>([]);

  // Step 3
  const [majorRequests, setMajorRequests] = useState<string[]>([""]);
  const [conclusion, setConclusion] = useState("");
  const [scheduleNotes, setScheduleNotes] = useState("");
  const [mbrOk, setMbrOk] = useState<string>("");
  const [mbrNg, setMbrNg] = useState<string>("");
  const [paintOk, setPaintOk] = useState<string>("");
  const [paintNg, setPaintNg] = useState<string>("");

  const isEdit = !!editId;

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const { data, error } = await supabase.from("audits").select("*").eq("id", editId).single();
      if (error) { toast.error(error.message); return; }
      setTitle(data.title || "");
      setSupplierName(data.supplier_name || "");
      setType(data.type);
      setPlace(data.place || "");
      setDateStart(data.audit_date_start || "");
      setDateEnd(data.audit_date_end || "");
      setAuditorName(data.auditor_name || "");
      setPicName(data.pic_name || "");
      setPurpose(data.purpose || []);
      setProcessList(data.process || []);
      setParticipants((data.participants as any) || []);
      setProductName(data.product_name || "");
      setProductImageUrl(data.product_image_url || null);
      setMajorRequests(data.major_requests?.length ? data.major_requests : [""]);
      setConclusion(data.conclusion || "");
      setScheduleNotes(data.schedule_notes || "");
      setMbrOk(data.mbr_aql_ok?.toString() || "");
      setMbrNg(data.mbr_aql_ng?.toString() || "");
      setPaintOk(data.paint_inspection_ok?.toString() || "");
      setPaintNg(data.paint_inspection_ng?.toString() || "");

      const { data: ncData } = await supabase
        .from("audit_ncs")
        .select("*")
        .eq("audit_id", editId)
        .order("seq_number");
      if (ncData) {
        setNcs(ncData.map((n) => ({
          tempId: n.id,
          problem_description: n.problem_description || "",
          issue_category: n.issue_category || "",
          in_charge: n.in_charge || "",
          due_date: n.due_date || "",
          before_photo_url: n.before_photo_url,
          before_preview: n.before_photo_url
            ? supabase.storage.from("audit-photos").getPublicUrl(n.before_photo_url).data.publicUrl
            : null,
        })));
      }
    })();
  }, [editId, isEdit]);

  const togglePurpose = (v: string) =>
    setPurpose((p) => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);
  const toggleProcess = (v: string) =>
    setProcessList((p) => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);

  const addParticipant = () => setParticipants((p) => [...p, { name: "", role: "", company: "" }]);
  const updateParticipant = (idx: number, field: keyof Participant, val: string) =>
    setParticipants((p) => p.map((x, i) => i === idx ? { ...x, [field]: val } : x));
  const removeParticipant = (idx: number) =>
    setParticipants((p) => p.filter((_, i) => i !== idx));

  const addNc = () => setNcs((n) => [...n, {
    tempId: crypto.randomUUID(),
    problem_description: "",
    issue_category: "",
    in_charge: "",
    due_date: "",
  }]);
  const updateNc = (id: string, patch: Partial<NcDraft>) =>
    setNcs((n) => n.map((x) => x.tempId === id ? { ...x, ...patch } : x));
  const removeNc = (id: string) => setNcs((n) => n.filter((x) => x.tempId !== id));

  const handleProductCapture = (file: File) => {
    setProductImage(file);
    setProductImagePreview(URL.createObjectURL(file));
    setCameraOpen(null);
  };
  const handleNcCapture = (ncId: string) => (file: File) => {
    updateNc(ncId, { before_photo: file, before_preview: URL.createObjectURL(file) });
    setCameraOpen(null);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>, cb: (f: File) => void) => {
    const f = e.target.files?.[0];
    if (f) cb(f);
    e.target.value = "";
  };

  const canGoStep2 = title.trim() && supplierName.trim() && dateStart;
  const autoStatus = useMemo(() => {
    if (!dateStart) return "planejada";
    const start = new Date(dateStart + "T12:00:00");
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return start <= today ? "em_andamento" : "planejada";
  }, [dateStart]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      let uploadedProduct = productImageUrl;
      if (productImage) uploadedProduct = await uploadPhotoToBucket(productImage, "product");

      const payload: any = {
        title, supplier_name: supplierName, type, place: place || null,
        audit_date_start: dateStart || null, audit_date_end: dateEnd || null,
        auditor_name: auditorName || null, pic_name: picName || null,
        purpose, process: processList, participants: participants as any,
        product_name: productName || null, product_image_url: uploadedProduct,
        major_requests: majorRequests.filter((r) => r.trim()),
        conclusion: conclusion || null, schedule_notes: scheduleNotes || null,
        mbr_aql_ok: mbrOk ? Number(mbrOk) : null, mbr_aql_ng: mbrNg ? Number(mbrNg) : null,
        mbr_aql_total: (mbrOk || mbrNg) ? (Number(mbrOk || 0) + Number(mbrNg || 0)) : null,
        paint_inspection_ok: paintOk ? Number(paintOk) : null,
        paint_inspection_ng: paintNg ? Number(paintNg) : null,
        paint_inspection_total: (paintOk || paintNg) ? (Number(paintOk || 0) + Number(paintNg || 0)) : null,
        status: autoStatus,
      };

      let auditId = editId;
      if (isEdit) {
        const { error } = await supabase.from("audits").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        payload.created_by = user?.id;
        payload.auditor_id = user?.id;
        const { data, error } = await supabase.from("audits").insert(payload).select("id").single();
        if (error) throw error;
        auditId = data.id;
      }

      if (isEdit) await supabase.from("audit_ncs").delete().eq("audit_id", auditId);
      for (let i = 0; i < ncs.length; i++) {
        const nc = ncs[i];
        let beforePath = nc.before_photo_url || null;
        if (nc.before_photo) beforePath = await uploadPhotoToBucket(nc.before_photo, `nc/${auditId}`);
        const { error } = await supabase.from("audit_ncs").insert({
          audit_id: auditId,
          seq_number: i + 1,
          problem_description: nc.problem_description || null,
          issue_category: nc.issue_category || null,
          in_charge: nc.in_charge || null,
          due_date: nc.due_date || null,
          before_photo_url: beforePath,
        });
        if (error) throw error;
      }
      return auditId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["audits-v2"] });
      qc.invalidateQueries({ queryKey: ["audit-open-ncs"] });
      toast.success(isEdit ? "Auditoria atualizada" : "Auditoria criada");
      navigate("/auditorias");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate("/auditorias")} className="header-btn header-btn-back">
              <ArrowLeft className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Voltar</span>
            </Button>
            <img src={logo} alt="Hyundai Mobis" className="h-6 sm:h-8 object-contain bg-white rounded-md px-2 py-0.5" />
          </div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-heading font-bold mt-3">
            {isEdit ? "Editar Auditoria" : "Nova Auditoria"}
          </h1>
          {/* Stepper */}
          <div className="flex items-center gap-2 mt-4">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                  step === s ? "bg-accent text-accent-foreground border-accent"
                  : step > s ? "bg-emerald-500 text-white border-emerald-500"
                  : "bg-transparent text-primary-foreground/70 border-primary-foreground/30"
                }`}>
                  {step > s ? <Check className="w-4 h-4" /> : s}
                </div>
                <div className="text-xs sm:text-sm text-primary-foreground/80 hidden md:inline">
                  {s === 1 ? "Dados gerais" : s === 2 ? `NCs (${ncs.length})` : "Conclusão"}
                </div>
                {s < 3 && <div className={`flex-1 h-0.5 ${step > s ? "bg-emerald-500" : "bg-primary-foreground/20"}`} />}
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 max-w-4xl">
        {step === 1 && (
          <div className="space-y-4">
            <Card className="p-4 space-y-4">
              <h2 className="font-heading font-semibold">Dados Gerais</h2>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <Label>Título *</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Supplier Visit Report - ACME" />
                </div>
                <div>
                  <Label>Fornecedor *</Label>
                  <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={type} onValueChange={(v) => setType(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fornecedor">Fornecedor</SelectItem>
                      <SelectItem value="produto">Produto</SelectItem>
                      <SelectItem value="processo">Processo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Local</Label>
                  <Input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Cidade / Planta" />
                </div>
                <div>
                  <Label>PIC (Fornecedor)</Label>
                  <Input value={picName} onChange={(e) => setPicName(e.target.value)} />
                </div>
                <div>
                  <Label>Data início *</Label>
                  <Input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} />
                </div>
                <div>
                  <Label>Data fim</Label>
                  <Input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} />
                </div>
                <div>
                  <Label>Auditor</Label>
                  <Input value={auditorName} onChange={(e) => setAuditorName(e.target.value)} />
                </div>
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <h2 className="font-heading font-semibold">Propósito & Processos</h2>
              <div>
                <Label className="text-xs text-muted-foreground">Propósito</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {PURPOSE_OPTIONS.map((p) => (
                    <label key={p} className={`flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer text-sm ${purpose.includes(p) ? "bg-accent/20 border-accent" : "border-border"}`}>
                      <Checkbox checked={purpose.includes(p)} onCheckedChange={() => togglePurpose(p)} />
                      {p}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Processos auditados</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {PROCESS_OPTIONS.map((p) => (
                    <label key={p} className={`flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer text-sm ${processList.includes(p) ? "bg-accent/20 border-accent" : "border-border"}`}>
                      <Checkbox checked={processList.includes(p)} onCheckedChange={() => toggleProcess(p)} />
                      {p}
                    </label>
                  ))}
                </div>
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-heading font-semibold">Participantes</h2>
                <Button size="sm" variant="outline" onClick={addParticipant} className="gap-1">
                  <UserPlus className="w-4 h-4" /> Adicionar
                </Button>
              </div>
              {participants.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum participante adicionado.</p>
              )}
              {participants.map((p, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                  <Input placeholder="Nome" value={p.name} onChange={(e) => updateParticipant(i, "name", e.target.value)} />
                  <Input placeholder="Cargo" value={p.role || ""} onChange={(e) => updateParticipant(i, "role", e.target.value)} />
                  <Input placeholder="Empresa" value={p.company || ""} onChange={(e) => updateParticipant(i, "company", e.target.value)} />
                  <Button size="icon" variant="ghost" onClick={() => removeParticipant(i)} className="text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </Card>

            <Card className="p-4 space-y-3">
              <h2 className="font-heading font-semibold">Produto</h2>
              <div>
                <Label>Nome do Produto</Label>
                <Input value={productName} onChange={(e) => setProductName(e.target.value)} />
              </div>
              <div>
                <Label>Foto do Produto</Label>
                <div className="flex gap-2 mt-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => setCameraOpen("product")} className="gap-1">
                    <Camera className="w-4 h-4" /> Câmera
                  </Button>
                  <label className="inline-flex">
                    <Button type="button" variant="outline" size="sm" asChild className="gap-1">
                      <span><Upload className="w-4 h-4" /> Galeria</span>
                    </Button>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileInput(e, handleProductCapture)} />
                  </label>
                </div>
                {(productImagePreview || productImageUrl) && (
                  <div className="mt-2 relative inline-block">
                    <img
                      src={productImagePreview || (productImageUrl ? supabase.storage.from("audit-photos").getPublicUrl(productImageUrl).data.publicUrl : "")}
                      alt="Produto"
                      className="max-h-40 rounded border"
                    />
                    <Button size="icon" variant="destructive" className="absolute -top-2 -right-2 h-6 w-6"
                      onClick={() => { setProductImage(null); setProductImagePreview(null); setProductImageUrl(null); }}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-semibold text-lg">
                Não-Conformidades <span className="text-muted-foreground text-sm">({ncs.length})</span>
              </h2>
              <Button onClick={addNc} className="gap-1"><Plus className="w-4 h-4" /> Adicionar NC</Button>
            </div>
            {ncs.length === 0 && (
              <Card className="p-8 text-center text-muted-foreground">
                Nenhuma NC registrada. Adicione a primeira para começar.
              </Card>
            )}
            {ncs.map((nc, i) => (
              <Card key={nc.tempId} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-mono bg-muted/40 px-2 py-0.5 rounded">NC #{i + 1}</span>
                  <Button size="icon" variant="ghost" onClick={() => removeNc(nc.tempId)} className="text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div>
                  <Label>Descrição do problema</Label>
                  <Textarea rows={3} value={nc.problem_description}
                    onChange={(e) => updateNc(nc.tempId, { problem_description: e.target.value })} />
                </div>
                <div className="grid md:grid-cols-3 gap-3">
                  <div>
                    <Label>Categoria</Label>
                    <Input value={nc.issue_category} onChange={(e) => updateNc(nc.tempId, { issue_category: e.target.value })}
                      placeholder="Ex: 5S, Processo, Documentação" />
                  </div>
                  <div>
                    <Label>Responsável</Label>
                    <Input value={nc.in_charge} onChange={(e) => updateNc(nc.tempId, { in_charge: e.target.value })} />
                  </div>
                  <div>
                    <Label>Prazo</Label>
                    <Input type="date" value={nc.due_date}
                      onChange={(e) => updateNc(nc.tempId, { due_date: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Foto Before</Label>
                  <div className="flex gap-2 mt-1">
                    <Button type="button" variant="outline" size="sm" onClick={() => setCameraOpen(nc.tempId)} className="gap-1">
                      <Camera className="w-4 h-4" /> Câmera
                    </Button>
                    <label>
                      <Button type="button" variant="outline" size="sm" asChild className="gap-1">
                        <span><Upload className="w-4 h-4" /> Galeria</span>
                      </Button>
                      <input type="file" accept="image/*" className="hidden"
                        onChange={(e) => handleFileInput(e, handleNcCapture(nc.tempId))} />
                    </label>
                  </div>
                  {nc.before_preview && (
                    <div className="mt-2 relative inline-block">
                      <img src={nc.before_preview} alt="Before" className="max-h-32 rounded border" />
                      <Button size="icon" variant="destructive" className="absolute -top-2 -right-2 h-6 w-6"
                        onClick={() => updateNc(nc.tempId, { before_photo: null, before_preview: null, before_photo_url: null })}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <Card className="p-4 space-y-3">
              <h2 className="font-heading font-semibold">Pedidos de Melhoria</h2>
              {majorRequests.map((req, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={req} onChange={(e) => setMajorRequests((r) => r.map((x, idx) => idx === i ? e.target.value : x))}
                    placeholder={`Pedido ${i + 1}`} />
                  <Button variant="ghost" size="icon" onClick={() => setMajorRequests((r) => r.filter((_, idx) => idx !== i))}
                    className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => setMajorRequests((r) => [...r, ""])} className="gap-1">
                <Plus className="w-4 h-4" /> Adicionar pedido
              </Button>
            </Card>

            <Card className="p-4 space-y-3">
              <h2 className="font-heading font-semibold">Indicadores</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div><Label>MBR AQL OK</Label><Input type="number" value={mbrOk} onChange={(e) => setMbrOk(e.target.value)} /></div>
                <div><Label>MBR AQL NG</Label><Input type="number" value={mbrNg} onChange={(e) => setMbrNg(e.target.value)} /></div>
                <div><Label>Paint Insp. OK</Label><Input type="number" value={paintOk} onChange={(e) => setPaintOk(e.target.value)} /></div>
                <div><Label>Paint Insp. NG</Label><Input type="number" value={paintNg} onChange={(e) => setPaintNg(e.target.value)} /></div>
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <h2 className="font-heading font-semibold">Conclusão</h2>
              <Textarea rows={5} value={conclusion} onChange={(e) => setConclusion(e.target.value)}
                placeholder="Resumo geral, avaliação, próximos passos..." />
              <Label>Notas de cronograma</Label>
              <Textarea rows={3} value={scheduleNotes} onChange={(e) => setScheduleNotes(e.target.value)}
                placeholder="Ex: seguir up daily meeting..." />
            </Card>

            <Card className="p-4 bg-muted/20">
              <h3 className="font-semibold text-sm mb-2">Resumo automático</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Fornecedor: <span className="text-foreground">{supplierName || "—"}</span></li>
                <li>• Data: <span className="text-foreground">{dateStart || "—"}{dateEnd ? ` → ${dateEnd}` : ""}</span></li>
                <li>• NCs registradas: <span className="text-foreground">{ncs.length}</span></li>
                <li>• Participantes: <span className="text-foreground">{participants.length}</span></li>
                <li>• Status inicial: <span className="text-foreground">{autoStatus === "planejada" ? "Planejada" : "Em andamento"}</span></li>
              </ul>
            </Card>
          </div>
        )}

        <div className="flex justify-between pt-4 pb-8">
          <Button variant="outline" disabled={step === 1} onClick={() => setStep((s) => s - 1)} className="gap-1">
            <ArrowLeft className="w-4 h-4" /> Anterior
          </Button>
          {step < 3 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={step === 1 && !canGoStep2} className="gap-1">
              Próximo <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-1">
              <Check className="w-4 h-4" /> {isEdit ? "Salvar alterações" : "Criar auditoria"}
            </Button>
          )}
        </div>
      </main>

      <InAppCamera
        open={cameraOpen !== null}
        onClose={() => setCameraOpen(null)}
        onCapture={(file) => {
          if (cameraOpen === "product") handleProductCapture(file);
          else if (cameraOpen) handleNcCapture(cameraOpen)(file);
        }}
      />
    </div>
  );
};

export default AuditoriaWizard;
