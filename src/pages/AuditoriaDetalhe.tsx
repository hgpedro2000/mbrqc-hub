import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Pencil, FileDown, ShieldCheck, AlertTriangle, CheckCircle2,
  Camera, Upload, Clock, History as HistoryIcon, Image as ImageIcon,
} from "lucide-react";
import ReportErrorButton from "@/components/ReportErrorButton";
import { useUserRole } from "@/hooks/useUserRole";
import EngineeringMode from "@/components/EngineeringMode";
import logo from "@/assets/hyundai-mobis-logo.png";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { compressImage } from "@/lib/compressImage";
import { exportAuditoriaPPTX } from "@/lib/exportAuditoriaPPTX";
import SupplierVisitReportView from "@/components/auditoria/SupplierVisitReportView";
import GeneralIssuesReportView from "@/components/auditoria/GeneralIssuesReportView";
import { SignedAuditImg } from "@/components/auditoria/SignedAuditImg";
import { getAuditPhotoUrl, useAuditPhotoUrl } from "@/lib/auditPhoto";


const STATUS_COLORS: Record<string, string> = {
  planejada: "bg-slate-500/15 text-slate-300 border border-slate-500/30",
  em_andamento: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  aguardando_fornecedor: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  respondida: "bg-violet-500/15 text-violet-300 border border-violet-500/30",
  concluida: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  atrasada: "bg-red-500/15 text-red-400 border border-red-500/30 animate-pulse",
};
const STATUS_LABELS: Record<string, string> = {
  planejada: "Planejada",
  em_andamento: "Em andamento",
  aguardando_fornecedor: "Aguardando fornecedor",
  respondida: "Respondida",
  concluida: "Concluída",
  atrasada: "Atrasada",
};
const NC_STATUS_LABELS: Record<string, string> = {
  open: "Aberta",
  in_progress: "Em progresso",
  done: "Respondida",
  overdue: "Atrasada",
};
const NC_STATUS_COLORS: Record<string, string> = {
  open: "bg-slate-500/15 text-slate-300 border border-slate-500/30",
  in_progress: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  done: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  overdue: "bg-red-500/15 text-red-400 border border-red-500/30 animate-pulse",
};

function fmtDate(d?: string | null) {
  if (!d) return "-";
  return new Date(d + "T12:00:00").toLocaleDateString("pt-BR");
}

function storageUrl(_path?: string | null) {
  // Deprecated: audit-photos bucket is private. Use SignedAuditImg / useAuditPhotoUrl.
  return null;
}



export default function AuditoriaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const qc = useQueryClient();
  const [exporting, setExporting] = useState(false);
  const [respondNc, setRespondNc] = useState<any | null>(null);

  const { data: audit, isLoading } = useQuery({
    queryKey: ["audit-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("audits").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: ncs = [] } = useQuery({
    queryKey: ["audit-ncs", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_ncs")
        .select("*, responses:audit_nc_responses(*)")
        .eq("audit_id", id!)
        .order("seq_number", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  const openCount = useMemo(() => ncs.filter((n: any) => n.status !== "done").length, [ncs]);
  const doneCount = useMemo(() => ncs.filter((n: any) => n.status === "done").length, [ncs]);

  const handleExport = async () => {
    if (!audit) return;
    try {
      setExporting(true);
      const file = await exportAuditoriaPPTX(audit, ncs);
      // Update status → aguardando_fornecedor + timestamp
      const nextStatus = audit.status === "planejada" || audit.status === "em_andamento"
        ? "aguardando_fornecedor" : audit.status;
      await supabase.from("audits")
        .update({ status: nextStatus, pptx_sent_at: new Date().toISOString() })
        .eq("id", audit.id);
      qc.invalidateQueries({ queryKey: ["audit-detail", id] });
      qc.invalidateQueries({ queryKey: ["audits-v2"] });
      toast.success(`PPTX gerado: ${file}`);
    } catch (e: any) {
      console.error(e);
      toast.error("Falha ao gerar PPTX: " + (e?.message || "erro desconhecido"));
    } finally {
      setExporting(false);
    }
  };

  if (isLoading || !audit) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <Button variant="ghost" onClick={() => navigate("/auditorias")} className="header-btn header-btn-back">
                <ArrowLeft className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Voltar</span>
              </Button>
              <img src={logo} alt="Hyundai Mobis" className="h-6 sm:h-8 object-contain bg-white rounded-md px-2 py-0.5" />
            </div>
            <div className="flex items-center gap-1">
              <ReportErrorButton moduleName="Auditoria Detalhe" />
              {isAdmin && <EngineeringMode module="Auditorias" />}
            </div>
          </div>
          <div className="flex flex-wrap items-start gap-2 sm:gap-3 mt-3 md:mt-4">
            <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 mt-1" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {audit.code && (
                  <span className="text-xs font-mono bg-white/10 px-2 py-0.5 rounded">#{audit.code}</span>
                )}
                <span className={`status-badge ${STATUS_COLORS[audit.status] || ""}`}>
                  {STATUS_LABELS[audit.status] || audit.status}
                </span>
              </div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-heading font-bold mt-1 truncate">
                {audit.title}
              </h1>
              <p className="text-primary-foreground/70 text-xs md:text-sm">
                {audit.supplier_name} · {fmtDate(audit.audit_date_start)}
                {audit.audit_date_end && audit.audit_date_end !== audit.audit_date_start && ` → ${fmtDate(audit.audit_date_end)}`}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleExport} disabled={exporting} className="gap-2">
            <FileDown className="w-4 h-4" /> {exporting ? "Gerando..." : "Exportar PPTX"}
          </Button>
          <Button variant="outline" onClick={() => navigate(`/auditorias/editar/${audit.id}`)} className="gap-2">
            <Pencil className="w-4 h-4" /> Editar
          </Button>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full flex-wrap h-auto justify-start">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="ncs">NCs ({ncs.length})</TabsTrigger>
            <TabsTrigger value="schedule">Cronograma</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="bg-slate-900/40 p-3 rounded-lg overflow-x-auto">
              <SupplierVisitReportView audit={audit} ncs={ncs} />
            </div>

            {ncs.length > 0 && Array.from({ length: Math.ceil(ncs.length / 4) }).map((_, i) => (
              <div key={i} className="bg-slate-900/40 p-3 rounded-lg overflow-x-auto">
                <GeneralIssuesReportView ncs={ncs} page={i} perPage={4} />
              </div>
            ))}


            <div className="grid md:grid-cols-3 gap-3">
              <KpiCard label="NCs Abertas" value={openCount} icon={<AlertTriangle className="w-5 h-5 text-amber-400" />} />
              <KpiCard label="NCs Respondidas" value={doneCount} icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />} />
              <KpiCard label="Total NCs" value={ncs.length} icon={<ShieldCheck className="w-5 h-5 text-accent" />} />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="form-section space-y-2">
                <h3 className="font-heading font-semibold">Dados gerais</h3>
                <InfoRow k="Tipo" v={audit.type} />
                <InfoRow k="Local" v={audit.place} />
                <InfoRow k="Auditor" v={audit.auditor_name} />
                <InfoRow k="PIC (fornecedor)" v={audit.pic_name} />
                <InfoRow k="Propósito" v={(audit.purpose || []).join(", ")} />
                <InfoRow k="Processo" v={(audit.process || []).join(", ")} />
                <InfoRow k="Produto" v={audit.product_name} />
                {audit.pptx_sent_at && (
                  <InfoRow k="PPTX enviado" v={new Date(audit.pptx_sent_at).toLocaleString("pt-BR")} />
                )}
              </div>
              <div className="form-section">
                <h3 className="font-heading font-semibold mb-2">Foto do produto</h3>
                {audit.product_image_url ? (
                  <SignedAuditImg
                    path={audit.product_image_url}
                    alt="Produto"
                    className="w-full rounded-lg border object-contain max-h-72"
                    fallback={
                      <div className="border border-dashed rounded-lg h-48 flex items-center justify-center text-muted-foreground">
                        <ImageIcon className="w-6 h-6 mr-2" /> Carregando…
                      </div>
                    }
                  />
                ) : (
                  <div className="border border-dashed rounded-lg h-48 flex items-center justify-center text-muted-foreground">
                    <ImageIcon className="w-6 h-6 mr-2" /> Sem imagem
                  </div>
                )}

              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="form-section space-y-2">
                <h3 className="font-heading font-semibold">Indicadores</h3>
                <InfoRow k="MBR AQL (Total / OK / NG)" v={`${audit.mbr_aql_total ?? "-"} / ${audit.mbr_aql_ok ?? "-"} / ${audit.mbr_aql_ng ?? "-"}`} />
                <InfoRow k="Paint Inspection (Total / OK / NG)" v={`${audit.paint_inspection_total ?? "-"} / ${audit.paint_inspection_ok ?? "-"} / ${audit.paint_inspection_ng ?? "-"}`} />
                {typeof audit.score === "number" && <InfoRow k="Score" v={audit.score} />}
              </div>
              <div className="form-section space-y-2">
                <h3 className="font-heading font-semibold">Conclusão e pedidos</h3>
                {audit.major_requests && audit.major_requests.length > 0 && (
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    {audit.major_requests.map((r: string, i: number) => <li key={i}>{r}</li>)}
                  </ul>
                )}
                {audit.conclusion && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-2">{audit.conclusion}</p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* NCs */}
          <TabsContent value="ncs" className="space-y-3 mt-4">
            {ncs.length === 0 ? (
              <div className="form-section text-center py-8 text-muted-foreground">Nenhuma NC registrada.</div>
            ) : ncs.map((nc: any) => (
              <div key={nc.id} className="form-section">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono bg-muted/20 px-2 py-0.5 rounded">NC #{nc.seq_number}</span>
                      <span className={`status-badge ${NC_STATUS_COLORS[nc.status] || ""}`}>
                        {NC_STATUS_LABELS[nc.status] || nc.status}
                      </span>
                      {nc.issue_category && (
                        <span className="text-xs px-2 py-0.5 rounded bg-card border text-foreground">{nc.issue_category}</span>
                      )}
                    </div>
                    <p className="text-sm mt-2 whitespace-pre-wrap">{nc.problem_description}</p>
                    <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-2">
                      <span>Responsável: <span className="text-foreground">{nc.in_charge || "-"}</span></span>
                      <span>•</span>
                      <span>Prazo: <span className="text-foreground">{fmtDate(nc.due_date)}</span></span>
                    </div>
                    {nc.counter_measure && (
                      <p className="text-xs mt-2 p-2 rounded bg-muted/10"><b>Contramedida:</b> {nc.counter_measure}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button size="sm" variant={nc.status === "done" ? "outline" : "default"}
                      onClick={() => setRespondNc(nc)}>
                      <Upload className="w-3.5 h-3.5 mr-1" />
                      {nc.status === "done" ? "Editar resposta" : "Registrar resposta"}
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <PhotoCell label="Before" url={storageUrl(nc.before_photo_url)} />
                  <PhotoCell label="After" url={storageUrl(nc.responses?.[0]?.after_photo_url)} />
                </div>
                {nc.responses?.[0]?.corrective_measure_text && (
                  <div className="mt-2 text-xs p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
                    <b>Resposta:</b> {nc.responses[0].corrective_measure_text}
                    {nc.responses[0].responded_at && (
                      <span className="text-muted-foreground ml-2">
                        ({new Date(nc.responses[0].responded_at).toLocaleString("pt-BR")})
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </TabsContent>

          {/* Schedule */}
          <TabsContent value="schedule" className="mt-4">
            <div className="form-section space-y-3">
              <h3 className="font-heading font-semibold flex items-center gap-2"><Clock className="w-4 h-4" /> Cronograma</h3>
              <InfoRow k="Início" v={fmtDate(audit.audit_date_start)} />
              <InfoRow k="Fim" v={fmtDate(audit.audit_date_end)} />
              {audit.schedule_notes && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Notas</p>
                  <p className="text-sm whitespace-pre-wrap">{audit.schedule_notes}</p>
                </div>
              )}
              {Array.isArray(audit.participants) && audit.participants.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Participantes</p>
                  <ul className="text-sm space-y-1">
                    {(audit.participants as any[]).map((p: any, i: number) => (
                      <li key={i} className="flex justify-between border-b border-border/30 pb-1">
                        <span>{p.name}</span>
                        <span className="text-muted-foreground">{p.role || ""}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </TabsContent>

          {/* History */}
          <TabsContent value="history" className="mt-4">
            <div className="form-section space-y-3">
              <h3 className="font-heading font-semibold flex items-center gap-2"><HistoryIcon className="w-4 h-4" /> Histórico</h3>
              <TimelineItem when={audit.created_at} label="Auditoria criada" />
              {audit.pptx_sent_at && <TimelineItem when={audit.pptx_sent_at} label="PPTX enviado ao fornecedor" />}
              {ncs
                .flatMap((nc: any) => (nc.responses || []).map((r: any) => ({ ...r, seq: nc.seq_number })))
                .filter((r: any) => r.responded_at)
                .sort((a: any, b: any) => (a.responded_at < b.responded_at ? -1 : 1))
                .map((r: any) => (
                  <TimelineItem key={r.id} when={r.responded_at} label={`NC #${r.seq} respondida pelo fornecedor`} />
                ))}
              <TimelineItem when={audit.updated_at} label="Última atualização" />
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {respondNc && (
        <NcResponseDialog
          nc={respondNc}
          onClose={() => setRespondNc(null)}
          onSaved={() => {
            setRespondNc(null);
            qc.invalidateQueries({ queryKey: ["audit-ncs", id] });
            qc.invalidateQueries({ queryKey: ["audit-detail", id] });
            qc.invalidateQueries({ queryKey: ["audits-v2"] });
          }}
        />
      )}
    </div>
  );
}

function InfoRow({ k, v }: { k: string; v: any }) {
  return (
    <div className="flex justify-between gap-3 text-sm border-b border-border/30 py-1">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-foreground text-right">{v || "-"}</span>
    </div>
  );
}

function KpiCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="form-section flex items-center justify-between">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-3xl font-heading font-bold">{value}</p>
      </div>
      {icon}
    </div>
  );
}

function PhotoCell({ label, url }: { label: string; url: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt={label} className="w-full h-32 object-cover rounded border" />
        </a>
      ) : (
        <div className="w-full h-32 rounded border border-dashed flex items-center justify-center text-muted-foreground text-xs">
          <ImageIcon className="w-4 h-4 mr-1" /> sem foto
        </div>
      )}
    </div>
  );
}

function TimelineItem({ when, label }: { when?: string | null; label: string }) {
  if (!when) return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      <div className="w-2 h-2 rounded-full bg-accent mt-1.5 shrink-0" />
      <div>
        <p>{label}</p>
        <p className="text-xs text-muted-foreground">{new Date(when).toLocaleString("pt-BR")}</p>
      </div>
    </div>
  );
}

function NcResponseDialog({ nc, onClose, onSaved }: { nc: any; onClose: () => void; onSaved: () => void }) {
  const existing = nc.responses?.[0];
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [afterPreview, setAfterPreview] = useState<string | null>(existing?.after_photo_url ? storageUrl(existing.after_photo_url) : null);
  const [text, setText] = useState<string>(existing?.corrective_measure_text || nc.counter_measure || "");
  const [completion, setCompletion] = useState<string>(existing?.completion_date || new Date().toISOString().slice(0, 10));
  const [obs, setObs] = useState<string>(existing?.obs || "");
  const [saving, setSaving] = useState(false);

  const handleFile = async (f: File | null) => {
    if (!f) return;
    setAfterFile(f);
    setAfterPreview(URL.createObjectURL(f));
  };

  const save = async () => {
    try {
      setSaving(true);
      let afterPath = existing?.after_photo_url || null;
      if (afterFile) {
        const compressed = await compressImage(afterFile);
        const path = `after/${nc.audit_id}/${nc.id}_${Date.now()}.jpg`;
        const { error } = await supabase.storage.from("audit-photos").upload(path, compressed);
        if (error) throw error;
        afterPath = path;
      }
      const payload = {
        audit_nc_id: nc.id,
        target_date: nc.due_date || null,
        completion_date: completion || null,
        after_photo_url: afterPath,
        corrective_measure_text: text,
        obs,
        responded: true,
        responded_at: new Date().toISOString(),
      };
      if (existing) {
        const { error } = await supabase.from("audit_nc_responses").update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("audit_nc_responses").insert(payload);
        if (error) throw error;
      }
      // Mark NC done
      await supabase.from("audit_ncs").update({ status: "done" }).eq("id", nc.id);
      toast.success("Resposta registrada");
      onSaved();
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao salvar: " + (e?.message || "desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar resposta — NC #{nc.seq_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Foto After</p>
            {afterPreview ? (
              <div className="relative">
                <img src={afterPreview} alt="after" className="w-full h-48 object-cover rounded border" />
                <Button size="sm" variant="destructive" className="absolute top-2 right-2"
                  onClick={() => { setAfterFile(null); setAfterPreview(null); }}>
                  Remover
                </Button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-32 border border-dashed rounded cursor-pointer hover:bg-muted/10">
                <Camera className="w-6 h-6 mb-1 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Selecionar imagem</span>
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0] || null)} />
              </label>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Contramedida aplicada</p>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Descreva a ação corretiva realizada pelo fornecedor" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Data de conclusão</p>
              <Input type="date" value={completion} onChange={(e) => setCompletion(e.target.value)} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Observações</p>
              <Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="opcional" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar resposta"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
