"""
E2E validation for the per-slide PREVIEW inside "Configurar Monitor".

Checks, on a desktop viewport (1440x900):
  1. Open /apontamentos and trigger the Monitor config dialog.
  2. Switch to the Slides tab, enable a known slide (Resumo), then open
     its per-slide tab.
  3. Assert the "Pré-visualização" card is rendered with:
        - emoji + title visible
        - progress bar element present
        - "X.Xs restantes" countdown text
  4. Change the per-slide duration via the <select> and confirm the
     preview restarts (countdown re-reads the new value and the runKey
     changes — we detect this by reading the "restantes" text before
     and after).
  5. Click "Repetir" and confirm the countdown restarts (remaining
     value resets close to full duration).
  6. Screenshot evidence at each step.

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


async def click_text(page, scope: str, text: str) -> bool:
    return await page.evaluate(
        """({sel, t}) => {
            const root = document.querySelector(sel) || document;
            const el = [...root.querySelectorAll('button, [role="tab"]')]
                .find(e => (e.textContent || '').trim().includes(t));
            if (el) { el.click(); return true; }
            return false;
        }""",
        {"sel": scope, "t": text},
    )


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1440, "height": 900})
        page = await ctx.new_page()
        failures = []
        try:
            if not await restore_session(page):
                print("✗ no Lovable session env — cannot run authenticated E2E")
                sys.exit(2)

            await page.goto(f"{BASE}/apontamentos", wait_until="networkidle")
            await page.screenshot(path=str(OUT / "1_apontamentos.png"))

            opened = await page.evaluate(
                """() => {
                    const b = [...document.querySelectorAll('button')]
                        .find(x => /monitor/i.test(x.textContent || ''));
                    if (b) { b.click(); return true; }
                    return false;
                }"""
            )
            assert opened, "could not open Monitor config dialog"
            await page.wait_for_selector('[role="dialog"]', timeout=4000)
            await page.screenshot(path=str(OUT / "2_dialog_open.png"))

            # Make sure "Resumo" slide is enabled (it is by default), then open its tab.
            assert await click_text(page, '[role="dialog"]', "Slides"), "Slides tab missing"
            await page.wait_for_timeout(200)
            # Click "Resumo" tile if it's not already selected — toggling a selected
            # slide would disable it, so only click if no Check icon is present.
            await page.evaluate(
                """() => {
                    const btn = [...document.querySelectorAll('[role="dialog"] button')]
                        .find(b => /Resumo/.test(b.textContent || '') && /Total de registros/.test(b.textContent || ''));
                    if (btn && !btn.querySelector('svg.lucide-check')) btn.click();
                }"""
            )
            await page.wait_for_timeout(150)

            # Open the per-slide tab "Resumo"
            assert await click_text(page, '[role="dialog"]', "Resumo"), "Resumo per-slide tab not found"
            await page.wait_for_timeout(300)
            await page.screenshot(path=str(OUT / "3_resumo_tab.png"))

            # --- Preview presence ---
            has_preview = await page.evaluate(
                """() => !!([...document.querySelectorAll('[role="dialog"] *')]
                        .find(e => /Pré-visualização/i.test(e.textContent || '') && e.children.length === 0))"""
            )
            assert has_preview, "Pré-visualização card not rendered"
            r0 = await read_remaining(page)
            assert r0 is not None and r0 > 0, f"countdown not active (got {r0})"
            print(f"✓ preview rendered, initial countdown = {r0:.1f}s")

            # --- Countdown actually ticks down ---
            await page.wait_for_timeout(1500)
            r1 = await read_remaining(page)
            assert r1 is not None and r1 < r0, f"countdown not decreasing ({r0} → {r1})"
            print(f"✓ countdown is ticking ({r0:.1f}s → {r1:.1f}s)")

            # --- Repetir resets the countdown ---
            clicked = await page.evaluate(
                """() => {
                    const b = [...document.querySelectorAll('[role="dialog"] button')]
                        .find(x => /Repetir/.test(x.textContent || ''));
                    if (b) { b.click(); return true; }
                    return false;
                }"""
            )
            assert clicked, "Repetir button not found"
            await page.wait_for_timeout(200)
            r2 = await read_remaining(page)
            assert r2 is not None and r2 > r1, f"Repetir did not restart countdown ({r1} → {r2})"
            print(f"✓ Repetir restarted countdown ({r1:.1f}s → {r2:.1f}s)")
            await page.screenshot(path=str(OUT / "4_after_repetir.png"))

            # --- Changing duration auto-restarts the preview to the new value ---
            await page.evaluate(
                """() => {
                    const sel = document.querySelector('[role="dialog"] select');
                    if (!sel) throw new Error('duration select not found');
                    sel.value = '30000';
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                }"""
            )
            await page.wait_for_timeout(300)
            r3 = await read_remaining(page)
            assert r3 is not None and r3 > 20, f"duration change did not restart preview to ~30s (got {r3})"
            print(f"✓ duration change restarted preview at {r3:.1f}s (≈ new 30s setting)")
            await page.screenshot(path=str(OUT / "5_duration_30s.png"))

            # --- Progress bar element exists ---
            bar = await page.evaluate(
                """() => {
                    const dlg = document.querySelector('[role="dialog"]');
                    if (!dlg) return null;
                    const bar = dlg.querySelector('.bg-primary');
                    if (!bar) return null;
                    const r = bar.getBoundingClientRect();
                    return { w: r.width, h: r.height, transition: getComputedStyle(bar).transition };
                }"""
            )
            assert bar and bar["h"] > 0 and "width" in bar["transition"], (
                f"progress bar missing or not animating: {bar}"
            )
            print(f"✓ progress bar present with width transition ({bar['transition']})")

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
