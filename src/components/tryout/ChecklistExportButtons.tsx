import * as XLSX from "xlsx";
import pptxgen from "pptxgenjs";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, Presentation, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import hyundaiMobisLogo from "@/assets/hyundai-mobis-logo.png";
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

function exportToPdf(data: Record<string, any>, photos: any[], fields: string[], fieldLabels: Record<string, string>, checklistType: string) {
  const typeLabel = getTypeLabel(checklistType);
  const numero = data.numero || "";
  const dateStr = formatValue("data", data.data);

  const styles = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #222; background: #fff; padding: 24px; font-size: 11px; }
    .header { display: flex; align-items: center; gap: 16px; border-bottom: 2px solid #003366; padding-bottom: 12px; margin-bottom: 16px; }
    .header img { height: 48px; }
    .header-text h1 { font-size: 18px; color: #003366; margin-bottom: 2px; }
    .header-text p { font-size: 11px; color: #666; }
    .section-title { font-size: 13px; font-weight: 700; color: #003366; text-transform: uppercase; letter-spacing: 1px; margin: 14px 0 6px; border-bottom: 1px solid #ddd; padding-bottom: 3px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 16px; margin-bottom: 8px; }
    .grid-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 2px 12px; margin-bottom: 8px; }
    .field label { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
    .field p { font-size: 11px; color: #222; font-weight: 500; margin-top: 1px; }
    .kpi-bar { background: #f5f5f5; border: 1px solid #ddd; border-radius: 6px; padding: 10px 14px; margin-bottom: 10px; display: flex; align-items: center; gap: 16px; }
    .kpi-value { font-size: 22px; font-weight: 700; }
    .kpi-ok { color: #16a34a; }
    .kpi-warn { color: #d97706; }
    .kpi-bad { color: #dc2626; }
    .kpi-details { font-size: 10px; color: #666; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; margin-bottom: 8px; }
    th { background: #003366; color: #fff; font-size: 9px; text-align: left; padding: 4px 6px; }
    td { border-bottom: 1px solid #eee; padding: 3px 6px; font-size: 10px; }
    tr:nth-child(even) td { background: #f8f9fa; }
    .check-ok { color: #16a34a; font-weight: 600; }
    .check-ng { color: #dc2626; font-weight: 600; }
    .footer { margin-top: 16px; border-top: 1px solid #ddd; padding-top: 6px; text-align: center; font-size: 9px; color: #999; }
    .photos { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 6px; }
    .photos img { width: 100%; height: 150px; object-fit: cover; border: 1px solid #ddd; border-radius: 4px; }
    @media print { body { padding: 12px; } }
  `;

  const identificationFields = ["numero", "nome", "data", "fornecedor", "projeto", "part_number", "part_name", "modulo"];
  const pieceDataFields = ["razao_tryout", "razao_tryout_outro", "qtd_tryout", "total_pecas", "pecas_ok", "pecas_ng"];
  const processFields = ["materia_prima", "injetora", "tonelagem", "cycle_time", "cooling_time", "weight"];
  const evaluationFields = ["dimensional", "comentarios"];

  const isInjection = checklistType === "injection_checklists";
  const defects = data.defects as any[] | undefined;
  const items = data.items as string[] | undefined;
  const checkedItems = (data.checked_items || []) as string[];
  const rate = data.rate ? Number(data.rate) : 0;

  const renderField = (key: string) =>
    `<div class="field"><label>${fieldLabels[key] || key}</label><p>${formatValue(key, data[key])}</p></div>`;

  let body = `
    <div class="header">
      <img src="${hyundaiMobisLogo}" alt="Hyundai Mobis" />
      <div class="header-text">
        <h1>Checklist de ${typeLabel}${numero ? ` #${numero}` : ""}</h1>
        <p>${data.nome || ""} • ${dateStr}${data.fornecedor ? ` • ${data.fornecedor}` : ""}</p>
      </div>
    </div>
  `;

  if (isInjection) {
    // KPI
    if (data.total_pecas > 0) {
      const kpiClass = rate >= 90 ? "kpi-ok" : rate >= 70 ? "kpi-warn" : "kpi-bad";
      body += `
        <div class="kpi-bar">
          <span class="kpi-value ${kpiClass}">${rate.toFixed(1)}%</span>
          <span class="kpi-details">${data.pecas_ok} OK / ${data.total_pecas} total (${data.pecas_ng} NG)</span>
        </div>
      `;
    }

    body += `<div class="section-title">Identificação</div><div class="grid-4">${identificationFields.map(renderField).join("")}</div>`;
    body += `<div class="section-title">Dados da Peça</div><div class="grid">${pieceDataFields.filter(k => !(k === "razao_tryout_outro" && !data.razao_tryout_outro)).map(renderField).join("")}</div>`;
    body += `<div class="section-title">Parâmetros de Processo</div><div class="grid">${processFields.map(renderField).join("")}</div>`;
    body += `<div class="section-title">Avaliação</div><div class="grid">${evaluationFields.map(renderField).join("")}</div>`;

    // Defects
    if (defects && defects.length > 0) {
      body += `<div class="section-title">Defeitos (${defects.length})</div>`;
      body += `<table><tr><th>#</th><th>Descrição</th><th>Melhoria</th><th>Categoria</th></tr>`;
      defects.forEach((d: any, i: number) => {
        body += `<tr><td>${i + 1}</td><td>${d.description || "—"}</td><td class="${d.needs_improvement ? "check-ng" : "check-ok"}">${d.needs_improvement ? "Sim" : "Não"}</td><td>${d.improvement_category ? `Cat. ${d.improvement_category}` : "—"}</td></tr>`;
      });
      body += `</table>`;
    }
  } else {
    body += `<div class="section-title">Informações</div><div class="grid">${fields.map(renderField).join("")}</div>`;

    if (items && items.length > 0) {
      body += `<div class="section-title">Itens do Checklist</div>`;
      body += `<table><tr><th>Item</th><th>Status</th></tr>`;
      items.forEach((item: string) => {
        const ok = checkedItems.includes(item);
        body += `<tr><td>${item}</td><td class="${ok ? "check-ok" : "check-ng"}">${ok ? "✓ Conforme" : "✗ Não conforme"}</td></tr>`;
      });
      body += `</table>`;
    }
  }

  // Photos
  if (photos.length > 0) {
    body += `<div class="section-title">Fotos (${photos.length})</div><div class="photos">`;
    photos.forEach((photo) => {
      const { data: urlData } = supabase.storage.from("checklist-photos").getPublicUrl(photo.file_path);
      body += `<img src="${urlData.publicUrl}" alt="${photo.file_name}" />`;
    });
    body += `</div>`;
  }

  body += `<div class="footer">Hyundai Mobis — Try-Out Control • Gerado em ${new Date().toLocaleDateString("pt-BR")}</div>`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Checklist ${typeLabel} ${numero}</title><style>${styles}</style></head><body>${body}</body></html>`;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }
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
        <DropdownMenuItem onClick={() => exportToPdf(data, photos, fields, fieldLabels, checklistType)} className="gap-2">
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
