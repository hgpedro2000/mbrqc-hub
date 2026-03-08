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
import ComingSoon from "./pages/ComingSoon";
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
            
            {/* Tryout module */}
            <Route path="/tryout" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/tryout/injecao" element={<ProtectedRoute><InjectionForm /></ProtectedRoute>} />
            <Route path="/tryout/pintura" element={<ProtectedRoute><PaintingPage /></ProtectedRoute>} />
            <Route path="/tryout/montagem" element={<ProtectedRoute><AssemblyPage /></ProtectedRoute>} />
            <Route path="/tryout/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            
            {/* Auditorias module */}
            <Route path="/auditorias" element={<ProtectedRoute><Auditorias /></ProtectedRoute>} />
            <Route path="/auditorias/nova" element={<ProtectedRoute><AuditoriaForm /></ProtectedRoute>} />
            <Route path="/auditorias/dashboard" element={<ProtectedRoute><AuditoriaDashboard /></ProtectedRoute>} />
            
            {/* Other modules - coming soon */}
            <Route path="/contencao" element={<ProtectedRoute><ComingSoon title="Contenção" /></ProtectedRoute>} />
            <Route path="/apontamentos" element={<ProtectedRoute><ComingSoon title="Apontamentos" /></ProtectedRoute>} />
            <Route path="/alerta-qualidade" element={<ProtectedRoute><ComingSoon title="Alerta de Qualidade" /></ProtectedRoute>} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
