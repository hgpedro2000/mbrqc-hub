/**
 * Pure helper for the Help Desk button indicator state.
 * Kept framework-free so it can be unit-tested without React/Supabase.
 *
 * Rules:
 * - Admins (Help Desk responsibles) see a RED badge with the count whenever
 *   there are tickets in status "pendente" or "em_andamento". As soon as the
 *   pending count drops to zero, the indicator disappears.
 * - Regular users see a GREEN dot only when one of their own tickets has been
 *   resolved and they haven't acknowledged it yet (newResolvedCount > 0).
 * - The RED admin badge always wins over the GREEN user dot.
 */
export type IndicatorColor = "red" | "green" | null;

export interface IndicatorInput {
  isAdmin: boolean;
  pendingAdminCount: number;
  newResolvedCount: number;
}

export interface IndicatorState {
  color: IndicatorColor;
  count: number;
}

export function getHelpDeskIndicator(input: IndicatorInput): IndicatorState {
  const { isAdmin, pendingAdminCount, newResolvedCount } = input;
  if (isAdmin && pendingAdminCount > 0) {
    return { color: "red", count: pendingAdminCount };
  }
  if (newResolvedCount > 0) {
    return { color: "green", count: newResolvedCount };
  }
  return { color: null, count: 0 };
}
