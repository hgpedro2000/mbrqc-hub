import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Camera, Send, X, CheckCircle2, Loader2, Plus, Trash2, Save } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import ExitConfirmDialog from "@/components/ExitConfirmDialog";

interface DefectEntry {
  description: string;
  needs_improvement: boolean;
  improvement_category: string;
  failure_mode: string;
  photos: { name: string; url: string; file: File }[];
}

const InjectionForm = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const { profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dimensionalFileRef = useRef<HTMLInputElement>(null);
  const defectFileRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [photos, setPhotos] = useState<{ name: string; url: string; file: File }[]>([]);
  const [photoType, setPhotoType] = useState<string>("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [pendingNav, setPendingNav] = useState<string | null>(null);
  const [draftRecordId, setDraftRecordId] = useState<string | null>(id || null);
  const [currentStatus, setCurrentStatus] = useState<string>("submitted");
  const formRef = useRef<HTMLFormElement>(null);

  const [fornecedor, setFornecedor] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [partName, setPartName] = useState("");
  const [projeto, setProjeto] = useState("");
  const [modulo, setModulo] = useState("");
  const [razaoTryout, setRazaoTryout] = useState("");
  const [razaoTryoutOutro, setRazaoTryoutOutro] = useState("");

  const [totalPecas, setTotalPecas] = useState<number>(0);
  const [pecasNG, setPecasNG] = useState<number>(0);
  const pecasOK = Math.max(0, totalPecas - pecasNG);
  const rateOK = totalPecas > 0 ? ((pecasOK / totalPecas) * 100).toFixed(1) : "0.0";
  const rateNG = totalPecas > 0 ? ((pecasNG / totalPecas) * 100).toFixed(1) : "0.0";

  // Dimensional cascade state
  const [dimensionalStatus, setDimensionalStatus] = useState<string>("");
  const [dimensionalMotivo, setDimensionalMotivo] = useState("");
  const [dimensionalPhotos, setDimensionalPhotos] = useState<{ name: string; url: string; file: File }[]>([]);

  const [defects, setDefects] = useState<DefectEntry[]>([]);
  const [defaults, setDefaults] = useState<Record<string, any>>({});

  const { data: existing } = useQuery({
    queryKey: ["injection-edit", id],
    queryFn: async () => { const { data, error } = await supabase.from("injection_checklists").select("*").eq("id", id!).single(); if (error) throw error; return data; },
    enabled: isEdit,
  });

  const { data: defectCategories } = useQuery({
    queryKey: ["defect_categories_active"],
    queryFn: async () => { const { data, error } = await supabase.from("defect_categories").select("*").eq("active", true).order("code"); if (error) throw error; return data; },
  });

  const { data: defectsList } = useQuery({
    queryKey: ["defects_active"],
    queryFn: async () => { const { data, error } = await supabase.from("defects").select("*").eq("active", true).order("code"); if (error) throw error; return data; },
  });

  useEffect(() => {
    if (existing) {
      setFornecedor(existing.fornecedor); setPartNumber(existing.part_number); setPartName(existing.part_name);
      setProjeto(existing.projeto); setModulo(existing.modulo);
      setTotalPecas((existing as any).total_pecas || 0); setPecasNG((existing as any).pecas_ng || 0);
      setRazaoTryout((existing as any).razao_tryout || ""); setRazaoTryoutOutro((existing as any).razao_tryout_outro || "");
      setCurrentStatus((existing as any).status || "submitted");
      setDraftRecordId(existing.id);
      // Parse dimensional
      const dim = existing.dimensional || "";
      if (dim.startsWith("Não feito:")) {
        setDimensionalStatus("nao_feito");
        setDimensionalMotivo(dim.replace("Não feito: ", ""));
      } else if (dim === "Realizado" || dim.startsWith("Realizado")) {
        setDimensionalStatus("realizado");
      } else if (dim === "N/A") {
        setDimensionalStatus("na");
      } else if (dim) {
        setDimensionalStatus("realizado");
      }
      const existingDefects = (existing as any).defects as any[] | undefined;
      if (existingDefects && existingDefects.length > 0) {
        setDefects(existingDefects.map((d: any) => ({ description: d.description || "", needs_improvement: d.needs_improvement || false, improvement_category: d.improvement_category || "", failure_mode: d.failure_mode || "", photos: [] })));
      }
      setDefaults(existing);
    }
  }, [existing]);

  useEffect(() => {
    setHasChanges(fornecedor !== "" || partNumber !== "" || totalPecas > 0 || photos.length > 0);
  }, [fornecedor, partNumber, totalPecas, photos, defects]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (hasChanges && !submitted) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasChanges, submitted]);

  const handleNavigate = useCallback((path: string) => {
    if (hasChanges && !submitted) { setPendingNav(path); setShowExitDialog(true); } else { navigate(path); }
  }, [hasChanges, submitted, navigate]);

  const getDimensionalValue = () => {
    if (dimensionalStatus === "na") return "N/A";
    if (dimensionalStatus === "nao_feito") return `Não feito: ${dimensionalMotivo}`;
    if (dimensionalStatus === "realizado") return "Realizado";
    return "";
  };

  const buildDraftPayload = useCallback(() => {
    const formData = formRef.current ? new FormData(formRef.current) : null;
    return {
      nome: profile?.full_name || "", data: formData?.get("data") as string || new Date().toISOString().split("T")[0], fornecedor, projeto,
      part_number: partNumber, part_name: partName, modulo, qtd_tryout: Number(formData?.get("qtdTryout") || 1),
      materia_prima: (formData?.get("materiaPrima") as string) || "", injetora: (formData?.get("injetora") as string) || "",
      tonelagem: Number(formData?.get("tonelagem") || 0), cycle_time: Number(formData?.get("cycleTime") || 0),
      cooling_time: Number(formData?.get("coolingTime") || 0), weight: Number(formData?.get("weight") || 0),
      dimensional: getDimensionalValue(), comentarios: (formData?.get("comentarios") as string) || null,
      razao_tryout: razaoTryout, razao_tryout_outro: razaoTryoutOutro,
      total_pecas: totalPecas, pecas_ok: pecasOK, pecas_ng: pecasNG,
      rate: totalPecas > 0 ? parseFloat(((pecasOK / totalPecas) * 100).toFixed(2)) : 0,
      needs_improvement: defects.some(d => d.needs_improvement), improvement_category: null,
      defects: defects.map((d) => ({ description: d.description, needs_improvement: d.needs_improvement, improvement_category: d.needs_improvement ? d.improvement_category : null, failure_mode: d.failure_mode || null })),
      status: "draft",
    };
  }, [fornecedor, projeto, partNumber, partName, modulo, razaoTryout, razaoTryoutOutro, totalPecas, pecasOK, pecasNG, defects, profile, dimensionalStatus, dimensionalMotivo]);

  const saveDraft = useCallback(async () => {
    setDraftLoading(true);
    try {
      const payload = buildDraftPayload();
      if (draftRecordId) {
        const { error } = await supabase.from("injection_checklists").update(payload as any).eq("id", draftRecordId); if (error) throw error;
      } else {
        const { data: userData } = await supabase.auth.getUser();
        const insertPayload = { ...payload, created_by: userData?.user?.id || null };
        const { data: record, error } = await supabase.from("injection_checklists").insert(insertPayload as any).select("id").single();
        if (error) throw error;
        setDraftRecordId(record.id);
      }
      setCurrentStatus("draft");
      setHasChanges(false);
      toast.success(t("common.draftSaved"));
    } catch (error: any) { console.error("Draft save error:", error); toast.error(t("common.draftSaveError"), { description: error.message }); }
    finally { setDraftLoading(false); }
  }, [buildDraftPayload, draftRecordId, t]);

  const handlePartDataChange = (data: { part_name: string; project: string; line_module: string }) => { setPartName(data.part_name); setProjeto(data.project); setModulo(data.line_module); };
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const files = e.target.files; if (!files) return; setPhotos((prev) => [...prev, ...Array.from(files).map((f) => ({ name: f.name, url: URL.createObjectURL(f), file: f }))]); };
  const removePhoto = (index: number) => { setPhotos((prev) => prev.filter((_, i) => i !== index)); };
  const addDefect = () => { setDefects((prev) => [...prev, { description: "", needs_improvement: false, improvement_category: "", failure_mode: "", photos: [] }]); };
  const removeDefect = (index: number) => { setDefects((prev) => prev.filter((_, i) => i !== index)); };
  const updateDefect = (index: number, field: keyof DefectEntry, value: any) => { setDefects((prev) => prev.map((d, i) => i === index ? { ...d, [field]: value } : d)); };
  const addDefectPhoto = (defectIndex: number, e: React.ChangeEvent<HTMLInputElement>) => { const files = e.target.files; if (!files) return; const newPhotos = Array.from(files).map((f) => ({ name: f.name, url: URL.createObjectURL(f), file: f })); setDefects((prev) => prev.map((d, i) => i === defectIndex ? { ...d, photos: [...d.photos, ...newPhotos] } : d)); };
  const removeDefectPhoto = (defectIndex: number, photoIndex: number) => { setDefects((prev) => prev.map((d, i) => i === defectIndex ? { ...d, photos: d.photos.filter((_, pi) => pi !== photoIndex) } : d)); };

  const handleDimensionalPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setDimensionalPhotos((prev) => [...prev, ...Array.from(files).map((f) => ({ name: f.name, url: URL.createObjectURL(f), file: f }))]);
  };
  const removeDimensionalPhoto = (index: number) => { setDimensionalPhotos((prev) => prev.filter((_, i) => i !== index)); };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Allow totalPecas = 0
    if (pecasNG > 0 && defects.length === 0) { toast.error(t("injectionForm.ngRequireDefect")); return; }
    if (!dimensionalStatus) { toast.error("Selecione o status dimensional."); return; }
    if (dimensionalStatus === "nao_feito" && !dimensionalMotivo.trim()) { toast.error("Informe o motivo do dimensional não feito."); return; }
    setLoading(true);
    try {
      const formData = new FormData(e.currentTarget);
      const payload: Record<string, any> = {
        nome: profile?.full_name || (formData.get("nome") as string), data: formData.get("data") as string, fornecedor, projeto,
        part_number: partNumber, part_name: partName, modulo, qtd_tryout: Number(formData.get("qtdTryout")),
        materia_prima: formData.get("materiaPrima") as string, injetora: formData.get("injetora") as string,
        tonelagem: Number(formData.get("tonelagem")), cycle_time: Number(formData.get("cycleTime")),
        cooling_time: Number(formData.get("coolingTime")), weight: Number(formData.get("weight")),
        dimensional: getDimensionalValue(), comentarios: (formData.get("comentarios") as string) || null,
        razao_tryout: razaoTryout, razao_tryout_outro: razaoTryoutOutro,
        total_pecas: totalPecas, pecas_ok: pecasOK, pecas_ng: pecasNG,
        rate: totalPecas > 0 ? parseFloat(((pecasOK / totalPecas) * 100).toFixed(2)) : 0,
        needs_improvement: defects.some(d => d.needs_improvement), improvement_category: null,
        defects: defects.map((d) => ({ description: d.description, needs_improvement: d.needs_improvement, improvement_category: d.needs_improvement ? d.improvement_category : null, failure_mode: d.failure_mode || null })),
        status: "submitted",
      };
      let recordId: string;
      if (draftRecordId) { const { error } = await supabase.from("injection_checklists").update(payload as any).eq("id", draftRecordId); if (error) throw error; recordId = draftRecordId; }
      else { const { data: userData } = await supabase.auth.getUser(); const insertPayload = { ...payload, created_by: userData?.user?.id || null }; const { data, error } = await supabase.from("injection_checklists").insert(insertPayload as any).select("id").single(); if (error) throw error; recordId = data.id; }
      if (photos.length > 0) await uploadPhotos(photos.map((p) => p.file), recordId, "injection");
      if (dimensionalPhotos.length > 0) await uploadPhotos(dimensionalPhotos.map((p) => p.file), recordId, "injection");
      for (const defect of defects) { if (defect.photos.length > 0) await uploadPhotos(defect.photos.map((p) => p.file), recordId, "injection"); }
      setSubmitted(true);
      setHasChanges(false);
      toast.success(isEdit ? t("tryout.updateSuccess") : t("tryout.submitSuccess"));
      setTimeout(() => navigate("/tryout/registros"), 2000);
    } catch (error: any) { console.error("Submit error:", error); toast.error(t("tryout.submitError"), { description: error.message }); } finally { setLoading(false); }
  };

  // Whether rate section is shown (disabled for "Razão do Tryout" context)
  const showRate = !!razaoTryout;

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center opacity-0 animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4"><CheckCircle2 className="w-10 h-10 text-success" /></div>
          <h2 className="text-2xl font-heading font-bold text-foreground">{isEdit ? t("common.updated") : t("common.sent")}</h2>
          <p className="text-muted-foreground mt-2">{t("common.redirecting")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <button onClick={() => handleNavigate("/tryout")} className="flex items-center gap-2 text-primary-foreground/70 hover:text-primary-foreground transition-colors mb-3 sm:mb-4">
            <ArrowLeft className="w-4 h-4" /><span className="text-sm">{t("common.back")}</span>
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-heading font-bold">{isEdit ? t("tryout.injection.editTitle") : t("tryout.injection.formTitle")}</h1>
            {currentStatus === "draft" && <Badge variant="outline" className="border-yellow-500 text-yellow-300">{t("common.draft")}</Badge>}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-3xl">
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {/* Identification */}
          <div className="form-section">
            <h3 className="form-section-title text-sm sm:text-base">{t("injectionForm.identification")}</h3>
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
              <div className="space-y-1.5 sm:space-y-2"><Label htmlFor="nome" className="text-xs sm:text-sm">{t("common.name")} *</Label><Input id="nome" name="nome" required value={profile?.full_name || ""} readOnly className="bg-muted text-sm" /></div>
              <div className="space-y-1.5 sm:space-y-2"><Label htmlFor="data" className="text-xs sm:text-sm">{t("common.date")} *</Label><Input id="data" name="data" type="date" required defaultValue={defaults.data || ""} key={defaults.data || "new"} className="text-sm" /></div>
              <SupplierPartSelector fornecedor={fornecedor} partNumber={partNumber} partName={partName} projeto={projeto} modulo={modulo} onFornecedorChange={setFornecedor} onPartNumberChange={setPartNumber} onPartDataChange={handlePartDataChange} />
            </div>
          </div>

          {/* Part Data */}
          <div className="form-section">
            <h3 className="form-section-title text-sm sm:text-base">{t("injectionForm.partData")}</h3>
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-xs sm:text-sm">{t("injectionForm.tryoutReason")} *</Label>
                <Select value={razaoTryout} onValueChange={(v) => { setRazaoTryout(v); if (v !== "Outro") setRazaoTryoutOutro(""); }}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder={t("injectionForm.selectReason")} /></SelectTrigger>
                  <SelectContent>{["EO", "4M", "Melhoria", "Correção", "Novo Carro", "Outro"].map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-xs sm:text-sm">{razaoTryout === "Outro" ? `${t("injectionForm.specify")} *` : t("injectionForm.detail")}</Label>
                <Input placeholder={razaoTryout === "Outro" ? t("injectionForm.specifyPlaceholder") : t("injectionForm.detailPlaceholder")} value={razaoTryoutOutro} onChange={(e) => setRazaoTryoutOutro(e.target.value)} required={razaoTryout === "Outro"} className="text-sm" />
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="qtdTryout" className="text-xs sm:text-sm">{t("injectionForm.tryoutCount")}*</Label>
                <Select name="qtdTryout" required defaultValue={defaults.qtd_tryout?.toString() || ""} key={`qt-${defaults.qtd_tryout}`}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder={t("common.select")} /></SelectTrigger>
                  <SelectContent>{[1,2,3,4,5,6].map(n => <SelectItem key={n} value={String(n)}>{n}ª</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {/* Total Pecas - allow 0 */}
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="totalPecas" className="text-xs sm:text-sm">{t("injectionForm.totalParts")} *</Label>
                <Input id="totalPecas" type="number" min={0} placeholder="0" value={totalPecas} onChange={(e) => setTotalPecas(Number(e.target.value) || 0)} className="text-sm" />
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="pecasNG" className="text-xs sm:text-sm">{t("injectionForm.partsNG")} *</Label>
                <Input id="pecasNG" type="number" min={0} max={totalPecas} placeholder="0" value={pecasNG} onChange={(e) => setPecasNG(Math.min(Number(e.target.value) || 0, totalPecas))} className="text-sm" />
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="pecasOK" className="text-xs sm:text-sm">{t("injectionForm.partsOK")}</Label>
                <Input id="pecasOK" type="number" value={pecasOK} readOnly className="bg-muted font-semibold text-accent text-sm" />
              </div>

              {/* Rate fields - shown when razaoTryout is NOT the reason (i.e. always show but read-only) */}
              {showRate && (
                <>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-xs sm:text-sm">Rate OK (%)</Label>
                    <Input type="text" value={`${rateOK}%`} readOnly className="bg-muted font-semibold text-accent text-sm" />
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-xs sm:text-sm">Rate NG (%)</Label>
                    <Input type="text" value={`${rateNG}%`} readOnly className="bg-muted font-semibold text-destructive text-sm" />
                  </div>
                  <div className="space-y-1.5 sm:space-y-2 sm:col-span-2">
                    <Label className="text-xs sm:text-sm">{t("injectionForm.rate")}</Label>
                    <div className="flex items-center gap-3">
                      <Input type="text" value={`${rateOK}%`} readOnly className="bg-muted font-semibold text-accent max-w-[120px] text-sm" />
                      <div className="h-3 flex-1 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${Math.min(parseFloat(rateOK), 100)}%` }} />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Process Parameters */}
          <div className="form-section">
            <h3 className="form-section-title text-sm sm:text-base">{t("injectionForm.processParams")}</h3>
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
              <div className="space-y-1.5 sm:space-y-2"><Label htmlFor="materiaPrima" className="text-xs sm:text-sm">{t("injectionForm.rawMaterial")} *</Label><Input id="materiaPrima" name="materiaPrima" required placeholder={t("injectionForm.materialType")} defaultValue={defaults.materia_prima || ""} key={`mp-${defaults.materia_prima}`} className="text-sm" /></div>
              <div className="space-y-1.5 sm:space-y-2"><Label htmlFor="injetora" className="text-xs sm:text-sm">{t("injectionForm.injector")} *</Label><Input id="injetora" name="injetora" required placeholder={t("injectionForm.injectorId")} defaultValue={defaults.injetora || ""} key={`inj-${defaults.injetora}`} className="text-sm" /></div>
              <div className="space-y-1.5 sm:space-y-2"><Label htmlFor="tonelagem" className="text-xs sm:text-sm">{t("injectionForm.tonnage")} *</Label><Input id="tonelagem" name="tonelagem" type="number" required placeholder={t("injectionForm.inTons")} defaultValue={defaults.tonelagem || ""} key={`ton-${defaults.tonelagem}`} className="text-sm" /></div>
              <div className="space-y-1.5 sm:space-y-2"><Label htmlFor="cycleTime" className="text-xs sm:text-sm">{t("injectionForm.cycleTime")} *</Label><Input id="cycleTime" name="cycleTime" type="number" step="0.1" required placeholder={t("injectionForm.seconds")} defaultValue={defaults.cycle_time || ""} key={`ct-${defaults.cycle_time}`} className="text-sm" /></div>
              <div className="space-y-1.5 sm:space-y-2"><Label htmlFor="coolingTime" className="text-xs sm:text-sm">{t("injectionForm.coolingTime")} *</Label><Input id="coolingTime" name="coolingTime" type="number" step="0.1" required placeholder={t("injectionForm.seconds")} defaultValue={defaults.cooling_time || ""} key={`cool-${defaults.cooling_time}`} className="text-sm" /></div>
              <div className="space-y-1.5 sm:space-y-2"><Label htmlFor="weight" className="text-xs sm:text-sm">{t("injectionForm.weight")} *</Label><Input id="weight" name="weight" type="number" step="0.01" required placeholder={t("injectionForm.grams")} defaultValue={defaults.weight || ""} key={`w-${defaults.weight}`} className="text-sm" /></div>
            </div>
          </div>

          {/* Evaluation - Dimensional Cascade */}
          <div className="form-section">
            <h3 className="form-section-title text-sm sm:text-base">{t("injectionForm.evaluation")}</h3>
            <div className="space-y-4">
              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-xs sm:text-sm">{t("injectionForm.dimensional")} *</Label>
                <Select value={dimensionalStatus} onValueChange={(v) => { setDimensionalStatus(v); if (v !== "nao_feito") setDimensionalMotivo(""); if (v !== "realizado") setDimensionalPhotos([]); }}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Selecione o status dimensional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="na">N/A</SelectItem>
                    <SelectItem value="nao_feito">Não feito</SelectItem>
                    <SelectItem value="realizado">Realizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {dimensionalStatus === "nao_feito" && (
                <div className="space-y-1.5 sm:space-y-2 animate-fade-in">
                  <Label className="text-xs sm:text-sm">Motivo *</Label>
                  <Textarea placeholder="Descreva o motivo pelo qual o dimensional não foi feito" value={dimensionalMotivo} onChange={(e) => setDimensionalMotivo(e.target.value)} rows={3} className="text-sm" />
                </div>
              )}

              {dimensionalStatus === "realizado" && (
                <div className="space-y-2 animate-fade-in">
                  <Label className="flex items-center gap-1.5 text-xs sm:text-sm"><Camera className="w-4 h-4" /> Foto do Dimensional</Label>
                  <input ref={dimensionalFileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleDimensionalPhotoUpload} />
                  <Button type="button" variant="outline" size="sm" onClick={() => dimensionalFileRef.current?.click()} className="w-full border-dashed border-2 h-12 text-muted-foreground hover:text-foreground hover:border-accent text-sm">
                    <Camera className="w-4 h-4 mr-2" /> Anexar foto do dimensional
                  </Button>
                  {dimensionalPhotos.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
                      {dimensionalPhotos.map((photo, i) => (
                        <div key={i} className="relative group rounded-lg overflow-hidden aspect-square border border-border">
                          <img src={photo.url} alt={photo.name} className="w-full h-full object-cover" />
                          <button type="button" onClick={() => removeDimensionalPhoto(i)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="comentarios" className="text-xs sm:text-sm">{t("injectionForm.generalComments")}</Label>
                <Textarea id="comentarios" name="comentarios" placeholder={t("common.additionalObs")} rows={4} defaultValue={defaults.comentarios || ""} key={`com-${defaults.comentarios}`} className="text-sm" />
              </div>
            </div>
          </div>

          {/* Defects */}
          <div className="form-section">
            <div className="flex items-center justify-between mb-3">
              <h3 className="form-section-title mb-0 text-sm sm:text-base">{t("injectionForm.defects")}</h3>
              <Button type="button" variant="outline" size="sm" onClick={addDefect} className="gap-1.5 text-xs sm:text-sm" disabled={pecasNG === 0}><Plus className="w-4 h-4" /> {t("injectionForm.addDefect")}</Button>
            </div>
            {pecasNG === 0 && <div className="text-xs sm:text-sm text-muted-foreground text-center py-4 sm:py-6 border border-border rounded-lg bg-muted/30">{t("injectionForm.defectsBlocked")}</div>}
            {pecasNG > 0 && defects.length === 0 && <div className="text-xs sm:text-sm text-destructive text-center py-4 sm:py-6 border border-destructive/30 rounded-lg bg-destructive/5">⚠️ {t("injectionForm.defectsRequired")}</div>}

            <div className="space-y-4">
              {defects.map((defect, idx) => (
                <div key={idx} className="border border-border rounded-lg p-3 sm:p-4 space-y-3 bg-card">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm font-semibold text-foreground">{t("injectionForm.defectNumber")} #{idx + 1}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeDefect(idx)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                  <div className="space-y-1.5"><Label className="text-xs sm:text-sm">{t("injectionForm.defectDescription")} *</Label><Input required placeholder={t("injectionForm.describeDefect")} value={defect.description} onChange={(e) => updateDefect(idx, "description", e.target.value)} className="text-sm" /></div>
                  <div className="space-y-1.5">
                    <Label className="text-xs sm:text-sm">{t("injectionForm.needsImprovement")}</Label>
                    <Select value={defect.needs_improvement ? "sim" : "nao"} onValueChange={(v) => updateDefect(idx, "needs_improvement", v === "sim")}><SelectTrigger className="text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sim">{t("injectionForm.yes")}</SelectItem><SelectItem value="nao">{t("injectionForm.no")}</SelectItem></SelectContent></Select>
                  </div>
                  {defect.needs_improvement && (
                    <div className="space-y-1.5 opacity-0 animate-fade-in">
                      <Label className="text-xs sm:text-sm">{t("injectionForm.improvementCategory")} *</Label>
                      <Select required value={defect.improvement_category} onValueChange={(v) => updateDefect(idx, "improvement_category", v)}>
                        <SelectTrigger className="text-sm"><SelectValue placeholder={t("injectionForm.selectCategory")} /></SelectTrigger>
                        <SelectContent>
                          {defectCategories?.map((cat) => <SelectItem key={cat.id} value={cat.code}>{cat.code} - {cat.description}</SelectItem>)}
                          {(!defectCategories || defectCategories.length === 0) && <SelectItem value="_empty" disabled>{t("injectionForm.noCategories")}</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs sm:text-sm">{t("injectionForm.failureMode")}</Label>
                    <Select value={defect.failure_mode} onValueChange={(v) => updateDefect(idx, "failure_mode", v)}>
                      <SelectTrigger className="text-sm"><SelectValue placeholder={t("injectionForm.selectFailureMode")} /></SelectTrigger>
                      <SelectContent>
                        {defectsList?.map((def) => <SelectItem key={def.id} value={def.code}>{def.code} - {def.description}</SelectItem>)}
                        {(!defectsList || defectsList.length === 0) && <SelectItem value="_empty" disabled>{t("injectionForm.noDefectsCatalog")}</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-xs sm:text-sm"><Camera className="w-4 h-4" /> {t("injectionForm.defectPhotos")}</Label>
                    <input ref={(el) => { defectFileRefs.current[idx] = el; }} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addDefectPhoto(idx, e)} />
                    <Button type="button" variant="outline" size="sm" onClick={() => defectFileRefs.current[idx]?.click()} className="w-full border-dashed border-2 h-12 text-muted-foreground hover:text-foreground hover:border-accent text-sm"><Camera className="w-4 h-4 mr-2" /> {t("common.addPhotos")}</Button>
                    {defect.photos.length > 0 && (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
                        {defect.photos.map((photo, pi) => (
                          <div key={pi} className="relative group rounded-lg overflow-hidden aspect-square border border-border"><img src={photo.url} alt={photo.name} className="w-full h-full object-cover" /><button type="button" onClick={() => removeDefectPhoto(idx, pi)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button></div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Peça OK - photo type is optional */}
          <div className={`form-section ${pecasNG > 0 ? "opacity-50 pointer-events-none" : ""}`}>
            <h3 className="form-section-title text-sm sm:text-base"><Camera className="w-5 h-5" /> {t("injectionForm.pieceOK")} {pecasNG > 0 && <span className="text-xs text-muted-foreground ml-2">({t("injectionForm.enabledOnlyNoNG")})</span>}</h3>
            {pecasNG === 0 && totalPecas > 0 && (
              <div className="mb-4 space-y-1.5 sm:space-y-2">
                <Label className="text-xs sm:text-sm">{t("injectionForm.photoType")}</Label>
                <Select value={photoType} onValueChange={setPhotoType} disabled={pecasNG > 0}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder={t("injectionForm.selectPhotoType")} /></SelectTrigger>
                  <SelectContent><SelectItem value="peca_referencia">{t("injectionForm.referencePart")}</SelectItem><SelectItem value="peca_final">{t("injectionForm.finalPart")}</SelectItem></SelectContent>
                </Select>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} disabled={pecasNG > 0} />
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={pecasNG > 0} className="w-full border-dashed border-2 h-16 sm:h-20 text-muted-foreground hover:text-foreground hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed text-sm">
              <Camera className="w-5 h-5 mr-2" /> {pecasNG > 0 ? t("injectionForm.photosBlocked") : t("common.addPhotos")}
            </Button>
            {photos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3 mt-4">
                {photos.map((photo, i) => (
                  <div key={i} className="relative group rounded-lg overflow-hidden aspect-square border border-border"><img src={photo.url} alt={photo.name} className="w-full h-full object-cover" /><button type="button" onClick={() => removePhoto(i)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button></div>
                ))}
              </div>
            )}
          </div>

          {/* Submit buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button type="button" variant="outline" size="lg" disabled={draftLoading} onClick={saveDraft} className="flex-1 font-heading font-semibold text-sm sm:text-base h-12 sm:h-14 gap-2">
              {draftLoading ? (<><Loader2 className="w-5 h-5 animate-spin" />{t("common.savingDraft")}</>) : (<><Save className="w-5 h-5" />{t("common.saveDraft")}</>)}
            </Button>
            <Button type="submit" size="lg" disabled={loading} className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90 font-heading font-semibold text-sm sm:text-base h-12 sm:h-14">
              {loading ? (<><Loader2 className="w-5 h-5 mr-2 animate-spin" />{isEdit ? t("common.saving") : t("common.sending")}</>) : (<><Send className="w-5 h-5 mr-2" />{isEdit ? t("injectionForm.saveChanges") : t("injectionForm.sendChecklist")}</>)}
            </Button>
          </div>
        </form>
      </main>

      <ExitConfirmDialog
        open={showExitDialog}
        onSaveAndExit={async () => { await saveDraft(); setShowExitDialog(false); if (pendingNav) navigate(pendingNav); }}
        onExitWithoutSave={() => { setShowExitDialog(false); if (pendingNav) navigate(pendingNav); }}
        onCancel={() => { setShowExitDialog(false); setPendingNav(null); }}
        saving={draftLoading}
      />
    </div>
  );
};

export default InjectionForm;
