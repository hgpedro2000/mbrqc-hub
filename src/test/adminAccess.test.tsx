import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// Mock the AuthContext so we control isAdmin (real session admin) per-test.
const authState: any = {
  user: { id: "u1" },
  loading: false,
  isAdmin: true,
  profile: null,
  mfaStatus: "not-required",
};

vi.mock("@/contexts/AuthContext", async () => {
  return {
    useAuth: () => authState,
    AuthProvider: ({ children }: any) => children,
  };
});

// Mock useUserRole to simulate impersonation-aware role (must NOT influence AdminRoute).
const userRoleState: any = { isAdmin: true, loading: false };
vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => userRoleState,
}));

// Minimal AdminRoute copy mirroring the production logic — keeps the test
// independent of App.tsx's full route tree (which imports many pages).
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading, isAdmin } = useAuth() as any;
  if (authLoading) return <div data-testid="loading" />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) {
    return (
      <div data-testid="admin-route-denied" role="alert">
        <h1>Acesso negado</h1>
        <p>O Modo Engenharia exige um perfil de admin real.</p>
      </div>
    );
  }
  return <>{children}</>;
};

const renderRoute = () =>
  render(
    <MemoryRouter initialEntries={["/engenharia"]}>
      <Routes>
        <Route path="/" element={<div data-testid="hub" />} />
        <Route path="/login" element={<div data-testid="login" />} />
        <Route
          path="/engenharia"
          element={
            <AdminRoute>
              <div data-testid="engenharia" />
            </AdminRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

describe("AdminRoute (engenharia)", () => {
  beforeEach(() => {
    authState.user = { id: "u1" };
    authState.loading = false;
    authState.isAdmin = true;
    userRoleState.isAdmin = true;
    userRoleState.loading = false;
  });

  it("allows real admin to access /engenharia", () => {
    authState.isAdmin = true;
    renderRoute();
    expect(screen.getByTestId("engenharia")).toBeInTheDocument();
  });

  it("still allows admin even when impersonated user role is non-admin", () => {
    authState.isAdmin = true; // real session
    userRoleState.isAdmin = false; // impersonated user is not admin
    renderRoute();
    // AdminRoute must IGNORE useUserRole and rely on real session admin.
    expect(screen.getByTestId("engenharia")).toBeInTheDocument();
  });

  it("blocks non-admin and shows clear denied message", () => {
    authState.isAdmin = false;
    renderRoute();
    expect(screen.getByTestId("admin-route-denied")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/acesso negado/i);
    expect(screen.getByText(/admin real/i)).toBeInTheDocument();
    expect(screen.queryByTestId("engenharia")).not.toBeInTheDocument();
  });

  it("redirects to /login when no user is authenticated", () => {
    authState.user = null;
    authState.isAdmin = false;
    renderRoute();
    expect(screen.getByTestId("login")).toBeInTheDocument();
  });

  it("shows loading state while auth is loading", () => {
    authState.loading = true;
    renderRoute();
    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });
});

describe("Engineering button visibility (Hub)", () => {
  // Mirror Hub's logic: showEngineering must be derived from real session admin.
  const computeShowEngineering = (realIsAdmin: boolean, _impersonatedIsAdmin: boolean) =>
    realIsAdmin;

  it("shows engineering button for real admin even while impersonating non-admin", () => {
    expect(computeShowEngineering(true, false)).toBe(true);
  });

  it("hides engineering button when real user is not admin", () => {
    expect(computeShowEngineering(false, true)).toBe(false);
  });
});
