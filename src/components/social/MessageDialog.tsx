import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";

interface Msg {
  id: string;
  from_user_id: string;
  to_user_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: { id: string; full_name: string; employee_number?: string } | null;
  online?: boolean;
}

export const MessageDialog = ({ open, onOpenChange, target, online }: Props) => {
  const { user } = useAuth();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !target || !user) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("direct_messages" as any)
        .select("*")
        .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${target.id}),and(from_user_id.eq.${target.id},to_user_id.eq.${user.id})`)
        .order("created_at", { ascending: true })
        .limit(50);
      setMessages((data as any) || []);
      setLoading(false);

      // mark unread messages from target as read
      await supabase
        .from("direct_messages" as any)
        .update({ read_at: new Date().toISOString() })
        .eq("from_user_id", target.id)
        .eq("to_user_id", user.id)
        .is("read_at", null);
    })();

    // realtime append
    const ch = supabase
      .channel(`dm-thread:${user.id}:${target.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, (payload: any) => {
        const m = payload.new as Msg;
        const rel =
          (m.from_user_id === user.id && m.to_user_id === target.id) ||
          (m.from_user_id === target.id && m.to_user_id === user.id);
        if (rel) setMessages((prev) => [...prev, m]);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [open, target?.id, user?.id]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    if (!user || !target) return;
    const text = body.trim();
    if (!text) return;
    setSending(true);
    const { error } = await supabase.from("direct_messages" as any).insert({
      from_user_id: user.id,
      to_user_id: target.id,
      body: text,
    });
    setSending(false);
    if (error) { toast.error("Falha ao enviar: " + error.message); return; }
    setBody("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {target?.full_name}
            {online && <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />}
            {target?.employee_number && <Badge variant="outline" className="text-[10px] font-mono">{target.employee_number}</Badge>}
          </DialogTitle>
          <DialogDescription>Mensagem direta ao usuário</DialogDescription>
        </DialogHeader>

        <div ref={listRef} className="h-64 overflow-y-auto rounded-md border bg-muted/20 p-3 space-y-2">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : messages.length === 0 ? (
            <p className="text-xs text-center text-muted-foreground py-8">Nenhuma mensagem ainda. Diga oi 👋</p>
          ) : (
            messages.map((m) => {
              const mine = m.from_user_id === user?.id;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-sm whitespace-pre-wrap break-words ${mine ? "bg-primary text-primary-foreground" : "bg-background border"}`}>
                    {m.body}
                    <div className={`text-[9px] mt-0.5 opacity-70 ${mine ? "text-right" : ""}`}>
                      {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escreva sua mensagem..."
          maxLength={2000}
          rows={3}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); }
          }}
        />
        <DialogFooter>
          <span className="text-[10px] text-muted-foreground mr-auto">Ctrl/⌘ + Enter para enviar</span>
          <Button onClick={send} disabled={sending || !body.trim()} className="gap-2">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MessageDialog;
