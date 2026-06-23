"""
E2E validation for the per-slide PREVIEW inside "Configurar Monitor".

Runs against the PUBLIC /monitor page (no MFA gate) which embeds the same
MonitorDialog. Uses Playwright locators (real pointer events) because
Radix Tabs reacts to pointerdown, not synthetic .click().

Steps:
  1. Open /monitor and click the "Configurações do monitor" button.
  2. Switch to the Slides tab, ensure Resumo is enabled, open its
     per-slide tab.
  3. Assert the "Pré-visualização" card is rendered with a live
     countdown ("Xs restantes").
  4. Wait → confirm countdown ticks down.
  5. Click "Repetir" → confirm countdown resets.
  6. Change slide duration → confirm preview restarts at the new value.
  7. Confirm a progress bar with a CSS width transition exists.

Run:
    python3 tests/e2e/monitor_preview.py
"""
import asyncio, json, os, re, sys
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path("/tmp/browser/monitor-preview")
OUT.mkdir(parents=True, exist_ok=True)
BASE = os.environ.get("APP_BASE_URL", "http://localhost:8080")


async def restore_session(page):
    key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    sess = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    if not key or not sess:
        return False
    await page.goto(BASE, wait_until="domcontentloaded")
    await page.evaluate(
        f"window.localStorage.setItem({json.dumps(key)}, {json.dumps(sess)})"
    )
    return True


async def read_remaining(page) -> float | None:
    txt = await page.evaluate(
        """() => {
            const el = [...document.querySelectorAll('[role="dialog"] *')]
                .find(e => /restantes/i.test(e.textContent || '') && e.children.length === 0);
            return el ? el.textContent : null;
        }"""
    )
    if not txt:
        return None
    m = re.search(r"([\d.]+)\s*s", txt)
    return float(m.group(1)) if m else None


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1440, "height": 900})
        page = await ctx.new_page()
        failures = []
        try:
            if not await restore_session(page):
                print("✗ no Lovable session env — cannot run E2E")
                sys.exit(2)

            await page.goto(f"{BASE}/monitor", wait_until="domcontentloaded")
            await page.wait_for_timeout(1000)
            await page.screenshot(path=str(OUT / "1_monitor.png"))

            # Seed prefs so the dialog opens reliably (also forces 3 enabled slides).
            await page.evaluate("""() => localStorage.setItem(
                'monitor_preferences',
                JSON.stringify({ blocks: ['summary','recent','alerts'], period:'today', theme:'dark' })
            )""")
            await page.reload(wait_until="domcontentloaded")
            await page.wait_for_timeout(1200)

            # Open dialog via direct JS click (the icon button is opacity-0
            # until hover; both approaches dispatch a click that React handles).
            opened = await page.evaluate(
                """() => {
                    const icon = document.querySelector('button[aria-label="Configurações do monitor"]');
                    const cfg  = [...document.querySelectorAll('button')]
                        .find(b => /^Configurar$/.test((b.textContent||'').trim()));
                    const b = icon || cfg;
                    if (b) { b.click(); return true; }
                    return false;
                }"""
            )
            assert opened, "Could not find Settings or Configurar button on /monitor"
            await page.wait_for_selector('[role="dialog"]', timeout=6000)
            await page.screenshot(path=str(OUT / "2_dialog_open.png"))


            # Open Slides master list and make sure Resumo is enabled.
            await page.locator('[role="tab"]:has-text("Slides")').click()
            await page.wait_for_timeout(150)
            # If Resumo tile has no Check icon, click it to enable.
            tile = page.locator('[role="dialog"] button:has-text("Resumo"):has-text("Total de registros")')
            try:
                already = await tile.locator('svg.lucide-check').count() > 0
                if not already:
                    await tile.click()
            except Exception:
                pass

            # Open per-slide Resumo tab.
            await page.locator('[role="tab"]:has-text("Resumo")').click()
            await page.wait_for_timeout(300)
            await page.screenshot(path=str(OUT / "3_resumo_tab.png"))

            # --- 1) Preview present ---
            has_preview = await page.locator('[role="dialog"]:has-text("Pré-visualização")').count() > 0
            assert has_preview, "Pré-visualização card not rendered"
            r0 = await read_remaining(page)
            assert r0 and r0 > 0, f"countdown not active (got {r0})"
            print(f"✓ preview rendered, initial countdown = {r0:.1f}s")

            # --- 2) Countdown ticks down ---
            await page.wait_for_timeout(1600)
            r1 = await read_remaining(page)
            assert r1 is not None and r1 < r0 - 0.5, f"countdown not decreasing ({r0} → {r1})"
            print(f"✓ countdown ticking ({r0:.1f}s → {r1:.1f}s)")

            # --- 3) Repetir resets the countdown ---
            await page.locator('[role="dialog"] button:has-text("Repetir")').click()
            await page.wait_for_timeout(250)
            r2 = await read_remaining(page)
            assert r2 is not None and r2 > r1 + 0.5, f"Repetir did not restart countdown ({r1} → {r2})"
            print(f"✓ Repetir restarted countdown ({r1:.1f}s → {r2:.1f}s)")
            await page.screenshot(path=str(OUT / "4_after_repetir.png"))

            # --- 4) Changing duration restarts the preview at new value ---
            await page.evaluate(
                """() => {
                    const sel = document.querySelector('[role="dialog"] select');
                    sel.value = '30000';
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                }"""
            )
            await page.wait_for_timeout(300)
            r3 = await read_remaining(page)
            assert r3 is not None and r3 > 20, f"duration change did not restart preview to ~30s (got {r3})"
            print(f"✓ duration change restarted preview at {r3:.1f}s (≈ new 30s)")
            await page.screenshot(path=str(OUT / "5_duration_30s.png"))

            # --- 5) Progress bar exists with width transition ---
            bar = await page.evaluate(
                """() => {
                    const dlg = document.querySelector('[role="dialog"]');
                    const bar = dlg.querySelector('.bg-primary');
                    if (!bar) return null;
                    const r = bar.getBoundingClientRect();
                    return { h: r.height, transition: getComputedStyle(bar).transition };
                }"""
            )
            assert bar and bar["h"] > 0 and "width" in bar["transition"], (
                f"progress bar missing/not animating: {bar}"
            )
            print(f"✓ progress bar present ({bar['transition']})")

            print("\nAll preview E2E checks passed.")
            print(f"Screenshots: {OUT}")
        except AssertionError as e:
            print(f"\n✗ FAILED: {e}")
            failures.append(str(e))
            await page.screenshot(path=str(OUT / "FAIL.png"))
        finally:
            await ctx.close()
            await browser.close()
        if failures:
            sys.exit(1)

asyncio.run(main())
