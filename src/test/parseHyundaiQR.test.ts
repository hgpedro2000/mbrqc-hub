import { describe, expect, it } from "vitest";
import { parseHyundaiQR } from "@/lib/parseHyundaiQR";

describe("parseHyundaiQR", () => {
  it("accepts supplier box labels with PN and compact lot", () => {
    expect(parseHyundaiQR("86552R1600   0096AWEZ2704260069")).toMatchObject({
      partNumber: "86552R1600",
      lotNumber: "0096AWEZ2704260069",
    });
  });

  it("accepts supplier box labels with hyphenated PN", () => {
    expect(parseHyundaiQR("86553-BX700 0140BZWD1504268169")).toMatchObject({
      partNumber: "86553BX700",
      lotNumber: "0140BZWD1504268169",
    });
  });

  it("extracts PN and LOG lot from multi-token supplier label", () => {
    expect(parseHyundaiQR("84780-R1000MDG _0014_LOG-052 _0000360132_MOBIS BRASIL _124_170426_1095")).toMatchObject({
      partNumber: "84780R1000MDG",
      lotNumber: "0014LOG052",
    });
  });

  it("keeps partial lot scans when PN is absent", () => {
    expect(parseHyundaiQR("HU94C5ZR200986T")).toMatchObject({
      partNumber: "",
      lotNumber: "HU94C5ZR200986T",
      partial: true,
    });
  });

  it("accepts PNs with letter inside the first 5 chars (865B4, 866W7)", () => {
    expect(parseHyundaiQR("865B4-BX700   0048BZWD1405263403")).toMatchObject({
      partNumber: "865B4BX700",
      lotNumber: "0048BZWD1405263403",
    });
    expect(parseHyundaiQR("866W7-R1700 _0200_LOG-017 _0000360111_MOBIS BRASIL _124_110526_0172")).toMatchObject({
      partNumber: "866W7R1700",
      lotNumber: "0200LOG017",
    });
    expect(parseHyundaiQR("866W7R1700    0200AWEZ1105260172")).toMatchObject({
      partNumber: "866W7R1700",
      lotNumber: "0200AWEZ1105260172",
    });
  });
});