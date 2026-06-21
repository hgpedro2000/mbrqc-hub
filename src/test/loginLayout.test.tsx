import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ---- Mocks -----------------------------------------------------------------
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const dict: Record<string, string> = {
        "login.title": "Quality Tools",
        "login.subtitle": "Hyundai Mobis",
        "login.employeeNumber": "N° de empregado",
        "login.password": "Senha",
        "login.enter": "Entrar",
        "login.wait": "Aguarde...",
        "login.forgotPassword": "Esqueci a senha",
      };
      return dict[key] ?? key;
    },
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ versionKicked: false, user: null, profile: null, loading: false }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() }, auth: { setSession: vi.fn() } },
}));

vi.mock("@/lib/logAction", () => ({ logAction: vi.fn() }));
vi.mock("@/lib/beep", () => ({ primeBeep: vi.fn() }));
vi.mock("sonner", () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/LanguageToggle", () => ({ default: () => <div data-testid="lang-toggle" /> }));
vi.mock("@/assets/hyundai-mobis-logo.png", () => ({ default: "logo.png" }));

import Login from "@/pages/Login";

const renderLogin = () =>
  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );

describe("Login layout & UX", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders core fields and CTA", () => {
    renderLogin();
    expect(screen.getByLabelText(/N° de empregado/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Senha/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Entrar/i })).toBeInTheDocument();
  });

  it("employee-number input opens NUMERIC keyboard by default (type=tel, inputMode=numeric)", () => {
    renderLogin();
    const input = screen.getByLabelText(/N° de empregado/i) as HTMLInputElement;
    expect(input.type).toBe("tel");
    expect(input.getAttribute("inputmode")).toBe("numeric");
    expect(input.getAttribute("pattern")).toBe("[0-9]*");
  });

  it("strips non-digits while in numeric mode", () => {
    renderLogin();
    const input = screen.getByLabelText(/N° de empregado/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "12a3b4" } });
    expect(input.value).toBe("1234");
  });

  it("'Sou Terceiro' button is discreet (no 'Visitante', no flashy gradient)", () => {
    renderLogin();
    const btn = screen.getByRole("button", { name: /Sou Terceiro/i });
    expect(btn).toBeInTheDocument();
    // minimalist: must NOT mention "Visitante" and must NOT carry the loud accent bg
    expect(btn.textContent || "").not.toMatch(/Visitante/i);
    expect(btn.className).not.toMatch(/bg-accent\/15|border-accent\/60|border-2/);
    // and it should sit in a single column (w-full) for mobile
    expect(btn.className).toMatch(/w-full/);
  });

  it("toggles to alphanumeric mode when 'Sou Terceiro' is clicked", () => {
    renderLogin();
    const toggle = screen.getByRole("button", { name: /Sou Terceiro/i });
    fireEvent.click(toggle);
    const input = screen.getByLabelText(/N° de empregado/i) as HTMLInputElement;
    expect(input.type).toBe("text");
    expect(input.getAttribute("inputmode")).toBe("text");
    fireEvent.change(input, { target: { value: "abc 123" } });
    // uppercased + spaces removed
    expect(input.value).toBe("ABC123");
    // back-button appears
    expect(screen.getByRole("button", { name: /Voltar para teclado numérico/i })).toBeInTheDocument();
  });

  it("Ajuda button is hidden by default and reveals onboarding only when clicked", () => {
    renderLogin();
    expect(screen.queryByText(/Primeira vez\? Veja onde clicar/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Ajuda/i }));
    const panel = screen.getByText(/Primeira vez\? Veja onde clicar/i);
    expect(panel).toBeInTheDocument();
    // closes on X
    const closeBtn = screen.getByRole("button", { name: /Fechar/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByText(/Primeira vez\? Veja onde clicar/i)).not.toBeInTheDocument();
  });

  it("onboarding mentions both Mobis and Terceiro paths when open", () => {
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: /Ajuda/i }));
    const heading = screen.getByText(/Primeira vez\? Veja onde clicar/i);
    const panel = heading.closest("div")!.parentElement as HTMLElement;
    // Within the onboarding panel, both keywords must appear
    expect(within(panel).getByText(/Mobis \(funcionário\)/i)).toBeInTheDocument();
    expect(within(panel).getAllByText(/Terceiro/i).length).toBeGreaterThan(0);
  });
});
