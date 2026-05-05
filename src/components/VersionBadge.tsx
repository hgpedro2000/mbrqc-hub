import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAppVersion } from "@/hooks/useAppVersion";
import { CHANGE_TYPE_META, type ChangeType } from "@/lib/version";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History } from "lucide-react";

interface ChangelogEntry {
  id: string;
  version: string;
  change_type: ChangeType;
  title: string;
  description: string | null;
  released_at: string;
}

const VersionBadge = () => {
  const { clientVersion, updateAvailable } = useAppVersion();
  const [open, setOpen] = useState(false);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["app_changelog"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_changelog" as any)
        .select("id, version, change_type, title, description, released_at")
        .order("released_at", { ascending: false })
        .limit(100);
      return (data ?? []) as unknown as ChangelogEntry[];
    },
    enabled: open,
    staleTime: 60_000,
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono border transition-colors hover:opacity-80 ${
          updateAvailable
            ? "bg-amber-50 border-amber-300 text-amber-700"
            : "bg-muted/40 border-border text-muted-foreground"
        }`}
        title="Ver histórico de versões"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${updateAvailable ? "bg-amber-500" : "bg-emerald-500"}`} />
        v{clientVersion}{updateAvailable ? " • atualização disponível" : ""}
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

          <ScrollArea className="max-h-[60vh] pr-3">
            {isLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Carregando…</div>
            ) : entries.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Nenhuma versão registrada ainda.</div>
            ) : (
              <ol className="space-y-3 py-2">
                {entries.map((e) => {
                  const meta = CHANGE_TYPE_META[e.change_type] ?? CHANGE_TYPE_META.patch;
                  const isCurrent = e.version === clientVersion;
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
