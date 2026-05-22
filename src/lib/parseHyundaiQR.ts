export interface HyundaiQRData {
  vendorCode: string;
  partNumber: string;
  supplierCode: string;
  lotNumber: string;
  /** ALC / Sequence code (S-prefix in HKMC standard, fallback: PN suffix) */
  alc?: string;
  raw: string;
  partial?: boolean; // true when only lot was captured (PN missing)
}

/** Extract ALC candidate from a Hyundai PN — usually the last 3 chars (e.g., "NNB", "T5G", "MDG"). */
export function extractAlcFromPartNumber(pn: string): string {
  if (!pn) return "";
  const norm = pn.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (norm.length < 9) return "";
  const suffix = norm.slice(-3);
  return /[A-Z]/.test(suffix) ? suffix : "";
}

// Matches the linear lot/serial barcode at the bottom of Hyundai/Kia/Mobis labels.
// Examples: HU94C5ZR200986T, HU93A1ZR123456T
export const HYUNDAI_LOT_REGEX = /\b(HU\d{2}[A-Z0-9]{6,16}T)\b/i;

// Matches typical Hyundai Mobis part-number patterns (e.g. 96160R1BF0MDG, 84852-R1520, 84852R1520NNB,
// 865B4-BX700, 866W7R1700). The first 5 chars are alphanumeric but must contain ≥3 digits.
export const HYUNDAI_PN_REGEX = /(?:^|[^A-Z0-9])([A-Z0-9]{5}[-_\s.]?[A-Z0-9]{4,10})(?=$|[^A-Z0-9])/gi;

// Supplier box labels often decode as plain text: "86552R1600 0096AWEZ2704260069".
// These are not QR/DataMatrix payloads, but still contain a valid PN and lot.
export const SUPPLIER_BOX_LOT_REGEX = /(?:^|[^A-Z0-9])(\d{4}[A-Z]{2,}[A-Z0-9]{8,20})(?=$|[^A-Z0-9])/i;
export const SUPPLIER_LOG_LOT_REGEX = /(?:^|[^A-Z0-9])(\d{4}[-_\s.]?LOG[-_\s.]?\d{2,6})(?=$|[^A-Z0-9])/i;

const normalizeCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");

const normalizeHyundaiPayload = (value: string) =>
  value
    .replace(/\\x1D|\\u001D|%1D|␝/gi, "\x1d")
    .replace(/\\x1E|\\u001E|%1E|␞/gi, "\x1e")
    .replace(/\\x04|\\u0004|%04|␄/gi, "\x04")
    .replace(/(?:<|\[|\{)\s*gs\s*(?:>|\]|\})/gi, "\x1d")
    .replace(/(?:<|\[|\{)\s*rs\s*(?:>|\]|\})/gi, "\x1e")
    .replace(/(?:<|\[|\{)\s*eot\s*(?:>|\]|\})/gi, "\x04")
    .replace(/\r\n|\r|\n|\t/g, "\x1d");

const extractPartNumber = (text: string) => {
  const candidates = [...text.toUpperCase().matchAll(HYUNDAI_PN_REGEX)]
    .map((match) => normalizeCode(match[1]))
    .filter((candidate) => {
      const prefix = candidate.slice(0, 5);
      const suffix = candidate.slice(5);
      const digitCount = (prefix.match(/\d/g) || []).length;
      return (
        candidate.length >= 9 &&
        candidate.length <= 15 &&
        digitCount >= 3 &&
        /[A-Z]/.test(suffix)
      );
    });

  return candidates[0] || "";
};

const extractSupplierLot = (text: string) => {
  const boxLot = text.match(SUPPLIER_BOX_LOT_REGEX)?.[1];
  if (boxLot) return normalizeCode(boxLot);

  const logLot = text.match(SUPPLIER_LOG_LOT_REGEX)?.[1];
  return logLot ? normalizeCode(logLot) : "";
};

export function parseHyundaiQR(raw: string): HyundaiQRData | null {
  try {
    const trimmed = (raw || "").trim();
    if (!trimmed) return null;

    const GS = "\x1d";
    // USB scanners can emit HKMC separators as ASCII controls, text tokens
    // (<gs>, [GS], \x1D), tabs/newlines, or sometimes strip them entirely.
    const normalized = normalizeHyundaiPayload(trimmed);

    const parts = normalized.split(GS);
    let vendorCode = "";
    let partNumber = "";
    let supplierCode = "";
    let lotNumber = "";
    let sequenceCode = "";

    parts.forEach((segment) => {
      const clean = segment.replace(/[\x1e\x04\[\)>]/g, "").trim();
      if (clean.startsWith("V") && !vendorCode) vendorCode = clean.slice(1);
      else if (clean.startsWith("P") && !partNumber) partNumber = clean.slice(1);
      else if (clean.startsWith("S") && !sequenceCode) sequenceCode = clean.slice(1);
      else if (clean.startsWith("T") && !lotNumber) lotNumber = clean.slice(1);
    });

    if (partNumber) {
      const alc = sequenceCode || extractAlcFromPartNumber(partNumber);
      return { vendorCode, partNumber, supplierCode, lotNumber, alc, raw: trimmed };
    }

    // Fallback for keyboard-wedge readers that send bare tokens (GS/RS/EOT) or
    // a fully compact string, e.g. [)>RS06GSVBZWCGSP84705...GSSLL43GST260...
    const compact = normalizeCode(normalized);
    const compactTokens = compact.split(/GS|RS|EOT/i).filter(Boolean);
    compactTokens.forEach((segment) => {
      if (segment.startsWith("V") && !vendorCode) vendorCode = segment.slice(1);
      else if (segment.startsWith("P") && !partNumber) partNumber = segment.slice(1);
      else if (segment.startsWith("S") && !sequenceCode) sequenceCode = segment.slice(1);
      else if (segment.startsWith("T") && !lotNumber) lotNumber = segment.slice(1);
    });
    if (partNumber) {
      const alc = sequenceCode || extractAlcFromPartNumber(partNumber);
      return { vendorCode, partNumber, supplierCode, lotNumber, alc, raw: trimmed };
    }

    const compactMatch = compact.match(/(?:^|06)V([A-Z0-9]{4})P([A-Z0-9]{9,15})S([A-Z0-9]{0,8})T(\d{6}[A-Z0-9]{2,50})/i);
    if (compactMatch) {
      const [, compactVendor, compactPart, compactSequence, compactLot] = compactMatch;
      return {
        vendorCode: compactVendor,
        partNumber: compactPart,
        supplierCode: "",
        lotNumber: compactLot.replace(/(?:GS|RS|EOT)+$/i, ""),
        alc: compactSequence || extractAlcFromPartNumber(compactPart),
        raw: trimmed,
      };
    }

    // Fallback 1: scanned the linear lot barcode only (HU…T) — accept as partial scan.
    const lotMatch = trimmed.match(HYUNDAI_LOT_REGEX);
    if (lotMatch) {
      return {
        vendorCode: "",
        partNumber: "",
        supplierCode: "",
        lotNumber: lotMatch[1].toUpperCase(),
        alc: "",
        raw: trimmed,
        partial: true,
      };
    }

    // Fallback 2: supplier box/free-text content containing a PN-shaped token.
    const fallbackPartNumber = extractPartNumber(trimmed);
    if (fallbackPartNumber) {
      return {
        vendorCode: "",
        partNumber: fallbackPartNumber,
        supplierCode: "",
        lotNumber: extractSupplierLot(trimmed),
        alc: extractAlcFromPartNumber(fallbackPartNumber),
        raw: trimmed,
      };
    }

    return null;
  } catch {
    return null;
  }
}
