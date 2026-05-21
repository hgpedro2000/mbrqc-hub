import { useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats, type Html5QrcodeCameraScanConfig } from "html5-qrcode";
import jsQR, { type QRCode } from "jsqr";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QrCode, AlertTriangle, Pencil, Send, Loader2, Camera, ImagePlus, ScanLine, Keyboard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { parseHyundaiQR, HyundaiQRData } from "@/lib/parseHyundaiQR";
import { playBeep } from "@/lib/beep";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import InAppCamera from "@/components/InAppCamera";

interface QRScannerButtonProps {
  onScan: (data: HyundaiQRData) => void;
  disabled?: boolean;
  disabledReason?: string;
}

export interface QRScannerButtonHandle {
  openScanner: () => void;
}

const READER_ID = "qr-reader-incoming";
const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
  Html5QrcodeSupportedFormats.AZTEC,
  Html5QrcodeSupportedFormats.PDF_417,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.EAN_13,
];

const getScanConfig = (): Html5QrcodeCameraScanConfig => ({
  fps: 20,
  qrbox: (viewfinderWidth, viewfinderHeight) => {
    const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
    const size = Math.floor(Math.min(360, Math.max(220, minEdge * 0.82)));
    return { width: size, height: size };
  },
  aspectRatio: 1,
  disableFlip: false,
});

type ZoomOptions = { min: number; max: number; step: number };
type QrMarkerPoint = { x: number; y: number };
type QrMarker = { points: QrMarkerPoint[]; center: QrMarkerPoint };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const buildQrMarker = (
  location: QRCode["location"],
  video: HTMLVideoElement,
  container: HTMLElement,
  canvasWidth: number,
  canvasHeight: number
): QrMarker | null => {
  if (!video.videoWidth || !video.videoHeight || !canvasWidth || !canvasHeight) return null;

  const videoRect = video.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const contentScale = Math.max(videoRect.width / video.videoWidth, videoRect.height / video.videoHeight);
  const renderedWidth = video.videoWidth * contentScale;
  const renderedHeight = video.videoHeight * contentScale;
  const offsetX = videoRect.left - containerRect.left + (videoRect.width - renderedWidth) / 2;
  const offsetY = videoRect.top - containerRect.top + (videoRect.height - renderedHeight) / 2;

  const toPoint = (point: QrMarkerPoint) => {
    const sourceX = (point.x / canvasWidth) * video.videoWidth;
    const sourceY = (point.y / canvasHeight) * video.videoHeight;
    return {
      x: clamp(offsetX + sourceX * contentScale, 0, containerRect.width),
      y: clamp(offsetY + sourceY * contentScale, 0, containerRect.height),
    };
  };

  const points = [
    toPoint(location.topLeftCorner),
    toPoint(location.topRightCorner),
    toPoint(location.bottomRightCorner),
    toPoint(location.bottomLeftCorner),
  ];
  const center = points.reduce(
    (acc, point) => ({ x: acc.x + point.x / points.length, y: acc.y + point.y / points.length }),
    { x: 0, y: 0 }
  );

  return { points, center };
};

export const QRScannerButton = forwardRef<QRScannerButtonHandle, QRScannerButtonProps>(({ onScan, disabled, disabledReason }, ref) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [scannerOpen, setScannerOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannerStarting, setScannerStarting] = useState(false);
  const [zoomOptions, setZoomOptions] = useState<ZoomOptions | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number | null>(null);
  const [cameraCaptureOpen, setCameraCaptureOpen] = useState(false);
  const [cameraCaptureStream, setCameraCaptureStream] = useState<MediaStream | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [qrMarker, setQrMarker] = useState<QrMarker | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasScanned = useRef(false);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const detectorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const detectorFrameRef = useRef<number | null>(null);
  const detectorLastRunRef = useRef(0);
  const pendingDetectorDecodeRef = useRef<number | null>(null);

  const [incompatibleOpen, setIncompatibleOpen] = useState(false);
  const [rawQR, setRawQR] = useState("");
  const [sending, setSending] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  const [usbReaderOpen, setUsbReaderOpen] = useState(false);
  const [usbBuffer, setUsbBuffer] = useState("");
  const usbInputRef = useRef<HTMLInputElement | null>(null);

  const stopLiveQrDetector = useCallback(() => {
    if (detectorFrameRef.current !== null) cancelAnimationFrame(detectorFrameRef.current);
    if (pendingDetectorDecodeRef.current !== null) window.clearTimeout(pendingDetectorDecodeRef.current);
    detectorFrameRef.current = null;
    pendingDetectorDecodeRef.current = null;
    setQrMarker(null);
  }, []);

  const startLiveQrDetector = useCallback((onDetected: (decoded: string) => void) => {
    stopLiveQrDetector();
    detectorLastRunRef.current = 0;

    const scanFrame = (timestamp: number) => {
      detectorFrameRef.current = requestAnimationFrame(scanFrame);
      if (timestamp - detectorLastRunRef.current < 140 || hasScanned.current) return;
      detectorLastRunRef.current = timestamp;

      const container = document.getElementById(READER_ID);
      const video = container?.querySelector("video") as HTMLVideoElement | null;
      if (!container || !video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;

      const canvas = detectorCanvasRef.current ?? document.createElement("canvas");
      detectorCanvasRef.current = canvas;
      const maxEdge = 720;
      const scale = Math.min(1, maxEdge / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, canvas.width, canvas.height, { inversionAttempts: "attemptBoth" });

      if (!code) {
        setQrMarker(null);
        return;
      }

      setQrMarker(buildQrMarker(code.location, video, container, canvas.width, canvas.height));
      if (!pendingDetectorDecodeRef.current) {
        pendingDetectorDecodeRef.current = window.setTimeout(() => {
          pendingDetectorDecodeRef.current = null;
          onDetected(code.data);
        }, 180);
      }
    };

    detectorFrameRef.current = requestAnimationFrame(scanFrame);
  }, [stopLiveQrDetector]);

  const handleParsedLabel = useCallback((parsed: HyundaiQRData, title = "Etiqueta lida!") => {
    playBeep();
    onScan(parsed);
    if (parsed.partial) {
      toast({
        title: "Leitura parcial",
        description: `Lote ${parsed.lotNumber} capturado. Aponte para o QR/DataMatrix 2D para o Part Number.`,
      });
    } else {
      toast({ title, description: `PN: ${parsed.partNumber}` });
    }
  }, [onScan, toast]);

  const handleDecodedText = useCallback((decoded: string) => {
    playBeep();
    const parsed = parseHyundaiQR(decoded);

    if (parsed) {
      handleParsedLabel(parsed);
      return;
    }

    setRawQR(decoded);
    setReportSent(false);
    setIncompatibleOpen(true);
  }, [handleParsedLabel]);

  const stopScanner = useCallback(async () => {
    stopLiveQrDetector();
    const scanner = scannerRef.current;
    scannerRef.current = null;

    if (!scanner) return;

    try {
      await scanner.stop();
    } catch {
      // Scanner may already be stopped by the browser when camera permission changes.
    }

    try {
      await scanner.clear();
    } catch {
      // Safe cleanup fallback for browsers that already removed the video node.
    }
  }, [stopLiveQrDetector]);

  const closeScanner = useCallback(() => {
    void stopScanner();
    setScannerOpen(false);
    setCameraError(null);
    setScannerStarting(false);
    setZoomOptions(null);
    setZoomLevel(null);
    setIsProcessingImage(false);
  }, [stopScanner]);

  const createScanner = useCallback(() => {
    return new Html5Qrcode(READER_ID, {
      formatsToSupport: SUPPORTED_FORMATS,
      useBarCodeDetectorIfSupported: true,
      verbose: false,
    });
  }, []);

  const tuneRunningCamera = useCallback(async (scanner: Html5Qrcode) => {
    try {
      const capabilities = scanner.getRunningTrackCapabilities() as MediaTrackCapabilities & {
        focusMode?: string[];
        exposureMode?: string[];
        zoom?: { min?: number; max?: number; step?: number };
      };
      const settings = scanner.getRunningTrackSettings() as MediaTrackSettings & { zoom?: number };
      const advanced: Record<string, string | number | boolean> = {};

      if (capabilities.focusMode?.includes("continuous")) advanced.focusMode = "continuous";
      if (capabilities.exposureMode?.includes("continuous")) advanced.exposureMode = "continuous";

      if (capabilities.zoom) {
        const min = Number(capabilities.zoom.min ?? 1);
        const max = Number(capabilities.zoom.max ?? min);
        const step = Number(capabilities.zoom.step ?? 0.1);
        if (max > min) {
          const target = Math.min(max, Math.max(min, Number(settings.zoom ?? min), min + (max - min) * 0.35));
          advanced.zoom = target;
          setZoomOptions({ min, max, step });
          setZoomLevel(target);
        }
      }

      if (Object.keys(advanced).length > 0) {
        await scanner.applyVideoConstraints({ advanced: [advanced as MediaTrackConstraintSet] });
      }
    } catch {
      // Alguns navegadores não expõem foco/zoom; o scanner continua normalmente.
    }
  }, []);

  const applyZoom = useCallback(async (value: number) => {
    setZoomLevel(value);
    try {
      await scannerRef.current?.applyVideoConstraints({ advanced: [{ zoom: value } as MediaTrackConstraintSet] });
    } catch {
      // Zoom is optional and not supported by all iOS/Android camera drivers.
    }
  }, []);

  const handleOpenScanner = useCallback(async () => {
    hasScanned.current = false;
    setCameraError(null);
    setScannerStarting(true);
    setZoomOptions(null);
    setZoomLevel(null);

    setScannerOpen(true);

    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    if (!document.getElementById(READER_ID)) {
      setCameraError("Elemento do leitor não encontrado. Tente novamente.");
      setScannerStarting(false);
      return;
    }

    const onSuccess = (decoded: string) => {
      if (hasScanned.current) return;
      hasScanned.current = true;
      void stopScanner();
      setScannerOpen(false);
      handleDecodedText(decoded);
    };

    const cameraOptions: MediaTrackConstraints[] = [
      { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      { facingMode: "environment" },
      {},
    ];

    for (const constraints of cameraOptions) {
      try {
        const scanner = createScanner();
        scannerRef.current = scanner;
        await scanner.start(constraints, getScanConfig(), onSuccess, () => {});
        await tuneRunningCamera(scanner);
        startLiveQrDetector(onSuccess);
        setScannerStarting(false);
        return;
      } catch (err) {
        await stopScanner();
      }
    }

    setScannerStarting(false);
    setCameraError("Não foi possível abrir a câmera deste aparelho. Toque em Tirar foto da etiqueta para usar a câmera interna do app.");
  }, [createScanner, handleDecodedText, startLiveQrDetector, stopScanner, tuneRunningCamera]);

  useImperativeHandle(ref, () => ({ openScanner: () => { void handleOpenScanner(); } }), [handleOpenScanner]);

  const loadImageElement = useCallback((file: File) => {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Falha ao carregar imagem"));
      };
      img.src = url;
    });
  }, []);

  const canvasToFile = useCallback(async (canvas: HTMLCanvasElement, name: string) => {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 1));
    if (!blob) throw new Error("Falha ao processar imagem");
    return new File([blob], name, { type: "image/png" });
  }, []);

  const fileToDataUrl = useCallback((file: Blob) => {
    return new Promise<string>((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 800;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
          else { width = Math.round((width * MAX) / height); height = MAX; }
        }
        const c = document.createElement("canvas");
        c.width = width; c.height = height;
        c.getContext("2d")!.drawImage(img, 0, 0, width, height);
        resolve(c.toDataURL("image/jpeg", 0.6));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Falha ao converter imagem")); };
      img.src = url;
    });
  }, []);

  const buildImageVariants = useCallback(async (file: File) => {
    const img = await loadImageElement(file);
    const variants: File[] = [file];

    const recipes = [
      { name: "full-contrast", cropX: 0, cropY: 0, cropW: 1, cropH: 1, mode: "contrast" as const },
      { name: "center-contrast", cropX: 0.12, cropY: 0.12, cropW: 0.76, cropH: 0.76, mode: "contrast" as const },
      { name: "lower-center-contrast", cropX: 0.18, cropY: 0.2, cropW: 0.64, cropH: 0.64, mode: "contrast" as const },
      { name: "center-threshold", cropX: 0.12, cropY: 0.12, cropW: 0.76, cropH: 0.76, mode: "threshold" as const },
      { name: "lower-center-threshold", cropX: 0.18, cropY: 0.2, cropW: 0.64, cropH: 0.64, mode: "threshold" as const },
    ];

    for (const recipe of recipes) {
      const sx = Math.round(img.width * recipe.cropX);
      const sy = Math.round(img.height * recipe.cropY);
      const sw = Math.max(1, Math.round(img.width * recipe.cropW));
      const sh = Math.max(1, Math.round(img.height * recipe.cropH));
      const scale = Math.max(1, Math.min(2, 800 / Math.max(sw, sh)));
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) continue;

      canvas.width = Math.max(1, Math.round(sw * scale));
      canvas.height = Math.max(1, Math.round(sh * scale));
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;

        if (recipe.mode === "threshold") {
          const value = gray > 150 ? 255 : 0;
          data[i] = value;
          data[i + 1] = value;
          data[i + 2] = value;
        } else {
          const contrast = 1.9;
          const value = Math.max(0, Math.min(255, (gray - 128) * contrast + 128));
          data[i] = value;
          data[i + 1] = value;
          data[i + 2] = value;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      variants.push(await canvasToFile(canvas, `${recipe.name}.png`));
    }

    return variants;
  }, [canvasToFile, loadImageElement]);

  const analyzePhotoLabel = useCallback(async (file: File, variants: File[]) => {
    const images = await Promise.all([file, ...variants.slice(1, 3)].map(fileToDataUrl));
    const { data, error } = await supabase.functions.invoke("extract-label-data", {
      body: { images },
    });

    if (error) throw error;
    if (!data?.partNumber) return null;

    return {
      vendorCode: "",
      partNumber: data.partNumber,
      supplierCode: "",
      lotNumber: data.lotNumber || "",
      raw: data.visibleText || data.partNumber,
    } satisfies HyundaiQRData;
  }, [fileToDataUrl]);

  const handlePickGallery = useCallback(() => {
    galleryInputRef.current?.click();
  }, []);

  const processImageFile = useCallback(async (file: File) => {
    if (!file) return;

    setCameraError(null);
    setIsProcessingImage(true);

    try {
      await stopScanner();

      const variants = await buildImageVariants(file);
      let decoded: string | null = null;

      for (const variant of variants) {
        const scanner = createScanner();
        try {
          decoded = await scanner.scanFile(variant, true);
          await scanner.clear();
          if (decoded) break;
        } catch {
          try {
            await scanner.clear();
          } catch {
            // Ignore scan-file cleanup failures; the next variant can still be tested.
          }
        }
      }

      if (!decoded) {
        const aiParsed = await analyzePhotoLabel(file, variants);
        if (aiParsed) {
          setScannerOpen(false);
          handleParsedLabel(aiParsed, "Etiqueta identificada pela foto!");
          return;
        }

        throw new Error("decode_failed");
      }

      setScannerOpen(false);
      handleDecodedText(decoded);
    } catch {
      const msg = "Não foi possível ler a etiqueta pela foto. Enquadre mais perto da etiqueta amarela, evite reflexos e tente novamente.";
      setCameraError(msg);
      setScannerOpen(true);
      toast({ title: "Não conseguimos ler a etiqueta", description: msg, variant: "destructive" });
    } finally {
      setIsProcessingImage(false);
    }
  }, [analyzePhotoLabel, buildImageVariants, createScanner, handleDecodedText, handleParsedLabel, stopScanner, toast]);

  const handlePickCamera = useCallback(async () => {
    setCameraError(null);
    await stopScanner();
    setScannerOpen(false);
    setCameraCaptureStream(null);
    await new Promise((resolve) => setTimeout(resolve, 260));
    setCameraCaptureOpen(true);
  }, [stopScanner]);

  const handleImageSelected = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) await processImageFile(file);
  }, [processImageFile]);

  const handleCameraCapture = useCallback((file: File) => {
    setCameraCaptureOpen(false);
    setCameraCaptureStream(null);
    void processImageFile(file);
  }, [processImageFile]);

  const closeCameraCapture = useCallback(() => {
    setCameraCaptureOpen(false);
    setCameraCaptureStream(null);
  }, []);

  const handleOpenUsbReader = useCallback(() => {
    setCameraError(null);
    setUsbBuffer("");
    setUsbReaderOpen(true);
    setTimeout(() => usbInputRef.current?.focus(), 80);
  }, []);

  const handleUsbSubmit = useCallback((value: string) => {
    const decoded = value.trim();
    if (!decoded) return;
    setUsbReaderOpen(false);
    setUsbBuffer("");
    handleDecodedText(decoded);
  }, [handleDecodedText]);

  const handleSendReport = async () => {
    setSending(true);
    try {
      await supabase.from("error_reports").insert({
        user_id: user?.id ?? "",
        user_name: profile?.full_name || "",
        module: "Leitura QR Code — Apontamento Incoming",
        description: `QR Code incompatível detectado durante leitura de etiqueta.\n\nConteúdo capturado:\n${rawQR}\n\nAção do usuário: Optou por preencher manualmente.`,
        photos: [],
      });
      setReportSent(true);
      toast({ title: "Relatório enviado ao HelpDesk!", description: "Obrigado. Vamos analisar para melhorar o sistema." });
    } catch {
      toast({ title: "Erro ao enviar", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1 gap-2 min-h-[44px] border-primary/30 bg-primary/5 hover:bg-primary/10 disabled:opacity-60"
          onClick={handleOpenScanner}
          disabled={disabled}
          title={disabled ? (disabledReason || "Bloqueado") : undefined}
        >
          <QrCode className="w-5 h-5" />
          Ler Etiqueta QR
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1 gap-2 min-h-[44px] border-primary/30 bg-primary/5 hover:bg-primary/10 disabled:opacity-60"
          onClick={handleOpenUsbReader}
          disabled={disabled}
          title={disabled ? (disabledReason || "Bloqueado") : "Use um leitor USB conectado ao PC"}
        >
          <ScanLine className="w-5 h-5" />
          Capturar com Leitor
        </Button>
      </div>

      <Dialog open={scannerOpen} onOpenChange={(open) => { if (!open) closeScanner(); }}>
        <DialogContent className="max-w-[96vw] sm:max-w-sm max-h-[92dvh] overflow-y-auto p-3 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-10">
              <QrCode className="w-5 h-5" />
              Escanear Etiqueta
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {scannerStarting ? (
              <div className="flex items-center justify-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Abrindo câmera…
              </div>
            ) : null}

            {cameraError ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <AlertTriangle className="w-10 h-10 text-amber-500" />
                <p className="text-sm text-muted-foreground">{cameraError}</p>
              </div>
            ) : null}

            <div className="relative w-full min-h-[320px] rounded-lg overflow-hidden bg-muted">
              <div id={READER_ID} className="w-full min-h-[320px] [&_video]:!object-cover" />

              {/* Centering target frame */}
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                <div
                  className="relative rounded-xl transition-colors duration-150"
                  style={{
                    width: "70%",
                    aspectRatio: "1 / 1",
                    boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)",
                    border: qrMarker ? "3px solid #10b981" : "2px dashed rgba(255,255,255,0.85)",
                  }}
                >
                  {/* Corner accents */}
                  {(["top-0 left-0 border-t-4 border-l-4 rounded-tl-xl","top-0 right-0 border-t-4 border-r-4 rounded-tr-xl","bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl","bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl"]).map((cls) => (
                    <span
                      key={cls}
                      className={`absolute ${cls}`}
                      style={{ width: 26, height: 26, borderColor: qrMarker ? "#10b981" : "#ffffff" }}
                    />
                  ))}
                </div>
              </div>

              {qrMarker ? (
                <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full" aria-hidden="true">
                  <polygon
                    points={qrMarker.points.map((point) => `${point.x},${point.y}`).join(" ")}
                    fill="rgba(16,185,129,0.22)"
                    stroke="#10b981"
                    strokeWidth="4"
                    strokeLinejoin="round"
                  />
                  <circle cx={qrMarker.center.x} cy={qrMarker.center.y} r="5" fill="#10b981" />
                </svg>
              ) : null}

              {/* On-screen instructions */}
              <div className="pointer-events-none absolute left-2 right-2 top-2 z-20 flex justify-center">
                <span className="rounded-full bg-black/60 px-3 py-1 text-[11px] font-medium text-white">
                  {qrMarker ? "QR detectado — segure firme" : "Centralize o QR dentro do quadro"}
                </span>
              </div>
              <div className="pointer-events-none absolute bottom-2 left-2 right-2 z-20 flex justify-center">
                <span className="rounded-md bg-black/55 px-2.5 py-1 text-[10px] leading-tight text-white text-center max-w-[90%]">
                  Mantenha 10–20 cm de distância • boa iluminação • sem reflexos
                </span>
              </div>
            </div>

            {zoomOptions && zoomLevel !== null ? (
              <div className="space-y-1.5 rounded-md border border-border bg-muted/30 px-3 py-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Zoom para QR pequeno</span>
                  <span>{zoomLevel.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min={zoomOptions.min}
                  max={zoomOptions.max}
                  step={zoomOptions.step}
                  value={zoomLevel}
                  onChange={(event) => void applyZoom(Number(event.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            ) : null}

            <p className="text-xs text-muted-foreground text-center">
              Aponte a câmera para o código da etiqueta Hyundai Mobis.
            </p>

            <div className="flex flex-col gap-2">
              <Button type="button" onClick={handlePickCamera} variant="secondary" className="w-full gap-2 min-h-[44px]">
                {isProcessingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                {isProcessingImage ? "Lendo foto..." : "Tirar foto da etiqueta"}
              </Button>

              <Button type="button" onClick={handlePickGallery} variant="outline" className="w-full gap-2 min-h-[44px]">
                <ImagePlus className="w-4 h-4" />
                Escolher foto da galeria
              </Button>
            </div>

            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelected}
            />
          </div>
        </DialogContent>
      </Dialog>

      <InAppCamera
        open={cameraCaptureOpen}
        initialStream={cameraCaptureStream}
        onClose={closeCameraCapture}
        onCapture={handleCameraCapture}
      />

      <Dialog open={incompatibleOpen} onOpenChange={setIncompatibleOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              QR Code Incompatível
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Este QR Code não é compatível com o padrão Hyundai Mobis.
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Sua leitura será reportada ao HelpDesk para análise e melhoria do sistema.
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Conteúdo capturado</p>
              <div className="bg-muted rounded-lg p-3 max-h-24 overflow-y-auto">
                <code className="text-xs break-all">{rawQR || "—"}</code>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button onClick={() => setIncompatibleOpen(false)} className="w-full gap-2 min-h-[44px]">
                <Pencil className="w-4 h-4" />
                Apontar manualmente
              </Button>
              {!reportSent ? (
                <Button
                  variant="outline"
                  onClick={handleSendReport}
                  disabled={sending}
                  className="w-full gap-2 min-h-[44px]"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Reportar ao HelpDesk
                </Button>
              ) : (
                <p className="text-center text-sm text-emerald-600 dark:text-emerald-400 font-medium py-2">
                  ✓ Relatório enviado ao HelpDesk
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});
QRScannerButton.displayName = "QRScannerButton";
