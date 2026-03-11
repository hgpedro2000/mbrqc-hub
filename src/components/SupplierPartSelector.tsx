import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";

interface PartData {
  part_name: string;
  project: string;
  line_module: string;
}

interface SupplierPartSelectorProps {
  fornecedor: string;
  partNumber: string;
  partName: string;
  projeto?: string;
  modulo?: string;
  onFornecedorChange: (value: string) => void;
  onPartNumberChange: (value: string) => void;
  onPartDataChange: (data: PartData) => void;
}

const SupplierPartSelector = ({
  fornecedor,
  partNumber,
  partName,
  projeto,
  modulo,
  onFornecedorChange,
  onPartNumberChange,
  onPartDataChange,
}: SupplierPartSelectorProps) => {
  const { t } = useTranslation();
  const [selectedProject, setSelectedProject] = useState<string>(projeto || "");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch all active part_numbers with supplier info
  const { data: allParts = [] } = useQuery({
    queryKey: ["all-parts-with-suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("part_numbers")
        .select("id, part_number, part_name, project, line_module, supplier_id, suppliers(id, name, code)")
        .eq("active", true)
        .order("part_number");
      if (error) throw error;
      return data as any[];
    },
  });

  // Distinct projects
  const projects = useMemo(() => {
    const set = new Set(allParts.map((p) => p.project).filter(Boolean));
    return [...set].sort();
  }, [allParts]);

  // Suppliers filtered by selected project
  const filteredSuppliers = useMemo(() => {
    if (!selectedProject) return [];
    const supplierMap = new Map<string, { id: string; name: string; code: string }>();
    allParts
      .filter((p) => p.project === selectedProject && p.suppliers)
      .forEach((p) => {
        const s = p.suppliers as any;
        if (s && !supplierMap.has(s.id)) {
          supplierMap.set(s.id, { id: s.id, name: s.name, code: s.code });
        }
      });
    return [...supplierMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [allParts, selectedProject]);

  // Parts filtered by project + supplier (for search popup)
  const filteredParts = useMemo(() => {
    let parts = allParts;
    if (selectedProject) parts = parts.filter((p) => p.project === selectedProject);
    if (selectedSupplierId) parts = parts.filter((p) => p.supplier_id === selectedSupplierId);
    return parts;
  }, [allParts, selectedProject, selectedSupplierId]);

  // Search results in popup
  const searchResults = useMemo(() => {
    if (!searchQuery) return filteredParts;
    const q = searchQuery.toLowerCase();
    return filteredParts.filter(
      (p) =>
        p.part_number.toLowerCase().includes(q) ||
        p.part_name.toLowerCase().includes(q)
    );
  }, [filteredParts, searchQuery]);

  // Sync external projeto prop on edit
  useEffect(() => {
    if (projeto && !selectedProject) {
      setSelectedProject(projeto);
    }
  }, [projeto]);

  // Sync supplier on edit
  useEffect(() => {
    if (fornecedor && allParts.length > 0 && !selectedSupplierId) {
      const match = allParts.find(
        (p) => (p.suppliers as any)?.name === fornecedor && p.project === selectedProject
      );
      if (match) setSelectedSupplierId((match.suppliers as any).id);
    }
  }, [fornecedor, allParts, selectedProject]);

  const handleProjectChange = (proj: string) => {
    setSelectedProject(proj);
    onPartDataChange({ part_name: "", project: proj, line_module: "" });
    // Reset supplier and part
    setSelectedSupplierId("");
    onFornecedorChange("");
    onPartNumberChange("");
  };

  const handleSupplierChange = (supplierId: string) => {
    setSelectedSupplierId(supplierId);
    const supplier = filteredSuppliers.find((s) => s.id === supplierId);
    onFornecedorChange(supplier?.name || "");
    // Reset part number
    onPartNumberChange("");
    onPartDataChange({ part_name: "", project: selectedProject, line_module: "" });
  };

  const selectPart = (part: any) => {
    onPartNumberChange(part.part_number);
    onPartDataChange({
      part_name: part.part_name,
      project: part.project,
      line_module: part.line_module,
    });
    // Also set supplier if not yet set
    if (!selectedSupplierId && part.suppliers) {
      setSelectedSupplierId((part.suppliers as any).id);
      onFornecedorChange((part.suppliers as any).name);
    }
    setSearchOpen(false);
    setSearchQuery("");
  };

  // Handle manual part number input - try to auto-match
  const handleManualPartNumber = (value: string) => {
    onPartNumberChange(value);
    const match = filteredParts.find(
      (p) => p.part_number.toLowerCase() === value.toLowerCase()
    );
    if (match) {
      onPartDataChange({
        part_name: match.part_name,
        project: match.project,
        line_module: match.line_module,
      });
    } else {
      onPartDataChange({ part_name: "", project: selectedProject, line_module: "" });
    }
  };

  // Fallback when no parts exist
  if (allParts.length === 0) {
    return (
      <>
        <div className="space-y-2">
          <Label>{t("supplierSelector.project")}</Label>
          <Input value={projeto || ""} onChange={(e) => onPartDataChange({ part_name: partName, project: e.target.value, line_module: modulo || "" })} placeholder={t("supplierSelector.project")} />
        </div>
        <div className="space-y-2">
          <Label>{t("common.supplier")}</Label>
          <Input value={fornecedor} onChange={(e) => onFornecedorChange(e.target.value)} placeholder={t("common.supplier")} />
        </div>
        <div className="space-y-2">
          <Label>Part Number</Label>
          <Input value={partNumber} onChange={(e) => onPartNumberChange(e.target.value)} placeholder="Ex: ABC-12345" />
        </div>
        <div className="space-y-2">
          <Label>Part Name</Label>
          <Input value={partName} readOnly className="bg-muted" placeholder={t("supplierSelector.autoFilled")} />
        </div>
        {modulo !== undefined && (
          <div className="space-y-2">
            <Label>{t("supplierSelector.module")}</Label>
            <Input value={modulo} readOnly className="bg-muted" placeholder={t("supplierSelector.autoFilled")} />
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {/* 1. Projeto */}
      <div className="space-y-2">
        <Label>{t("supplierSelector.project")} *</Label>
        <Select value={selectedProject} onValueChange={handleProjectChange}>
          <SelectTrigger>
            <SelectValue placeholder={t("supplierSelector.selectProject")} />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 2. Fornecedor (filtered by project) */}
      <div className="space-y-2">
        <Label>{t("common.supplier")} *</Label>
        <Select
          value={selectedSupplierId}
          onValueChange={handleSupplierChange}
          disabled={!selectedProject}
        >
          <SelectTrigger>
            <SelectValue placeholder={selectedProject ? t("supplierSelector.selectSupplier") : t("supplierSelector.selectProjectFirst")} />
          </SelectTrigger>
          <SelectContent>
            {filteredSuppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name} ({s.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 3. Part Number (manual + search) */}
      <div className="space-y-2">
        <Label>Part Number *</Label>
        <div className="flex gap-2">
          <Input
            value={partNumber}
            onChange={(e) => handleManualPartNumber(e.target.value)}
            placeholder={selectedSupplierId ? t("supplierSelector.typeOrSearch") : t("supplierSelector.selectSupplierFirst")}
            disabled={!selectedSupplierId}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={!selectedSupplierId}
            onClick={() => { setSearchOpen(true); setSearchQuery(""); }}
            title={t("supplierSelector.searchParts")}
          >
            <Search className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 4. Part Name (auto-filled) */}
      <div className="space-y-2">
        <Label>Part Name</Label>
        <Input value={partName} readOnly className="bg-muted" placeholder={t("supplierSelector.autoFilled")} />
      </div>

      {/* 5. Módulo (auto-filled) */}
      {modulo !== undefined && (
        <div className="space-y-2">
          <Label>{t("supplierSelector.module")}</Label>
          <Input value={modulo} readOnly className="bg-muted" placeholder={t("supplierSelector.autoFilled")} />
        </div>
      )}

      {/* Search popup */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t("supplierSelector.searchParts")}</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("supplierSelector.searchPlaceholder")}
              className="pl-9"
              autoFocus
            />
          </div>
          <div className="flex-1 overflow-auto border rounded-md mt-2">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Part Number</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Part Name</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">{t("supplierSelector.module")}</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                      {t("common.noResults")}
                    </td>
                  </tr>
                ) : (
                  searchResults.map((p) => (
                    <tr
                      key={p.id}
                      className="border-t hover:bg-accent/10 cursor-pointer transition-colors"
                      onDoubleClick={() => selectPart(p)}
                      onClick={() => selectPart(p)}
                    >
                      <td className="px-3 py-2 font-mono font-semibold">{p.part_number}</td>
                      <td className="px-3 py-2">{p.part_name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{p.line_module}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {t("supplierSelector.clickToSelect")}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SupplierPartSelector;
