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

/** Slide 1: Supplier Visit Report cover */
function addCoverSlide(pptx: pptxgen, audit: Audit, logoData: string | null, productImg: string | null) {
  const slide = pptx.addSlide();
  slide.background = { color: "FFFFFF" };
  addChrome(slide, audit, logoData, "1");

  // Big navy strip left
  slide.addShape("rect", { x: 0, y: 0.6, w: 4.4, h: 6.8, fill: { color: MOBIS_COLORS.primary }, line: { color: MOBIS_COLORS.primary } });
  slide.addText("SUPPLIER", { x: 0.4, y: 1.2, w: 4, h: 0.6, fontSize: 32, bold: true, color: "FFFFFF", fontFace: "Calibri" });
  slide.addText("VISIT", { x: 0.4, y: 1.75, w: 4, h: 0.6, fontSize: 32, bold: true, color: "FFFFFF", fontFace: "Calibri" });
  slide.addText("REPORT", { x: 0.4, y: 2.3, w: 4, h: 0.6, fontSize: 32, bold: true, color: MOBIS_COLORS.accent, fontFace: "Calibri" });
  slide.addShape("rect", { x: 0.4, y: 2.95, w: 1.4, h: 0.05, fill: { color: MOBIS_COLORS.accent }, line: { color: MOBIS_COLORS.accent } });

  const meta = [
    ["Supplier", audit.supplier_name || "-"],
    ["Place", audit.place || "-"],
    ["Audit type", (audit.type || "").toString().toUpperCase()],
    ["Date", `${fmtDate(audit.audit_date_start)}${audit.audit_date_end && audit.audit_date_end !== audit.audit_date_start ? " → " + fmtDate(audit.audit_date_end) : ""}`],
    ["Auditor", audit.auditor_name || "-"],
    ["PIC", audit.pic_name || "-"],
  ];
  meta.forEach(([k, v], i) => {
    slide.addText(k.toUpperCase(), { x: 0.4, y: 3.4 + i * 0.5, w: 3.9, h: 0.2, fontSize: 9, color: "9CA3AF", fontFace: "Calibri", bold: true });
    slide.addText(String(v), { x: 0.4, y: 3.6 + i * 0.5, w: 3.9, h: 0.28, fontSize: 12, color: "FFFFFF", fontFace: "Calibri", bold: true });
  });

  // Right side title + product photo
  slide.addText(audit.title || "Audit Report", {
    x: 4.8, y: 1.0, w: 8.2, h: 1.2, fontSize: 30, bold: true, color: MOBIS_COLORS.dark, fontFace: "Calibri",
  });
  if (audit.purpose && audit.purpose.length) {
    slide.addText(`Purpose: ${audit.purpose.join(" · ")}`, {
      x: 4.8, y: 2.15, w: 8.2, h: 0.4, fontSize: 12, color: MOBIS_COLORS.gray, fontFace: "Calibri", italic: true,
    });
  }
  if (audit.process && audit.process.length) {
    slide.addText(`Process: ${audit.process.join(", ")}`, {
      x: 4.8, y: 2.5, w: 8.2, h: 0.4, fontSize: 12, color: MOBIS_COLORS.gray, fontFace: "Calibri",
    });
  }

  if (productImg) {
    slide.addImage({ data: productImg, x: 5.2, y: 3.1, w: 7.4, h: 4.0, sizing: { type: "contain", w: 7.4, h: 4.0 } });
  } else {
    slide.addShape("rect", { x: 5.2, y: 3.1, w: 7.4, h: 4.0, fill: { color: MOBIS_COLORS.light }, line: { color: MOBIS_COLORS.border } });
    slide.addText("Product image", { x: 5.2, y: 4.9, w: 7.4, h: 0.4, align: "center", fontSize: 14, color: MOBIS_COLORS.gray });
  }
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

  addCoverSlide(pptx, audit, logoData, productImg);
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
