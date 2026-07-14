import { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface PresenceContextType {
  online: Set<string>;
  isOnline: (userId: string) => boolean;
  socialEnabled: boolean;
  setSocialEnabled: (v: boolean) => void;
  unreadCount: number;
}

const PresenceContext = createContext<PresenceContextType>({
  online: new Set(),
  isOnline: () => false,
  socialEnabled: false,
  setSocialEnabled: () => {},
  unreadCount: 0,
});

export const usePresence = () => useContext(PresenceContext);

const STORAGE_KEY = "mbrq.social.enabled";

export const PresenceProvider = ({ children }: { children: ReactNode }) => {
  const { user, profile } = useAuth();
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [socialEnabled, setSocialEnabledState] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const channelRef = useRef<any>(null);

  const setSocialEnabled = useCallback((v: boolean) => {
    setSocialEnabledState(v);
    try { localStorage.setItem(STORAGE_KEY, v ? "1" : "0"); } catch {}
  }, []);

  // Presence: join a shared channel while signed in
  useEffect(() => {
    if (!user?.id) {
      setOnline(new Set());
      return;
    }
    const channel = supabase.channel("presence:users", {
      config: { presence: { key: user.id } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, any[]>;
        setOnline(new Set(Object.keys(state)));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: user.id,
            name: profile?.full_name ?? null,
            at: new Date().toISOString(),
          });
        }
      });

    return () => {
      try { channel.untrack(); } catch {}
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user?.id, profile?.full_name]);

  // Inbox: subscribe to direct messages addressed to me + initial unread count
  useEffect(() => {
    if (!user?.id) { setUnreadCount(0); return; }

    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from("direct_messages" as any)
        .select("id", { count: "exact", head: true })
        .eq("to_user_id", user.id)
        .is("read_at", null);
      if (!cancelled) setUnreadCount(count ?? 0);
    })();

    const ch = supabase
      .channel(`dm:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `to_user_id=eq.${user.id}`,
        },
        async (payload: any) => {
          setUnreadCount((c) => c + 1);
          const from = payload.new?.from_user_id;
          let name = "Alguém";
          if (from) {
            const { data } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", from)
              .maybeSingle();
            if (data?.full_name) name = data.full_name;
          }
          toast.info(`💬 ${name}`, {
            description: payload.new?.body?.slice(0, 120),
            duration: 6000,
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [user?.id]);

  return (
    <PresenceContext.Provider value={{
      online,
      isOnline: (id: string) => online.has(id),
      socialEnabled,
      setSocialEnabled,
      unreadCount,
    }}>
      {children}
    </PresenceContext.Provider>
  );
};
