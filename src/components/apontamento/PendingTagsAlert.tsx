import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useTagPermission } from "@/hooks/useTagPermission";
import { useUserRole } from "@/hooks/useUserRole";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag, AlertTriangle, Loader2, CheckCircle, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import ApontamentoViewDialog from "@/components/apontamento/ApontamentoViewDialog";
import { formatLocalDateString } from "@/lib/localDate";

export const PendingTagsAlert = ({
  requireMobis = false,
  hideTrigger = false,
  open: openProp,
  onOpenChange,
}: {
  requireMobis?: boolean;
  hideTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) => {
  const { user, profile } = useAuth();
  const { impersonating } = useImpersonation();
  const { canInsertTag } = useTagPermission();
  const { isAdmin } = useUserRole();
  const [pendingItems, setPendingItems] = useState<any[]>([]);
  const [internalOpen, setInternalOpen] = useState(false);
  const listOpen = openProp !== undefined ? openProp : internalOpen;
  const setListOpen = (v: boolean) => {
    if (onOpenChange) onOpenChange(v);
    else setInternalOpen(v);
  };
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tagInputs, setTagInputs] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [viewTarget, setViewTarget] = useState<string | null>(null);
  const [missingAlert, setMissingAlert] = useState<{ qty: number; missing: number } | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const activeProfile = impersonating || profile;

  const fetchPending = async () => {
    if (!user) return;
    let query = supabase
      .from("apontamentos")
      .select("id, numero, part_number, part_name, fornecedor, quantidade_ng, turno, data, responsavel, numero_tag, tag_number, responsabilidade_defeito, local_deteccao, fase, modo_falha, segundo_defeitos")
      .neq("status", "draft")
      .gt("quantidade_ng", 0)
      .is("numero_tag" as any, null)
      .is("tag_number" as any, null)
      .order("data", { ascending: false });

    if (!isAdmin && activeProfile?.turno) {
      query = query.eq("turno", activeProfile.turno);
    } else if (!isAdmin && !activeProfile?.turno) {
      setPendingItems([]);
      return;
    }

    const data = (await query).data;
    setPendingItems(data || []);
  };

  const getTagCount = (item: any) => {
    const main = item?.modo_falha ? 1 : 0;
    const extras = Array.isArray(item?.segundo_defeitos) ? item.segundo_defeitos.length : 0;
    return Math.max(1, main + extras);
  };

  useEffect(() => {
    if (canInsertTag) fetchPending();
  }, [canInsertTag, user, isAdmin]);

  const handleSaveTag = async (id: string, qty: number) => {
    const trimmed = tagInputs.slice(0, qty).map(t => (t || "").trim());
    const missing = trimmed.filter(t => !t).length;
    if (missing > 0) {
      setMissingAlert({ qty, missing });
      return;
    }
    setSaving(true);
    try {
      const joined = trimmed.join(", ");
      const { data, error } = await supabase.functions.invoke("insert-tag", {
        body: {
          id,
          numero_tag: joined,
          impersonatedUserId: impersonating?.id || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("TAGs salvas!");
      setTagInputs([]);
      setEditingId(null);
      await fetchPending();
    } catch (e: any) {
      toast.error("Erro ao salvar TAG");
    } finally {
      setSaving(false);
    }
  };

  const isMobisBrasil = activeProfile?.empresa === "mobis_brasil";
  const isTerceiro = activeProfile?.empresa === "empresa_terceira" || !!activeProfile?.empresa_terceira;
  if (requireMobis && !isMobisBrasil) return null;
  if (isTerceiro) return null;
  if (!canInsertTag) return null;
  if (pendingItems.length === 0 && !hideTrigger) return null;

  return (
    <>
      {!hideTrigger && (
        <button
          onClick={() => setListOpen(true)}
          className="relative flex items-center gap-2 px-3 py-2 rounded-xl
            bg-amber-50 border border-amber-300 text-amber-700
            hover:bg-amber-100 transition-colors text-sm font-semibold w-full sm:w-auto"
        >
          <span className="relative">
            <AlertTriangle className="w-4 h-4" />
            <Badge className="absolute -top-2 -right-3 h-4 min-w-4 px-1 text-[10px] bg-amber-500 text-white border-0">
              {pendingItems.length}
            </Badge>
          </span>
          <span className="ml-2">TAGs Pendentes {isAdmin ? "— Todos os Turnos" : `do Turno ${activeProfile?.turno}`}</span>
        </button>
      )}

      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent className="w-[95vw] sm:w-full max-w-[640px] max-h-[90vh] sm:max-h-[85vh] overflow-y-auto p-3 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base break-words">
              <Tag className="w-4 h-4 shrink-0" />
              <span className="break-words">Pendentes de TAG {isAdmin ? "— Todos os Turnos" : `— Turno ${activeProfile?.turno}`}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            {pendingItems.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">
                Nenhum apontamento pendente de TAG.
              </p>
            ) : (
              pendingItems.map((item) => (
                <div key={item.id} className="border rounded-lg p-3 space-y-2 w-full">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          onClick={() => setViewTarget(item.id)}
                          className="text-xs font-mono text-primary hover:underline bg-muted/30 px-1.5 py-0.5 rounded"
                        >
                          #{item.numero}
                        </button>
                        <Badge variant="destructive" className="text-[10px]">
                          NG: {item.quantidade_ng}
                        </Badge>
                        {(() => {
                          const resp = item.responsabilidade_defeito;
                          const loc = item.local_deteccao || item.fase;
                          const displayResp = resp
                            ? resp.replace(/^\d+\s*-\s*/, "").trim()
                            : loc === "Sala do Audio" ? "Part" : loc === "Área de Incoming" ? "Sorting" : null;
                          if (!displayResp) return <Badge className="text-[10px] bg-gray-500/10 text-gray-500 border-gray-300">Sem resp.</Badge>;
                          const isPartResp = displayResp.toLowerCase().includes("part");
                          const isSortingResp = displayResp.toLowerCase().includes("sorting");
                          const badgeClass = isPartResp
                            ? "bg-blue-500/10 text-blue-700 border-blue-300"
                            : isSortingResp
                            ? "bg-orange-500/10 text-orange-700 border-orange-300"
                            : "bg-violet-500/10 text-violet-700 border-violet-300";
                          return <Badge className={`text-[10px] ${badgeClass}`}>{displayResp}</Badge>;
                        })()}
                      </div>
                      <p className="text-sm font-semibold truncate">{item.part_number}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.part_name || "—"}</p>
                      <p className="text-xs text-muted-foreground/70 truncate">
                        {item.fornecedor} • {item.responsavel}
                      </p>
                      <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground mt-1">
                        <span>{formatLocalDateString(item.data)}</span>
                        {item.turno && <span>• Turno {item.turno}</span>}
                      </div>
                    </div>
                    {editingId !== item.id && (() => {
                      const tagCount = getTagCount(item);
                      return (
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 text-xs w-full sm:w-auto"
                          onClick={() => { setEditingId(item.id); setTagInputs(Array(tagCount).fill("")); }}
                        >
                          <Tag className="w-3 h-3 mr-1" />
                          Inserir TAG{tagCount > 1 ? `s (${tagCount})` : ""}
                        </Button>
                      );
                    })()}
                  </div>

                  {editingId === item.id && (
                    <div className="space-y-2">
                      {Array.from({ length: getTagCount(item) }).map((_, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground w-10 shrink-0">#{idx + 1}</span>
                          <Input
                            value={tagInputs[idx] || ""}
                            onChange={(e) => {
                              const next = [...tagInputs];
                              next[idx] = e.target.value;
                              setTagInputs(next);
                            }}
                            placeholder={`Número da TAG ${idx + 1}`}
                            className="h-8 text-sm flex-1"
                            autoFocus={idx === 0}
                            onKeyDown={(e) => e.key === "Enter" && handleSaveTag(item.id, getTagCount(item))}
                          />
                        </div>
                      ))}
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0"
                          onClick={() => {
                            const hasAny = tagInputs.some(t => (t || "").trim());
                            if (hasAny) setCancelConfirm(true);
                            else { setEditingId(null); setTagInputs([]); }
                          }}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 shrink-0"
                          onClick={() => handleSaveTag(item.id, getTagCount(item))}
                          disabled={saving}
                        >
                          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle className="w-3.5 h-3.5 mr-1" />}
                          Salvar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* View dialog for clicked record */}
      <ApontamentoViewDialog
        open={!!viewTarget}
        onOpenChange={(open) => !open && setViewTarget(null)}
        apontamentoId={viewTarget}
      />
      {/* Missing TAGs alert */}
      <AlertDialog open={!!missingAlert} onOpenChange={(o) => !o && setMissingAlert(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>TAGs incompletas</AlertDialogTitle>
            <AlertDialogDescription>
              {missingAlert && (
                <>Você precisa preencher as <strong>{missingAlert.qty}</strong> TAGs antes de salvar.{" "}
                Faltam <strong>{missingAlert.missing}</strong> campo(s). Nada será salvo enquanto todos os campos não estiverem preenchidos.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setMissingAlert(null)}>Entendi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel confirmation */}
      <AlertDialog open={cancelConfirm} onOpenChange={setCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar TAGs digitadas?</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem TAGs preenchidas que ainda não foram salvas. Se cancelar agora, nada será salvo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setEditingId(null); setTagInputs([]); setCancelConfirm(false); }}>
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
