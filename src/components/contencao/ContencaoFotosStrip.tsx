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

const HEIGHTS: Record<NonNullable<Props["size"]>, string> = {
  sm: "h-16",
  md: "h-24",
  lg: "h-28",
};

const ContencaoFotosStrip = ({ fotosProblema, fotosMarkCheck, size = "sm", showLabels = true }: Props) => {
  const problema = Array.isArray(fotosProblema) ? fotosProblema : [];
  const mark = Array.isArray(fotosMarkCheck) ? fotosMarkCheck : [];
  const urlsProblema = useSignedUrls(problema);
  const urlsMark = useSignedUrls(mark);
  const [lightbox, setLightbox] = useState<{ paths: string[]; index: number; title: string } | null>(null);

  if (problema.length === 0 && mark.length === 0) return null;
  const h = HEIGHTS[size];

  const Section = ({
    paths, urls, label, Icon, color, border,
  }: { paths: string[]; urls: string[]; label: string; Icon: any; color: string; border: string }) => (
    <div className="min-w-0 space-y-1.5">
      {showLabels && (
        <div className={`flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide font-semibold ${color}`}>
          <Icon className="w-3 h-3" /> {label} {paths.length > 0 && <span className="text-muted-foreground normal-case">({paths.length})</span>}
        </div>
      )}
      <div className="grid grid-cols-3 gap-1.5">
        {urls.slice(0, 3).map((u, i) => (
          <button
            key={i}
            type="button"
            onClick={(e) => { e.stopPropagation(); setLightbox({ paths, index: i, title: label }); }}
            className={`${h} w-full rounded-md border ${border} overflow-hidden bg-muted hover:ring-2 hover:ring-accent transition`}
          >
            <img src={u} alt={label} className="w-full h-full object-cover" />
          </button>
        ))}
        {paths.length === 0 && (
          <div className={`${h} w-full rounded-md border border-dashed border-muted-foreground/20 bg-muted/30`} />
        )}
        {paths.length > 3 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setLightbox({ paths, index: 3, title: label }); }}
            className={`${h} w-full rounded-md border bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground hover:bg-muted/70`}
          >
            +{paths.length - 3}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-2">
        <Section paths={problema} urls={urlsProblema} label="Defeito" Icon={AlertTriangle} color="text-red-600 dark:text-red-400" border="border-red-500/30" />
        <Section paths={mark} urls={urlsMark} label="Mark Check" Icon={CheckSquare} color="text-emerald-600 dark:text-emerald-400" border="border-emerald-500/30" />
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
