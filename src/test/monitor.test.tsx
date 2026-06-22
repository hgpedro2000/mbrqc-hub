import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";

// --- Mock supabase client used by Monitor + MonitorDialog ---
// We capture the subscribe callback so tests can drive realtime state transitions,
// and we capture the postgres_changes handlers so we can fire fake events.
type Handler = (payload: any) => void;
const handlers: Record<string, Handler> = {};
let subscribeCb: ((status: string) => void) | null = null;
const removeChannel = vi.fn();

const fromMock = vi.fn(() => {
  const builder: any = {
    select: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    order: vi.fn(() => Promise.resolve({ data: [], error: null })),
    then: (resolve: any) => resolve({ data: [], error: null }),
  };
  return builder;
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => fromMock(table),
    channel: vi.fn(() => {
      const ch: any = {
        on: vi.fn((_evt: string, cfg: { table: string }, cb: Handler) => {
          handlers[cfg.table] = cb;
          return ch;
        }),
        subscribe: vi.fn((cb: (s: string) => void) => {
          subscribeCb = cb;
          return ch;
        }),
      };
      return ch;
    }),
    removeChannel,
  },
}));

import Monitor from "@/pages/Monitor";

beforeEach(() => {
  // Default preferences: only "summary" block so we can validate selective rendering.
  localStorage.setItem(
    "monitor_preferences",
    JSON.stringify({ blocks: ["summary"], period: "today", theme: "dark" }),
  );
  subscribeCb = null;
  Object.keys(handlers).forEach((k) => delete handlers[k]);
});

describe("Monitor — renders only selected blocks", () => {
  it("renders the Summary block and omits non-selected ones", async () => {
    render(<Monitor />);
    await waitFor(() => {
      expect(screen.getByText(/Resumo do Período/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Últimos Registros/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Alertas Vigentes/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Contenções Ativas/i)).not.toBeInTheDocument();
  });

  it("uses a CSS grid sized to the number of selected blocks", () => {
    render(<Monitor />);
    const grid = screen.getByTestId("monitor-grid");
    // With 1 block selected we expect 1 column.
    expect(grid.getAttribute("style")).toMatch(/grid-template-columns:\s*repeat\(1,/);
  });
});

describe("Monitor — connection indicator reflects realtime state transitions", () => {
  it("starts in 'connecting' state", () => {
    render(<Monitor />);
    expect(screen.getByTestId("monitor-conn").getAttribute("data-state")).toBe("connecting");
  });

  it("switches to 'connected' when the channel subscribes", async () => {
    render(<Monitor />);
    expect(subscribeCb).toBeTruthy();
    act(() => subscribeCb!("SUBSCRIBED"));
    await waitFor(() => {
      expect(screen.getByTestId("monitor-conn").getAttribute("data-state")).toBe("connected");
    });
    expect(screen.getByText(/Conectado/i)).toBeInTheDocument();
  });

  it("switches to 'error' on CHANNEL_ERROR/TIMED_OUT/CLOSED and back on reconnect", async () => {
    render(<Monitor />);
    act(() => subscribeCb!("SUBSCRIBED"));
    await waitFor(() => expect(screen.getByTestId("monitor-conn").getAttribute("data-state")).toBe("connected"));

    act(() => subscribeCb!("CHANNEL_ERROR"));
    await waitFor(() => expect(screen.getByTestId("monitor-conn").getAttribute("data-state")).toBe("error"));
    expect(screen.getByText(/Sem conexão/i)).toBeInTheDocument();

    act(() => subscribeCb!("TIMED_OUT"));
    await waitFor(() => expect(screen.getByTestId("monitor-conn").getAttribute("data-state")).toBe("error"));

    // Reconnect
    act(() => subscribeCb!("SUBSCRIBED"));
    await waitFor(() => expect(screen.getByTestId("monitor-conn").getAttribute("data-state")).toBe("connected"));
  });
});

describe("Monitor — realtime events trigger refetch without reload", () => {
  it("registers postgres_changes handlers for the 4 tracked tables", () => {
    render(<Monitor />);
    expect(Object.keys(handlers).sort()).toEqual(
      ["alertas_qualidade", "apontamentos", "consumable_items", "contencao"],
    );
  });

  it("invoking a realtime handler does not unmount/reload the component", () => {
    const { container } = render(<Monitor />);
    const before = container.querySelector('[data-testid="monitor-root"]');
    expect(before).toBeInTheDocument();

    // Fire a fake INSERT event on apontamentos
    act(() => handlers["apontamentos"]({ eventType: "INSERT", new: { id: "x" } }));

    const after = container.querySelector('[data-testid="monitor-root"]');
    // Same DOM node = no remount, no page reload.
    expect(after).toBe(before);
  });

  it("cleans up the realtime channel on unmount", () => {
    const { unmount } = render(<Monitor />);
    unmount();
    expect(removeChannel).toHaveBeenCalled();
  });
});
