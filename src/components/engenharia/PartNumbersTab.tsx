import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import ExcelImportDialog, { ColumnMapping } from "./ExcelImportDialog";

const PN_COLUMNS: ColumnMapping[] = [
  { excelHeader: "Fornecedor (Código)", dbField: "supplier_code", label: "Fornecedor", required: true },
  { excelHeader: "Part Number", dbField: "part_number", label: "Part Number", required: true },
  { excelHeader: "Part Name", dbField: "part_name", label: "Part Name", required: true },
  { excelHeader: "Projeto", dbField: "project", label: "Projeto" },
  { excelHeader: "Módulo de Linha", dbField: "line_module", label: "Módulo" },
];

const PartNumbersTab = () => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [partName, setPartName] = useState("");
  const [project, setProject] = useState("");
  const [lineModule, setLineModule] = useState("");

  const { data: suppliers = [] } = useQuery({
    queryKey: ["eng-suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id, code, name").eq("active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: partNumbers = [], isLoading } = useQuery({
    queryKey: ["eng-part-numbers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("part_numbers")
        .select("*, suppliers(name, code)")
        .order("part_number");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { supplier_id: supplierId, part_number: partNumber, part_name: partName, project, line_module: lineModule };
      if (editId) {
        const { error } = await supabase.from("part_numbers").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("part_numbers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eng-part-numbers"] });
      toast.success(editId ? "Part Number atualizado!" : "Part Number criado!");
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("part_numbers").update({ active: !active }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["eng-part-numbers"] });
  };

  const resetForm = () => {
    setOpen(false);
    setEditId(null);
    setSupplierId("");
    setPartNumber("");
    setPartName("");
    setProject("");
    setLineModule("");
  };

  const openEdit = (p: any) => {
    setEditId(p.id);
    setSupplierId(p.supplier_id);
    setPartNumber(p.part_number);
    setPartName(p.part_name);
    setProject(p.project);
    setLineModule(p.line_module);
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-heading font-semibold">Part Numbers</h2>
        <div className="flex gap-2">
          <ExcelImportDialog
            title="Part Numbers"
            columns={PN_COLUMNS}
            checkDuplicates={async (rows) => {
              const pns = rows.map((r) => r.part_number);
              const { data } = await supabase.from("part_numbers").select("part_number").in("part_number", pns);
              const existing = new Set((data || []).map((d) => d.part_number));
              return rows.map((r) => existing.has(r.part_number));
            }}
            onImport={async (rows) => {
              // Resolve supplier codes to IDs
              const codes = [...new Set(rows.map((r) => r.supplier_code))];
              const { data: suppData } = await supabase.from("suppliers").select("id, code").in("code", codes);
              const codeToId = new Map((suppData || []).map((s) => [s.code, s.id]));
              
              const toInsert = rows
                .filter((r) => codeToId.has(r.supplier_code))
                .map((r) => ({
                  supplier_id: codeToId.get(r.supplier_code)!,
                  part_number: r.part_number,
                  part_name: r.part_name,
                  project: r.project || "",
                  line_module: r.line_module || "",
                }));

              const skipped = rows.length - toInsert.length;
              if (toInsert.length === 0) throw new Error("Nenhum fornecedor encontrado com os códigos informados.");
              
              const { error } = await supabase.from("part_numbers").insert(toInsert);
              if (error) throw error;
              qc.invalidateQueries({ queryKey: ["eng-part-numbers"] });
              toast.success(`${toInsert.length} part number(s) importado(s)!${skipped > 0 ? ` ${skipped} ignorado(s) (fornecedor não encontrado).` : ""}`);
            }}
          />
        <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Novo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editId ? "Editar Part Number" : "Novo Part Number"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Fornecedor *</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Part Number *</Label>
                <Input value={partNumber} onChange={(e) => setPartNumber(e.target.value)} placeholder="Ex: ABC-12345" />
              </div>
              <div className="space-y-2">
                <Label>Part Name *</Label>
                <Input value={partName} onChange={(e) => setPartName(e.target.value)} placeholder="Nome da peça" />
              </div>
              <div className="space-y-2">
                <Label>Projeto</Label>
                <Input value={project} onChange={(e) => setProject(e.target.value)} placeholder="Nome do projeto" />
              </div>
              <div className="space-y-2">
                <Label>Módulo de Linha</Label>
                <Input value={lineModule} onChange={(e) => setLineModule(e.target.value)} placeholder="Módulo" />
              </div>
              <Button onClick={() => saveMutation.mutate()} disabled={!supplierId || !partNumber || !partName || saveMutation.isPending} className="w-full">
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Salvar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Part Number</TableHead>
                <TableHead>Part Name</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead>Módulo</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partNumbers.map((p: any) => (
                <TableRow key={p.id} className={!p.active ? "opacity-50" : ""}>
                  <TableCell>{p.suppliers?.name || "—"}</TableCell>
                  <TableCell className="font-mono">{p.part_number}</TableCell>
                  <TableCell>{p.part_name}</TableCell>
                  <TableCell>{p.project || "—"}</TableCell>
                  <TableCell>{p.line_module || "—"}</TableCell>
                  <TableCell>
                    <Switch checked={p.active} onCheckedChange={() => toggleActive(p.id, p.active)} />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {partNumbers.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum part number cadastrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default PartNumbersTab;
