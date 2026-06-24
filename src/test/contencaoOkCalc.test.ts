import { describe, it, expect } from "vitest";
import {
  computeOk,
  aggregateRegistrosList,
  aggregateRegistrosDrawer,
} from "@/lib/contencao";

describe("computeOk — OK = max(0, insp - ng)", () => {
  it("returns insp - ng when insp >= ng", () => {
    expect(computeOk(10, 3)).toBe(7);
    expect(computeOk(5, 5)).toBe(0);
  });

  it("clamps to 0 when NG exceeds Inspecionadas", () => {
    expect(computeOk(2, 9)).toBe(0);
    expect(computeOk(0, 4)).toBe(0);
  });

  it("treats NaN / undefined / null inputs as 0", () => {
    expect(computeOk(undefined as any, undefined as any)).toBe(0);
    expect(computeOk(null as any, null as any)).toBe(0);
    expect(computeOk(NaN as any, NaN as any)).toBe(0);
    expect(computeOk(7, null as any)).toBe(7);
    expect(computeOk(null as any, 3)).toBe(0);
  });
});

describe("aggregateRegistrosList (page list)", () => {
  it("sums insp = qtd_inspecionada + qtd_diferenca and derives OK", () => {
    const out = aggregateRegistrosList([
      { qtd_inspecionada: 10, qtd_diferenca: 2, qtd_ng: 3 },
      { qtd_inspecionada: 5, qtd_diferenca: 0, qtd_ng: 1 },
    ]);
    expect(out).toEqual({ insp: 17, ng: 4, ok: 13 });
  });

  it("clamps OK to 0 when NG exceeds Inspecionadas across registros", () => {
    const out = aggregateRegistrosList([
      { qtd_inspecionada: 2, qtd_diferenca: 0, qtd_ng: 5 },
      { qtd_inspecionada: 1, qtd_diferenca: 0, qtd_ng: 4 },
    ]);
    expect(out.insp).toBe(3);
    expect(out.ng).toBe(9);
    expect(out.ok).toBe(0);
  });

  it("handles null / undefined fields and empty list", () => {
    expect(aggregateRegistrosList([])).toEqual({ insp: 0, ng: 0, ok: 0 });
    const out = aggregateRegistrosList([
      { qtd_inspecionada: null, qtd_diferenca: undefined, qtd_ng: null },
      { qtd_inspecionada: 4, qtd_ng: 1 } as any, // qtd_diferenca missing
    ]);
    expect(out).toEqual({ insp: 4, ng: 1, ok: 3 });
  });
});

describe("aggregateRegistrosDrawer (detail drawer)", () => {
  it("sums insp = qtd_inspecionada only, plus horas, derives OK", () => {
    const out = aggregateRegistrosDrawer([
      { qtd_inspecionada: 10, qtd_ng: 2, horas_trabalhadas: "1.5" },
      { qtd_inspecionada: 4, qtd_ng: 1, horas_trabalhadas: 2 },
    ]);
    expect(out.insp).toBe(14);
    expect(out.ng).toBe(3);
    expect(out.ok).toBe(11);
    expect(out.horas).toBeCloseTo(3.5);
  });

  it("clamps OK to 0 when NG > Inspecionadas", () => {
    const out = aggregateRegistrosDrawer([
      { qtd_inspecionada: 1, qtd_ng: 5 },
      { qtd_inspecionada: 0, qtd_ng: 3 },
    ]);
    expect(out.ok).toBe(0);
    expect(out.insp).toBe(1);
    expect(out.ng).toBe(8);
  });

  it("handles null fields and empty input", () => {
    expect(aggregateRegistrosDrawer([])).toEqual({ insp: 0, ng: 0, horas: 0, ok: 0 });
    const out = aggregateRegistrosDrawer([
      { qtd_inspecionada: null, qtd_ng: null, horas_trabalhadas: null },
      { qtd_inspecionada: 6, qtd_ng: 0 } as any,
    ]);
    expect(out).toEqual({ insp: 6, ng: 0, horas: 0, ok: 6 });
  });
});
