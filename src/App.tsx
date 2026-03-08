import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Hub from "./pages/Hub";
import Index from "./pages/Index";
import InjectionForm from "./pages/InjectionForm";
import { PaintingPage, AssemblyPage } from "./pages/EditableChecklist";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Auditorias from "./pages/Auditorias";
import AuditoriaForm from "./pages/AuditoriaForm";
import AuditoriaDashboard from "./pages/AuditoriaDashboard";
import Contencao from "./pages/Contencao";
import ContencaoForm from "./pages/ContencaoForm";
import ContencaoDashboard from "./pages/ContencaoDashboard";
import Apontamentos from "./pages/Apontamentos";
import ApontamentoForm from "./pages/ApontamentoForm";
import ApontamentoDashboard from "./pages/ApontamentoDashboard";
import AlertaQualidade from "./pages/AlertaQualidade";
import AlertaQualidadeForm from "./pages/AlertaQualidadeForm";
import AlertaQualidadeDashboard from "./pages/AlertaQualidadeDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Hub /></ProtectedRoute>} />
            
            {/* Tryout */}
            <Route path="/tryout" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/tryout/injecao" element={<ProtectedRoute><InjectionForm /></ProtectedRoute>} />
            <Route path="/tryout/pintura" element={<ProtectedRoute><PaintingPage /></ProtectedRoute>} />
            <Route path="/tryout/montagem" element={<ProtectedRoute><AssemblyPage /></ProtectedRoute>} />
            <Route path="/tryout/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            
            {/* Auditorias */}
            <Route path="/auditorias" element={<ProtectedRoute><Auditorias /></ProtectedRoute>} />
            <Route path="/auditorias/nova" element={<ProtectedRoute><AuditoriaForm /></ProtectedRoute>} />
            <Route path="/auditorias/dashboard" element={<ProtectedRoute><AuditoriaDashboard /></ProtectedRoute>} />
            
            {/* Contenção */}
            <Route path="/contencao" element={<ProtectedRoute><Contencao /></ProtectedRoute>} />
            <Route path="/contencao/nova" element={<ProtectedRoute><ContencaoForm /></ProtectedRoute>} />
            <Route path="/contencao/dashboard" element={<ProtectedRoute><ContencaoDashboard /></ProtectedRoute>} />
            
            {/* Apontamentos */}
            <Route path="/apontamentos" element={<ProtectedRoute><Apontamentos /></ProtectedRoute>} />
            <Route path="/apontamentos/novo" element={<ProtectedRoute><ApontamentoForm /></ProtectedRoute>} />
            <Route path="/apontamentos/dashboard" element={<ProtectedRoute><ApontamentoDashboard /></ProtectedRoute>} />
            
            {/* Alertas de Qualidade */}
            <Route path="/alerta-qualidade" element={<ProtectedRoute><AlertaQualidade /></ProtectedRoute>} />
            <Route path="/alerta-qualidade/novo" element={<ProtectedRoute><AlertaQualidadeForm /></ProtectedRoute>} />
            <Route path="/alerta-qualidade/dashboard" element={<ProtectedRoute><AlertaQualidadeDashboard /></ProtectedRoute>} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
