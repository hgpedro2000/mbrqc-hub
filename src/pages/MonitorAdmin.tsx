import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Trash2, Upload, ArrowLeft, Megaphone, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

type Tipo = "comunicado" | "alteracao_4m";

interface Media {
  id: string;
  tipo: Tipo;
  titulo?: string | null;
  descricao?: string | null;
  file_path: string;
  file_name?: string | null;
  ordem: number;
  ativo: boolean;
  created_at: string;
}

const TIPOS: { id: Tipo; label: string; icon: any; desc: string }[] = [
  { id: "comunicado",   label: "Comunicados",                   icon: Megaphone, desc: "Avisos enviados pela Mobis aos colaboradores" },
  { id: "alteracao_4m", label: "Alterações 4M/EO e Validações", icon: Wrench,    desc: "Engenharia, melhorias, novos produtos, pontos de corte" },
];

export default function MonitorAdmin() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tipo>("comunicado");
  const [items, setItems] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("monitor_slides_media")
      .select("*")
      .order("ordem", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data || []) as Media[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const updates: Record<string, string> = {};
      for (const m of items) {
        if (signedUrls[m.file_path]) continue;
        const { data } = await supabase.storage.from("monitor-comunicados").createSignedUrl(m.file_path, 60 * 60);
        if (data?.signedUrl) updates[m.file_path] = data.signedUrl;
      }
      if (!cancelled && Object.keys(updates).length) setSignedUrls((p) => ({ ...p, ...updates }));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const handleUpload = async () => {
    if (!file) { toast.error("Selecione uma imagem"); return; }
    if (!/^image\/(png|jpeg|jpg)$/i.test(file.type)) { toast.error("Apenas JPG ou PNG"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${tab}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("monitor-comunicados").upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data: u } = await supabase.auth.getUser();
      const { error: insErr } = await supabase.from("monitor_slides_media").insert({
        tipo: tab, titulo: titulo || null, descricao: descricao || null,
        file_path: path, file_name: file.name, ordem: items.filter(i => i.tipo === tab).length,
        ativo: true, created_by: u.user?.id ?? null,
      });
      if (insErr) throw insErr;
      toast.success("Imagem enviada");
      setTitulo(""); setDescricao(""); setFile(null);
      (document.getElementById("media-file") as HTMLInputElement | null)?.value && ((document.getElementById("media-file") as HTMLInputElement).value = "");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Falha ao enviar");
    } finally {
      setUploading(false);
    }
  };

  const handleToggle = async (m: Media) => {
    const { error } = await supabase.from("monitor_slides_media").update({ ativo: !m.ativo }).eq("id", m.id);
    if (error) return toast.error(error.message);
    load();
  };

  const handleDelete = async (m: Media) => {
    if (!confirm(`Excluir esta imagem?`)) return;
    await supabase.storage.from("monitor-comunicados").remove([m.file_path]);
    const { error } = await supabase.from("monitor_slides_media").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("Removida");
    load();
  };

  const filtered = items.filter((m) => m.tipo === tab);

  return (
    <div className="min-h-screen bg-background p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate("/monitor")} className="gap-2"><ArrowLeft className="w-4 h-4" /> Voltar ao Monitor</Button>
        <h1 className="text-2xl font-bold">Mídia dos Slides do Monitor</h1>
        <div />
      </div>

      <div className="flex gap-2 flex-wrap">
        {TIPOS.map((t) => {
          const Icon = t.icon;
          return (
            <Button key={t.id} variant={tab === t.id ? "default" : "outline"} onClick={() => setTab(t.id)} className="gap-2">
              <Icon className="w-4 h-4" /> {t.label}
            </Button>
          );
        })}
      </div>

      <Card>
        <CardHeader><CardTitle>Enviar nova imagem ({TIPOS.find(t => t.id === tab)?.label})</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-1"><Label htmlFor="t">Título (opcional)</Label><Input id="t" value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
          <div className="grid gap-1"><Label htmlFor="d">Descrição (opcional)</Label><Textarea id="d" rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
          <div className="grid gap-1"><Label htmlFor="media-file">Imagem (JPG/PNG)</Label><Input id="media-file" type="file" accept="image/png,image/jpeg" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
          <Button disabled={uploading || !file} onClick={handleUpload} className="gap-2 w-fit">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Enviar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Imagens publicadas ({filtered.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground text-center py-10">Nenhuma imagem.</p>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((m) => (
                <li key={m.id} className={cn("rounded-lg border overflow-hidden", !m.ativo && "opacity-50")}>
                  <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
                    {signedUrls[m.file_path] ? <img src={signedUrls[m.file_path]} alt="" className="w-full h-full object-contain" /> : <Loader2 className="w-6 h-6 animate-spin" />}
                  </div>
                  <div className="p-3 space-y-2">
                    {m.titulo && <p className="font-semibold">{m.titulo}</p>}
                    {m.descricao && <p className="text-sm text-muted-foreground line-clamp-2">{m.descricao}</p>}
                    <div className="flex justify-between items-center gap-2 pt-2">
                      <Button variant="outline" size="sm" onClick={() => handleToggle(m)}>{m.ativo ? "Desativar" : "Ativar"}</Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(m)} className="gap-1"><Trash2 className="w-4 h-4" /> Excluir</Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
