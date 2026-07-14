import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft, Search, Plus, Pencil, Trash2, Loader2, GraduationCap, Save, AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import logo from "@/assets/hyundai-mobis-logo.png";
import { toast } from "sonner";

const COLOR_OPTIONS = [
  "bg-orange-700", "bg-red-700", "bg-rose-700", "bg-amber-700", "bg-yellow-700",
  "bg-lime-700", "bg-green-700", "bg-emerald-700", "bg-teal-700", "bg-cyan-700",
  "bg-blue-700", "bg-indigo-700", "bg-violet-700", "bg-fuchsia-700", "bg-slate-700",
];

type Category = {
  id: string; name: string; description: string | null; color: string;
  sort_order: number; active: boolean;
};

type Record = {
  id: string; user_id: string; category_id: string; habilitado: boolean;
  last_training_date: string | null; next_training_date: string | null; notes: string | null;
};

const statusOf = (r?: Record | null) => {
  if (!r || !r.habilitado) return "none";
  if (!r.next_training_date) return "ok";
  const next = new Date(r.next_training_date + "T12:00:00");
  const now = new Date();
  const diff = (next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return "expired";
  if (diff <= 30) return "warning";
  return "ok";
};

const cellClass = (s: string) => {
  switch (s) {
    case "ok": return "bg-emerald-500/20 border-emerald-500/50 text-emerald-700 dark:text-emerald-300";
    case "warning": return "bg-amber-500/20 border-amber-500/50 text-amber-700 dark:text-amber-300";
    case "expired": return "bg-red-500/20 border-red-500/50 text-red-700 dark:text-red-300 animate-pulse";
    default: return "bg-muted/30 border-border text-muted-foreground";
  }
};

const SesmtMatrizTreinamentos = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [turnoFilter, setTurnoFilter] = useState<string>("");

  // Dialogs
  const [catDialog, setCatDialog] = useState<{ mode: "add" | "edit"; cat?: Category } | null>(null);
  const [catForm, setCatForm] = useState<{ name: string; description: string; color: string }>({
    name: "", description: "", color: "bg-orange-700",
  });
  const [catDeleteId, setCatDeleteId] = useState<string | null>(null);
  const [recordDialog, setRecordDialog] = useState<{ userId: string; userName: string; category: Category; record?: Record } | null>(null);
  const [recForm, setRecForm] = useState<{ habilitado: boolean; last: string; next: string; notes: string }>({
    habilitado: false, last: "", next: "", notes: "",
  });

  const { data: categories = [], isLoading: loadingCats } = useQuery({
    queryKey: ["sesmt-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sesmt_training_categories" as any)
        .select("*").eq("active", true).order("sort_order");
      if (error) throw error;
      return (data || []) as unknown as Category[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["sesmt-profiles"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("public_profiles")
        .select("id, full_name, employee_number, cargo, turno, setor")
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: records = [] } = useQuery({
    queryKey: ["sesmt-records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sesmt_training_records" as any).select("*");
      if (error) throw error;
      return (data || []) as unknown as Record[];
    },
  });

  const recordMap = useMemo(() => {
    const m = new Map<string, Record>();
    records.forEach((r) => m.set(`${r.user_id}:${r.category_id}`, r));
    return m;
  }, [records]);

  const filteredProfiles = useMemo(() => {
    const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const term = norm(search.trim());
    return (profiles as any[]).filter((p) => {
      if (turnoFilter && p.turno !== turnoFilter) return false;
      if (!term) return true;
      return norm(p.full_name || "").includes(term) ||
        norm(p.employee_number || "").includes(term) ||
        norm(p.cargo || "").includes(term);
    });
  }, [profiles, search, turnoFilter]);

  const openAddCategory = () => {
    setCatForm({ name: "", description: "", color: "bg-orange-700" });
    setCatDialog({ mode: "add" });
  };
  const openEditCategory = (cat: Category) => {
    setCatForm({ name: cat.name, description: cat.description || "", color: cat.color });
    setCatDialog({ mode: "edit", cat });
  };

  const saveCategory = async () => {
    if (!catForm.name.trim()) { toast.error("Nome é obrigatório"); return; }
    try {
      if (catDialog?.mode === "add") {
        const maxOrder = Math.max(0, ...categories.map((c) => c.sort_order));
        const { error } = await supabase.from("sesmt_training_categories" as any).insert({
          name: catForm.name.trim(),
          description: catForm.description.trim() || null,
          color: catForm.color,
          sort_order: maxOrder + 1,
          created_by: user?.id,
        });
        if (error) throw error;
        toast.success("Aba criada");
      } else if (catDialog?.cat) {
        const { error } = await supabase.from("sesmt_training_categories" as any).update({
          name: catForm.name.trim(),
          description: catForm.description.trim() || null,
          color: catForm.color,
        }).eq("id", catDialog.cat.id);
        if (error) throw error;
        toast.success("Aba atualizada");
      }
      setCatDialog(null);
      qc.invalidateQueries({ queryKey: ["sesmt-categories"] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    }
  };

  const deleteCategory = async () => {
    if (!catDeleteId) return;
    try {
      const { error } = await supabase.from("sesmt_training_categories" as any)
        .update({ active: false }).eq("id", catDeleteId);
      if (error) throw error;
      toast.success("Aba excluída");
      setCatDeleteId(null);
      qc.invalidateQueries({ queryKey: ["sesmt-categories"] });
      qc.invalidateQueries({ queryKey: ["sesmt-records"] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir");
    }
  };

  const openRecord = (userId: string, userName: string, category: Category) => {
    if (!isAdmin) return;
    const rec = recordMap.get(`${userId}:${category.id}`);
    setRecForm({
      habilitado: rec?.habilitado || false,
      last: rec?.last_training_date || "",
      next: rec?.next_training_date || "",
      notes: rec?.notes || "",
    });
    setRecordDialog({ userId, userName, category, record: rec });
  };

  const saveRecord = async () => {
    if (!recordDialog) return;
    try {
      const payload = {
        user_id: recordDialog.userId,
        category_id: recordDialog.category.id,
        habilitado: recForm.habilitado,
        last_training_date: recForm.last || null,
        next_training_date: recForm.next || null,
        notes: recForm.notes.trim() || null,
        updated_by: user?.id,
      };
      if (recordDialog.record) {
        const { error } = await supabase.from("sesmt_training_records" as any)
          .update(payload).eq("id", recordDialog.record.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sesmt_training_records" as any).insert(payload);
        if (error) throw error;
      }
      toast.success("Registro salvo");
      setRecordDialog(null);
      qc.invalidateQueries({ queryKey: ["sesmt-records"] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    }
  };

  const turnos = useMemo(() => {
    const s = new Set<string>();
    (profiles as any[]).forEach((p) => p.turno && s.add(p.turno));
    return Array.from(s);
  }, [profiles]);

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-4 py-4 md:py-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => navigate("/sesmt")} className="header-btn text-xs md:text-sm">
                <ArrowLeft className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Voltar</span>
              </Button>
              <img src={logo} alt="Hyundai Mobis" className="h-8 md:h-10 object-contain bg-white rounded-md px-2 py-1" />
            </div>
            {isAdmin && (
              <Button onClick={openAddCategory} size="sm" className="gap-2 bg-white text-primary hover:bg-white/90">
                <Plus className="w-4 h-4" /> Nova Aba
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <GraduationCap className="w-6 h-6 md:w-8 md:h-8" />
            <h1 className="text-xl md:text-3xl font-heading font-bold">Matriz de Treinamentos — SESMT</h1>
          </div>
          <p className="mt-1 text-primary-foreground/70 text-xs md:text-sm">
            Segurança do Trabalho, Meio Ambiente e capacitações técnicas.
          </p>
        </div>
      </header>

      <main className="container mx-auto px-2 md:px-4 py-4 md:py-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-2 md:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, matrícula ou cargo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={turnoFilter || "all"} onValueChange={(v) => setTurnoFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-full md:w-48"><SelectValue placeholder="Todos os turnos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os turnos</SelectItem>
              {turnos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-2 text-[10px] md:text-xs text-muted-foreground">
          <span className="px-2 py-1 rounded border bg-emerald-500/20 border-emerald-500/50">Em dia</span>
          <span className="px-2 py-1 rounded border bg-amber-500/20 border-amber-500/50">Vence em ≤ 30 dias</span>
          <span className="px-2 py-1 rounded border bg-red-500/20 border-red-500/50">Vencido</span>
          <span className="px-2 py-1 rounded border bg-muted/30 border-border">Não treinado</span>
        </div>

        {/* Matrix */}
        {loadingCats ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : categories.length === 0 ? (
          <div className="border rounded-xl p-8 text-center text-muted-foreground">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            Nenhuma aba de treinamento cadastrada.
            {isAdmin && <div className="mt-3"><Button size="sm" onClick={openAddCategory}><Plus className="w-4 h-4 mr-1" /> Criar primeira aba</Button></div>}
          </div>
        ) : (
          <div className="border rounded-xl overflow-x-auto bg-card">
            <table className="w-full text-xs md:text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left py-2 px-2 sticky left-0 bg-muted/40 z-10 min-w-[180px]">Inspetor</th>
                  <th className="text-center py-2 px-2 min-w-[80px]">Turno</th>
                  {categories.map((cat) => (
                    <th key={cat.id} className="text-center py-2 px-2 min-w-[130px]">
                      <div className="flex flex-col items-center gap-1">
                        <div className={`${cat.color} text-white rounded px-2 py-1 text-[10px] md:text-xs font-semibold w-full truncate`} title={cat.description || cat.name}>
                          {cat.name}
                        </div>
                        {isAdmin && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => openEditCategory(cat)} title="Editar aba">
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => setCatDeleteId(cat.id)} title="Excluir aba">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredProfiles.map((p: any) => (
                  <tr key={p.id} className="border-b hover:bg-muted/20">
                    <td className="py-2 px-2 sticky left-0 bg-card z-10">
                      <div className="font-medium truncate max-w-[220px]">{p.full_name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{p.employee_number} • {p.cargo || "—"}</div>
                    </td>
                    <td className="py-2 px-2 text-center text-muted-foreground">{p.turno || "—"}</td>
                    {categories.map((cat) => {
                      const rec = recordMap.get(`${p.id}:${cat.id}`);
                      const s = statusOf(rec);
                      return (
                        <td key={cat.id} className="py-1.5 px-1.5 text-center">
                          <button
                            className={`w-full rounded border px-1.5 py-1 text-[10px] md:text-xs font-medium transition ${cellClass(s)} ${isAdmin ? "hover:opacity-80 cursor-pointer" : "cursor-default"}`}
                            onClick={() => openRecord(p.id, p.full_name, cat)}
                            disabled={!isAdmin}
                          >
                            {rec?.habilitado ? (
                              rec.next_training_date ? new Date(rec.next_training_date + "T12:00:00").toLocaleDateString("pt-BR") : "OK"
                            ) : "—"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {filteredProfiles.length === 0 && (
                  <tr><td colSpan={categories.length + 2} className="text-center text-muted-foreground py-8">Nenhum usuário encontrado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Category dialog */}
      <Dialog open={!!catDialog} onOpenChange={(o) => !o && setCatDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{catDialog?.mode === "add" ? "Nova Aba de Treinamento" : "Editar Aba"}</DialogTitle>
            <DialogDescription>Cadastre um treinamento SESMT (NR, Meio Ambiente, etc).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} placeholder="Ex: NR-35 - Trabalho em Altura" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={2} value={catForm.description} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })} />
            </div>
            <div>
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c} type="button"
                    onClick={() => setCatForm({ ...catForm, color: c })}
                    className={`${c} w-8 h-8 rounded ring-offset-2 ring-offset-background ${catForm.color === c ? "ring-2 ring-primary" : ""}`}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialog(null)}>Cancelar</Button>
            <Button onClick={saveCategory}><Save className="w-4 h-4 mr-1" /> Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete category */}
      <AlertDialog open={!!catDeleteId} onOpenChange={(o) => !o && setCatDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir aba?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação desativa a aba e oculta todos os registros associados. Não pode ser desfeita pela interface.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteCategory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Record edit dialog */}
      <Dialog open={!!recordDialog} onOpenChange={(o) => !o && setRecordDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{recordDialog?.userName}</DialogTitle>
            <DialogDescription>
              <Badge className={`${recordDialog?.category.color} text-white`}>{recordDialog?.category.name}</Badge>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={recForm.habilitado} onCheckedChange={(v) => setRecForm({ ...recForm, habilitado: !!v })} />
              <span className="text-sm font-medium">Habilitado neste treinamento</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Último treinamento</Label>
                <Input type="date" value={recForm.last} onChange={(e) => setRecForm({ ...recForm, last: e.target.value })} />
              </div>
              <div>
                <Label>Próximo treinamento</Label>
                <Input type="date" value={recForm.next} onChange={(e) => setRecForm({ ...recForm, next: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea rows={3} value={recForm.notes} onChange={(e) => setRecForm({ ...recForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordDialog(null)}>Cancelar</Button>
            <Button onClick={saveRecord}><Save className="w-4 h-4 mr-1" /> Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SesmtMatrizTreinamentos;
