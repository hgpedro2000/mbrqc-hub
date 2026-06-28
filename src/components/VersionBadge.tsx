import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAppVersion } from "@/hooks/useAppVersion";
import { useUserRole } from "@/hooks/useUserRole";
import { CHANGE_TYPE_META, compareVersions, type ChangeType } from "@/lib/version";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, RefreshCw } from "lucide-react";

interface ChangelogEntry {
  id: string;
  version: string;
  change_type: ChangeType;
  title: string;
  description: string | null;
  released_at: string;
}

const CHANGELOG_QUERY_KEY = ["app_changelog"] as const;

const VersionBadge = () => {
  const { clientVersion, updateAvailable, deployedVersion, minRequiredVersion, lastCheckedAt, recheck } = useAppVersion();
  const { isAdmin } = useUserRole();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const [historyRealtime, setHistoryRealtime] = useState<"connecting" | "active" | "fallback">("connecting");

  const { data: entries = [], isLoading } = useQuery({
    queryKey: CHANGELOG_QUERY_KEY,
    queryFn: async () => {
      const { data } = await supabase
        .from("app_changelog" as any)
        .select("id, version, change_type, title, description, released_at")
        .order("released_at", { ascending: false })
        .limit(100);
      return (data ?? []) as unknown as ChangelogEntry[];
    },
    enabled: open,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    let subscribed = false;
    let disposed = false;
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;

    const refreshHistory = () => {
      queryClient.invalidateQueries({ queryKey: CHANGELOG_QUERY_KEY });
      void recheck();
    };

    const startFallback = () => {
      if (disposed) return;
      setHistoryRealtime("fallback");
      if (!fallbackTimer) fallbackTimer = setInterval(refreshHistory, 30_000);
    };

    const fallbackDelay = setTimeout(() => {
      if (!subscribed) startFallback();
    }, 8000);

    const channel = supabase
      .channel(`app-changelog-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "app_changelog" }, refreshHistory)
      .subscribe((status) => {
        if (disposed) return;
        if (status === "SUBSCRIBED") {
          subscribed = true;
          setHistoryRealtime("active");
          clearTimeout(fallbackDelay);
          if (fallbackTimer) {
            clearInterval(fallbackTimer);
            fallbackTimer = null;
          }
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          subscribed = false;
          startFallback();
        }
      });

    return () => {
      disposed = true;
      clearTimeout(fallbackDelay);
      if (fallbackTimer) clearInterval(fallbackTimer);
      supabase.removeChannel(channel);
    };
  }, [queryClient, recheck]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono border transition-colors hover:opacity-80 ${
          updateAvailable
            ? "bg-amber-100 border-amber-400 text-amber-800 animate-pulse shadow-[0_0_0_0_rgba(245,158,11,0.6)] ring-2 ring-amber-300/60"
            : "bg-muted/40 border-border text-muted-foreground"
        }`}
        title={updateAvailable ? "Nova versão disponível — clique para ver" : "Ver histórico de versões"}
      >
        {updateAvailable && (
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
          </span>
        )}
        <span className={`w-1.5 h-1.5 rounded-full ${updateAvailable ? "bg-amber-500" : "bg-emerald-500"}`} />
        v{clientVersion}{updateAvailable ? " • atualizar" : ""}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Histórico de versões
            </DialogTitle>
            <DialogDescription>
              Versão atual: <span className="font-mono font-semibold">v{clientVersion}</span>
              <br />
              Formato: <span className="font-mono">MAJOR.SECURITY.MINOR.PATCH</span>
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-1.5 pb-2 border-b">
            {(Object.keys(CHANGE_TYPE_META) as ChangeType[]).map((t) => (
              <span key={t} className={`text-[10px] px-1.5 py-0.5 rounded border ${CHANGE_TYPE_META[t].color}`}>
                {CHANGE_TYPE_META[t].label}
              </span>
            ))}
          </div>

          {isAdmin && (
            <div className="rounded-md border border-dashed border-amber-400/60 bg-amber-50/40 dark:bg-amber-950/20 p-2 text-[11px] font-mono space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-amber-700 dark:text-amber-400">🛠 Debug (admin)</span>
                <button
                  type="button"
                  onClick={async () => { setRechecking(true); await recheck(); setRechecking(false); }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded border bg-background hover:bg-muted"
                >
                  <RefreshCw className={`w-3 h-3 ${rechecking ? "animate-spin" : ""}`} /> rechecar
                </button>
              </div>
              <div>client: <span className="font-semibold">v{clientVersion}</span></div>
              <div>
                deployed (index.html): <span className="font-semibold">{deployedVersion ? `v${deployedVersion}` : "—"}</span>
              </div>
              <div>min_required (DB): <span className="font-semibold">{minRequiredVersion ? `v${minRequiredVersion}` : "—"}</span></div>
              <div>
                cmp(client, deployed):{" "}
                <span className="font-semibold">
                  {deployedVersion ? compareVersions(clientVersion, deployedVersion) : "n/a"}
                </span>{" "}
                → updateAvailable: <span className="font-semibold">{String(updateAvailable)}</span>
              </div>
              <div>último check: {lastCheckedAt ? lastCheckedAt.toLocaleTimeString("pt-BR") : "—"}</div>
              <div>histórico: <span className="font-semibold">{historyRealtime === "active" ? "realtime ativo" : historyRealtime === "fallback" ? "fallback polling" : "conectando"}</span></div>
              {!deployedVersion && (
                <div className="text-red-600 dark:text-red-400">
                  ⚠ meta tag não encontrada no HTML implantado — botão de atualizar não aparece.
                </div>
              )}
            </div>
          )}

          <ScrollArea className="max-h-[60vh] pr-3">
            {isLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Carregando…</div>
            ) : entries.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Nenhuma versão registrada ainda.</div>
            ) : (
              <ol className="space-y-3 py-2">
                {entries.map((e, idx) => {
                  const meta = CHANGE_TYPE_META[e.change_type] ?? CHANGE_TYPE_META.patch;
                  const hasExact = entries.some((x) => x.version === clientVersion);
                  const isCurrent = hasExact ? e.version === clientVersion : idx === 0;
                  return (
                    <li
                      key={e.id}
                      className={`rounded-lg border p-3 ${isCurrent ? "border-primary/50 bg-primary/5" : "border-border"}`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-sm font-semibold truncate">v{e.version}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap ${meta.color}`}>
                            {meta.label}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">
                              atual
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {new Date(e.released_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{e.title}</p>
                      {e.description && (
                        <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{e.description}</p>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default VersionBadge;
