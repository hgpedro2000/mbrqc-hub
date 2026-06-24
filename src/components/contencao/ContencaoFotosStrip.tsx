import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckSquare } from "lucide-react";
import FotoLightbox from "./FotoLightbox";

const BUCKET = "containment-photos";

interface Props {
  fotosProblema?: string[] | null;
  fotosMarkCheck?: string[] | null;
  size?: "sm" | "md" | "lg";
  showLabels?: boolean;
  debug?: boolean;
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
  sm: "h-14 sm:h-16",
  md: "h-20 sm:h-24",
  lg: "h-24 sm:h-28 md:h-32",
};

const TOLERANCE_PX = 1;

const Section = ({
  paths, urls, label, Icon, color, border, h, debug, onOpen,
}: {
  paths: string[]; urls: string[]; label: string; Icon: any;
  color: string; border: string; h: string; debug: boolean;
  onOpen: (index: number) => void;
}) => {
  const labelRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [offset, setOffset] = useState<number>(0);

  useLayoutEffect(() => {
    if (!debug) return;
    const measure = () => {
      const l = labelRef.current?.getBoundingClientRect();
      const g = gridRef.current?.getBoundingClientRect();
      if (!l || !g) return;
      setOffset(Math.round((l.left + l.width / 2) - (g.left + g.width / 2)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (labelRef.current) ro.observe(labelRef.current);
    if (gridRef.current) ro.observe(gridRef.current);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [debug, h, urls.length]);

  const misaligned = debug && Math.abs(offset) > TOLERANCE_PX;
  const debugLabelCls = debug ? (misaligned ? "outline outline-2 outline-red-500 bg-red-500/10" : "outline outline-1 outline-emerald-500/60") : "";
  const debugGridCls = debug ? (misaligned ? "outline outline-2 outline-red-500" : "outline outline-1 outline-emerald-500/60") : "";

  return (
    <div className="min-w-0 space-y-1.5 relative">
      <div ref={labelRef} className={`flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide font-semibold ${color} ${debugLabelCls}`}>
        <Icon className="w-3 h-3" /> {label} {paths.length > 0 && <span className="text-muted-foreground normal-case">({paths.length})</span>}
        {debug && <span className={`ml-1 normal-case font-mono ${misaligned ? "text-red-500" : "text-emerald-600"}`}>Δ{offset}px</span>}
      </div>
      <div ref={gridRef} className={`grid grid-cols-3 gap-1.5 relative ${debugGridCls}`}>
        {urls.slice(0, 3).map((u, i) => (
          <button
            key={i}
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpen(i); }}
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
            onClick={(e) => { e.stopPropagation(); onOpen(3); }}
            className={`${h} w-full rounded-md border bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground hover:bg-muted/70`}
          >
            +{paths.length - 3}
          </button>
        )}
        {debug && (
          <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-fuchsia-500/70" />
        )}
      </div>
      {debug && (
        <div className="pointer-events-none absolute left-1/2 top-0 bottom-0 w-px bg-fuchsia-500/30" />
      )}
    </div>
  );
};

const ContencaoFotosStrip = ({ fotosProblema, fotosMarkCheck, size = "sm", showLabels = true, debug = false }: Props) => {
  const problema = Array.isArray(fotosProblema) ? fotosProblema : [];
  const mark = Array.isArray(fotosMarkCheck) ? fotosMarkCheck : [];
  const urlsProblema = useSignedUrls(problema);
  const urlsMark = useSignedUrls(mark);
  const [lightbox, setLightbox] = useState<{ paths: string[]; index: number; title: string } | null>(null);

  if (problema.length === 0 && mark.length === 0) return null;
  const h = HEIGHTS[size];
  // showLabels currently always true visually; kept for backward compat
  void showLabels;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-2">
        <Section paths={problema} urls={urlsProblema} label="Defeito" Icon={AlertTriangle}
          color="text-red-600 dark:text-red-400" border="border-red-500/30" h={h} debug={debug}
          onOpen={(i) => setLightbox({ paths: problema, index: i, title: "Defeito" })} />
        <Section paths={mark} urls={urlsMark} label="Mark Check" Icon={CheckSquare}
          color="text-emerald-600 dark:text-emerald-400" border="border-emerald-500/30" h={h} debug={debug}
          onOpen={(i) => setLightbox({ paths: mark, index: i, title: "Mark Check" })} />
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
