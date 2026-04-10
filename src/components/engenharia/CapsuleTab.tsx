import { useState, useRef } from "react";
import { compressImage } from "@/lib/compressImage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Upload, Download, Trash2, FileIcon, Search } from "lucide-react";
import { toast } from "sonner";

const CapsuleTab = () => {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
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

  const filtered = files.filter((f: any) =>
    !searchTerm || f.file_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.uploaded_by_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || []);
    if (fileList.length === 0) return;
    setUploading(true);
    try {
      for (const rawFile of fileList) {
        const file = rawFile.type.startsWith("image/") ? await compressImage(rawFile) : rawFile;
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
      toast.success(`${fileList.length} arquivo(s) enviado(s)`);
      qc.invalidateQueries({ queryKey: ["capsule-files"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar arquivo");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDownload = async (file: any) => {
    const { data } = supabase.storage.from("capsule-files").getPublicUrl(file.file_path);
    window.open(data.publicUrl, "_blank");
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h2 className="text-lg font-heading font-semibold">Cápsula de Arquivos</h2>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" multiple className="hidden" onChange={handleUpload} />
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
        <div className="overflow-x-auto -mx-3 px-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Arquivo</TableHead>
                <TableHead className="hidden sm:table-cell">Tamanho</TableHead>
                <TableHead className="hidden md:table-cell">Enviado por</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((f: any) => (
                <TableRow key={f.id}>
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
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum arquivo encontrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default CapsuleTab;
