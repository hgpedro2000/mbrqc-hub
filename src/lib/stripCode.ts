/**
 * Remove leading code prefix from defect/responsibility strings.
 * e.g. "01 - SCRATCHED" → "SCRATCHED", "11 - DIRT(CONTAMINATION)" → "DIRT(CONTAMINATION)"
 */
export function stripCode(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/^\d+\s*-\s*/, "").trim();
}
