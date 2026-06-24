import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckSquare } from "lucide-react";
import FotoLightbox from "./FotoLightbox";

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
  sm: "w-14 h-14",
  md: "w-20 h-20",
  lg: "w-24 h-24 sm:w-28 sm:h-28",
};

const ContencaoFotosStrip = ({ fotosProblema, fotosMarkCheck, size = "sm", showLabels = true }: Props) => {
  const problema = Array.isArray(fotosProblema) ? fotosProblema : [];
  const mark = Array.isArray(fotosMarkCheck) ? fotosMarkCheck : [];
  const urlsProblema = useSignedUrls(problema);
  const urlsMark = useSignedUrls(mark);
  const [lightbox, setLightbox] = useState<{ paths: string[]; index: number; title: string } | null>(null);

  if (problema.length === 0 && mark.length === 0) return null;
  const dim = DIMS[size];

  const Section = ({
    paths, urls, label, Icon, color, border,
  }: { paths: string[]; urls: string[]; label: string; Icon: any; color: string; border: string }) => (
    <div className="flex-1 min-w-0 space-y-1.5">
      {showLabels && (
        <div className={`flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold ${color}`}>
          <Icon className="w-3 h-3" /> {label}
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        {urls.slice(0, 3).map((u, i) => (
          <button
            key={i}
            type="button"
            onClick={(e) => { e.stopPropagation(); setLightbox({ paths, index: i, title: label }); }}
            className={`${dim} shrink-0 rounded-md border ${border} overflow-hidden bg-muted hover:ring-2 hover:ring-accent transition`}
          >
            <img src={u} alt={label} className="w-full h-full object-cover" />
          </button>
        ))}
        {paths.length > 3 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setLightbox({ paths, index: 3, title: label }); }}
            className={`${dim} shrink-0 rounded-md border bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground hover:bg-muted/70`}
          >
            +{paths.length - 3}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-2">
        {problema.length > 0 && (
          <Section paths={problema} urls={urlsProblema} label="Defeito" Icon={AlertTriangle} color="text-red-600 dark:text-red-400" border="border-red-500/30" />
        )}
        {mark.length > 0 && (
          <Section paths={mark} urls={urlsMark} label="Mark Check" Icon={CheckSquare} color="text-emerald-600 dark:text-emerald-400" border="border-emerald-500/30" />
        )}
      </div>
      <FotoLightbox
        open={!!lightbox}
        onClose={() => setLightbox(null)}
        paths={lightbox?.paths || []}
        initialIndex={lightbox?.index || 0}
        title={lightbox?.title}
      />
    </>
  );
};



export default ContencaoFotosStrip;
