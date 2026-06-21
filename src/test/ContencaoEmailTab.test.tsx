import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ContencaoEmailTab from "../engenharia/ContencaoEmailTab";

// ---- Mocks ----
const invoke = vi.fn();
const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
const insertMock = vi.fn().mockResolvedValue({ error: null });

const configs = [
  {
    id: "cfg-iniciada", name: "Contenção — Iniciada", modulo: "contencao",
    subtipo: "iniciada", enabled: true,
    recipients: ["a@a.com"], error_notify_recipients: [],
    subject_template: "Contenção #{{numero}}",
    message_body: "Body {{numero}}",
    last_sent_at: null,
  },
];

const logs = [
  {
    id: "log-1", config_id: "cfg-iniciada", entity_id: "ctn-1",
    subject: "Contenção #001", status: "failed",
    tipo_disparo: "evento", trigger_type: "evento", attempt: 1,
    error_message: "boom", created_at: new Date().toISOString(),
    recipients: ["a@a.com"],
  },
];

vi.mock("@/integrations/supabase/client", () => {
  const fromMock = (table: string) => {
    if (table === "email_automation_config") {
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: configs, error: null }),
        }),
        update: updateMock,
      };
    }
    if (table === "email_automation_log") {
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: logs, error: null }),
            }),
          }),
        }),
        insert: insertMock,
      };
    }
    return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
  };
  return {
    supabase: {
      from: fromMock,
      functions: { invoke: (...args: any[]) => invoke(...args) },
    },
  };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ContencaoEmailTab />
    </QueryClientProvider>,
  );
}

describe("ContencaoEmailTab — UI flows", () => {
  beforeEach(() => {
    invoke.mockReset();
    insertMock.mockClear();
  });

  it("renders config card and history panel with the seeded data", async () => {
    renderTab();
    expect(await screen.findByText("Contenção — Iniciada")).toBeInTheDocument();
    expect(await screen.findByText(/Status por subtipo/i)).toBeInTheDocument();
    expect(await screen.findByText(/Histórico de envios/i)).toBeInTheDocument();
    expect(await screen.findByText("Contenção #001")).toBeInTheDocument();
  });

  it("Preview button calls send-contencao-email with preview=true", async () => {
    invoke.mockResolvedValue({ data: { subject: "S", html: "<html>x</html>" }, error: null });
    renderTab();
    const btn = await screen.findByRole("button", { name: /preview/i });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        "send-contencao-email",
        expect.objectContaining({
          body: expect.objectContaining({ config_id: "cfg-iniciada", preview: true, subtipo: "iniciada" }),
        }),
      );
    });
  });

  it("Teste button calls invoke with test_to=email", async () => {
    invoke.mockResolvedValue({ data: { ok: true, queued: 1 }, error: null });
    renderTab();
    const input = await screen.findByPlaceholderText(/teste@exemplo\.com/i);
    fireEvent.change(input, { target: { value: "qa@mbr.com" } });
    const testBtn = await screen.findByRole("button", { name: /^teste$/i });
    fireEvent.click(testBtn);
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        "send-contencao-email",
        expect.objectContaining({
          body: expect.objectContaining({ test_to: "qa@mbr.com", config_id: "cfg-iniciada" }),
        }),
      );
    });
  });

  it("Reenviar button passes contencao_id and resend=true", async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    renderTab();
    const resendBtn = await screen.findByRole("button", { name: /reenviar/i });
    fireEvent.click(resendBtn);
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        "send-contencao-email",
        expect.objectContaining({
          body: expect.objectContaining({
            config_id: "cfg-iniciada",
            contencao_id: "ctn-1",
            resend: true,
            subtipo: "iniciada",
          }),
        }),
      );
    });
  });

  it("status panel shows aggregated counts per subtipo (incl. failed)", async () => {
    renderTab();
    // wait for history to render
    await screen.findByText(/Histórico de envios/i);
    // failure counter must appear (>=1)
    const falhas = await screen.findAllByText(/Falhas/i);
    expect(falhas.length).toBeGreaterThan(0);
  });
});
