import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckSquare } from "lucide-react";

const BUCKET = "containment-photos";

interface Props {
  fotosProblema?: string[] | null;
  fotosMarkCheck?: string[] | null;
  size?: "sm" | "md";
  showLabels?: boolean;
}

const useSignedUrls = (paths: string[]) => {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    if (!paths.length) { setUrls([]); return; }
    Promise.all(
      paths.map((p) => supabase.storage.from(BUCKET).createSignedUrl(p, 60 * 60).then(({ data }) => data?.signedUrl || ""))
    ).then((u) => { if (active) setUrls(u.filter(Boolean)); });
    return () => { active = false; };
  }, [paths.join("|")]);
  return urls;
};

const ContencaoFotosStrip = ({ fotosProblema, fotosMarkCheck, size = "sm", showLabels = true }: Props) => {
  const problema = Array.isArray(fotosProblema) ? fotosProblema : [];
  const mark = Array.isArray(fotosMarkCheck) ? fotosMarkCheck : [];
  const urlsProblema = useSignedUrls(problema);
  const urlsMark = useSignedUrls(mark);

  if (problema.length === 0 && mark.length === 0) return null;
  const dim = size === "sm" ? "w-12 h-12" : "w-16 h-16";

  return (
    <div className="flex flex-wrap gap-3 mt-2">
      {problema.length > 0 && (
        <div className="space-y-1">
          {showLabels && (
            <div className="flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400 font-medium">
              <AlertTriangle className="w-3 h-3" /> Defeito
            </div>
          )}
          <div className="flex gap-1">
            {urlsProblema.slice(0, 3).map((u, i) => (
              <a key={i} href={u} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                <img src={u} alt="defeito" className={`${dim} object-cover rounded border border-red-500/30`} />
              </a>
            ))}
            {problema.length > 3 && (
              <div className={`${dim} rounded border bg-muted flex items-center justify-center text-xs text-muted-foreground`}>+{problema.length - 3}</div>
            )}
          </div>
        </div>
      )}
      {mark.length > 0 && (
        <div className="space-y-1">
          {showLabels && (
            <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckSquare className="w-3 h-3" /> Mark Check
            </div>
          )}
          <div className="flex gap-1">
            {urlsMark.slice(0, 3).map((u, i) => (
              <a key={i} href={u} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                <img src={u} alt="mark check" className={`${dim} object-cover rounded border border-emerald-500/30`} />
              </a>
            ))}
            {mark.length > 3 && (
              <div className={`${dim} rounded border bg-muted flex items-center justify-center text-xs text-muted-foreground`}>+{mark.length - 3}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ContencaoFotosStrip;
