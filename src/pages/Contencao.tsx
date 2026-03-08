import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, ShieldAlert, BarChart3 } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import EngineeringMode from "@/components/EngineeringMode";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import logo from "@/assets/hyundai-mobis-logo.png";

const Contencao = () => {
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const [tab, setTab] = useState("interno_mbr");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["contencao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contencao")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = items.filter((i) => i.tipo === tab);

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
              {isAdmin && <EngineeringMode module="Contenção" />}
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <ShieldAlert className="w-8 h-8" />
            <div>
              <h1 className="text-2xl font-heading font-bold">Contenção</h1>
              <p className="text-primary-foreground/70 text-sm">Controle de contenção - Estoque Interno MBR / Externo HMB</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => navigate("/contencao/nova")} className="gap-2">
            <Plus className="w-4 h-4" /> Nova Contenção
          </Button>
          <Button variant="outline" onClick={() => navigate("/contencao/dashboard")} className="gap-2">
            <BarChart3 className="w-4 h-4" /> Dashboard
          </Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="interno_mbr">Estoque Interno MBR</TabsTrigger>
            <TabsTrigger value="externo_hmb">Externo HMB</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="form-section text-center py-12">
                <ShieldAlert className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhuma contenção registrada nesta categoria.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {filtered.map((item) => (
                  <div key={item.id} className="form-section hover:border-accent/30 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h3 className="font-heading font-semibold text-foreground">{item.titulo}</h3>
                        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                          <span>Resp: {item.responsavel}</span>
                          <span>•</span>
                          <span>{new Date(item.data).toLocaleDateString("pt-BR")}</span>
                          {item.part_number && <><span>•</span><span>PN: {item.part_number}</span></>}
                        </div>
                        {item.motivo && <p className="text-sm text-muted-foreground mt-1">Motivo: {item.motivo}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`status-badge ${statusColors[item.status]}`}>
                          {statusLabels[item.status]}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                      <div><span className="text-muted-foreground">Contidas:</span> <span className="font-semibold">{item.quantidade_contida}</span></div>
                      <div><span className="text-muted-foreground">Aprovadas:</span> <span className="font-semibold text-emerald-600">{item.quantidade_aprovada}</span></div>
                      <div><span className="text-muted-foreground">Rejeitadas:</span> <span className="font-semibold text-red-600">{item.quantidade_rejeitada}</span></div>
                    </div>
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

export default Contencao;
