import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckSquare } from "lucide-react";

const BUCKET = "containment-photos";

interface Props {
  fotosProblema?: string[] | null;
  fotosMarkCheck?: string[] | null;
  size?: "sm" | "md" | "lg";
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

const DIMS: Record<NonNullable<Props["size"]>, string> = {
  sm: "w-12 h-12",
  md: "w-16 h-16",
  lg: "w-20 h-20 sm:w-24 sm:h-24",
};

const ContencaoFotosStrip = ({ fotosProblema, fotosMarkCheck, size = "sm", showLabels = true }: Props) => {
  const problema = Array.isArray(fotosProblema) ? fotosProblema : [];
  const mark = Array.isArray(fotosMarkCheck) ? fotosMarkCheck : [];
  const urlsProblema = useSignedUrls(problema);
  const urlsMark = useSignedUrls(mark);

  if (problema.length === 0 && mark.length === 0) return null;
  const dim = DIMS[size];

  const Section = ({
    urls, total, label, Icon, color, border,
  }: { urls: string[]; total: number; label: string; Icon: any; color: string; border: string }) => (
    <div className="flex-1 min-w-0 space-y-1">
      {showLabels && (
        <div className={`flex items-center gap-1 text-[10px] font-medium ${color}`}>
          <Icon className="w-3 h-3" /> {label}
        </div>
      )}
      <div className="flex gap-1.5 flex-wrap">
        {urls.slice(0, 3).map((u, i) => (
          <a key={i} href={u} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
            <img src={u} alt={label} className={`${dim} object-cover rounded-md border ${border}`} />
          </a>
        ))}
        {total > 3 && (
          <div className={`${dim} rounded-md border bg-muted flex items-center justify-center text-xs text-muted-foreground`}>+{total - 3}</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col sm:flex-row gap-3 mt-2">
      {problema.length > 0 && (
        <Section urls={urlsProblema} total={problema.length} label="Defeito" Icon={AlertTriangle} color="text-red-600 dark:text-red-400" border="border-red-500/30" />
      )}
      {mark.length > 0 && (
        <Section urls={urlsMark} total={mark.length} label="Mark Check" Icon={CheckSquare} color="text-emerald-600 dark:text-emerald-400" border="border-emerald-500/30" />
      )}
    </div>
  );
};


export default ContencaoFotosStrip;
