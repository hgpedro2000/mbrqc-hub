import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, AlertTriangle, BarChart3 } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import EngineeringMode from "@/components/EngineeringMode";
import logo from "@/assets/hyundai-mobis-logo.png";

const AlertaQualidade = () => {
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();

  const { data: alertas = [], isLoading } = useQuery({
    queryKey: ["alertas_qualidade"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alertas_qualidade")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const statusColors: Record<string, string> = {
    ativo: "bg-red-500/10 text-red-600",
    em_verificacao: "bg-amber-500/10 text-amber-600",
    encerrado: "bg-emerald-500/10 text-emerald-600",
    cancelado: "bg-muted text-muted-foreground",
  };
  const statusLabels: Record<string, string> = {
    ativo: "Ativo", em_verificacao: "Em Verificação", encerrado: "Encerrado", cancelado: "Cancelado",
  };
  const severidadeColors: Record<string, string> = {
    baixa: "bg-emerald-500/10 text-emerald-600",
    media: "bg-amber-500/10 text-amber-600",
    alta: "bg-orange-500/10 text-orange-600",
    critica: "bg-red-500/10 text-red-600",
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
            {isAdmin && <EngineeringMode module="Alerta de Qualidade" />}
          </div>
          <div className="flex items-center gap-3 mt-4">
            <AlertTriangle className="w-8 h-8" />
            <div>
              <h1 className="text-2xl font-heading font-bold">Alertas de Qualidade</h1>
              <p className="text-primary-foreground/70 text-sm">Emissão e controle de alertas</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => navigate("/alerta-qualidade/novo")} className="gap-2">
            <Plus className="w-4 h-4" /> Novo Alerta
          </Button>
          <Button variant="outline" onClick={() => navigate("/alerta-qualidade/dashboard")} className="gap-2">
            <BarChart3 className="w-4 h-4" /> Dashboard
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" />
          </div>
        ) : alertas.length === 0 ? (
          <div className="form-section text-center py-12">
            <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum alerta registrado.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {alertas.map((a) => (
              <div key={a.id} className="form-section hover:border-accent/30 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground bg-muted/20 px-2 py-0.5 rounded">#{a.numero_alerta}</span>
                      <h3 className="font-heading font-semibold text-foreground">{a.titulo}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">{a.descricao_problema}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-1">
                      <span>Emitente: {a.emitente}</span>
                      <span>•</span>
                      <span>{new Date(a.data_emissao).toLocaleDateString("pt-BR")}</span>
                      {a.part_number && <><span>•</span><span>PN: {a.part_number}</span></>}
                      {a.responsavel && <><span>•</span><span>Resp: {a.responsavel}</span></>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`status-badge ${statusColors[a.status]}`}>{statusLabels[a.status]}</span>
                    <span className={`status-badge ${severidadeColors[a.severidade || "media"]}`}>{(a.severidade || "media").charAt(0).toUpperCase() + (a.severidade || "media").slice(1)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default AlertaQualidade;
