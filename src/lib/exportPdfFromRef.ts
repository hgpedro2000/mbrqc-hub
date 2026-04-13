import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface ExportPdfOptions {
  orientation?: "portrait" | "landscape";
  /** Base width in mm (default 210 for portrait, 297 for landscape) */
  pageWidthMm?: number;
  marginMm?: number;
  /** Background color for html2canvas (default #ffffff) */
  backgroundColor?: string;
  /** Simulated window width for consistent rendering (default 1200) */
  windowWidth?: number;
}

/**
 * Captures a DOM element via html2canvas and exports it as a single-page PDF.
 * Configured to preserve text spacing and layout fidelity.
 */
export async function captureElementToCanvas(
  el: HTMLElement,
  opts: Pick<ExportPdfOptions, "backgroundColor" | "windowWidth"> = {}
): Promise<HTMLCanvasElement> {
  // Wait for fonts
  if (typeof document !== "undefined" && "fonts" in document) {
    await (document as Document & { fonts: FontFaceSet }).fonts.ready;
  }
  await new Promise((r) => setTimeout(r, 120));

  return html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: opts.backgroundColor ?? "#ffffff",
    windowWidth: opts.windowWidth ?? 1200,
    letterRendering: true,
    scrollX: 0,
    scrollY: -window.scrollY,
  } as any);
}

/**
 * Full PDF export: hides [data-export-btn] elements, expands scroll containers,
 * captures, generates PDF and triggers download.
 */
export async function exportPdfFromRef(
  el: HTMLElement,
  fileName: string,
  opts: ExportPdfOptions = {}
) {
  const {
    orientation = "portrait",
    marginMm = 8,
    backgroundColor = "#ffffff",
    windowWidth = 1200,
  } = opts;

  const pageWidthMm = opts.pageWidthMm ?? (orientation === "landscape" ? 297 : 210);

  // Hide export buttons
  const exportBtns = el.querySelectorAll("[data-export-btn]");
  exportBtns.forEach((btn) => ((btn as HTMLElement).style.display = "none"));

  // Expand scroll containers
  const parent = el.closest("[class*='overflow-y-auto']") as HTMLElement | null;
  const prevMaxH = parent?.style.maxHeight;
  const prevOverflow = parent?.style.overflow;
  if (parent) {
    parent.style.maxHeight = "none";
    parent.style.overflow = "visible";
  }

  try {
    const canvas = await captureElementToCanvas(el, { backgroundColor, windowWidth });

    const imgData = canvas.toDataURL("image/png");
    const contentW = pageWidthMm - marginMm * 2;
    const contentH = (canvas.height * contentW) / canvas.width;
    const pdfH = contentH + marginMm * 2;

    const pdf = new jsPDF({
      orientation,
      unit: "mm",
      format: [pageWidthMm, pdfH],
    });
    pdf.addImage(imgData, "PNG", marginMm, marginMm, contentW, contentH);

    // Force download via anchor
    const blob = pdf.output("blob");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  } finally {
    exportBtns.forEach((btn) => ((btn as HTMLElement).style.display = ""));
    if (parent) {
      parent.style.maxHeight = prevMaxH || "";
      parent.style.overflow = prevOverflow || "";
    }
  }
}
