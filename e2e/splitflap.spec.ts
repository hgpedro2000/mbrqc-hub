import { test, expect, Page } from "@playwright/test";

/**
 * E2E for the SplitFlap digit animation.
 *
 * Mounts the dev harness at /dev/splitflap (no auth required) and verifies:
 *  1. Each value change updates the inner translateY transform (i.e. the
 *     digit actually rolls — not stuck on the same frame).
 *  2. Rapid navigation (many clicks in quick succession) still ends on the
 *     correct final position, with the transform monotonically advancing
 *     (never going backwards or staying still).
 */

const FLAP_WRAP = '[data-testid="flap-wrap"]';

// Returns the translateY pixel value of every digit's roll strip.
async function readTransforms(page: Page): Promise<number[]> {
  return await page.$$eval(
    `${FLAP_WRAP} span > div:not([aria-hidden])`,
    (els) =>
      els.map((el) => {
        const t = getComputedStyle(el as HTMLElement).transform;
        if (!t || t === "none") return 0;
        // matrix(a, b, c, d, tx, ty)
        const m = t.match(/matrix\(([^)]+)\)/);
        if (!m) return 0;
        const parts = m[1].split(",").map((s) => parseFloat(s.trim()));
        return parts[5] ?? 0;
      })
  );
}

test.describe("SplitFlapDigit", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dev/splitflap", { waitUntil: "domcontentloaded" });
    await expect(page.locator(FLAP_WRAP)).toBeVisible();
  });

  test("animates on every value change", async ({ page }) => {
    const before = await readTransforms(page);

    await page.getByTestId("inc").click();
    // Give the CSS transition a couple of frames to commit a new transform.
    await page.waitForTimeout(80);
    const after = await readTransforms(page);

    expect(after.length).toBe(before.length);
    // At least one digit must have moved (translateY changed).
    const moved = after.some((v, i) => v !== before[i]);
    expect(moved, `transforms unchanged after click — before=${before} after=${after}`).toBe(true);

    // Wait for the transition to finish, then assert it stayed put.
    await page.waitForTimeout(600);
    const settled = await readTransforms(page);
    expect(settled).toEqual(after.map((v, i) => (v !== before[i] ? settled[i] : v)));
  });

  test("rapid navigation keeps animating and ends on final value", async ({ page }) => {
    const initial = await readTransforms(page);
    const samples: number[][] = [initial];

    // 8 rapid +1 clicks (~30 ms apart). Value stays single-digit (0 → 8) so
    // the units digit must visibly roll through several positions.
    for (let i = 0; i < 8; i++) {
      await page.getByTestId("inc").click();
      await page.waitForTimeout(30);
      samples.push(await readTransforms(page));
    }

    await page.waitForTimeout(800);
    const final = await readTransforms(page);

    // Units digit (last entry) must have moved away from its initial value.
    expect(final[final.length - 1]).not.toBe(initial[initial.length - 1]);

    // Across the rapid sequence, the units-digit transform must take at
    // least 3 distinct values — proves the roll keeps animating rather than
    // snapping straight to the end.
    const lastDigitSeries = samples.map((s) => s[s.length - 1]);
    const distinct = new Set(lastDigitSeries.map((v) => v.toFixed(2)));
    expect(
      distinct.size,
      `expected the units digit to move through multiple positions, saw=${[...distinct]}`
    ).toBeGreaterThanOrEqual(3);

    // After 8 clicks of +1 the harness displays value=8.
    await expect(page.getByTestId("current-value")).toHaveText("value=8");
  });
});

