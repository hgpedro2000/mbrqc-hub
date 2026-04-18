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

const CARGOS_QUALIDADE = ["lider", "assistente", "analista", "supervisor", "gerente", "diretor"];

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
  const { user, profile } = useAuth();
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
          // Determine if user is leader/quality role -> sees all alerts with pending ciência
          const cargoLower = (profile?.cargo || "").toLowerCase();
          const isQualityRole = CARGOS_QUALIDADE.some((r) => cargoLower.includes(r));
          const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
          const isLider = isAdmin || (rolesData || []).some((r: any) => r.role === "lider");
          const seesAll = isLider || isQualityRole;

          const { data: parts } = await supabase.from("part_numbers")
            .select("part_name, line_module").eq("active", true);
          const partMap = new Map((parts || []).map((p: any) => [p.part_name, p.line_module]));
          const { data: allAlertas } = await supabase.from("alertas")
            .select("id, sequencial, modelo, linha_peca, modo_falha, turno, data_ocorrencia, created_at")
            .eq("status", "ativo").order("created_at", { ascending: false });

          let filtered: any[] = [];
          if (seesAll) {
            // Leader/quality view: show alerts where ciência is incomplete (any qualified inspector still pending)
            const { data: allCiencias } = await supabase.from("ciencias").select("alerta_id");
            const cienByAlerta = new Map<string, number>();
            (allCiencias || []).forEach((c: any) => cienByAlerta.set(c.alerta_id, (cienByAlerta.get(c.alerta_id) || 0) + 1));
            const { data: qualsAll } = await supabase.from("inspector_qualifications")
              .select("user_id, area").eq("habilitado", true);
            const qualsByArea = new Map<string, Set<string>>();
            (qualsAll || []).forEach((q: any) => {
              if (!qualsByArea.has(q.area)) qualsByArea.set(q.area, new Set());
              qualsByArea.get(q.area)!.add(q.user_id);
            });
            filtered = (allAlertas || []).filter((a: any) => {
              let areaKey = lineAreaMap[a.linha_peca || ""];
              if (!areaKey) {
                const lm = partMap.get(a.linha_peca || "");
                if (lm) areaKey = lineAreaMap[lm];
              }
              if (!areaKey) return false;
              const total = qualsByArea.get(areaKey)?.size || 0;
              const done = cienByAlerta.get(a.id) || 0;
              return total > 0 && done < total;
            });
          } else {
            // Regular inspector: only alerts in their qualified areas not yet acknowledged by them
            const { data: quals } = await supabase.from("inspector_qualifications")
              .select("area").eq("user_id", user.id).eq("habilitado", true);
            const myAreas = (quals || []).map((q: any) => q.area);
            const { data: myCiencias } = await supabase.from("ciencias")
              .select("alerta_id").eq("inspetor_id", user.id);
            const cienIds = new Set((myCiencias || []).map((c: any) => c.alerta_id));
            filtered = (allAlertas || []).filter((a: any) => {
              if (cienIds.has(a.id)) return false;
              if (myAreas.length === 0) return false;
              let areaKey = lineAreaMap[a.linha_peca || ""];
              if (!areaKey) {
                const lm = partMap.get(a.linha_peca || "");
                if (lm) areaKey = lineAreaMap[lm];
              }
              return areaKey && myAreas.includes(areaKey);
            });
          }
          if (!cancelled) setItems(filtered);
        } else if (kind === "consumiveis") {
          if (!user?.id) return;
          // Determine if user is consumables manager / admin / lider
          const cargoLowerC = (profile?.cargo || "").toLowerCase();
          const isQualityRoleC = CARGOS_QUALIDADE.some((r) => cargoLowerC.includes(r));
          const { data: rolesDataC } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
          const isLiderC = isAdmin || (rolesDataC || []).some((r: any) => r.role === "lider");
          const { data: perm } = await supabase.from("user_module_permissions")
            .select("enabled").eq("user_id", user.id).eq("module", "consumiveis_inventario").maybeSingle();
          const isManager = !!perm?.enabled;
          const seesAll = isAdmin || isLiderC || isManager || isQualityRoleC;

          if (seesAll) {
            const { data: lowStock } = await supabase.from("consumable_items")
              .select("id, name, stock_qty, min_qty, unit").eq("active", true);
            const low = (lowStock || []).filter((i: any) => (i.stock_qty ?? 0) < (i.min_qty ?? 0));
            const { data: pending } = await supabase.from("consumable_requests")
              .select("id, numero, item_name, quantity, user_name, turno, status, created_at")
              .eq("status", "aguardando").order("created_at", { ascending: false });
            const merged = [
              ...low.map((i: any) => ({ _kind: "stock", ...i })),
              ...(pending || []).map((r: any) => ({ _kind: "request", ...r })),
            ];
            if (!cancelled) setItems(merged);
          } else {
            // Regular user: only own active requests with status
            const { data: own } = await supabase.from("consumable_requests")
              .select("id, numero, item_name, quantity, status, turno, admin_notes, created_at")
              .eq("user_id", user.id)
              .in("status", ["aguardando", "em_andamento", "separando"])
              .order("created_at", { ascending: false });
            const items = (own || []).map((r: any) => ({ _kind: "own", ...r }));
            if (!cancelled) setItems(items);
          }
        } else if (kind === "matriz-versatilidade") {
          if (!user?.id) return;
          const cargoLowerM = (profile?.cargo || "").toLowerCase();
          const isQualityRoleM = CARGOS_QUALIDADE.some((r) => cargoLowerM.includes(r));
          const { data: rolesDataM } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
          const isLiderM = isAdmin || (rolesDataM || []).some((r: any) => r.role === "lider");
          const seesAll = isAdmin || isLiderM || isQualityRoleM;

          const today = new Date(); today.setHours(0,0,0,0);
          const in30 = new Date(today); in30.setDate(in30.getDate() + 30);
          let q = supabase.from("inspector_qualifications")
            .select("user_id, area, next_evaluation_date")
            .eq("habilitado", true).not("next_evaluation_date", "is", null);
          if (!seesAll) q = q.eq("user_id", user.id);
          const { data: quals } = await q;
          const expired = (quals || []).filter((qq: any) => {
            const d = new Date(qq.next_evaluation_date + "T12:00:00");
            return d <= in30;
          });
          const userIds = Array.from(new Set(expired.map((qq: any) => qq.user_id)));
          let profilesMap = new Map<string, string>();
          if (userIds.length) {
            const { data: profs } = await supabase.from("profiles")
              .select("id, full_name").in("id", userIds);
            profilesMap = new Map((profs || []).map((p: any) => [p.id, p.full_name]));
          }
          const enriched = expired.map((qq: any) => ({
            ...qq,
            full_name: profilesMap.get(qq.user_id) || "—",
            isExpired: new Date(qq.next_evaluation_date + "T12:00:00") < today,
          }));
          // Sort: vencidos first (most overdue first), then a vencer (closest first)
          enriched.sort((a: any, b: any) => {
            if (a.isExpired !== b.isExpired) return a.isExpired ? -1 : 1;
            const da = new Date(a.next_evaluation_date + "T12:00:00").getTime();
            const db = new Date(b.next_evaluation_date + "T12:00:00").getTime();
            return da - db;
          });
          if (!cancelled) setItems(enriched);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, kind, user?.id, isAdmin, profile?.cargo]);

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
                <button
                  key={a.id}
                  type="button"
                  onClick={() => { onOpenChange(false); navigate(`/alerta-qualidade/view/${a.id}`); }}
                  className="w-full text-left border rounded-lg p-3 space-y-1 hover:bg-accent/50 hover:border-primary/40 active:scale-[0.99] transition-all cursor-pointer"
                >
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
                </button>
              ))}

              {kind === "consumiveis" && items.map((i: any, idx: number) => {
                const statusLabel: Record<string, string> = {
                  aguardando: "Aguardando",
                  em_andamento: "Em Andamento",
                  separando: "Separando",
                };
                const statusColor: Record<string, string> = {
                  aguardando: "bg-amber-500/10 text-amber-700 border-amber-300",
                  em_andamento: "bg-blue-500/10 text-blue-700 border-blue-300",
                  separando: "bg-violet-500/10 text-violet-700 border-violet-300",
                };
                return (
                  <div key={`${i._kind}-${i.id}-${idx}`} className="border rounded-lg p-3 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {i._kind === "stock" ? (
                        <Badge className="text-[10px] bg-red-500/10 text-red-700 border-red-300">Estoque Baixo</Badge>
                      ) : (
                        <Badge className={`text-[10px] ${statusColor[i.status] || "bg-amber-500/10 text-amber-700 border-amber-300"}`}>
                          {statusLabel[i.status] || "Aguardando"}
                        </Badge>
                      )}
                      {i.numero && <Badge variant="outline" className="text-[10px] font-mono">{i.numero}</Badge>}
                    </div>
                    <p className="text-sm font-semibold truncate">{i.name || i.item_name}</p>
                    {i._kind === "stock" ? (
                      <p className="text-xs text-muted-foreground">
                        Estoque: <strong>{i.stock_qty} {i.unit}</strong> • Mínimo: {i.min_qty} {i.unit}
                      </p>
                    ) : i._kind === "own" ? (
                      <>
                        <p className="text-xs text-muted-foreground">
                          Qtd: <strong>{i.quantity}</strong> {i.turno ? `• Turno ${i.turno}` : ""}
                        </p>
                        {i.admin_notes && (
                          <p className="text-[10px] text-muted-foreground/80 italic">Obs: {i.admin_notes}</p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Qtd: <strong>{i.quantity}</strong> • Solicitante: {i.user_name} {i.turno ? `• ${i.turno}` : ""}
                      </p>
                    )}
                  </div>
                );
              })}

              {kind === "matriz-versatilidade" && (() => {
                const vencidos = items.filter((q: any) => q.isExpired);
                const aVencer = items.filter((q: any) => !q.isExpired);
                return (
                  <>
                    {vencidos.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 pt-1">
                          <div className="h-px flex-1 bg-red-300/50" />
                          <span className="text-[11px] font-bold uppercase text-red-700 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-300">
                            Vencidos ({vencidos.length})
                          </span>
                          <div className="h-px flex-1 bg-red-300/50" />
                        </div>
                        {vencidos.map((q: any) => (
                          <div key={`v-${q.user_id}-${q.area}`} className="border border-red-200 rounded-lg p-3 space-y-1 bg-red-500/5">
                            <Badge variant="outline" className="text-[10px] uppercase">{q.area}</Badge>
                            <p className="text-sm font-semibold truncate">{q.full_name}</p>
                            <p className="text-xs text-muted-foreground">
                              Próxima avaliação: <strong className="text-red-700">{formatLocalDateString(q.next_evaluation_date)}</strong>
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                    {aVencer.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 pt-1">
                          <div className="h-px flex-1 bg-amber-300/50" />
                          <span className="text-[11px] font-bold uppercase text-amber-700 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-300">
                            A Vencer ({aVencer.length})
                          </span>
                          <div className="h-px flex-1 bg-amber-300/50" />
                        </div>
                        {aVencer.map((q: any) => (
                          <div key={`a-${q.user_id}-${q.area}`} className="border border-amber-200 rounded-lg p-3 space-y-1 bg-amber-500/5">
                            <Badge variant="outline" className="text-[10px] uppercase">{q.area}</Badge>
                            <p className="text-sm font-semibold truncate">{q.full_name}</p>
                            <p className="text-xs text-muted-foreground">
                              Próxima avaliação: <strong className="text-amber-700">{formatLocalDateString(q.next_evaluation_date)}</strong>
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
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
