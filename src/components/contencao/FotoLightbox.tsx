import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

const BUCKET = "containment-photos";

interface Props {
  open: boolean;
  onClose: () => void;
  paths: string[];
  initialIndex?: number;
  title?: string;
}

const FotoLightbox = ({ open, onClose, paths, initialIndex = 0, title }: Props) => {
  const [idx, setIdx] = useState(initialIndex);
  const [url, setUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (open) setIdx(initialIndex); }, [open, initialIndex]);

  useEffect(() => {
    if (!open || !paths[idx]) { setUrl(""); return; }
    let active = true;
    setLoading(true);
    supabase.storage.from(BUCKET).createSignedUrl(paths[idx], 60 * 60).then(({ data }) => {
      if (active) { setUrl(data?.signedUrl || ""); setLoading(false); }
    });
    return () => { active = false; };
  }, [open, idx, paths]);

  const total = paths.length;
  const prev = () => setIdx((i) => (i - 1 + total) % total);
  const next = () => setIdx((i) => (i + 1) % total);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95 border-0">
        <DialogHeader className="px-4 py-2 border-b border-white/10">
          <DialogTitle className="text-white text-sm font-normal">
            {title || "Foto"} <span className="text-white/50">— {idx + 1} / {total}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="relative flex items-center justify-center min-h-[60vh] max-h-[80vh] bg-black">
          {loading && <Loader2 className="w-8 h-8 animate-spin text-white/70 absolute" />}
          {url && (
            <img src={url} alt={title || "foto"} className="max-h-[80vh] max-w-full object-contain" />
          )}
          {total > 1 && (
            <>
              <Button variant="ghost" size="icon" onClick={prev} className="absolute left-2 text-white hover:bg-white/10 h-10 w-10">
                <ChevronLeft className="w-6 h-6" />
              </Button>
              <Button variant="ghost" size="icon" onClick={next} className="absolute right-2 text-white hover:bg-white/10 h-10 w-10">
                <ChevronRight className="w-6 h-6" />
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FotoLightbox;
