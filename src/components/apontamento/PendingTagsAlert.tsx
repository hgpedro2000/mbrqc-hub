import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useTagPermission } from "@/hooks/useTagPermission";
import { useUserRole } from "@/hooks/useUserRole";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag, AlertTriangle, Loader2, CheckCircle, X, Upload, Download } from "lucide-react";
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
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeProfile = impersonating || profile;

  // Build a list of defect "slots" — one TAG per modo de falha.
  const getDefectSlots = (item: any): Array<{ kind: "main" | "sd"; index: number; modo: string; descricao: string; qty: number; tag: string }> => {
    const sd = Array.isArray(item?.segundo_defeitos) ? item.segundo_defeitos : [];
    const slots: any[] = [];
    const hasMain = !!(item?.modo_falha && String(item.modo_falha).trim());
    const mainTags = String(item?.numero_tag || item?.tag_number || "")
      .split(/[,;]+/).map((s: string) => s.trim()).filter(Boolean);
    if (hasMain) {
      slots.push({
        kind: "main", index: -1,
        modo: String(item.modo_falha),
        descricao: String(item?.descricao_defeito || ""),
        qty: Number(item?.quantidade_ng) || 0,
        tag: mainTags[0] || "",
      });
    }
    sd.forEach((d: any, i: number) => {
      slots.push({
        kind: "sd", index: i,
        modo: String(d?.modo_falha || ""),
        descricao: String(d?.descricao || ""),
        qty: Number(d?.qty) || 0,
        tag: String(d?.tag || "").trim(),
      });
    });
    // Fallback: no defect metadata but has NG → single slot mapped to numero_tag
    if (slots.length === 0 && (item?.quantidade_ng || 0) > 0) {
      slots.push({ kind: "main", index: -1, modo: "", descricao: "", qty: Number(item?.quantidade_ng) || 0, tag: mainTags[0] || "" });
    }
    // If main tag string has more entries than main slot (legacy), map extras onto sd slots that are empty
    if (mainTags.length > 1) {
      let mi = hasMain ? 1 : 0;
      for (const s of slots) {
        if (s.kind === "sd" && !s.tag && mainTags[mi]) { s.tag = mainTags[mi]; mi++; }
      }
    }
    return slots;
  };

  const computeTagStatus = (item: any) => {
    const slots = getDefectSlots(item);
    const expected = slots.length;
    const filled = slots.filter((s) => !!s.tag).length;
    return { expected, filled, missing: Math.max(0, expected - filled), slots };
  };

  const fetchPending = async () => {
    if (!user) return;
    let query = supabase
      .from("apontamentos")
      .select("id, numero, part_number, part_name, fornecedor, quantidade_ng, turno, data, responsavel, numero_tag, tag_number, responsabilidade_defeito, local_deteccao, fase, modo_falha, descricao_defeito, segundo_defeitos")
      .neq("status", "draft")
      .gt("quantidade_ng", 0)
      .order("data", { ascending: false });

    if (!isAdmin && activeProfile?.turno) {
      query = query.eq("turno", activeProfile.turno);
    } else if (!isAdmin && !activeProfile?.turno) {
      setPendingItems([]);
      return;
    }

    const data = (await query).data || [];
    const pending = data.filter((it: any) => computeTagStatus(it).missing > 0);
    setPendingItems(pending);
  };

  const getTagCount = (item: any) => {
    const { expected } = computeTagStatus(item);
    return Math.max(1, expected);
  };

  useEffect(() => {
    if (canInsertTag) fetchPending();
  }, [canInsertTag, user, isAdmin]);

  const handleExportExcel = () => {
    if (pendingItems.length === 0) {
      toast.info("Nenhum pendente para exportar");
      return;
    }
    const rows = pendingItems.map((it) => {
      const { missing } = computeTagStatus(it);
      return {
        Numero: it.numero || "",
        "Part Number": it.part_number || "",
        "Part Name": it.part_name || "",
        Fornecedor: it.fornecedor || "",
        "Qtd NG": it.quantidade_ng ?? 0,
        Turno: it.turno || "",
        Data: it.data ? formatLocalDateString(it.data) : "",
        "TAGs Faltantes": missing,
        "TAGs (separar por vírgula ou ponto-e-vírgula)": "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 12 }, { wch: 18 }, { wch: 30 }, { wch: 18 },
      { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 8 }, { wch: 40 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "TAGs Pendentes");
    const now = new Date();
    const ts = `${String(now.getDate()).padStart(2, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}_${String(now.getHours()).padStart(2, "0")}h${String(now.getMinutes()).padStart(2, "0")}`;
    XLSX.writeFile(wb, `TAGs_Pendentes_${ts}.xlsx`);
    toast.success(`${rows.length} pendente(s) exportado(s)`);
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = "";

    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });

      if (jsonData.length === 0) {
        toast.error("Planilha vazia");
        return;
      }

      // Find the TAG column (flexible matching)
      const sample = jsonData[0];
      const headers = Object.keys(sample);
      const numeroKey = headers.find((h) => h.toLowerCase().trim() === "numero" || h.toLowerCase().trim() === "número");
      const tagsKey = headers.find((h) => h.toLowerCase().includes("tag") && !h.toLowerCase().includes("faltante"));

      if (!numeroKey || !tagsKey) {
        toast.error("Cabeçalhos não encontrados. Use o template (colunas 'Numero' e 'TAGs').");
        return;
      }

      // Build lookup of pending items by numero
      const pendingByNumero = new Map<string, any>();
      pendingItems.forEach((it) => {
        if (it.numero) pendingByNumero.set(String(it.numero).trim().toUpperCase(), it);
      });

      let success = 0;
      let skipped = 0;
      let errors = 0;
      const errorMsgs: string[] = [];

      for (const row of jsonData) {
        const numero = String(row[numeroKey] ?? "").trim().toUpperCase();
        const tagsRaw = String(row[tagsKey] ?? "").trim();
        if (!numero || !tagsRaw) { skipped++; continue; }

        const item = pendingByNumero.get(numero);
        if (!item) { skipped++; continue; }

        const tags = tagsRaw.split(/[,;]+/).map((t) => t.trim()).filter(Boolean);
        const expected = getTagCount(item);
        if (tags.length < expected) {
          errors++;
          errorMsgs.push(`${numero}: ${tags.length}/${expected} TAGs`);
          continue;
        }

        try {
          const { data, error } = await supabase.functions.invoke("insert-tag", {
            body: {
              id: item.id,
              numero_tag: tags.slice(0, expected).join(", "),
              impersonatedUserId: impersonating?.id || null,
            },
          });
          if (error || data?.error) throw new Error(error?.message || data?.error);
          success++;
        } catch (err: any) {
          errors++;
          errorMsgs.push(`${numero}: ${err?.message || "erro"}`);
        }
      }

      await fetchPending();

      if (success > 0) toast.success(`${success} TAG(s) importada(s) com sucesso`);
      if (skipped > 0) toast.info(`${skipped} linha(s) ignorada(s) (sem correspondência ou TAG vazia)`);
      if (errors > 0) toast.error(`${errors} erro(s): ${errorMsgs.slice(0, 3).join(" | ")}${errorMsgs.length > 3 ? "..." : ""}`);
    } catch (err: any) {
      toast.error("Erro ao ler arquivo: " + (err?.message || ""));
    } finally {
      setImporting(false);
    }
  };


  const handleSaveTag = async (item: any) => {
    const slots = getDefectSlots(item);
    const qty = slots.length;
    const trimmed = tagInputs.slice(0, qty).map(t => (t || "").trim());
    const missing = trimmed.filter(t => !t).length;
    if (missing > 0) {
      setMissingAlert({ qty, missing });
      return;
    }
    setSaving(true);
    try {
      // Apply each tag to its slot: main goes to first mainTag position, sd goes to segundo_defeitos[i].tag
      const sd = Array.isArray(item?.segundo_defeitos) ? [...item.segundo_defeitos] : [];
      const mainTagPieces: string[] = [];
      slots.forEach((s, idx) => {
        const val = trimmed[idx];
        if (s.kind === "main") {
          mainTagPieces[0] = val;
        } else {
          sd[s.index] = { ...(sd[s.index] || {}), tag: val };
        }
      });
      // Compose numero_tag from all tags (main + sd) so legacy consumers keep working
      const allTags = [
        ...(mainTagPieces.filter(Boolean)),
        ...sd.map((d: any) => (d?.tag || "").toString().trim()).filter(Boolean),
      ];
      const joined = allTags.join(", ");

      const { error } = await supabase
        .from("apontamentos")
        .update({
          numero_tag: joined || null,
          segundo_defeitos: sd,
          tag_inserted_at: new Date().toISOString(),
          tag_inserted_by: activeProfile?.full_name || "",
        } as any)
        .eq("id", item.id);
      if (error) throw error;
      toast.success("TAGs salvas!");
      setTagInputs([]);
      setEditingId(null);
      await fetchPending();
    } catch (e: any) {
      console.error("[PendingTags] save error", e);
      toast.error("Erro ao salvar TAG: " + (e?.message || "desconhecido"));
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
        <DialogContent className="!max-w-[calc(100dvw-16px)] w-[calc(100dvw-16px)] sm:!max-w-[640px] sm:w-full max-h-[90dvh] sm:max-h-[85vh] overflow-y-auto overflow-x-hidden p-3 sm:p-6">
          <DialogHeader className="min-w-0">
            <DialogTitle className="flex items-start gap-2 text-sm sm:text-base break-words pr-8">
              <Tag className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="break-words min-w-0 flex-1 text-left">Pendentes de TAG {isAdmin ? "— Todos os Turnos" : `— Turno ${activeProfile?.turno}`}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 pt-1 border-b pb-2 min-w-0">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5 px-2 min-w-0"
              onClick={handleExportExcel}
              disabled={importing || pendingItems.length === 0}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="sm:hidden truncate">Exportar</span>
              <span className="hidden sm:inline">Exportar Excel</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5 px-2 min-w-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              <span className="sm:hidden truncate">{importing ? "..." : "Importar"}</span>
              <span className="hidden sm:inline">{importing ? "Importando..." : "Importar Excel"}</span>
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportExcel}
              className="hidden"
            />
          </div>



          <div className="space-y-3 pt-2 min-w-0 overflow-hidden">
            {pendingItems.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">
                Nenhum apontamento pendente de TAG.
              </p>
            ) : (
              pendingItems.map((item) => (
                <div key={item.id} className="border rounded-lg p-3 space-y-2 w-full min-w-0 max-w-full overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 min-w-0">
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          onClick={() => setViewTarget(item.id)}
                          className="text-xs font-mono text-primary hover:underline bg-muted/30 px-1.5 py-0.5 rounded max-w-full truncate"
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
                      <p className="text-sm font-semibold break-all">{item.part_number}</p>
                      <p className="text-xs text-muted-foreground break-words">{item.part_name || "—"}</p>
                      <p className="text-xs text-muted-foreground/70 break-words">
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
