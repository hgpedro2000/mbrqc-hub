// Pure helpers for computing label Y positions in the Pareto chart.
// Extracted so the anti-overlap rule can be unit-tested.

// Backwards-compatible signature: when only (y, index) is provided we cycle
// 3 slots blindly. When a precomputed slot is passed, we honor it (so the
// caller can decide NOT to stagger labels that are visually far apart).
export function computeAccLabelY(y: number, indexOrSlot: number, slot?: number): number {
  const s = (slot ?? indexOrSlot ?? 0) % 3;
  // base 18px above the point; only lift further when stagger is needed.
  const offset = 18 + s * 14; // 18 / 32 / 46
  return Math.max(14, y - offset);
}

export function computeBarLabelY(y: number, indexOrSlot: number, slot?: number): number {
  const s = (slot ?? indexOrSlot ?? 0) % 3;
  // base 6px above the bar top; lift only adjacent close bars.
  const offset = 6 + s * 12; // 6 / 18 / 30
  return Math.max(10, y - offset);
}

// Assign stagger slots only to labels whose values are close to the previous
// one (within `closeRatio` of the max). Labels that are far apart reset to
// slot 0 so they render at the natural position instead of being lifted by
// the anti-overlap rule.
export function assignSlots(values: number[], closeRatio = 0.06): number[] {
  const max = Math.max(1, ...values.map((v) => Math.abs(v ?? 0)));
  const slots: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      slots.push(0);
      continue;
    }
    const diff = Math.abs((values[i] ?? 0) - (values[i - 1] ?? 0));
    const close = diff / max < closeRatio;
    slots.push(close ? (slots[i - 1] + 1) % 3 : 0);
  }
  return slots;
}

// Returns the minimum vertical distance between any two label centers
// across the provided indices, given each point's bar Y and line (acc) Y.
// Bar label and Acc label for the SAME index are intentionally separated
// by construction (acc is placed above bar). For neighbouring indices we
// also verify the labels do not collide.
export function minLabelGap(
  points: { yBar: number; yAcc: number }[],
  fontSize = 12,
): number {
  const positions: { x: number; y: number }[] = [];
  points.forEach((p, i) => {
    positions.push({ x: i, y: computeBarLabelY(p.yBar, i) });
    positions.push({ x: i, y: computeAccLabelY(p.yAcc, i) });
  });
  let min = Infinity;
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      // Only labels close on the X axis can overlap (same point or neighbour)
      if (Math.abs(positions[i].x - positions[j].x) > 1) continue;
      const dy = Math.abs(positions[i].y - positions[j].y);
      if (dy < min) min = dy;
    }
  }
  return min;
}
