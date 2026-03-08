import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ChecklistExportButtons } from "./ChecklistExportButtons";

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

const injectionFields = [
  "numero", "nome", "data", "fornecedor", "projeto", "part_number", "part_name",
  "modulo", "qtd_tryout", "total_pecas", "pecas_ok", "pecas_ng", "rate",
  "materia_prima", "injetora", "tonelagem",
  "cycle_time", "cooling_time", "weight", "dimensional", "comentarios",
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

const ChecklistViewDialog = ({ open, onOpenChange, checklistId, checklistType }: ChecklistViewDialogProps) => {
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

  const fields = checklistType === "injection_checklists" ? injectionFields : simpleFields;
  const isChecklist = checklistType !== "injection_checklists";

  const checkedItems = (data as any)?.checked_items as string[] | undefined;
  const items = (data as any)?.items as string[] | undefined;
  const defects = (data as any)?.defects as any[] | undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2">
              <Badge variant="outline">{getTypeLabel(checklistType)}</Badge>
              {data?.numero && <span className="font-mono text-sm text-muted-foreground">#{data.numero}</span>}
            </DialogTitle>
            {data && (
              <ChecklistExportButtons
                data={data}
                photos={photos}
                checklistType={checklistType}
                fields={fields}
                fieldLabels={fieldLabels}
              />
            )}
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" />
          </div>
        ) : data ? (
          <div className="space-y-4">
            {/* Key-value fields */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {fields.map((key) => (
                <div key={key}>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{fieldLabels[key] || key}</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">{formatValue(key, (data as any)[key])}</p>
                </div>
              ))}
            </div>

            {/* Rate bar for injection */}
            {checklistType === "injection_checklists" && (data as any)?.total_pecas > 0 && (
              <div className="space-y-1">
                <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-300"
                    style={{ width: `${Math.min(Number((data as any).rate) || 0, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Defects for injection */}
            {checklistType === "injection_checklists" && defects && defects.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Defeitos ({defects.length})</p>
                  <div className="space-y-3">
                    {defects.map((defect: any, idx: number) => (
                      <div key={idx} className="border border-border rounded-lg p-3 bg-card space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">Defeito #{idx + 1}</span>
                          {defect.needs_improvement && (
                            <Badge variant="destructive" className="text-[10px]">Melhoria necessária</Badge>
                          )}
                          {defect.improvement_category && (
                            <Badge variant="secondary" className="text-[10px]">Cat. {defect.improvement_category}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-foreground">{defect.description || "—"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Checklist items for painting/assembly */}
            {isChecklist && items && items.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Itens do Checklist</p>
                  <div className="space-y-1.5">
                    {items.map((item: string, idx: number) => {
                      const isChecked = checkedItems?.includes(item);
                      return (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <span className={`w-5 h-5 rounded border flex items-center justify-center text-xs ${isChecked ? "bg-accent text-accent-foreground border-accent" : "border-border text-muted-foreground"}`}>
                            {isChecked ? "✓" : ""}
                          </span>
                          <span className={isChecked ? "text-foreground" : "text-muted-foreground"}>{item}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Photos */}
            {photos.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Fotos ({photos.length})</p>
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((photo) => {
                      const { data: urlData } = supabase.storage.from("checklist-photos").getPublicUrl(photo.file_path);
                      return (
                        <a key={photo.id} href={urlData.publicUrl} target="_blank" rel="noopener noreferrer" className="aspect-square rounded-lg overflow-hidden border border-border hover:border-accent transition-colors">
                          <img src={urlData.publicUrl} alt={photo.file_name} className="w-full h-full object-cover" />
                        </a>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default ChecklistViewDialog;
