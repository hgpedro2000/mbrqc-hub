import { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QrCode, X, AlertTriangle, Pencil, Send, Loader2 } from "lucide-react";
import { parseHyundaiQR, HyundaiQRData } from "@/lib/parseHyundaiQR";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface QRScannerButtonProps {
  onScan: (data: HyundaiQRData) => void;
}

export const QRScannerButton = ({ onScan }: QRScannerButtonProps) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [scannerOpen, setScannerOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasScanned = useRef(false);

  const [incompatibleOpen, setIncompatibleOpen] = useState(false);
  const [rawQR, setRawQR] = useState("");
  const [sending, setSending] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  useEffect(() => {
    if (!scannerOpen) return;
    hasScanned.current = false;
    setCameraError(null);

    const scanner = new Html5Qrcode("qr-reader-incoming");
    scannerRef.current = scanner;

    scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 240, height: 240 } },
      (decoded) => {
        if (hasScanned.current) return;
        hasScanned.current = true;
        scanner.stop().catch(() => {});
        setScannerOpen(false);

        const parsed = parseHyundaiQR(decoded);
        if (parsed) {
          onScan(parsed);
          toast({ title: "Etiqueta lida!", description: `PN: ${parsed.partNumber}` });
        } else {
          setRawQR(decoded);
          setReportSent(false);
          setIncompatibleOpen(true);
        }
      },
      () => {}
    ).catch(() => {
      setCameraError("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
    });

    return () => {
      scanner.stop().catch(() => {});
    };
  }, [scannerOpen]);

  const closeScanner = () => {
    scannerRef.current?.stop().catch(() => {});
    setScannerOpen(false);
    setCameraError(null);
  };

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

  const handleFillManually = () => {
    setIncompatibleOpen(false);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2 min-h-[44px] border-primary/30 bg-primary/5 hover:bg-primary/10"
        onClick={() => setScannerOpen(true)}
      >
        <QrCode className="w-5 h-5" />
        Ler Etiqueta QR
      </Button>

      {/* Scanner Dialog */}
      <Dialog open={scannerOpen} onOpenChange={(o) => { if (!o) closeScanner(); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-sm p-3 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              Escanear Etiqueta
            </DialogTitle>
            <Button variant="ghost" size="icon" className="absolute right-3 top-3" onClick={closeScanner}>
              <X className="w-4 h-4" />
            </Button>
          </DialogHeader>

          {cameraError ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <AlertTriangle className="w-10 h-10 text-amber-500" />
              <p className="text-sm text-muted-foreground">{cameraError}</p>
              <Button onClick={closeScanner}>Fechar</Button>
            </div>
          ) : (
            <>
              <div id="qr-reader-incoming" className="w-full min-h-[280px] rounded-lg overflow-hidden bg-muted" />
              <p className="text-xs text-muted-foreground text-center">
                Aponte a câmera para o QR Code da etiqueta Hyundai Mobis
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Incompatible QR Dialog */}
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
              <Button onClick={handleFillManually} className="w-full gap-2 min-h-[44px]">
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
