import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTagPermission } from "@/hooks/useTagPermission";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tag, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { stripCode } from "@/lib/stripCode";

interface Props {
  apontamentoId: string;
  defects: any[];
  defectIndex: number;
  onSaved: () => void;
}

export const DefectTagBadge = ({ apontamentoId, defects, defectIndex, onSaved }: Props) => {
  const { profile } = useAuth();
  const { canInsertTag } = useTagPermission();
  const [open, setOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);

  const def = defects?.[defectIndex];
  const currentTag: string | null = def?.tag || null;

  const openEditor = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canInsertTag) return;
    setTagInput(currentTag || "");
    setOpen(true);
  };

  const handleSave = async () => {
    if (!tagInput.trim()) {
      toast.error("Informe o número da TAG");
      return;
    }
    setSaving(true);
    try {
      const updatedDefects = defects.map((d: any, i: number) =>
        i === defectIndex ? { ...d, tag: tagInput.trim() } : d
      );
      const joined = updatedDefects
        .map((x: any) => (x?.tag || "").toString().trim())
        .filter(Boolean)
        .join(", ");
      const { error } = await supabase
        .from("apontamentos")
        .update({
          segundo_defeitos: updatedDefects,
          numero_tag: joined || null,
          tag_inserted_at: new Date().toISOString(),
          tag_inserted_by: profile?.full_name || "",
        } as any)
        .eq("id", apontamentoId);
      if (error) throw error;
      toast.success("TAG salva!");
      setOpen(false);
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar TAG");
    } finally {
      setSaving(false);
    }
  };

  if (currentTag) {
    return (
      <span
        onClick={openEditor}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-300 ${canInsertTag ? "cursor-pointer hover:bg-emerald-200" : ""}`}
        title={canInsertTag ? "Clique para editar TAG" : undefined}
      >
        <Tag className="w-2.5 h-2.5" />{currentTag}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Tag className="w-4 h-4" /> Editar TAG
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold">{stripCode(def?.modo_falha)}</span>
                {def?.descricao ? ` — ${def.descricao}` : ""}
              </p>
              <div className="space-y-1.5">
                <Label>Número da TAG *</Label>
                <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleSave()} placeholder="Ex: TAG-2026-001" />
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                Salvar TAG
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </span>
    );
  }

  return (
    <>
      <span
        onClick={openEditor}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 ${canInsertTag ? "cursor-pointer animate-pulse hover:bg-amber-100" : "cursor-default"}`}
        title={canInsertTag ? "Clique para inserir TAG" : "Aguardando número de TAG"}
      >
        <Tag className="w-2.5 h-2.5" />Sem TAG
      </span>
      {canInsertTag && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Tag className="w-4 h-4" /> Inserir TAG
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold">{stripCode(def?.modo_falha)}</span>
                {def?.descricao ? ` — ${def.descricao}` : ""}
              </p>
              <div className="space-y-1.5">
                <Label>Número da TAG *</Label>
                <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleSave()} placeholder="Ex: TAG-2026-001" />
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                Salvar TAG
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
