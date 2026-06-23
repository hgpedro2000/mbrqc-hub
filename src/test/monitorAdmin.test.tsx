import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => {
  const fromMock = vi.fn((_table: string) => {
    const builder: any = {
      select: vi.fn(() => builder),
      order: vi.fn(() => builder),
      update: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      then: (resolve: any) => resolve({ data: [], error: null }),
    };
    return builder;
  });
  return { fromMock };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => mocks.fromMock(table),
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: null }),
        upload: vi.fn().mockResolvedValue({ data: null, error: null }),
        remove: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    },
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-1" } }, error: null }) },
  },
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import MonitorAdmin from "@/pages/MonitorAdmin";

describe("MonitorAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the top-right Monitor button and opens /monitor without MFA", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(<MemoryRouter><MonitorAdmin /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText(/Mídia dos Slides do Monitor/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /^Monitor$/i }));

    expect(openSpy).toHaveBeenCalledWith(
      "/monitor",
      "_blank",
      expect.stringContaining("width=1920"),
    );
  });
});