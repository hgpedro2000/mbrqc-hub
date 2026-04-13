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
  const d = data;
  const tipo = d.tipo || "incoming";
  const tipoLabel = typeLabels[tipo] || tipo;
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;
  const margin = 14;
  const contentW = pageW - margin * 2;
  let y = margin;

  const C = {
    primary:   [30,  100, 200] as [number,number,number],
    text:      [30,   30,  30] as [number,number,number],
    muted:     [120, 120, 120] as [number,number,number],
    border:    [220, 220, 225] as [number,number,number],
    cardBg:    [248, 249, 251] as [number,number,number],
    headerBg:  [240, 244, 255] as [number,number,number],
    okGreen:   [22,  163,  74] as [number,number,number],
    ngRed:     [220,  38,  38] as [number,number,number],
    white:     [255, 255, 255] as [number,number,number],
    labelBg:   [239, 246, 255] as [number,number,number],
  };

  const setColor = (rgb: [number,number,number]) => pdf.setTextColor(rgb[0], rgb[1], rgb[2]);
  const setFill  = (rgb: [number,number,number]) => pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
  const setDraw  = (rgb: [number,number,number]) => pdf.setDrawColor(rgb[0], rgb[1], rgb[2]);

  const addPage = () => { pdf.addPage(); y = margin; };
  const checkSpace = (needed: number) => { if (y + needed > pageH - margin) addPage(); };

  const drawCard = (cardY: number, cardH: number, bg = C.cardBg) => {
    setFill(bg);
    setDraw(C.border);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(margin, cardY, contentW, cardH, 2, 2, "FD");
  };

  const sectionTitle = (title: string) => {
    checkSpace(10);
    setFill(C.primary);
    pdf.rect(margin, y, 3, 5.5, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    setColor(C.primary);
    pdf.text(title.toUpperCase(), margin + 5, y + 4);
    y += 9;
  };

  const field = (label: string, value: string, x: number, fieldY: number, w: number) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.5);
    setColor(C.muted);
    pdf.text(label.toUpperCase(), x, fieldY);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    setColor(C.text);
    const lines = pdf.splitTextToSize(value || "—", w - 2);
    pdf.text(lines, x, fieldY + 4);
    return fieldY + 4 + (lines.length - 1) * 4;
  };

  // ── HEADER ──
  setFill(C.primary);
  pdf.rect(0, 0, pageW, 1.5, "F");

  setFill(C.headerBg);
  setDraw(C.border);
  pdf.setLineWidth(0.3);
  pdf.rect(0, 1.5, pageW, 36, "FD");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  setColor(C.primary);
  pdf.text("HYUNDAI", margin, 14);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text("MÖBIS", margin, 21);

  const badgeY = 9;
  const badgeH = 5.5;

  setFill([219, 234, 254]);
  setDraw([147, 197, 253]);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(margin + 38, badgeY, 18, badgeH, 1.5, 1.5, "FD");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  setColor(C.primary);
  pdf.text(tipoLabel, margin + 47, badgeY + 3.8, { align: "center" });

  if (d.numero) {
    setFill([240, 253, 244]);
    setDraw([134, 239, 172]);
    pdf.roundedRect(margin + 59, badgeY, 24, badgeH, 1.5, 1.5, "FD");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    setColor([21, 128, 61]);
    pdf.text(`#${d.numero}`, margin + 71, badgeY + 3.8, { align: "center" });
  }

  const isFinalized = d.status !== "draft";
  setFill(isFinalized ? [240, 253, 244] : [254, 252, 232]);
  setDraw(isFinalized ? [134, 239, 172] : [253, 224, 71]);
  pdf.roundedRect(margin + 86, badgeY, 22, badgeH, 1.5, 1.5, "FD");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  setColor(isFinalized ? [21, 128, 61] : [133, 77, 14]);
  pdf.text(isFinalized ? "Finalizado" : "Rascunho", margin + 97, badgeY + 3.8, { align: "center" });

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  setColor(C.text);
  pdf.text(`Relatório de Apontamento — ${tipoLabel}`, margin + 38, 20);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  setColor(C.muted);
  const subtitle = [d.responsavel, fmt("data", d.data), d.fornecedor].filter(Boolean).join(" • ");
  pdf.text(subtitle, margin + 38, 26);

  y = 42;

  // ── KPI BANNER ──
  if (["incoming","peca","processo"].includes(tipo) && (d.quantidade_inspecionada > 0 || d.quantidade_ng > 0)) {
    checkSpace(18);
    drawCard(y, 16, C.white);
    const kpiY = y + 10;
    const col = contentW / 3;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    setColor(C.text);
    pdf.text(String(d.quantidade_inspecionada || 0), margin + col * 0.5, kpiY, { align: "center" });
    setColor(C.okGreen);
    pdf.text(String(d.quantidade_ok || 0), margin + col * 1.5, kpiY, { align: "center" });
    setColor(d.quantidade_ng > 0 ? C.ngRed : C.muted);
    pdf.text(String(d.quantidade_ng || 0), margin + col * 2.5, kpiY, { align: "center" });

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    setColor(C.muted);
    pdf.text("INSPECIONADA", margin + col * 0.5, kpiY + 5, { align: "center" });
    pdf.text("OK",           margin + col * 1.5, kpiY + 5, { align: "center" });
    pdf.text("NG",           margin + col * 2.5, kpiY + 5, { align: "center" });

    setDraw(C.border);
    pdf.setLineWidth(0.3);
    pdf.line(margin + col,     y + 3, margin + col,     y + 13);
    pdf.line(margin + col * 2, y + 3, margin + col * 2, y + 13);
    y += 22;
  }

  // ── IDENTIFICAÇÃO ──
  sectionTitle("Identificação");
  checkSpace(30);
  const idCardY = y;
  drawCard(idCardY, 34, C.white);
  const col4 = contentW / 4;
  const px = margin + 3;
  const r1y = idCardY + 5;
  const r2y = idCardY + 16;
  const r3y = idCardY + 27;

  field("Número",       d.numero || "—",            px,                   r1y, col4);
  field("Data",         fmt("data", d.data),         px + col4,            r1y, col4);
  field("Apontado Por", d.responsavel || "—",        px + col4 * 2,        r1y, col4);
  field("Turno",        d.turno || "—",              px + col4 * 3,        r1y, col4);
  field("Empresa",      d._empresa || "Mobis Brasil",px,                   r2y, col4);
  field("Origem",       d._origem || "LP",           px + col4,            r2y, col4);
  field("Projeto",      d.projeto || "—",            px + col4 * 2,        r2y, col4);
  field("Fornecedor",   d.fornecedor || "—",         px + col4 * 3,        r2y, col4);
  field("Part Number",  d.part_number || "—",        px,                   r3y, col4);
  field("Part Name",    d.part_name || "—",          px + col4,            r3y, col4 * 3);
  y = idCardY + 38;

  // ── INSPEÇÃO ──
  const coInspetores: string[] = (() => {
    try { return Array.isArray(d.co_inspetores) ? d.co_inspetores : JSON.parse(d.co_inspetores || "[]"); }
    catch { return []; }
  })();

  if (d.tempo_inspecao || coInspetores.length > 0) {
    sectionTitle("Inspeção");
    checkSpace(20);
    const insCardY = y;
    drawCard(insCardY, 18, C.white);
    if (d.tempo_inspecao) {
      field("Tempo de Inspeção", d.tempo_inspecao, px, insCardY + 5, contentW / 2);
    }
    if (coInspetores.length > 0) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(6.5);
      setColor(C.muted);
      pdf.text("CO-INSPETORES", px + contentW / 2, insCardY + 5);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      setColor(C.text);
      pdf.text(coInspetores.join("  •  "), px + contentW / 2, insCardY + 10);
    }
    y = insCardY + 22;
  }

  // ── DADOS DA INSPEÇÃO ──
  sectionTitle("Dados da Inspeção");
  checkSpace(24);
  const dadosCardY = y;
  drawCard(dadosCardY, 22, C.white);
  const col3 = contentW / 3;
  field("Fase",              d.fase || "—",                         px,              dadosCardY + 5, col3);
  field("Qtd. Inspecionada", String(d.quantidade_inspecionada || 0),px + col3,       dadosCardY + 5, col3);
  field("Qtd. NG",           String(d.quantidade_ng || 0),          px + col3 * 2,   dadosCardY + 5, col3);
  field("Qtd. OK",           String(d.quantidade_ok || 0),          px,              dadosCardY + 14, col3);
  field("Lote Inspecionado", d.lote_inspecionado || "—",            px + col3,       dadosCardY + 14, col3);
  y = dadosCardY + 26;

  // ── DETALHES ──
  if (d.modo_falha || d.descricao || d.severidade || d.comentario_adicional) {
    sectionTitle("Detalhes");
    checkSpace(20);
    const detCardY = y;
    const descLines = pdf.splitTextToSize(d.descricao || "Sem defeito encontrado durante essa inspeção", contentW - 6);
    const detH = Math.max(16, 10 + descLines.length * 4);
    drawCard(detCardY, detH, C.white);
    field("Descrição", d.descricao || "Sem defeito encontrado durante essa inspeção", px, detCardY + 5, contentW - 6);

    if (d.modo_falha) {
      y = detCardY + 5 + descLines.length * 4 + 3;
      field("Modo de Falha", d.modo_falha, px, y, contentW - 6);
      y += 8;
    }
    if (d.severidade) {
      checkSpace(10);
      field("Severidade", d.severidade, px, y, contentW / 2);
      y += 8;
    }
    if (d.comentario_adicional) {
      checkSpace(10);
      field("Comentário Adicional", d.comentario_adicional, px, y, contentW - 6);
      y += 8;
    }
    y = detCardY + detH + 4;
  }

  // ── FOOTER ──
  const totalPages = (pdf as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    setFill(C.border);
    pdf.rect(0, pageH - 10, pageW, 10, "F");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    setColor(C.muted);
    pdf.text(
      `Hyundai Mobis — Apontamento Control • Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
      pageW / 2, pageH - 4, { align: "center" }
    );
    if (totalPages > 1) {
      pdf.text(`${i} / ${totalPages}`, pageW - margin, pageH - 4, { align: "right" });
    }
  }

  const fileName = `apontamento-${tipoLabel}-${d.numero || "export"}.pdf`;
  pdf.save(fileName);
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
