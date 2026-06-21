import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Save, Wand2, Search, CheckCircle2, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/hyundai-mobis-logo.png";

const normalizePN = (pn: string | null | undefined) =>
  pn ? pn.toUpperCase().replace(/[-\s.]/g, "") : "";

interface Row {
  id: string;
  numero: string;
  data: string;
  fornecedor: string | null;
  projeto: string | null;
  part_number: string | null;
  part_name: string;
}

const AdminPartNameFix = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);

  // Load INC records with blank part_name
  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ["inc-blank-partname"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("apontamentos")
        .select("id,numero,data,fornecedor,projeto,part_number,part_name")
        .eq("tipo", "incoming")
        .or("part_name.is.null,part_name.eq.")
        .order("data", { ascending: false });
      if (error) throw error;
      return (data || []).map((r: any) => ({ ...r, part_name: r.part_name || "" }));
    },
  });

  // Load part_numbers catalog for suggestions (with project + supplier)
  const { data: catalog = [] } = useQuery({
    queryKey: ["part-numbers-catalog-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("part_numbers")
        .select("part_number,part_name,project,suppliers(name)")
        .eq("active", true);
      if (error) throw error;
      return data || [];
    },
  });

  // Picker dialog state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerRowId, setPickerRowId] = useState<string | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const pickerRow = useMemo(() => rows.find((r) => r.id === pickerRowId) || null, [rows, pickerRowId]);

  const pickerResults = useMemo(() => {
    if (!pickerRow) return [];
    const proj = (pickerRow.projeto || "").trim().toLowerCase();
    const supp = (pickerRow.fornecedor || "").trim().toLowerCase();
    const q = pickerQuery.trim().toLowerCase();
    return (catalog as any[])
      .filter((c) => {
        const cProj = (c.project || "").trim().toLowerCase();
        const cSupp = ((c.suppliers as any)?.name || "").trim().toLowerCase();
        // When user types a query, do a BATCH search across the whole catalog
        if (q) {
          return (
            (c.part_number || "").toLowerCase().includes(q) ||
            (c.part_name || "").toLowerCase().includes(q) ||
            cProj.includes(q) ||
            cSupp.includes(q)
          );
        }
        // Default: filter by the line's Projeto + Fornecedor
        if (proj && cProj !== proj) return false;
        if (supp && cSupp !== supp) return false;
        return true;
      })
      .sort((a, b) => {
        const aProj = (a.project || "").trim().toLowerCase();
        const aSupp = ((a.suppliers as any)?.name || "").trim().toLowerCase();
        const bProj = (b.project || "").trim().toLowerCase();
        const bSupp = ((b.suppliers as any)?.name || "").trim().toLowerCase();
        const aMatch = (aProj === proj ? 1 : 0) + (aSupp === supp ? 1 : 0);
        const bMatch = (bProj === proj ? 1 : 0) + (bSupp === supp ? 1 : 0);
        return bMatch - aMatch;
      })
      .slice(0, 200);
  }, [catalog, pickerRow, pickerQuery]);

  const openPicker = (rowId: string) => {
    setPickerRowId(rowId);
    setPickerQuery("");
    setPickerOpen(true);
  };

  const applyPickerSelection = async (part_number: string, part_name: string) => {
    if (!pickerRowId) return;
    setSaving(true);
    const { error } = await supabase
      .from("apontamentos")
      .update({ part_number, part_name })
      .eq("id", pickerRowId);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success(`Atualizado: ${part_number} — ${part_name}`);
    setEdits((p) => {
      const n = { ...p };
      delete n[pickerRowId];
      return n;
    });
    setSelected((p) => {
      const n = new Set(p);
      n.delete(pickerRowId);
      return n;
    });
    setPickerOpen(false);
    qc.invalidateQueries({ queryKey: ["inc-blank-partname"] });
    refetch();
  };

  const suggestionByPN = useMemo(() => {
    const map: Record<string, string> = {};
    (catalog as any[]).forEach((c) => {
      const k = normalizePN(c.part_number);
      if (k && c.part_name && !map[k]) map[k] = c.part_name;
    });
    return map;
  }, [catalog]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.numero?.toLowerCase().includes(q) ||
        r.part_number?.toLowerCase().includes(q) ||
        r.fornecedor?.toLowerCase().includes(q) ||
        r.projeto?.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const getSuggestion = (pn: string | null) => suggestionByPN[normalizePN(pn || "")] || "";

  const setEdit = (id: string, value: string) =>
    setEdits((p) => ({ ...p, [id]: value }));

  const toggleSelect = (id: string) =>
    setSelected((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.id)));
  };

  const applySuggestionsToSelected = () => {
    let count = 0;
    setEdits((p) => {
      const n = { ...p };
      filtered.forEach((r) => {
        if (!selected.has(r.id)) return;
        const sug = getSuggestion(r.part_number);
        if (sug) {
          n[r.id] = sug;
          count++;
        }
      });
      return n;
    });
    toast.success(`${count} sugestão(ões) aplicada(s)`);
  };

  const applyAllSuggestions = () => {
    let count = 0;
    setEdits((p) => {
      const n = { ...p };
      filtered.forEach((r) => {
        const sug = getSuggestion(r.part_number);
        if (sug) {
          n[r.id] = sug;
          count++;
        }
      });
      return n;
    });
    toast.success(`${count} sugestão(ões) aplicada(s)`);
  };

  const saveOne = async (id: string) => {
    const value = (edits[id] || "").trim();
    if (!value) {
      toast.error("Preencha o Part Name antes de salvar");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("apontamentos")
      .update({ part_name: value })
      .eq("id", id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success("Part Name atualizado");
    setEdits((p) => {
      const n = { ...p };
      delete n[id];
      return n;
    });
    setSelected((p) => {
      const n = new Set(p);
      n.delete(id);
      return n;
    });
    qc.invalidateQueries({ queryKey: ["inc-blank-partname"] });
    refetch();
  };

  const saveAllEdited = async () => {
    const entries = Object.entries(edits).filter(([, v]) => v && v.trim());
    if (entries.length === 0) {
      toast.error("Nenhuma alteração para salvar");
      return;
    }
    setSaving(true);
    let ok = 0;
    let fail = 0;
    for (const [id, value] of entries) {
      const { error } = await supabase
        .from("apontamentos")
        .update({ part_name: value.trim() })
        .eq("id", id);
      if (error) fail++;
      else ok++;
    }
    setSaving(false);
    toast.success(`${ok} registro(s) salvo(s)${fail ? `, ${fail} falha(s)` : ""}`);
    setEdits({});
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["inc-blank-partname"] });
    refetch();
  };

  const pendingCount = Object.values(edits).filter((v) => v && v.trim()).length;
  const suggestionsAvailable = filtered.filter((r) => getSuggestion(r.part_number)).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b sticky top-0 z-30">
        <div className="container mx-auto px-3 sm:px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/apontamentos")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <img src={logo} alt="Hyundai Mobis" className="h-6 sm:h-8 object-contain bg-white rounded-md px-2 py-0.5" />
          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-lg font-semibold truncate">Correção de Part Name (INC)</h1>
            <p className="text-xs text-muted-foreground">Apontamentos Incoming sem Part Name preenchido</p>
          </div>
          <Badge variant="outline" className="hidden sm:inline-flex">
            {rows.length} registro(s)
          </Badge>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 space-y-4">
        <Card className="p-3 sm:p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número, PN, fornecedor ou projeto"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={toggleSelectAll}>
                {selected.size === filtered.length && filtered.length > 0 ? "Desmarcar todos" : "Selecionar todos"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={applySuggestionsToSelected}
                disabled={selected.size === 0}
              >
                <Wand2 className="w-4 h-4 mr-1" /> Aplicar sugestões nos selecionados
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={applyAllSuggestions}
                disabled={suggestionsAvailable === 0}
              >
                <Wand2 className="w-4 h-4 mr-1" /> Aplicar todas as sugestões ({suggestionsAvailable})
              </Button>
              <Button
                size="sm"
                onClick={saveAllEdited}
                disabled={pendingCount === 0 || saving}
              >
                <Save className="w-4 h-4 mr-1" /> Salvar {pendingCount > 0 ? `(${pendingCount})` : ""}
              </Button>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {filtered.length} exibido(s) · {suggestionsAvailable} com sugestão no catálogo de Part Numbers · {pendingCount} edição(ões) pendente(s)
          </div>
        </Card>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
            <p className="font-medium">Nenhum registro encontrado</p>
            <p className="text-xs text-muted-foreground">
              Todos os apontamentos INC têm Part Name preenchido.
            </p>
          </Card>
        ) : (
          <>
            {/* Desktop table */}
            <Card className="hidden md:block overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase">
                    <tr>
                      <th className="p-2 text-left w-10">
                        <Checkbox
                          checked={selected.size === filtered.length && filtered.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </th>
                      <th className="p-2 text-left">Número</th>
                      <th className="p-2 text-left">Data</th>
                      <th className="p-2 text-left">Projeto</th>
                      <th className="p-2 text-left">Fornecedor</th>
                      <th className="p-2 text-left">Part Number</th>
                      <th className="p-2 text-left">Part Name</th>
                      <th className="p-2 text-left w-32">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => {
                      const sug = getSuggestion(r.part_number);
                      const value = edits[r.id] ?? "";
                      const hasEdit = !!value.trim();
                      return (
                        <tr key={r.id} className="border-t hover:bg-muted/30">
                          <td className="p-2">
                            <Checkbox
                              checked={selected.has(r.id)}
                              onCheckedChange={() => toggleSelect(r.id)}
                            />
                          </td>
                          <td className="p-2 font-mono text-xs">{r.numero}</td>
                          <td className="p-2 text-xs">{r.data}</td>
                          <td className="p-2 text-xs">{r.projeto || "—"}</td>
                          <td className="p-2 text-xs">{r.fornecedor || "—"}</td>
                          <td className="p-2 font-mono text-xs">
                            <div className="flex items-center gap-1">
                              <span className="flex-1">{r.part_number || "—"}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0"
                                title="Buscar Part Number por Projeto/Fornecedor"
                                onClick={() => openPicker(r.id)}
                              >
                                <Search className="w-3.5 h-3.5 text-blue-600" />
                              </Button>
                            </div>
                          </td>
                          <td className="p-2">
                            <Input
                              value={value}
                              placeholder={sug || "Digite o Part Name"}
                              onChange={(e) => setEdit(r.id, e.target.value)}
                              className={`h-8 text-xs ${hasEdit ? "border-emerald-500 ring-1 ring-emerald-500" : "border-destructive"}`}
                            />
                            {sug && (
                              <button
                                type="button"
                                onClick={() => setEdit(r.id, sug)}
                                className="text-[10px] text-blue-600 hover:underline mt-0.5"
                              >
                                Sugestão: {sug}
                              </button>
                            )}
                          </td>
                          <td className="p-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => saveOne(r.id)}
                              disabled={!hasEdit || saving}
                              className="h-7 text-xs"
                            >
                              <Save className="w-3 h-3 mr-1" /> Salvar
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {filtered.map((r) => {
                const sug = getSuggestion(r.part_number);
                const value = edits[r.id] ?? "";
                const hasEdit = !!value.trim();
                return (
                  <Card key={r.id} className="p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <Checkbox
                        checked={selected.has(r.id)}
                        onCheckedChange={() => toggleSelect(r.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-semibold">{r.numero}</span>
                          <Badge variant="outline" className="text-[10px]">{r.data}</Badge>
                          {r.projeto && <Badge variant="secondary" className="text-[10px]">{r.projeto}</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">{r.fornecedor || "—"}</div>
                        <div className="font-mono text-xs mt-0.5 flex items-center gap-1">
                          <span className="flex-1">{r.part_number || "—"}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            title="Buscar Part Number por Projeto/Fornecedor"
                            onClick={() => openPicker(r.id)}
                          >
                            <Search className="w-3.5 h-3.5 text-blue-600" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    <Input
                      value={value}
                      placeholder={sug || "Digite o Part Name"}
                      onChange={(e) => setEdit(r.id, e.target.value)}
                      className={`h-9 text-xs ${hasEdit ? "border-emerald-500 ring-1 ring-emerald-500" : "border-destructive"}`}
                    />
                    {sug && (
                      <button
                        type="button"
                        onClick={() => setEdit(r.id, sug)}
                        className="text-[11px] text-blue-600 hover:underline"
                      >
                        Aplicar sugestão: {sug}
                      </button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => saveOne(r.id)}
                      disabled={!hasEdit || saving}
                      className="w-full h-8 text-xs"
                    >
                      <Save className="w-3 h-3 mr-1" /> Salvar
                    </Button>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </main>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="w-5 h-5 text-blue-500" />
              Buscar Part Number
            </DialogTitle>
          </DialogHeader>
          {pickerRow && (
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">Projeto: {pickerRow.projeto || "—"}</Badge>
              <Badge variant="secondary">Fornecedor: {pickerRow.fornecedor || "—"}</Badge>
              <Badge variant="outline" className="font-mono">PN atual: {pickerRow.part_number || "—"}</Badge>
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Filtrar por Part Number ou Part Name"
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            {pickerResults.length} resultado(s) — {pickerQuery.trim()
              ? "busca em todo o catálogo (BATCH)"
              : "filtrado por Projeto e Fornecedor da linha"}
          </div>
          <div className="flex-1 overflow-y-auto border rounded-md divide-y">
            {pickerResults.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Nenhum Part Number encontrado. Digite para buscar em todo o catálogo.
              </div>
            ) : (
              pickerResults.map((c: any, i: number) => {
                const cProj = (c.project || "").trim();
                const cSupp = (c.suppliers as any)?.name || "";
                const matchProj = cProj.toLowerCase() === (pickerRow?.projeto || "").trim().toLowerCase();
                const matchSupp = cSupp.trim().toLowerCase() === (pickerRow?.fornecedor || "").trim().toLowerCase();
                const fullMatch = matchProj && matchSupp;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applyPickerSelection(c.part_number, c.part_name)}
                    disabled={saving}
                    className={`w-full text-left p-2.5 hover:bg-muted transition-colors flex items-center gap-3 disabled:opacity-50 ${fullMatch ? "bg-primary/5" : ""}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm font-semibold">{c.part_number}</div>
                      <div className="text-xs text-muted-foreground truncate">{c.part_name}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <Badge variant={matchProj ? "default" : "outline"} className="text-[10px]">
                          Projeto: {cProj || "—"}
                        </Badge>
                        <Badge variant={matchSupp ? "default" : "outline"} className="text-[10px]">
                          Fornecedor: {cSupp || "—"}
                        </Badge>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPartNameFix;
