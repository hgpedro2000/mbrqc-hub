import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isAdmin: true }),
}));

// --- Mock supabase client used by Monitor ---
// We capture the subscribe callback so tests can drive realtime state transitions,
// and we capture the postgres_changes handlers so we can fire fake events.
const mocks = vi.hoisted(() => {
  const handlers: Record<string, (payload: any) => void> = {};
  const state: { subscribeCb: ((s: string) => void) | null } = { subscribeCb: null };
  const removeChannel = vi.fn();
  const fromMock = vi.fn((_table: string) => {
    const builder: any = {
      select: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      neq: vi.fn(() => builder),
      in: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      order: vi.fn(() => builder),
      then: (resolve: any) => resolve({ data: [], error: null }),
    };
    return builder;
  });
  return { handlers, state, removeChannel, fromMock };
});

vi.mock("@/integrations/supabase/monitor-client", () => ({
  monitorClient: {
    from: (table: string) => mocks.fromMock(table),
    storage: { from: vi.fn(() => ({ createSignedUrl: vi.fn() })) },
    channel: vi.fn(() => {
      const ch: any = {
        on: vi.fn((_evt: string, cfg: { table: string }, cb: (p: any) => void) => {
          mocks.handlers[cfg.table] = cb;
          return ch;
        }),
        subscribe: vi.fn((cb: (s: string) => void) => {
          mocks.state.subscribeCb = cb;
          return ch;
        }),
      };
      return ch;
    }),
    removeChannel: mocks.removeChannel,
  },
}));

import Monitor from "@/pages/Monitor";
import { loadPrefs } from "@/components/apontamento/MonitorDialog";

const renderMonitor = () => render(<MemoryRouter><Monitor /></MemoryRouter>);

beforeEach(() => {
  // Two blocks so we have a "next" slide to preload.
  localStorage.setItem(
    "monitor_preferences",
    JSON.stringify({ blocks: ["summary", "recent"], period: "today", theme: "dark" }),
  );
  mocks.state.subscribeCb = null;
  Object.keys(mocks.handlers).forEach((k) => delete mocks.handlers[k]);
  mocks.removeChannel.mockClear();
  mocks.fromMock.mockClear();
});

describe("Monitor — renders only selected blocks (current slide only)", () => {
  it("renders the active Summary slide title in the header", async () => {
    renderMonitor();
    await waitFor(() => {
      expect(screen.getByText(/Resumo do Período/i)).toBeInTheDocument();
    });
  });

  it("scales the entire UI inside a 1920x1080 stage so it never gets cut", () => {
    renderMonitor();
    const stage = screen.getByTestId("monitor-stage");
    const style = stage.getAttribute("style") || "";
    expect(style).toMatch(/width:\s*1920px/);
    expect(style).toMatch(/height:\s*1080px/);
    expect(style).toMatch(/transform:\s*scale\(/);
  });

  it("pre-renders the next slide off-screen for smoother transitions", () => {
    renderMonitor();
    expect(screen.getByTestId("monitor-preload")).toBeInTheDocument();
  });

  it("exposes a fullscreen (kiosk) toggle button", () => {
    renderMonitor();
    expect(screen.getByLabelText(/Tela cheia/i)).toBeInTheDocument();
  });

  it("loads saved per-slide duration and animation settings after reload", async () => {
    localStorage.setItem(
      "monitor_preferences",
      JSON.stringify({
        blocks: ["summary", "recent"],
        period: "today",
        theme: "dark",
        slideDurationMs: 5000,
        animationsEnabled: true,
        blockSettings: {
          summary: { durationMs: 15000, animations: false },
          recent: { durationMs: 8000, animations: true },
        },
      }),
    );

    expect(loadPrefs().blockSettings?.summary?.durationMs).toBe(15000);
    renderMonitor();

    await waitFor(() => {
      expect(screen.getByText(/Auto 15s/i)).toBeInTheDocument();
    });
  });
});

describe("Monitor — connection indicator reflects realtime state transitions", () => {
  it("starts in 'connecting' state", () => {
    renderMonitor();
    expect(screen.getByTestId("monitor-conn").getAttribute("data-state")).toBe("connecting");
  });

  it("switches to 'connected' when the channel subscribes", async () => {
    renderMonitor();
    expect(mocks.state.subscribeCb).toBeTruthy();
    act(() => mocks.state.subscribeCb!("SUBSCRIBED"));
    await waitFor(() => {
      expect(screen.getByTestId("monitor-conn").getAttribute("data-state")).toBe("connected");
    });
    expect(screen.getByText(/Conectado/i)).toBeInTheDocument();
  });

  it("switches to 'error' on CHANNEL_ERROR/TIMED_OUT/CLOSED and back on reconnect", async () => {
    renderMonitor();
    act(() => mocks.state.subscribeCb!("SUBSCRIBED"));
    await waitFor(() => expect(screen.getByTestId("monitor-conn").getAttribute("data-state")).toBe("connected"));

    act(() => mocks.state.subscribeCb!("CHANNEL_ERROR"));
    await waitFor(() => expect(screen.getByTestId("monitor-conn").getAttribute("data-state")).toBe("error"));
    expect(screen.getByText(/Sem conexão/i)).toBeInTheDocument();

    act(() => mocks.state.subscribeCb!("TIMED_OUT"));
    await waitFor(() => expect(screen.getByTestId("monitor-conn").getAttribute("data-state")).toBe("error"));

    // Reconnect
    act(() => mocks.state.subscribeCb!("SUBSCRIBED"));
    await waitFor(() => expect(screen.getByTestId("monitor-conn").getAttribute("data-state")).toBe("connected"));
  });
});

describe("Monitor — realtime events trigger refetch without reload", () => {
  it("registers postgres_changes handlers for the 4 tracked tables", () => {
    renderMonitor();
    expect(Object.keys(mocks.handlers).sort()).toEqual(
      ["alertas_qualidade", "apontamentos", "consumable_items", "contencao"],
    );
  });

  it("invoking a realtime handler does not unmount/reload the component", () => {
    const { container } = renderMonitor();
    const before = container.querySelector('[data-testid="monitor-root"]');
    expect(before).toBeInTheDocument();

    // Fire a fake INSERT event on apontamentos
    act(() => mocks.handlers["apontamentos"]({ eventType: "INSERT", new: { id: "x" } }));

    const after = container.querySelector('[data-testid="monitor-root"]');
    // Same DOM node = no remount, no page reload.
    expect(after).toBe(before);
  });

  it("cleans up the realtime channel on unmount", () => {
    const { unmount } = renderMonitor();
    unmount();
    expect(mocks.removeChannel).toHaveBeenCalled();
  });
});
