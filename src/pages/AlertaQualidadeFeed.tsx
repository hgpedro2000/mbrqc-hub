import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle, CheckCircle, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/hyundai-mobis-logo.png";
import { toast } from "sonner";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const TERMO_CIENCIA =
  "Declaro que li, compreendi e estou ciente do conteúdo deste alerta de qualidade, comprometendo-me a aplicar as orientações nele descritas em minhas atividades.";
const TERMO_VERSAO = "v1-2026-04-18";

const lineAreaMap: Record<string, string> = {
  "CP": "cp", "BP": "bp", "CH": "ch", "OEM": "oem",
  "Incoming": "incoming", "Pintura": "pintura", "Injeção": "injecao",
  "Sala do Áudio": "sala_audio", "Inspeção de Peça": "inspecao_peca",
};

const AlertaQualidadeFeed = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ id: string; seq: number; titulo: string } | null>(null);
  const [aceito, setAceito] = useState(false);

  const { data: alertas = [], isLoading } = useQuery({
    queryKey: ["alertas-feed", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get inspector's qualified areas
      const { data: quals } = await supabase
        .from("inspector_qualifications")
        .select("area")
        .eq("user_id", user.id)
        .eq("habilitado", true);
      const myAreas = (quals || []).map((q: any) => q.area);

      // Get part_numbers to resolve part names → line_module
      const { data: parts } = await supabase
        .from("part_numbers")
        .select("part_name, line_module")
        .eq("active", true);
      const partMap = new Map((parts || []).map((p: any) => [p.part_name, p.line_module]));

      // Get all active alerts
      const { data: allAlertas, error: aErr } = await supabase.from("alertas").select("*").eq("status", "ativo").order("created_at", { ascending: false });
      if (aErr) throw aErr;

      // Get ciencias for this user
      const { data: myCiencias, error: cErr } = await supabase.from("ciencias").select("alerta_id").eq("inspetor_id", user.id);
      if (cErr) throw cErr;
      const cienIds = new Set((myCiencias || []).map((c: any) => c.alerta_id));

      // Filter: only alerts matching inspector's qualified areas AND not yet acknowledged
      return (allAlertas || []).filter((a: any) => {
        if (cienIds.has(a.id)) return false;
        if (myAreas.length === 0) return false;
        const linhaPeca = a.linha_peca;
        if (!linhaPeca) return false;
        // Resolve area
        let areaKey = lineAreaMap[linhaPeca];
        if (!areaKey) {
          const lineModule = partMap.get(linhaPeca);
          if (lineModule) areaKey = lineAreaMap[lineModule];
        }
        if (!areaKey) return false;
        return myAreas.includes(areaKey);
      });
    },
    enabled: !!user?.id,
  });

  const handleConfirm = async (alertaId: string) => {
    if (!user?.id) return;
    setConfirming(alertaId);
    try {
      const { error } = await supabase.from("ciencias").insert({
        alerta_id: alertaId,
        inspetor_id: user.id,
        metodo: "app_proprio",
        registrado_por_id: user.id,
        termo_aceito: TERMO_CIENCIA,
        versao_termo: TERMO_VERSAO,
      } as any);
      if (error) throw error;
      toast.success("Ciência registrada com sucesso!");
      qc.invalidateQueries({ queryKey: ["alertas-feed"] });
      setConfirmDialog(null);
      setAceito(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setConfirming(null);
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
              <h1 className="text-lg sm:text-xl font-heading font-bold">Alertas Pendentes</h1>
              <p className="text-primary-foreground/70 text-xs">Confirme ciência dos alertas ativos</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-2xl space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" /></div>
        ) : alertas.length === 0 ? (
          <div className="form-section text-center py-12">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <p className="text-foreground font-semibold">Tudo em dia!</p>
            <p className="text-muted-foreground text-sm">Nenhum alerta pendente de ciência</p>
          </div>
        ) : (
          alertas.map((a: any) => (
            <div key={a.id} className="form-section space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-mono font-bold text-[#c0392b]">#{a.sequencial}</span>
                  <h3 className="font-heading font-semibold text-foreground">{a.modo_falha || a.descricao}</h3>
                  {a.modelo && <p className="text-xs text-muted-foreground">{a.modelo}</p>}
                </div>
              </div>
              {a.descricao && <p className="text-sm text-muted-foreground">{a.descricao}</p>}
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {a.data_ocorrencia && <span>Ocorrência: {new Date(a.data_ocorrencia).toLocaleDateString("pt-BR")}</span>}
                {a.data_validade && <span>Validade: {new Date(a.data_validade).toLocaleDateString("pt-BR")}</span>}
                {a.turno && <span>Turno: {a.turno}</span>}
              </div>
              {(a.foto_ng_url || a.foto_ok_url) && (
                <div className="grid grid-cols-2 gap-2">
                  {a.foto_ng_url && (
                    <div>
                      <span className="text-[10px] font-bold text-[#c0392b]">NG</span>
                      <img src={a.foto_ng_url} alt="NG" className="rounded border border-[#c0392b] w-full h-24 object-cover" />
                    </div>
                  )}
                  {a.foto_ok_url && (
                    <div>
                      <span className="text-[10px] font-bold text-[#1e8449]">OK</span>
                      <img src={a.foto_ok_url} alt="OK" className="rounded border border-[#1e8449] w-full h-24 object-cover" />
                    </div>
                  )}
                </div>
              )}
              <Button
                onClick={() => setConfirmDialog({ id: a.id, seq: a.sequencial, titulo: a.modo_falha || a.descricao || "Alerta" })}
                disabled={confirming === a.id}
                className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
              >
                {confirming === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Ciente
              </Button>
            </div>
          ))
        )}
      </main>

      <AlertDialog open={!!confirmDialog} onOpenChange={(o) => { if (!o) { setConfirmDialog(null); setAceito(false); } }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Confirmar Ciência do Alerta
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-2 text-sm">
                {confirmDialog && (
                  <div className="font-mono text-xs font-bold text-[#c0392b]">
                    AQ-{String(confirmDialog.seq).padStart(5, "0")} • {confirmDialog.titulo}
                  </div>
                )}
                <div className="rounded-md border bg-muted/40 p-3 text-foreground/90 text-[13px] leading-relaxed">
                  {TERMO_CIENCIA}
                </div>
                <div className="flex items-start gap-2 pt-1">
                  <Checkbox
                    id="aceite-termo"
                    checked={aceito}
                    onCheckedChange={(v) => setAceito(v === true)}
                    className="mt-0.5"
                  />
                  <Label htmlFor="aceite-termo" className="text-sm font-medium cursor-pointer leading-snug">
                    Li e compreendi o alerta
                  </Label>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel className="m-0">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (confirmDialog && aceito) handleConfirm(confirmDialog.id);
              }}
              disabled={!!confirming || !aceito}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2 disabled:opacity-50"
            >
              {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AlertaQualidadeFeed;
