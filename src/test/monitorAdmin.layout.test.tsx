/**
 * Layout-contract test for MonitorAdmin header.
 *
 * Regression guard: the "Monitor" button in the top-right must always be
 * rendered AND must use a flex-wrap header so it never gets pushed off
 * screen on narrow viewports.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ isAdmin: true }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const b: any = {
        select: () => b, order: () => b, update: () => b, insert: () => b,
        delete: () => b, eq: () => b,
        then: (r: any) => r({ data: [], error: null }),
      };
      return b;
    },
    storage: { from: () => ({ createSignedUrl: vi.fn(), upload: vi.fn(), remove: vi.fn() }) },
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "a" } }, error: null }) },
  },
}));

import MonitorAdmin from "@/pages/MonitorAdmin";

describe("MonitorAdmin — responsive header contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders header with flex-wrap so all 3 elements stay visible at any width", async () => {
    render(<MemoryRouter><MonitorAdmin /></MemoryRouter>);
    const title = await screen.findByText(/Mídia dos Slides do Monitor/i);
    const header = title.parentElement as HTMLElement;
    expect(header.className).toMatch(/flex-wrap/);
    expect(header.className).toMatch(/justify-between/);
  });

  it("keeps the 'Monitor' button visible (regression: was clipped on narrow screens)", async () => {
    render(<MemoryRouter><MonitorAdmin /></MemoryRouter>);
    const btn = await screen.findByRole("button", { name: /^Monitor$/i });
    expect(btn).toBeInTheDocument();
    expect(btn.className).not.toMatch(/hidden/);
  });
});
