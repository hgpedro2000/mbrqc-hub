import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import PptxGenJS from "pptxgenjs";
import logoMobis from "@/assets/hyundai-mobis-logo.png";

const RED = "8B0000";
const BLUE = "1F4E79";
const GREEN = "1e8449";
const WHITE = "FFFFFF";
const BORDER = "9ca3af";

// A4 LANDSCAPE pixel canvas at ~96 dpi (matches AlertaExportTemplate)
const PAGE_W_PX = 1123;
const PAGE_H_PX = 794;

// A4 LANDSCAPE mm
const PAGE_W_MM = 297;
const PAGE_H_MM = 210;

// A4 LANDSCAPE inches (for pptx)
const PAGE_W_IN = 11.69;
const PAGE_H_IN = 8.27;

/** Robust date parser */
function parseDateSafe(value: string | null | undefined): Date | null {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const d = new Date(+iso[1], +iso[2] - 1, +iso[3], 12, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    let y = +dmy[3]; if (y < 100) y += 2000;
    const d = new Date(y, +dmy[2] - 1, +dmy[1], 12, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

const fmtDate = (d: string | null | undefined) => {
  const dt = parseDateSafe(d);
  return dt ? dt.toLocaleDateString("pt-BR") : "—";
};

const fmtDateTime = (d: string | null | undefined) => {
  const dt = parseDateSafe(d);
  if (!dt) return "—";
  return `${dt.toLocaleDateString("pt-BR")} – ${dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
};

const formatSeq = (seq: number) => `AQ-${String(seq).padStart(5, "0")}`;

const sanitize = (s: string) =>
  (s || "alerta").replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 80);

export function buildFileBaseName(alerta: any) {
  const seq = formatSeq(alerta?.sequencial || 0);
  const titulo = alerta?.titulo || alerta?.descricao || alerta?.modelo || "Alerta";
  return `${seq}_${sanitize(titulo)}`;
}

async function captureTemplate(el: HTMLElement) {
  if (typeof document !== "undefined" && "fonts" in document) {
    await (document as any).fonts.ready;
  }
  await new Promise((r) => setTimeout(r, 250));

  return html2canvas(el, {
    scale: 1.5,
    backgroundColor: "#ffffff",
    useCORS: true,
    allowTaint: true,
    width: PAGE_W_PX,
    height: PAGE_H_PX,
    windowWidth: PAGE_W_PX,
    windowHeight: PAGE_H_PX,
  });
}

export async function exportAlertaJpg(el: HTMLElement, alerta: any, page2El?: HTMLElement | null) {
  const canvas = await captureTemplate(el);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `${buildFileBaseName(alerta)}.jpg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  if (page2El) {
    const canvas2 = await captureTemplate(page2El);
    const dataUrl2 = canvas2.toDataURL("image/jpeg", 0.9);
    const a2 = document.createElement("a");
    a2.href = dataUrl2;
    a2.download = `${buildFileBaseName(alerta)}_assinaturas.jpg`;
    document.body.appendChild(a2);
    a2.click();
    document.body.removeChild(a2);
  }
}

export async function exportAlertaPdf(el: HTMLElement, alerta: any, page2El?: HTMLElement | null) {
  const canvas = await captureTemplate(el);
  // JPEG with 0.82 quality keeps the file < 2MB while preserving readability
  const imgData = canvas.toDataURL("image/jpeg", 0.82);
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  pdf.addImage(imgData, "JPEG", 0, 0, PAGE_W_MM, PAGE_H_MM, undefined, "FAST");

  if (page2El) {
    const canvas2 = await captureTemplate(page2El);
    const imgData2 = canvas2.toDataURL("image/jpeg", 0.85);
    pdf.addPage("a4", "landscape");
    pdf.addImage(imgData2, "JPEG", 0, 0, PAGE_W_MM, PAGE_H_MM, undefined, "FAST");
  }

  pdf.save(`${buildFileBaseName(alerta)}.pdf`);
}

/** Compress a remote image to a base64 JPEG with max width MAX_W. */
async function urlToCompressedBase64(url: string, maxW = 1200, quality = 0.82): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    });
    if (!dataUrl) return null;

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = dataUrl;
    });

    const ratio = Math.min(1, maxW / img.width);
    const w = Math.round(img.width * ratio);
    const h = Math.round(img.height * ratio);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return null;
  }
}

async function urlToBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Right vertical red band */
function drawRedBand(slide: any) {
  const bandW = 0.32;
  slide.addShape("rect", {
    x: PAGE_W_IN - bandW, y: 0, w: bandW, h: PAGE_H_IN,
    fill: { color: RED }, line: { color: RED },
  });
  slide.addText("ALERTA DE QUALIDADE", {
    x: PAGE_W_IN - bandW, y: 0, w: bandW, h: PAGE_H_IN,
    color: WHITE, fontSize: 14, bold: true,
    align: "center", valign: "middle",
    rotate: 270, fontFace: "Arial", charSpacing: 6,
  });
  return bandW;
}

/** Top red header bar with sequencial */
function drawHeader(slide: any, bandW: number, alerta: any) {
  slide.addText(formatSeq(alerta.sequencial || 0), {
    x: 0, y: 0, w: PAGE_W_IN - bandW, h: 0.5,
    fill: { color: RED }, color: WHITE,
    bold: true, fontSize: 24, align: "center", valign: "middle",
    fontFace: "Arial",
  });
}

export async function exportAlertaPptx(alerta: any, inspetores: any[] = [], ciencias: any[] = []) {
  const a = alerta || {};
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "A4L", width: PAGE_W_IN, height: PAGE_H_IN });
  pptx.layout = "A4L";

  const issuedAt = a.created_at || a.data_ocorrencia;

  // ============= PAGE 1 =============
  const slide = pptx.addSlide();
  slide.background = { color: WHITE };
  const bandW = drawRedBand(slide);
  drawHeader(slide, bandW, a);

  const left = 0.12;
  const contentW = PAGE_W_IN - bandW - left - left;

  const cellOpts = (label: string, value: string) => ({
    text: [
      { text: label + "\n", options: { bold: true, color: RED, fontSize: 9 } },
      { text: value || "—", options: { color: BLUE, fontSize: 12, bold: true } },
    ],
    options: { fill: { color: WHITE }, valign: "top" as const, margin: 4 },
  });

  const logoB64 = await urlToBase64(logoMobis);

  const tableRows: any[] = [
    [
      { text: "", options: { fill: { color: WHITE }, rowspan: 2, valign: "middle" as const, align: "center" as const, margin: 2 } },
      cellOpts("MODELO DO CARRO", a.modelo),
      cellOpts("MODO DE FALHA", a.modo_falha),
      cellOpts("LINHA/PEÇA", a.linha_peca),
      cellOpts("DATA OCORRÊNCIA", fmtDate(a.data_ocorrencia)),
      cellOpts("DOCUMENTO N°", a.etiqueta_fora_spec || a.documento || "—"),
    ],
    [
      cellOpts("LOCAL DETECTADO", a.local_detectado),
      cellOpts("VIN", a.vin),
      cellOpts("TURNO", a.turno),
      cellOpts("DATA VALIDADE", fmtDate(a.data_validade)),
      cellOpts("RESPONSÁVEL", a.responsabilidade),
    ],
    [
      { text: "DESCRIÇÃO", options: { fill: { color: RED }, color: WHITE, bold: true, fontSize: 13, valign: "middle" as const, align: "left" as const, margin: 6 } },
      { text: a.descricao || "—", options: { fill: { color: WHITE }, color: BLUE, bold: true, fontSize: 15, valign: "middle" as const, align: "left" as const, colspan: 5, margin: 6 } as any },
    ],
  ];

  const colW = [
    contentW * 0.12,
    contentW * 0.176,
    contentW * 0.176,
    contentW * 0.176,
    contentW * 0.176,
    contentW * 0.176,
  ];

  const tableY = 0.55;
  const tableRowH = [0.5, 0.5, 0.55];

  slide.addTable(tableRows, {
    x: left, y: tableY, w: contentW,
    colW,
    rowH: tableRowH,
    border: { type: "solid", pt: 0.75, color: BORDER },
    fontFace: "Arial",
  });

  if (logoB64) {
    slide.addImage({
      data: logoB64,
      x: left + 0.05, y: tableY + 0.06, w: colW[0] - 0.1, h: tableRowH[0] + tableRowH[1] - 0.12,
      sizing: { type: "contain", w: colW[0] - 0.1, h: tableRowH[0] + tableRowH[1] - 0.12 },
    });
  }

  // Photos NG/OK — fill remaining space until the obs/footer band
  const photosTop = tableY + tableRowH[0] + tableRowH[1] + tableRowH[2] + 0.08;
  const photosBottom = PAGE_H_IN - 1.15; // room for obs (0.7) + emitido strip (0.3) + margin
  const photoH = photosBottom - photosTop;
  const photoW = (contentW - 0.15) / 2;
  const ngX = left;
  const okX = left + photoW + 0.15;

  const [ngB64, okB64] = await Promise.all([
    a.foto_ng_url ? urlToCompressedBase64(a.foto_ng_url, 1200, 0.82) : Promise.resolve(null),
    a.foto_ok_url ? urlToCompressedBase64(a.foto_ok_url, 1200, 0.82) : Promise.resolve(null),
  ]);

  // NG frame
  slide.addShape("rect", {
    x: ngX, y: photosTop, w: photoW, h: photoH,
    fill: { color: "F8F8F8" }, line: { color: RED, width: 6 },
  });
  if (ngB64) {
    slide.addImage({
      data: ngB64,
      x: ngX + 0.08, y: photosTop + 0.08, w: photoW - 0.16, h: photoH - 0.16,
      sizing: { type: "cover", w: photoW - 0.16, h: photoH - 0.16 },
    });
  }
  slide.addText("NG", {
    x: ngX + 0.1, y: photosTop + 0.1, w: 0.7, h: 0.38,
    fill: { color: RED }, color: WHITE, bold: true, fontSize: 16,
    align: "center", valign: "middle", fontFace: "Arial",
  });

  // OK frame
  slide.addShape("rect", {
    x: okX, y: photosTop, w: photoW, h: photoH,
    fill: { color: "F8F8F8" }, line: { color: GREEN, width: 6 },
  });
  if (okB64) {
    slide.addImage({
      data: okB64,
      x: okX + 0.08, y: photosTop + 0.08, w: photoW - 0.16, h: photoH - 0.16,
      sizing: { type: "cover", w: photoW - 0.16, h: photoH - 0.16 },
    });
  }
  slide.addText("OK", {
    x: okX + 0.1, y: photosTop + 0.1, w: 0.7, h: 0.38,
    fill: { color: GREEN }, color: WHITE, bold: true, fontSize: 16,
    align: "center", valign: "middle", fontFace: "Arial",
  });

  // OBSERVAÇÕES + BRAKE POINT split
  const obsTop = photosBottom + 0.08;
  const obsH = 0.7;
  const obsCols = [contentW * 0.12, contentW * 0.48, contentW * 0.16, contentW * 0.12, contentW * 0.12];
  const obsRows = [
    [
      { text: "OBSERVAÇÕES", options: { fill: { color: RED }, color: WHITE, bold: true, fontSize: 12, valign: "top" as const, align: "left" as const, margin: 6 } },
      { text: a.observacoes || "", options: { fill: { color: WHITE }, color: BLUE, fontSize: 12, valign: "top" as const, align: "left" as const, margin: 6 } },
      { text: "BRAKE POINT", options: { fill: { color: RED }, color: WHITE, bold: true, fontSize: 12, valign: "top" as const, align: "left" as const, margin: 6 } },
      { text: [
          { text: "SEQ\n", options: { bold: true, color: RED, fontSize: 10 } },
          { text: a.sequencia_bp || "—", options: { color: BLUE, bold: true, fontSize: 12 } },
        ],
        options: { fill: { color: WHITE }, valign: "top" as const, margin: 5 },
      },
      { text: [
          { text: "VIN\n", options: { bold: true, color: RED, fontSize: 10 } },
          { text: a.vin_bp || "—", options: { color: BLUE, bold: true, fontSize: 12 } },
        ],
        options: { fill: { color: WHITE }, valign: "top" as const, margin: 5 },
      },
    ],
  ];

  slide.addTable(obsRows as any, {
    x: left, y: obsTop, w: contentW,
    colW: obsCols,
    rowH: [obsH],
    border: { type: "solid", pt: 1.5, color: RED },
    fontFace: "Arial",
  });

  // EMITIDO POR strip
  const stripY = obsTop + obsH + 0.08;
  slide.addText(`EMITIDO POR: ${a.emitido_por || "—"}    EM: ${fmtDateTime(issuedAt)}`, {
    x: left, y: stripY, w: contentW, h: 0.35,
    fill: { color: RED }, color: WHITE, bold: true, fontSize: 13,
    align: "center", valign: "middle", fontFace: "Arial",
  });

  // ============= PAGE 2 — Signatures =============
  const slide2 = pptx.addSlide();
  slide2.background = { color: WHITE };
  drawRedBand(slide2);
  drawHeader(slide2, bandW, a);

  // Layout: distribute available height (~6.7") into 2 tables that fill the page
  const titleH = 0.32;
  const headerRowH = 0.32;
  const dataRowH = 0.34;
  const footerH = 0.4;
  const topY = 0.55;
  const availableH = PAGE_H_IN - topY - footerH - 0.25;

  // Table 1
  const insRowsCount = Math.max(1, (inspetores || []).length);
  const cieRowsCount = Math.max(1, (ciencias || []).length);

  // Allocate space proportionally between the two tables (with min)
  const block1Min = titleH + headerRowH + dataRowH;
  const block2Min = titleH + headerRowH + dataRowH;
  const desired1 = titleH + headerRowH + dataRowH * insRowsCount;
  const desired2 = titleH + headerRowH + dataRowH * cieRowsCount;
  const totalDesired = desired1 + desired2 + 0.2;
  const scale = totalDesired > availableH ? availableH / totalDesired : 1;
  const block1H = Math.max(block1Min, desired1 * scale);
  const block2H = Math.max(block2Min, availableH - block1H - 0.2);

  // ---- Table 1: Status
  slide2.addText("Status de Ciência dos Inspetores", {
    x: left, y: topY, w: contentW, h: titleH,
    color: "000000", bold: true, fontSize: 13, fontFace: "Arial",
  });

  const insHeader = ["Nome", "Cargo", "Status", "Data/Hora", "Método"].map((t) => ({
    text: t,
    options: { bold: true, color: WHITE, fill: { color: RED }, fontSize: 10, align: "left" as const, margin: 4, valign: "middle" as const },
  }));
  const insRows = (inspetores || []).map((ins: any) => {
    const c = (ciencias || []).find((x: any) => x.inspetor_id === ins.id);
    const dt = c ? new Date(c.created_at) : null;
    return [
      { text: ins.full_name || "—", options: { fontSize: 10, margin: 4, valign: "middle" as const } },
      { text: ins.cargo || "—", options: { fontSize: 10, margin: 4, valign: "middle" as const } },
      { text: c ? "Ciente ✓" : "Pendente", options: { fontSize: 10, bold: true, color: c ? BLUE : "d35400", margin: 4, valign: "middle" as const } },
      { text: dt ? `${dt.toLocaleDateString("pt-BR")} ${dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "—", options: { fontSize: 10, margin: 4, valign: "middle" as const } },
      { text: c ? (c.metodo === "qr_lider" ? "QR Líder" : "App Próprio") : "—", options: { fontSize: 10, margin: 4, valign: "middle" as const } },
    ];
  });
  if (insRows.length === 0) {
    insRows.push([{ text: "Nenhum inspetor habilitado", options: { fontSize: 10, italic: true, align: "center" as const, colspan: 5, margin: 4 } as any }] as any);
  }

  const tbl1Y = topY + titleH;
  const tbl1AvailH = block1H - titleH;
  const tbl1RowH = Math.max(0.26, (tbl1AvailH - headerRowH) / Math.max(1, insRows.length));

  slide2.addTable([insHeader as any, ...(insRows as any)], {
    x: left, y: tbl1Y, w: contentW,
    colW: [contentW * 0.26, contentW * 0.24, contentW * 0.14, contentW * 0.20, contentW * 0.16],
    rowH: [headerRowH, ...insRows.map(() => tbl1RowH)],
    border: { type: "solid", pt: 0.75, color: BORDER },
    fontFace: "Arial",
    autoPage: false,
  });

  // ---- Table 2: Records
  const sortedCiencias = [...(ciencias || [])].sort(
    (x: any, y: any) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime()
  );

  const block2Y = topY + block1H + 0.2;
  slide2.addText(`Registros de Ciência (${sortedCiencias.length})`, {
    x: left, y: block2Y, w: contentW, h: titleH,
    color: "000000", bold: true, fontSize: 12, fontFace: "Arial",
  });

  const cieHeader = ["Inspetor", "Data/Hora", "Método", "Termo"].map((t) => ({
    text: t,
    options: { bold: true, color: WHITE, fill: { color: RED }, fontSize: 10, align: "left" as const, margin: 4, valign: "middle" as const },
  }));
  const cieRows = sortedCiencias.map((c: any) => {
    const dt = new Date(c.created_at);
    return [
      { text: c.profiles?.full_name || "—", options: { fontSize: 10, margin: 4, valign: "middle" as const } },
      { text: `${dt.toLocaleDateString("pt-BR")} ${dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, options: { fontSize: 10, margin: 4, valign: "middle" as const } },
      { text: c.metodo === "qr_lider" ? "QR Líder" : "App Próprio", options: { fontSize: 10, margin: 4, valign: "middle" as const } },
      { text: c.versao_termo || "—", options: { fontSize: 10, fontFace: "Courier New", margin: 4, valign: "middle" as const } },
    ];
  });
  if (cieRows.length === 0) {
    cieRows.push([{ text: "Nenhuma ciência registrada", options: { fontSize: 10, italic: true, align: "center" as const, colspan: 4, margin: 4 } as any }] as any);
  }

  const tbl2Y = block2Y + titleH;
  const tbl2AvailH = block2H - titleH;
  const tbl2RowH = Math.max(0.26, (tbl2AvailH - headerRowH) / Math.max(1, cieRows.length));

  slide2.addTable([cieHeader as any, ...(cieRows as any)], {
    x: left, y: tbl2Y, w: contentW,
    colW: [contentW * 0.32, contentW * 0.24, contentW * 0.20, contentW * 0.24],
    rowH: [headerRowH, ...cieRows.map(() => tbl2RowH)],
    border: { type: "solid", pt: 0.75, color: BORDER },
    fontFace: "Arial",
    autoPage: false,
  });

  // Footer
  const footerY = PAGE_H_IN - footerH - 0.1;
  slide2.addText(
    `EMITIDO POR: ${a.emitido_por || "—"}    DATA: ${fmtDate(issuedAt)}        ${formatSeq(a.sequencial || 0)}`,
    {
      x: left, y: footerY, w: contentW, h: footerH,
      fill: { color: RED }, color: WHITE, bold: true, fontSize: 11,
      align: "center", valign: "middle", fontFace: "Arial",
    }
  );

  await pptx.writeFile({ fileName: `${buildFileBaseName(alerta)}.pptx` });
}
