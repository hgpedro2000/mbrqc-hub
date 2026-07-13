import pptxgen from "pptxgenjs";
import { supabase } from "@/integrations/supabase/client";
import logoUrl from "@/assets/hyundai-mobis-logo.png";

export const MOBIS_COLORS = {
  primary: "002C5F",     // Mobis navy
  accent: "E60028",      // Mobis red
  light: "F5F7FA",
  gray: "6B7280",
  dark: "111827",
  ok: "16A34A",
  ng: "DC2626",
  border: "D1D5DB",
};

async function fileToBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function storagePathToData(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  // Try signed URL first (works whether bucket is public or not)
  const { data: signed } = await supabase.storage
    .from("audit-photos")
    .createSignedUrl(path, 300);
  const url = signed?.signedUrl || supabase.storage.from("audit-photos").getPublicUrl(path).data.publicUrl;
  return await fileToBase64(url);
}

async function assetToData(url: string): Promise<string | null> {
  return await fileToBase64(url);
}

function fmtDate(d?: string | null) {
  if (!d) return "-";
  const dt = new Date(d + "T12:00:00");
  return dt.toLocaleDateString("en-GB");
}

type Audit = any;
type NC = any;

/** Shared header/footer chrome for every slide */
function addChrome(slide: pptxgen.Slide, audit: Audit, logoData: string | null, pageLabel: string) {
  // Top red bar
  slide.addShape("rect", { x: 0, y: 0, w: 13.33, h: 0.05, fill: { color: MOBIS_COLORS.accent }, line: { color: MOBIS_COLORS.accent } });
  // Header band
  slide.addShape("rect", { x: 0, y: 0.05, w: 13.33, h: 0.55, fill: { color: MOBIS_COLORS.primary }, line: { color: MOBIS_COLORS.primary } });
  if (logoData) {
    slide.addImage({ data: logoData, x: 0.25, y: 0.12, w: 1.0, h: 0.4 });
  }
  slide.addText(`HYUNDAI MOBIS — Supplier Quality Audit`, {
    x: 1.4, y: 0.1, w: 8, h: 0.45, fontSize: 12, bold: true, color: "FFFFFF", fontFace: "Calibri", valign: "middle",
  });
  slide.addText(`${audit.code || ""}  |  ${audit.supplier_name || ""}`, {
    x: 9.5, y: 0.1, w: 3.7, h: 0.45, fontSize: 10, color: "FFFFFF", align: "right", valign: "middle", fontFace: "Calibri",
  });
  // Footer
  slide.addShape("rect", { x: 0, y: 7.4, w: 13.33, h: 0.1, fill: { color: MOBIS_COLORS.primary }, line: { color: MOBIS_COLORS.primary } });
  slide.addText(pageLabel, {
    x: 11, y: 7.05, w: 2.1, h: 0.3, fontSize: 9, color: MOBIS_COLORS.gray, align: "right", fontFace: "Calibri",
  });
  slide.addText("Confidential — Hyundai Mobis Brasil", {
    x: 0.25, y: 7.05, w: 8, h: 0.3, fontSize: 9, color: MOBIS_COLORS.gray, fontFace: "Calibri",
  });
}

/** Slide 1: Supplier Visit Report cover — replica do template Mobis */
function addCoverSlide(pptx: pptxgen, audit: Audit, ncs: NC[], logoData: string | null, productImg: string | null) {
  const slide = pptx.addSlide();
  slide.background = { color: "FFFFFF" };

  const HEAD = "1F3864";     // azul cabeçalho de tabela
  const LBL = "D9E2F3";      // azul claro rótulos
  const BORDER = "8FAADC";
  const TXT = "1F1F1F";

  // ===== Título + logo =====
  slide.addText([
    { text: "❑  ", options: { fontSize: 28, color: TXT } },
    { text: "Supplier Visit Report", options: { fontSize: 28, bold: true, color: TXT } },
  ], { x: 0.2, y: 0.1, w: 9, h: 0.6, fontFace: "Calibri", valign: "middle" });
  if (logoData) slide.addImage({ data: logoData, x: 11.6, y: 0.1, w: 1.55, h: 0.55, sizing: { type: "contain", w: 1.55, h: 0.55 } });

  // ===== Bloco superior de dados (linhas 1-3) =====
  const y0 = 0.75, rowH = 0.38;
  const purposeX = 9.6, purposeW = 3.6;

  // Purpose header (span 3 rows)
  slide.addShape("rect", { x: purposeX, y: y0, w: purposeW, h: rowH, fill: { color: LBL }, line: { color: BORDER, pt: 0.75 } });
  slide.addText("Purpose", { x: purposeX, y: y0, w: purposeW, h: rowH, align: "center", valign: "middle", bold: true, fontSize: 11, fontFace: "Calibri", color: TXT });

  // Linha 1: Description | Process Audit
  slide.addShape("rect", { x: 0.15, y: y0, w: 1.2, h: rowH, fill: { color: LBL }, line: { color: BORDER, pt: 0.75 } });
  slide.addText("Description", { x: 0.15, y: y0, w: 1.2, h: rowH, valign: "middle", align: "center", fontSize: 11, bold: true, fontFace: "Calibri", color: TXT });
  slide.addShape("rect", { x: 1.35, y: y0, w: purposeX - 1.35, h: rowH, line: { color: BORDER, pt: 0.75 } });
  slide.addText((audit.title || "-"), { x: 1.45, y: y0, w: purposeX - 1.55, h: rowH, valign: "middle", fontSize: 11, fontFace: "Calibri", color: TXT });

  // Linha 2: Supplier | Place | Date | (purpose row1)
  const y1 = y0 + rowH;
  const purpose: string[] = (audit.purpose || []).map((s: string) => String(s).toLowerCase());
  const chk = (on: boolean) => (on ? "■" : "☐");

  const c1 = (x: number, w: number, label: string, isLabel: boolean) => {
    slide.addShape("rect", { x, y: y1, w, h: rowH, fill: isLabel ? { color: LBL } : undefined, line: { color: BORDER, pt: 0.75 } });
    slide.addText(label, { x: x + 0.05, y: y1, w: w - 0.1, h: rowH, valign: "middle", align: isLabel ? "center" : "left", fontSize: 11, bold: isLabel, fontFace: "Calibri", color: TXT });
  };
  c1(0.15, 1.2, "Supplier", true);
  c1(1.35, 2.2, audit.supplier_name || "-", false);
  c1(3.55, 0.9, "Place", true);
  c1(4.45, 2.0, audit.place || "-", false);
  c1(6.45, 0.7, "Date", true);
  const dateStr = `${fmtDate(audit.audit_date_start)}${audit.audit_date_end && audit.audit_date_end !== audit.audit_date_start ? " & " + fmtDate(audit.audit_date_end) : ""}`;
  c1(7.15, purposeX - 7.15, dateStr, false);
  // Purpose linha 1: T/Out, TFT, New Car
  slide.addShape("rect", { x: purposeX, y: y1, w: purposeW, h: rowH, line: { color: BORDER, pt: 0.75 } });
  slide.addText(`${chk(purpose.includes("t/out") || purpose.includes("tout"))} T/Out    ${chk(purpose.includes("tft"))} TFT    ${chk(purpose.includes("new car"))} New Car`,
    { x: purposeX + 0.1, y: y1, w: purposeW - 0.2, h: rowH, valign: "middle", fontSize: 10, fontFace: "Calibri", color: TXT });

  // Linha 3: Process | (checkbox) | PIC | value | (purpose row2)
  const y2 = y0 + rowH * 2;
  const proc: string[] = (audit.process || []).map((s: string) => String(s).toLowerCase());
  slide.addShape("rect", { x: 0.15, y: y2, w: 1.2, h: rowH, fill: { color: LBL }, line: { color: BORDER, pt: 0.75 } });
  slide.addText("Process", { x: 0.15, y: y2, w: 1.2, h: rowH, valign: "middle", align: "center", fontSize: 11, bold: true, fontFace: "Calibri", color: TXT });
  slide.addShape("rect", { x: 1.35, y: y2, w: 5.1, h: rowH, line: { color: BORDER, pt: 0.75 } });
  slide.addText(`${chk(proc.includes("injection") || proc.includes("injeção"))} Injection    ${chk(proc.includes("assembly") || proc.includes("montagem"))} Assembly    ${chk(proc.includes("paint") || proc.includes("pintura"))} Paint    ${chk(proc.includes("other") || proc.includes("outro"))} Other`,
    { x: 1.45, y: y2, w: 5.0, h: rowH, valign: "middle", fontSize: 10, fontFace: "Calibri", color: TXT });
  c1 && (() => {
    slide.addShape("rect", { x: 6.45, y: y2, w: 0.7, h: rowH, fill: { color: LBL }, line: { color: BORDER, pt: 0.75 } });
    slide.addText("PIC", { x: 6.45, y: y2, w: 0.7, h: rowH, valign: "middle", align: "center", fontSize: 11, bold: true, fontFace: "Calibri", color: TXT });
    slide.addShape("rect", { x: 7.15, y: y2, w: purposeX - 7.15, h: rowH, line: { color: BORDER, pt: 0.75 } });
    slide.addText(audit.pic_name || "-", { x: 7.25, y: y2, w: purposeX - 7.35, h: rowH, valign: "middle", fontSize: 11, fontFace: "Calibri", color: TXT });
  })();
  slide.addShape("rect", { x: purposeX, y: y2, w: purposeW, h: rowH, line: { color: BORDER, pt: 0.75 } });
  slide.addText(`${chk(purpose.includes("cm validation"))} CM Validation    ${chk(purpose.includes("process check"))} Process Check`,
    { x: purposeX + 0.1, y: y2, w: purposeW - 0.2, h: rowH, valign: "middle", fontSize: 10, fontFace: "Calibri", color: TXT });

  // ===== Faixa média: Schedule | Participants | Main Product =====
  const yM = y0 + rowH * 3 + 0.05;
  const midH = 2.35;

  // Schedule
  slide.addShape("rect", { x: 0.15, y: yM, w: 4.35, h: 0.4, fill: { color: LBL }, line: { color: BORDER, pt: 0.75 } });
  slide.addText("Schedule", { x: 0.15, y: yM, w: 4.35, h: 0.4, align: "center", valign: "middle", bold: true, fontSize: 13, fontFace: "Calibri", color: TXT });
  slide.addShape("rect", { x: 0.15, y: yM + 0.4, w: 4.35, h: midH - 0.4, line: { color: BORDER, pt: 0.75 } });
  slide.addText(audit.schedule_notes || "-", {
    x: 0.25, y: yM + 0.5, w: 4.15, h: midH - 0.6, fontSize: 9, fontFace: "Calibri", color: TXT, valign: "top",
  });

  // Participants
  const px = 4.6, pw = 4.85;
  slide.addShape("rect", { x: px, y: yM, w: pw, h: 0.4, fill: { color: LBL }, line: { color: BORDER, pt: 0.75 } });
  slide.addText("Participants", { x: px, y: yM, w: pw, h: 0.4, align: "center", valign: "middle", bold: true, fontSize: 13, fontFace: "Calibri", color: TXT });
  const partRows: any[] = [[
    { text: "Name", options: { bold: true, align: "center", fill: { color: LBL }, fontSize: 10 } },
    { text: "Area", options: { bold: true, align: "center", fill: { color: LBL }, fontSize: 10 } },
    { text: "Position", options: { bold: true, align: "center", fill: { color: LBL }, fontSize: 10 } },
  ]];
  const parts = Array.isArray(audit.participants) ? audit.participants : [];
  const maxRows = 4;
  for (let i = 0; i < maxRows; i++) {
    const p = parts[i] || {};
    partRows.push([
      { text: p.name || "", options: { align: "center", fontSize: 10 } },
      { text: p.area || "", options: { align: "center", fontSize: 10 } },
      { text: p.position || p.role || "", options: { align: "center", fontSize: 10 } },
    ]);
  }
  slide.addTable(partRows, { x: px, y: yM + 0.4, w: pw, colW: [2.15, 1.4, 1.3], rowH: (midH - 0.4) / (maxRows + 1), border: { pt: 0.75, color: BORDER }, fontFace: "Calibri" });

  // Main Product
  const mx = 9.55, mw = 3.65;
  slide.addShape("rect", { x: mx, y: yM, w: mw, h: midH, line: { color: BORDER, pt: 0.75, dashType: "dash" } });
  slide.addText("Main Product", { x: mx, y: yM + 0.05, w: mw, h: 0.35, align: "center", bold: true, fontSize: 12, fontFace: "Calibri", color: TXT, underline: { style: "sng" } as any });
  if (productImg) {
    slide.addImage({ data: productImg, x: mx + 0.2, y: yM + 0.45, w: mw - 0.4, h: midH - 0.9, sizing: { type: "contain", w: mw - 0.4, h: midH - 0.9 } });
  }
  slide.addText(audit.product_name || audit.title || "", { x: mx, y: yM + midH - 0.4, w: mw, h: 0.35, align: "center", fontSize: 11, fontFace: "Calibri", color: TXT });

  // ===== Main Contents header =====
  const yC = yM + midH + 0.1;
  slide.addShape("rect", { x: 0.15, y: yC, w: 2.4, h: 0.35, fill: { color: HEAD }, line: { color: HEAD } });
  slide.addText("Main Contents", { x: 0.15, y: yC, w: 2.4, h: 0.35, align: "center", valign: "middle", bold: true, fontSize: 12, color: "FFFFFF", fontFace: "Calibri" });

  // ===== GeneralOpinion | Paint approval rate | Major Request =====
  const yG = yC + 0.4, gH = 1.5;
  // Label
  slide.addShape("rect", { x: 0.15, y: yG, w: 1.6, h: gH, line: { color: BORDER, pt: 0.75 } });
  slide.addText("GeneralOpinion\n(Special Notes)", { x: 0.15, y: yG, w: 1.6, h: gH, align: "center", valign: "middle", bold: true, fontSize: 12, fontFace: "Calibri", color: TXT });

  // Paint approval rate table
  const ok = Number(audit.mbr_aql_ok ?? 0);
  const ng = Number(audit.mbr_aql_ng ?? 0);
  const total = Number(audit.mbr_aql_total ?? (ok + ng));
  const rate = total > 0 ? Math.round((ok / total) * 100) : 0;
  const paintRows: any[] = [
    [
      { text: "Paint approval rate:", options: { colspan: 5, bold: true, align: "left", fontSize: 10, fill: { color: LBL } } },
    ],
    [
      { text: "Inspection", options: { bold: true, align: "center", fontSize: 9, fill: { color: LBL } } },
      { text: "Total Paint", options: { bold: true, align: "center", fontSize: 9, fill: { color: LBL } } },
      { text: "OK", options: { bold: true, align: "center", fontSize: 9, fill: { color: LBL } } },
      { text: "NG", options: { bold: true, align: "center", fontSize: 9, fill: { color: LBL } } },
      { text: "% Rate", options: { bold: true, align: "center", fontSize: 9, fill: { color: LBL } } },
    ],
    [
      { text: "MBR AQL", options: { bold: true, align: "center", fontSize: 10 } },
      { text: String(total || "-"), options: { align: "center", fontSize: 10 } },
      { text: String(ok || "-"), options: { align: "center", fontSize: 10 } },
      { text: String(ng || "-"), options: { align: "center", fontSize: 10, color: MOBIS_COLORS.ng, bold: true } },
      { text: total > 0 ? `${rate}%` : "-", options: { align: "center", fontSize: 10, color: HEAD, bold: true } },
    ],
  ];
  slide.addTable(paintRows, { x: 1.8, y: yG, w: 4.45, colW: [1.1, 0.95, 0.75, 0.75, 0.9], border: { pt: 0.75, color: BORDER }, fontFace: "Calibri" });

  // Major Request
  slide.addShape("rect", { x: 6.3, y: yG, w: 1.55, h: gH, line: { color: BORDER, pt: 0.75 } });
  slide.addText("Major\nRequest of\nImprovement", { x: 6.3, y: yG, w: 1.55, h: gH, align: "center", valign: "middle", bold: true, fontSize: 12, fontFace: "Calibri", color: TXT });
  const reqs: string[] = Array.isArray(audit.major_requests) ? audit.major_requests.filter(Boolean) : [];
  const reqRows: any[] = [];
  const maxReqs = 4;
  for (let i = 0; i < maxReqs; i++) {
    reqRows.push([{ text: reqs[i] ? `${i + 1}. ${reqs[i]}` : "", options: { fontSize: 10, valign: "middle", color: TXT } }]);
  }
  slide.addTable(reqRows, { x: 7.9, y: yG, w: 5.28, colW: [5.28], rowH: gH / maxReqs, border: { pt: 0.75, color: BORDER }, fontFace: "Calibri" });

  // ===== Classification / Problem Status / Conclusion =====
  const yB = yG + gH + 0.05;
  const bH = 6.9 - yB; // fit até y~6.9
  // Classification block
  const cW = 5.5;
  const openN = ncs.filter((n) => (n.status || "open") === "open").length;
  const partialN = ncs.filter((n) => ["in_progress", "partial"].includes(n.status)).length;
  const doneN = ncs.filter((n) => n.status === "done").length;
  const totN = ncs.length;
  const pct = (n: number) => totN > 0 ? `${((n / totN) * 100).toFixed(2)}%` : "0%";

  const clsRows: any[] = [
    [
      { text: "Classification", options: { bold: true, align: "center", fill: { color: LBL }, fontSize: 10, rowspan: 1 } },
      { text: "Total", options: { bold: true, align: "center", fill: { color: LBL }, fontSize: 10 } },
      { text: "Problem Status", options: { bold: true, align: "center", fill: { color: LBL }, fontSize: 10, colspan: 3 } },
      { text: "", options: {} },
      { text: "", options: {} },
    ],
    [
      { text: "", options: { fill: { color: LBL } } },
      { text: "", options: { fill: { color: LBL } } },
      { text: "Open", options: { bold: true, align: "center", fill: { color: "C00000" }, color: "FFFFFF", fontSize: 10 } },
      { text: "Partial", options: { bold: true, align: "center", fill: { color: "ED7D31" }, color: "FFFFFF", fontSize: 10 } },
      { text: "Done", options: { bold: true, align: "center", fill: { color: "70AD47" }, color: "FFFFFF", fontSize: 10 } },
    ],
    [
      { text: "Qty", options: { bold: true, align: "center", fill: { color: LBL }, fontSize: 10 } },
      { text: String(totN), options: { align: "center", fontSize: 10 } },
      { text: String(openN), options: { align: "center", fontSize: 10 } },
      { text: String(partialN), options: { align: "center", fontSize: 10 } },
      { text: String(doneN), options: { align: "center", fontSize: 10 } },
    ],
    [
      { text: "%", options: { bold: true, align: "center", fill: { color: LBL }, fontSize: 10 } },
      { text: totN > 0 ? "100%" : "0%", options: { align: "center", fontSize: 10 } },
      { text: pct(openN), options: { align: "center", fontSize: 10 } },
      { text: pct(partialN), options: { align: "center", fontSize: 10 } },
      { text: pct(doneN), options: { align: "center", fontSize: 10 } },
    ],
  ];
  slide.addTable(clsRows, { x: 0.15, y: yB, w: cW, colW: [1.1, 1.0, 1.13, 1.13, 1.14], rowH: bH / 4, border: { pt: 0.75, color: BORDER }, fontFace: "Calibri" });

  // Conclusion
  const conclX = 0.15 + cW + 0.1;
  const conclW = 13.18 - conclX;
  slide.addShape("rect", { x: conclX, y: yB, w: conclW, h: 0.35, fill: { color: LBL }, line: { color: BORDER, pt: 0.75 } });
  slide.addText("Conclusion", { x: conclX, y: yB, w: conclW, h: 0.35, align: "center", valign: "middle", bold: true, fontSize: 12, fontFace: "Calibri", color: TXT });
  slide.addShape("rect", { x: conclX, y: yB + 0.35, w: conclW, h: bH - 0.35, line: { color: BORDER, pt: 0.75 } });
  slide.addText(audit.conclusion || "-", {
    x: conclX + 0.1, y: yB + 0.45, w: conclW - 0.2, h: bH - 0.55, fontSize: 10, fontFace: "Calibri", color: TXT, valign: "top",
  });
}

/** Slides 2..N: General Issues list, max 4 NCs per slide */
function addIssuesSlides(pptx: pptxgen, audit: Audit, ncs: NC[], logoData: string | null, pageStart: number) {
  const perSlide = 4;
  const total = Math.ceil(ncs.length / perSlide) || 1;
  for (let p = 0; p < total; p++) {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    addChrome(slide, audit, logoData, `${pageStart + p}`);

    slide.addText("GENERAL ISSUES", {
      x: 0.4, y: 0.75, w: 8, h: 0.5, fontSize: 22, bold: true, color: MOBIS_COLORS.primary, fontFace: "Calibri",
    });
    slide.addText(`Page ${p + 1}/${total}`, {
      x: 10.5, y: 0.85, w: 2.5, h: 0.3, fontSize: 10, color: MOBIS_COLORS.gray, align: "right", fontFace: "Calibri",
    });

    // Table header
    const cols = [
      { text: "No", opts: { bold: true, color: "FFFFFF", fill: { color: MOBIS_COLORS.primary }, fontSize: 10, align: "center" as const, valign: "middle" as const } },
      { text: "Category", opts: { bold: true, color: "FFFFFF", fill: { color: MOBIS_COLORS.primary }, fontSize: 10, align: "center" as const, valign: "middle" as const } },
      { text: "Issue description", opts: { bold: true, color: "FFFFFF", fill: { color: MOBIS_COLORS.primary }, fontSize: 10, align: "center" as const, valign: "middle" as const } },
      { text: "Counter measure", opts: { bold: true, color: "FFFFFF", fill: { color: MOBIS_COLORS.primary }, fontSize: 10, align: "center" as const, valign: "middle" as const } },
      { text: "In charge", opts: { bold: true, color: "FFFFFF", fill: { color: MOBIS_COLORS.primary }, fontSize: 10, align: "center" as const, valign: "middle" as const } },
      { text: "Due date", opts: { bold: true, color: "FFFFFF", fill: { color: MOBIS_COLORS.primary }, fontSize: 10, align: "center" as const, valign: "middle" as const } },
      { text: "Status", opts: { bold: true, color: "FFFFFF", fill: { color: MOBIS_COLORS.primary }, fontSize: 10, align: "center" as const, valign: "middle" as const } },
    ];

    const rows: any[] = [cols];
    const chunk = ncs.slice(p * perSlide, p * perSlide + perSlide);
    for (const nc of chunk) {
      const statusColor = nc.status === "done" ? MOBIS_COLORS.ok : nc.status === "overdue" ? MOBIS_COLORS.ng : MOBIS_COLORS.gray;
      const statusLabel = nc.status === "done" ? "Done" : nc.status === "overdue" ? "Overdue" : "Open";
      rows.push([
        { text: String(nc.seq_number ?? "-"), options: { fontSize: 11, align: "center", valign: "middle", color: MOBIS_COLORS.dark } },
        { text: nc.issue_category || "-", options: { fontSize: 10, valign: "middle", color: MOBIS_COLORS.dark } },
        { text: nc.problem_description || "-", options: { fontSize: 10, valign: "middle", color: MOBIS_COLORS.dark } },
        { text: nc.counter_measure || "-", options: { fontSize: 10, valign: "middle", color: MOBIS_COLORS.dark } },
        { text: nc.in_charge || "-", options: { fontSize: 10, align: "center", valign: "middle", color: MOBIS_COLORS.dark } },
        { text: fmtDate(nc.due_date), options: { fontSize: 10, align: "center", valign: "middle", color: MOBIS_COLORS.dark } },
        { text: statusLabel, options: { fontSize: 10, align: "center", valign: "middle", bold: true, color: statusColor } },
      ]);
    }

    slide.addTable(rows, {
      x: 0.4, y: 1.4, w: 12.5,
      colW: [0.6, 1.7, 3.6, 3.2, 1.4, 1.1, 0.9],
      rowH: 0.6,
      border: { pt: 1, color: MOBIS_COLORS.border },
      fontFace: "Calibri",
    });
  }
  return total;
}

/** One "Improvement Case" per NC (Before/After) */
async function addImprovementSlides(pptx: pptxgen, audit: Audit, ncs: NC[], logoData: string | null, pageStart: number) {
  let p = pageStart;
  for (const nc of ncs) {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    addChrome(slide, audit, logoData, `${p++}`);

    slide.addText("IMPROVEMENT CASE", { x: 0.4, y: 0.75, w: 8, h: 0.5, fontSize: 22, bold: true, color: MOBIS_COLORS.primary, fontFace: "Calibri" });
    slide.addText(`NC #${nc.seq_number} — ${nc.issue_category || ""}`, {
      x: 0.4, y: 1.25, w: 12.5, h: 0.4, fontSize: 14, bold: true, color: MOBIS_COLORS.dark, fontFace: "Calibri",
    });

    // Two panels
    const y0 = 1.85;
    // Before
    slide.addShape("rect", { x: 0.4, y: y0, w: 6.15, h: 0.5, fill: { color: MOBIS_COLORS.ng }, line: { color: MOBIS_COLORS.ng } });
    slide.addText("BEFORE", { x: 0.4, y: y0, w: 6.15, h: 0.5, fontSize: 14, bold: true, color: "FFFFFF", align: "center", valign: "middle", fontFace: "Calibri" });
    const beforeData = await storagePathToData(nc.before_photo_url);
    if (beforeData) {
      slide.addImage({ data: beforeData, x: 0.4, y: y0 + 0.5, w: 6.15, h: 3.2, sizing: { type: "contain", w: 6.15, h: 3.2 } });
    } else {
      slide.addShape("rect", { x: 0.4, y: y0 + 0.5, w: 6.15, h: 3.2, fill: { color: MOBIS_COLORS.light }, line: { color: MOBIS_COLORS.border } });
      slide.addText("No before photo", { x: 0.4, y: y0 + 2.0, w: 6.15, h: 0.4, align: "center", fontSize: 12, color: MOBIS_COLORS.gray });
    }

    // After
    slide.addShape("rect", { x: 6.75, y: y0, w: 6.15, h: 0.5, fill: { color: MOBIS_COLORS.ok }, line: { color: MOBIS_COLORS.ok } });
    slide.addText("AFTER", { x: 6.75, y: y0, w: 6.15, h: 0.5, fontSize: 14, bold: true, color: "FFFFFF", align: "center", valign: "middle", fontFace: "Calibri" });
    const afterUrl = nc.responses?.[0]?.after_photo_url;
    const afterData = await storagePathToData(afterUrl);
    if (afterData) {
      slide.addImage({ data: afterData, x: 6.75, y: y0 + 0.5, w: 6.15, h: 3.2, sizing: { type: "contain", w: 6.15, h: 3.2 } });
    } else {
      slide.addShape("rect", { x: 6.75, y: y0 + 0.5, w: 6.15, h: 3.2, fill: { color: MOBIS_COLORS.light }, line: { color: MOBIS_COLORS.border } });
      slide.addText("Awaiting supplier evidence", { x: 6.75, y: y0 + 2.0, w: 6.15, h: 0.4, align: "center", fontSize: 12, color: MOBIS_COLORS.gray });
    }

    // Text boxes below
    const y1 = y0 + 3.9;
    slide.addText("Problem", { x: 0.4, y: y1, w: 6.15, h: 0.3, fontSize: 10, bold: true, color: MOBIS_COLORS.gray, fontFace: "Calibri" });
    slide.addText(nc.problem_description || "-", {
      x: 0.4, y: y1 + 0.3, w: 6.15, h: 1.1, fontSize: 11, color: MOBIS_COLORS.dark, fontFace: "Calibri", valign: "top",
      fill: { color: MOBIS_COLORS.light },
    });

    slide.addText("Counter measure", { x: 6.75, y: y1, w: 6.15, h: 0.3, fontSize: 10, bold: true, color: MOBIS_COLORS.gray, fontFace: "Calibri" });
    const cm = nc.responses?.[0]?.corrective_measure_text || nc.counter_measure || "-";
    slide.addText(cm, {
      x: 6.75, y: y1 + 0.3, w: 6.15, h: 1.1, fontSize: 11, color: MOBIS_COLORS.dark, fontFace: "Calibri", valign: "top",
      fill: { color: MOBIS_COLORS.light },
    });

    // Footer info line
    slide.addText(
      `In charge: ${nc.in_charge || "-"}   |   Due: ${fmtDate(nc.due_date)}   |   Status: ${nc.status || "open"}`,
      { x: 0.4, y: 6.7, w: 12.5, h: 0.3, fontSize: 10, color: MOBIS_COLORS.gray, fontFace: "Calibri", align: "center" }
    );
  }
  return p - pageStart;
}

export async function exportAuditoriaPPTX(audit: Audit, ncs: NC[]) {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
  pptx.title = `${audit.code || "Audit"} — ${audit.supplier_name || ""}`;
  pptx.company = "Hyundai Mobis Brasil";

  const logoData = await assetToData(logoUrl);
  const productImg = await storagePathToData(audit.product_image_url);

  addCoverSlide(pptx, audit, ncs, logoData, productImg);
  const issuePages = addIssuesSlides(pptx, audit, ncs, logoData, 2);
  await addImprovementSlides(pptx, audit, ncs, logoData, 2 + issuePages);

  const dt = new Date(audit.audit_date_start ? audit.audit_date_start + "T12:00:00" : Date.now());
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear();
  const safeSupplier = (audit.supplier_name || "Supplier").replace(/[^a-z0-9]+/gi, "_");
  const fileName = `${audit.code || "AUD"}_${safeSupplier}_${dd}${mm}${yyyy}.pptx`;

  await pptx.writeFile({ fileName });
  return fileName;
}
