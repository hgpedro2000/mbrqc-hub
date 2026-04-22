// Password policy helpers: strength evaluation and SHA-256 hashing for history check

export interface PasswordCriteria {
  minLength: boolean;
  uppercase: boolean;
  number: boolean;
  special: boolean;
}

export const MIN_PASSWORD_LENGTH = 10;
export const PASSWORD_HISTORY_SIZE = 3;
export const PASSWORD_MAX_AGE_DAYS = 90;

export function evaluatePassword(pwd: string): PasswordCriteria {
  return {
    minLength: pwd.length >= MIN_PASSWORD_LENGTH,
    uppercase: /[A-Z]/.test(pwd),
    number: /[0-9]/.test(pwd),
    special: /[^A-Za-z0-9]/.test(pwd),
  };
}

export function passwordScore(c: PasswordCriteria): number {
  return [c.minLength, c.uppercase, c.number, c.special].filter(Boolean).length;
}

export function isPasswordValid(c: PasswordCriteria): boolean {
  return c.minLength && c.uppercase && c.number && c.special;
}

export function strengthLabel(score: number): { label: string; color: string; widthPct: number } {
  if (score <= 1) return { label: "Fraca", color: "bg-red-500", widthPct: 25 };
  if (score === 2) return { label: "Média", color: "bg-orange-500", widthPct: 50 };
  if (score === 3) return { label: "Boa", color: "bg-yellow-500", widthPct: 75 };
  return { label: "Forte", color: "bg-green-500", widthPct: 100 };
}

// SHA-256 hash via Web Crypto API. Used only to compare against the user's own
// recent password hashes (history). Never used for authentication.
export async function hashPassword(pwd: string): Promise<string> {
  const enc = new TextEncoder().encode(pwd);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isPasswordExpired(passwordChangedAt: string | null | undefined): boolean {
  if (!passwordChangedAt) return false;
  const changed = new Date(passwordChangedAt).getTime();
  const now = Date.now();
  const ageDays = (now - changed) / (1000 * 60 * 60 * 24);
  return ageDays > PASSWORD_MAX_AGE_DAYS;
}
