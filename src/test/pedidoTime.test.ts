import { describe, it, expect } from "vitest";
import { parseImportRows, buildPedidoRows, findMember, type CatalogItem, type TeamMember } from "@/lib/pedidoTime";

const members: TeamMember[] = [
  { id: "u1", full_name: "Alice Souza", employee_number: "1111111", turno: "A" },
  { id: "u2", full_name: "Bruno Lima",  employee_number: "2222222", turno: "A" },
  { id: "u3", full_name: "Carla Dias",  employee_number: "3333333", turno: "A" },
];

const catalog: CatalogItem[] = [
  { id: "i1", name: "Luva" },
  { id: "i2", name: "Óculos" },
  { id: "i3", name: "Protetor" },
];

describe("findMember", () => {
  it("matches by matricula first, falls back to name (case-insensitive)", () => {
    expect(findMember(members, "2222222", "")?.id).toBe("u2");
    expect(findMember(members, "", "alice souza")?.id).toBe("u1");
    expect(findMember(members, "9999999", "carla DIAS")?.id).toBe("u3");
    expect(findMember(members, "", "")).toBeUndefined();
  });
});

describe("parseImportRows", () => {
  it("groups items by member and reports unknowns", () => {
    const r = parseImportRows(
      [
        { matricula: "1111111", item: "Luva", quantidade: 2 },
        { matricula: "1111111", item: "Óculos", quantidade: 1 },
        { matricula: "2222222", item: "Luva", quantidade: 3 },
        { nome: "Carla Dias", item: "Protetor", quantidade: 5 },
        { matricula: "0000000", item: "Luva", quantidade: 1 }, // unknown member
        { matricula: "1111111", item: "Inexistente", quantidade: 1 }, // unknown item
        { matricula: "1111111", item: "", quantidade: 1 }, // skipped empty
      ],
      members,
      catalog,
    );

    expect(Object.keys(r.grouped).sort()).toEqual(["u1", "u2", "u3"]);
    expect(r.grouped.u1).toHaveLength(2);
    expect(r.grouped.u2[0]).toMatchObject({ item_id: "i1", quantity: 3 });
    expect(r.grouped.u3[0]).toMatchObject({ item_id: "i3", quantity: 5 });
    expect(r.unknownMembers).toContain("0000000");
    expect(r.unknownItems).toContain("Inexistente");
    expect(r.skippedEmpty).toBe(1);
  });

  it("aggregates duplicated (member,item) rows into a single line with summed qty", () => {
    const r = parseImportRows(
      [
        { matricula: "1111111", item: "Luva", quantidade: 2 },
        { matricula: "1111111", item: "luva", quantidade: 3 }, // case-insensitive dup
        { matricula: "1111111", item: "Luva", quantidade: 1 },
      ],
      members,
      catalog,
    );
    expect(r.grouped.u1).toHaveLength(1);
    expect(r.grouped.u1[0].quantity).toBe(6);
    expect(r.duplicates.length).toBeGreaterThan(0);
    expect(r.duplicates.at(-1)?.mergedQuantity).toBe(6);
  });

  it("clamps invalid quantities to a minimum of 1", () => {
    const r = parseImportRows(
      [
        { matricula: "1111111", item: "Luva", quantidade: 0 },
        { matricula: "2222222", item: "Luva", quantidade: -5 },
        { matricula: "3333333", item: "Luva", quantidade: "abc" as any },
      ],
      members,
      catalog,
    );
    expect(r.grouped.u1[0].quantity).toBe(1);
    expect(r.grouped.u2[0].quantity).toBe(1);
    expect(r.grouped.u3[0].quantity).toBe(1);
  });
});

describe("buildPedidoRows", () => {
  let n = 0;
  const uuid = () => `pid-${++n}`;

  it("creates one pedido_id per member, all items sharing it", () => {
    n = 0;
    const rows = buildPedidoRows(
      {
        u1: [
          { item_id: "i1", item_name: "Luva", quantity: 2 },
          { item_id: "i2", item_name: "Óculos", quantity: 1 },
        ],
        u2: [{ item_id: "i1", item_name: "Luva", quantity: 3 }],
      },
      members,
      { uuid, createdBy: "lider-1" },
    );

    expect(rows).toHaveLength(3);
    const byMember = rows.reduce<Record<string, Set<string>>>((acc, r) => {
      (acc[r.user_id] ||= new Set()).add(r.pedido_id); return acc;
    }, {});
    expect(byMember.u1.size).toBe(1);
    expect(byMember.u2.size).toBe(1);
    expect([...byMember.u1][0]).not.toBe([...byMember.u2][0]);
    expect(rows.every((r) => r.origem === "pedido_coletivo")).toBe(true);
    expect(rows.every((r) => r.criado_por === "lider-1")).toBe(true);
  });

  it("merges duplicated item_ids and skips invalid / empty members", () => {
    n = 0;
    const rows = buildPedidoRows(
      {
        u1: [
          { item_id: "i1", item_name: "Luva", quantity: 2 },
          { item_id: "i1", item_name: "Luva", quantity: 5 },
          { item_id: "", item_name: "", quantity: 1 }, // invalid
        ],
        u2: [{ item_id: "i1", item_name: "Luva", quantity: 0 }], // invalid → skipped entirely
        ghost: [{ item_id: "i1", item_name: "Luva", quantity: 1 }], // unknown member
      },
      members,
      { uuid },
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ user_id: "u1", item_id: "i1", quantity: 7 });
  });

  it("scales to many people / items without crossing pedido boundaries", () => {
    const many: TeamMember[] = Array.from({ length: 25 }, (_, i) => ({
      id: `m${i}`, full_name: `Pessoa ${i}`, employee_number: String(i).padStart(7, "0"), turno: "A",
    }));
    const orders: Record<string, any[]> = {};
    for (const m of many) {
      orders[m.id] = [
        { item_id: "i1", item_name: "Luva", quantity: 1 },
        { item_id: "i2", item_name: "Óculos", quantity: 2 },
      ];
    }
    n = 0;
    const rows = buildPedidoRows(orders, many, { uuid });
    expect(rows).toHaveLength(50);
    const pedidos = new Set(rows.map((r) => r.pedido_id));
    expect(pedidos.size).toBe(25);
  });
});
