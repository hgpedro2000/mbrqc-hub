import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Clock, Calendar, Loader2 } from "lucide-react";
import ContencaoStatusStepper from "./ContencaoStatusStepper";
import ContencaoRegistroDialog from "./ContencaoRegistroDialog";
import RegistroCard from "./RegistroCard";
import { computeDiasAndamento, formatHoras, normalizeStatus, ContencaoRegistro } from "@/lib/contencao";
import { useUserRole } from "@/hooks/useUserRole";

interface Props {
  contencao: any | null;
  onClose: () => void;
}

const ContencaoDetalheDrawer = ({ contencao, onClose }: Props) => {
  const qc = useQueryClient();
  const { isAdmin } = useUserRole();
  const open = !!contencao;
  const [editing, setEditing] = useState<ContencaoRegistro | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ["contencao-registros", contencao?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contencao_registros" as any)
        .select("*")
        .eq("contencao_id", contencao!.id)
        .order("data", { ascending: false })
        .order("hora_inicio", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ContencaoRegistro[];
    },
    enabled: open,
  });

  const status = normalizeStatus(contencao?.status);
  const dias = (contencao as any)?.dias_andamento ?? computeDiasAndamento(contencao?.created_at, contencao?.data_conclusao, status);

  const totais = useMemo(() => {
    const t = registros.reduce(
      (acc, r) => ({
        insp: acc.insp + (r.qtd_inspecionada || 0),
        ok: acc.ok + (r.qtd_ok || 0),
        ng: acc.ng + (r.qtd_ng || 0),
        horas: acc.horas + Number(r.horas_trabalhadas || 0),
      }),
      { insp: 0, ok: 0, ng: 0, horas: 0 },
    );
    return t;
  }, [registros]);

  const grouped = useMemo(() => {
    const map = new Map<string, ContencaoRegistro[]>();
    for (const r of registros) {
      const key = r.data;
      const arr = map.get(key) || [];
      arr.push(r);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [registros]);

  const concluida = status === "concluida";
  const canEditRegistros = isAdmin && !concluida;
  const canDeleteRegistros = isAdmin;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <div className="p-4 sm:p-6 space-y-4">
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2 flex-wrap">
              {contencao?.numero && <span className="text-xs font-mono text-muted-foreground bg-muted/30 px-2 py-0.5 rounded">#{contencao.numero}</span>}
              <span className="truncate">{contencao?.titulo}</span>
            </SheetTitle>
            <SheetDescription className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {contencao?.responsavel && <span>Responsável: {contencao.responsavel}</span>}
              {contencao?.local && <span>📍 {contencao.local}</span>}
              {contencao?.part_number && <span>PN: {contencao.part_number}</span>}
            </SheetDescription>
          </SheetHeader>

          <ContencaoStatusStepper status={status} />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Stat icon={Calendar} label="Dias" value={concluida ? `Concluída em ${dias}d` : `${dias} dias`} />
            <Stat icon={Clock} label="Horas totais" value={formatHoras(contencao?.total_horas ?? totais.horas)} />
            <Stat label="Inspecionado" value={String(totais.insp)} />
            <Stat label="OK / NG" value={`${totais.ok} / ${totais.ng}`} colored />
          </div>

          <div className="flex items-center justify-between">
            <h3 className="font-heading font-semibold text-sm">Registros de Contenção</h3>
            {!concluida && (
              <Button size="sm" className="gap-1" onClick={() => { setEditing(null); setDialogOpen(true); }}>
                <Plus className="w-4 h-4" /> Novo Registro
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : registros.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8 border border-dashed rounded-md">
              Nenhum registro ainda.
            </div>
          ) : (
            <div className="space-y-4">
              {grouped.map(([data, arr]) => (
                <div key={data} className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
                  </p>
                  {arr.map((r) => (
                    <RegistroCard
                      key={r.id}
                      registro={r}
                      canEdit={canEditRegistros}
                      canDelete={canDeleteRegistros}
                      onEdit={(reg) => { setEditing(reg); setDialogOpen(true); }}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {contencao && (
          <ContencaoRegistroDialog
            open={dialogOpen}
            onClose={() => { setDialogOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["contencao-registros", contencao.id] }); qc.invalidateQueries({ queryKey: ["contencao"] }); }}
            contencaoId={contencao.id}
            defaultLocal={contencao.local}
            initial={editing}
            contencaoConcluida={concluida}
          />
        )}
      </SheetContent>
    </Sheet>
  );
};

const Stat = ({ icon: Icon, label, value, colored }: any) => (
  <div className="rounded-md border bg-card p-2">
    <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
      {Icon && <Icon className="w-3 h-3" />} {label}
    </div>
    <p className={`text-sm font-semibold mt-0.5 ${colored ? "" : ""}`}>{value}</p>
  </div>
);

export default ContencaoDetalheDrawer;
