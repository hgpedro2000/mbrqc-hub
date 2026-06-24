/**
 * E2E test for the admin "Resetar senha" popup inside the Help Desk
 * (ErrorReportsTab). Simulates a logged-in admin opening a "Reset de Senha"
 * ticket and exercises BOTH buttons:
 *   1. "Senha provisória" → custom password flow
 *   2. "Gerar senha segura" → secure temporary password flow
 *
 * For each path we assert:
 *   - supabase.functions.invoke('reset-user-password', ...) is called
 *     with the correct user_id and new_password
 *   - the ticket data is sent so the backend closes it atomically
 *   - the success screen shows the applied password
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

// --- Mocks ---------------------------------------------------------------

const { invokeMock, updateMock, updateEqMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  updateEqMock: vi.fn().mockResolvedValue({ error: null }),
  updateMock: vi.fn(),
}));
updateMock.mockImplementation(() => ({ eq: updateEqMock }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "admin-uid" },
    profile: { full_name: "Admin Tester" },
    isAdmin: true,
    loading: false,
    mfaStatus: "verified",
  }),
}));

vi.mock("@/integrations/supabase/client", () => {
  const RESET_TICKET = {
    id: "ticket-1",
    numero: "HD-0001",
    status: "pendente",
    module: "Reset de Senha",
    user_id: "user-to-reset",
    user_name: "João Operador",
    description: "Esqueci minha senha",
    admin_notes: "",
    created_at: new Date("2026-06-21T12:00:00Z").toISOString(),
    photos: [],
  };
  const orderMock = vi
    .fn()
    .mockResolvedValue({ data: [RESET_TICKET], error: null });
  const selectMock = vi.fn(() => ({ order: orderMock }));

  return {
    supabase: {
      from: vi.fn(() => ({
        select: selectMock,
        update: updateMock,
        delete: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      })),
      functions: { invoke: invokeMock },
    },
  };
});

import ErrorReportsTab from "@/components/engenharia/ErrorReportsTab";

const renderTab = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ErrorReportsTab />
      <Toaster />
    </QueryClientProvider>
  );
};

const openTicketAndResetDialog = async (mode: "custom" | "default") => {
  // Wait until the ticket row renders.
  const row = await screen.findByText("João Operador");
  fireEvent.click(row);

  // Detail dialog opens — contains the two reset-mode buttons.
  const triggerLabel =
    mode === "custom" ? /Senha provisória/i : /Reset padrão/i;
  const trigger = await screen.findByRole("button", { name: triggerLabel });
  fireEvent.click(trigger);
};

beforeEach(() => {
  invokeMock.mockReset();
  updateMock.mockClear();
  updateEqMock.mockClear();
});

describe("ErrorReportsTab — Resetar senha popup (admin E2E)", () => {
  it("custom password: invokes reset-user-password with the typed password and resolves the ticket", async () => {
    invokeMock.mockResolvedValue({
      data: { success: true, temporary_password: "Provisoria!123" },
      error: null,
    });

    renderTab();
    await openTicketAndResetDialog("custom");

    // Reset dialog title.
    expect(
      await screen.findByRole("heading", { name: /Cadastrar senha provisória/i })
    ).toBeInTheDocument();

    const input = screen.getByLabelText(/Nova senha/i) as HTMLInputElement;
    expect(input.readOnly).toBe(false);
    fireEvent.change(input, { target: { value: "Provisoria!123" } });

    const apply = screen.getByRole("button", {
      name: /Cadastrar senha provisória/i,
    });
    expect(apply).toBeEnabled();
    fireEvent.click(apply);

    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));
    expect(invokeMock).toHaveBeenCalledWith("reset-user-password", {
      body: expect.objectContaining({
        user_id: "user-to-reset",
        new_password: "Provisoria!123",
        ticket_id: "ticket-1",
      }),
    });

    const invokePayload = invokeMock.mock.calls[0][1].body as any;
    expect(invokePayload.admin_notes).toMatch(/provisória/i);
    expect(invokePayload.admin_notes).toMatch(/Admin Tester/);

    // Success screen reveals the password.
    expect(await screen.findByText("Provisoria!123")).toBeInTheDocument();
    expect(
      screen.getByText(/Senha redefinida com sucesso/i)
    ).toBeInTheDocument();
  });

  it("default reset: invokes reset-user-password without a fixed password and marks ticket resolvido", async () => {
    invokeMock.mockResolvedValue({
      data: { success: true, temporary_password: "Mobis@SecureA1" },
      error: null,
    });

    renderTab();
    await openTicketAndResetDialog("default");

    expect(
      await screen.findByRole("heading", { name: /Reset padrão/i })
    ).toBeInTheDocument();

    const apply = screen.getByRole("button", { name: /Gerar e aplicar/i });
    fireEvent.click(apply);

    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));
    expect(invokeMock).toHaveBeenCalledWith("reset-user-password", {
      body: expect.objectContaining({
        user_id: "user-to-reset",
        new_password: undefined,
        ticket_id: "ticket-1",
      }),
    });

    const invokePayload = invokeMock.mock.calls[0][1].body as any;
    expect(invokePayload.admin_notes).toMatch(/temporária segura/i);

    // Success screen with generated password visible + copy button.
    const successDialog = await screen.findByText("Mobis@SecureA1");
    expect(successDialog).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Concluir/i })).toBeEnabled();
  });

  it("blocks the apply button when the custom password is shorter than 6 chars", async () => {
    renderTab();
    await openTicketAndResetDialog("custom");

    const input = screen.getByLabelText(/Nova senha/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "123" } });

    const apply = screen.getByRole("button", {
      name: /Cadastrar senha provisória/i,
    });
    expect(apply).toBeDisabled();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("surfaces the edge-function error and does NOT resolve the ticket on failure", async () => {
    invokeMock.mockResolvedValue({
      data: { error: "Forbidden: admin role required" },
      error: { message: "Forbidden: admin role required" },
    });

    renderTab();
    await openTicketAndResetDialog("default");

    const apply = screen.getByRole("button", { name: /Gerar e aplicar/i });
    fireEvent.click(apply);

    await waitFor(() => expect(invokeMock).toHaveBeenCalled());

    // No resolvido-update should have been issued on failure.
    await waitFor(() => {
      expect(updateMock).not.toHaveBeenCalled();
    });

    // Success view must NOT appear.
    expect(
      screen.queryByText(/Senha redefinida com sucesso/i)
    ).not.toBeInTheDocument();
  });
});
