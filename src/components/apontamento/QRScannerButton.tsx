import { useRef, useState, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QrCode, X, AlertTriangle, Pencil, Send, Loader2, Camera, ImagePlus } from "lucide-react";
import { parseHyundaiQR, HyundaiQRData } from "@/lib/parseHyundaiQR";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface QRScannerButtonProps {
  onScan: (data: HyundaiQRData) => void;
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

export const QRScannerButton = ({ onScan }: QRScannerButtonProps) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [scannerOpen, setScannerOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasScanned = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [incompatibleOpen, setIncompatibleOpen] = useState(false);
  const [rawQR, setRawQR] = useState("");
  const [sending, setSending] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  const handleDecodedText = useCallback((decoded: string) => {
    const parsed = parseHyundaiQR(decoded);

    if (parsed) {
      onScan(parsed);
      toast({ title: "Etiqueta lida!", description: `PN: ${parsed.partNumber}` });
      return;
    }

    setRawQR(decoded);
    setReportSent(false);
    setIncompatibleOpen(true);
  }, [onScan, toast]);

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
          fps: 20,
          qrbox: { width: 320, height: 320 },
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
            fps: 20,
            qrbox: { width: 320, height: 320 },
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

  const handlePickImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImageSelected = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setCameraError(null);
    setIsProcessingImage(true);

    try {
      await stopScanner();

      const scanner = createScanner();
      scannerRef.current = scanner;
      const decoded = await scanner.scanFile(file, true);
      await scanner.clear();
      scannerRef.current = null;

      setScannerOpen(false);
      handleDecodedText(decoded);
    } catch {
      setCameraError("Não foi possível ler a etiqueta pela foto. Tente aproximar mais, melhorar a iluminação ou enquadrar só o código.");
    } finally {
      setIsProcessingImage(false);
    }
  }, [createScanner, handleDecodedText, stopScanner]);

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
              <Button type="button" onClick={handlePickImage} variant="secondary" className="w-full gap-2 min-h-[44px]">
                {isProcessingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                {isProcessingImage ? "Lendo foto..." : "Tirar foto da etiqueta"}
              </Button>

              <Button type="button" onClick={handlePickImage} variant="outline" className="w-full gap-2 min-h-[44px]">
                <ImagePlus className="w-4 h-4" />
                Escolher foto da galeria
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
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
};
