/* Pure helpers for "Pedido de Time" — import parsing, deduplication, validation.
 * Kept framework-free so they can be unit-tested without React. */

export interface ListaItem {
  item_id: string;
  item_name: string;
  quantity: number;
}

export interface CatalogItem {
  id: string;
  name: string;
  [k: string]: any;
}

export interface TeamMember {
  id: string;
  full_name: string;
  employee_number?: string | null;
  turno?: string | null;
  [k: string]: any;
}

export interface ImportRow {
  matricula?: any;
  Matricula?: any;
  matrícula?: any;
  Matrícula?: any;
  nome?: any;
  Nome?: any;
  item?: any;
  Item?: any;
  quantidade?: any;
  Quantidade?: any;
  qty?: any;
}

export interface ParseResult {
  /** memberId -> deduplicated list of items */
  grouped: Record<string, ListaItem[]>;
  /** matricula/nome values that did not match any member */
  unknownMembers: string[];
  /** item names not found in the active catalog */
  unknownItems: string[];
  /** duplicated (member,item) pairs that were aggregated */
  duplicates: { memberId: string; item_name: string; mergedQuantity: number }[];
  /** rows skipped because item name was empty */
  skippedEmpty: number;
}

const normalize = (s: any) => String(s ?? "").trim().toLowerCase();

export function findMember(
  members: TeamMember[],
  matricula: string,
  nome: string,
): TeamMember | undefined {
  const m = matricula.trim();
  const n = normalize(nome);
  return members.find((mm) =>
    (m && String(mm.employee_number || "").trim() === m) ||
    (n && normalize(mm.full_name) === n),
  );
}

/** Parse a raw spreadsheet payload into per-member item lists.
 *  - Aggregates duplicated (member,item) pairs by summing quantity.
 *  - Reports unknown members/items and counts skipped rows. */
export function parseImportRows(
  rows: ImportRow[],
  members: TeamMember[],
  catalog: CatalogItem[],
): ParseResult {
  const grouped: Record<string, ListaItem[]> = {};
  const unknownMembers = new Set<string>();
  const unknownItems = new Set<string>();
  const duplicates: ParseResult["duplicates"] = [];
  let skippedEmpty = 0;

  for (const row of rows) {
    const matricula = String(
      row.matricula ?? row.Matricula ?? row["matrícula"] ?? row["Matrícula"] ?? "",
    ).trim();
    const nome = String(row.nome ?? row.Nome ?? "").trim();
    const itemName = String(row.item ?? row.Item ?? "").trim();
    const qty = Math.max(1, Math.floor(Number(row.quantidade ?? row.Quantidade ?? row.qty ?? 1) || 1));

    if (!itemName) { skippedEmpty++; continue; }

    const member = findMember(members, matricula, nome);
    if (!member) { unknownMembers.add(matricula || nome || "(linha sem matrícula/nome)"); continue; }

    const cat = catalog.find((c) => normalize(c.name) === normalize(itemName));
    if (!cat) { unknownItems.add(itemName); continue; }

    const list = (grouped[member.id] ||= []);
    const existing = list.find((x) => x.item_id === cat.id);
    if (existing) {
      existing.quantity += qty;
      duplicates.push({ memberId: member.id, item_name: cat.name, mergedQuantity: existing.quantity });
    } else {
      list.push({ item_id: cat.id, item_name: cat.name, quantity: qty });
    }
  }

  return {
    grouped,
    unknownMembers: Array.from(unknownMembers),
    unknownItems: Array.from(unknownItems),
    duplicates,
    skippedEmpty,
  };
}

export interface BuildOptions {
  createdBy?: string | null;
  /** Allow test code to inject a deterministic UUID generator. */
  uuid?: () => string;
}

export interface PedidoRow {
  pedido_id: string;
  user_id: string;
  user_name: string;
  turno: string | null | undefined;
  item_id: string;
  item_name: string;
  quantity: number;
  origem: "pedido_coletivo";
  criado_por?: string | null;
}

/** Build flat DB rows from per-member items.
 *  Each member becomes ONE pedido (shared pedido_id) regardless of item count. */
export function buildPedidoRows(
  memberOrders: Record<string, ListaItem[]>,
  members: TeamMember[],
  opts: BuildOptions = {},
): PedidoRow[] {
  const uuid = opts.uuid || (() => (globalThis.crypto as any)?.randomUUID?.() || `pid-${Math.random().toString(36).slice(2)}`);
  const out: PedidoRow[] = [];

  for (const memberId of Object.keys(memberOrders)) {
    const member = members.find((m) => m.id === memberId);
    if (!member) continue;

    // Deduplicate again at build time as a safety net.
    const merged = new Map<string, ListaItem>();
    for (const it of memberOrders[memberId]) {
      if (!it.item_id || it.quantity <= 0) continue;
      const prev = merged.get(it.item_id);
      if (prev) prev.quantity += it.quantity;
      else merged.set(it.item_id, { ...it });
    }
    if (merged.size === 0) continue;

    const pedido_id = uuid();
    for (const it of merged.values()) {
      out.push({
        pedido_id,
        user_id: memberId,
        user_name: member.full_name,
        turno: member.turno,
        item_id: it.item_id,
        item_name: it.item_name,
        quantity: it.quantity,
        origem: "pedido_coletivo",
        criado_por: opts.createdBy ?? null,
      });
    }
  }

  return out;
}
