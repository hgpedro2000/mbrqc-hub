/**
 * Sistema de versionamento 4 níveis: MAJOR.SECURITY.MINOR.PATCH
 *
 * - MAJOR    → Mudanças grandes / quebra de compatibilidade
 * - SECURITY → Correções/atualizações de segurança
 * - MINOR    → Novas funcionalidades sem quebra
 * - PATCH    → Correções pequenas / ajustes de UI
 *
 * Ao bumpar um nível, todos os níveis à direita zeram.
 */

export type ChangeType = "major" | "security" | "minor" | "patch";

export const CHANGE_TYPE_META: Record<
  ChangeType,
  { label: string; color: string; description: string }
> = {
  major:    { label: "Major",    color: "bg-purple-500/15 text-purple-600 border-purple-500/30", description: "Mudança grande / quebra de compatibilidade" },
  security: { label: "Segurança", color: "bg-red-500/15 text-red-600 border-red-500/30",         description: "Correção ou melhoria de segurança" },
  minor:    { label: "Minor",    color: "bg-blue-500/15 text-blue-600 border-blue-500/30",       description: "Nova funcionalidade" },
  patch:    { label: "Patch",    color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", description: "Correção pequena / ajuste" },
};

export function parseVersion(v: string): [number, number, number, number] {
  const parts = (v || "0.0.0.0").split(".").map((n) => parseInt(n, 10) || 0);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0, parts[3] || 0];
}

export function formatVersion(v: [number, number, number, number]): string {
  return v.join(".");
}

export function bumpVersion(current: string, type: ChangeType): string {
  const [maj, sec, min, pat] = parseVersion(current);
  switch (type) {
    case "major":    return formatVersion([maj + 1, 0, 0, 0]);
    case "security": return formatVersion([maj, sec + 1, 0, 0]);
    case "minor":    return formatVersion([maj, sec, min + 1, 0]);
    case "patch":    return formatVersion([maj, sec, min, pat + 1]);
  }
}

export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < 4; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}
