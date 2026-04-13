import html2canvas from "html2canvas";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Download, FileText, FileSpreadsheet } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import React from "react";
import jsPDF from "jspdf";

interface Props {
  data: Record<string, any>;
  photos: any[];
  contentRef?: React.RefObject<HTMLDivElement>;
}

const typeLabels: Record<string, string> = {
  incoming: "Incoming", peca: "Peca", processo: "Processo", oem: "OEM",
};

function fmt(key: string, value: any): string {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "data") return new Date(value).toLocaleDateString("pt-BR");
  return String(value);
}

async function exportToPdf(contentRef: React.RefObject<HTMLDivElement>, data: Record<string, any>) {
  if (!contentRef.current) return;
  const el = contentRef.current;

  // 1. Hide export button
  const exportBtns = el.querySelectorAll("[data-export-btn]");
  exportBtns.forEach((btn) => (btn as HTMLElement).style.visibility = "hidden");

  // 2. Fix letter-spacing on ALL elements (Tailwind tracking-* breaks html2canvas)
  const allEls = el.querySelectorAll("*");
  const prevLetterSpacing: string[] = [];
  allEls.forEach((node, i) => {
    const h = node as HTMLElement;
    prevLetterSpacing[i] = h.style.letterSpacing;
    h.style.letterSpacing = "normal";
  });

  // 3. Unlock all overflow ancestors
  type Saved = { el: HTMLElement; maxHeight: string; overflow: string; overflowY: string; height: string };
  const saved: Saved[] = [];
  let node = el.parentElement;
  while (node && node !== document.body) {
    const cs = window.getComputedStyle(node);
    if (cs.overflow !== "visible" || cs.overflowY !== "visible" || cs.maxHeight !== "none") {
      saved.push({ el: node, maxHeight: node.style.maxHeight, overflow: node.style.overflow, overflowY: node.style.overflowY, height: node.style.height });
      node.style.maxHeight = "none";
      node.style.overflow  = "visible";
      node.style.overflowY = "visible";
      node.style.height    = "auto";
    }
    node = node.parentElement;
  }

  // 4. Fix element width to its natural scroll width
  const naturalW = el.scrollWidth;
  const prevW    = el.style.width;
  const prevMinW = el.style.minWidth;
  el.style.width    = naturalW + "px";
  el.style.minWidth = naturalW + "px";

  try {
    if (typeof document !== "undefined" && "fonts" in document) {
      await (document as any).fonts.ready;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      windowWidth: naturalW,
      width: naturalW,
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
      logging: false,
      onclone: (doc) => {
        // Fix letter-spacing inside the clone too
        doc.querySelectorAll("*").forEach((n) => {
          (n as HTMLElement).style.letterSpacing = "normal";
        });
        // Ensure white background on html and body
        doc.documentElement.style.background = "#ffffff";
        doc.body.style.background = "#ffffff";
      },
    });

    const imgData = canvas.toDataURL("image/png");
    const pdfW = 210;
    const margin = 8;
    const contentW = pdfW - margin * 2;
    const contentH = (canvas.height * contentW) / canvas.width;
    const pdfH = contentH + margin * 2;

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [pdfW, pdfH] });
    pdf.addImage(imgData, "PNG", margin, margin, contentW, contentH);

    pdf.save(`apontamento-${typeLabels[data.tipo] || "export"}-${data.numero || "export"}.pdf`);
  } finally {
    el.style.width    = prevW;
    el.style.minWidth = prevMinW;
    allEls.forEach((n, i) => {
      (n as HTMLElement).style.letterSpacing = prevLetterSpacing[i];
    });
    saved.forEach(s => {
      s.el.style.maxHeight = s.maxHeight;
      s.el.style.overflow  = s.overflow;
      s.el.style.overflowY = s.overflowY;
      s.el.style.height    = s.height;
    });
    exportBtns.forEach((btn) => (btn as HTMLElement).style.visibility = "");
  }
}
function exportToExcel(data: Record<string, any>) {
  const rows = [
    { Campo: "Número", Valor: data.numero || "—" },
    { Campo: "Tipo", Valor: typeLabels[data.tipo] || data.tipo },
    { Campo: "Data", Valor: fmt("data", data.data) },
    { Campo: "Apontado por", Valor: data.responsavel || "—" },
    { Campo: "Turno", Valor: data.turno || "—" },
    { Campo: "Projeto", Valor: data.projeto || "—" },
    { Campo: "Fornecedor", Valor: data.fornecedor || "—" },
    { Campo: "Part Number", Valor: data.part_number || "—" },
    { Campo: "Part Name", Valor: data.part_name || "—" },
    { Campo: "Fase", Valor: data.fase || "—" },
    { Campo: "Qtd. Inspecionada", Valor: String(data.quantidade_inspecionada || 0) },
    { Campo: "Qtd. NG", Valor: String(data.quantidade_ng || 0) },
    { Campo: "Qtd. OK", Valor: String(data.quantidade_ok || 0) },
    { Campo: "Modo de Falha", Valor: data.modo_falha || "—" },
    { Campo: "Descrição", Valor: data.descricao || "—" },
    { Campo: "Severidade", Valor: data.severidade || "—" },
    { Campo: "Comentário", Valor: data.comentario_adicional || "—" },
  ];

  if (data.tipo === "oem") {
    rows.push(
      { Campo: "VIN", Valor: data.vin_number || "—" },
      { Campo: "Qtd. Detectado", Valor: String(data.quantidade_detectado || 0) },
      { Campo: "Local Detecção", Valor: data.local_deteccao || "—" },
      { Campo: "Lançamento", Valor: data.lancamento || "—" },
      { Campo: "Análise Inicial", Valor: data.analise_inicial || "—" },
      { Campo: "Ação Imediata", Valor: data.acao_imediata || "—" },
    );
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 25 }, { wch: 45 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Apontamento");
  XLSX.writeFile(wb, `apontamento-${typeLabels[data.tipo] || "export"}-${data.numero || "sem-numero"}.xlsx`);
}

export const ApontamentoExportButtons = ({ data, photos, contentRef }: Props) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm" className="gap-1.5" data-export-btn>
        <Download className="w-4 h-4" /> Exportar
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => contentRef && exportToPdf(contentRef, data)} className="gap-2" disabled={!contentRef}>
        <FileText className="w-4 h-4" /> PDF
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => exportToExcel(data)} className="gap-2">
        <FileSpreadsheet className="w-4 h-4" /> Excel (.xlsx)
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);
