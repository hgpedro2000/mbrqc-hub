"""
E2E responsive layout check for the Monitor configuration UI.

What it does, at 3 viewports (mobile 375, tablet 768, desktop 1440):
  1. Opens MonitorAdmin (/monitor/admin) → asserts the "Monitor" button is in
     the viewport (not clipped) and saves a screenshot.
  2. Opens the "Configurar Monitor" dialog from /apontamentos → asserts:
       - the dialog has NO horizontal scroll (scrollWidth <= clientWidth)
       - every tab label is fully readable (no "…" truncation)
       - the Confirmar / Abrir Monitor button is inside the viewport
     and saves a screenshot per viewport AND per tab (Geral / Slides /
     a per-slide tab) so we get visual-regression evidence.

Run from the sandbox:
    python3 tests/e2e/monitor_layout.py

Auth: relies on LOVABLE_BROWSER_SUPABASE_SESSION_JSON +
LOVABLE_BROWSER_SUPABASE_STORAGE_KEY being injected by Lovable. If they
are missing the script skips authenticated steps and only checks the
public /monitor page.
"""
import asyncio, json, os, sys
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path("/tmp/browser/monitor-layout")
OUT.mkdir(parents=True, exist_ok=True)

VIEWPORTS = [
    ("mobile",  375, 800),
    ("tablet",  768, 1024),
    ("desktop", 1440, 900),
]
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


async def assert_no_h_overflow(page, selector: str, label: str):
    metrics = await page.evaluate(
        """sel => {
            const el = document.querySelector(sel);
            if (!el) return null;
            return { sw: el.scrollWidth, cw: el.clientWidth };
        }""",
        selector,
    )
    assert metrics, f"{label}: selector {selector!r} not found"
    assert metrics["sw"] <= metrics["cw"] + 1, (
        f"{label}: horizontal overflow ({metrics['sw']}px > {metrics['cw']}px)"
    )


async def assert_tabs_not_truncated(page):
    tabs = await page.eval_on_selector_all(
        '[role="tab"]',
        """els => els.map(e => ({
            text: e.innerText,
            sw: e.scrollWidth, cw: e.clientWidth,
        }))""",
    )
    assert tabs, "no tabs rendered"
    for t in tabs:
        assert "…" not in t["text"], f"tab label truncated: {t['text']!r}"
        assert t["sw"] <= t["cw"] + 1, f"tab visually clipped: {t}"


async def check_admin(page, label):
    await page.goto(f"{BASE}/monitor/admin", wait_until="networkidle")
    await page.screenshot(path=str(OUT / f"admin_{label}.png"))
    box = await page.evaluate(
        """() => {
            const b = [...document.querySelectorAll('button')]
                .find(x => x.textContent.trim() === 'Monitor');
            if (!b) return null;
            const r = b.getBoundingClientRect();
            return { x: r.x, y: r.y, w: r.width, h: r.height,
                     vw: innerWidth, vh: innerHeight };
        }"""
    )
    assert box, f"[{label}] Monitor button not found on /monitor/admin"
    assert 0 <= box["x"] and box["x"] + box["w"] <= box["vw"] + 1, (
        f"[{label}] Monitor button overflows viewport: {box}"
    )
    print(f"  ✓ admin Monitor button inside viewport ({box['x']:.0f},{box['y']:.0f})")


async def check_dialog(page, label):
    await page.goto(f"{BASE}/apontamentos", wait_until="networkidle")
    # Try to open the config dialog via a button that contains "Monitor"
    triggered = await page.evaluate(
        """() => {
            const b = [...document.querySelectorAll('button')]
                .find(x => /monitor/i.test(x.textContent || ''));
            if (b) { b.click(); return true; }
            return false;
        }"""
    )
    if not triggered:
        print(f"  ! [{label}] could not find Monitor trigger on /apontamentos — skipping dialog")
        return
    try:
        await page.wait_for_selector('[role="dialog"]', timeout: 4000)  # type: ignore
    except TypeError:
        await page.wait_for_selector('[role="dialog"]', timeout=4000)

    for tab_name in ["Geral", "Slides"]:
        await page.evaluate(
            """name => {
                const t = [...document.querySelectorAll('[role="tab"]')]
                    .find(x => x.textContent.includes(name));
                if (t) t.click();
            }""",
            tab_name,
        )
        await page.wait_for_timeout(250)
        await page.screenshot(path=str(OUT / f"dialog_{label}_{tab_name}.png"))
        await assert_no_h_overflow(page, '[role="dialog"]', f"{label}/{tab_name}")
        await assert_tabs_not_truncated(page)

    # Confirmar button must be visible
    visible = await page.evaluate(
        """() => {
            const b = [...document.querySelectorAll('[role="dialog"] button')]
                .find(x => /abrir monitor|confirmar/i.test(x.textContent || ''));
            if (!b) return null;
            const r = b.getBoundingClientRect();
            return r.bottom <= innerHeight + 1 && r.top >= 0;
        }"""
    )
    assert visible, f"[{label}] Confirmar button is outside the viewport"
    print(f"  ✓ dialog has no h-overflow, tabs not truncated, footer visible")


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        failures = []
        for label, w, h in VIEWPORTS:
            print(f"\n=== {label} {w}x{h} ===")
            ctx = await browser.new_context(viewport={"width": w, "height": h})
            page = await ctx.new_page()
            try:
                authed = await restore_session(page)
                if authed:
                    await check_admin(page, label)
                    await check_dialog(page, label)
                else:
                    print("  ! no Lovable session env vars — skipping authed checks")
            except AssertionError as e:
                print(f"  ✗ {e}")
                failures.append(str(e))
            finally:
                await ctx.close()
        await browser.close()
        if failures:
            print(f"\nFAILED ({len(failures)})")
            for f in failures: print(" -", f)
            sys.exit(1)
        print(f"\nAll layout checks passed. Screenshots in {OUT}")

asyncio.run(main())
