// Quem pode gerar/baixar o Relatório de Claim ao fornecedor.
// Regra: Admin OU cargo "Líder de Qualidade" para cima (Líder, Coordenador,
// Supervisor, Engenheiro/Engenharia, Gerente, Diretor).
const ROLE_KEYWORDS = [
  "lider", "líder",
  "coordenador",
  "supervisor",
  "engenheiro", "engenharia",
  "gerente",
  "diretor",
];

export const canGenerateClaimReport = (opts: {
  isAdmin?: boolean;
  cargo?: string | null;
}): boolean => {
  if (opts.isAdmin) return true;
  const c = (opts.cargo || "").toLowerCase();
  if (!c) return false;
  return ROLE_KEYWORDS.some((k) => c.includes(k));
};
