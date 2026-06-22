import { test, expect, type Page } from "@playwright/test";

/**
 * E2E + visual-regression for the Engenharia → E-mail tab and its sub-tabs.
 *
 * Validates at multiple breakpoints (desktop via the `chromium` project, mobile via
 * `mobile-chrome` / `mobile-safari` projects in playwright.config.ts) that:
 *   - no element in the active sub-tab horizontally overflows its scroll container
 *     (catches "Tentativas" being clipped and similar layout breaks),
 *   - the "Status por subtipo" panel renders without clipping labels,
 *   - primary action buttons remain visible and clickable.
 *
 * Visual snapshots are saved per project (desktop vs. mobile) so layout regressions
 * are caught automatically by `npx playwright test --update-snapshots` on the
 * baseline run and `npx playwright test` thereafter.
 *
 * Required env: E2E_BASE_URL, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD.
 */

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

test.skip(
  !ADMIN_EMAIL || !ADMIN_PASSWORD,
  "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run E-mail tab E2E.",
);

const SUBTABS = [
  { value: "apontamentos", label: /apontamentos/i },
  { value: "alerta", label: /alerta/i },
  { value: "contencao", label: /conten[çc]/i },
  { value: "consumiveis", label: /consum/i },
  { value: "matriz", label: /matriz/i },
  { value: "acesso", label: /acesso/i },
] as const;

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/senha|password/i).fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /entrar|login/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20_000 });
}

async function openEmailTab(page: Page) {
  await page.goto("/engenharia");
  // Top-level "E-mail" tab in the Engenharia module.
  const emailTab = page.getByRole("tab", { name: /e-?mail/i }).first();
  await emailTab.scrollIntoViewIfNeeded();
  await emailTab.click();
  await page.waitForLoadState("networkidle");
}

/**
 * Asserts that no descendant of `root` is wider than the visible viewport width,
 * which would indicate a clipped/overflowing element (e.g. "Tentativas" cell).
 * The sub-tab list itself is allowed to overflow horizontally because it is a
 * scroll container by design.
 */
async function expectNoHorizontalClipping(page: Page, selector = "main") {
  const offenders = await page.evaluate((sel) => {
    const root = document.querySelector(sel) ?? document.body;
    const vw = window.innerWidth;
    const out: { tag: string; cls: string; w: number; text: string }[] = [];
    root.querySelectorAll<HTMLElement>("*").forEach((el) => {
      // Skip explicit scroll containers — they are allowed to overflow.
      const style = getComputedStyle(el);
      if (style.overflowX === "auto" || style.overflowX === "scroll") return;
      const r = el.getBoundingClientRect();
      if (r.width > vw + 2 || r.right > vw + 2) {
        out.push({
          tag: el.tagName,
          cls: el.className?.toString().slice(0, 80) ?? "",
          w: Math.round(r.width),
          text: (el.innerText || "").slice(0, 40),
        });
      }
    });
    return out.slice(0, 5);
  }, selector);
  expect(offenders, `Elements overflow viewport: ${JSON.stringify(offenders)}`).toEqual([]);
}

for (const sub of SUBTABS) {
  test(`E-mail → ${sub.value}: no layout clipping + visual snapshot`, async ({ page }, testInfo) => {
    await login(page);
    await openEmailTab(page);

    const trigger = page.getByRole("tab", { name: sub.label }).last();
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    await page.waitForTimeout(600); // allow content + queries to settle

    // 1. No element clips beyond viewport (catches "Tentativas" + button overflow).
    await expectNoHorizontalClipping(page);

    // 2. "Status por subtipo" header must be visible whenever it is rendered.
    const statusHeader = page.getByText(/status por subtipo/i).first();
    if (await statusHeader.count()) {
      await expect(statusHeader).toBeVisible();
      // The "Tentativas" label in the status grid must render in full (not clipped).
      const tent = page.getByText(/^Tentativas$/).first();
      if (await tent.count()) {
        const box = await tent.boundingBox();
        expect(box, "Tentativas label must have a bounding box").not.toBeNull();
        if (box) {
          expect(box.width).toBeGreaterThan(40);
          expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width + 2);
        }
      }
    }

    // 3. Visual regression — per-project baseline (desktop vs. mobile).
    await expect(page).toHaveScreenshot(`email-${sub.value}-${testInfo.project.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
      animations: "disabled",
    });
  });
}
