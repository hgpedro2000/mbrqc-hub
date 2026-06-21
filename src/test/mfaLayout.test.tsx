import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ refreshMFAStatus: vi.fn(), signOut: vi.fn() }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      mfa: {
        listFactors: vi.fn().mockResolvedValue({
          data: { totp: [{ id: "f1", status: "verified" }] },
          error: null,
        }),
        challenge: vi.fn(),
        verify: vi.fn(),
      },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/assets/hyundai-mobis-logo.png", () => ({ default: "logo.png" }));

import MfaVerify from "@/pages/MfaVerify";

describe("MfaVerify layout & UX", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders title, contextual hint and Verify button", async () => {
    render(<MemoryRouter><MfaVerify /></MemoryRouter>);
    expect(screen.getByText(/Verificação em 2 etapas/i)).toBeInTheDocument();
    // Step-by-step hint
    expect(screen.getByText(/Google Authenticator/i)).toBeInTheDocument();
    expect(screen.getByText(/Digite os 6 dígitos abaixo/i)).toBeInTheDocument();
    // Primary CTA + escape hatch
    expect(screen.getByRole("button", { name: /Verificar e entrar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sair e usar outra conta/i })).toBeInTheDocument();
  });

  it("renders 6 OTP slots split 3 + 3 with a separator", () => {
    const { container } = render(<MemoryRouter><MfaVerify /></MemoryRouter>);
    const slots = container.querySelectorAll('[data-active]');
    expect(slots.length).toBe(6);
    expect(container.textContent).toMatch(/–/);
  });

  it("Verify button is disabled until 6 digits are entered", () => {
    render(<MemoryRouter><MfaVerify /></MemoryRouter>);
    const btn = screen.getByRole("button", { name: /Verificar e entrar/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("OTP slots use the responsive size classes (mobile + sm breakpoint)", () => {
    const { container } = render(<MemoryRouter><MfaVerify /></MemoryRouter>);
    const slot = container.querySelector('[data-active]') as HTMLElement;
    expect(slot.className).toMatch(/h-14/);
    expect(slot.className).toMatch(/sm:h-16/);
    expect(slot.className).toMatch(/font-mono/);
  });
});
