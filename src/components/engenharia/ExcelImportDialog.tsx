import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, FileSpreadsheet, Loader2, AlertTriangle, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface ColumnMapping {
  excelHeader: string;
  dbField: string;
  label: string;
  required?: boolean;
}

export interface ImportRow {
  data: Record<string, string>;
  isDuplicate: boolean;
  selected: boolean;
}

interface ExcelImportDialogProps {
  title: string;
  columns: ColumnMapping[];
  /** Check which rows are duplicates. Returns array of booleans matching rows. */
  checkDuplicates: (rows: Record<string, string>[]) => Promise<boolean[]>;
  onImport: (rows: Record<string, string>[]) => Promise<void>;
  templateFileName?: string;
}

const ExcelImportDialog = ({ title, columns, checkDuplicates, onImport, templateFileName }: ExcelImportDialogProps) => {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [error, setError] = useState("");
  const [importResult, setImportResult] = useState({ success: 0, skipped: 0 });
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setRows([]);
    setStep("upload");
    setError("");
    setImportResult({ success: 0, skipped: 0 });
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });

      if (jsonData.length === 0) {
        setError("A planilha está vazia.");
        return;
      }

      // Map Excel headers to db fields
      const excelHeaders = Object.keys(jsonData[0]);
      const mappedRows: Record<string, string>[] = jsonData.map((row) => {
        const mapped: Record<string, string> = {};
        columns.forEach((col) => {
          // Try exact match first, then case-insensitive
          const header = excelHeaders.find(
            (h) => h === col.excelHeader || h.toLowerCase().trim() === col.excelHeader.toLowerCase().trim()
          );
          mapped[col.dbField] = header ? String(row[header] ?? "").trim() : "";
        });
        return mapped;
      });

      // Validate required fields
      const requiredCols = columns.filter((c) => c.required);
      const invalidRows = mappedRows.filter((r) =>
        requiredCols.some((c) => !r[c.dbField])
      );

      if (invalidRows.length === mappedRows.length) {
        const expectedHeaders = columns.map((c) => c.excelHeader).join(", ");
        setError(`Nenhuma linha válida encontrada. Cabeçalhos esperados: ${expectedHeaders}`);
        return;
      }

      // Check duplicates
      const validRows = mappedRows.filter((r) =>
        !requiredCols.some((c) => !r[c.dbField])
      );
      const duplicates = await checkDuplicates(validRows);

      setRows(
        validRows.map((data, i) => ({
          data,
          isDuplicate: duplicates[i],
          selected: !duplicates[i], // pre-select non-duplicates
        }))
      );
      setStep("preview");
    } catch {
      setError("Erro ao ler o arquivo. Verifique o formato (.xlsx ou .xls).");
    }
  };

  const toggleRow = (idx: number) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, selected: !r.selected } : r)));
  };

  const toggleAll = (checked: boolean) => {
    setRows((prev) => prev.map((r) => ({ ...r, selected: checked })));
  };

  const handleImport = async () => {
    const selected = rows.filter((r) => r.selected).map((r) => r.data);
    if (selected.length === 0) return;

    setStep("importing");
    try {
      await onImport(selected);
      setImportResult({ success: selected.length, skipped: rows.length - selected.length });
      setStep("done");
    } catch {
      setError("Erro ao importar. Verifique os dados e tente novamente.");
      setStep("preview");
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([columns.map((c) => c.excelHeader)]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, templateFileName || `template_${title.toLowerCase()}.xlsx`);
  };

  const selectedCount = rows.filter((r) => r.selected).length;
  const duplicateCount = rows.filter((r) => r.isDuplicate).length;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); setOpen(v); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Upload className="w-4 h-4" /> Importar Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Importar {title}
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center space-y-3">
              <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Selecione um arquivo Excel (.xlsx ou .xls)
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFile}
                className="hidden"
              />
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                Escolher arquivo
              </Button>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Cabeçalhos esperados: {columns.map((c) => c.excelHeader).join(", ")}
              </p>
              <Button variant="link" size="sm" onClick={downloadTemplate} className="text-xs">
                Baixar template
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="flex-1 flex flex-col space-y-3 min-h-0">
            <div className="flex items-center gap-3 text-sm">
              <Badge variant="secondary">{rows.length} linhas</Badge>
              {duplicateCount > 0 && (
                <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {duplicateCount} duplicata{duplicateCount > 1 ? "s" : ""}
                </Badge>
              )}
              <Badge variant="default">{selectedCount} selecionada{selectedCount > 1 ? "s" : ""}</Badge>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <ScrollArea className="flex-1 border rounded-lg max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedCount === rows.length}
                        onCheckedChange={(c) => toggleAll(!!c)}
                      />
                    </TableHead>
                    <TableHead className="w-10">#</TableHead>
                    {columns.map((col) => (
                      <TableHead key={col.dbField}>{col.label}</TableHead>
                    ))}
                    <TableHead className="w-20">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow
                      key={i}
                      className={row.isDuplicate ? "bg-amber-50/50" : ""}
                    >
                      <TableCell>
                        <Checkbox
                          checked={row.selected}
                          onCheckedChange={() => toggleRow(i)}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                      {columns.map((col) => (
                        <TableCell key={col.dbField} className="text-sm">
                          {row.data[col.dbField] || "—"}
                        </TableCell>
                      ))}
                      <TableCell>
                        {row.isDuplicate ? (
                          <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">
                            Duplicata
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-emerald-600 border-emerald-300 text-xs">
                            Novo
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={reset}>Voltar</Button>
              <Button onClick={handleImport} disabled={selectedCount === 0}>
                Importar {selectedCount} item{selectedCount > 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Importando...</p>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-semibold">Importação concluída!</p>
              <p className="text-sm text-muted-foreground">
                {importResult.success} importado{importResult.success > 1 ? "s" : ""}
                {importResult.skipped > 0 && `, ${importResult.skipped} ignorado${importResult.skipped > 1 ? "s" : ""}`}
              </p>
            </div>
            <Button onClick={() => { reset(); setOpen(false); }}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ExcelImportDialog;
