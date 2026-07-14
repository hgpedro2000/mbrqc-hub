import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { PresenceProvider } from "@/contexts/PresenceContext";
import UpdateBanner from "@/components/UpdateBanner";
import { isPasswordExpired } from "@/lib/passwordPolicy";
import ModuleGuard from "@/components/ModuleGuard";

import Hub from "./pages/Hub";
import QualidadeHub from "./pages/QualidadeHub";
import Index from "./pages/Index";
import InjectionForm from "./pages/InjectionForm";
import { PaintingPage, AssemblyPage } from "./pages/EditableChecklist";
import Dashboard from "./pages/Dashboard";
import TryoutRegistros from "./pages/TryoutRegistros";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import SolicitarResetAdmin from "./pages/SolicitarResetAdmin";
import ResetPassword from "./pages/ResetPassword";
import ChangePassword from "./pages/ChangePassword";
import Engenharia from "./pages/Engenharia";
import Auditorias from "./pages/Auditorias";
import AuditoriaForm from "./pages/AuditoriaForm";
import AuditoriaWizard from "./pages/AuditoriaWizard";
import AuditoriaDashboard from "./pages/AuditoriaDashboard";
import AuditoriaDetalhe from "./pages/AuditoriaDetalhe";
import AuditoriaAgenda from "./pages/AuditoriaAgenda";
import Contencao from "./pages/Contencao";
import ContencaoForm from "./pages/ContencaoForm";
import ContencaoDashboard from "./pages/ContencaoDashboard";
import Apontamentos from "./pages/Apontamentos";
import ApontamentoForm from "./pages/ApontamentoForm";
import ApontamentoDashboard from "./pages/ApontamentoDashboard";
import Monitor from "./pages/Monitor";
import MonitorAdmin from "./pages/MonitorAdmin";
import AlertaQualidade from "./pages/AlertaQualidade";
import AlertaQualidadeForm from "./pages/AlertaQualidadeForm";
import AlertaQualidadeView from "./pages/AlertaQualidadeView";
import AlertaQualidadeFeed from "./pages/AlertaQualidadeFeed";
import ConsumiveisPage from "./pages/ConsumiveisPage";
import ConsultaPecas from "./pages/ConsultaPecas";
import AnaliseRisco from "./pages/AnaliseRisco";
import SpecSwitchPanelCheck from "./pages/SpecSwitchPanelCheck";
import QrProfilePage from "./pages/QrProfilePage";
import MatrizVersatilidade from "./pages/MatrizVersatilidade";
import BarcodeScanner from "./pages/BarcodeScanner";
import MfaSetup from "./pages/MfaSetup";
import MfaVerify from "./pages/MfaVerify";
import AuditLogsPage from "./pages/AuditLogsPage";
import AdminPartNameFix from "./pages/AdminPartNameFix";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import NotFound from "./pages/NotFound";
import SplitFlapHarness from "./pages/SplitFlapHarness";
import SesmtHub from "./pages/SesmtHub";
import SesmtMatrizTreinamentos from "./pages/SesmtMatrizTreinamentos";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading, isAdmin, mfaStatus } = useAuth();
  const path = window.location.pathname;

  if (loading || (isAdmin && mfaStatus === "checking")) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (profile?.must_change_password && path !== "/alterar-senha") {
    return <Navigate to="/alterar-senha" replace />;
  }

  if (
    profile &&
    !profile.must_change_password &&
    isPasswordExpired(profile.password_changed_at) &&
    path !== "/alterar-senha"
  ) {
    return <Navigate to="/alterar-senha?expired=1" replace />;
  }

  if (isAdmin && mfaStatus === "not-enrolled" && path !== "/mfa-setup") {
    return <Navigate to="/mfa-setup" replace />;
  }

  if (isAdmin && mfaStatus === "needs-verify" && path !== "/mfa-verify") {
    return <Navigate to="/mfa-verify" replace />;
  }

  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  // Use real session admin (not impersonation-aware) so admins can always access engineering
  const { user, loading: authLoading, isAdmin } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) {
    return (
      <div
        role="alert"
        aria-live="polite"
        data-testid="admin-route-denied"
        className="min-h-screen bg-background flex items-center justify-center px-4"
      >
        <div className="max-w-md w-full text-center space-y-4 border border-border rounded-xl p-6 bg-card">
          <h1 className="text-xl font-heading font-bold text-foreground">Acesso negado</h1>
          <p className="text-sm text-muted-foreground">
            O Modo Engenharia exige um perfil de <strong>admin real</strong>. Sua conta atual não possui essa permissão,
            então o acesso foi bloqueado pelo backend.
          </p>
          <a
            href="/"
            className="inline-block text-sm text-primary hover:underline"
          >
            Voltar ao Hub
          </a>
        </div>
      </div>
    );
  }
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ImpersonationProvider>
          <PresenceProvider>
          <UpdateBanner />

          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/dev/splitflap" element={<SplitFlapHarness />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/esqueci-senha" element={<ForgotPassword />} />
            <Route path="/solicitar-reset-admin" element={<SolicitarResetAdmin />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/alterar-senha" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
            <Route path="/mfa-setup" element={<ProtectedRoute><MfaSetup /></ProtectedRoute>} />
            <Route path="/mfa-verify" element={<ProtectedRoute><MfaVerify /></ProtectedRoute>} />
            <Route path="/engenharia" element={<ProtectedRoute><AdminRoute><Engenharia /></AdminRoute></ProtectedRoute>} />
            <Route path="/" element={<ProtectedRoute><Hub /></ProtectedRoute>} />
            <Route path="/qualidade" element={<ProtectedRoute><ModuleGuard module="subhub_qualidade"><QualidadeHub /></ModuleGuard></ProtectedRoute>} />
            
            
            {/* Tryout */}
            <Route path="/tryout" element={<ProtectedRoute><ModuleGuard module="tryout"><Index /></ModuleGuard></ProtectedRoute>} />
            <Route path="/tryout/injecao" element={<ProtectedRoute><ModuleGuard module="tryout"><InjectionForm /></ModuleGuard></ProtectedRoute>} />
            <Route path="/tryout/injecao/editar/:id" element={<ProtectedRoute><ModuleGuard module="tryout"><InjectionForm /></ModuleGuard></ProtectedRoute>} />
            <Route path="/tryout/pintura" element={<ProtectedRoute><ModuleGuard module="tryout"><PaintingPage /></ModuleGuard></ProtectedRoute>} />
            <Route path="/tryout/pintura/editar/:id" element={<ProtectedRoute><ModuleGuard module="tryout"><PaintingPage /></ModuleGuard></ProtectedRoute>} />
            <Route path="/tryout/montagem" element={<ProtectedRoute><ModuleGuard module="tryout"><AssemblyPage /></ModuleGuard></ProtectedRoute>} />
            <Route path="/tryout/montagem/editar/:id" element={<ProtectedRoute><ModuleGuard module="tryout"><AssemblyPage /></ModuleGuard></ProtectedRoute>} />
            <Route path="/tryout/registros" element={<ProtectedRoute><ModuleGuard module="tryout"><TryoutRegistros /></ModuleGuard></ProtectedRoute>} />
            <Route path="/tryout/dashboard" element={<ProtectedRoute><ModuleGuard module="tryout"><Dashboard /></ModuleGuard></ProtectedRoute>} />
            
            {/* Auditorias */}
            <Route path="/auditorias" element={<ProtectedRoute><ModuleGuard module="auditorias"><Auditorias /></ModuleGuard></ProtectedRoute>} />
            <Route path="/auditorias/nova" element={<ProtectedRoute><ModuleGuard module="auditorias"><AuditoriaWizard /></ModuleGuard></ProtectedRoute>} />
            <Route path="/auditorias/editar/:id" element={<ProtectedRoute><ModuleGuard module="auditorias"><AuditoriaWizard /></ModuleGuard></ProtectedRoute>} />
            <Route path="/auditorias/legado/nova" element={<ProtectedRoute><ModuleGuard module="auditorias"><AuditoriaForm /></ModuleGuard></ProtectedRoute>} />
            <Route path="/auditorias/legado/editar/:id" element={<ProtectedRoute><ModuleGuard module="auditorias"><AuditoriaForm /></ModuleGuard></ProtectedRoute>} />
            <Route path="/auditorias/dashboard" element={<ProtectedRoute><ModuleGuard module="auditorias"><AuditoriaDashboard /></ModuleGuard></ProtectedRoute>} />
            <Route path="/auditorias/agenda" element={<ProtectedRoute><ModuleGuard module="auditorias"><AuditoriaAgenda /></ModuleGuard></ProtectedRoute>} />
            <Route path="/auditorias/:id" element={<ProtectedRoute><ModuleGuard module="auditorias"><AuditoriaDetalhe /></ModuleGuard></ProtectedRoute>} />
            
            {/* Contenção */}
            <Route path="/contencao" element={<ProtectedRoute><ModuleGuard module="contencao"><Contencao /></ModuleGuard></ProtectedRoute>} />
            <Route path="/contencao/nova" element={<ProtectedRoute><ModuleGuard module="contencao"><ContencaoForm /></ModuleGuard></ProtectedRoute>} />
            <Route path="/contencao/editar/:id" element={<ProtectedRoute><ModuleGuard module="contencao"><ContencaoForm /></ModuleGuard></ProtectedRoute>} />
            <Route path="/contencao/dashboard" element={<ProtectedRoute><ModuleGuard module="contencao"><ContencaoDashboard /></ModuleGuard></ProtectedRoute>} />
            
            {/* Apontamentos */}
            <Route path="/apontamentos" element={<ProtectedRoute><ModuleGuard module="apontamentos"><Apontamentos /></ModuleGuard></ProtectedRoute>} />
            <Route path="/apontamentos/novo/:tipo" element={<ProtectedRoute><ModuleGuard module="apontamentos"><ApontamentoForm /></ModuleGuard></ProtectedRoute>} />
            <Route path="/apontamentos/editar/:id" element={<ProtectedRoute><ModuleGuard module="apontamentos"><ApontamentoForm /></ModuleGuard></ProtectedRoute>} />
            <Route path="/apontamentos/ver/:id" element={<ProtectedRoute><ModuleGuard module="apontamentos"><ApontamentoForm /></ModuleGuard></ProtectedRoute>} />
            <Route path="/apontamentos/dashboard" element={<ProtectedRoute><ModuleGuard module="apontamentos"><ApontamentoDashboard /></ModuleGuard></ProtectedRoute>} />
            <Route path="/apontamentos/admin/part-name" element={<ProtectedRoute><AdminRoute><AdminPartNameFix /></AdminRoute></ProtectedRoute>} />
            <Route path="/monitor" element={<Monitor />} />
            <Route path="/monitor/admin" element={<ProtectedRoute><AdminRoute><MonitorAdmin /></AdminRoute></ProtectedRoute>} />

            
            {/* Alertas de Qualidade */}
            <Route path="/alerta-qualidade" element={<ProtectedRoute><ModuleGuard module="alerta-qualidade"><AlertaQualidade /></ModuleGuard></ProtectedRoute>} />
            <Route path="/alerta-qualidade/novo" element={<ProtectedRoute><ModuleGuard module="alerta-qualidade"><AlertaQualidadeForm /></ModuleGuard></ProtectedRoute>} />
            <Route path="/alerta-qualidade/editar/:id" element={<ProtectedRoute><ModuleGuard module="alerta-qualidade"><AlertaQualidadeForm /></ModuleGuard></ProtectedRoute>} />
            <Route path="/alerta-qualidade/ver/:id" element={<ProtectedRoute><ModuleGuard module="alerta-qualidade"><AlertaQualidadeView /></ModuleGuard></ProtectedRoute>} />
            <Route path="/alerta-qualidade/feed" element={<ProtectedRoute><ModuleGuard module="alerta-qualidade"><AlertaQualidadeFeed /></ModuleGuard></ProtectedRoute>} />
            
            {/* Consumíveis */}
            <Route path="/consumiveis" element={<ProtectedRoute><ModuleGuard module="consumiveis"><ConsumiveisPage /></ModuleGuard></ProtectedRoute>} />
            
            {/* QR Profile */}
            <Route path="/meu-qr" element={<ProtectedRoute><QrProfilePage /></ProtectedRoute>} />
            
            {/* Consulta de Peças */}
            <Route path="/consulta-pecas" element={<ProtectedRoute><ModuleGuard module="consulta-pecas"><ConsultaPecas /></ModuleGuard></ProtectedRoute>} />
            <Route path="/analise-risco" element={<ProtectedRoute><ModuleGuard module="analise-risco"><AnaliseRisco /></ModuleGuard></ProtectedRoute>} />
            <Route path="/spec-switch-panel" element={<ProtectedRoute><SpecSwitchPanelCheck /></ProtectedRoute>} />
            
            {/* Matriz de Versatilidade */}
            <Route path="/matriz-versatilidade" element={<ProtectedRoute><ModuleGuard module="matriz-versatilidade"><MatrizVersatilidade /></ModuleGuard></ProtectedRoute>} />

            {/* SESMT */}
            <Route path="/sesmt" element={<ProtectedRoute><ModuleGuard module="subhub_sesmt"><SesmtHub /></ModuleGuard></ProtectedRoute>} />
            <Route path="/sesmt/matriz-treinamentos" element={<ProtectedRoute><ModuleGuard module="sesmt-matriz-treinamentos"><SesmtMatrizTreinamentos /></ModuleGuard></ProtectedRoute>} />


            {/* Barcode Scanner H/KMC */}
            <Route path="/barcode-scanner" element={<ProtectedRoute><BarcodeScanner /></ProtectedRoute>} />

            {/* Admin: Audit Logs */}
            <Route path="/admin/audit-logs" element={<ProtectedRoute><AuditLogsPage /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
          </PresenceProvider>
        </ImpersonationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
