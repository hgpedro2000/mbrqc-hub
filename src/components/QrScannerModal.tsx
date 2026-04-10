import { useState, useEffect, useRef, useId } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Html5Qrcode } from "html5-qrcode";

interface QrScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (value: string) => void;
  title?: string;
}

const QrScannerModal = ({ open, onClose, onScan, title = "Escanear QR Code" }: QrScannerModalProps) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState("");
  const scannedRef = useRef(false);
  const readerId = useId().replace(/:/g, "");

  const cleanupScanner = async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;

    if (!scanner) return;

    try {
      await scanner.stop();
    } catch {}

    try {
      await scanner.clear();
    } catch {}
  };

  useEffect(() => {
    if (!open) {
      scannedRef.current = false;
      void cleanupScanner();
      return;
    }

    setError("");

    const timer = setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode(readerId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            if (scannedRef.current) return;
            scannedRef.current = true;

            void (async () => {
              await cleanupScanner();
              onScan(decodedText);
            })();
          },
          () => {}
        );
      } catch (err: any) {
        setError("Não foi possível acessar a câmera. Verifique as permissões.");
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      void cleanupScanner();
    };
  }, [open, readerId]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div id={readerId} className="w-full min-h-[300px] rounded-lg overflow-hidden bg-muted" />
        {error && <p className="text-destructive text-sm text-center">{error}</p>}
        <p className="text-muted-foreground text-xs text-center">Aponte a câmera para o QR Code do crachá</p>
      </DialogContent>
    </Dialog>
  );
};

export default QrScannerModal;
