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

// ─── PDF PROGRAMMATIC BUILDER ───────────────────────────────────────
// Uses only jsPDF built-in Helvetica (always embedded). No html2canvas.
// Layout: fixed-width A4, table-based grid, consistent spacing.

const PAGE_W = 210;           // A4 width mm
const MARGIN = 12;            // left/right margin
const CONTENT_W = PAGE_W - MARGIN * 2; // usable width
const GAP_SECTION = 6;        // vertical gap between sections
const GAP_ROW = 1.5;          // gap between table rows
const CELL_PAD_X = 3;         // horizontal padding inside cells
const CELL_PAD_Y = 2.5;       // vertical padding inside cells
const LABEL_FONT_SIZE = 7;
const VALUE_FONT_SIZE = 9;
const SECTION_TITLE_SIZE = 9;
const HEADER_TITLE_SIZE = 11;

interface PdfCtx {
  pdf: jsPDF;
  y: number; // current Y cursor
}

function setFont(pdf: jsPDF, style: "normal" | "bold" | "italic", size: number) {
  pdf.setFont("helvetica", style);
  pdf.setFontSize(size);
}

/** Wrap text to fit within maxWidth, return lines */
function wrapText(pdf: jsPDF, text: string, maxWidth: number): string[] {
  return pdf.splitTextToSize(text, maxWidth) as string[];
}

/** Draw a section title bar (colored background + uppercase text) */
function drawSectionTitle(ctx: PdfCtx, title: string) {
  const { pdf } = ctx;
  const barH = 7;
  pdf.setFillColor(52, 73, 94); // dark blue-gray
  pdf.rect(MARGIN, ctx.y, CONTENT_W, barH, "F");
  setFont(pdf, "bold", SECTION_TITLE_SIZE);
  pdf.setTextColor(255, 255, 255);
  pdf.text(title.toUpperCase(), MARGIN + CELL_PAD_X, ctx.y + barH / 2 + 1, { baseline: "middle" });
  ctx.y += barH + 1.5;
  pdf.setTextColor(33, 33, 33); // reset
}

/** Draw a grid of label/value pairs in N columns */
function drawFieldGrid(ctx: PdfCtx, fields: { label: string; value: string }[], cols: number) {
  const { pdf } = ctx;
  const colW = CONTENT_W / cols;

  let row: { label: string; value: string }[] = [];
  for (let i = 0; i < fields.length; i++) {
    row.push(fields[i]);
    if (row.length === cols || i === fields.length - 1) {
      // Calculate row height based on tallest value
      let maxH = 0;
      const renderedCells: { labelLines: string[]; valueLines: string[]; cellH: number }[] = [];
      for (let c = 0; c < row.length; c++) {
        const cellContentW = colW - CELL_PAD_X * 2;
        setFont(pdf, "bold", LABEL_FONT_SIZE);
        const labelLines = wrapText(pdf, row[c].label.toUpperCase(), cellContentW);
        setFont(pdf, "normal", VALUE_FONT_SIZE);
        const valueLines = wrapText(pdf, row[c].value || "–", cellContentW);
        const labelH = labelLines.length * (LABEL_FONT_SIZE * 0.4);
        const valueH = valueLines.length * (VALUE_FONT_SIZE * 0.45);
        const cellH = CELL_PAD_Y + labelH + 1.5 + valueH + CELL_PAD_Y;
        renderedCells.push({ labelLines, valueLines, cellH });
        if (cellH > maxH) maxH = cellH;
      }

      // Draw cell backgrounds + borders
      for (let c = 0; c < row.length; c++) {
        const x = MARGIN + c * colW;
        pdf.setFillColor(248, 249, 250);
        pdf.setDrawColor(220, 220, 220);
        pdf.rect(x, ctx.y, colW, maxH, "FD");
      }

      // Draw text
      for (let c = 0; c < row.length; c++) {
        const x = MARGIN + c * colW + CELL_PAD_X;
        let textY = ctx.y + CELL_PAD_Y;

        // Label
        setFont(pdf, "bold", LABEL_FONT_SIZE);
        pdf.setTextColor(120, 120, 120);
        for (const line of renderedCells[c].labelLines) {
          textY += LABEL_FONT_SIZE * 0.4;
          pdf.text(line, x, textY);
        }
        textY += 1.5;

        // Value
        setFont(pdf, "normal", VALUE_FONT_SIZE);
        pdf.setTextColor(33, 33, 33);
        for (const line of renderedCells[c].valueLines) {
          textY += VALUE_FONT_SIZE * 0.45;
          pdf.text(line, x, textY);
        }
      }

      ctx.y += maxH;
      row = [];
    }
  }
  ctx.y += GAP_ROW;
}

/** Draw KPI banner with 3 centered metric boxes */
function drawKpiBanner(ctx: PdfCtx, inspecionada: number, ok: number, ng: number) {
  const { pdf } = ctx;
  const boxW = CONTENT_W / 3;
  const boxH = 14;

  for (let i = 0; i < 3; i++) {
    const x = MARGIN + i * boxW;
    pdf.setFillColor(248, 249, 250);
    pdf.setDrawColor(220, 220, 220);
    pdf.rect(x, ctx.y, boxW, boxH, "FD");

    const val = i === 0 ? String(inspecionada) : i === 1 ? String(ok) : String(ng);
    const label = i === 0 ? "INSPECIONADA" : i === 1 ? "OK" : "NG";
    const color: [number, number, number] = i === 0 ? [33, 33, 33] : i === 1 ? [22, 163, 74] : [220, 38, 38];

    const cx = x + boxW / 2;
    setFont(pdf, "bold", 13);
    pdf.setTextColor(...color);
    pdf.text(val, cx, ctx.y + 6, { align: "center" });

    setFont(pdf, "normal", 6.5);
    pdf.setTextColor(120, 120, 120);
    pdf.text(label, cx, ctx.y + 11, { align: "center" });
  }
  ctx.y += boxH + GAP_SECTION;
  pdf.setTextColor(33, 33, 33);
}

/** Draw a full-width text block (for descriptions, comments) */
function drawFullWidthField(ctx: PdfCtx, label: string, value: string) {
  const { pdf } = ctx;
  const cellContentW = CONTENT_W - CELL_PAD_X * 2;
  setFont(pdf, "bold", LABEL_FONT_SIZE);
  const labelLines = wrapText(pdf, label.toUpperCase(), cellContentW);
  setFont(pdf, "normal", VALUE_FONT_SIZE);
  const valueLines = wrapText(pdf, value || "–", cellContentW);
  const labelH = labelLines.length * (LABEL_FONT_SIZE * 0.4);
  const valueH = valueLines.length * (VALUE_FONT_SIZE * 0.45);
  const totalH = CELL_PAD_Y + labelH + 1.5 + valueH + CELL_PAD_Y;

  pdf.setFillColor(248, 249, 250);
  pdf.setDrawColor(220, 220, 220);
  pdf.rect(MARGIN, ctx.y, CONTENT_W, totalH, "FD");

  let textY = ctx.y + CELL_PAD_Y;
  setFont(pdf, "bold", LABEL_FONT_SIZE);
  pdf.setTextColor(120, 120, 120);
  for (const line of labelLines) {
    textY += LABEL_FONT_SIZE * 0.4;
    pdf.text(line, MARGIN + CELL_PAD_X, textY);
  }
  textY += 1.5;
  setFont(pdf, "normal", VALUE_FONT_SIZE);
  pdf.setTextColor(33, 33, 33);
  for (const line of valueLines) {
    textY += VALUE_FONT_SIZE * 0.45;
    pdf.text(line, MARGIN + CELL_PAD_X, textY);
  }
  ctx.y += totalH;
}

/** Draw defect detail rows */
function drawDefectRows(ctx: PdfCtx, defeitos: any[]) {
  const { pdf } = ctx;
  for (let i = 0; i < defeitos.length; i++) {
    const def = defeitos[i];
    const numLabel = `${i + 1}. ${stripCode(def.modo_falha) || "–"}`;
    const qtyLabel = `Qty: ${def.qty || 0}`;
    const desc = def.descricao || "";

    setFont(pdf, "bold", VALUE_FONT_SIZE);
    const mainLines = wrapText(pdf, numLabel, CONTENT_W - 40);
    setFont(pdf, "normal", 8);
    const descLines = desc ? wrapText(pdf, desc, CONTENT_W - 20) : [];
    const rowH = CELL_PAD_Y + mainLines.length * 4 + (descLines.length > 0 ? descLines.length * 3.5 + 1 : 0) + CELL_PAD_Y;

    pdf.setFillColor(i % 2 === 0 ? 248 : 255, i % 2 === 0 ? 249 : 255, i % 2 === 0 ? 250 : 255);
    pdf.setDrawColor(220, 220, 220);
    pdf.rect(MARGIN, ctx.y, CONTENT_W, rowH, "FD");

    let ty = ctx.y + CELL_PAD_Y;
    setFont(pdf, "bold", VALUE_FONT_SIZE);
    pdf.setTextColor(33, 33, 33);
    for (const line of mainLines) {
      ty += 4;
      pdf.text(line, MARGIN + CELL_PAD_X, ty);
    }
    // Qty right-aligned
    setFont(pdf, "normal", 8);
    pdf.setTextColor(100, 100, 100);
    pdf.text(qtyLabel, MARGIN + CONTENT_W - CELL_PAD_X, ctx.y + CELL_PAD_Y + 4, { align: "right" });

    if (descLines.length > 0) {
      ty += 1;
      pdf.setTextColor(100, 100, 100);
      for (const line of descLines) {
        ty += 3.5;
        pdf.text(line, MARGIN + CELL_PAD_X + 6, ty);
      }
    }
    ctx.y += rowH;
  }
}

async function exportToPdf(_contentRef: React.RefObject<HTMLDivElement>, data: Record<string, any>) {
  const d = data;
  const tipo = d.tipo || "incoming";
  const tipoLabel = typeLabels[tipo] || tipo;

  // Parse arrays
  let coInspetores: string[] = [];
  try {
    coInspetores = Array.isArray(d.co_inspetores) ? d.co_inspetores : d.co_inspetores ? JSON.parse(d.co_inspetores) : [];
  } catch { coInspetores = []; }

  let segundoDefeitos: any[] = [];
  try {
    segundoDefeitos = Array.isArray(d.segundo_defeitos) ? d.segundo_defeitos : d.segundo_defeitos ? JSON.parse(d.segundo_defeitos) : [];
  } catch { segundoDefeitos = []; }

  const hasMultipleFailureModes = segundoDefeitos.length > 0 && segundoDefeitos[0]?.modo_falha;
  const hasNg = (d.quantidade_ng || 0) > 0;

  // Build PDF
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const ctx: PdfCtx = { pdf, y: MARGIN };

  // ── HEADER ──
  setFont(pdf, "bold", HEADER_TITLE_SIZE);
  pdf.setTextColor(33, 33, 33);
  pdf.text(`Relatório de Apontamento — ${tipoLabel}`, MARGIN, ctx.y + 5);
  ctx.y += 7;

  // Badge line: type + numero + status
  setFont(pdf, "normal", 8);
  pdf.setTextColor(80, 80, 80);
  const badges: string[] = [tipoLabel];
  if (d.numero) badges.push(`#${d.numero}`);
  badges.push(d.status === "draft" ? "Rascunho" : "Finalizado");
  pdf.text(badges.join("  •  "), MARGIN, ctx.y + 3);
  ctx.y += 5;

  // Subtitle line
  setFont(pdf, "normal", 7.5);
  pdf.setTextColor(120, 120, 120);
  const subtitle = [d.responsavel, fmt("data", d.data), d.fornecedor].filter(Boolean).join(" • ");
  pdf.text(subtitle, MARGIN, ctx.y + 3);
  ctx.y += 6;

  // Separator
  pdf.setDrawColor(200, 200, 200);
  pdf.line(MARGIN, ctx.y, MARGIN + CONTENT_W, ctx.y);
  ctx.y += GAP_SECTION;

  // ── KPI BANNER ──
  if ((tipo === "incoming" || tipo === "peca" || tipo === "processo") && (d.quantidade_inspecionada > 0 || d.quantidade_ng > 0)) {
    drawKpiBanner(ctx, d.quantidade_inspecionada || 0, d.quantidade_ok || 0, d.quantidade_ng || 0);
  }

  // ── IDENTIFICAÇÃO ──
  drawSectionTitle(ctx, "Identificação");
  const idFields = [
    { label: "Número", value: fmt("", d.numero) },
    { label: "Data", value: fmt("data", d.data) },
    { label: "Apontado por", value: fmt("", d.responsavel) },
    { label: "Turno", value: fmt("", d.turno) },
    { label: "Projeto", value: fmt("", d.projeto) },
    { label: "Fornecedor", value: fmt("", d.fornecedor) },
    { label: "Part Number", value: fmt("", d.part_number) },
    { label: "Part Name", value: fmt("", d.part_name) },
  ];
  if (tipo === "processo") {
    idFields.push({ label: "Linha", value: fmt("", d.linha) });
    idFields.push({ label: "Setor", value: fmt("", d.setor) });
  }
  drawFieldGrid(ctx, idFields, 4);
  ctx.y += GAP_SECTION;

  // ── INSPEÇÃO ──
  if (d.tempo_inspecao || coInspetores.length > 0) {
    drawSectionTitle(ctx, "Inspeção");
    const inspFields: { label: string; value: string }[] = [];
    if (d.tempo_inspecao) inspFields.push({ label: "Tempo de Inspeção", value: d.tempo_inspecao });
    if (coInspetores.length > 0) inspFields.push({ label: "Co-Inspetores", value: coInspetores.join(", ") });
    drawFieldGrid(ctx, inspFields, 2);
    ctx.y += GAP_SECTION;
  }

  // ── DADOS DA INSPEÇÃO / DEFEITO / OEM ──
  if (tipo === "incoming") {
    drawSectionTitle(ctx, "Dados da Inspeção");
    const inspDataFields = [
      { label: "Fase", value: fmt("", d.fase) },
      { label: "Qtd. Inspecionada", value: fmt("", d.quantidade_inspecionada) },
      { label: "Qtd. NG", value: fmt("", d.quantidade_ng) },
      { label: "Qtd. OK", value: fmt("", d.quantidade_ok) },
      { label: "Lote Inspecionado", value: fmt("", d.lote_inspecionado) },
    ];
    if (!hasMultipleFailureModes && d.modo_falha) {
      inspDataFields.push({ label: "Modo de Falha", value: stripCode(d.modo_falha) });
    }
    drawFieldGrid(ctx, inspDataFields, 3);
    ctx.y += GAP_SECTION;
  } else if (tipo === "peca" || tipo === "processo") {
    drawSectionTitle(ctx, "Dados do Defeito");
    const defFields = [
      { label: "Fase", value: fmt("", d.fase) },
      { label: "Qtd. Inspecionada", value: fmt("", d.quantidade_inspecionada) },
      { label: "Qtd. NG", value: fmt("", d.quantidade_ng) },
      { label: "Qtd. OK", value: fmt("", d.quantidade_ok) },
      { label: "Modo de Falha", value: stripCode(d.modo_falha) },
      { label: "Parada de Linha", value: d.parada_linha === "sim" ? "Sim" : "Não" },
    ];
    if (d.parada_linha === "sim") {
      defFields.push({ label: "Tempo de Parada", value: fmt("", d.parada_linha_tempo) });
    }
    drawFieldGrid(ctx, defFields, 3);
    ctx.y += GAP_SECTION;
  } else if (tipo === "oem") {
    drawSectionTitle(ctx, "Dados OEM");
    drawFieldGrid(ctx, [
      { label: "VIN", value: fmt("", d.vin_number) },
      { label: "Qtd. Detectado", value: fmt("", d.quantidade_detectado) },
      { label: "Local de Detecção", value: fmt("", d.local_deteccao) },
      { label: "Lançamento", value: fmt("", d.lancamento) },
    ], 3);
    ctx.y += GAP_SECTION;
  }

  // ── DETALHES ──
  if (tipo === "oem") {
    drawSectionTitle(ctx, "Análise e Ação");
    drawFullWidthField(ctx, "Descrição", fmt("", d.descricao));
    drawFullWidthField(ctx, "Análise Inicial", fmt("", d.analise_inicial));
    drawFullWidthField(ctx, "Ação Imediata", fmt("", d.acao_imediata));
    if (d.comentario_adicional) {
      drawFullWidthField(ctx, "Comentário Adicional", d.comentario_adicional);
    }
    ctx.y += GAP_SECTION;
  } else if (hasNg && hasMultipleFailureModes) {
    drawSectionTitle(ctx, "Detalhamento por Modo de Falha");
    drawDefectRows(ctx, segundoDefeitos);
    ctx.y += GAP_SECTION;
  } else {
    drawSectionTitle(ctx, "Detalhes");
    if (d.modo_falha) {
      drawFieldGrid(ctx, [{ label: "Modo de Falha", value: stripCode(d.modo_falha) }], 2);
    }
    drawFullWidthField(ctx, "Descrição", fmt("", d.descricao));
    if (d.comentario_adicional) {
      drawFullWidthField(ctx, "Comentário Adicional", d.comentario_adicional);
    }
    ctx.y += GAP_SECTION;
  }

  // ── SEGUNDO DEFEITO (non-failure-mode) ──
  const hasNonFmSegundo = segundoDefeitos.length > 0 && !segundoDefeitos[0]?.modo_falha;
  if (hasNonFmSegundo) {
    drawSectionTitle(ctx, `Segundo Defeito (${segundoDefeitos.length})`);
    for (const def of segundoDefeitos) {
      drawFieldGrid(ctx, [
        { label: "Part Number", value: def.part_number || "–" },
        { label: "Part Name", value: def.part_name || "–" },
        { label: "Quantidade", value: String(def.qty || 0) },
      ], 3);
    }
    ctx.y += GAP_SECTION;
  }

  // ── FOOTER ──
  ctx.y += 4;
  pdf.setDrawColor(200, 200, 200);
  pdf.line(MARGIN, ctx.y, MARGIN + CONTENT_W, ctx.y);
  ctx.y += 3;
  setFont(pdf, "normal", 7);
  pdf.setTextColor(140, 140, 140);
  pdf.text(
    `Hyundai Mobis — Apontamento Control • Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
    PAGE_W / 2, ctx.y + 2, { align: "center" }
  );

  // ── Resize page to actual content height ──
  const totalH = ctx.y + MARGIN + 4;
  const pages = pdf.internal.pages;
  // @ts-ignore – internal API to resize page
  if (pages[1]) {
    (pdf.internal as any).pageSize.setHeight(totalH);
  }

  pdf.save(`apontamento-${typeLabels[d.tipo] || "export"}-${d.numero || "export"}.pdf`);
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
