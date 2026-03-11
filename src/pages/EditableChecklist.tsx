import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Camera, Send, X, Plus, Trash2, CheckCircle2, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uploadPhotos } from "@/lib/uploadPhotos";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/useUserRole";
import { useTranslation } from "react-i18next";
import ExitConfirmDialog from "@/components/ExitConfirmDialog";
import SupplierPartSelector from "@/components/SupplierPartSelector";

interface ChecklistItem { id: string; label: string; type: "check" | "text"; }

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

interface EditableChecklistProps { title: string; headerLabel: string; defaultItems: ChecklistItem[]; checklistType: "painting" | "assembly"; tableName: "painting_checklists" | "assembly_checklists"; }

const EditableChecklistPage = ({ title, headerLabel, defaultItems, checklistType, tableName }: EditableChecklistProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const { profile } = useAuth();
  const { isAdmin } = useUserRole();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<ChecklistItem[]>(defaultItems);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [newItemLabel, setNewItemLabel] = useState("");
  const [photos, setPhotos] = useState<{ name: string; url: string; file: File }[]>([]);
  const [comments, setComments] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [nome] = useState(profile?.full_name || "");
  const [data, setData] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [partName, setPartName] = useState("");
  const [projeto, setProjeto] = useState("");
  const [modulo, setModulo] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [pendingNav, setPendingNav] = useState<string | null>(null);
  const [recordId, setRecordId] = useState<string | null>(id || null);
  const [currentStatus, setCurrentStatus] = useState<string>("submitted");

  const { data: existing } = useQuery({
    queryKey: [`${tableName}-edit`, id],
    queryFn: async () => { const { data, error } = await supabase.from(tableName).select("*").eq("id", id!).single(); if (error) throw error; return data; },
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing) {
      setData(existing.data); setComments(existing.comentarios || "");
      setCurrentStatus((existing as any).status || "submitted");
      if ((existing as any).fornecedor) setFornecedor((existing as any).fornecedor);
      if ((existing as any).part_number) setPartNumber((existing as any).part_number);
      if ((existing as any).part_name) setPartName((existing as any).part_name);
      if ((existing as any).projeto) setProjeto((existing as any).projeto);
      if ((existing as any).modulo) setModulo((existing as any).modulo);
      if (Array.isArray(existing.items) && existing.items.length > 0) setItems(existing.items.map((item: any) => ({ id: item.id, label: item.label, type: "check" as const })));
      if (Array.isArray(existing.checked_items)) setCheckedItems(new Set(existing.checked_items as string[]));
      setRecordId(existing.id);
    }
  }, [existing]);

  // Track changes
  useEffect(() => {
    if (!existing && !isEdit) { setHasChanges(data !== "" || comments !== "" || checkedItems.size > 0 || photos.length > 0); return; }
    if (existing) { setHasChanges(true); }
  }, [data, comments, checkedItems, photos, items]);

  // Browser beforeunload
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (hasChanges && !submitted) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasChanges, submitted]);

  const handleNavigate = useCallback((path: string) => {
    if (hasChanges && !submitted) { setPendingNav(path); setShowExitDialog(true); } else { navigate(path); }
  }, [hasChanges, submitted, navigate]);

  const buildPayload = () => {
    const itemsData = items.map((item) => ({ id: item.id, label: item.label }));
    const checkedData = Array.from(checkedItems);
    return { nome, data: data || new Date().toISOString().split("T")[0], items: itemsData, checked_items: checkedData, comentarios: comments || null, projeto, fornecedor, part_number: partNumber, part_name: partName, modulo };
  };

  const saveDraft = useCallback(async () => {
    setDraftLoading(true);
    try {
      const payload = { ...buildPayload(), status: "draft" };
      if (recordId) {
        const { error } = await supabase.from(tableName).update(payload as any).eq("id", recordId);
        if (error) throw error;
      } else {
        const { data: userData } = await supabase.auth.getUser();
        const insertPayload = { ...payload, created_by: userData?.user?.id || null };
        const { data: record, error } = await supabase.from(tableName).insert(insertPayload as any).select("id").single();
        if (error) throw error;
        setRecordId(record.id);
      }
      if (photos.length > 0 && recordId) await uploadPhotos(photos.map((p) => p.file), recordId, checklistType);
      setCurrentStatus("draft");
      setHasChanges(false);
      toast.success(t("common.draftSaved"));
    } catch (error: any) {
      console.error("Draft save error:", error);
      toast.error(t("common.draftSaveError"), { description: error.message });
    } finally { setDraftLoading(false); }
  }, [recordId, items, checkedItems, comments, data, nome, photos, tableName, checklistType, t]);

  const addItem = () => { if (!newItemLabel.trim()) return; setItems((prev) => [...prev, { id: Date.now().toString(), label: newItemLabel.trim(), type: "check" }]); setNewItemLabel(""); };
  const removeItem = (id: string) => { setItems((prev) => prev.filter((item) => item.id !== id)); setCheckedItems((prev) => { const n = new Set(prev); n.delete(id); return n; }); };
  const toggleCheck = (id: string) => { setCheckedItems((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); };
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const files = e.target.files; if (!files) return; setPhotos((prev) => [...prev, ...Array.from(files).map((f) => ({ name: f.name, url: URL.createObjectURL(f), file: f }))]); };
  const removePhoto = (index: number) => { setPhotos((prev) => prev.filter((_, i) => i !== index)); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !data) { toast.error(t("editableChecklist.fillNameDate")); return; }
    setLoading(true);
    try {
      const payload = { ...buildPayload(), status: "submitted" };
      if (recordId) { const { error } = await supabase.from(tableName).update(payload as any).eq("id", recordId); if (error) throw error; }
      else {
        const { data: userData } = await supabase.auth.getUser();
        const insertPayload = { ...payload, created_by: userData?.user?.id || null };
        const { data: record, error } = await supabase.from(tableName).insert(insertPayload as any).select("id").single();
        if (error) throw error;
        setRecordId(record.id);
      }
      if (photos.length > 0 && recordId) await uploadPhotos(photos.map((p) => p.file), recordId, checklistType);
      setSubmitted(true);
      setHasChanges(false);
      toast.success(isEdit ? t("tryout.updateSuccess") : t("tryout.submitSuccess"));
      setTimeout(() => navigate("/tryout/registros"), 2000);
    } catch (error: any) { console.error("Submit error:", error); toast.error(t("tryout.submitError"), { description: error.message }); } finally { setLoading(false); }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
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
        <div className="container mx-auto px-4 py-6">
          <button onClick={() => handleNavigate("/tryout")} className="flex items-center gap-2 text-primary-foreground/70 hover:text-primary-foreground transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" /><span className="text-sm">{t("common.back")}</span>
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-heading font-bold">{isEdit ? `${t("common.edit")} ${title}` : title}</h1>
            {currentStatus === "draft" && <Badge variant="outline" className="border-yellow-500 text-yellow-300">{t("common.draft")}</Badge>}
          </div>
          <p className="text-primary-foreground/70 text-sm mt-1">{headerLabel}</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="form-section">
            <h3 className="form-section-title">{t("editableChecklist.identification")}</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>{t("common.name")} *</Label><Input required value={nome} readOnly className="bg-muted" /></div>
              <div className="space-y-2"><Label>{t("common.date")} *</Label><Input type="date" required value={data} onChange={(e) => setData(e.target.value)} /></div>
              <SupplierPartSelector
                fornecedor={fornecedor}
                partNumber={partNumber}
                partName={partName}
                projeto={projeto}
                modulo={modulo}
                onFornecedorChange={setFornecedor}
                onPartNumberChange={setPartNumber}
                onPartDataChange={(d) => {
                  setPartName(d.part_name);
                  setModulo(d.line_module);
                  setProjeto(d.project);
                }}
              />
            </div>
          </div>

          <div className="form-section">
            <h3 className="form-section-title">{t("editableChecklist.checklist")}</h3>
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 group">
                  <Checkbox checked={checkedItems.has(item.id)} onCheckedChange={() => toggleCheck(item.id)} />
                  <span className={`flex-1 text-sm ${checkedItems.has(item.id) ? "line-through text-muted-foreground" : "text-foreground"}`}>{item.label}</span>
                  {isAdmin && <button type="button" onClick={() => removeItem(item.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive"><Trash2 className="w-4 h-4" /></button>}
                </div>
              ))}
            </div>
            {isAdmin && (
              <div className="flex gap-2 mt-4">
                <Input value={newItemLabel} onChange={(e) => setNewItemLabel(e.target.value)} placeholder={t("editableChecklist.addNewItem")} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem())} />
                <Button type="button" variant="outline" onClick={addItem} size="icon"><Plus className="w-4 h-4" /></Button>
              </div>
            )}
          </div>

          <div className="form-section">
            <h3 className="form-section-title">{t("common.comments")}</h3>
            <Textarea value={comments} onChange={(e) => setComments(e.target.value)} placeholder={t("common.additionalObs")} rows={4} />
          </div>

          <div className="form-section">
            <h3 className="form-section-title"><Camera className="w-5 h-5" /> {t("common.photos")}</h3>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full border-dashed border-2 h-20 text-muted-foreground hover:text-foreground hover:border-accent">
              <Camera className="w-5 h-5 mr-2" /> {t("common.addPhotos")}
            </Button>
            {photos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-4">
                {photos.map((photo, i) => (
                  <div key={i} className="relative group rounded-lg overflow-hidden aspect-square border border-border"><img src={photo.url} alt={photo.name} className="w-full h-full object-cover" /><button type="button" onClick={() => removePhoto(i)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button></div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button type="button" variant="outline" size="lg" disabled={draftLoading} onClick={saveDraft} className="flex-1 font-heading font-semibold text-base h-14 gap-2">
              {draftLoading ? (<><Loader2 className="w-5 h-5 animate-spin" />{t("common.savingDraft")}</>) : (<><Save className="w-5 h-5" />{t("common.saveDraft")}</>)}
            </Button>
            <Button type="submit" size="lg" disabled={loading} className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90 font-heading font-semibold text-base h-14">
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

export const PaintingPage = () => {
  const { t } = useTranslation();
  return <EditableChecklistPage title={t("tryout.painting.formTitle")} headerLabel={t("tryout.painting.headerLabel")} defaultItems={defaultPaintingItems} checklistType="painting" tableName="painting_checklists" />;
};

export const AssemblyPage = () => {
  const { t } = useTranslation();
  return <EditableChecklistPage title={t("tryout.assembly.formTitle")} headerLabel={t("tryout.assembly.headerLabel")} defaultItems={defaultAssemblyItems} checklistType="assembly" tableName="assembly_checklists" />;
};
