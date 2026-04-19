import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import PptxGenJS from "pptxgenjs";
import logoMobis from "@/assets/hyundai-mobis-logo.png";

const RED = "8B0000";
const BLUE = "1F4E79";
const GREEN = "1e8449";
const WHITE = "FFFFFF";
const BORDER = "9ca3af";

// A4 portrait pixel canvas at ~96 dpi (matches AlertaExportTemplate)
const PAGE_W_PX = 794;
const PAGE_H_PX = 1123;

// A4 portrait mm
const PAGE_W_MM = 210;
const PAGE_H_MM = 297;

// A4 portrait inches (for pptx)
const PAGE_W_IN = 8.27;
const PAGE_H_IN = 11.69;

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—";

const fmtDateTime = (d: string | null | undefined) => {
  if (!d) return "—";
  const dt = new Date(d);
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
    scale: 2,
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
  const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `${buildFileBaseName(alerta)}.jpg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  if (page2El) {
    const canvas2 = await captureTemplate(page2El);
    const dataUrl2 = canvas2.toDataURL("image/jpeg", 0.95);
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
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  pdf.addImage(imgData, "PNG", 0, 0, PAGE_W_MM, PAGE_H_MM);

  if (page2El) {
    const canvas2 = await captureTemplate(page2El);
    const imgData2 = canvas2.toDataURL("image/png");
    pdf.addPage("a4", "portrait");
    pdf.addImage(imgData2, "PNG", 0, 0, PAGE_W_MM, PAGE_H_MM);
  }

  pdf.save(`${buildFileBaseName(alerta)}.pdf`);
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
    color: WHITE, fontSize: 16, bold: true,
    align: "center", valign: "middle",
    rotate: 270, fontFace: "Arial", charSpacing: 6,
  });
  return bandW;
}

/** Top red header bar with sequencial */
function drawHeader(slide: any, bandW: number, alerta: any) {
  slide.addText(formatSeq(alerta.sequencial || 0), {
    x: 0, y: 0, w: PAGE_W_IN - bandW, h: 0.45,
    fill: { color: RED }, color: WHITE,
    bold: true, fontSize: 18, align: "center", valign: "middle",
    fontFace: "Arial",
  });
}

export async function exportAlertaPptx(alerta: any, inspetores: any[] = [], ciencias: any[] = []) {
  const a = alerta || {};
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "A4P", width: PAGE_W_IN, height: PAGE_H_IN });
  pptx.layout = "A4P";

  const issuedAt = a.created_at || a.data_ocorrencia;

  // ============= PAGE 1 =============
  const slide = pptx.addSlide();
  slide.background = { color: WHITE };
  const bandW = drawRedBand(slide);
  drawHeader(slide, bandW, a);

  const left = 0.12;
  const contentW = PAGE_W_IN - bandW - left - left;

  // Logo + fields table
  // Build cells with label (red) + value (blue)
  const cellOpts = (label: string, value: string) => ({
    text: [
      { text: label + "\n", options: { bold: true, color: RED, fontSize: 7 } },
      { text: value || "—", options: { color: BLUE, fontSize: 9, bold: true } },
    ],
    options: { fill: { color: WHITE }, valign: "top" as const, margin: 3 },
  });

  // Load logo as base64
  const logoB64 = await urlToBase64(logoMobis);

  const tableRows: any[] = [
    [
      {
        text: "",
        options: {
          fill: { color: WHITE },
          rowspan: 2,
          valign: "middle" as const,
          align: "center" as const,
          margin: 2,
        },
      },
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
      {
        text: "DESCRIÇÃO",
        options: {
          fill: { color: RED }, color: WHITE, bold: true, fontSize: 11,
          valign: "middle" as const, align: "left" as const, margin: 6,
        },
      },
      {
        text: a.descricao || "—",
        options: {
          fill: { color: WHITE }, color: BLUE, bold: true, fontSize: 13,
          valign: "middle" as const, align: "left" as const,
          colspan: 5, margin: 6,
        } as any,
      },
    ],
  ];

  const colW = [
    contentW * 0.16,
    contentW * 0.168,
    contentW * 0.168,
    contentW * 0.168,
    contentW * 0.168,
    contentW * 0.168,
  ];

  const tableY = 0.55;
  const tableRowH = [0.55, 0.55, 0.55];

  slide.addTable(tableRows, {
    x: left, y: tableY, w: contentW,
    colW,
    rowH: tableRowH,
    border: { type: "solid", pt: 0.75, color: BORDER },
    fontFace: "Arial",
  });

  // Logo overlay (since pptxgenjs tables don't support cell images directly)
  if (logoB64) {
    slide.addImage({
      data: logoB64,
      x: left + 0.06, y: tableY + 0.1, w: colW[0] - 0.12, h: tableRowH[0] + tableRowH[1] - 0.2,
      sizing: { type: "contain", w: colW[0] - 0.12, h: tableRowH[0] + tableRowH[1] - 0.2 },
    });
  }

  // Photos NG/OK
  const photosTop = tableY + tableRowH[0] + tableRowH[1] + tableRowH[2] + 0.1;
  const photosBottom = PAGE_H_IN - 1.55; // leave room for obs/brake + emitido
  const photoH = photosBottom - photosTop;
  const photoW = (contentW - 0.15) / 2;
  const ngX = left;
  const okX = left + photoW + 0.15;

  const [ngB64, okB64] = await Promise.all([
    a.foto_ng_url ? urlToBase64(a.foto_ng_url) : Promise.resolve(null),
    a.foto_ok_url ? urlToBase64(a.foto_ok_url) : Promise.resolve(null),
  ]);

  // NG frame
  slide.addShape("rect", {
    x: ngX, y: photosTop, w: photoW, h: photoH,
    fill: { color: "F8F8F8" }, line: { color: RED, width: 4 },
  });
  if (ngB64) {
    slide.addImage({
      data: ngB64,
      x: ngX + 0.06, y: photosTop + 0.06, w: photoW - 0.12, h: photoH - 0.12,
      sizing: { type: "cover", w: photoW - 0.12, h: photoH - 0.12 },
    });
  }
  slide.addText("NG", {
    x: ngX + 0.08, y: photosTop + 0.08, w: 0.55, h: 0.3,
    fill: { color: RED }, color: WHITE, bold: true, fontSize: 12,
    align: "center", valign: "middle", fontFace: "Arial",
  });

  // OK frame
  slide.addShape("rect", {
    x: okX, y: photosTop, w: photoW, h: photoH,
    fill: { color: "F8F8F8" }, line: { color: GREEN, width: 4 },
  });
  if (okB64) {
    slide.addImage({
      data: okB64,
      x: okX + 0.06, y: photosTop + 0.06, w: photoW - 0.12, h: photoH - 0.12,
      sizing: { type: "cover", w: photoW - 0.12, h: photoH - 0.12 },
    });
  }
  slide.addText("OK", {
    x: okX + 0.08, y: photosTop + 0.08, w: 0.55, h: 0.3,
    fill: { color: GREEN }, color: WHITE, bold: true, fontSize: 12,
    align: "center", valign: "middle", fontFace: "Arial",
  });

  // OBSERVAÇÕES + BRAKE POINT split
  const obsTop = photosBottom + 0.1;
  const obsH = 0.85;
  const obsCols = [contentW * 0.16, contentW * 0.44, contentW * 0.16, contentW * 0.12, contentW * 0.12];
  const obsRows = [
    [
      {
        text: "OBSERVAÇÕES",
        options: {
          fill: { color: RED }, color: WHITE, bold: true, fontSize: 10,
          valign: "top" as const, align: "left" as const, margin: 6, rowspan: 2,
        } as any,
      },
      {
        text: a.observacoes || "",
        options: {
          fill: { color: WHITE }, color: BLUE, fontSize: 10,
          valign: "top" as const, align: "left" as const, margin: 6, rowspan: 2,
        } as any,
      },
      {
        text: "BRAKE POINT",
        options: {
          fill: { color: RED }, color: WHITE, bold: true, fontSize: 10,
          valign: "top" as const, align: "left" as const, margin: 6, rowspan: 2,
        } as any,
      },
      {
        text: [
          { text: "SEQ\n", options: { bold: true, color: RED, fontSize: 8 } },
          { text: a.sequencia_bp || "—", options: { color: BLUE, bold: true, fontSize: 10 } },
        ],
        options: { fill: { color: WHITE }, valign: "top" as const, margin: 4 },
      },
      {
        text: [
          { text: "VIN\n", options: { bold: true, color: RED, fontSize: 8 } },
          { text: a.vin_bp || "—", options: { color: BLUE, bold: true, fontSize: 10 } },
        ],
        options: { fill: { color: WHITE }, valign: "top" as const, margin: 4 },
      },
    ],
    [
      { text: "", options: { fill: { color: WHITE } } },
      { text: "", options: { fill: { color: WHITE } } },
    ],
  ];

  slide.addTable(obsRows as any, {
    x: left, y: obsTop, w: contentW,
    colW: obsCols,
    rowH: [obsH / 2, obsH / 2],
    border: { type: "solid", pt: 1.5, color: RED },
    fontFace: "Arial",
  });

  // EMITIDO POR strip
  const stripY = obsTop + obsH + 0.12;
  slide.addText(`EMITIDO POR: ${a.emitido_por || "—"}    EM: ${fmtDateTime(issuedAt)}`, {
    x: left, y: stripY, w: contentW, h: 0.35,
    fill: { color: RED }, color: WHITE, bold: true, fontSize: 11,
    align: "center", valign: "middle", fontFace: "Arial",
  });

  // ============= PAGE 2 — Signatures =============
  const slide2 = pptx.addSlide();
  slide2.background = { color: WHITE };
  drawRedBand(slide2);
  drawHeader(slide2, bandW, a);

  slide2.addText("Status de Ciência dos Inspetores", {
    x: left, y: 0.65, w: contentW, h: 0.3,
    color: "000000", bold: true, fontSize: 13, fontFace: "Arial",
  });

  const insHeader = ["Nome", "Cargo", "Status", "Data/Hora", "Método"].map((t) => ({
    text: t,
    options: { bold: true, color: WHITE, fill: { color: RED }, fontSize: 9, align: "left" as const, margin: 3 },
  }));
  const insRows = (inspetores || []).map((ins: any) => {
    const c = (ciencias || []).find((x: any) => x.inspetor_id === ins.id);
    const dt = c ? new Date(c.created_at) : null;
    return [
      { text: ins.full_name || "—", options: { fontSize: 9, margin: 3 } },
      { text: ins.cargo || "—", options: { fontSize: 9, margin: 3 } },
      {
        text: c ? "Ciente ✓" : "Pendente",
        options: { fontSize: 9, bold: true, color: c ? BLUE : "d35400", margin: 3 },
      },
      {
        text: dt ? `${dt.toLocaleDateString("pt-BR")} ${dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "—",
        options: { fontSize: 9, margin: 3 },
      },
      { text: c ? (c.metodo === "qr_lider" ? "QR Líder" : "App Próprio") : "—", options: { fontSize: 9, margin: 3 } },
    ];
  });
  if (insRows.length === 0) {
    insRows.push([{ text: "Nenhum inspetor habilitado", options: { fontSize: 9, italic: true, align: "center" as const, colspan: 5, margin: 3 } as any }] as any);
  }

  const insTableY = 1.0;
  slide2.addTable([insHeader as any, ...(insRows as any)], {
    x: left, y: insTableY, w: contentW,
    colW: [contentW * 0.26, contentW * 0.24, contentW * 0.14, contentW * 0.20, contentW * 0.16],
    border: { type: "solid", pt: 0.75, color: BORDER },
    fontFace: "Arial",
    autoPage: false,
  });

  // Ciencias log
  const sortedCiencias = [...(ciencias || [])].sort(
    (x: any, y: any) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime()
  );

  const cieTitleY = insTableY + Math.max(0.5, 0.32 * (insRows.length + 1)) + 0.3;
  slide2.addText(`Registros de Ciência (${sortedCiencias.length})`, {
    x: left, y: cieTitleY, w: contentW, h: 0.3,
    color: "000000", bold: true, fontSize: 12, fontFace: "Arial",
  });

  const cieHeader = ["Inspetor", "Data/Hora", "Método", "Termo"].map((t) => ({
    text: t,
    options: { bold: true, color: WHITE, fill: { color: RED }, fontSize: 9, align: "left" as const, margin: 3 },
  }));
  const cieRows = sortedCiencias.map((c: any) => {
    const dt = new Date(c.created_at);
    return [
      { text: c.profiles?.full_name || "—", options: { fontSize: 9, margin: 3 } },
      { text: `${dt.toLocaleDateString("pt-BR")} ${dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, options: { fontSize: 9, margin: 3 } },
      { text: c.metodo === "qr_lider" ? "QR Líder" : "App Próprio", options: { fontSize: 9, margin: 3 } },
      { text: c.versao_termo || "—", options: { fontSize: 9, fontFace: "Courier New", margin: 3 } },
    ];
  });
  if (cieRows.length === 0) {
    cieRows.push([{ text: "Nenhuma ciência registrada", options: { fontSize: 9, italic: true, align: "center" as const, colspan: 4, margin: 3 } as any }] as any);
  }

  slide2.addTable([cieHeader as any, ...(cieRows as any)], {
    x: left, y: cieTitleY + 0.35, w: contentW,
    colW: [contentW * 0.32, contentW * 0.24, contentW * 0.20, contentW * 0.24],
    border: { type: "solid", pt: 0.75, color: BORDER },
    fontFace: "Arial",
    autoPage: false,
  });

  // Footer
  const footerY = PAGE_H_IN - 0.55;
  slide2.addText(
    [
      { text: `EMITIDO POR: ${a.emitido_por || "—"}    DATA: ${fmtDate(issuedAt)}`, options: { color: WHITE, bold: true, fontSize: 11 } },
      { text: `        ${formatSeq(a.sequencial || 0)}`, options: { color: WHITE, bold: true, fontSize: 11 } },
    ] as any,
    {
      x: left, y: footerY, w: contentW, h: 0.4,
      fill: { color: RED }, align: "center", valign: "middle", fontFace: "Arial",
    }
  );

  await pptx.writeFile({ fileName: `${buildFileBaseName(alerta)}.pptx` });
}
