import * as XLSX from "xlsx";
import pptxgen from "pptxgenjs";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, Presentation, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import hyundaiMobisLogo from "@/assets/hyundai-mobis-logo.png";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import React from "react";

interface ExportProps {
  data: Record<string, any>;
  photos: any[];
  checklistType: string;
  fields: string[];
  fieldLabels: Record<string, string>;
  contentRef?: React.RefObject<HTMLDivElement>;
  catMap?: Record<string, string>;
  defectMap?: Record<string, string>;
}

function formatValue(key: string, value: any): string {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "data") return new Date(value).toLocaleDateString("pt-BR");
  if (key === "needs_improvement") return value ? "Sim" : "Não";
  if (key === "improvement_category") return value ? `Categoria ${value}` : "—";
  if (key === "rate") return `${Number(value).toFixed(1)}%`;
  return String(value);
}

function getTypeLabel(type: string) {
  if (type === "injection_checklists") return "Injeção";
  if (type === "painting_checklists") return "Pintura";
  return "Montagem";
}

function exportToExcel(data: Record<string, any>, fields: string[], fieldLabels: Record<string, string>, checklistType: string, catMap?: Record<string, string>, defectMap?: Record<string, string>) {
  const rows = fields.map((key) => ({
    Campo: fieldLabels[key] || key,
    Valor: formatValue(key, data[key]),
  }));

  // Add razao_tryout fields if present (injection)
  if (checklistType === "injection_checklists" && data.razao_tryout) {
    rows.splice(0, 0, { Campo: "Razão do Tryout", Valor: data.razao_tryout });
    if (data.razao_tryout_outro) {
      rows.splice(1, 0, { Campo: "Detalhe da Razão", Valor: data.razao_tryout_outro });
    }
  }

  // Defects for injection
  if (checklistType === "injection_checklists" && data.defects) {
    const defects = data.defects as any[];
    if (defects.length > 0) {
      rows.push({ Campo: "", Valor: "" });
      rows.push({ Campo: "DEFEITOS", Valor: "" });
      defects.forEach((d, i) => {
        rows.push({ Campo: `Defeito #${i + 1}`, Valor: d.description || "—" });
        rows.push({ Campo: "Melhoria necessária", Valor: d.needs_improvement ? "Sim" : "Não" });
        if (d.improvement_category) {
          rows.push({ Campo: "Categoria da Melhoria", Valor: catMap?.[d.improvement_category] || `Categoria ${d.improvement_category}` });
        }
        if (d.failure_mode) {
          rows.push({ Campo: "Modo de Falha", Valor: defectMap?.[d.failure_mode] || d.failure_mode });
        }
      });
    }
  }

  // Checklist items for painting/assembly
  if (checklistType !== "injection_checklists" && data.items) {
    const items = data.items as string[];
    const checked = (data.checked_items || []) as string[];
    rows.push({ Campo: "", Valor: "" });
    rows.push({ Campo: "ITENS DO CHECKLIST", Valor: "STATUS" });
    items.forEach((item) => {
      rows.push({ Campo: item, Valor: checked.includes(item) ? "✓ Conforme" : "✗ Não conforme" });
    });
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 30 }, { wch: 40 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Checklist");
  const numero = data.numero || "sem-numero";
  XLSX.writeFile(wb, `checklist-${getTypeLabel(checklistType)}-${numero}.xlsx`);
}

async function exportToPptx(data: Record<string, any>, photos: any[], fields: string[], fieldLabels: Record<string, string>, checklistType: string, catMap?: Record<string, string>, defectMap?: Record<string, string>) {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  const typeLabel = getTypeLabel(checklistType);
  const numero = data.numero || "";

  // Title slide with logo
  const slide1 = pptx.addSlide();
  try {
    const logoResp = await fetch(hyundaiMobisLogo);
    const logoBlob = await logoResp.blob();
    const logoBase64 = await blobToBase64(logoBlob);
    slide1.addImage({ data: logoBase64, x: 0.5, y: 0.3, w: 3.5, h: 1.2 });
  } catch { /* skip logo */ }
  slide1.addText(`Checklist de ${typeLabel}`, { x: 0.5, y: 1.8, w: 12, h: 1.2, fontSize: 32, bold: true, color: "003366" });
  slide1.addText(`${numero ? `#${numero} • ` : ""}${data.nome || ""} • ${formatValue("data", data.data)}`, { x: 0.5, y: 3.1, w: 12, h: 0.6, fontSize: 18, color: "555555" });
  slide1.addText("Hyundai Mobis — Try-Out Control", { x: 0.5, y: 4.5, w: 12, h: 0.5, fontSize: 12, color: "999999" });

  // Data slide
  const midpoint = Math.ceil(fields.length / 2);
  const leftFields = fields.slice(0, midpoint);
  const rightFields = fields.slice(midpoint);

  const slide2 = pptx.addSlide();
  slide2.addText("Dados do Checklist", { x: 0.5, y: 0.3, w: 12, h: 0.6, fontSize: 22, bold: true, color: "003366" });

  const tableRows: pptxgen.TableRow[] = [];
  const maxLen = Math.max(leftFields.length, rightFields.length);
  for (let i = 0; i < maxLen; i++) {
    const row: pptxgen.TableCell[] = [];
    if (i < leftFields.length) {
      row.push({ text: fieldLabels[leftFields[i]] || leftFields[i], options: { bold: true, fontSize: 10, color: "555555", fill: { color: "F0F4F8" } } });
      row.push({ text: formatValue(leftFields[i], data[leftFields[i]]), options: { fontSize: 10 } });
    } else {
      row.push({ text: "", options: {} }, { text: "", options: {} });
    }
    if (i < rightFields.length) {
      row.push({ text: fieldLabels[rightFields[i]] || rightFields[i], options: { bold: true, fontSize: 10, color: "555555", fill: { color: "F0F4F8" } } });
      row.push({ text: formatValue(rightFields[i], data[rightFields[i]]), options: { fontSize: 10 } });
    } else {
      row.push({ text: "", options: {} }, { text: "", options: {} });
    }
    tableRows.push(row);
  }

  slide2.addTable(tableRows, {
    x: 0.5, y: 1.1, w: 12,
    colW: [2.5, 3.5, 2.5, 3.5],
    border: { type: "solid", pt: 0.5, color: "CCCCCC" },
    rowH: 0.35,
  });

  // Defects slide for injection
  if (checklistType === "injection_checklists" && data.defects) {
    const defects = data.defects as any[];
    if (defects.length > 0) {
      const slideDefects = pptx.addSlide();
      slideDefects.addText("Defeitos Encontrados", { x: 0.5, y: 0.3, w: 12, h: 0.6, fontSize: 22, bold: true, color: "003366" });

      const defectRows: pptxgen.TableRow[] = [
        [
          { text: "#", options: { bold: true, fontSize: 10, fill: { color: "003366" }, color: "FFFFFF" } },
          { text: "Descrição", options: { bold: true, fontSize: 10, fill: { color: "003366" }, color: "FFFFFF" } },
          { text: "Melhoria", options: { bold: true, fontSize: 10, fill: { color: "003366" }, color: "FFFFFF" } },
          { text: "Categoria", options: { bold: true, fontSize: 10, fill: { color: "003366" }, color: "FFFFFF" } },
          { text: "Modo de Falha", options: { bold: true, fontSize: 10, fill: { color: "003366" }, color: "FFFFFF" } },
        ],
      ];
      defects.forEach((d, i) => {
        defectRows.push([
          { text: String(i + 1), options: { fontSize: 9 } },
          { text: d.description || "—", options: { fontSize: 9 } },
          { text: d.needs_improvement ? "Sim" : "Não", options: { fontSize: 9, color: d.needs_improvement ? "CC3333" : "227722" } },
          { text: d.improvement_category ? (catMap?.[d.improvement_category] || `Cat. ${d.improvement_category}`) : "—", options: { fontSize: 9 } },
          { text: d.failure_mode ? (defectMap?.[d.failure_mode] || d.failure_mode) : "—", options: { fontSize: 9 } },
        ]);
      });

      slideDefects.addTable(defectRows, {
        x: 0.5, y: 1.1, w: 12,
        colW: [0.8, 5, 1.5, 2.5, 2.7],
        border: { type: "solid", pt: 0.5, color: "CCCCCC" },
        rowH: 0.3,
      });
    }
  }

  // Checklist items slide for painting/assembly
  if (checklistType !== "injection_checklists" && data.items) {
    const items = data.items as string[];
    const checked = (data.checked_items || []) as string[];
    const slide3 = pptx.addSlide();
    slide3.addText("Itens do Checklist", { x: 0.5, y: 0.3, w: 12, h: 0.6, fontSize: 22, bold: true, color: "003366" });

    const itemRows: pptxgen.TableRow[] = [
      [
        { text: "Item", options: { bold: true, fontSize: 10, fill: { color: "003366" }, color: "FFFFFF" } },
        { text: "Status", options: { bold: true, fontSize: 10, fill: { color: "003366" }, color: "FFFFFF" } },
      ],
    ];
    items.forEach((item) => {
      const ok = checked.includes(item);
      itemRows.push([
        { text: item, options: { fontSize: 9 } },
        { text: ok ? "✓ Conforme" : "✗ Não conforme", options: { fontSize: 9, color: ok ? "227722" : "CC3333" } },
      ]);
    });

    slide3.addTable(itemRows, {
      x: 0.5, y: 1.1, w: 12,
      colW: [9, 3],
      border: { type: "solid", pt: 0.5, color: "CCCCCC" },
      rowH: 0.3,
    });
  }

  // Photos slide
  if (photos.length > 0) {
    const slidePhotos = pptx.addSlide();
    slidePhotos.addText("Fotos", { x: 0.5, y: 0.3, w: 12, h: 0.6, fontSize: 22, bold: true, color: "003366" });

    const maxPhotos = Math.min(photos.length, 6);
    const cols = 3;
    const imgW = 3.5;
    const imgH = 2.5;

    for (let i = 0; i < maxPhotos; i++) {
      const photo = photos[i];
      const { data: urlData } = supabase.storage.from("checklist-photos").getPublicUrl(photo.file_path);
      try {
        const response = await fetch(urlData.publicUrl);
        const blob = await response.blob();
        const base64 = await blobToBase64(blob);
        const col = i % cols;
        const row = Math.floor(i / cols);
        slidePhotos.addImage({
          data: base64,
          x: 0.5 + col * (imgW + 0.3),
          y: 1.1 + row * (imgH + 0.3),
          w: imgW,
          h: imgH,
        });
      } catch {
        // skip photo if fetch fails
      }
    }
  }

  pptx.writeFile({ fileName: `checklist-${typeLabel}-${numero || "export"}.pptx` });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function exportToPdfFromRef(contentRef: React.RefObject<HTMLDivElement>, checklistType: string, numero: string) {
  if (!contentRef.current) return;

  const el = contentRef.current;

  // Hide export buttons during capture
  const exportBtns = el.querySelectorAll("[data-export-btn]");
  exportBtns.forEach((btn) => (btn as HTMLElement).style.display = "none");

  // Temporarily expand to full height (no scroll clipping)
  const parent = el.closest("[class*='overflow-y-auto']") as HTMLElement | null;
  const prevMaxH = parent?.style.maxHeight;
  const prevOverflow = parent?.style.overflow;
  if (parent) {
    parent.style.maxHeight = "none";
    parent.style.overflow = "visible";
  }

  try {
    if (typeof document !== "undefined" && "fonts" in document) {
      await (document as Document & { fonts: FontFaceSet }).fonts.ready;
    }
    await new Promise((resolve) => setTimeout(resolve, 80));

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      windowWidth: 768,
      scrollX: 0,
      scrollY: -window.scrollY,
    });

    const imgData = canvas.toDataURL("image/png");
    const imgW = canvas.width;
    const imgH = canvas.height;

    // Use A4 width but dynamic height to fit everything on ONE page
    const pdfW = 210;
    const margin = 8;
    const contentW = pdfW - margin * 2;
    const contentH = (imgH * contentW) / imgW;
    const pdfH = contentH + margin * 2;

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [pdfW, pdfH],
    });

    pdf.addImage(imgData, "PNG", margin, margin, contentW, contentH);

    const typeLabel = getTypeLabel(checklistType);
    pdf.save(`checklist-${typeLabel}-${numero || "export"}.pdf`);
  } finally {
    exportBtns.forEach((btn) => (btn as HTMLElement).style.display = "");
    if (parent) {
      parent.style.maxHeight = prevMaxH || "";
      parent.style.overflow = prevOverflow || "";
    }
  }
}

export const ChecklistExportButtons = ({ data, photos, checklistType, fields, fieldLabels, contentRef }: ExportProps) => {
  const numero = data?.numero || "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5" data-export-btn>
          <Download className="w-4 h-4" /> Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => contentRef && exportToPdfFromRef(contentRef, checklistType, numero)}
          className="gap-2"
          disabled={!contentRef}
        >
          <FileText className="w-4 h-4" /> PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportToExcel(data, fields, fieldLabels, checklistType)} className="gap-2">
          <FileSpreadsheet className="w-4 h-4" /> Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportToPptx(data, photos, fields, fieldLabels, checklistType)} className="gap-2">
          <Presentation className="w-4 h-4" /> PowerPoint (.pptx)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const RowExportButtons = ({ onView }: { onView: () => void }) => {
  return (
    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onView(); }} title="Visualizar">
      <Download className="w-3.5 h-3.5" />
    </Button>
  );
};
