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
import { Badge } from "@/components/ui/badge";

interface TagBadgeProps {
  apontamentoId: string;
  numeroTag: string | null;
  quantidadeNg: number;
  onTagSaved: (tag: string) => void;
}

export const TagBadge = ({ apontamentoId, numeroTag, quantidadeNg, onTagSaved }: TagBadgeProps) => {
  const { user, profile } = useAuth();
  const { canInsertTag } = useTagPermission();
  const [open, setOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);

  if (quantidadeNg <= 0) return null;

  if (numeroTag) {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300 text-xs gap-1">
        <Tag className="w-3 h-3" />
        TAG: {numeroTag}
      </Badge>
    );
  }

  const handleSave = async () => {
    if (!tagInput.trim()) {
      toast.error("Informe o número da TAG");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("apontamentos")
        .update({
          numero_tag: tagInput.trim(),
          tag_inserted_at: new Date().toISOString(),
          tag_inserted_by: profile?.full_name || user?.id || "",
        } as any)
        .eq("id", apontamentoId);
      if (error) throw error;
      toast.success("Número de TAG salvo!");
      onTagSaved(tagInput.trim());
      setOpen(false);
      setTagInput("");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar TAG");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Badge
        variant="outline"
        className={`text-[10px] border-amber-300 text-amber-600 bg-amber-50 gap-1 ${
          canInsertTag ? "cursor-pointer hover:bg-amber-100 animate-pulse" : "cursor-default"
        }`}
        onClick={(e) => {
          e.stopPropagation();
          if (canInsertTag) setOpen(true);
        }}
        title={canInsertTag ? "Clique para inserir número de TAG" : "Aguardando número de TAG"}
      >
        <Tag className="w-3 h-3" />
        Aguardando número de TAG
      </Badge>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Tag className="w-4 h-4" />
              Inserir Número de TAG
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Número da TAG *</Label>
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Ex: TAG-2026-001"
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                autoFocus
              />
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Salvar TAG
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
