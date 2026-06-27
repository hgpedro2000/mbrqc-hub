import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import ContencaoClaimReport from "./ContencaoClaimReport";
import { ContencaoRegistro } from "@/lib/contencao";

interface Props {
  open: boolean;
  onClose: () => void;
  contencao: any | null;
}

const ContencaoClaimReportDialog = ({ open, onClose, contencao }: Props) => {
  const { t } = useTranslation();
  const reportRef = useRef<HTMLDivElement | null>(null);
  const [exporting, setExporting] = useState(false);

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ["contencao-claim-registros", contencao?.id],
    enabled: open && !!contencao?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contencao_registros" as any)
        .select("*")
        .eq("contencao_id", contencao!.id)
        .order("data", { ascending: true })
        .order("hora_inicio", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ContencaoRegistro[];
    },
  });

  const exportPDF = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    const toastId = toast.loading(t("contencao.claim.generatingPdf"));
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;
      let heightLeft = imgH;
      let position = 0;
      pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
      heightLeft -= pageH;
      while (heightLeft > 0) {
        position = heightLeft - imgH;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
        heightLeft -= pageH;
      }
      const filename = `Contencao_${contencao?.numero || "contencao"}_${contencao?.fornecedor || "fornecedor"}.pdf`
        .replace(/\s+/g, "_");
      pdf.save(filename);
      toast.success(t("contencao.claim.pdfSuccess"), { id: toastId });
    } catch (e: any) {
      toast.error(e?.message || t("contencao.claim.pdfError"), { id: toastId });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4" /> {t("contencao.claim.dialogTitle")}
          </DialogTitle>
          <DialogDescription>{t("contencao.claim.dialogDesc")}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto bg-slate-200 dark:bg-slate-900 p-4 rounded">
          {isLoading || !contencao ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="flex justify-center">
              <div className="shadow-lg">
                <ContencaoClaimReport ref={reportRef} contencao={contencao} registros={registros} />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("contencao.claim.close")}</Button>
          <Button onClick={exportPDF} disabled={exporting || isLoading} className="gap-2">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {t("contencao.claim.export")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ContencaoClaimReportDialog;
