import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Pencil, Users, Clock, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { formatHoras, ContencaoRegistro } from "@/lib/contencao";
import { formatLocalDateString as fmtDate } from "@/lib/localDate";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  registro: ContencaoRegistro;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (r: ContencaoRegistro) => void;
}

const RegistroCard = ({ registro, canEdit, canDelete, onEdit }: Props) => {
  const qc = useQueryClient();
  const [thumbUrls, setThumbUrls] = useState<string[]>([]);

  useEffect(() => {
    if (!registro.fotos?.length) { setThumbUrls([]); return; }
    let active = true;
    Promise.all(
      registro.fotos.map((path) =>
        supabase.storage.from("containment-photos").createSignedUrl(path, 60 * 60).then(({ data }) => data?.signedUrl || "")
      )
    ).then((urls) => { if (active) setThumbUrls(urls.filter(Boolean)); });
    return () => { active = false; };
  }, [registro.fotos]);

  const handleDelete = async () => {
    const { error } = await supabase.from("contencao_registros" as any).delete().eq("id", registro.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Registro excluído");
    qc.invalidateQueries({ queryKey: ["contencao"] });
    qc.invalidateQueries({ queryKey: ["contencao-registros", registro.contencao_id] });
    qc.invalidateQueries({ queryKey: ["contencao-resumo-mensal"] });
  };

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
          <Badge variant="outline" className="font-mono">{registro.turno}</Badge>
          <span>{fmtDate(registro.data)}</span>
          <span className="text-muted-foreground">— {registro.hora_inicio?.slice(0, 5)} às {registro.hora_fim?.slice(0, 5)}</span>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" /> {formatHoras(registro.horas_trabalhadas)}
          </span>
          {registro.mark_check && (
            <Badge className="bg-emerald-500/15 text-emerald-600 border border-emerald-400/40">Mark Check</Badge>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {registro.fotos?.length > 0 && (
            <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
              <Camera className="w-3.5 h-3.5" /> {registro.fotos.length}
            </span>
          )}
          {canEdit && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(registro)}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          )}
          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
                  <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>Excluir</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {registro.local && (
        <p className="text-xs text-muted-foreground">📍 {registro.local}</p>
      )}

      {Array.isArray(registro.inspetores) && registro.inspetores.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <Users className="w-3 h-3 text-muted-foreground self-center" />
          {registro.inspetores.map((i: any) => (
            <Badge key={i.id} variant="secondary" className="text-[10px] py-0">{i.nome}</Badge>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div><span className="text-muted-foreground">Inspecionada:</span> <span className="font-semibold">{registro.qtd_inspecionada}</span></div>
        <div><span className="text-muted-foreground">OK:</span> <span className="font-semibold text-emerald-600">{registro.qtd_ok}</span></div>
        <div><span className="text-muted-foreground">NG:</span> <span className="font-semibold text-red-600">{registro.qtd_ng}</span></div>
      </div>

      {registro.observacoes && (
        <p className="text-xs text-muted-foreground italic">"{registro.observacoes}"</p>
      )}

      {registro.fotos?.length > 0 ? (
        <div className="flex flex-wrap gap-2 mt-1">
          {thumbUrls.length === 0 ? (
            Array.from({ length: registro.fotos.length }).map((_, i) => (
              <div key={i} className="w-20 h-20 rounded border bg-muted animate-pulse" />
            ))
          ) : (
            thumbUrls.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer" className="block">
                <img src={url} alt={`Foto ${i + 1}`} className="w-20 h-20 object-cover rounded border hover:opacity-90 transition" loading="lazy" />
              </a>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
};

export default RegistroCard;

export default RegistroCard;
