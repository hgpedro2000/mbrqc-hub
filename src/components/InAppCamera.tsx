import { useEffect, useRef, useState, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, X, RefreshCw, Check, RotateCcw } from "lucide-react";

interface Props {
  open: boolean;
  onCapture: (file: File) => void;
  onClose: () => void;
  initialStream?: MediaStream | null;
}

/**
 * In-app camera using getUserMedia. Avoids the Android bug where the WebView
 * is killed while the native camera Intent is open (capture="environment"),
 * which loses both the photo and the form state.
 */
const InAppCamera = ({ open, onCapture, onClose, initialStream }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string>("");
  const [starting, setStarting] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setVideoReady(false);
  }, []);

  const attachStream = useCallback(async (stream: MediaStream) => {
    const video = videoRef.current;
    if (!video) throw new Error("video_not_ready");

    video.setAttribute("playsinline", "true");
    video.muted = true;
    video.srcObject = stream;

    await new Promise<void>((resolve) => {
      if (video.readyState >= 1) return resolve();
      const done = () => resolve();
      video.addEventListener("loadedmetadata", done, { once: true });
      window.setTimeout(done, 900);
    });

    await video.play();

    await new Promise<void>((resolve, reject) => {
      const startedAt = Date.now();
      const check = () => {
        if (video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2) {
          resolve();
          return;
        }
        if (Date.now() - startedAt > 1400) {
          reject(new Error("video_black_frame"));
          return;
        }
        requestAnimationFrame(check);
      };
      check();
    });

    setVideoReady(true);
  }, []);

  const start = useCallback(async (mode: "environment" | "user") => {
    setError("");
    setStarting(true);
    stop();
    const constraints: MediaTrackConstraints[] = [
      { facingMode: { exact: mode }, width: { ideal: 1280 }, height: { ideal: 720 } },
      { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 720 } },
      { facingMode: { ideal: mode } },
      {},
    ];

    let lastError: unknown = null;
    try {
      for (const videoConstraints of constraints) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
          streamRef.current = stream;
          await attachStream(stream);
          return;
        } catch (err) {
          lastError = err;
          streamRef.current?.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          if (videoRef.current) videoRef.current.srcObject = null;
        }
      }
      throw lastError;
    } catch (err: unknown) {
      console.error("[InAppCamera] camera start failed", err);
      const errorName = err instanceof DOMException ? err.name : "";
      setError(
        errorName === "NotAllowedError"
          ? "Permissão de câmera negada. Habilite nas configurações do navegador."
          : "Não foi possível abrir a câmera. Feche o leitor e tente novamente."
      );
    } finally {
      setStarting(false);
    }
  }, [attachStream, stop]);

  useEffect(() => {
    if (!open) {
      stop();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setPreviewBlob(null);
      setError("");
      return;
    }
    if (initialStream) {
      const tracks = initialStream.getVideoTracks();
      const hasLiveTrack = tracks.some((t) => t.readyState === "live" && t.enabled);
      if (hasLiveTrack) {
        setError("");
        setStarting(true);
        streamRef.current = initialStream;
        void attachStream(initialStream)
          .catch((err) => {
            console.warn("[InAppCamera] initialStream did not render, requesting fresh stream", err);
            return start(facing);
          })
          .finally(() => setStarting(false));
        return () => { stop(); };
      }
      // Stream is dead (camera was busy) → start our own.
      console.warn("[InAppCamera] initialStream is inactive, requesting fresh stream");
    }
    void start(facing);
    return () => { stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialStream]);

  const handleSwitch = async () => {
    const next = facing === "environment" ? "user" : "environment";
    setFacing(next);
    await start(next);
  };

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        stop();
      },
      "image/jpeg",
      0.9
    );
  };

  const handleConfirm = () => {
    if (!previewBlob) return;
    const file = new File([previewBlob], `foto-${Date.now()}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewBlob(null);
    onCapture(file);
  };

  const handleRetake = async () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewBlob(null);
    await start(facing);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden bg-black border-0">
        <div className="relative w-full" style={{ aspectRatio: "3 / 4" }}>
          {/* Live preview */}
          {!previewUrl && (
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="w-full h-full object-cover bg-black"
            />
          )}
          {/* Captured preview */}
          {previewUrl && (
            <img src={previewUrl} alt="Captura" className="w-full h-full object-contain bg-black" />
          )}

          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-2 bg-gradient-to-b from-black/70 to-transparent">
            <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20 h-9 w-9">
              <X className="w-5 h-5" />
            </Button>
            {!previewUrl && (
              <Button variant="ghost" size="icon" onClick={handleSwitch} className="text-white hover:bg-white/20 h-9 w-9" disabled={starting}>
                <RefreshCw className="w-5 h-5" />
              </Button>
            )}
          </div>

          {/* Status / errors */}
          {(starting || error) && (
            <div className="absolute inset-0 flex items-center justify-center text-center px-4">
              {starting && !error && (
                <p className="text-white/90 text-sm">Iniciando câmera…</p>
              )}
              {error && (
                <p className="text-destructive bg-background/90 rounded-md px-3 py-2 text-sm">{error}</p>
              )}
            </div>
          )}

          {/* Bottom controls */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-6 p-4 bg-gradient-to-t from-black/70 to-transparent">
            {!previewUrl ? (
              <button
                type="button"
                onClick={handleCapture}
                disabled={starting || !!error || !videoReady}
                aria-label="Capturar foto"
                className="w-16 h-16 rounded-full bg-white border-4 border-white/40 active:scale-95 transition disabled:opacity-50"
              />
            ) : (
              <>
                <Button variant="secondary" onClick={handleRetake} className="gap-2">
                  <RotateCcw className="w-4 h-4" /> Refazer
                </Button>
                <Button onClick={handleConfirm} className="gap-2">
                  <Check className="w-4 h-4" /> Usar foto
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InAppCamera;
