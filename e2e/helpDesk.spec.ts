import { test, expect, type Page } from "@playwright/test";

/**
 * E2E: Help Desk indicator + status cards update in realtime when a ticket is closed.
 *
 * Pre-conditions (configured via env in playwright.config.ts):
 *  - E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD must belong to a user with the `admin` role
 *    (the Help Desk responsible). The session bypasses MFA only if the user was created
 *    via the "test user without MFA" flow.
 *  - At least ONE ticket in status `pendente` or `em_andamento` must exist when the test
 *    starts. The spec opens it from /engenharia and resolves it, then asserts that:
 *      (1) the red badge on the Help Desk button decrements / disappears live, and
 *      (2) the "Pendente"/"Em Andamento"/"Fechado" status cards re-balance live —
 *    all without a page reload (we never call page.reload()).
 */

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

test.skip(
  !ADMIN_EMAIL || !ADMIN_PASSWORD,
  "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run Help Desk E2E.",
);

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/senha|password/i).fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /entrar|login/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20_000 });
}

/** Reads the integer count rendered inside the red Help Desk badge, or 0 if absent. */
async function readRedBadgeCount(page: Page): Promise<number> {
  const badge = page.getByTestId("hd-indicator-red");
  if ((await badge.count()) === 0) return 0;
  const text = (await badge.first().innerText()).trim();
  return parseInt(text, 10) || 0;
}

/** Reads the numeric value of one of the 3 status overview cards in the Help Desk tab. */
async function readStatusCard(page: Page, label: RegExp): Promise<number> {
  const card = page.locator("div", { hasText: label }).filter({ has: page.locator("div.text-lg") }).first();
  const num = await card.locator("div.text-lg").innerText();
  return parseInt(num.trim(), 10) || 0;
}

test.describe("Help Desk realtime indicator", () => {
  test("red badge and status cards decrement live when a ticket is resolved", async ({ page }) => {
    await login(page);

    // 1) Capture initial red-badge count (visible on every page via ReportErrorButton).
    await page.goto("/");
    const initialBadge = await readRedBadgeCount(page);
    expect(initialBadge, "needs >=1 open ticket as a pre-condition").toBeGreaterThan(0);

    // 2) Go to Engenharia → Help Desk tab and snapshot status cards.
    await page.goto("/engenharia");
    await page.getByRole("tab", { name: /help.?desk|chamados/i }).click().catch(() => {});
    await expect(page.getByRole("heading", { name: /help desk/i })).toBeVisible();

    const pendBefore = await readStatusCard(page, /pendente/i);
    const andBefore = await readStatusCard(page, /em andamento/i);
    const fechBefore = await readStatusCard(page, /fechado/i);
    expect(pendBefore + andBefore).toBeGreaterThan(0);

    // 3) Open the first open ticket and mark it as resolved.
    await page.getByRole("tab", { name: /em aberto/i }).click();
    await page.locator("table tbody tr, [class*='border rounded-lg']").first().click();

    const statusSelect = page.getByRole("combobox").filter({ hasText: /pendente|andamento|resolvido/i }).first();
    await statusSelect.click();
    await page.getByRole("option", { name: /resolvido/i }).click();
    await page.getByRole("button", { name: /salvar|atualizar/i }).click();

    // 4) Realtime assertions — NO reload. The Supabase channel must push the change.
    await expect
      .poll(async () => readStatusCard(page, /fechado/i), { timeout: 15_000 })
      .toBe(fechBefore + 1);

    await expect
      .poll(async () => (await readStatusCard(page, /pendente/i)) + (await readStatusCard(page, /em andamento/i)), {
        timeout: 15_000,
      })
      .toBe(pendBefore + andBefore - 1);

    // 5) Red badge on the Help Desk button (still mounted in the header) decrements live.
    await expect
      .poll(async () => readRedBadgeCount(page), { timeout: 15_000 })
      .toBe(initialBadge - 1);
  });
});
