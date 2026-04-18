import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { AlertTriangle, Package, GraduationCap, ArrowRight } from "lucide-react";
import { formatLocalDateString } from "@/lib/localDate";

type Kind = "alerta-qualidade" | "consumiveis" | "matriz-versatilidade";

const titleMap: Record<Kind, string> = {
  "alerta-qualidade": "Alertas Pendentes",
  "consumiveis": "Itens Pendentes",
  "matriz-versatilidade": "Treinamentos Pendentes",
};

const iconMap: Record<Kind, any> = {
  "alerta-qualidade": AlertTriangle,
  "consumiveis": Package,
  "matriz-versatilidade": GraduationCap,
};

const pathMap: Record<Kind, string> = {
  "alerta-qualidade": "/alerta-qualidade",
  "consumiveis": "/consumiveis",
  "matriz-versatilidade": "/matriz-versatilidade",
};

const lineAreaMap: Record<string, string> = {
  "CP": "cp", "BP": "bp", "CH": "ch", "OEM": "oem", "Incoming": "incoming",
  "Pintura": "pintura", "Injeção": "injecao", "Sala do Áudio": "sala_audio", "Inspeção de Peça": "inspecao_peca",
};

export const PendingItemsDialog = ({
  kind,
  open,
  onOpenChange,
}: {
  kind: Kind;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (kind === "alerta-qualidade") {
          if (!user?.id) return;
          const { data: quals } = await supabase.from("inspector_qualifications")
            .select("area").eq("user_id", user.id).eq("habilitado", true);
          const myAreas = (quals || []).map((q: any) => q.area);
          const { data: parts } = await supabase.from("part_numbers")
            .select("part_name, line_module").eq("active", true);
          const partMap = new Map((parts || []).map((p: any) => [p.part_name, p.line_module]));
          const { data: allAlertas } = await supabase.from("alertas")
            .select("id, sequencial, modelo, linha_peca, modo_falha, turno, data_ocorrencia, created_at")
            .eq("status", "ativo").order("created_at", { ascending: false });
          const { data: myCiencias } = await supabase.from("ciencias")
            .select("alerta_id").eq("inspetor_id", user.id);
          const cienIds = new Set((myCiencias || []).map((c: any) => c.alerta_id));
          const filtered = (allAlertas || []).filter((a: any) => {
            if (cienIds.has(a.id)) return false;
            if (myAreas.length === 0) return false;
            let areaKey = lineAreaMap[a.linha_peca || ""];
            if (!areaKey) {
              const lm = partMap.get(a.linha_peca || "");
              if (lm) areaKey = lineAreaMap[lm];
            }
            return areaKey && myAreas.includes(areaKey);
          });
          if (!cancelled) setItems(filtered);
        } else if (kind === "consumiveis") {
          const { data: lowStock } = await supabase.from("consumable_items")
            .select("id, name, stock_qty, min_qty, unit").eq("active", true);
          const low = (lowStock || []).filter((i: any) => (i.stock_qty ?? 0) < (i.min_qty ?? 0));
          const { data: pending } = await supabase.from("consumable_requests")
            .select("id, numero, item_name, quantity, user_name, turno, created_at")
            .eq("status", "aguardando").order("created_at", { ascending: false });
          const merged = [
            ...low.map((i: any) => ({ _kind: "stock", ...i })),
            ...(pending || []).map((r: any) => ({ _kind: "request", ...r })),
          ];
          if (!cancelled) setItems(merged);
        } else if (kind === "matriz-versatilidade") {
          const today = new Date(); today.setHours(0,0,0,0);
          const in30 = new Date(today); in30.setDate(in30.getDate() + 30);
          const { data: quals } = await supabase.from("inspector_qualifications")
            .select("user_id, area, next_evaluation_date")
            .eq("habilitado", true).not("next_evaluation_date", "is", null);
          const expired = (quals || []).filter((q: any) => {
            const d = new Date(q.next_evaluation_date + "T12:00:00");
            return d <= in30;
          });
          const userIds = Array.from(new Set(expired.map((q: any) => q.user_id)));
          let profilesMap = new Map<string, string>();
          if (userIds.length) {
            const { data: profs } = await supabase.from("profiles")
              .select("id, full_name").in("id", userIds);
            profilesMap = new Map((profs || []).map((p: any) => [p.id, p.full_name]));
          }
          const enriched = expired.map((q: any) => ({
            ...q,
            full_name: profilesMap.get(q.user_id) || "—",
            isExpired: new Date(q.next_evaluation_date + "T12:00:00") < today,
          }));
          if (!cancelled) setItems(enriched);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, kind, user?.id]);

  const Icon = iconMap[kind];
  const title = titleMap[kind];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base break-words">
            <Icon className="w-4 h-4 shrink-0" />
            <span className="break-words">{title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {loading ? (
            <p className="text-center text-muted-foreground py-6 text-sm">Carregando...</p>
          ) : items.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">
              Nenhuma pendência no momento.
            </p>
          ) : (
            <>
              {kind === "alerta-qualidade" && items.map((a: any) => (
                <div key={a.id} className="border rounded-lg p-3 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px] font-mono">
                      AQ-{String(a.sequencial).padStart(5, "0")}
                    </Badge>
                    {a.turno && <Badge className="text-[10px] bg-blue-500/10 text-blue-700 border-blue-300">Turno {a.turno}</Badge>}
                  </div>
                  <p className="text-sm font-semibold truncate">{a.modelo || "—"} • {a.linha_peca || "—"}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{a.modo_falha || "—"}</p>
                  {a.data_ocorrencia && (
                    <p className="text-[10px] text-muted-foreground/70">{formatLocalDateString(a.data_ocorrencia)}</p>
                  )}
                </div>
              ))}

              {kind === "consumiveis" && items.map((i: any, idx: number) => (
                <div key={`${i._kind}-${i.id}-${idx}`} className="border rounded-lg p-3 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {i._kind === "stock" ? (
                      <Badge className="text-[10px] bg-red-500/10 text-red-700 border-red-300">Estoque Baixo</Badge>
                    ) : (
                      <Badge className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-300">Aguardando</Badge>
                    )}
                    {i.numero && <Badge variant="outline" className="text-[10px] font-mono">{i.numero}</Badge>}
                  </div>
                  <p className="text-sm font-semibold truncate">{i.name || i.item_name}</p>
                  {i._kind === "stock" ? (
                    <p className="text-xs text-muted-foreground">
                      Estoque: <strong>{i.stock_qty} {i.unit}</strong> • Mínimo: {i.min_qty} {i.unit}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Qtd: <strong>{i.quantity}</strong> • Solicitante: {i.user_name} {i.turno ? `• ${i.turno}` : ""}
                    </p>
                  )}
                </div>
              ))}

              {kind === "matriz-versatilidade" && items.map((q: any) => (
                <div key={`${q.user_id}-${q.area}`} className="border rounded-lg p-3 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {q.isExpired ? (
                      <Badge className="text-[10px] bg-red-500/10 text-red-700 border-red-300">Vencido</Badge>
                    ) : (
                      <Badge className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-300">A Vencer</Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] uppercase">{q.area}</Badge>
                  </div>
                  <p className="text-sm font-semibold truncate">{q.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Próxima avaliação: <strong>{formatLocalDateString(q.next_evaluation_date)}</strong>
                  </p>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="pt-3 border-t mt-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => { onOpenChange(false); navigate(pathMap[kind]); }}
          >
            Abrir módulo <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
