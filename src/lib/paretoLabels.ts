// Pure helpers for computing label Y positions in the Pareto chart.
// Extracted so the anti-overlap rule can be unit-tested.

export function computeAccLabelY(y: number, index: number): number {
  const slot = (index ?? 0) % 3; // 0, 1, 2
  const offset = 42 + slot * 16; // 42 / 58 / 74 — always above the bar label
  return Math.max(14, y - offset);
}

export function computeBarLabelY(y: number, index: number): number {
  const slot = (index ?? 0) % 3; // cycle 3 slots so adjacent NG labels never collide
  const offset = 6 + slot * 12; // 6 / 18 / 30
  return Math.max(10, y - offset);
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
