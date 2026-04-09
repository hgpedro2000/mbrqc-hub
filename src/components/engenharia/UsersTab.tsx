import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UserPlus, Loader2, Pencil, KeyRound, Trash2, LayoutGrid, Search } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import ModulePermissionsTab from "./ModulePermissionsTab";

const TURNOS = ["1T", "2T", "3T"];
const EMPRESA_TERCEIRA_OPTIONS = ["IL AUTOMOTIVE", "TRIGO INSPEÇÕES", "Residente"];

const UsersTab = () => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [modulesOpen, setModulesOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("user");
  const [password, setPassword] = useState("");
  const [turno, setTurno] = useState("");
  const [email, setEmail] = useState("");
  const [empresa, setEmpresa] = useState("mobis_brasil");
  const [empresaTerceira, setEmpresaTerceira] = useState("");
  const [saving, setSaving] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Edit state
  const [editId, setEditId] = useState("");
  const [editEmployeeNumber, setEditEmployeeNumber] = useState("");
  const [editFullName, setEditFullName] = useState("");
  const [editRole, setEditRole] = useState("user");
  const [editTurno, setEditTurno] = useState("");
  const [editEmail, setEditEmail] = useState("");
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
      const { data, error } = await supabase.from("suppliers").select("name").eq("active", true).order("name");
      if (error) throw error;
      return data;
    },
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
    if (!employeeNumber || !fullName || !password || !turno) {
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
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success("Usuário criado com sucesso!");
      qc.invalidateQueries({ queryKey: ["eng-profiles"] });
      qc.invalidateQueries({ queryKey: ["eng-user-roles"] });
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

  const handleResetPassword = async (userId: string) => {
    setResettingId(userId);
    try {
      const { data, error } = await supabase.functions.invoke("reset-user-password", {
        body: { user_id: userId },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success("Senha resetada para 'admin123'. O usuário será obrigado a redefinir no próximo login.");
      qc.invalidateQueries({ queryKey: ["eng-profiles"] });
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
                {EMPRESA_TERCEIRA_OPTIONS.map((o) => (
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
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h2 className="text-lg font-heading font-semibold">Usuários</h2>
        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.size > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
              <Trash2 className="w-4 h-4 mr-1" /> Excluir {selectedIds.size}
            </Button>
          )}
          <Dialog open={modulesOpen} onOpenChange={setModulesOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><LayoutGrid className="w-4 h-4 mr-1" /> Módulos</Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto w-[95vw]">
              <DialogHeader><DialogTitle>Permissões de Módulos</DialogTitle></DialogHeader>
              <ModulePermissionsTab />
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
            <DialogTrigger asChild>
              <Button size="sm"><UserPlus className="w-4 h-4 mr-1" /> Novo Usuário</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Criar Novo Usuário</DialogTitle></DialogHeader>
              <div className="space-y-4">
                {renderEmpresaFormFields(empresa, setEmpresa, empresaTerceira, setEmpresaTerceira)}
                <div className="space-y-2">
                  <Label>{empresa === "mobis_brasil" ? "Número do Usuário *" : "Identificação *"}</Label>
                  <Input value={employeeNumber} onChange={(e) => setEmployeeNumber(e.target.value)} placeholder={empresa === "mobis_brasil" ? "Ex: 3501165" : "Ex: IL001"} />
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
                  <Label>E-mail</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com (opcional)" />
                </div>
                <div className="space-y-2">
                  <Label>Senha Inicial *</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" minLength={6} />
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar por nome, número, empresa..." className="pl-9" />
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Perfil</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {renderEmpresaFormFields(editEmpresa, setEditEmpresa, editEmpresaTerceira, setEditEmpresaTerceira)}
            <div className="space-y-2">
              <Label>{editEmpresa === "mobis_brasil" ? "Número do Usuário *" : "Identificação *"}</Label>
              <Input value={editEmployeeNumber} onChange={(e) => setEditEmployeeNumber(e.target.value)} placeholder={editEmpresa === "mobis_brasil" ? "Ex: 3501165" : "Ex: IL001"} />
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
        <div className="overflow-x-auto -mx-3 px-3">
          <Table>
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
                <TableHead>Perfil</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
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
                  <TableCell className="font-mono text-xs sm:text-sm">{p.employee_number}</TableCell>
                  <TableCell className="text-xs sm:text-sm">{p.full_name}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs sm:text-sm">
                    <Badge variant="outline" className={p.empresa === "empresa_terceira" ? "border-orange-400 text-orange-600 bg-orange-500/10" : "border-blue-400 text-blue-600 bg-blue-500/10"}>
                      {getEmpresaLabel(p)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs sm:text-sm">{p.turno || "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell text-xs sm:text-sm">{p.email || "—"}</TableCell>
                  <TableCell className="capitalize text-xs sm:text-sm">{getRoleForUser(p.id)}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Switch checked={p.status === "active"} onCheckedChange={() => toggleStatus(p.id, p.status)} />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                    {p.last_login_at ? new Date(p.last_login_at).toLocaleString("pt-BR") : "Nunca"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(p)} title="Editar perfil" className="h-8 w-8 p-0">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleResetPassword(p.id)} disabled={resettingId === p.id} title="Resetar senha" className="h-8 w-8 p-0">
                        {resettingId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" title="Excluir" className="h-8 w-8 p-0 text-destructive hover:text-destructive" disabled={deletingId === p.id}>
                            {deletingId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
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
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Nenhum usuário encontrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default UsersTab;
