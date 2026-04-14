import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTagPermission } from "@/hooks/useTagPermission";
import { useUserRole } from "@/hooks/useUserRole";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag, AlertTriangle, Loader2, CheckCircle, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export const PendingTagsAlert = () => {
  const { user, profile } = useAuth();
  const { canInsertTag } = useTagPermission();
  const { isAdmin } = useUserRole();
  const [pendingItems, setPendingItems] = useState<any[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchPending = async () => {
    if (!user) return;
    // Admin sees all shifts; others see only their own shift
    let query = supabase
      .from("apontamentos")
      .select("id, numero, part_number, part_name, fornecedor, quantidade_ng, turno, data, responsavel")
      .gt("quantidade_ng", 0)
      .is("numero_tag" as any, null)
      .order("data", { ascending: false });

    if (!isAdmin && profile?.turno) {
      query = query.eq("turno", profile.turno);
    } else if (!isAdmin && !profile?.turno) {
      // Non-admin without a shift — nothing to show
      setPendingItems([]);
      return;
    }

    const { data } = await query;
    setPendingItems(data || []);
  };

  useEffect(() => {
    if (canInsertTag) fetchPending();
  }, [canInsertTag, user]);

  const handleSaveTag = async (id: string) => {
    if (!tagInput.trim()) { toast.error("Informe o número da TAG"); return; }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("apontamentos")
        .update({
          numero_tag: tagInput.trim(),
          tag_inserted_at: new Date().toISOString(),
          tag_inserted_by: profile?.full_name || "",
        } as any)
        .eq("id", id);
      if (error) throw error;
      toast.success("TAG salva!");
      setTagInput("");
      setEditingId(null);
      await fetchPending();
    } catch (e: any) {
      toast.error("Erro ao salvar TAG");
    } finally {
      setSaving(false);
    }
  };

  if (!canInsertTag || pendingItems.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setListOpen(true)}
        className="relative flex items-center gap-2 px-3 py-2 rounded-xl
          bg-amber-50 border border-amber-300 text-amber-700
          hover:bg-amber-100 transition-colors text-sm font-semibold w-full sm:w-auto"
      >
        <span className="relative">
          <AlertTriangle className="w-4 h-4" />
          <Badge className="absolute -top-2 -right-3 h-4 min-w-4 px-1 text-[10px] bg-amber-500 text-white border-0">
            {pendingItems.length}
          </Badge>
        </span>
        <span className="ml-2">TAGs Pendentes do Turno {profile?.turno}</span>
      </button>

      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Tag className="w-4 h-4" />
              Apontamentos Pendentes de TAG — Turno {profile?.turno}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            {pendingItems.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">
                Nenhum apontamento pendente de TAG.
              </p>
            ) : (
              pendingItems.map((item) => (
                <div key={item.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded">
                          #{item.numero}
                        </span>
                        <Badge variant="destructive" className="text-[10px]">
                          NG: {item.quantidade_ng}
                        </Badge>
                      </div>
                      <p className="text-sm font-semibold truncate">{item.part_number}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.fornecedor} • {item.responsavel}
                      </p>
                    </div>
                    {editingId !== item.id && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 text-xs"
                        onClick={() => { setEditingId(item.id); setTagInput(""); }}
                      >
                        <Tag className="w-3 h-3 mr-1" />
                        Inserir TAG
                      </Button>
                    )}
                  </div>

                  {editingId === item.id && (
                    <div className="flex items-center gap-2">
                      <Input
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        placeholder="Número da TAG"
                        className="h-8 text-sm flex-1"
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && handleSaveTag(item.id)}
                      />
                      <Button
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => handleSaveTag(item.id)}
                        disabled={saving}
                      >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
