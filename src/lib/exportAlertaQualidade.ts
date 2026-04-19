import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import PptxGenJS from "pptxgenjs";

const RED = "9b1b1b";
const GREEN = "1e7e34";
const WHITE = "FFFFFF";
const BORDER = "9ca3af";

// A4 landscape pixel canvas at ~96 dpi
const PAGE_W_PX = 1123;
const PAGE_H_PX = 794;

// A4 landscape mm
const PAGE_W_MM = 297;
const PAGE_H_MM = 210;

// A4 landscape inches (for pptx)
const PAGE_W_IN = 11.69;
const PAGE_H_IN = 8.27;

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—";

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
  // Always export the main page as JPG. If page2El exists, also export it as a 2nd jpg.
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
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  pdf.addImage(imgData, "PNG", 0, 0, PAGE_W_MM, PAGE_H_MM);

  if (page2El) {
    const canvas2 = await captureTemplate(page2El);
    const imgData2 = canvas2.toDataURL("image/png");
    pdf.addPage("a4", "landscape");
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

/** Build red band + vertical text on a slide */
function drawRedBand(slide: any) {
  const bandW = 0.45;
  slide.addShape("rect", {
    x: PAGE_W_IN - bandW,
    y: 0,
    w: bandW,
    h: PAGE_H_IN,
    fill: { color: RED },
    line: { color: RED },
  });
  slide.addText("ALERTA DE QUALIDADE", {
    x: PAGE_W_IN - bandW,
    y: 0,
    w: bandW,
    h: PAGE_H_IN,
    color: WHITE,
    fontSize: 22,
    bold: true,
    align: "center",
    valign: "middle",
    rotate: 270,
    fontFace: "Arial",
    charSpacing: 4,
  });
  return bandW;
}

/** Footer red bar on a slide */
function drawFooter(slide: any, bandW: number, alerta: any) {
  const footerH = 0.4;
  slide.addShape("rect", {
    x: 0,
    y: PAGE_H_IN - footerH,
    w: PAGE_W_IN - bandW,
    h: footerH,
    fill: { color: RED },
    line: { color: RED },
  });
  const footerText =
    `BRAKE POINT     SEQUÊNCIA: ${alerta.sequencia_bp || "—"}     VIN: ${alerta.vin_bp || alerta.vin || "—"}     EMITIDO POR: ${alerta.emitido_por || "—"}     DATA: ${fmtDate(alerta.data_ocorrencia)}`;
  slide.addText(footerText, {
    x: 0.2,
    y: PAGE_H_IN - footerH,
    w: PAGE_W_IN - bandW - 0.4,
    h: footerH,
    color: WHITE,
    bold: true,
    fontSize: 10,
    align: "center",
    valign: "middle",
    fontFace: "Arial",
  });
}

export async function exportAlertaPptx(alerta: any, inspetores: any[] = [], ciencias: any[] = []) {
  const a = alerta || {};
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "A4L", width: PAGE_W_IN, height: PAGE_H_IN });
  pptx.layout = "A4L";

  // ----------- PAGE 1 -----------
  const slide = pptx.addSlide();
  slide.background = { color: WHITE };

  const bandW = drawRedBand(slide);
  const left = 0.25;
  const contentW = PAGE_W_IN - bandW - left - 0.1;

  // Title bar (sequencial)
  slide.addText(formatSeq(a.sequencial || 0), {
    x: left,
    y: 0.2,
    w: contentW,
    h: 0.35,
    fill: { color: RED },
    color: WHITE,
    bold: true,
    fontSize: 14,
    align: "center",
    valign: "middle",
    fontFace: "Arial",
  });

  // Fields table
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
  const padded1 = [...row1, { label: "", value: "" }];
  const tableRows = [
    padded1.map((c) => ({
      text: [
        { text: c.label + "\n", options: { bold: true, color: RED, fontSize: 8 } },
        { text: c.value, options: { color: "000000", fontSize: 10 } },
      ],
      options: { fill: { color: WHITE }, valign: "top" as const, margin: 3 },
    })),
    row2.map((c) => ({
      text: [
        { text: c.label + "\n", options: { bold: true, color: RED, fontSize: 8 } },
        { text: c.value, options: { color: "000000", fontSize: 10 } },
      ],
      options: { fill: { color: WHITE }, valign: "top" as const, margin: 3 },
    })),
  ];
  slide.addTable(tableRows as any, {
    x: left,
    y: 0.6,
    w: contentW,
    colW: Array(6).fill(contentW / 6),
    rowH: 0.5,
    border: { type: "solid", pt: 0.75, color: BORDER },
    fontFace: "Arial",
  });

  // Photos — fill remaining height up to footer
  const photosTop = 1.7;
  const footerH = 0.4;
  const obsH = 0.5;
  const photosBottom = PAGE_H_IN - footerH - obsH - 0.1;
  const photoH = photosBottom - photosTop;
  const photoW = (contentW - 0.2) / 2;
  const ngX = left;
  const okX = left + photoW + 0.2;

  const [ngB64, okB64] = await Promise.all([
    a.foto_ng_url ? urlToBase64(a.foto_ng_url) : Promise.resolve(null),
    a.foto_ok_url ? urlToBase64(a.foto_ok_url) : Promise.resolve(null),
  ]);

  // NG frame
  slide.addShape("rect", {
    x: ngX, y: photosTop, w: photoW, h: photoH,
    fill: { color: "F8F8F8" }, line: { color: RED, width: 3 },
  });
  if (ngB64) {
    slide.addImage({
      data: ngB64,
      x: ngX + 0.05, y: photosTop + 0.05, w: photoW - 0.1, h: photoH - 0.1,
      sizing: { type: "cover", w: photoW - 0.1, h: photoH - 0.1 },
    });
  }
  slide.addText("NG", {
    x: ngX + 0.08, y: photosTop + 0.08, w: 0.5, h: 0.28,
    fill: { color: RED }, color: WHITE, bold: true, fontSize: 11,
    align: "center", valign: "middle", fontFace: "Arial",
  });

  // OK frame
  slide.addShape("rect", {
    x: okX, y: photosTop, w: photoW, h: photoH,
    fill: { color: "F8F8F8" }, line: { color: GREEN, width: 3 },
  });
  if (okB64) {
    slide.addImage({
      data: okB64,
      x: okX + 0.05, y: photosTop + 0.05, w: photoW - 0.1, h: photoH - 0.1,
      sizing: { type: "cover", w: photoW - 0.1, h: photoH - 0.1 },
    });
  }
  slide.addText("OK", {
    x: okX + 0.08, y: photosTop + 0.08, w: 0.5, h: 0.28,
    fill: { color: GREEN }, color: WHITE, bold: true, fontSize: 11,
    align: "center", valign: "middle", fontFace: "Arial",
  });

  // Observações
  slide.addText(
    [
      { text: "Observações: ", options: { color: RED, bold: true, fontSize: 10, underline: { color: RED, style: "sng" } as any } },
      { text: a.observacoes || "—", options: { color: "000000", fontSize: 10 } },
    ] as any,
    {
      x: left, y: photosBottom + 0.08,
      w: contentW, h: obsH,
      valign: "top", fontFace: "Arial",
    }
  );

  drawFooter(slide, bandW, a);

  // ----------- PAGE 2 — Signatures -----------
  const slide2 = pptx.addSlide();
  slide2.background = { color: WHITE };
  drawRedBand(slide2);

  // Title bar
  slide2.addText(`${formatSeq(a.sequencial || 0)} — Status de Ciência`, {
    x: left, y: 0.2, w: contentW, h: 0.35,
    fill: { color: RED }, color: WHITE, bold: true, fontSize: 14,
    align: "center", valign: "middle", fontFace: "Arial",
  });

  // H2
  slide2.addText("Status de Ciência dos Inspetores", {
    x: left, y: 0.65, w: contentW, h: 0.3,
    color: "000000", bold: true, fontSize: 13, fontFace: "Arial",
  });

  // Inspector status table
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
        options: { fontSize: 9, bold: true, color: c ? GREEN : RED, margin: 3 },
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

  const insTableY = 1.05;
  const insTableH = 3.2;
  slide2.addTable([insHeader as any, ...(insRows as any)], {
    x: left, y: insTableY, w: contentW,
    colW: [contentW * 0.32, contentW * 0.23, contentW * 0.12, contentW * 0.20, contentW * 0.13],
    border: { type: "solid", pt: 0.75, color: BORDER },
    fontFace: "Arial",
    autoPage: false,
  });

  // Ciencias log
  const sortedCiencias = [...(ciencias || [])].sort(
    (x: any, y: any) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime()
  );

  slide2.addText(`Registros de Ciência (${sortedCiencias.length})`, {
    x: left, y: insTableY + insTableH + 0.05, w: contentW, h: 0.3,
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
    x: left, y: insTableY + insTableH + 0.4, w: contentW,
    colW: [contentW * 0.38, contentW * 0.22, contentW * 0.20, contentW * 0.20],
    border: { type: "solid", pt: 0.75, color: BORDER },
    fontFace: "Arial",
    autoPage: false,
  });

  drawFooter(slide2, bandW, a);

  await pptx.writeFile({ fileName: `${buildFileBaseName(alerta)}.pptx` });
}
