import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UserPlus, Loader2, Pencil, KeyRound, Trash2, LayoutGrid, Search, ClipboardList, FlaskConical, ShieldCheck, Copy, MessageCircle, ArrowUp } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import ModulePermissionsTab from "./ModulePermissionsTab";
import EmpresasTerceirasDialog from "./EmpresasTerceirasDialog";
import { openWhatsApp, buildResetPasswordMessage } from "@/lib/whatsapp";
import { evaluatePassword, isPasswordValid, MIN_PASSWORD_LENGTH } from "@/lib/passwordPolicy";

const TURNOS = ["1T", "2T", "3T"];
const EXTRA_EMPRESA_TERCEIRA_OPTIONS = ["Residente"];
const CARGOS = [
  "Auxiliar de Qualidade", "Inspetor de Qualidade", "Assistente de Qualidade",
  "Lider de Qualidade", "Analista de Qualidade", "Supervisor de Qualidade",
  "Gerente de Qualidade", "Diretor de Qualidade",
];

interface UsersTabProps {
  pendingRequests?: any[];
  onRequestResolved?: () => void;
  toolbarExtras?: React.ReactNode;
}

const UsersTab = ({ pendingRequests = [], onRequestResolved, toolbarExtras }: UsersTabProps) => {

  const qc = useQueryClient();
  const [open, setOpen] = useState(() => {
    const prefill = sessionStorage.getItem("prefill_new_user");
    return !!prefill;
  });
  const [modulesOpen, setModulesOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // Pre-fill from HelpDesk request
  const prefillData = (() => {
    try {
      const raw = sessionStorage.getItem("prefill_new_user");
      if (raw) {
        sessionStorage.removeItem("prefill_new_user");
        return JSON.parse(raw);
      }
    } catch {}
    return null;
  })();

  const [employeeNumber, setEmployeeNumber] = useState(prefillData?.employee_number || "");
  const [fullName, setFullName] = useState(prefillData?.full_name || "");
  const [role, setRole] = useState("user");
  const [password, setPassword] = useState("");
  const [turno, setTurno] = useState(prefillData?.turno || "");
  const [email, setEmail] = useState(prefillData?.email || "");
  const [cargo, setCargo] = useState(prefillData?.cargo || "");
  const [empresa, setEmpresa] = useState(prefillData?.empresa || "mobis_brasil");
  const [empresaTerceira, setEmpresaTerceira] = useState(prefillData?.empresa_terceira || "");
  const [saving, setSaving] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [pendingListOpen, setPendingListOpen] = useState(false);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [searchCollapsed, setSearchCollapsed] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [floatingTop, setFloatingTop] = useState(120);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setShowBackToTop(y > 400);
      // Recolhe ao rolar para baixo, desde que não esteja focado nem com texto
      if (y > 80 && !searchFocused && !searchTerm.trim()) {
        setSearchCollapsed(true);
      }
      // Reexpande ao voltar ao topo
      if (y <= 20) {
        setSearchCollapsed(false);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [searchFocused, searchTerm]);



  // Calculate floating search button offset based on actual header + tabs height
  useEffect(() => {
    const updateTop = () => {
      const header = document.querySelector("header.gradient-header") as HTMLElement | null;
      const tabsList = document.querySelector('[role="tablist"]') as HTMLElement | null;
      const headerH = header?.offsetHeight || 112;
      const tabsH = tabsList?.offsetHeight || 48;
      // small gap below tabs
      setFloatingTop(headerH + tabsH + 8);
    };
    updateTop();
    const observer = new ResizeObserver(updateTop);
    const header = document.querySelector("header.gradient-header");
    const tabsList = document.querySelector('[role="tablist"]');
    if (header) observer.observe(header);
    if (tabsList) observer.observe(tabsList);
    window.addEventListener("resize", updateTop, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateTop);
    };
  }, []);

  const [editId, setEditId] = useState("");
  const [editEmployeeNumber, setEditEmployeeNumber] = useState("");
  const [editFullName, setEditFullName] = useState("");
  const [editRole, setEditRole] = useState("user");
  const [editTurno, setEditTurno] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editCargo, setEditCargo] = useState("");
  const [editEmpresa, setEditEmpresa] = useState("mobis_brasil");
  const [editEmpresaTerceira, setEditEmpresaTerceira] = useState("");

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["eng-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["eng-user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-for-residente"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("name, code").eq("active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: empresasTerceirasList = [] } = useQuery({
    queryKey: ["empresas-terceiras-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas_terceiras")
        .select("name, prefix, pad")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  /**
   * Resolve the prefix + pad used to build matrículas for a given empresa/empresa_terceira combo.
   */
  const resolvePrefixPad = (emp: string, empTerc: string): { prefix: string; pad: number } | null => {
    if (emp !== "empresa_terceira" || !empTerc) return null;
    if (empTerc === "Residente" || empTerc.startsWith("Residente - ")) {
      const supplierName = empTerc.replace("Residente - ", "");
      const sup = (suppliers as any[]).find((s) => s.name === supplierName);
      if (!sup || !sup.code || sup.code === "-") return null;
      return { prefix: String(sup.code).toUpperCase(), pad: 2 };
    }
    const et = (empresasTerceirasList as any[]).find((e) => e.name === empTerc);
    if (!et?.prefix) return null;
    return { prefix: String(et.prefix).toUpperCase(), pad: et.pad || 4 };
  };

  /**
   * Auto-generate the next available matrícula for Terceiros / Residentes via RPC
   * (uses transactional advisory lock + unique constraint to avoid duplicates).
   */
  const generateEmployeeNumber = async (emp: string, empTerc: string): Promise<string | null> => {
    const pp = resolvePrefixPad(emp, empTerc);
    if (!pp) {
      toast.error("Fornecedor/empresa sem prefixo cadastrado.");
      return null;
    }
    const { data, error } = await (supabase.rpc as any)("next_employee_number", {
      _prefix: pp.prefix,
      _pad: pp.pad,
    });
    if (error) {
      toast.error("Erro ao gerar matrícula: " + error.message);
      return null;
    }
    if (!data) {
      toast.error("Sequência esgotada para este prefixo.");
      return null;
    }
    return data as string;
  };

  // Live preview of next available matrícula for the New User dialog
  const newPP = resolvePrefixPad(empresa, empresaTerceira);
  const { data: nextPreview } = useQuery({
    queryKey: ["next-emp-num", newPP?.prefix, newPP?.pad],
    queryFn: async () => {
      if (!newPP) return null;
      const { data } = await (supabase.rpc as any)("next_employee_number", {
        _prefix: newPP.prefix,
        _pad: newPP.pad,
      });
      return (data as string) || null;
    },
    enabled: !!newPP && open,
    refetchInterval: open && !!newPP ? 5000 : false,
  });

  // Live preview for the Edit dialog
  const editPP = resolvePrefixPad(editEmpresa, editEmpresaTerceira);
  const { data: nextPreviewEdit } = useQuery({
    queryKey: ["next-emp-num-edit", editPP?.prefix, editPP?.pad],
    queryFn: async () => {
      if (!editPP) return null;
      const { data } = await (supabase.rpc as any)("next_employee_number", {
        _prefix: editPP.prefix,
        _pad: editPP.pad,
      });
      return (data as string) || null;
    },
    enabled: !!editPP && editOpen,
    refetchInterval: editOpen && !!editPP ? 5000 : false,
  });




  const getRoleForUser = (userId: string) => {
    const r = roles.find((r: any) => r.user_id === userId);
    return r?.role || "user";
  };

  const getEmpresaLabel = (p: any) => {
    if (p.empresa === "empresa_terceira") {
      return p.empresa_terceira || "Terceira";
    }
    return "Mobis Brasil";
  };

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return profiles;
    const term = searchTerm.toLowerCase();
    return profiles.filter((p: any) =>
      p.full_name?.toLowerCase().includes(term) ||
      p.employee_number?.toLowerCase().includes(term) ||
      p.email?.toLowerCase().includes(term) ||
      getEmpresaLabel(p).toLowerCase().includes(term)
    );
  }, [profiles, searchTerm]);

  const handleCreate = async () => {
    if (!employeeNumber || !fullName || !turno) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-user-admin", {
        body: {
          employee_number: employeeNumber,
          full_name: fullName,
          password,
          role,
          turno,
          email: email || null,
          empresa,
          empresa_terceira: empresa === "empresa_terceira" ? empresaTerceira : null,
          cargo: cargo || null,
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success("Usuário criado com sucesso!");
      qc.invalidateQueries({ queryKey: ["eng-profiles"] });
      qc.invalidateQueries({ queryKey: ["eng-user-roles"] });
      // If created from a pending request, mark it as resolved
      if (activeRequestId) {
        await supabase.from("error_reports")
          .update({ status: "resolvido", admin_notes: "Usuário criado com sucesso." } as any)
          .eq("id", activeRequestId);
        qc.invalidateQueries({ queryKey: ["error-reports"] });
        qc.invalidateQueries({ queryKey: ["pending-error-reports-count"] });
        onRequestResolved?.();
        setActiveRequestId(null);
      }
      resetForm();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (profile: any) => {
    setEditId(profile.id);
    setEditEmployeeNumber(profile.employee_number);
    setEditFullName(profile.full_name);
    setEditRole(getRoleForUser(profile.id));
    setEditTurno((profile as any).turno || "");
    setEditEmail(profile.email || "");
    setEditCargo((profile as any).cargo || "");
    setEditEmpresa((profile as any).empresa || "mobis_brasil");
    setEditEmpresaTerceira((profile as any).empresa_terceira || "");
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editFullName || !editEmployeeNumber) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setSaving(true);
    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: editFullName,
          employee_number: editEmployeeNumber,
          turno: editTurno || null,
          email: editEmail || null,
          empresa: editEmpresa,
          empresa_terceira: editEmpresa === "empresa_terceira" ? editEmpresaTerceira : null,
          cargo: editCargo || null,
        } as any)
        .eq("id", editId);
      if (profileError) throw profileError;

      const { error: deleteError } = await supabase.from("user_roles").delete().eq("user_id", editId);
      if (deleteError) throw deleteError;

      const { error: roleError } = await supabase.from("user_roles").insert({ user_id: editId, role: editRole as any });
      if (roleError) throw roleError;

      toast.success("Perfil atualizado com sucesso!");
      qc.invalidateQueries({ queryKey: ["eng-profiles"] });
      qc.invalidateQueries({ queryKey: ["eng-user-roles"] });
      setEditOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ---- Password reset flow ----
  const [resetTarget, setResetTarget] = useState<{ id: string; full_name?: string; employee_number?: string } | null>(null);
  const [resetMode, setResetMode] = useState<"custom" | "default">("default");
  const [resetPassword, setResetPassword] = useState("");
  const [resetResult, setResetResult] = useState<{ password: string } | null>(null);
  const resetPolicy = useMemo(() => evaluatePassword(resetPassword), [resetPassword]);
  const resetPasswordValid = isPasswordValid(resetPolicy);

  const openResetFlow = (user: { id: string; full_name?: string; employee_number?: string }, mode: "custom" | "default") => {
    setResetTarget(user);
    setResetMode(mode);
    setResetPassword("");
    setResetResult(null);
    if (mode === "default") {
      runResetPassword(user, "");
    }
  };

  const runResetPassword = async (
    user: { id: string; full_name?: string; employee_number?: string },
    customPassword: string,
  ) => {
    setResettingId(user.id);
    try {
      const { data, error } = await supabase.functions.invoke("reset-user-password", {
        body: {
          user_id: user.id,
          new_password: customPassword || undefined,
        },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      const tempPassword: string = (data as any)?.temporary_password || customPassword;
      qc.invalidateQueries({ queryKey: ["eng-profiles"] });
      setResetTarget(user);
      setResetResult({ password: tempPassword });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setResettingId(null);
    }
  };


  const handleDeleteUser = async (userId: string) => {
    setDeletingId(userId);
    try {
      const { data, error } = await supabase.functions.invoke("delete-user-admin", {
        body: { user_id: userId },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success("Usuário excluído com sucesso!");
      qc.invalidateQueries({ queryKey: ["eng-profiles"] });
      qc.invalidateQueries({ queryKey: ["eng-user-roles"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    for (const id of selectedIds) {
      try {
        await supabase.functions.invoke("delete-user-admin", { body: { user_id: id } });
      } catch {}
    }
    toast.success(`${selectedIds.size} usuários excluídos`);
    qc.invalidateQueries({ queryKey: ["eng-profiles"] });
    qc.invalidateQueries({ queryKey: ["eng-user-roles"] });
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleStatus = async (id: string, status: string) => {
    const newStatus = status === "active" ? "inactive" : "active";
    await supabase.from("profiles").update({ status: newStatus }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["eng-profiles"] });
    toast.success(`Usuário ${newStatus === "active" ? "ativado" : "inativado"}`);
  };

  const resetForm = () => {
    setOpen(false);
    setEmployeeNumber("");
    setFullName("");
    setRole("user");
    setPassword("");
    setTurno("");
    setEmail("");
    setCargo("");
    setEmpresa("mobis_brasil");
    setEmpresaTerceira("");
  };

  const renderEmpresaFormFields = (emp: string, setEmp: (v: string) => void, empTerc: string, setEmpTerc: (v: string) => void) => {
    const isResidente = empTerc === "Residente" || empTerc.startsWith("Residente - ");
    const residenteSupplier = empTerc.startsWith("Residente - ") ? empTerc.replace("Residente - ", "") : "";
    return (
      <>
        <div className="space-y-2">
          <Label>Empresa *</Label>
          <Select value={emp} onValueChange={(v) => { setEmp(v); setEmpTerc(""); }}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mobis_brasil">Mobis Brasil</SelectItem>
              <SelectItem value="empresa_terceira">Empresa Terceira</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {emp === "empresa_terceira" && (
          <div className="space-y-2">
            <Label>Tipo de Terceira *</Label>
            <Select value={isResidente ? "Residente" : empTerc} onValueChange={(v) => { setEmpTerc(v); }}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {empresasTerceirasList.map((e: any) => (
                  <SelectItem key={e.name} value={e.name}>{e.name}</SelectItem>
                ))}
                {EXTRA_EMPRESA_TERCEIRA_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {emp === "empresa_terceira" && isResidente && (
          <div className="space-y-2">
            <Label>Fornecedor *</Label>
            <Select value={residenteSupplier} onValueChange={(v) => setEmpTerc(`Residente - ${v}`)}>
              <SelectTrigger><SelectValue placeholder="Selecione o fornecedor" /></SelectTrigger>
              <SelectContent>
                {suppliers.map((s: any) => (
                  <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="space-y-4 min-w-0 w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h2 className="text-base sm:text-lg font-heading font-semibold text-center sm:text-left">Usuários</h2>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-2 w-full sm:w-auto">
          {toolbarExtras}

          {selectedIds.size > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)} className="col-span-2 sm:col-span-1">
              <Trash2 className="w-4 h-4 mr-1" /> Excluir {selectedIds.size}
            </Button>
          )}
          <Dialog open={modulesOpen} onOpenChange={setModulesOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="col-span-2 sm:col-span-1"><LayoutGrid className="w-4 h-4 mr-1" /> Módulos</Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto w-[95vw]">
              <DialogHeader><DialogTitle>Permissões de Módulos</DialogTitle></DialogHeader>
              <ModulePermissionsTab />
            </DialogContent>
          </Dialog>
          <EmpresasTerceirasDialog />
          {pendingRequests.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setPendingListOpen(true)} className="gap-1 border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100 col-span-2 sm:col-span-1">
              <ClipboardList className="w-4 h-4" />
              Solicitações ({pendingRequests.length})
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="col-span-2 sm:col-span-1 border-purple-400 text-purple-700 bg-purple-50 hover:bg-purple-100"
            onClick={async () => {
              const t = toast.loading("Provisionando usuário de teste...");
              try {
                const { data, error } = await supabase.functions.invoke("create-test-user", { body: {} });
                if (error || data?.error) throw new Error(data?.error || error?.message);
                toast.success(
                  `Usuário de teste pronto • Matrícula: ${data.employee_number} • Senha: ${data.password}`,
                  { id: t, duration: 15000 },
                );
                qc.invalidateQueries({ queryKey: ["eng-profiles"] });
              } catch (e: any) {
                toast.error(`Erro: ${e.message}`, { id: t });
              }
            }}
          >
            <FlaskConical className="w-4 h-4 mr-1" /> Usuário de teste
          </Button>
          <Dialog open={open} onOpenChange={(v) => { if (!v) { resetForm(); setActiveRequestId(null); } setOpen(v); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="col-span-2 sm:col-span-1"><UserPlus className="w-4 h-4 mr-1" /> Novo Usuário</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full max-w-lg">
              <DialogHeader><DialogTitle>Criar Novo Usuário</DialogTitle></DialogHeader>
              <div className="space-y-4">
                {renderEmpresaFormFields(empresa, setEmpresa, empresaTerceira, setEmpresaTerceira)}
                <div className="space-y-2">
                  <Label>{empresa === "mobis_brasil" ? "Número do Usuário *" : "Identificação *"}</Label>
                  <div className="flex gap-2">
                    <Input value={employeeNumber} onChange={(e) => setEmployeeNumber(e.target.value)} placeholder={empresa === "mobis_brasil" ? "Ex: 3501165" : "Ex: IL0001"} />
                    {empresa === "empresa_terceira" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const next = await generateEmployeeNumber(empresa, empresaTerceira);
                          if (next) {
                            setEmployeeNumber(next);
                            toast.success(`Gerado: ${next}`);
                          }
                        }}
                        disabled={!empresaTerceira}
                      >
                        Gerar
                      </Button>
                    )}
                  </div>
                  {empresa === "empresa_terceira" && newPP && (
                    nextPreview ? (
                      <p className="text-xs text-muted-foreground">
                        Próxima matrícula disponível: <span className="font-mono font-semibold text-foreground">{nextPreview}</span>
                      </p>
                    ) : (
                      <p className="text-xs font-medium text-destructive">
                        ⚠ Sequência esgotada para o prefixo <span className="font-mono">{newPP.prefix}</span> (faixa de {newPP.pad} dígitos).
                      </p>
                    )
                  )}
                </div>


                <div className="space-y-2">
                  <Label>Nome Completo *</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nome completo" />
                </div>
                <div className="space-y-2">
                  <Label>Turno *</Label>
                  <Select value={turno} onValueChange={setTurno}>
                    <SelectTrigger><SelectValue placeholder="Selecione o turno" /></SelectTrigger>
                    <SelectContent>{TURNOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Cargo</Label>
                  <Select value={cargo} onValueChange={setCargo}>
                    <SelectTrigger><SelectValue placeholder="Selecione o cargo" /></SelectTrigger>
                    <SelectContent>{CARGOS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com (opcional)" />
                </div>
                <div className="space-y-2">
                  <Label>Senha Inicial</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Padrão: 123456" minLength={6} />
                  <p className="text-xs text-muted-foreground">Se vazio, senha padrão será 123456</p>
                </div>
                <div className="space-y-2">
                  <Label>Perfil</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Padrão</SelectItem>
                      <SelectItem value="engenharia">Engenharia</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">O usuário será obrigado a alterar a senha no primeiro acesso.</p>
                <Button onClick={handleCreate} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <UserPlus className="w-4 h-4 mr-1" />}
                  Criar Usuário
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Pending Requests Dialog */}
      <Dialog open={pendingListOpen} onOpenChange={setPendingListOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto w-[95vw] sm:w-full">
          <DialogHeader><DialogTitle>Solicitações de Novo Usuário</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground mb-3">Clique em "Finalizar Cadastro" para pré-preencher o formulário com os dados da solicitação.</p>
          <div className="space-y-2">
            {pendingRequests.map((req: any) => {
              const desc = req.description || "";
              const lines = desc.split("\n");
              const parsed: Record<string, string> = {};
              lines.forEach((l: string) => {
                const [key, ...val] = l.split(": ");
                if (key && val.length) parsed[key.trim()] = val.join(": ").trim();
              });
              return (
                <div key={req.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{req.user_name}</p>
                      <p className="text-xs text-muted-foreground">{new Date(req.created_at).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">#{req.numero || "—"}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {parsed["Nome Completo"] && <p><span className="font-medium">Nome:</span> {parsed["Nome Completo"]}</p>}
                    {parsed["Número do Usuário"] && <p><span className="font-medium">Número:</span> {parsed["Número do Usuário"]}</p>}
                    {parsed["Turno"] && <p><span className="font-medium">Turno:</span> {parsed["Turno"]}</p>}
                    {parsed["Cargo"] && <p><span className="font-medium">Cargo:</span> {parsed["Cargo"]}</p>}
                    {parsed["Empresa"] && <p><span className="font-medium">Empresa:</span> {parsed["Empresa"]}</p>}
                  </div>
                  <Button size="sm" className="w-full gap-1" onClick={() => {
                    const empresaRaw = parsed["Empresa"] || "";
                    const isMobis = empresaRaw.includes("Mobis");
                    setEmpresa(isMobis ? "mobis_brasil" : "empresa_terceira");
                    setEmpresaTerceira(!isMobis ? empresaRaw.replace("Empresa Terceira - ", "") : "");
                    setEmployeeNumber(parsed["Número do Usuário"] || "");
                    setFullName(parsed["Nome Completo"] || "");
                    setTurno(parsed["Turno"] || "");
                    setCargo(parsed["Cargo"] || "");
                    setEmail(parsed["E-mail"] || "");
                    setActiveRequestId(req.id);
                    setPendingListOpen(false);
                    setOpen(true);
                  }}>
                    <UserPlus className="w-3.5 h-3.5" /> Finalizar Cadastro
                  </Button>
                </div>
              );
            })}
            {pendingRequests.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">Nenhuma solicitação pendente.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Search — collapsible inline + floating magnifier */}
      <div className="overflow-hidden transition-all duration-300 ease-out"
        style={{
          maxHeight: searchCollapsed ? 0 : 60,
          opacity: searchCollapsed ? 0 : 1,
          transform: searchCollapsed ? "translateY(-8px)" : "translateY(0)",
        }}
      >
        <div className="relative w-full pb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchRef}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Buscar por nome, número, empresa..."
            aria-label="Buscar"
            className="pl-9 transition-all duration-300"
          />
        </div>
      </div>

      {/* Floating transparent magnifier */}
      {searchCollapsed && (
        <button
          type="button"
          aria-label="Abrir busca"
          onClick={() => {
            setSearchCollapsed(false);
            window.scrollTo({ top: 0, behavior: "smooth" });
            setTimeout(() => {
              searchRef.current?.focus();
            }, 350);
          }}
          className="fixed right-4 z-30 rounded-full border border-border/50 bg-background/60 backdrop-blur-sm shadow-sm text-muted-foreground hover:text-foreground hover:bg-background/80 transition-all duration-300 ease-out flex items-center justify-center h-10 w-10"
          style={{ top: floatingTop }}
        >
          <Search className="w-4 h-4" />
        </button>
      )}

      {/* Back to top */}
      {showBackToTop && (
        <Button
          type="button"
          size="icon"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-50 rounded-full shadow-lg h-12 w-12"
          aria-label="Voltar ao início da lista"
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      )}


      {/* Edit Profile Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full max-w-lg">
          <DialogHeader><DialogTitle>Editar Perfil</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {renderEmpresaFormFields(editEmpresa, setEditEmpresa, editEmpresaTerceira, setEditEmpresaTerceira)}
            <div className="space-y-2">
              <Label>{editEmpresa === "mobis_brasil" ? "Número do Usuário *" : "Identificação *"}</Label>
              <div className="flex gap-2">
                <Input value={editEmployeeNumber} onChange={(e) => setEditEmployeeNumber(e.target.value)} placeholder={editEmpresa === "mobis_brasil" ? "Ex: 3501165" : "Ex: IL0001"} />
                {editEmpresa === "empresa_terceira" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const next = await generateEmployeeNumber(editEmpresa, editEmpresaTerceira);
                      if (next) {
                        setEditEmployeeNumber(next);
                        toast.success(`Gerado: ${next}`);
                      }
                    }}
                    disabled={!editEmpresaTerceira}
                  >
                    Gerar
                  </Button>
                )}
              </div>
              {editEmpresa === "empresa_terceira" && editPP && (
                nextPreviewEdit ? (
                  <p className="text-xs text-muted-foreground">
                    Próxima matrícula disponível: <span className="font-mono font-semibold text-foreground">{nextPreviewEdit}</span>
                  </p>
                ) : (
                  <p className="text-xs font-medium text-destructive">
                    ⚠ Sequência esgotada para o prefixo <span className="font-mono">{editPP.prefix}</span> (faixa de {editPP.pad} dígitos).
                  </p>
                )
              )}
            </div>


            <div className="space-y-2">
              <Label>Nome Completo *</Label>
              <Input value={editFullName} onChange={(e) => setEditFullName(e.target.value)} placeholder="Nome completo" />
            </div>
            <div className="space-y-2">
              <Label>Turno</Label>
              <Select value={editTurno} onValueChange={setEditTurno}>
                <SelectTrigger><SelectValue placeholder="Selecione o turno" /></SelectTrigger>
                <SelectContent>{TURNOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Select value={editCargo} onValueChange={setEditCargo}>
                <SelectTrigger><SelectValue placeholder="Selecione o cargo" /></SelectTrigger>
                <SelectContent>{CARGOS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-2">
              <Label>Perfil</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Padrão</SelectItem>
                  <SelectItem value="engenharia">Engenharia</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSaveEdit} disabled={saving} className="w-full">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Pencil className="w-4 h-4 mr-1" />}
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk delete dialog */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedIds.size} usuários</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="block sm:hidden space-y-2">
            {filtered.map((p: any) => (
              <div key={p.id} className={`border rounded-lg p-3 flex justify-between items-start gap-2 ${p.status !== "active" ? "opacity-50" : ""}`}>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{p.full_name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{p.employee_number}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <Badge variant="outline" className={`text-[10px] ${p.empresa === "empresa_terceira" ? "border-orange-400 text-orange-600 bg-orange-500/10" : "border-blue-400 text-blue-600 bg-blue-500/10"}`}>
                      {getEmpresaLabel(p)}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground capitalize">{getRoleForUser(p.id)}</span>
                    {p.turno && <span className="text-[10px] text-muted-foreground">{p.turno}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(p)} className="h-8 w-8 p-0">
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" disabled={resettingId === p.id} className="h-8 w-8 p-0" title="Resetar senha">
                        {resettingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-56 p-2">
                      <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => openResetFlow(p, "custom")}>
                        <KeyRound className="w-4 h-4" /> Senha provisória
                      </Button>
                      <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => openResetFlow(p, "default")}>
                        <ShieldCheck className="w-4 h-4" /> Gerar senha segura
                      </Button>
                    </PopoverContent>
                  </Popover>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" disabled={deletingId === p.id}>
                        {deletingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
                        <AlertDialogDescription>Tem certeza que deseja excluir <strong>{p.full_name}</strong>?</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteUser(p.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-muted-foreground py-8 text-sm">Nenhum usuário encontrado</p>
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block w-full overflow-hidden">
            <div className="overflow-x-auto -mx-3 px-3">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filtered.length > 0 && filtered.every((p: any) => selectedIds.has(p.id))}
                      onCheckedChange={() => {
                        const allIds = filtered.map((p: any) => p.id);
                        const allSelected = allIds.every((id) => selectedIds.has(id));
                        setSelectedIds(allSelected ? new Set() : new Set(allIds));
                      }}
                    />
                  </TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">Empresa</TableHead>
                  <TableHead className="hidden md:table-cell">Turno</TableHead>
                  <TableHead className="hidden lg:table-cell">E-mail</TableHead>
                  <TableHead className="hidden md:table-cell">Cargo</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Último Login</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p: any) => (
                  <TableRow key={p.id} className={p.status !== "active" ? "opacity-50" : ""}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.employee_number}</TableCell>
                    <TableCell className="text-xs">{p.full_name}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs">
                      <Badge variant="outline" className={p.empresa === "empresa_terceira" ? "border-orange-400 text-orange-600 bg-orange-500/10" : "border-blue-400 text-blue-600 bg-blue-500/10"}>
                        {getEmpresaLabel(p)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs">{p.turno || "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs">{p.email || "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs">{p.cargo || "—"}</TableCell>
                    <TableCell className="capitalize text-xs">{getRoleForUser(p.id)}</TableCell>
                    <TableCell>
                      <Switch checked={p.status === "active"} onCheckedChange={() => toggleStatus(p.id, p.status)} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {p.last_login_at ? new Date(p.last_login_at).toLocaleString("pt-BR") : "Nunca"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(p)} title="Editar perfil" className="h-7 w-7 p-0">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" disabled={resettingId === p.id} title="Resetar senha" className="h-7 w-7 p-0">
                              {resettingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-56 p-2">
                            <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => openResetFlow(p, "custom")}>
                              <KeyRound className="w-4 h-4" /> Senha provisória
                            </Button>
                            <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => openResetFlow(p, "default")}>
                              <ShieldCheck className="w-4 h-4" /> Gerar senha segura
                            </Button>
                          </PopoverContent>
                        </Popover>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" title="Excluir" className="h-7 w-7 p-0 text-destructive hover:text-destructive" disabled={deletingId === p.id}>
                              {deletingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
                              <AlertDialogDescription>Tem certeza que deseja excluir <strong>{p.full_name}</strong>?</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteUser(p.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">Nenhum usuário encontrado</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          </div>
        </>
      )}

      {/* Custom (provisional) password dialog */}
      <Dialog
        open={resetMode === "custom" && !!resetTarget && !resetResult}
        onOpenChange={(v) => { if (!v) { setResetTarget(null); setResetPassword(""); } }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Senha provisória</DialogTitle>
            <DialogDescription>
              Defina uma senha provisória para <strong>{resetTarget?.full_name}</strong>. O usuário deverá trocá-la no próximo login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Nova senha</Label>
            <Input
              type="text"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              placeholder={`Mín. ${MIN_PASSWORD_LENGTH} chars, maiúscula, número e símbolo`}
            />
            {resetPassword && !resetPasswordValid && (
              <p className="text-xs text-destructive">
                A senha precisa ter {MIN_PASSWORD_LENGTH}+ caracteres, maiúscula, número e símbolo.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetTarget(null); setResetPassword(""); }}>Cancelar</Button>
            <Button
              disabled={!resetPasswordValid || resettingId === resetTarget?.id}
              onClick={() => resetTarget && runResetPassword(resetTarget, resetPassword.trim())}
            >
              {resettingId === resetTarget?.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <KeyRound className="w-4 h-4 mr-2" />}
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Result dialog (after either mode) */}
      <Dialog
        open={!!resetResult}
        onOpenChange={(v) => { if (!v) { setResetResult(null); setResetTarget(null); setResetPassword(""); } }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Senha redefinida</DialogTitle>
            <DialogDescription>
              Compartilhe com <strong>{resetTarget?.full_name}</strong>. Ele(a) precisará trocar a senha no próximo login.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/40 p-3 font-mono text-sm break-all flex items-center justify-between gap-2">
            <span>{resetResult?.password}</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { navigator.clipboard.writeText(resetResult?.password || ""); toast.success("Senha copiada"); }}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => resetTarget && resetResult && openWhatsApp(buildResetPasswordMessage({
                userName: resetTarget.full_name,
                employeeNumber: resetTarget.employee_number,
                password: resetResult.password,
                appUrl: window.location.origin,
              }))}
            >
              <MessageCircle className="w-4 h-4 mr-2" /> Enviar via WhatsApp
            </Button>
            <Button variant="outline" onClick={() => { setResetResult(null); setResetTarget(null); setResetPassword(""); }}>
              Concluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersTab;
