import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, QrCode, Loader2, Mail } from "lucide-react";
import logo from "@/assets/hyundai-mobis-logo.png";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";

const QrProfilePage = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { impersonating } = useImpersonation();
  const { isAdmin } = useUserRole();
  const cardRef = useRef<HTMLDivElement>(null);

  const { data: impersonatedProfile, isLoading } = useQuery({
    queryKey: ["impersonated-profile", impersonating?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, cargo, qr_code_id, email")
        .eq("id", impersonating!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!impersonating?.id,
  });

  const activeProfile = impersonating ? impersonatedProfile : profile;
  const userEmail = activeProfile?.email;

  const exportAs = async (format: "jpg" | "pdf") => {
    if (!cardRef.current) return;
    try {
      const canvas = await html2canvas(cardRef.current, { backgroundColor: "#ffffff", scale: 3 });
      if (format === "jpg") {
        const link = document.createElement("a");
        link.download = `QR-${activeProfile?.qr_code_id || "code"}.jpg`;
        link.href = canvas.toDataURL("image/jpeg", 0.95);
        link.click();
      } else {
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [80, 100] });
        pdf.addImage(imgData, "PNG", 5, 5, 70, 70 * (canvas.height / canvas.width));
        pdf.save(`QR-${activeProfile?.qr_code_id || "code"}.pdf`);
      }
      toast.success(`QR Code exportado como ${format.toUpperCase()}`);
    } catch {
      toast.error("Erro ao exportar");
    }
  };

  const sendEmail = async () => {
    if (!cardRef.current || !userEmail) return;
    try {
      toast.info("Gerando e enviando por e-mail...");
      const canvas = await html2canvas(cardRef.current, { backgroundColor: "#ffffff", scale: 3 });
      const imgData = canvas.toDataURL("image/png");

      const { error } = await supabase.functions.invoke("send-qr-email", {
        body: {
          to: userEmail,
          name: activeProfile?.full_name || "",
          qrCodeId: activeProfile?.qr_code_id || "",
          imageBase64: imgData,
        },
      });
      if (error) throw error;
      toast.success(`QR Code enviado para ${userEmail}`);
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar e-mail");
    }
  };

  if (impersonating && isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
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

      <main className="container mx-auto px-3 sm:px-4 py-6 max-w-md">
        <div className="form-section text-center space-y-4">
          <div ref={cardRef} className="inline-block p-6 sm:p-8 bg-white rounded-xl shadow-sm">
            <QRCodeSVG value={activeProfile?.qr_code_id || ""} size={280} level="H" className="w-[240px] h-[240px] sm:w-[280px] sm:h-[280px]" />
            <div className="mt-3">
              <h2 className="text-lg font-heading font-bold text-foreground">{activeProfile?.full_name}</h2>
              {activeProfile?.cargo && <p className="text-sm text-muted-foreground">{activeProfile.cargo}</p>}
              <p className="text-xs font-mono text-muted-foreground mt-1 bg-muted/30 inline-block px-2 py-0.5 rounded">{activeProfile?.qr_code_id}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 justify-center">
            <Button onClick={() => exportAs("jpg")} variant="outline" className="gap-2 w-full">
              <Download className="w-4 h-4" /> Exportar JPG
            </Button>
            <Button onClick={() => exportAs("pdf")} variant="outline" className="gap-2 w-full">
              <Download className="w-4 h-4" /> Exportar PDF
            </Button>
            {userEmail && (
              <Button onClick={sendEmail} variant="outline" className="gap-2 w-full">
                <Mail className="w-4 h-4" /> Enviar por E-mail
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default QrProfilePage;
