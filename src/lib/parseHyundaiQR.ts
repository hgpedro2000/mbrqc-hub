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

// Matches typical Hyundai Mobis part-number patterns (e.g. 96160R1BF0MDG, 84852-R1520, 84852R1520NNB)
export const HYUNDAI_PN_REGEX = /(?:^|[^A-Z0-9])(\d{5}[-_\s.]?[A-Z0-9]{4,10})(?=$|[^A-Z0-9])/gi;

// Supplier box labels often decode as plain text: "86552R1600 0096AWEZ2704260069".
// These are not QR/DataMatrix payloads, but still contain a valid PN and lot.
export const SUPPLIER_BOX_LOT_REGEX = /(?:^|[^A-Z0-9])(\d{4}[A-Z]{2,}[A-Z0-9]{8,20})(?=$|[^A-Z0-9])/i;
export const SUPPLIER_LOG_LOT_REGEX = /(?:^|[^A-Z0-9])(\d{4}[-_\s.]?LOG[-_\s.]?\d{2,6})(?=$|[^A-Z0-9])/i;

const normalizeCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");

const extractPartNumber = (text: string) => {
  const candidates = [...text.toUpperCase().matchAll(HYUNDAI_PN_REGEX)]
    .map((match) => normalizeCode(match[1]))
    .filter((candidate) => {
      const suffix = candidate.slice(5);
      return candidate.length >= 9 && candidate.length <= 15 && /[A-Z]/.test(suffix);
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
    const parts = trimmed.split(GS);
    let vendorCode = "";
    let partNumber = "";
    let supplierCode = "";
    let lotNumber = "";

    parts.forEach((segment) => {
      const clean = segment.replace(/[\x1e\x04\[\)>]/g, "").trim();
      if (clean.startsWith("V") && !vendorCode) vendorCode = clean.slice(1);
      else if (clean.startsWith("P") && !partNumber) partNumber = clean.slice(1);
      else if (clean.startsWith("S") && !supplierCode) supplierCode = clean.slice(1);
      else if (clean.startsWith("T") && !lotNumber) lotNumber = clean.slice(1);
    });

    if (partNumber) {
      return { vendorCode, partNumber, supplierCode, lotNumber, raw: trimmed };
    }

    // Fallback 1: scanned the linear lot barcode only (HU…T) — accept as partial scan.
    const lotMatch = trimmed.match(HYUNDAI_LOT_REGEX);
    if (lotMatch) {
      return {
        vendorCode: "",
        partNumber: "",
        supplierCode: "",
        lotNumber: lotMatch[1].toUpperCase(),
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
        raw: trimmed,
      };
    }

    return null;
  } catch {
    return null;
  }
}
