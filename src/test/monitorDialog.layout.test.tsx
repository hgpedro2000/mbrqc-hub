/**
 * Layout-contract tests for MonitorDialog.
 *
 * Pure jsdom has no real layout engine, so instead of measuring pixels we
 * assert on the structural CSS classes that prevent the clipping the user
 * reported (V2 card cut off, "Últimos Lançamen…" truncated tab, footer
 * pushed off-screen on mobile). If anyone removes them again, this test
 * fails loudly before it ships.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isAdmin: true }),
}));

import { MonitorDialog, defaultPrefs } from "@/components/apontamento/MonitorDialog";

const renderOpen = () =>
  render(
    <MemoryRouter>
      <MonitorDialog
        open
        onOpenChange={() => {}}
        initial={{ ...defaultPrefs, blocks: ["summary", "recent", "alerts", "consumiveis"] }}
        onConfirm={() => {}}
      />
    </MemoryRouter>,
  );

describe("MonitorDialog — responsive layout contract", () => {
  it("renders the DialogContent as a full-viewport panel that never clips", () => {
    renderOpen();
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).toBeTruthy();
    const cls = dialog.className;
    // Mobile: full viewport
    expect(cls).toMatch(/w-screen/);
    expect(cls).toMatch(/h-\[100dvh\]/);
    expect(cls).toMatch(/max-w-none/);
    // Desktop: large bounded panel
    expect(cls).toMatch(/sm:max-w-\[1400px\]/);
    expect(cls).toMatch(/sm:h-\[92vh\]/);
    // Flex column so the inner area can scroll instead of the dialog itself
    expect(cls).toMatch(/flex-col/);
  });

  it("does NOT truncate tab labels (regression: 'Últimos Lançamen…')", () => {
    renderOpen();
    // Tab for the "recent" slide must show full title
    expect(screen.getByRole("tab", { name: /Últimos Lançamentos/i })).toBeInTheDocument();
    // None of the tabs should carry a max-w-[140px] truncate class anymore
    document.querySelectorAll('[role="tab"]').forEach((el) => {
      expect(el.className).not.toMatch(/max-w-\[140px\]/);
      el.querySelectorAll("span").forEach((s) => {
        expect(s.className).not.toMatch(/truncate/);
      });
    });
  });

  it("keeps a single scroll surface (inner content scrolls, header/footer stay put)", () => {
    renderOpen();
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    const scrollers = dialog.querySelectorAll(".overflow-y-auto");
    expect(scrollers.length).toBeGreaterThanOrEqual(1);
    const main = Array.from(scrollers).find((el) =>
      el.className.includes("flex-1") && el.className.includes("min-h-0"),
    );
    expect(main, "main content area must be flex-1 min-h-0 overflow-y-auto").toBeTruthy();
  });

  it("renders BOTH profile cards fully (V2 card no longer cut off on the right)", () => {
    renderOpen();
    expect(screen.getByText(/Layout original com slides essenciais/i)).toBeInTheDocument();
    expect(screen.getByText(/V2 — Detalhado/)).toBeInTheDocument();
    // ChoiceCard must use min-w-0 so flex children can shrink instead of overflowing
    const v2 = screen.getByText(/V2 — Detalhado/).closest("button")!;
    expect(v2.className).toMatch(/min-w-0/);
    expect(v2.className).not.toMatch(/min-w-\[180px\]/);
  });

  it("footer is sticky (shrink-0, safe-area aware) so Confirmar is always visible", () => {
    renderOpen();
    const confirm = screen.getByRole("button", { name: /Abrir Monitor/i });
    const footer = confirm.parentElement as HTMLElement;
    expect(footer.className).toMatch(/shrink-0/);
    expect(footer.className).toMatch(/border-t/);
    expect(footer.className).toMatch(/safe-area-inset-bottom/);
  });
});
