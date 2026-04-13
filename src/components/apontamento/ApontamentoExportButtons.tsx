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

  // Collect all <style> and <link rel="stylesheet"> from current document
  const styleSheets = Array.from(document.styleSheets)
    .map((sheet) => {
      try {
        if (sheet.href) return `<link rel="stylesheet" href="${sheet.href}">`;
        const rules = Array.from(sheet.cssRules).map((r) => r.cssText).join("\n");
        return `<style>${rules}</style>`;
      } catch {
        if (sheet.href) return `<link rel="stylesheet" href="${sheet.href}">`;
        return "";
      }
    })
    .join("\n");

  // Get the full HTML of the content element
  const contentHtml = el.outerHTML;

  // Build a full HTML document with dark theme forced on <html>
  const fullHtml = `<!DOCTYPE html>
<html class="dark" style="background:#0f1629;color-scheme:dark;">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  ${styleSheets}
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: hsl(222 47% 11%);
      color: hsl(210 40% 98%);
      width: 794px;
      font-family: 'DM Sans', ui-sans-serif, system-ui, sans-serif;
    }
    /* Force dark CSS variables */
    :root {
      --background: 222 47% 11%;
      --foreground: 210 40% 98%;
      --card: 217 32% 17%;
      --card-foreground: 210 40% 98%;
      --popover: 215 24% 26%;
      --popover-foreground: 210 40% 98%;
      --primary: 212 26% 83%;
      --primary-foreground: 228 84% 4%;
      --secondary: 215 19% 34%;
      --secondary-foreground: 210 40% 98%;
      --muted: 215 16% 46%;
      --muted-foreground: 210 40% 98%;
      --accent: 228 84% 4%;
      --accent-foreground: 215 20% 65%;
      --destructive: 0 84% 60%;
      --destructive-foreground: 0 85% 97%;
      --border: 215 19% 34%;
      --input: 215 19% 34%;
      --ring: 212 26% 83%;
      --radius: 0rem;
    }
    /* Hide export button in popup */
    [data-export-btn] { display: none !important; }
    /* Remove dialog chrome */
    [role="dialog"] { box-shadow: none !important; border: none !important; }
  </style>
</head>
<body>
  <div style="width:794px;min-height:100vh;background:hsl(222,47%,11%);">
    ${contentHtml}
  </div>
</body>
</html>`;

  // Open a hidden popup window
  const popup = window.open("", "_blank", "width=794,height=1200,left=-9999,top=0");
  if (!popup) {
    alert("Por favor, permita popups para exportar o PDF.");
    return;
  }

  popup.document.open();
  popup.document.write(fullHtml);
  popup.document.close();

  try {
    // Wait for fonts and images to load inside the popup
    await new Promise<void>((resolve) => {
      if (popup.document.readyState === "complete") {
        resolve();
      } else {
        popup.addEventListener("load", () => resolve(), { once: true });
      }
    });

    if ("fonts" in popup.document) {
      await (popup.document as any).fonts.ready;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));

    const targetEl = popup.document.body.firstElementChild as HTMLElement;

    const canvas = await html2canvas(targetEl, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#0f1629",
      windowWidth: 794,
      width: 794,
      scrollX: 0,
      scrollY: 0,
      logging: false,
      onclone: (clonedDoc) => {
        clonedDoc.documentElement.classList.add("dark");
        clonedDoc.documentElement.style.background = "hsl(222,47%,11%)";
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

    const fileName = `apontamento-${typeLabels[data.tipo] || "export"}-${data.numero || "export"}.pdf`;
    pdf.save(fileName);
  } finally {
    popup.close();
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
