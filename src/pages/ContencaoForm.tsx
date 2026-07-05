import { useState, useEffect, useMemo, useRef } from "react";
import { getLocalDateString } from "@/lib/localDate";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, Save, ShieldAlert, Loader2, Upload, X, Camera } from "lucide-react";
import { useDropdownOptions } from "@/hooks/useDropdownOptions";
import { useAuth } from "@/contexts/AuthContext";
import SupplierPartSelector from "@/components/SupplierPartSelector";
import { toast } from "sonner";
import { compressImage } from "@/lib/compressImage";
import logo from "@/assets/hyundai-mobis-logo.png";
import { useTranslation } from "react-i18next";

const BUCKET = "containment-photos";

const LOCAL_OPTIONS = [
  { value: "fornecedor_lp", label: "Fornecedor LP" },
  { value: "fornecedor_ckd", label: "Fornecedor CKD" },
  { value: "processo_mbr", label: "Processo MBR" },
  { value: "processo_hmb", label: "Processo HMB" },
];

const ContencaoForm = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const markFileRef = useRef<HTMLInputElement>(null);
  const probFileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    tipo: "fornecedor_lp", // repurposed: agora é "Local" (responsabilidade)
    titulo: "",
    responsavel: profile?.full_name || "",
    data: getLocalDateString(),
    setor: "", linha: "",
    local: "", // Local de Início de Contenção (texto livre)
    part_number: "", part_name: "", fornecedor: "",
    estoque_indefinido: false,
    quantidade_pecas: 0,
    estoque_mobis: 0,
    motivo: "", acao_contencao: "", status: "emitida", observacoes: "",
    mark_check_local: "",
    mark_check_como: "",
    mark_check_com_que: "",
  });

  const [existingMarkFotos, setExistingMarkFotos] = useState<string[]>([]);
  const [newMarkFiles, setNewMarkFiles] = useState<File[]>([]);
  const [existingProbFotos, setExistingProbFotos] = useState<string[]>([]);
  const [newProbFiles, setNewProbFiles] = useState<File[]>([]);

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ["contencao-edit", id],
    queryFn: async () => { const { data, error } = await supabase.from("contencao").select("*").eq("id", id!).single(); if (error) throw error; return data; },
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing) {
      const e: any = existing;
      setForm({
        tipo: e.tipo,
        titulo: e.titulo,
        responsavel: e.responsavel,
        data: e.data,
        setor: e.setor || "",
        linha: e.linha || "",
        local: e.local || "",
        part_number: e.part_number || "",
        part_name: e.part_name || "",
        fornecedor: e.fornecedor || "",
        estoque_indefinido: !!e.estoque_indefinido,
        quantidade_pecas: e.quantidade_contida || 0,
        estoque_mobis: e.quantidade_aprovada || 0,
        motivo: e.motivo || "",
        acao_contencao: e.acao_contencao || "",
        status: e.status,
        observacoes: e.observacoes || "",
        mark_check_local: e.mark_check_local || "",
        mark_check_como: e.mark_check_como || "",
        mark_check_com_que: e.mark_check_com_que || "",
      });
      setExistingMarkFotos(Array.isArray(e.mark_check_fotos) ? e.mark_check_fotos : []);
      setExistingProbFotos(Array.isArray(e.fotos_problema) ? e.fotos_problema : []);
    }
  }, [existing]);

  const { data: setores = [] } = useDropdownOptions("setor");
  const { data: linhas = [] } = useDropdownOptions("linha");
  const set = (field: string, value: any) => setForm((p) => ({ ...p, [field]: value }));

  const uploadFiles = async (files: File[], contencaoId: string, kind: "markcheck" | "problema"): Promise<string[]> => {
    const paths: string[] = [];
    for (const file of files) {
      const compressed = await compressImage(file);
      const ext = (compressed.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${contencaoId}/contencao/${kind}-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, compressed);
      if (error) { console.error("upload", error); continue; }
      paths.push(path);
    }
    return paths;
  };

  const handleSave = async () => {
    if (!form.titulo || !form.responsavel) { toast.error(t("contencao.fillRequired")); return; }
    if (!form.mark_check_local.trim() || !form.mark_check_como.trim() || !form.mark_check_com_que.trim()) {
      toast.error(t("contencao.fillMarkCheck"));
      return;
    }
    if (existingMarkFotos.length === 0 && newMarkFiles.length === 0) {
      toast.error(t("contencao.requireMarkFoto"));
      return;
    }
    if (existingProbFotos.length === 0 && newProbFiles.length === 0) {
      toast.error(t("contencao.requireProbFoto"));
      return;
    }
    setSaving(true);
    try {
      // Pre-generate id for new records so we can upload photos BEFORE insert.
      // (RLS only allows admin/lider/engenharia to UPDATE contencao, so we must
      // persist the photo arrays in the INSERT itself.)
      const savedId = id || crypto.randomUUID();

      let finalMark = [...existingMarkFotos];
      let finalProb = [...existingProbFotos];
      if (newMarkFiles.length) {
        const up = await uploadFiles(newMarkFiles, savedId, "markcheck");
        finalMark = [...finalMark, ...up];
      }
      if (newProbFiles.length) {
        const up = await uploadFiles(newProbFiles, savedId, "problema");
        finalProb = [...finalProb, ...up];
      }

      const payload: any = {
        tipo: form.tipo,
        responsabilidade: form.tipo,
        titulo: form.titulo, responsavel: form.responsavel, data: form.data,
        setor: form.setor || null, linha: form.linha || null, local: form.local || null,
        part_number: form.part_number || null, part_name: form.part_name || null, fornecedor: form.fornecedor || null,
        estoque_indefinido: form.estoque_indefinido,
        quantidade_contida: form.estoque_indefinido ? 0 : form.quantidade_pecas,
        quantidade_aprovada: form.estoque_indefinido ? 0 : form.estoque_mobis,
        quantidade_rejeitada: 0,
        motivo: form.motivo || null, acao_contencao: form.acao_contencao || null,
        status: form.status, observacoes: form.observacoes || null,
        mark_check: true,
        mark_check_local: form.mark_check_local,
        mark_check_como: form.mark_check_como,
        mark_check_com_que: form.mark_check_com_que,
        mark_check_fotos: finalMark,
        fotos_problema: finalProb,
      };

      if (isEdit) {
        const { error } = await supabase.from("contencao").update(payload).eq("id", id!);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contencao").insert({ id: savedId, ...payload });
        if (error) throw error;
      }

      toast.success(isEdit ? t("contencao.updateSuccess") : t("contencao.saveSuccess"));
      navigate("/contencao");
    } catch (err: any) { toast.error(err.message || t("contencao.saveError")); } finally { setSaving(false); }
  };


  if (isEdit && loadingExisting) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/contencao")} className="header-btn header-btn-back"><ArrowLeft className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">{t("common.back")}</span></Button>
            <img src={logo} alt="Hyundai Mobis" className="h-6 sm:h-8 object-contain bg-white rounded-md px-2 py-0.5" />
          </div>
          <div className="flex items-center gap-2 sm:gap-3 mt-3 sm:mt-4"><ShieldAlert className="w-6 h-6 sm:w-8 sm:h-8" /><h1 className="text-xl sm:text-2xl font-heading font-bold">{isEdit ? t("contencao.editContencao") : t("contencao.newContencao")}</h1></div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 max-w-4xl">
        <div className="form-section">
          <h2 className="form-section-title">{t("contencao.generalInfo")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("contencao.localResponsabilidade")}</Label>
              <Select value={form.tipo} onValueChange={(v) => set("tipo", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LOCAL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {isEdit && (<div className="space-y-2"><Label>{t("common.status")}</Label><Select value={form.status} onValueChange={(v) => set("status", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="emitida">{t("contencao.status.emitida")}</SelectItem><SelectItem value="iniciada">{t("contencao.status.iniciada")}</SelectItem><SelectItem value="em_andamento">{t("contencao.status.em_andamento")}</SelectItem><SelectItem value="concluida">{t("contencao.status.concluida")}</SelectItem><SelectItem value="cancelada">{t("contencao.status.cancelada")}</SelectItem></SelectContent></Select></div>)}
            <div className="space-y-2"><Label>{t("common.title")}</Label><Input value={form.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder={t("contencao.descPlaceholder")} /></div>
            <div className="space-y-2"><Label>{t("common.responsible")}</Label><Input value={form.responsavel} onChange={(e) => set("responsavel", e.target.value)} className={isEdit ? "" : "bg-muted"} readOnly={!isEdit} /></div>
            <div className="space-y-2"><Label>{t("common.date")}</Label><Input type="date" value={form.data} onChange={(e) => set("data", e.target.value)} /></div>
            <div className="space-y-2"><Label>{t("common.sector")}</Label><Select value={form.setor} onValueChange={(v) => set("setor", v)}><SelectTrigger><SelectValue placeholder={t("common.select")} /></SelectTrigger><SelectContent>{setores.map((s) => <SelectItem key={s.id} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>{t("common.line")}</Label><Select value={form.linha} onValueChange={(v) => set("linha", v)}><SelectTrigger><SelectValue placeholder={t("common.select")} /></SelectTrigger><SelectContent>{linhas.map((l) => <SelectItem key={l.id} value={l.value}>{l.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2 md:col-span-2"><Label>{t("contencao.localInicio")}</Label><Input value={form.local} onChange={(e) => set("local", e.target.value)} placeholder='Ex: "Linha 3 — Posto 7", "Área de Incoming", "Sala do Áudio"' /></div>
            <SupplierPartSelector fornecedor={form.fornecedor} partNumber={form.part_number} partName={form.part_name} onFornecedorChange={(v) => set("fornecedor", v)} onPartNumberChange={(v) => set("part_number", v)} onPartDataChange={(d) => set("part_name", d.part_name)} />
          </div>
        </div>

        <div className="form-section">
          <h2 className="form-section-title">{t("contencao.quantities")}</h2>
          <RadioGroup
            value={form.estoque_indefinido ? "indef" : "def"}
            onValueChange={(v) => set("estoque_indefinido", v === "indef")}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4"
          >
            <label className="flex items-start gap-2 rounded-md border p-3 cursor-pointer">
              <RadioGroupItem value="def" id="qt-def" className="mt-0.5" />
              <div>
                <div className="text-sm font-medium">{t("contencao.hasQty")}</div>
                <div className="text-xs text-muted-foreground">{t("contencao.hasQtyDesc")}</div>
              </div>
            </label>
            <label className="flex items-start gap-2 rounded-md border p-3 cursor-pointer">
              <RadioGroupItem value="indef" id="qt-indef" className="mt-0.5" />
              <div>
                <div className="text-sm font-medium">{t("contencao.unknownQty")}</div>
                <div className="text-xs text-muted-foreground">{t("contencao.unknownQtyDesc")}</div>
              </div>
            </label>
          </RadioGroup>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {!form.estoque_indefinido && (
              <>
                <div className="space-y-2"><Label>{t("contencao.qtdPecas")}</Label><Input type="number" min={0} value={form.quantidade_pecas} onChange={(e) => set("quantidade_pecas", Number(e.target.value))} /></div>
                <div className="space-y-2"><Label>{t("contencao.estoqueMobis")}</Label><Input type="number" min={0} value={form.estoque_mobis} onChange={(e) => set("estoque_mobis", Number(e.target.value))} placeholder={t("contencao.estoqueMobisPlaceholder")} /></div>
              </>
            )}
          </div>

        </div>

        <div className="form-section">
          <h2 className="form-section-title">{t("contencao.markCheckSection")}</h2>
          <p className="text-xs text-muted-foreground mb-3">{t("contencao.markCheckDesc")}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div className="space-y-2"><Label>{t("contencao.markCheckLocal")}</Label><Input value={form.mark_check_local} onChange={(e) => set("mark_check_local", e.target.value)} placeholder="Ex: face superior, etiqueta..." /></div>
            <div className="space-y-2"><Label>{t("contencao.markCheckComo")}</Label><Input value={form.mark_check_como} onChange={(e) => set("mark_check_como", e.target.value)} placeholder="Ex: traço diagonal..." /></div>
            <div className="space-y-2"><Label>{t("contencao.markCheckComQue")}</Label><Input value={form.mark_check_com_que} onChange={(e) => set("mark_check_com_que", e.target.value)} placeholder="Ex: caneta vermelha permanente" /></div>
          </div>
          <div className="space-y-2">
            <Label>{t("contencao.markCheckFoto")} <span className="text-red-500">*</span></Label>
            <div className="flex flex-wrap gap-2">
              {existingMarkFotos.map((p) => <FotoThumb key={p} path={p} onRemove={() => setExistingMarkFotos((x) => x.filter((y) => y !== p))} />)}
              {newMarkFiles.map((f, i) => <LocalThumb key={i} file={f} onRemove={() => setNewMarkFiles((x) => x.filter((_, j) => j !== i))} />)}
            </div>
            <input ref={markFileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files) setNewMarkFiles((p) => [...p, ...Array.from(e.target.files!)]); e.target.value = ""; }} />
            <Button variant="outline" size="sm" type="button" onClick={() => markFileRef.current?.click()} className="gap-2"><Upload className="w-4 h-4" /> {t("contencao.addPhoto")}</Button>
          </div>
        </div>

        <div className="form-section">
          <h2 className="form-section-title">{t("contencao.fotaProblemaSection")}</h2>
          <p className="text-xs text-muted-foreground mb-3">{t("contencao.fotaProblemaDesc")}</p>
          <div className="space-y-2">
            <Label>{t("contencao.fotaProblemaLabel")} <span className="text-red-500">*</span></Label>
            <div className="flex flex-wrap gap-2">
              {existingProbFotos.map((p) => <FotoThumb key={p} path={p} onRemove={() => setExistingProbFotos((x) => x.filter((y) => y !== p))} />)}
              {newProbFiles.map((f, i) => <LocalThumb key={i} file={f} onRemove={() => setNewProbFiles((x) => x.filter((_, j) => j !== i))} />)}
            </div>
            <input ref={probFileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files) setNewProbFiles((p) => [...p, ...Array.from(e.target.files!)]); e.target.value = ""; }} />
            <Button variant="outline" size="sm" type="button" onClick={() => probFileRef.current?.click()} className="gap-2"><Upload className="w-4 h-4" /> {t("contencao.addPhoto")}</Button>
          </div>
        </div>

        <div className="form-section">
          <h2 className="form-section-title">{t("contencao.details")}</h2>
          <div className="space-y-4">
            <div className="space-y-2"><Label>{t("contencao.reason")}</Label><Textarea value={form.motivo} onChange={(e) => set("motivo", e.target.value)} placeholder={t("contencao.reasonPlaceholder")} rows={3} /></div>
            <div className="space-y-2"><Label>{t("contencao.actionTaken")}</Label><Textarea value={form.acao_contencao} onChange={(e) => set("acao_contencao", e.target.value)} placeholder={t("contencao.actionPlaceholder")} rows={3} /></div>
            <div className="space-y-2"><Label>{t("common.observations")}</Label><Textarea value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} rows={3} /></div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={saving} className="gap-2"><Save className="w-4 h-4" /> {saving ? t("common.saving") : isEdit ? t("common.update") : t("contencao.requestContencao")}</Button>
          <Button variant="outline" onClick={() => navigate("/contencao")}>{t("common.cancel")}</Button>
        </div>
      </main>
    </div>
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
      <button type="button" onClick={onRemove} className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80"><X className="w-3 h-3" /></button>
    </div>
  );
};

const LocalThumb = ({ file, onRemove }: { file: File; onRemove: () => void }) => {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <div className="relative w-20 h-20 rounded overflow-hidden border bg-muted">
      <img src={url} alt={file.name} className="w-full h-full object-cover" />
      <button type="button" onClick={onRemove} className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80"><X className="w-3 h-3" /></button>
      <Camera className="absolute bottom-1 left-1 w-3 h-3 text-white/90 drop-shadow" />
    </div>
  );
};

export default ContencaoForm;
