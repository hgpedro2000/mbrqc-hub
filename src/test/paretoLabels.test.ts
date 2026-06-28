import { describe, it, expect } from "vitest";
import {
  computeAccLabelY,
  computeBarLabelY,
  minLabelGap,
} from "@/lib/paretoLabels";

// Font size used for Pareto labels (matches AnaliseRisco paretoLabelFs floor).
const FS = 12;

describe("Pareto label anti-overlap rule", () => {
  it("acc label always sits above the bar label for the same index", () => {
    for (let i = 0; i < 10; i++) {
      const y = 200; // identical underlying y to stress the rule
      const bar = computeBarLabelY(y, i);
      const acc = computeAccLabelY(y, i);
      expect(acc).toBeLessThan(bar);
      expect(bar - acc).toBeGreaterThanOrEqual(FS); // at least one line apart
    }
  });

  it("cycles acc labels across 3 vertical slots", () => {
    const ys = [100, 100, 100, 100, 100, 100].map((y, i) =>
      computeAccLabelY(y, i),
    );
    // Slots: 30/46/62 -> y values 70/54/38
    expect(new Set(ys.slice(0, 3)).size).toBe(3);
    expect(ys[0]).toBe(ys[3]);
    expect(ys[1]).toBe(ys[4]);
    expect(ys[2]).toBe(ys[5]);
  });

  it("keeps labels separated when neighbouring bars have very close heights", () => {
    // Simulate Pareto where NG counts are nearly identical (worst-case crowding)
    const points = Array.from({ length: 8 }, () => ({ yBar: 180, yAcc: 120 }));
    const gap = minLabelGap(points, FS);
    expect(gap).toBeGreaterThanOrEqual(FS); // no label overlaps another
  });

  it("keeps labels separated for ascending acc line typical of Pareto", () => {
    // Acc line monotonically decreases in y (goes up visually)
    const points = [
      { yBar: 250, yAcc: 200 },
      { yBar: 240, yAcc: 170 },
      { yBar: 230, yAcc: 150 },
      { yBar: 220, yAcc: 140 },
      { yBar: 215, yAcc: 135 },
      { yBar: 210, yAcc: 132 },
      { yBar: 208, yAcc: 130 },
    ];
    const gap = minLabelGap(points, FS);
    expect(gap).toBeGreaterThanOrEqual(FS);
  });

  it("clamps labels so they never render off the top of the chart", () => {
    expect(computeAccLabelY(0, 0)).toBeGreaterThanOrEqual(14);
    expect(computeBarLabelY(0, 0)).toBeGreaterThanOrEqual(10);
    expect(computeAccLabelY(10, 2)).toBeGreaterThanOrEqual(14); // slot=2 offset=62
  });
});
