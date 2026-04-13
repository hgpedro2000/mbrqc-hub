export interface HyundaiQRData {
  vendorCode: string;
  partNumber: string;
  supplierCode: string;
  lotNumber: string;
  raw: string;
}

export function parseHyundaiQR(raw: string): HyundaiQRData | null {
  try {
    const GS = "\x1d";
    const parts = raw.split(GS);
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

    if (!partNumber) return null;
    return { vendorCode, partNumber, supplierCode, lotNumber, raw };
  } catch {
    return null;
  }
}
