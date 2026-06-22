import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for Help Desk E2E.
 *
 * Required env vars (create `.env.e2e` or export inline):
 *   E2E_BASE_URL      = https://id-preview--<id>.lovable.app   (or http://localhost:8080)
 *   E2E_ADMIN_EMAIL   = email of a Help Desk responsible/admin user
 *   E2E_ADMIN_PASSWORD
 *
 * Run with: npx playwright test
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:8080",
    headless: true,
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 5"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 12"] } },
  ],
});
