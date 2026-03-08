import * as XLSX from "xlsx";
import pptxgen from "pptxgenjs";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, Presentation } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ExportProps {
  data: Record<string, any>;
  photos: any[];
  checklistType: string;
  fields: string[];
  fieldLabels: Record<string, string>;
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

function exportToExcel(data: Record<string, any>, fields: string[], fieldLabels: Record<string, string>, checklistType: string) {
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
          rows.push({ Campo: "Categoria", Valor: `Categoria ${d.improvement_category}` });
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

async function exportToPptx(data: Record<string, any>, photos: any[], fields: string[], fieldLabels: Record<string, string>, checklistType: string) {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  const typeLabel = getTypeLabel(checklistType);
  const numero = data.numero || "";

  // Title slide
  const slide1 = pptx.addSlide();
  slide1.addText(`Checklist de ${typeLabel}`, { x: 0.5, y: 1.5, w: 12, h: 1.2, fontSize: 32, bold: true, color: "003366" });
  slide1.addText(`${numero ? `#${numero} • ` : ""}${data.nome || ""} • ${formatValue("data", data.data)}`, { x: 0.5, y: 2.8, w: 12, h: 0.6, fontSize: 18, color: "555555" });
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
        ],
      ];
      defects.forEach((d, i) => {
        defectRows.push([
          { text: String(i + 1), options: { fontSize: 9 } },
          { text: d.description || "—", options: { fontSize: 9 } },
          { text: d.needs_improvement ? "Sim" : "Não", options: { fontSize: 9, color: d.needs_improvement ? "CC3333" : "227722" } },
          { text: d.improvement_category ? `Cat. ${d.improvement_category}` : "—", options: { fontSize: 9 } },
        ]);
      });

      slideDefects.addTable(defectRows, {
        x: 0.5, y: 1.1, w: 12,
        colW: [1, 7, 2, 2],
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

export const ChecklistExportButtons = ({ data, photos, checklistType, fields, fieldLabels }: ExportProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Download className="w-4 h-4" /> Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
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
