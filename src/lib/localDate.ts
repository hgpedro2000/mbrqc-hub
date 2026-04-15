/**
 * Returns today's date as YYYY-MM-DD in the user's local timezone.
 * Avoids the classic `new Date().toISOString().split("T")[0]` bug
 * that shifts the date in negative-UTC timezones (e.g. Brazil UTC-3).
 */
export function getLocalDateString(date?: Date): string {
  const d = date ?? new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatLocalDateString(dateString?: string | null, locale = "pt-BR"): string {
  if (!dateString) return "—";

  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(dateString)
    ? new Date(`${dateString}T12:00:00`)
    : new Date(dateString);

  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleDateString(locale);
}
