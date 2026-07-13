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

const MOBIS_REPORT_W = 10.84;
const MOBIS_REPORT_H = 7.7;

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
  slide.addShape("rect", { x: 0, y: 0, w: MOBIS_REPORT_W, h: 0.05, fill: { color: MOBIS_COLORS.accent }, line: { color: MOBIS_COLORS.accent } });
  // Header band
  slide.addShape("rect", { x: 0, y: 0.05, w: MOBIS_REPORT_W, h: 0.55, fill: { color: MOBIS_COLORS.primary }, line: { color: MOBIS_COLORS.primary } });
  if (logoData) {
    slide.addImage({ data: logoData, x: 0.25, y: 0.12, w: 1.0, h: 0.4 });
  }
  slide.addText(`HYUNDAI MOBIS — Supplier Quality Audit`, {
    x: 1.4, y: 0.1, w: 5.8, h: 0.45, fontSize: 12, bold: true, color: "FFFFFF", fontFace: "Calibri", valign: "middle",
  });
  slide.addText(`${audit.code || ""}  |  ${audit.supplier_name || ""}`, {
    x: 7.3, y: 0.1, w: 3.3, h: 0.45, fontSize: 10, color: "FFFFFF", align: "right", valign: "middle", fontFace: "Calibri",
  });
  // Footer
  slide.addShape("rect", { x: 0, y: MOBIS_REPORT_H - 0.1, w: MOBIS_REPORT_W, h: 0.1, fill: { color: MOBIS_COLORS.primary }, line: { color: MOBIS_COLORS.primary } });
  slide.addText(pageLabel, {
    x: 8.7, y: MOBIS_REPORT_H - 0.45, w: 1.9, h: 0.3, fontSize: 9, color: MOBIS_COLORS.gray, align: "right", fontFace: "Calibri",
  });
  slide.addText("Confidential — Hyundai Mobis Brasil", {
    x: 0.25, y: MOBIS_REPORT_H - 0.45, w: 6.5, h: 0.3, fontSize: 9, color: MOBIS_COLORS.gray, fontFace: "Calibri",
  });
}

/** Slide 1: Supplier Visit Report cover — replica do template Mobis */
function addCoverSlide(pptx: pptxgen, audit: Audit, ncs: NC[], logoData: string | null, productImg: string | null) {
  const slide = pptx.addSlide();
  slide.background = { color: "FFFFFF" };

  const HEAD = "1F4E79";
  const LBL = "DCE6F1";
  const BORDER = "B7B7B7";
  const TXT = "1F1F1F";
  const px = (value: number) => value / 100;
  const rect = (x: number, y: number, w: number, h: number, fill?: string, dash = false) => {
    slide.addShape("rect", {
      x: px(x), y: px(y), w: px(w), h: px(h),
      fill: fill ? { color: fill } : undefined,
      line: { color: BORDER, pt: 0.55, dashType: dash ? "dash" : undefined as any },
    });
  };
  const text = (value: string, x: number, y: number, w: number, h: number, opts: any = {}) => {
    slide.addText(value, {
      x: px(x), y: px(y), w: px(w), h: px(h),
      margin: opts.margin ?? 0.03,
      fontFace: "Calibri",
      fontSize: opts.fontSize ?? 12,
      color: opts.color ?? TXT,
      bold: opts.bold ?? false,
      align: opts.align ?? "left",
      valign: opts.valign ?? "mid",
      breakLine: false,
      fit: "shrink",
      ...opts,
    });
  };
  const cell = (value: string, x: number, y: number, w: number, h: number, opts: any = {}) => {
    rect(x, y, w, h, opts.fill);
    text(value, x + (opts.center ? 0 : 8), y, w - (opts.center ? 0 : 12), h, {
      fontSize: opts.fontSize ?? 11,
      bold: opts.bold,
      align: opts.center ? "center" : "left",
      valign: "mid",
      color: opts.color,
      margin: 0.01,
    });
  };
  const checkbox = (on: boolean) => (on ? "■" : "□");
  const norm = (s: string) => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s/]/g, "");
  const has = (arr: string[], value: string) => arr.some((v) => norm(v) === norm(value));

  // ===== Título + logo =====
  slide.addShape("rect", { x: 0, y: 0, w: px(958), h: px(68), fill: { color: HEAD }, line: { color: HEAD } });
  slide.addShape("rect", { x: px(958), y: 0, w: px(126), h: px(68), fill: { color: "FFFFFF" }, line: { color: "FFFFFF" } });
  text("□", 12, 13, 32, 42, { fontSize: 25, color: "FFFFFF", margin: 0 });
  text("Supplier Visit Report", 56, 10, 540, 50, { fontSize: 26, color: "FFFFFF", margin: 0 });
  if (logoData) slide.addImage({ data: logoData, x: px(957), y: px(8), w: px(118), h: px(50), sizing: { type: "contain", w: px(118), h: px(50) } });

  // ===== Bloco superior de dados (linhas 1-3) =====
  const purpose: string[] = audit.purpose || [];
  const proc: string[] = audit.process || [];
  cell("Description", 0, 75, 125, 36, { fill: LBL, bold: true, center: true, fontSize: 14 });
  cell(audit.title || "-", 125, 75, 657, 36, { fontSize: 12 });
  cell("Purpose", 782, 75, 302, 36, { fill: LBL, bold: true, center: true, fontSize: 15 });
  cell("Supplier", 0, 111, 125, 36, { fill: LBL, bold: true, center: true, fontSize: 15 });
  cell(audit.supplier_name || "-", 125, 111, 179, 36, { fontSize: 12 });
  cell("Place", 304, 111, 76, 36, { fill: LBL, bold: true, center: true, fontSize: 15 });
  cell(audit.place || "-", 380, 111, 167, 36, { fontSize: 12 });
  cell("Date", 547, 111, 73, 36, { fill: LBL, bold: true, center: true, fontSize: 15 });
  const dateStr = `${fmtDate(audit.audit_date_start)}${audit.audit_date_end && audit.audit_date_end !== audit.audit_date_start ? " & " + fmtDate(audit.audit_date_end) : ""}`;
  cell(dateStr, 620, 111, 162, 36, { fontSize: 12 });
  cell(`${checkbox(has(purpose, "T/Out"))}  T/Out     ${checkbox(has(purpose, "TFT"))}  TFT     ${checkbox(has(purpose, "New Car"))}  New Car`, 782, 111, 302, 36, { fontSize: 12 });
  cell("Process", 0, 147, 125, 36, { fill: LBL, bold: true, center: true, fontSize: 15 });
  cell(`${checkbox(has(proc, "Injection"))}  Injection     ${checkbox(has(proc, "Assembly"))}  Assembly     ${checkbox(has(proc, "Paint"))}  Paint     ${checkbox(has(proc, "Other"))}  Other`, 125, 147, 422, 36, { fontSize: 12 });
  cell("PIC", 547, 147, 73, 36, { fill: LBL, bold: true, center: true, fontSize: 15 });
  cell(audit.pic_name || "-", 620, 147, 162, 36, { fontSize: 12 });
  cell(`${checkbox(has(purpose, "CM Validation"))}  CM Validation     ${checkbox(has(purpose, "Process Check"))}  Process Check`, 782, 147, 302, 36, { fontSize: 12 });

  // ===== Faixa média: Schedule | Participants | Main Product =====
  cell("Schedule", 0, 188, 418, 35, { fill: LBL, bold: true, center: true, fontSize: 15 });
  cell(audit.schedule_notes || "-", 0, 223, 418, 144, { fontSize: 8, valign: "top" });

  cell("Participants", 418, 188, 365, 35, { fill: LBL, bold: true, center: true, fontSize: 15 });
  cell("Name", 418, 223, 153, 29, { bold: true, center: true, fontSize: 12 });
  cell("Area", 571, 223, 113, 29, { bold: true, center: true, fontSize: 12 });
  cell("Position", 684, 223, 99, 29, { bold: true, center: true, fontSize: 12 });
  const parts = Array.isArray(audit.participants) ? audit.participants : [];
  for (let i = 0; i < 4; i++) {
    const p = parts[i] || {};
    const y = 252 + i * 29;
    cell(p.name || "", 418, y, 153, 29, { center: true, fontSize: 10 });
    cell(p.area || "", 571, y, 113, 29, { center: true, fontSize: 10 });
    cell(p.position || p.role || "", 684, y, 99, 29, { center: true, fontSize: 10 });
  }

  // Main Product
  rect(793, 188, 291, 179, undefined, true);
  text("Main Product", 793, 194, 291, 26, { align: "center", bold: true, fontSize: 12, underline: { style: "sng" } as any });
  if (productImg) {
    slide.addImage({ data: productImg, x: px(811), y: px(225), w: px(255), h: px(92), sizing: { type: "contain", w: px(255), h: px(92) } });
  }
  text(audit.product_name || audit.title || "", 805, 320, 267, 26, { align: "center", fontSize: 11 });

  // ===== Main Contents header =====
  slide.addShape("roundRect", { x: 0, y: px(367), w: px(218), h: px(39), rectRadius: 0.03, fill: { color: HEAD }, line: { color: BORDER, pt: 0.55 } } as any);
  text("Main Contents", 0, 370, 218, 28, { align: "center", bold: true, fontSize: 13, color: "FFFFFF" });

  // ===== GeneralOpinion | Paint approval rate | Major Request =====
  cell("GeneralOpinion\n(Special Notes)", 0, 406, 158, 164, { fill: LBL, bold: true, center: true, fontSize: 12 });
  rect(158, 406, 340, 164);
  text(`${checkbox(false)} Paint approval rate:`, 170, 416, 230, 20, { bold: true, fontSize: 11 });
  const inspectionTotal = Number(audit.paint_inspection_total ?? audit.mbr_aql_total ?? 0);
  const inspectionOk = Number(audit.paint_inspection_ok ?? audit.mbr_aql_ok ?? 0);
  const inspectionNg = Number(audit.paint_inspection_ng ?? Math.max(inspectionTotal - inspectionOk, 0));
  const inspectionRate = inspectionTotal > 0 ? Math.round((inspectionOk / inspectionTotal) * 100) : 0;
  const ok = Number(audit.mbr_aql_ok ?? 0);
  const ng = Number(audit.mbr_aql_ng ?? 0);
  const total = Number(audit.mbr_aql_total ?? (ok + ng));
  const rate = total > 0 ? Math.round((ok / total) * 100) : 0;
  const supplierLabel = String(audit.paint_inspection_label || audit.supplier_code || audit.supplier_name || "Supplier").slice(0, 12);
  const cols = [183, 256, 314, 370, 426];
  [256, 314, 370, 426].forEach((x) => slide.addShape("line", { x: px(x), y: px(440), w: 0, h: px(113), line: { color: BORDER, pt: 0.55 } }));
  [480, 516].forEach((y) => slide.addShape("line", { x: px(163), y: px(y), w: px(325), h: 0, line: { color: BORDER, pt: 1 } }));
  text("Inspection", 178, 454, 70, 18, { align: "center", bold: true, fontSize: 8 });
  text("Total\nPaint", 257, 445, 55, 30, { align: "center", bold: true, fontSize: 8 });
  text("OK", 316, 454, 50, 18, { align: "center", bold: true, fontSize: 8 });
  text("NG", 372, 454, 50, 18, { align: "center", bold: true, fontSize: 8 });
  text("% Rate", 428, 454, 55, 18, { align: "center", bold: true, fontSize: 8 });
  text(supplierLabel, 180, 488, 64, 18, { align: "center", bold: true, fontSize: 9 });
  text(String(inspectionTotal || "-"), 262, 488, 42, 18, { align: "center", fontSize: 10 });
  text(String(inspectionOk || "-"), 318, 488, 42, 18, { align: "center", fontSize: 10 });
  text(String(inspectionNg || "-"), 374, 488, 42, 18, { align: "center", fontSize: 10, bold: true, color: MOBIS_COLORS.ng });
  text(inspectionTotal ? `${inspectionRate}%` : "-", 430, 488, 48, 18, { align: "center", fontSize: 10, bold: true, color: "003399" });
  text("MBR AQL", 180, 525, 64, 18, { align: "center", bold: true, fontSize: 9 });
  text(String(total || "-"), 262, 525, 42, 18, { align: "center", fontSize: 10 });
  text(String(ok || "-"), 318, 525, 42, 18, { align: "center", fontSize: 10 });
  text(String(ng || "-"), 374, 525, 42, 18, { align: "center", fontSize: 10, bold: true, color: MOBIS_COLORS.ng });
  text(total > 0 ? `${rate}%` : "-", 430, 525, 48, 18, { align: "center", fontSize: 10, bold: true, color: "003399" });

  // Major Request
  cell("Major\nRequest of\nImprovement", 498, 406, 137, 164, { fill: LBL, bold: true, center: true, fontSize: 12 });
  const reqs: string[] = Array.isArray(audit.major_requests) ? audit.major_requests.filter(Boolean) : [];
  for (let i = 0; i < 4; i++) {
    cell(reqs[i] ? `${i + 1}.  ${reqs[i]}` : "", 635, 406 + i * 41, 449, 41, { fontSize: 12 });
  }

  // ===== Classification / Problem Status / Conclusion =====
  const openN = ncs.filter((n) => (n.status || "open") === "open").length;
  const partialN = ncs.filter((n) => ["in_progress", "partial"].includes(n.status)).length;
  const doneN = ncs.filter((n) => n.status === "done").length;
  const totN = ncs.length;
  const pct = (n: number) => totN > 0 ? `${((n / totN) * 100).toFixed(2)}%` : "0%";
  cell("Classificat\nion", 0, 590, 91, 83, { fill: "F3F6F8", center: true, fontSize: 12 });
  cell("Problem Status", 91, 590, 407, 41, { fill: "F3F6F8", center: true, fontSize: 13 });
  cell("Total", 91, 631, 84, 42, { fill: "F3F6F8", center: true, fontSize: 12 });
  cell("Status", 175, 631, 323, 42, { fill: "F3F6F8", center: true, fontSize: 12 });
  cell("Qty", 0, 673, 91, 31, { center: true, fontSize: 12 });
  cell(String(totN), 91, 673, 84, 31, { center: true, fontSize: 12 });
  cell("Open", 175, 673, 103, 31, { fill: "D00000", center: true, fontSize: 12, color: "FFFFFF" });
  cell("Partial", 278, 673, 115, 31, { fill: "F28C18", center: true, fontSize: 12, color: "FFFFFF" });
  cell("Done", 393, 673, 105, 31, { fill: "00A84F", center: true, fontSize: 12, color: "FFFFFF" });
  cell("%", 0, 704, 91, 54, { center: true, fontSize: 12 });
  cell(totN > 0 ? "100%" : "0%", 91, 704, 84, 54, { center: true, fontSize: 12 });
  cell(pct(openN), 175, 704, 103, 54, { center: true, fontSize: 12 });
  cell(pct(partialN), 278, 704, 115, 54, { center: true, fontSize: 12 });
  cell(pct(doneN), 393, 704, 105, 54, { center: true, fontSize: 12 });

  cell("Conclusion", 503, 590, 581, 38, { fill: "F3F6F8", center: true, fontSize: 13 });
  cell(audit.conclusion || "-", 503, 628, 581, 130, { fontSize: 12, valign: "top" });
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
