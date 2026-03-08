import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, ShieldCheck, BarChart3, Pencil, Trash2 } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import EngineeringMode from "@/components/EngineeringMode";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import logo from "@/assets/hyundai-mobis-logo.png";

const Auditorias = () => {
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const qc = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);

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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Delete responses first, then the auditoria
      await supabase.from("audit_responses").delete().eq("auditoria_id", id);
      const { error } = await supabase.from("auditorias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auditorias"] });
      toast.success("Auditoria excluída com sucesso!");
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e.message),
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
                  <div className="space-y-1 flex-1 min-w-0">
                    <h3 className="font-heading font-semibold text-foreground">{a.titulo}</h3>
                    <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                      <span>Auditor: {a.auditor}</span>
                      <span>•</span>
                      <span>{new Date(a.data).toLocaleDateString("pt-BR")}</span>
                      {a.setor && <><span>•</span><span>Setor: {a.setor}</span></>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className={`status-badge ${statusColors[a.status]}`}>
                        {statusLabels[a.status]}
                      </span>
                      <span className="status-badge bg-card text-foreground border">
                        {tipoLabels[a.tipo]}
                      </span>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 mt-2">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); navigate(`/auditorias/editar/${a.id}`); }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteId(a.id); }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
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

      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta auditoria e todas as suas respostas? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Auditorias;
