import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, FileBarChart, BarChart3 } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import EngineeringMode from "@/components/EngineeringMode";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import logo from "@/assets/hyundai-mobis-logo.png";

const Apontamentos = () => {
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const [tab, setTab] = useState("defeito_processo");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["apontamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("apontamentos")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = items.filter((i) => i.tipo === tab);

  const statusColors: Record<string, string> = {
    aberto: "bg-blue-500/10 text-blue-600",
    em_analise: "bg-amber-500/10 text-amber-600",
    acao_definida: "bg-violet-500/10 text-violet-600",
    concluido: "bg-emerald-500/10 text-emerald-600",
    cancelado: "bg-red-500/10 text-red-600",
  };
  const statusLabels: Record<string, string> = {
    aberto: "Aberto", em_analise: "Em Análise", acao_definida: "Ação Definida", concluido: "Concluído", cancelado: "Cancelado",
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
            {isAdmin && <EngineeringMode module="Apontamentos" />}
          </div>
          <div className="flex items-center gap-3 mt-4">
            <FileBarChart className="w-8 h-8" />
            <div>
              <h1 className="text-2xl font-heading font-bold">Apontamentos</h1>
              <p className="text-primary-foreground/70 text-sm">Defeitos de processo, peças e paradas de linha</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => navigate("/apontamentos/novo")} className="gap-2">
            <Plus className="w-4 h-4" /> Novo Apontamento
          </Button>
          <Button variant="outline" onClick={() => navigate("/apontamentos/dashboard")} className="gap-2">
            <BarChart3 className="w-4 h-4" /> Dashboard
          </Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="defeito_processo">Defeito Processo</TabsTrigger>
            <TabsTrigger value="defeito_peca">Defeito Peça</TabsTrigger>
            <TabsTrigger value="parada_linha">Parada de Linha</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="form-section text-center py-12">
                <FileBarChart className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum apontamento nesta categoria.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {filtered.map((item) => (
                  <div key={item.id} className="form-section hover:border-accent/30 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h3 className="font-heading font-semibold text-foreground">{item.titulo}</h3>
                        <p className="text-sm text-muted-foreground">{item.descricao}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-1">
                          <span>Resp: {item.responsavel}</span>
                          <span>•</span>
                          <span>{new Date(item.data).toLocaleDateString("pt-BR")}</span>
                          {item.part_number && <><span>•</span><span>PN: {item.part_number}</span></>}
                          {item.quantidade > 1 && <><span>•</span><span>Qtd: {item.quantidade}</span></>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`status-badge ${statusColors[item.status]}`}>{statusLabels[item.status]}</span>
                        <span className={`status-badge ${severidadeColors[item.severidade || "media"]}`}>{(item.severidade || "media").charAt(0).toUpperCase() + (item.severidade || "media").slice(1)}</span>
                      </div>
                    </div>
                    {(item.causa_raiz || item.acao_corretiva) && (
                      <div className="mt-3 pt-3 border-t border-border grid md:grid-cols-2 gap-3 text-sm">
                        {item.causa_raiz && <div><span className="text-muted-foreground font-medium">Causa Raiz:</span> {item.causa_raiz}</div>}
                        {item.acao_corretiva && <div><span className="text-muted-foreground font-medium">Ação Corretiva:</span> {item.acao_corretiva}</div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Apontamentos;
