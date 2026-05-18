import { useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QrCode, X, AlertTriangle, Pencil, Send, Loader2, Camera, ImagePlus } from "lucide-react";
import { parseHyundaiQR, HyundaiQRData } from "@/lib/parseHyundaiQR";
import { playBeep } from "@/lib/beep";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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

export const QRScannerButton = forwardRef<QRScannerButtonHandle, QRScannerButtonProps>(({ onScan }, ref) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [scannerOpen, setScannerOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasScanned = useRef(false);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const [incompatibleOpen, setIncompatibleOpen] = useState(false);
  const [rawQR, setRawQR] = useState("");
  const [sending, setSending] = useState(false);
  const [reportSent, setReportSent] = useState(false);

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
    const scanner = scannerRef.current;
    scannerRef.current = null;

    if (!scanner) return;

    try {
      await scanner.stop();
    } catch {}

    try {
      await scanner.clear();
    } catch {}
  }, []);

  const closeScanner = useCallback(() => {
    void stopScanner();
    setScannerOpen(false);
    setCameraError(null);
    setIsProcessingImage(false);
  }, [stopScanner]);

  const createScanner = useCallback(() => {
    return new Html5Qrcode(READER_ID, {
      formatsToSupport: SUPPORTED_FORMATS,
      verbose: false,
    });
  }, []);

  const handleOpenScanner = useCallback(async () => {
    hasScanned.current = false;
    setCameraError(null);
    setScannerOpen(true);

    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    if (!document.getElementById(READER_ID)) {
      setCameraError("Elemento do leitor não encontrado. Tente novamente.");
      return;
    }

    try {
      const scanner = createScanner();
      scannerRef.current = scanner;

      await scanner.start(
        {
          facingMode: { exact: "environment" },
        },
        {
          fps: 25,
          qrbox: { width: 350, height: 350 },
          aspectRatio: 1,
          disableFlip: true,
        },
        (decoded) => {
          if (hasScanned.current) return;
          hasScanned.current = true;
          void stopScanner();
          setScannerOpen(false);
          handleDecodedText(decoded);
        },
        () => {}
      );
    } catch {
      try {
        const scanner = createScanner();
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 25,
            qrbox: { width: 350, height: 350 },
            aspectRatio: 1,
            disableFlip: true,
          },
          (decoded) => {
            if (hasScanned.current) return;
            hasScanned.current = true;
            void stopScanner();
            setScannerOpen(false);
            handleDecodedText(decoded);
          },
          () => {}
        );
      } catch {
        setCameraError("Não foi possível acessar ou decodificar pela câmera. Use a opção de tirar foto da etiqueta.");
      }
    }
  }, [createScanner, handleDecodedText, stopScanner]);

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

  const handlePickCamera = useCallback(() => {
    cameraInputRef.current?.click();
  }, []);

  const handlePickGallery = useCallback(() => {
    galleryInputRef.current?.click();
  }, []);

  const handleImageSelected = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

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
          } catch {}
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
      setCameraError("Não foi possível ler a etiqueta pela foto. Tente enquadrar mais de perto a etiqueta amarela e evitar reflexos fortes.");
    } finally {
      setIsProcessingImage(false);
    }
  }, [analyzePhotoLabel, buildImageVariants, createScanner, handleDecodedText, handleParsedLabel, stopScanner]);

  const handleSendReport = async () => {
    setSending(true);
    try {
      await supabase.from("error_reports").insert({
        user_id: user?.id,
        user_name: profile?.full_name || "",
        module: "Leitura QR Code — Apontamento Incoming",
        description: `QR Code incompatível detectado durante leitura de etiqueta.\n\nConteúdo capturado:\n${rawQR}\n\nAção do usuário: Optou por preencher manualmente.`,
        photos: [],
      } as any);
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
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2 min-h-[44px] border-primary/30 bg-primary/5 hover:bg-primary/10"
        onClick={handleOpenScanner}
      >
        <QrCode className="w-5 h-5" />
        Ler Etiqueta QR
      </Button>

      <Dialog open={scannerOpen} onOpenChange={(open) => { if (!open) closeScanner(); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-sm p-3 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-10">
              <QrCode className="w-5 h-5" />
              Escanear Etiqueta
            </DialogTitle>
            <Button variant="ghost" size="icon" className="absolute right-3 top-3" onClick={closeScanner}>
              <X className="w-4 h-4" />
            </Button>
          </DialogHeader>

          <div className="space-y-3">
            {cameraError ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <AlertTriangle className="w-10 h-10 text-amber-500" />
                <p className="text-sm text-muted-foreground">{cameraError}</p>
              </div>
            ) : null}

            <div id={READER_ID} className="w-full min-h-[280px] rounded-lg overflow-hidden bg-muted" />

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
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelected}
            />
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
