// Helpers shared by the Contenção module (status, hours, dias em andamento).

export type ContencaoStatus =
  | "emitida"
  | "iniciada"
  | "em_andamento"
  | "concluida"
  | "cancelada";

export const STATUS_ORDER: ContencaoStatus[] = [
  "emitida",
  "iniciada",
  "em_andamento",
  "concluida",
];

export const STATUS_META: Record<
  ContencaoStatus,
  { label: string; badge: string; dot: string; pulse?: boolean }
> = {
  emitida: {
    label: "Emitida",
    badge: "bg-muted text-muted-foreground border border-border",
    dot: "bg-muted-foreground/70",
  },
  iniciada: {
    label: "Iniciada",
    badge: "bg-blue-500/15 text-blue-600 border border-blue-400/40",
    dot: "bg-blue-500",
  },
  em_andamento: {
    label: "Em Andamento",
    badge:
      "bg-orange-500/15 text-orange-600 border border-orange-400/40 animate-pulse",
    dot: "bg-orange-500",
    pulse: true,
  },
  concluida: {
    label: "Concluída",
    badge: "bg-emerald-500/15 text-emerald-600 border border-emerald-400/40",
    dot: "bg-emerald-500",
  },
  cancelada: {
    label: "Cancelada",
    badge: "bg-red-500/15 text-red-600 border border-red-400/40",
    dot: "bg-red-500",
  },
};

// Map legacy values stored in old rows.
export function normalizeStatus(status: string | null | undefined): ContencaoStatus {
  if (!status) return "emitida";
  if (status === "aberta") return "emitida";
  if (
    status === "emitida" ||
    status === "iniciada" ||
    status === "em_andamento" ||
    status === "concluida" ||
    status === "cancelada"
  ) {
    return status as ContencaoStatus;
  }
  return "emitida";
}

export function formatHoras(h: number | null | undefined): string {
  const n = Number(h || 0);
  if (!Number.isFinite(n) || n <= 0) return "0h";
  const hours = Math.floor(n);
  const minutes = Math.round((n - hours) * 60);
  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
}

// Days between created_at and now (or data_conclusao if concluded).
export function computeDiasAndamento(
  createdAt?: string | null,
  dataConclusao?: string | null,
  status?: ContencaoStatus,
): number {
  if (!createdAt) return 0;
  const start = new Date(createdAt).getTime();
  const end =
    status === "concluida" && dataConclusao
      ? new Date(dataConclusao).getTime()
      : Date.now();
  return Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
}

export function formatRelativeBR(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days}d`;
  return d.toLocaleDateString("pt-BR");
}

export const TURNOS = ["1T", "2T", "3T"] as const;

export interface Inspetor {
  id: string;
  nome: string;
}

export interface ContencaoRegistro {
  id: string;
  contencao_id: string;
  turno: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  horas_trabalhadas: number;
  local: string | null;
  inspetores: Inspetor[];
  qtd_inspetores: number;
  qtd_inspecionada: number;
  qtd_ok: number;
  qtd_ng: number;
  mark_check: boolean;
  fotos: string[];
  observacoes: string | null;
  finaliza_contencao: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ---- Aggregation helpers for OK/NG/Inspecionadas ----
// Single source of truth so the list page and detail drawer never drift.
// Rule: OK is ALWAYS derived as max(0, inspecionadas - ng). Never stored.

export interface RegistroLike {
  qtd_inspecionada?: number | null;
  qtd_diferenca?: number | null;
  qtd_ng?: number | null;
  horas_trabalhadas?: number | string | null;
}

export const computeOk = (insp: number, ng: number): number =>
  Math.max(0, (Number(insp) || 0) - (Number(ng) || 0));

/** List aggregation: insp = qtd_inspecionada + qtd_diferenca. */
export const aggregateRegistrosList = (registros: RegistroLike[]) => {
  let insp = 0;
  let ng = 0;
  for (const r of registros || []) {
    insp += Number(r?.qtd_inspecionada || 0) + Number(r?.qtd_diferenca || 0);
    ng += Number(r?.qtd_ng || 0);
  }
  return { insp, ng, ok: computeOk(insp, ng) };
};

/** Drawer aggregation: insp = qtd_inspecionada only; also sums horas. */
export const aggregateRegistrosDrawer = (registros: RegistroLike[]) => {
  let insp = 0;
  let ng = 0;
  let horas = 0;
  for (const r of registros || []) {
    insp += Number(r?.qtd_inspecionada || 0);
    ng += Number(r?.qtd_ng || 0);
    horas += Number(r?.horas_trabalhadas || 0);
  }
  return { insp, ng, horas, ok: computeOk(insp, ng) };
};
