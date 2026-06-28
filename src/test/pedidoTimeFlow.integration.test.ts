/**
 * Integration test for the Pedido de Time full flow:
 *   raw spreadsheet rows  →  parseImportRows (import)
 *                         →  preview aggregation per person (prévia)
 *                         →  buildPedidoRows + insert (confirmação)
 *
 * The DB layer is mocked, but the orchestration mirrors what
 * `ConsumiveisExtras.tsx` does end-to-end. Results are cross-checked
 * against the unit-test scenarios in `pedidoTime.test.ts`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseImportRows,
  buildPedidoRows,
  type CatalogItem,
  type TeamMember,
  type ListaItem,
  type PedidoRow,
} from "@/lib/pedidoTime";

// --- Fixtures shared with the unit tests ----------------------------------
const members: TeamMember[] = [
  { id: "u1", full_name: "Alice Souza", employee_number: "1111111", turno: "A" },
  { id: "u2", full_name: "Bruno Lima",  employee_number: "2222222", turno: "B" },
  { id: "u3", full_name: "Carla Dias",  employee_number: "3333333", turno: "C" },
];
const catalog: CatalogItem[] = [
  { id: "i1", name: "Luva" },
  { id: "i2", name: "Óculos" },
  { id: "i3", name: "Protetor" },
];

// --- Fake DB --------------------------------------------------------------
function makeFakeDB() {
  const inserted: PedidoRow[] = [];
  const insert = vi.fn(async (rows: PedidoRow[]) => {
    inserted.push(...rows);
    return { data: rows, error: null };
  });
  return { inserted, client: { from: () => ({ insert }) }, insert };
}

// --- Flow orchestration (mirrors UI) --------------------------------------
interface PreviewEntry { memberId: string; memberName: string; items: ListaItem[]; totalQty: number }

function buildPreview(grouped: Record<string, ListaItem[]>, ms: TeamMember[]): PreviewEntry[] {
  return Object.entries(grouped).map(([memberId, items]) => ({
    memberId,
    memberName: ms.find((m) => m.id === memberId)?.full_name ?? "?",
    items,
    totalQty: items.reduce((s, it) => s + it.quantity, 0),
  }));
}

async function runFlow(rows: any[], db: ReturnType<typeof makeFakeDB>, createdBy = "lider-1") {
  // 1) import
  const parsed = parseImportRows(rows, members, catalog);
  // 2) preview
  const preview = buildPreview(parsed.grouped, members);
  // 3) confirm
  let seq = 0;
  const uuid = () => `pid-${++seq}`;
  const built = buildPedidoRows(parsed.grouped, members, { uuid, createdBy });
  await db.client.from().insert(built);
  return { parsed, preview, built };
}

beforeEach(() => vi.clearAllMocks());

// --- Tests ----------------------------------------------------------------
describe("Pedido de Time — integration flow (import → prévia → confirmar)", () => {
  it("creates one pedido per person with merged items matching the preview", async () => {
    const db = makeFakeDB();
    const { parsed, preview, built } = await runFlow(
      [
        { matricula: "1111111", item: "Luva", quantidade: 2 },
        { matricula: "1111111", item: "luva", quantidade: 3 }, // dup → merged
        { matricula: "1111111", item: "Óculos", quantidade: 1 },
        { matricula: "2222222", item: "Luva", quantidade: 4 },
        { nome: "Carla Dias",   item: "Protetor", quantidade: 5 },
      ],
      db,
    );

    // import-level
    expect(parsed.duplicates.at(-1)?.mergedQuantity).toBe(5);
    expect(parsed.unknownMembers).toHaveLength(0);
    expect(parsed.unknownItems).toHaveLength(0);

    // preview reflects aggregation per person
    const previewByMember = Object.fromEntries(preview.map((p) => [p.memberId, p]));
    expect(previewByMember.u1.totalQty).toBe(6); // 5 luva + 1 óculos
    expect(previewByMember.u2.totalQty).toBe(4);
    expect(previewByMember.u3.totalQty).toBe(5);

    // confirmação: one pedido_id per person, rows match preview qty
    expect(db.insert).toHaveBeenCalledTimes(1);
    const pedidos = new Set(built.map((r) => r.pedido_id));
    expect(pedidos.size).toBe(3);

    for (const p of preview) {
      const rowsForMember = built.filter((r) => r.user_id === p.memberId);
      expect(new Set(rowsForMember.map((r) => r.pedido_id)).size).toBe(1);
      expect(rowsForMember.reduce((s, r) => s + r.quantity, 0)).toBe(p.totalQty);
      expect(rowsForMember.length).toBe(p.items.length);
    }
    expect(built.every((r) => r.origem === "pedido_coletivo" && r.criado_por === "lider-1")).toBe(true);
  });

  it("blocks unknown members/items from the preview and from insert", async () => {
    const db = makeFakeDB();
    const { parsed, preview, built } = await runFlow(
      [
        { matricula: "0000000", item: "Luva", quantidade: 1 },     // unknown member
        { matricula: "1111111", item: "Inexistente", quantidade: 2 }, // unknown item
        { matricula: "1111111", item: "Luva", quantidade: 2 },
      ],
      db,
    );

    expect(parsed.unknownMembers).toContain("0000000");
    expect(parsed.unknownItems).toContain("Inexistente");
    expect(preview).toHaveLength(1);
    expect(preview[0].memberId).toBe("u1");
    expect(built).toHaveLength(1);
    expect(built[0]).toMatchObject({ user_id: "u1", item_id: "i1", quantity: 2 });
  });

  it("does not insert anything when the parsed result is empty", async () => {
    const db = makeFakeDB();
    const { built } = await runFlow(
      [{ matricula: "0000000", item: "Nada", quantidade: 1 }],
      db,
    );
    // Even though insert([]) is technically called, no rows persist.
    expect(built).toHaveLength(0);
    expect(db.inserted).toHaveLength(0);
  });

  it("scales to many people while keeping pedido boundaries intact", async () => {
    const db = makeFakeDB();
    const many: TeamMember[] = Array.from({ length: 10 }, (_, i) => ({
      id: `m${i}`, full_name: `Pessoa ${i}`,
      employee_number: String(i + 1).padStart(7, "0"), turno: "A",
    }));
    const rows = many.flatMap((m) => [
      { matricula: m.employee_number, item: "Luva", quantidade: 1 },
      { matricula: m.employee_number, item: "Óculos", quantidade: 2 },
      { matricula: m.employee_number, item: "luva", quantidade: 1 }, // merges into Luva
    ]);
    const parsed = parseImportRows(rows, many, catalog);
    let seq = 0;
    const built = buildPedidoRows(parsed.grouped, many, { uuid: () => `pid-${++seq}` });
    await db.client.from().insert(built);

    // 10 people × 2 distinct items = 20 rows; 10 unique pedido_ids.
    expect(built).toHaveLength(20);
    expect(new Set(built.map((r) => r.pedido_id)).size).toBe(10);
    for (const m of many) {
      const mine = built.filter((r) => r.user_id === m.id);
      expect(mine).toHaveLength(2);
      expect(mine.find((r) => r.item_id === "i1")?.quantity).toBe(2); // merged
      expect(mine.find((r) => r.item_id === "i2")?.quantity).toBe(2);
    }
  });
});
