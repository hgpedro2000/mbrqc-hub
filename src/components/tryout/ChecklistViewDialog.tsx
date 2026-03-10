import { useQuery } from "@tanstack/react-query";
import { useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose,
} from "@/components/ui/dialog";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ChecklistExportButtons } from "./ChecklistExportButtons";
import { FileText, AlertTriangle, Camera, Gauge, Package, Settings, ClipboardCheck } from "lucide-react";
import hyundaiMobisLogo from "@/assets/hyundai-mobis-logo.png";

interface ChecklistViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checklistId: string | null;
  checklistType: "injection_checklists" | "painting_checklists" | "assembly_checklists";
}

const fieldLabels: Record<string, string> = {
  numero: "Número",
  nome: "Responsável",
  data: "Data",
  fornecedor: "Fornecedor",
  projeto: "Projeto",
  part_number: "Part Number",
  part_name: "Part Name",
  modulo: "Módulo",
  razao_tryout: "Razão do Tryout",
  razao_tryout_outro: "Detalhe da Razão",
  qtd_tryout: "Qtd Try-Out",
  total_pecas: "Total de Peças",
  pecas_ok: "Peças OK",
  pecas_ng: "Peças NG",
  rate: "Rate (%)",
  materia_prima: "Matéria-Prima",
  injetora: "Injetora",
  tonelagem: "Tonelagem (t)",
  cycle_time: "Cycle Time (s)",
  cooling_time: "Cooling Time (s)",
  weight: "Weight (g)",
  dimensional: "Dimensional",
  comentarios: "Comentários",
};

const identificationFields = ["numero", "nome", "data", "fornecedor", "projeto", "part_number", "part_name", "modulo"];
const pieceDataFields = ["razao_tryout", "razao_tryout_outro", "qtd_tryout", "total_pecas", "pecas_ok", "pecas_ng"];
const processFields = ["materia_prima", "injetora", "tonelagem", "cycle_time", "cooling_time", "weight"];
const evaluationFields = ["dimensional", "comentarios"];

const injectionFields = [
  ...identificationFields, ...pieceDataFields, ...processFields, ...evaluationFields,
];

const simpleFields = ["numero", "nome", "data", "comentarios"];

function formatValue(key: string, value: any): string {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "data") return new Date(value).toLocaleDateString("pt-BR");
  if (key === "rate") return `${Number(value).toFixed(1)}%`;
  return String(value);
}

function getTypeLabel(type: string) {
  if (type === "injection_checklists") return "Injeção";
  if (type === "painting_checklists") return "Pintura";
  return "Montagem";
}

function getTypeBadgeClass(type: string) {
  if (type === "injection_checklists") return "bg-blue-500/10 text-blue-700 border-blue-200";
  if (type === "painting_checklists") return "bg-amber-500/10 text-amber-700 border-amber-200";
  return "bg-emerald-500/10 text-emerald-700 border-emerald-200";
}

const SectionHeader = ({ icon: Icon, title }: { icon: any; title: string }) => (
  <div className="flex items-center gap-2 mb-3">
    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
      <Icon className="w-4 h-4 text-primary" />
    </div>
    <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">{title}</h4>
  </div>
);

const DataField = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div className="space-y-0.5">
    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</p>
    <p className={`text-sm font-medium ${highlight ? "text-primary font-bold" : "text-foreground"}`}>{value}</p>
  </div>
);

const ChecklistViewDialog = ({ open, onOpenChange, checklistId, checklistType }: ChecklistViewDialogProps) => {
  const contentRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["checklist-view", checklistType, checklistId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(checklistType)
        .select("*")
        .eq("id", checklistId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!checklistId && open,
  });

  const { data: photos = [] } = useQuery({
    queryKey: ["checklist-photos", checklistId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_photos")
        .select("*")
        .eq("checklist_id", checklistId!);
      if (error) throw error;
      return data;
    },
    enabled: !!checklistId && open,
  });

  const { data: defectCategories = [] } = useQuery({
    queryKey: ["defect_categories_active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("defect_categories")
        .select("code, description")
        .eq("active", true);
      if (error) throw error;
      return data;
    },
    enabled: checklistType === "injection_checklists" && open,
  });

  const { data: defectsList = [] } = useQuery({
    queryKey: ["defects_active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("defects")
        .select("code, description")
        .eq("active", true);
      if (error) throw error;
      return data;
    },
    enabled: checklistType === "injection_checklists" && open,
  });

  const catMap = useMemo(() => Object.fromEntries(defectCategories.map(c => [c.code, `${c.code} - ${c.description}`])), [defectCategories]);
  const defectMap = useMemo(() => Object.fromEntries(defectsList.map(d => [d.code, `${d.code} - ${d.description}`])), [defectsList]);

  const fields = checklistType === "injection_checklists" ? injectionFields : simpleFields;
  const isChecklist = checklistType !== "injection_checklists";
  const d = data as any;
  const checkedItems = d?.checked_items as (string | { id: string })[] | undefined;
  const items = d?.items as (string | { id: string; label: string })[] | undefined;
  const defects = d?.defects as any[] | undefined;
  const rate = d?.rate ? Number(d.rate) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 w-[95vw] md:w-full [&>button:last-child]:hidden">
        {/* Custom close button on the left */}
        <DialogClose className="absolute left-3 top-3 z-50 rounded-full bg-background/80 backdrop-blur-sm border border-border w-8 h-8 flex items-center justify-center opacity-80 hover:opacity-100 transition-opacity shadow-sm">
          <X className="h-4 w-4" />
          <span className="sr-only">Fechar</span>
        </DialogClose>
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : data ? (
          <div className="flex flex-col" ref={contentRef}>
            <div data-pdf-section className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-b border-border px-4 md:px-6 pt-4 md:pt-6 pb-3 md:pb-4">
              <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                <div className="flex items-center gap-3 md:gap-4">
                  <img src={hyundaiMobisLogo} alt="Hyundai Mobis" className="h-10 md:h-16 w-auto object-contain" />
                  <div className="space-y-1 md:space-y-1.5">
                   <div className="flex items-center gap-2 flex-nowrap">
                    <Badge className={`${getTypeBadgeClass(checklistType)} h-[29px] px-4 py-0 inline-flex items-center justify-center leading-none font-semibold text-[11px] shrink-0`}>
                      {getTypeLabel(checklistType)}
                    </Badge>
                    {d?.numero && (
                      <span className="inline-flex h-[29px] px-3 items-center justify-center font-mono text-sm font-bold text-primary leading-none shrink-0 bg-green-50 rounded-full border border-green-200">#{d.numero}</span>
                    )}
                    {d?.razao_tryout && (
                      <Badge variant="outline" className="h-[29px] px-4 py-0 inline-flex items-center justify-center leading-none text-[11px] shrink-0 bg-yellow-100 border-yellow-300 text-yellow-800">{d.razao_tryout}</Badge>
                    )}
                  </div>
                  <h2 className="text-sm md:text-lg font-bold text-foreground">
                    Relatório de Checklist — {getTypeLabel(checklistType)}
                  </h2>
                  <p className="text-[10px] md:text-xs text-muted-foreground">
                    {d?.nome} • {formatValue("data", d?.data)}
                    {d?.fornecedor ? ` • ${d.fornecedor}` : ""}
                  </p>
                  </div>
                </div>
                <ChecklistExportButtons
                  data={data}
                  photos={photos}
                  checklistType={checklistType}
                  fields={fields}
                  fieldLabels={fieldLabels}
                  contentRef={contentRef}
                  catMap={catMap}
                  defectMap={defectMap}
                />
              </div>
            </div>

            <div className="px-4 md:px-6 py-4 md:py-5 space-y-5 md:space-y-6">
              {/* Rate KPI Banner for injection */}
              {checklistType === "injection_checklists" && d?.total_pecas > 0 && (
                <div data-pdf-section className="rounded-xl border border-border bg-gradient-to-r from-card to-muted/30 p-3 md:p-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 md:gap-4">
                    <div className="hidden sm:flex w-12 h-12 rounded-full bg-primary/10 items-center justify-center shrink-0">
                      <Gauge className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 w-full">
                      <p className="text-[10px] md:text-xs text-muted-foreground font-medium uppercase tracking-wider">Taxa de Aprovação</p>
                      <div className="flex items-end gap-2.5 pb-1">
                        <span className={`text-2xl md:text-3xl font-bold leading-none ${rate >= 90 ? "text-emerald-600" : rate >= 70 ? "text-amber-600" : "text-destructive"}`}>
                          {rate.toFixed(1)}%
                        </span>
                        <span className="text-xs md:text-sm text-muted-foreground leading-none pb-0.5">
                          ({d.pecas_ok} OK / {d.total_pecas} total)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden mt-3">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${rate >= 90 ? "bg-emerald-500" : rate >= 70 ? "bg-amber-500" : "bg-destructive"}`}
                          style={{ width: `${Math.min(rate, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 md:gap-4 text-center w-full sm:w-auto">
                      <div>
                        <p className="text-base md:text-lg font-bold text-foreground">{d.total_pecas}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Total</p>
                      </div>
                      <div>
                        <p className="text-base md:text-lg font-bold text-emerald-600">{d.pecas_ok}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">OK</p>
                      </div>
                      <div>
                        <p className="text-base md:text-lg font-bold text-destructive">{d.pecas_ng}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">NG</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Identification Section */}
              {checklistType === "injection_checklists" ? (
                <>
                  <div data-pdf-section>
                    <SectionHeader icon={FileText} title="Identificação" />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 md:gap-x-4 gap-y-2 md:gap-y-3 bg-card rounded-lg border border-border p-3 md:p-4">
                      {identificationFields.map((key) => (
                        <DataField key={key} label={fieldLabels[key] || key} value={formatValue(key, d[key])} />
                      ))}
                    </div>
                  </div>

                  <div data-pdf-section>
                    <SectionHeader icon={Package} title="Dados da Peça" />
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 bg-card rounded-lg border border-border p-4">
                      {pieceDataFields.filter(k => !(k === "razao_tryout_outro" && !d.razao_tryout_outro)).map((key) => (
                        <DataField key={key} label={fieldLabels[key] || key} value={formatValue(key, d[key])} highlight={key === "razao_tryout"} />
                      ))}
                    </div>
                  </div>

                  <div data-pdf-section>
                    <SectionHeader icon={Settings} title="Parâmetros de Processo" />
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 bg-card rounded-lg border border-border p-4">
                      {processFields.map((key) => (
                        <DataField key={key} label={fieldLabels[key] || key} value={formatValue(key, d[key])} />
                      ))}
                    </div>
                  </div>

                  <div data-pdf-section>
                    <SectionHeader icon={ClipboardCheck} title="Avaliação" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 bg-card rounded-lg border border-border p-4">
                      {evaluationFields.map((key) => (
                        <DataField key={key} label={fieldLabels[key] || key} value={formatValue(key, d[key])} />
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div data-pdf-section>
                  <SectionHeader icon={FileText} title="Informações" />
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 bg-card rounded-lg border border-border p-4">
                    {simpleFields.map((key) => (
                      <DataField key={key} label={fieldLabels[key] || key} value={formatValue(key, d[key])} />
                    ))}
                  </div>
                </div>
              )}

              {/* Defects for injection */}
              {checklistType === "injection_checklists" && defects && defects.length > 0 && (
                <div data-pdf-section>
                  <SectionHeader icon={AlertTriangle} title={`Defeitos (${defects.length})`} />
                  <div className="space-y-3">
                    {defects.map((defect: any, idx: number) => (
                      <div key={idx} className="border border-border rounded-lg p-4 bg-card">
                        <div className="flex items-center gap-2 flex-wrap mb-2 leading-none">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10 text-destructive text-[12px] font-bold shrink-0">
                            {idx + 1}
                          </span>

                          <span className="inline-flex h-8 px-4 items-center justify-center rounded-full border border-border bg-muted text-foreground text-[12px] font-semibold whitespace-nowrap shrink-0">
                            Defeito #{idx + 1}
                          </span>

                          {defect.needs_improvement && (
                            <span className="inline-flex h-8 px-4 items-center justify-center rounded-full border border-transparent bg-destructive text-destructive-foreground text-[12px] font-semibold whitespace-nowrap shrink-0">
                              Melhoria necessária
                            </span>
                          )}

                          {defect.improvement_category && (
                            <span className="inline-flex h-8 px-4 items-center justify-center rounded-full border border-orange-300 bg-orange-500 text-white text-[12px] font-semibold whitespace-nowrap shrink-0">
                              {catMap[defect.improvement_category] || `Cat. ${defect.improvement_category}`}
                            </span>
                          )}

                          {defect.failure_mode && (
                            <span className="inline-flex h-8 px-4 items-center justify-center rounded-full border border-blue-300 bg-blue-500 text-white text-[12px] font-semibold whitespace-nowrap shrink-0">
                              {defectMap[defect.failure_mode] || defect.failure_mode}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-foreground pl-10">{defect.description || "—"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Checklist items for painting/assembly */}
              {isChecklist && items && items.length > 0 && (
                <div data-pdf-section>
                  <SectionHeader icon={ClipboardCheck} title="Itens do Checklist" />
                  <div className="bg-card rounded-lg border border-border divide-y divide-border">
                    {items.map((item: any, idx: number) => {
                      const itemId = typeof item === "string" ? item : item.id;
                      const itemLabel = typeof item === "string" ? item : item.label;
                      const isChecked = checkedItems?.some((ci: any) => (typeof ci === "string" ? ci : ci.id) === itemId);
                      return (
                        <div key={idx} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${isChecked ? "bg-emerald-500/15 text-emerald-600 border border-emerald-300" : "bg-destructive/10 text-destructive border border-destructive/30"}`}>
                            {isChecked ? "✓" : "✗"}
                          </span>
                          <span className={isChecked ? "text-foreground" : "text-muted-foreground"}>{itemLabel}</span>
                        </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Photos */}
              {photos.length > 0 && (
                <div data-pdf-section>
                  <SectionHeader icon={Camera} title={`Fotos (${photos.length})`} />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-3">
                    {photos.map((photo) => {
                      const { data: urlData } = supabase.storage.from("checklist-photos").getPublicUrl(photo.file_path);
                      return (
                        <a key={photo.id} href={urlData.publicUrl} target="_blank" rel="noopener noreferrer" className="aspect-square rounded-lg overflow-hidden border border-border hover:border-primary hover:shadow-md transition-all">
                          <img src={urlData.publicUrl} alt={photo.file_name} className="w-full h-full object-cover" />
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div data-pdf-section className="border-t border-border px-6 py-3 bg-muted/30 text-center">
              <p className="text-[10px] text-muted-foreground">
                Hyundai Mobis — Try-Out Control • Gerado em {new Date().toLocaleDateString("pt-BR")}
              </p>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default ChecklistViewDialog;
