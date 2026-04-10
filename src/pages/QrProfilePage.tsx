import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, QrCode } from "lucide-react";
import logo from "@/assets/hyundai-mobis-logo.png";

const QrProfilePage = () => {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { isAdmin } = useUserRole();

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>QR Code - ${profile?.full_name}</title>
      <style>
        body { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: Arial, sans-serif; margin: 0; }
        .container { text-align: center; width: 6cm; }
        .qr { margin: 0 auto; }
        .name { font-size: 14px; font-weight: bold; margin-top: 8px; }
        .code { font-size: 12px; color: #666; margin-top: 4px; }
        .cargo { font-size: 11px; color: #888; margin-top: 2px; }
        @media print { body { margin: 0; } }
      </style></head><body>
      <div class="container">
        <div class="qr" id="qr-print"></div>
        <div class="name">${profile?.full_name || ""}</div>
        <div class="cargo">${profile?.cargo || ""}</div>
        <div class="code">${profile?.qr_code_id || ""}</div>
      </div>
      <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
      <script>
        QRCode.toCanvas(document.createElement('canvas'), '${profile?.qr_code_id || ""}', { width: 200 }, function(err, canvas) {
          if (!err) document.getElementById('qr-print').appendChild(canvas);
          setTimeout(() => window.print(), 500);
        });
      </script>
      </body></html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-4 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-primary-foreground/70 hover:text-primary-foreground px-2">
                <ArrowLeft className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Hub</span>
              </Button>
              <img src={logo} alt="Hyundai Mobis" className="h-6 sm:h-8 object-contain bg-white rounded-md px-2 py-0.5" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <QrCode className="w-6 h-6" />
            <h1 className="text-xl sm:text-2xl font-heading font-bold">Meu QR Code</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-md">
        <div className="form-section text-center space-y-4">
          <div className="inline-block p-4 bg-white rounded-xl shadow-sm">
            <QRCodeSVG value={profile?.qr_code_id || ""} size={200} level="H" />
          </div>
          <div>
            <h2 className="text-lg font-heading font-bold text-foreground">{profile?.full_name}</h2>
            {profile?.cargo && <p className="text-sm text-muted-foreground">{profile.cargo}</p>}
            <p className="text-xs font-mono text-muted-foreground mt-1 bg-muted/30 inline-block px-2 py-0.5 rounded">{profile?.qr_code_id}</p>
          </div>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" /> Imprimir QR Code
          </Button>
        </div>
      </main>
    </div>
  );
};

export default QrProfilePage;
