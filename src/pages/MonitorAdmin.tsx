import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Trash2, Upload, ArrowLeft, Megaphone, Wrench, FileText, Pencil, Save, X, Monitor as MonitorIcon, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type Tipo = "comunicado" | "alteracao_4m" | "retrabalho";
const TIPOS_COM_SLOT: Tipo[] = ["comunicado", "retrabalho"];

interface Media {
  id: string;
  tipo: Tipo;
  titulo?: string | null;
  descricao?: string | null;
  file_path: string;
  file_name?: string | null;
  ordem: number;
  ativo: boolean;
  slot?: number | null;
  vigencia_inicio?: string | null;
  vigencia_fim?: string | null;
  created_at: string;
}

const TIPOS: { id: Tipo; label: string; icon: any; desc: string }[] = [
  { id: "comunicado",   label: "Comunicados",                   icon: Megaphone, desc: "Avisos enviados pela Mobis aos colaboradores" },
  { id: "alteracao_4m", label: "Alterações 4M/EO e Validações", icon: Wrench,    desc: "Engenharia, melhorias, novos produtos, pontos de corte" },
  { id: "retrabalho",   label: "Retrabalhos em Andamento",      icon: RefreshCw, desc: "Comunicação de retrabalhos atualmente em andamento" },
];

const isPdfName = (s?: string | null) => !!s && /\.pdf($|\?)/i.test(s);

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const vigenciaStatus = (m: { vigencia_inicio?: string | null; vigencia_fim?: string | null }, now = new Date()) => {
  const ini = m.vigencia_inicio ? new Date(m.vigencia_inicio) : null;
  const fim = m.vigencia_fim ? new Date(m.vigencia_fim) : null;
  if (ini && now < ini) return { label: "Agendado", cls: "bg-amber-500/15 text-amber-500" };
  if (fim && now > fim) return { label: "Expirado", cls: "bg-rose-500/15 text-rose-500" };
  if (ini || fim) return { label: "Em vigência", cls: "bg-sky-500/15 text-sky-500" };
  return null;
};

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
  const [slot, setSlot] = useState<number>(1);
  const [vigInicio, setVigInicio] = useState<string>("");
  const [vigFim, setVigFim] = useState<string>("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitulo, setEditTitulo] = useState("");
  const [editDescricao, setEditDescricao] = useState("");
  const [editSlot, setEditSlot] = useState<number>(1);
  const [editVigInicio, setEditVigInicio] = useState<string>("");
  const [editVigFim, setEditVigFim] = useState<string>("");

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
    if (!file) { toast.error("Selecione um arquivo"); return; }
    const ok = /^(image\/(png|jpeg|jpg)|application\/pdf)$/i.test(file.type) || isPdfName(file.name);
    if (!ok) { toast.error("Apenas JPG, PNG ou PDF"); return; }
    if (file.size > 25 * 1024 * 1024) { toast.error("Arquivo maior que 25 MB"); return; }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "bin").toLowerCase();
      const path = `${tab}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const contentType = file.type || (ext === "pdf" ? "application/pdf" : "application/octet-stream");
      const { error: upErr } = await supabase.storage.from("monitor-comunicados").upload(path, file, { contentType, upsert: false });
      if (upErr) throw upErr;
      const { data: u } = await supabase.auth.getUser();
      const { error: insErr } = await supabase.from("monitor_slides_media").insert({
        tipo: tab, titulo: titulo || null, descricao: descricao || null,
        file_path: path, file_name: file.name, ordem: items.filter(i => i.tipo === tab).length,
        ativo: true, created_by: u.user?.id ?? null,
        slot, vigencia_inicio: vigInicio ? new Date(vigInicio).toISOString() : null,
        vigencia_fim: vigFim ? new Date(vigFim).toISOString() : null,
      });
      if (insErr) throw insErr;
      toast.success("Arquivo publicado");
      setTitulo(""); setDescricao(""); setFile(null); setSlot(1); setVigInicio(""); setVigFim("");
      const input = document.getElementById("media-file") as HTMLInputElement | null;
      if (input) input.value = "";
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
    if (!confirm(`Excluir este registro?`)) return;
    await supabase.storage.from("monitor-comunicados").remove([m.file_path]);
    const { error } = await supabase.from("monitor_slides_media").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("Removido");
    load();
  };

  const startEdit = (m: Media) => {
    setEditId(m.id);
    setEditTitulo(m.titulo || "");
    setEditDescricao(m.descricao || "");
    setEditSlot(m.slot || 1);
    setEditVigInicio(m.vigencia_inicio ? toLocalInput(m.vigencia_inicio) : "");
    setEditVigFim(m.vigencia_fim ? toLocalInput(m.vigencia_fim) : "");
  };

  const saveEdit = async (id: string) => {
    const { error } = await supabase.from("monitor_slides_media")
      .update({
        titulo: editTitulo || null,
        descricao: editDescricao || null,
        slot: editSlot,
        vigencia_inicio: editVigInicio ? new Date(editVigInicio).toISOString() : null,
        vigencia_fim: editVigFim ? new Date(editVigFim).toISOString() : null,
      })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Atualizado");
    setEditId(null);
    load();
  };

  const filtered = items.filter((m) => m.tipo === tab);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" onClick={() => navigate("/monitor")} className="gap-2 order-1">
          <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Voltar ao Monitor</span><span className="sm:hidden">Voltar</span>
        </Button>
        <Button
          variant="default"
          onClick={() => window.open("/monitor", "_blank", "width=1920,height=1080,menubar=no,toolbar=no,location=no,status=no")}
          className="gap-2 order-2 sm:order-3"
        >
          <MonitorIcon className="w-4 h-4" /> Monitor
        </Button>
        <h1 className="text-xl sm:text-2xl font-bold w-full sm:w-auto order-3 sm:order-2 text-center sm:text-left">Mídia dos Slides do Monitor</h1>
      </div>

      {/* Mobile: tabs roláveis horizontalmente sem quebrar; Desktop: wrap normal */}
      <div className="-mx-4 sm:mx-0 overflow-x-auto sm:overflow-visible">
        <div className="flex gap-2 px-4 sm:px-0 sm:flex-wrap w-max sm:w-auto">
          {TIPOS.map((t) => {
            const Icon = t.icon;
            return (
              <Button
                key={t.id}
                variant={tab === t.id ? "default" : "outline"}
                onClick={() => setTab(t.id)}
                className="gap-2 shrink-0 min-h-[44px]"
              >
                <Icon className="w-4 h-4" /> {t.label}
              </Button>
            );
          })}
        </div>
      </div>


      <Card>
        <CardHeader><CardTitle className="text-base sm:text-lg break-words">Enviar novo arquivo ({TIPOS.find(t => t.id === tab)?.label})</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-1"><Label htmlFor="t">Título (opcional)</Label><Input id="t" value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
          <div className="grid gap-1"><Label htmlFor="d">Descrição (opcional)</Label><Textarea id="d" rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
          <div className="grid gap-1">
            <Label htmlFor="media-file">Arquivo (JPG, PNG ou PDF — até 25 MB)</Label>
            <Input id="media-file" type="file" accept="image/png,image/jpeg,application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-xs sm:text-sm file:mr-2" />
          </div>
          {TIPOS_COM_SLOT.includes(tab) && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-1">
                <Label>Posição no slide</Label>
                <select
                  value={slot}
                  onChange={(e) => setSlot(Number(e.target.value))}
                  className="h-11 sm:h-10 rounded-md border border-input bg-background px-3 text-base md:text-sm"
                >
                  {[1, 2, 3, 4].map((n) => <option key={n} value={n}>Posição {n}</option>)}
                </select>

              </div>
              <div className="grid gap-1">
                <Label htmlFor="vi">Início da vigência (opcional)</Label>
                <Input id="vi" type="datetime-local" value={vigInicio} onChange={(e) => setVigInicio(e.target.value)} />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="vf">Fim da vigência (opcional)</Label>
                <Input id="vf" type="datetime-local" value={vigFim} onChange={(e) => setVigFim(e.target.value)} />
              </div>
            </div>
          )}
          <Button disabled={uploading || !file} onClick={handleUpload} className="gap-2 w-full sm:w-fit">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Enviar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Publicados ({filtered.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground text-center py-10">Nada publicado.</p>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((m) => {
                const url = signedUrls[m.file_path];
                const pdf = isPdfName(m.file_name) || isPdfName(m.file_path);
                const editing = editId === m.id;
                return (
                  <li key={m.id} className={cn("rounded-lg border overflow-hidden flex flex-col", !m.ativo && "opacity-60")}>
                    <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
                      {!url
                        ? <Loader2 className="w-6 h-6 animate-spin" />
                        : pdf
                          ? <a href={url} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                              <FileText className="w-12 h-12" /> Ver PDF
                            </a>
                          : <img src={url} alt="" className="w-full h-full object-contain" />}
                    </div>
                    <div className="p-3 space-y-2 flex-1 flex flex-col">
                      {editing ? (
                        <>
                          <Input value={editTitulo} onChange={(e) => setEditTitulo(e.target.value)} placeholder="Título" />
                          <Textarea rows={2} value={editDescricao} onChange={(e) => setEditDescricao(e.target.value)} placeholder="Descrição" />
                          {TIPOS_COM_SLOT.includes(m.tipo) && (
                            <div className="grid gap-2 sm:grid-cols-3">
                              <div className="grid gap-1">
                                <Label className="text-xs">Posição</Label>
                                <select
                                  value={editSlot}
                                  onChange={(e) => setEditSlot(Number(e.target.value))}
                                  className="h-10 sm:h-9 rounded-md border border-input bg-background px-2 text-base md:text-sm"
                                >
                                  {[1, 2, 3, 4].map((n) => <option key={n} value={n}>Posição {n}</option>)}
                                </select>

                              </div>
                              <div className="grid gap-1">
                                <Label className="text-xs">Início</Label>
                                <Input type="datetime-local" value={editVigInicio} onChange={(e) => setEditVigInicio(e.target.value)} />
                              </div>
                              <div className="grid gap-1">
                                <Label className="text-xs">Fim</Label>
                                <Input type="datetime-local" value={editVigFim} onChange={(e) => setEditVigFim(e.target.value)} />
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {m.titulo && <p className="font-semibold">{m.titulo}</p>}
                          {m.descricao && <p className="text-sm text-muted-foreground line-clamp-2">{m.descricao}</p>}
                        </>
                      )}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-auto">
                        <span className={cn("px-2 py-0.5 rounded-full whitespace-nowrap", m.ativo ? "bg-emerald-500/15 text-emerald-500" : "bg-muted-foreground/15")}>{m.ativo ? "Ativo" : "Inativo"}</span>
                        {TIPOS_COM_SLOT.includes(m.tipo) && (
                          <span className="px-2 py-0.5 rounded-full whitespace-nowrap bg-primary/15 text-primary">Pos. {m.slot || 1}</span>
                        )}
                        {(() => { const s = vigenciaStatus(m); return s ? <span className={cn("px-2 py-0.5 rounded-full whitespace-nowrap", s.cls)}>{s.label}</span> : null; })()}
                        <span className="whitespace-nowrap">Publicado em {new Date(m.created_at).toLocaleString("pt-BR")}</span>
                        {m.vigencia_inicio && <span className="whitespace-nowrap">· De {new Date(m.vigencia_inicio).toLocaleString("pt-BR")}</span>}
                        {m.vigencia_fim && <span className="whitespace-nowrap">· Até {new Date(m.vigencia_fim).toLocaleString("pt-BR")}</span>}
                        {m.file_name && <span className="truncate max-w-full min-w-0">· {m.file_name}</span>}
                      </div>
                      <div className="flex flex-col xs:flex-row flex-wrap justify-between items-stretch xs:items-center gap-2 pt-2">
                        {editing ? (
                          <>
                            <Button size="sm" onClick={() => saveEdit(m.id)} className="gap-1 min-h-[44px] flex-1 xs:flex-none"><Save className="w-4 h-4" /> Salvar</Button>
                            <Button variant="outline" size="sm" onClick={() => setEditId(null)} className="gap-1 min-h-[44px] flex-1 xs:flex-none"><X className="w-4 h-4" /> Cancelar</Button>
                          </>
                        ) : (
                          <>
                            <div className="flex flex-wrap gap-2">
                              <Button variant="outline" size="sm" onClick={() => handleToggle(m)} className="min-h-[44px] flex-1 xs:flex-none">{m.ativo ? "Desativar" : "Ativar"}</Button>
                              <Button variant="outline" size="sm" onClick={() => startEdit(m)} className="gap-1 min-h-[44px] flex-1 xs:flex-none"><Pencil className="w-4 h-4" /> Editar</Button>
                            </div>
                            <Button variant="destructive" size="sm" onClick={() => handleDelete(m)} className="gap-1 min-h-[44px] w-full xs:w-auto"><Trash2 className="w-4 h-4" /> Excluir</Button>
                          </>
                        )}
                      </div>

                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
