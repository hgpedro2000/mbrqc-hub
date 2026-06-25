import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, NotebookPen, Save, Check } from "lucide-react";
import { toast } from "sonner";

/**
 * Personal notepad stored per-user in `capsule_notes`.
 * Auto-saves with a 1.2s debounce; also exposes a manual Save button.
 */
const CapsuleNotepad = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const hydratedRef = useRef(false);

  const { data, isLoading } = useQuery({
    queryKey: ["capsule-note", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("capsule_notes")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (hydratedRef.current) return;
    if (data) {
      setContent((data as any).content || "");
      setSavedContent((data as any).content || "");
      setLastSavedAt((data as any).updated_at || null);
      hydratedRef.current = true;
    } else if (!isLoading && user?.id) {
      hydratedRef.current = true;
    }
  }, [data, isLoading, user?.id]);

  const persist = async (value: string) => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("capsule_notes")
        .upsert({ user_id: user.id, content: value }, { onConflict: "user_id" })
        .select()
        .single();
      if (error) throw error;
      setSavedContent(value);
      setLastSavedAt((data as any).updated_at);
      qc.setQueryData(["capsule-note", user.id], data);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar anotação");
    } finally {
      setSaving(false);
    }
  };

  // Debounced auto-save
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (content === savedContent) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => persist(content), 1200);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  const dirty = content !== savedContent;

  return (
    <div className="border rounded-lg bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/40 border-b">
        <div className="flex items-center gap-2 min-w-0">
          <NotebookPen className="w-4 h-4 text-primary shrink-0" />
          <h3 className="text-sm font-heading font-semibold truncate">Bloco de Anotações</h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            {saving ? (
              <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Salvando...</span>
            ) : dirty ? (
              "Alterações não salvas"
            ) : lastSavedAt ? (
              <span className="flex items-center gap-1"><Check className="w-3 h-3 text-green-600" /> Salvo {new Date(lastSavedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
            ) : (
              "—"
            )}
          </span>
          <Button
            size="sm"
            variant={dirty ? "default" : "outline"}
            className="h-7 gap-1"
            onClick={() => persist(content)}
            disabled={saving || !dirty}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Salvar
          </Button>
        </div>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Escreva aqui suas anotações pessoais... (salvamento automático)"
          className="min-h-[220px] sm:min-h-[260px] rounded-none border-0 focus-visible:ring-0 resize-y font-mono text-sm leading-relaxed"
        />
      )}
    </div>
  );
};

export default CapsuleNotepad;
