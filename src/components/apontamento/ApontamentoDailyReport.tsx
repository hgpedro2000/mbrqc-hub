import { useState, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogClose, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, Download, FileText, AlertTriangle } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import hyundaiMobisLogo from "@/assets/hyundai-mobis-logo.png";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: any[];
  mode: "daily" | "ng"; // daily = all records for a day, ng = only NG records
}

const typeLabels: Record<string, string> = {
  incoming: "Incoming", peca: "Peça", processo: "Processo", oem: "OEM",
};

const ApontamentoDailyReport = ({ open, onOpenChange, items, mode }: Props) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const contentRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    let list = items;
    if (mode === "daily") {
      list = list.filter((i) => i.data === selectedDate);
    }
    if (mode === "ng") {
      list = list.filter((i) => (i.quantidade_ng || 0) > 0);
    }
    return list;
  }, [items, selectedDate, mode]);

  const byType = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filtered.forEach((i) => {
      const t = i.tipo || "outro";
      if (!groups[t]) groups[t] = [];
      groups[t].push(i);
    });
    return groups;
  }, [filtered]);

  const totalNG = filtered.reduce((s, i) => s + (i.quantidade_ng || 0), 0);
  const totalInsp = filtered.reduce((s, i) => s + (i.quantidade_inspecionada || 0), 0);

  const handleExportPdf = async () => {
    if (!contentRef.current) return;
    const el = contentRef.current;
    const exportBtns = el.querySelectorAll("[data-export-btn]");
    exportBtns.forEach((btn) => (btn as HTMLElement).style.display = "none");

    try {
      await new Promise((r) => setTimeout(r, 80));
      const canvas = await html2canvas(el, {
        scale: 2, useCORS: true, backgroundColor: "#ffffff", windowWidth: 900,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdfW = 297; // A4 landscape width
      const margin = 8;
      const contentW = pdfW - margin * 2;
      const contentH = (canvas.height * contentW) / canvas.width;
      const pdfH = contentH + margin * 2;

      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: [pdfW, pdfH] });
      pdf.addImage(imgData, "PNG", margin, margin, contentW, contentH);

      const fileName = mode === "daily"
        ? `relatorio-diario-${selectedDate}.pdf`
        : `relatorio-ng-${new Date().toISOString().split("T")[0]}.pdf`;
      const blob = pdf.output("blob");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } finally {
      exportBtns.forEach((btn) => (btn as HTMLElement).style.display = "");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 w-[95vw] [&>button:last-child]:hidden">
        <DialogClose className="absolute left-3 top-3 z-50 rounded-full bg-background/80 backdrop-blur-sm border border-border w-8 h-8 flex items-center justify-center opacity-80 hover:opacity-100 transition-opacity shadow-sm">
          <X className="h-4 w-4" />
          <span className="sr-only">Fechar</span>
        </DialogClose>

        <div ref={contentRef} className="flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-b border-border px-4 md:px-6 pt-4 md:pt-6 pb-3 md:pb-4">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
              <div className="flex items-center gap-4">
                <img src={hyundaiMobisLogo} alt="Hyundai Mobis" className="h-10 md:h-14 w-auto object-contain" />
                <div>
                  <div className="flex items-center gap-2">
                    {mode === "ng" && <Badge className="bg-destructive/10 text-destructive border-destructive/20"><AlertTriangle className="w-3 h-3 mr-1" />Peças NG</Badge>}
                  </div>
                  <h2 className="text-sm md:text-lg font-bold text-foreground">
                    {mode === "daily" ? "Relatório Diário de Apontamentos" : "Relatório de Peças com Defeito (NG)"}
                  </h2>
                  <p className="text-[10px] md:text-xs text-muted-foreground">
                    {mode === "daily" ? `Data: ${new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR")}` : "Todos os registros com NG > 0"}
                    {` • ${filtered.length} registros`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {mode === "daily" && (
                  <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-40 text-sm" data-export-btn />
                )}
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportPdf} data-export-btn>
                  <Download className="w-4 h-4" /> PDF
                </Button>
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="px-4 md:px-6 py-3">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-card rounded-lg border border-border">
                <p className="text-xl font-bold text-foreground">{filtered.length}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Total Registros</p>
              </div>
              <div className="text-center p-3 bg-card rounded-lg border border-border">
                <p className="text-xl font-bold text-foreground">{totalInsp}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Inspecionadas</p>
              </div>
              <div className="text-center p-3 bg-card rounded-lg border border-border">
                <p className="text-xl font-bold text-destructive">{totalNG}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Total NG</p>
              </div>
            </div>
          </div>

          {/* Table by type */}
          <div className="px-4 md:px-6 pb-6 space-y-4">
            {Object.entries(byType).map(([tipo, records]) => (
              <div key={tipo}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary" className="text-xs">{typeLabels[tipo] || tipo}</Badge>
                  <span className="text-xs text-muted-foreground">({records.length} registros)</span>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">Nº</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">Data</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">Part Number</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">Part Name</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">Fornecedor</th>
                        <th className="text-right px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">Insp.</th>
                        <th className="text-right px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">NG</th>
                        <th className="text-right px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">OK</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">Descrição</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">Apontado por</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r) => (
                        <tr key={r.id} className="border-b last:border-b-0 hover:bg-muted/20">
                          <td className="px-3 py-1.5 font-mono text-muted-foreground">{r.numero || "—"}</td>
                          <td className="px-3 py-1.5 whitespace-nowrap">{new Date(r.data).toLocaleDateString("pt-BR")}</td>
                          <td className="px-3 py-1.5 font-semibold">{r.part_number || "—"}</td>
                          <td className="px-3 py-1.5">{r.part_name || "—"}</td>
                          <td className="px-3 py-1.5">{r.fornecedor || "—"}</td>
                          <td className="px-3 py-1.5 text-right">{r.quantidade_inspecionada || 0}</td>
                          <td className={`px-3 py-1.5 text-right font-semibold ${(r.quantidade_ng || 0) > 0 ? "text-destructive" : ""}`}>{r.quantidade_ng || 0}</td>
                          <td className="px-3 py-1.5 text-right">{r.quantidade_ok || 0}</td>
                          <td className="px-3 py-1.5 max-w-[200px] truncate">{r.descricao || "—"}</td>
                          <td className="px-3 py-1.5 whitespace-nowrap">{r.responsavel}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>{mode === "daily" ? "Nenhum registro nesta data." : "Nenhum registro com NG encontrado."}</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ApontamentoDailyReport;
