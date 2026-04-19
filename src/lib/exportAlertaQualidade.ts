import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import PptxGenJS from "pptxgenjs";

const RED = "9b1b1b";
const GREEN = "1e7e34";
const WHITE = "FFFFFF";
const BORDER = "9ca3af";

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—";

const formatSeq = (seq: number) => `AQ-${String(seq).padStart(5, "0")}`;

const sanitize = (s: string) =>
  (s || "alerta").replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 80);

/** Build the exported file base name: AQ-00001_NomeDoAlerta */
export function buildFileBaseName(alerta: any) {
  const seq = formatSeq(alerta?.sequencial || 0);
  const titulo = alerta?.titulo || alerta?.descricao || alerta?.modelo || "Alerta";
  return `${seq}_${sanitize(titulo)}`;
}

/** Capture the hidden A4 template element to a high-res canvas. */
async function captureTemplate(el: HTMLElement) {
  if (typeof document !== "undefined" && "fonts" in document) {
    await (document as any).fonts.ready;
  }
  // Wait a tick for images
  await new Promise((r) => setTimeout(r, 200));

  return html2canvas(el, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    allowTaint: true,
    width: 794,
    height: 1123,
    windowWidth: 794,
    windowHeight: 1123,
  });
}

export async function exportAlertaJpg(el: HTMLElement, alerta: any) {
  const canvas = await captureTemplate(el);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `${buildFileBaseName(alerta)}.jpg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function exportAlertaPdf(el: HTMLElement, alerta: any) {
  const canvas = await captureTemplate(el);
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  // A4: 210 x 297 mm
  pdf.addImage(imgData, "PNG", 0, 0, 210, 297);
  pdf.save(`${buildFileBaseName(alerta)}.pdf`);
}

/** Convert an image URL to base64 data URL (for embedding in PPTX). */
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

export async function exportAlertaPptx(alerta: any) {
  const a = alerta || {};
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in — but we want A4 portrait

  // Define A4 portrait layout (8.27 x 11.69 in)
  pptx.defineLayout({ name: "A4P", width: 8.27, height: 11.69 });
  pptx.layout = "A4P";

  const slide = pptx.addSlide();
  slide.background = { color: WHITE };

  // Right red vertical band
  const bandW = 0.55;
  slide.addShape("rect", {
    x: 8.27 - bandW,
    y: 0,
    w: bandW,
    h: 11.69,
    fill: { color: RED },
    line: { color: RED },
  });
  // Vertical text on the band
  slide.addText("ALERTA DE QUALIDADE", {
    x: 8.27 - bandW,
    y: 0,
    w: bandW,
    h: 11.69,
    color: WHITE,
    fontSize: 26,
    bold: true,
    align: "center",
    valign: "middle",
    rotate: 270,
    fontFace: "Arial",
    charSpacing: 4,
  });

  // Working area width (left of band, with margins)
  const left = 0.3;
  const contentW = 8.27 - bandW - left - 0.15;

  // Title bar (sequencial)
  slide.addText(formatSeq(a.sequencial || 0), {
    x: left,
    y: 0.25,
    w: contentW,
    h: 0.4,
    fill: { color: RED },
    color: WHITE,
    bold: true,
    fontSize: 14,
    align: "center",
    valign: "middle",
    fontFace: "Arial",
  });

  // Fields — two rows of cells
  const row1 = [
    { label: "MODELO DO CARRO", value: a.modelo || "—" },
    { label: "DESCRIÇÃO", value: a.descricao || "—" },
    { label: "MODO DE FALHA", value: a.modo_falha || "—" },
    { label: "LINHA/PEÇA", value: a.linha_peca || "—" },
    { label: "ETIQUETA FORA SPEC", value: a.etiqueta_fora_spec || "—" },
  ];
  const row2 = [
    { label: "LOCAL DETECTADO", value: a.local_detectado || "—" },
    { label: "RESPONSÁVEL", value: a.responsabilidade || "—" },
    { label: "VIN", value: a.vin || "—" },
    { label: "DATA OCORRÊNCIA", value: fmtDate(a.data_ocorrencia) },
    { label: "DATA VALIDADE", value: fmtDate(a.data_validade) },
    { label: "TURNO", value: a.turno || "—" },
  ];

  // Build a 6-column table so both rows align (row1 has 5, pad to 6; row2 has 6)
  const padded1 = [...row1, { label: "", value: "" }];
  const tableRows = [
    padded1.map((c) => ({
      text: [
        { text: c.label + "\n", options: { bold: true, color: RED, fontSize: 7 } },
        { text: c.value, options: { color: "000000", fontSize: 9 } },
      ],
      options: { fill: { color: WHITE }, valign: "top" as const, margin: 3 },
    })),
    row2.map((c) => ({
      text: [
        { text: c.label + "\n", options: { bold: true, color: RED, fontSize: 7 } },
        { text: c.value, options: { color: "000000", fontSize: 9 } },
      ],
      options: { fill: { color: WHITE }, valign: "top" as const, margin: 3 },
    })),
  ];

  slide.addTable(tableRows as any, {
    x: left,
    y: 0.75,
    w: contentW,
    colW: Array(6).fill(contentW / 6),
    rowH: 0.55,
    border: { type: "solid", pt: 0.75, color: BORDER },
    fontFace: "Arial",
  });

  // Photos
  const photoY = 2.0;
  const photoH = 3.6;
  const photoW = (contentW - 0.2) / 2;
  const ngX = left;
  const okX = left + photoW + 0.2;

  const [ngB64, okB64] = await Promise.all([
    a.foto_ng_url ? urlToBase64(a.foto_ng_url) : Promise.resolve(null),
    a.foto_ok_url ? urlToBase64(a.foto_ok_url) : Promise.resolve(null),
  ]);

  // NG frame
  slide.addShape("rect", {
    x: ngX,
    y: photoY,
    w: photoW,
    h: photoH,
    fill: { color: "F8F8F8" },
    line: { color: RED, width: 3 },
  });
  if (ngB64) {
    slide.addImage({
      data: ngB64,
      x: ngX + 0.1,
      y: photoY + 0.1,
      w: photoW - 0.2,
      h: photoH - 0.2,
      sizing: { type: "contain", w: photoW - 0.2, h: photoH - 0.2 },
    });
  }
  // NG label
  slide.addText("NG", {
    x: ngX + 0.08,
    y: photoY + 0.08,
    w: 0.5,
    h: 0.28,
    fill: { color: RED },
    color: WHITE,
    bold: true,
    fontSize: 11,
    align: "center",
    valign: "middle",
    fontFace: "Arial",
  });

  // OK frame
  slide.addShape("rect", {
    x: okX,
    y: photoY,
    w: photoW,
    h: photoH,
    fill: { color: "F8F8F8" },
    line: { color: GREEN, width: 3 },
  });
  if (okB64) {
    slide.addImage({
      data: okB64,
      x: okX + 0.1,
      y: photoY + 0.1,
      w: photoW - 0.2,
      h: photoH - 0.2,
      sizing: { type: "contain", w: photoW - 0.2, h: photoH - 0.2 },
    });
  }
  slide.addText("OK", {
    x: okX + 0.08,
    y: photoY + 0.08,
    w: 0.5,
    h: 0.28,
    fill: { color: GREEN },
    color: WHITE,
    bold: true,
    fontSize: 11,
    align: "center",
    valign: "middle",
    fontFace: "Arial",
  });

  // Observações
  const obsY = photoY + photoH + 0.2;
  slide.addText(
    [
      {
        text: "Observações:",
        options: { color: RED, bold: true, fontSize: 11, underline: { color: RED, style: "sng" } as any },
      },
      { text: "\n" + (a.observacoes || "—"), options: { color: "000000", fontSize: 10 } },
    ] as any,
    {
      x: left,
      y: obsY,
      w: contentW,
      h: 1.8,
      valign: "top",
      fontFace: "Arial",
    }
  );

  // Footer red bar
  const footerH = 0.45;
  slide.addShape("rect", {
    x: 0,
    y: 11.69 - footerH,
    w: 8.27 - bandW,
    h: footerH,
    fill: { color: RED },
    line: { color: RED },
  });
  const footerText =
    `BRAKE POINT     SEQUÊNCIA: ${a.sequencia_bp || "—"}     VIN: ${a.vin_bp || a.vin || "—"}     EMITIDO POR: ${a.emitido_por || "—"}     DATA: ${fmtDate(a.data_ocorrencia)}`;
  slide.addText(footerText, {
    x: 0.2,
    y: 11.69 - footerH,
    w: 8.27 - bandW - 0.4,
    h: footerH,
    color: WHITE,
    bold: true,
    fontSize: 9,
    align: "center",
    valign: "middle",
    fontFace: "Arial",
  });

  await pptx.writeFile({ fileName: `${buildFileBaseName(alerta)}.pptx` });
}
