import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

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
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");

  // Fetch active suppliers
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, code, name")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch part numbers for selected supplier
  const { data: partNumbers = [] } = useQuery({
    queryKey: ["part-numbers", selectedSupplierId],
    queryFn: async () => {
      if (!selectedSupplierId) return [];
      const { data, error } = await supabase
        .from("part_numbers")
        .select("id, part_number, part_name, project, line_module")
        .eq("supplier_id", selectedSupplierId)
        .eq("active", true)
        .order("part_number");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedSupplierId,
  });

  const handleSupplierChange = (supplierId: string) => {
    setSelectedSupplierId(supplierId);
    const supplier = suppliers.find((s) => s.id === supplierId);
    onFornecedorChange(supplier?.name || "");
    // Reset part number when supplier changes
    onPartNumberChange("");
    onPartDataChange({ part_name: "", project: "", line_module: "" });
  };

  const handlePartNumberChange = (partId: string) => {
    const part = partNumbers.find((p) => p.id === partId);
    if (part) {
      onPartNumberChange(part.part_number);
      onPartDataChange({
        part_name: part.part_name,
        project: part.project,
        line_module: part.line_module,
      });
    }
  };

  // If no suppliers exist, show plain text inputs as fallback
  if (suppliers.length === 0) {
    return (
      <>
        <div className="space-y-2">
          <Label>Fornecedor</Label>
          <Input value={fornecedor} onChange={(e) => onFornecedorChange(e.target.value)} placeholder="Nome do fornecedor" />
        </div>
        <div className="space-y-2">
          <Label>Part Number</Label>
          <Input value={partNumber} onChange={(e) => onPartNumberChange(e.target.value)} placeholder="Ex: ABC-12345" />
        </div>
        <div className="space-y-2">
          <Label>Part Name</Label>
          <Input value={partName} readOnly className="bg-muted" placeholder="Preenchido automaticamente" />
        </div>
        {projeto !== undefined && (
          <div className="space-y-2">
            <Label>Projeto</Label>
            <Input value={projeto} readOnly className="bg-muted" placeholder="Preenchido automaticamente" />
          </div>
        )}
        {modulo !== undefined && (
          <div className="space-y-2">
            <Label>Módulo</Label>
            <Input value={modulo} readOnly className="bg-muted" placeholder="Preenchido automaticamente" />
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <Label>Fornecedor *</Label>
        <Select value={selectedSupplierId} onValueChange={handleSupplierChange}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o fornecedor" />
          </SelectTrigger>
          <SelectContent>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name} ({s.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Part Number *</Label>
        <Select
          value={partNumbers.find((p) => p.part_number === partNumber)?.id || ""}
          onValueChange={handlePartNumberChange}
          disabled={!selectedSupplierId}
        >
          <SelectTrigger>
            <SelectValue placeholder={selectedSupplierId ? "Selecione o part number" : "Selecione o fornecedor primeiro"} />
          </SelectTrigger>
          <SelectContent>
            {partNumbers.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.part_number}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Part Name</Label>
        <Input value={partName} readOnly className="bg-muted" placeholder="Preenchido automaticamente" />
      </div>
      {projeto !== undefined && (
        <div className="space-y-2">
          <Label>Projeto</Label>
          <Input value={projeto} readOnly className="bg-muted" placeholder="Preenchido automaticamente" />
        </div>
      )}
      {modulo !== undefined && (
        <div className="space-y-2">
          <Label>Módulo</Label>
          <Input value={modulo} readOnly className="bg-muted" placeholder="Preenchido automaticamente" />
        </div>
      )}
    </>
  );
};

export default SupplierPartSelector;
