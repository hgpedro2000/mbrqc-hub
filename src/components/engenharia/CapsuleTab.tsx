import { useState, useRef, useMemo } from "react";
import { compressImage } from "@/lib/compressImage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2, Upload, Download, Trash2, FileIcon, Search, X, FileText,
  FileSpreadsheet, Presentation, Image as ImageIcon, Package,
} from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import CapsuleNotepad from "./CapsuleNotepad";

type PreviewItem = { file: File; url: string; kind: "image" | "pdf" | "excel" | "ppt" | "other"; excelPreview?: string };

function detectKind(file: File): PreviewItem["kind"] {
  const n = file.name.toLowerCase();
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (n.endsWith(".xlsx") || n.endsWith(".xls") || n.endsWith(".csv")) return "excel";
  if (n.endsWith(".pptx") || n.endsWith(".ppt")) return "ppt";
  return "other";
}

function KindIcon({ kind, className = "w-5 h-5" }: { kind: PreviewItem["kind"]; className?: string }) {
  if (kind === "image") return <ImageIcon className={className} />;
  if (kind === "pdf") return <FileText className={`${className} text-red-500`} />;
  if (kind === "excel") return <FileSpreadsheet className={`${className} text-emerald-600`} />;
  if (kind === "ppt") return <Presentation className={`${className} text-orange-500`} />;
  return <FileIcon className={className} />;
}

const CapsuleTab = () => {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloadingBatch, setDownloadingBatch] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: files = [], isLoading } = useQuery({
    queryKey: ["capsule-files"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("capsule_files")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => files.filter((f: any) =>
    !searchTerm || f.file_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.uploaded_by_name?.toLowerCase().includes(searchTerm.toLowerCase())
  ), [files, searchTerm]);

  const allSelected = filtered.length > 0 && filtered.every((f: any) => selectedIds.has(f.id));
  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((f: any) => f.id)));
  };
  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || []);
    if (fileList.length === 0) return;

    const items: PreviewItem[] = await Promise.all(fileList.map(async (f) => {
      const kind = detectKind(f);
      const url = URL.createObjectURL(f);
      let excelPreview: string | undefined;
      if (kind === "excel") {
        try {
          const buf = await f.arrayBuffer();
          const wb = XLSX.read(buf, { type: "array" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          excelPreview = XLSX.utils.sheet_to_html(sheet);
        } catch { /* ignore */ }
      }
      return { file: f, url, kind, excelPreview };
    }));

    setPreviewItems(items);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removePreview = (idx: number) => {
    setPreviewItems((prev) => {
      URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const cancelPreview = () => {
    previewItems.forEach((p) => URL.revokeObjectURL(p.url));
    setPreviewItems([]);
  };

  const confirmUpload = async () => {
    if (previewItems.length === 0) return;
    setUploading(true);
    try {
      for (const item of previewItems) {
        const file = item.kind === "image" ? await compressImage(item.file) : item.file;
        const filePath = `${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("capsule-files")
          .upload(filePath, file);
        if (uploadError) throw uploadError;

        const { error: dbError } = await supabase.from("capsule_files").insert({
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          uploaded_by: (await supabase.auth.getUser()).data.user?.id,
          uploaded_by_name: profile?.full_name || "",
        } as any);
        if (dbError) throw dbError;
      }
      toast.success(`${previewItems.length} arquivo(s) enviado(s)`);
      qc.invalidateQueries({ queryKey: ["capsule-files"] });
      cancelPreview();
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar arquivo");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (file: any) => {
    const { data, error } = await supabase.storage
      .from("capsule-files")
      .createSignedUrl(file.file_path, 60);
    if (error || !data?.signedUrl) {
      toast.error("Não foi possível gerar link de download");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const handleBatchDownload = async () => {
    const selected = filtered.filter((f: any) => selectedIds.has(f.id));
    if (selected.length === 0) return;
    setDownloadingBatch(true);
    try {
      const zip = new JSZip();
      for (const f of selected) {
        const { data, error } = await supabase.storage.from("capsule-files").download(f.file_path);
        if (error || !data) throw error || new Error("download falhou");
        zip.file(f.file_name, data);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `capsula-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`${selected.length} arquivo(s) baixados`);
      setSelectedIds(new Set());
    } catch (err: any) {
      toast.error(err.message || "Erro ao baixar arquivos");
    } finally {
      setDownloadingBatch(false);
    }
  };

  const handleDelete = async (file: any) => {
    try {
      await supabase.storage.from("capsule-files").remove([file.file_path]);
      const { error } = await supabase.from("capsule_files").delete().eq("id", file.id);
      if (error) throw error;
      toast.success("Arquivo excluído");
      qc.invalidateQueries({ queryKey: ["capsule-files"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const selectionCount = selectedIds.size;

  return (
    <div className="space-y-4">
      <CapsuleNotepad />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h2 className="text-lg font-heading font-semibold">Cápsula de Arquivos</h2>
        <div className="flex items-center gap-2">
          {selectionCount > 0 && (
            <Button onClick={handleBatchDownload} disabled={downloadingBatch} size="sm" variant="secondary" className="gap-1">
              {downloadingBatch ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
              Baixar ({selectionCount})
            </Button>
          )}
          <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
          <Button onClick={() => fileRef.current?.click()} disabled={uploading} size="sm" className="gap-1">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Upload
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar arquivo..." className="pl-9" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="block sm:hidden space-y-2">
            {filtered.length > 0 && (
              <div className="flex items-center gap-2 px-1">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} id="sel-all-m" />
                <label htmlFor="sel-all-m" className="text-xs text-muted-foreground">Selecionar todos</label>
              </div>
            )}
            {filtered.map((f: any) => (
              <div key={f.id} className="border rounded-lg p-3 flex items-start gap-2">
                <Checkbox
                  checked={selectedIds.has(f.id)}
                  onCheckedChange={() => toggleOne(f.id)}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium truncate">{f.file_name}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                    <span>{formatSize(f.file_size || 0)}</span>
                    <span>•</span>
                    <span className="truncate">{f.uploaded_by_name}</span>
                    <span>•</span>
                    <span>{new Date(f.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(f)}>
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(f)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-muted-foreground py-8 text-sm">Nenhum arquivo encontrado</p>
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto -mx-3 px-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead className="hidden sm:table-cell">Tamanho</TableHead>
                  <TableHead className="hidden md:table-cell">Enviado por</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((f: any) => (
                  <TableRow key={f.id} data-state={selectedIds.has(f.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox checked={selectedIds.has(f.id)} onCheckedChange={() => toggleOne(f.id)} />
                    </TableCell>
                    <TableCell className="flex items-center gap-2">
                      <FileIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate max-w-[200px]">{f.file_name}</span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{formatSize(f.file_size || 0)}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{f.uploaded_by_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(f.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(f)}>
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(f)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum arquivo encontrado</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Preview dialog before upload */}
      <Dialog open={previewItems.length > 0} onOpenChange={(open) => { if (!open) cancelPreview(); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Pré-visualização ({previewItems.length} arquivo{previewItems.length > 1 ? "s" : ""})</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {previewItems.map((item, idx) => (
              <div key={idx} className="border rounded-lg overflow-hidden bg-muted/30">
                <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/50 border-b">
                  <div className="flex items-center gap-2 min-w-0">
                    <KindIcon kind={item.kind} />
                    <span className="text-sm font-medium truncate">{item.file.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{formatSize(item.file.size)}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removePreview(idx)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="p-3">
                  {item.kind === "image" && (
                    <img src={item.url} alt={item.file.name} className="max-h-[400px] mx-auto rounded" />
                  )}
                  {item.kind === "pdf" && (
                    <iframe src={item.url} title={item.file.name} className="w-full h-[500px] rounded border bg-white" />
                  )}
                  {item.kind === "excel" && item.excelPreview && (
                    <div
                      className="max-h-[400px] overflow-auto bg-white text-black text-xs rounded border p-2 [&_table]:border-collapse [&_td]:border [&_td]:border-gray-300 [&_td]:px-2 [&_td]:py-1"
                      dangerouslySetInnerHTML={{ __html: item.excelPreview }}
                    />
                  )}
                  {item.kind === "excel" && !item.excelPreview && (
                    <p className="text-sm text-muted-foreground text-center py-6">Não foi possível pré-visualizar a planilha.</p>
                  )}
                  {item.kind === "ppt" && (
                    <div className="text-center py-8 space-y-2">
                      <Presentation className="w-16 h-16 mx-auto text-orange-500" />
                      <p className="text-sm text-muted-foreground">Pré-visualização de PowerPoint não é suportada no navegador.</p>
                      <p className="text-xs text-muted-foreground">O arquivo será enviado como está.</p>
                    </div>
                  )}
                  {item.kind === "other" && (
                    <div className="text-center py-8 space-y-2">
                      <FileIcon className="w-16 h-16 mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Formato sem pré-visualização.</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={cancelPreview} disabled={uploading}>Cancelar</Button>
            <Button onClick={confirmUpload} disabled={uploading || previewItems.length === 0} className="gap-1">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Confirmar upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CapsuleTab;
