import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, ShieldCheck, BarChart3 } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import EngineeringMode from "@/components/EngineeringMode";
import logo from "@/assets/hyundai-mobis-logo.png";

const Auditorias = () => {
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();

  const { data: auditorias = [], isLoading } = useQuery({
    queryKey: ["auditorias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auditorias")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const statusColors: Record<string, string> = {
    aberta: "bg-blue-500/10 text-blue-600",
    em_andamento: "bg-amber-500/10 text-amber-600",
    concluida: "bg-emerald-500/10 text-emerald-600",
    cancelada: "bg-red-500/10 text-red-600",
  };

  const statusLabels: Record<string, string> = {
    aberta: "Aberta",
    em_andamento: "Em Andamento",
    concluida: "Concluída",
    cancelada: "Cancelada",
  };

  const tipoLabels: Record<string, string> = {
    processo: "Processo",
    produto: "Produto",
    fornecedor: "Fornecedor",
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-primary-foreground/70 hover:text-primary-foreground">
                <ArrowLeft className="w-4 h-4 mr-1" /> Hub
              </Button>
              <img src={logo} alt="Hyundai Mobis" className="h-8 object-contain bg-white rounded-md px-2 py-0.5" />
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && <EngineeringMode module="Auditorias" />}
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <ShieldCheck className="w-8 h-8" />
            <div>
              <h1 className="text-2xl font-heading font-bold">Auditorias</h1>
              <p className="text-primary-foreground/70 text-sm">Gestão de auditorias de processo, produto e fornecedor</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => navigate("/auditorias/nova")} className="gap-2">
            <Plus className="w-4 h-4" /> Nova Auditoria
          </Button>
          <Button variant="outline" onClick={() => navigate("/auditorias/dashboard")} className="gap-2">
            <BarChart3 className="w-4 h-4" /> Dashboard
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" />
          </div>
        ) : auditorias.length === 0 ? (
          <div className="form-section text-center py-12">
            <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhuma auditoria registrada ainda.</p>
            <Button className="mt-4" onClick={() => navigate("/auditorias/nova")}>
              <Plus className="w-4 h-4 mr-2" /> Criar primeira auditoria
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {auditorias.map((a) => (
              <div
                key={a.id}
                className="form-section cursor-pointer hover:border-accent/30 transition-colors"
                onClick={() => navigate(`/auditorias/${a.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-heading font-semibold text-foreground">{a.titulo}</h3>
                    <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                      <span>Auditor: {a.auditor}</span>
                      <span>•</span>
                      <span>{new Date(a.data).toLocaleDateString("pt-BR")}</span>
                      {a.setor && <><span>•</span><span>Setor: {a.setor}</span></>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`status-badge ${statusColors[a.status]}`}>
                      {statusLabels[a.status]}
                    </span>
                    <span className="status-badge bg-card text-foreground border">
                      {tipoLabels[a.tipo]}
                    </span>
                  </div>
                </div>
                {a.pontuacao_total > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Pontuação:</span>
                      <span className="font-semibold">{a.pontuacao_obtida}/{a.pontuacao_total}</span>
                      <span className="text-muted-foreground">
                        ({((Number(a.pontuacao_obtida) / Number(a.pontuacao_total)) * 100).toFixed(0)}%)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Auditorias;
