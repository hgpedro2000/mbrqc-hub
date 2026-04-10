import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Plus, AlertTriangle, Eye, Camera } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import QrScannerModal from "@/components/QrScannerModal";
import logo from "@/assets/hyundai-mobis-logo.png";
import { toast } from "sonner";

const AlertaQualidade = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { isAdmin } = useUserRole();
  const qc = useQueryClient();
  const [scanAlertaId, setScanAlertaId] = useState<string | null>(null);

  // Check if user is lider
  const { data: roles = [] } = useQuery({
    queryKey: ["my-roles-alerta", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const isLider = isAdmin || roles.some((r: any) => r.role === "lider");
  const isInspetor = roles.some((r: any) => r.role === "inspetor");

  // Redirect inspetor to feed
  useEffect(() => {
    if (!isLider && isInspetor) {
      navigate("/alerta-qualidade/feed", { replace: true });
    }
  }, [isLider, isInspetor, navigate]);

  const { data: alertas = [], isLoading } = useQuery({
    queryKey: ["alertas-lista-mestra"],
    queryFn: async () => {
      const { data, error } = await supabase.from("alertas").select("*").order("sequencial", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: ciencias = [] } = useQuery({
    queryKey: ["ciencias-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ciencias").select("*");
      if (error) throw error;
      return data;
    },
  });

  // Realtime subscription for ciencias
  useEffect(() => {
    const channel = supabase
      .channel("ciencias-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "ciencias" }, () => {
        qc.invalidateQueries({ queryKey: ["ciencias-all"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const getCienciaProgress = (alertaId: string, totalDestinatarios: number) => {
    const count = ciencias.filter((c: any) => c.alerta_id === alertaId).length;
    const total = totalDestinatarios || 1;
    const pct = Math.round((count / total) * 100);
    return { count, total: totalDestinatarios, pct };
  };

  const handleQrScan = async (qrValue: string) => {
    if (!scanAlertaId) return;
    try {
      // Find inspetor by qr_code_id
      const { data: inspetor, error: findErr } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("qr_code_id", qrValue)
        .maybeSingle();

      if (findErr || !inspetor) {
        toast.error("QR Code não reconhecido. Inspetor não encontrado.");
        return;
      }

      // Check if already registered
      const { data: existing } = await supabase
        .from("ciencias")
        .select("id")
        .eq("alerta_id", scanAlertaId)
        .eq("inspetor_id", inspetor.id)
        .maybeSingle();

      if (existing) {
        toast.info(`${inspetor.full_name} já havia dado ciência neste alerta.`);
        return;
      }

      // Insert ciencia
      const { error: insertErr } = await supabase.from("ciencias").insert({
        alerta_id: scanAlertaId,
        inspetor_id: inspetor.id,
        metodo: "qr_lider",
        registrado_por_id: user?.id,
      } as any);

      if (insertErr) throw insertErr;
      toast.success(`✓ Ciência registrada: ${inspetor.full_name}`);
      qc.invalidateQueries({ queryKey: ["ciencias-all"] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-primary-foreground/70 hover:text-primary-foreground px-2">
                <ArrowLeft className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Hub</span>
              </Button>
              <img src={logo} alt="Hyundai Mobis" className="h-6 sm:h-8 object-contain bg-white rounded-md px-2 py-0.5" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <AlertTriangle className="w-6 h-6" />
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-heading font-bold">Lista Mestra de Alertas</h1>
              <p className="text-primary-foreground/70 text-xs">Gestão de Alertas de Qualidade</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 max-w-5xl">
        {isLider && (
          <div className="flex justify-end">
            <Button onClick={() => navigate("/alerta-qualidade/novo")} className="gap-2 bg-[#c0392b] hover:bg-[#a93226]">
              <Plus className="w-4 h-4" /> Novo Alerta
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" /></div>
        ) : alertas.length === 0 ? (
          <div className="form-section text-center py-12">
            <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum alerta cadastrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Seq.</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Descrição</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Ocorrência</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Validade</th>
                  <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground">Status</th>
                  <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground">Ciência</th>
                  <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {alertas.map((a: any) => {
                  const prog = getCienciaProgress(a.id, a.total_destinatarios);
                  return (
                    <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2.5 px-2 font-mono text-xs font-bold">{a.sequencial}</td>
                      <td className="py-2.5 px-2">
                        <p className="font-medium text-foreground line-clamp-1">{a.descricao || a.modo_falha || "—"}</p>
                        {a.modelo && <p className="text-xs text-muted-foreground">{a.modelo}</p>}
                      </td>
                      <td className="py-2.5 px-2 text-xs text-muted-foreground hidden sm:table-cell">
                        {a.data_ocorrencia ? new Date(a.data_ocorrencia).toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td className="py-2.5 px-2 text-xs text-muted-foreground hidden sm:table-cell">
                        {a.data_validade ? new Date(a.data_validade).toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <Badge variant="outline" className={a.status === "ativo" ? "border-emerald-500 text-emerald-600 bg-emerald-500/10" : "border-muted text-muted-foreground bg-muted/20"}>
                          {a.status === "ativo" ? "Ativo" : "Encerrado"}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="flex flex-col items-center gap-1 min-w-[100px]">
                          <Progress value={prog.pct} className="h-2 w-full" />
                          <span className="text-[10px] text-muted-foreground">{prog.pct}% ({prog.count}/{prog.total})</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center justify-center gap-1">
                          {isLider && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Escanear QR" onClick={() => setScanAlertaId(a.id)}>
                              <Camera className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Visualizar" onClick={() => navigate(`/alerta-qualidade/ver/${a.id}`)}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <QrScannerModal
        open={!!scanAlertaId}
        onClose={() => setScanAlertaId(null)}
        onScan={handleQrScan}
        title="Registrar Ciência via QR"
      />
    </div>
  );
};

export default AlertaQualidade;
