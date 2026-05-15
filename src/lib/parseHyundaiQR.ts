export interface HyundaiQRData {
  vendorCode: string;
  partNumber: string;
  supplierCode: string;
  lotNumber: string;
  raw: string;
  partial?: boolean; // true when only lot was captured (PN missing)
}

// Matches the linear lot/serial barcode at the bottom of Hyundai/Kia/Mobis labels.
// Examples: HU94C5ZR200986T, HU93A1ZR123456T
export const HYUNDAI_LOT_REGEX = /\b(HU\d{2}[A-Z0-9]{6,16}T)\b/i;

// Matches typical Hyundai Mobis part-number patterns (e.g. 96160R1BF0MDG, 84852-R1520, 84852R1520NNB)
export const HYUNDAI_PN_REGEX = /\b(\d{5}[-]?[A-Z0-9]{4,10})\b/;

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

    // Fallback 2: free-text content containing a PN-shaped token.
    const pnMatch = trimmed.match(HYUNDAI_PN_REGEX);
    if (pnMatch) {
      return {
        vendorCode: "",
        partNumber: pnMatch[1].replace(/-/g, "").toUpperCase(),
        supplierCode: "",
        lotNumber: "",
        raw: trimmed,
      };
    }

    return null;
  } catch {
    return null;
  }
}
