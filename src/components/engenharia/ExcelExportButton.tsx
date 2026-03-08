import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface ExcelExportButtonProps {
  data: Record<string, any>[];
  columns: { header: string; key: string }[];
  fileName: string;
  disabled?: boolean;
}

const ExcelExportButton = ({ data, columns, fileName, disabled }: ExcelExportButtonProps) => {
  const handleExport = () => {
    const rows = data.map((item) =>
      Object.fromEntries(columns.map((col) => [col.header, item[col.key] ?? ""]))
    );
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dados");
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  return (
    <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport} disabled={disabled || data.length === 0}>
      <Download className="w-4 h-4" /> Exportar
    </Button>
  );
};

export default ExcelExportButton;
