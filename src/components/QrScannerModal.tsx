import { useState, useEffect, useRef } from "react";
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

  useEffect(() => {
    if (!open) return;
    setError("");
    const readerId = "qr-reader-" + Date.now();

    // Wait for DOM
    const timer = setTimeout(async () => {
      const el = document.getElementById("qr-reader-container");
      if (!el) return;
      el.id = readerId;

      try {
        const scanner = new Html5Qrcode(readerId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            onScan(decodedText);
            scanner.stop().catch(() => {});
            onClose();
          },
          () => {}
        );
      } catch (err: any) {
        setError("Não foi possível acessar a câmera. Verifique as permissões.");
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div id="qr-reader-container" className="w-full min-h-[300px] rounded-lg overflow-hidden bg-muted" />
        {error && <p className="text-destructive text-sm text-center">{error}</p>}
        <p className="text-muted-foreground text-xs text-center">Aponte a câmera para o QR Code do crachá</p>
      </DialogContent>
    </Dialog>
  );
};

export default QrScannerModal;
