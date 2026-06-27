import { describe, it, expect, expectTypeOf } from "vitest";
import { fmt, fmtPct, type PartRisk } from "@/pages/AnaliseRisco";

describe("AnaliseRisco - formatação pt-BR", () => {
  it("formata milhares com ponto", () => {
    expect(fmt(7000)).toBe("7.000");
    expect(fmt(1234567)).toBe("1.234.567");
    expect(fmt(0)).toBe("0");
  });

  it("trata null/undefined sem quebrar", () => {
    expect(fmt(undefined as unknown as number)).toBe("0");
    expect(fmt(null as unknown as number)).toBe("0");
  });

  it("formata percentual com vírgula", () => {
    expect(fmtPct(87.5)).toBe("87,5%");
    expect(fmtPct(100, 0)).toBe("100%");
  });
});

describe("AnaliseRisco - contrato do tipo PartRisk", () => {
  it("garante shape estável para evitar regressões", () => {
    const sample: PartRisk = {
      pn: "ABC",
      partName: "Suporte",
      fornecedor: "Fornecedor X",
      ng: 10,
      diasSem: 5,
      modoRecorrente: "Trinca",
      score: 65,
      classification: "alto",
      recomendacao: "100% inspeção",
      monthsWithModo: 2,
      ppmFornecedor: 12000,
    };
    expect(sample.classification).toBe("alto");
    expectTypeOf(sample.classification).toEqualTypeOf<"alto" | "medio" | "baixo">();
    expectTypeOf(sample.score).toBeNumber();
  });
});
