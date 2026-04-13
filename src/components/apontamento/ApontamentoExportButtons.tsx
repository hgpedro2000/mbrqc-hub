import domtoimage from "dom-to-image-more";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Download, FileText, FileSpreadsheet } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import React from "react";
import jsPDF from "jspdf";
import { stripCode } from "@/lib/stripCode";

interface Props {
  data: Record<string, any>;
  photos: any[];
  contentRef?: React.RefObject<HTMLDivElement>;
}

const typeLabels: Record<string, string> = {
  incoming: "Incoming", peca: "Peça", processo: "Processo", oem: "OEM",
};

function fmt(key: string, value: any): string {
  if (value === null || value === undefined || value === "") return "–";
  if (key === "data") return new Date(value).toLocaleDateString("pt-BR");
  return String(value);
}

async function exportToPdf(contentRef: React.RefObject<HTMLDivElement>, data: Record<string, any>) {
  if (!contentRef.current) return;
  const el = contentRef.current;

  const exportBtns = el.querySelectorAll("[data-export-btn]");
  exportBtns.forEach((b) => (b as HTMLElement).style.visibility = "hidden");

  type S = { el: HTMLElement; mh: string; ov: string; ovy: string; h: string };
  const saved: S[] = [];
  let cur = el.parentElement;
  while (cur && cur !== document.body) {
    const cs = window.getComputedStyle(cur);
    if (cs.overflow !== "visible" || cs.overflowY !== "visible" || cs.maxHeight !== "none") {
      saved.push({ el: cur, mh: cur.style.maxHeight, ov: cur.style.overflow, ovy: cur.style.overflowY, h: cur.style.height });
      cur.style.maxHeight = "none";
      cur.style.overflow = "visible";
      cur.style.overflowY = "visible";
      cur.style.height = "auto";
    }
    cur = cur.parentElement;
  }

  const prevW = el.style.width;
  const prevMW = el.style.minWidth;
  el.style.width = "768px";
  el.style.minWidth = "768px";

  try {
    await document.fonts.ready;
    await new Promise((r) => setTimeout(r, 300));

    const blob = await domtoimage.toBlob(el, {
      width: 768,
      height: el.scrollHeight,
      style: { transform: "scale(1)", transformOrigin: "top left" },
      bgcolor: "#ffffff",
      quality: 1,
    });

    const imgData = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });

    const imgW = 768;
    const imgH = el.scrollHeight;
    const pdfW = 210;
    const margin = 8;
    const contentW = pdfW - margin * 2;
    const contentH = (imgH * contentW) / imgW;
    const pdfH = contentH + margin * 2;

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [pdfW, pdfH] });
    pdf.addImage(imgData, "PNG", margin, margin, contentW, contentH);
    pdf.save(`apontamento-${typeLabels[data.tipo] || "export"}-${data.numero || "export"}.pdf`);
  } finally {
    el.style.width = prevW;
    el.style.minWidth = prevMW;
    saved.forEach(s => {
      s.el.style.maxHeight = s.mh;
      s.el.style.overflow = s.ov;
      s.el.style.overflowY = s.ovy;
      s.el.style.height = s.h;
    });
    exportBtns.forEach((b) => (b as HTMLElement).style.visibility = "");
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
