import { useQuery } from "@tanstack/react-query";
import { useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ApontamentoExportButtons } from "./ApontamentoExportButtons";
import { FileText, AlertTriangle, Camera, Package, Settings, ClipboardCheck } from "lucide-react";
import hyundaiMobisLogo from "@/assets/hyundai-mobis-logo.png";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apontamentoId: string | null;
}

const typeLabels: Record<string, string> = {
  incoming: "Incoming",
  peca: "Peça",
  processo: "Processo",
  oem: "OEM",
};

const typeBadgeClass: Record<string, string> = {
  incoming: "bg-blue-500/10 text-blue-700 border-blue-200",
  peca: "bg-amber-500/10 text-amber-700 border-amber-200",
  processo: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  oem: "bg-violet-500/10 text-violet-700 border-violet-200",
};

function fmt(key: string, value: any): string {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "data") return new Date(value).toLocaleDateString("pt-BR");
  return String(value);
}

const SectionHeader = ({ icon: Icon, title }: { icon: any; title: string }) => (
  <div className="flex items-center gap-2 mb-3">
    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
      <Icon className="w-4 h-4 text-primary" />
    </div>
    <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">{title}</h4>
  </div>
);

const DataField = ({ label, value }: { label: string; value: string }) => (
  <div className="space-y-0.5">
    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</p>
    <p className="text-sm font-medium text-foreground">{value}</p>
  </div>
);

const ApontamentoViewDialog = ({ open, onOpenChange, apontamentoId }: Props) => {
  const contentRef = useRef<HTMLDivElement>(null);

  const { data: item, isLoading } = useQuery({
    queryKey: ["apontamento-view", apontamentoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("apontamentos")
        .select("*")
        .eq("id", apontamentoId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!apontamentoId && open,
  });

  const { data: photos = [] } = useQuery({
    queryKey: ["apontamento-photos", apontamentoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_photos")
        .select("*")
        .eq("checklist_id", apontamentoId!);
      if (error) throw error;
      return data;
    },
    enabled: !!apontamentoId && open,
  });

  const d = item as any;
  const tipo = d?.tipo || "incoming";
  const segundoDefeitos = useMemo(() => {
    if (!d?.segundo_defeitos) return [];
    try {
      return Array.isArray(d.segundo_defeitos) ? d.segundo_defeitos : JSON.parse(d.segundo_defeitos);
    } catch { return []; }
  }, [d?.segundo_defeitos]);

  const identificationFields = [
    { key: "numero", label: "Número" },
    { key: "data", label: "Data" },
    { key: "responsavel", label: "Apontado por" },
    { key: "turno", label: "Turno" },
    { key: "projeto", label: "Projeto" },
    { key: "fornecedor", label: "Fornecedor" },
    { key: "part_number", label: "Part Number" },
    { key: "part_name", label: "Part Name" },
  ];

  const renderIncoming = () => (
    <>
      <div data-pdf-section>
        <SectionHeader icon={FileText} title="Identificação" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 bg-card rounded-lg border border-border p-4">
          {identificationFields.map(f => <DataField key={f.key} label={f.label} value={fmt(f.key, d?.[f.key])} />)}
        </div>
      </div>
      <div data-pdf-section>
        <SectionHeader icon={Package} title="Dados da Inspeção" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 bg-card rounded-lg border border-border p-4">
          <DataField label="Fase" value={fmt("fase", d?.fase)} />
          <DataField label="Qtd. Inspecionada" value={fmt("", d?.quantidade_inspecionada)} />
          <DataField label="Qtd. NG" value={fmt("", d?.quantidade_ng)} />
          <DataField label="Qtd. OK" value={fmt("", d?.quantidade_ok)} />
          <DataField label="Lote Inspecionado" value={fmt("", d?.lote_inspecionado)} />
          <DataField label="Modo de Falha" value={fmt("", d?.modo_falha)} />
        </div>
      </div>
      <div data-pdf-section>
        <SectionHeader icon={ClipboardCheck} title="Detalhes" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 bg-card rounded-lg border border-border p-4">
          <DataField label="Descrição" value={fmt("", d?.descricao)} />
          <DataField label="Severidade" value={fmt("", d?.severidade)} />
          <DataField label="Responsabilidade" value={fmt("", d?.responsabilidade_defeito)} />
          <DataField label="Comentário Adicional" value={fmt("", d?.comentario_adicional)} />
        </div>
      </div>
    </>
  );

  const renderPeca = () => (
    <>
      <div data-pdf-section>
        <SectionHeader icon={FileText} title="Identificação" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 bg-card rounded-lg border border-border p-4">
          {identificationFields.map(f => <DataField key={f.key} label={f.label} value={fmt(f.key, d?.[f.key])} />)}
        </div>
      </div>
      <div data-pdf-section>
        <SectionHeader icon={Package} title="Dados do Defeito" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 bg-card rounded-lg border border-border p-4">
          <DataField label="Fase" value={fmt("", d?.fase)} />
          <DataField label="Qtd. Inspecionada" value={fmt("", d?.quantidade_inspecionada)} />
          <DataField label="Qtd. NG" value={fmt("", d?.quantidade_ng)} />
          <DataField label="Qtd. OK" value={fmt("", d?.quantidade_ok)} />
          <DataField label="Modo de Falha" value={fmt("", d?.modo_falha)} />
          <DataField label="Parada de Linha" value={d?.parada_linha === "sim" ? "Sim" : "Não"} />
          {d?.parada_linha === "sim" && <DataField label="Tempo de Parada" value={fmt("", d?.parada_linha_tempo)} />}
        </div>
      </div>
      <div data-pdf-section>
        <SectionHeader icon={ClipboardCheck} title="Detalhes" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 bg-card rounded-lg border border-border p-4">
          <DataField label="Descrição" value={fmt("", d?.descricao)} />
          <DataField label="Severidade" value={fmt("", d?.severidade)} />
          <DataField label="Responsabilidade" value={fmt("", d?.responsabilidade_defeito)} />
          <DataField label="Comentário Adicional" value={fmt("", d?.comentario_adicional)} />
        </div>
      </div>
    </>
  );

  const renderProcesso = () => (
    <>
      <div data-pdf-section>
        <SectionHeader icon={FileText} title="Identificação" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 bg-card rounded-lg border border-border p-4">
          {identificationFields.map(f => <DataField key={f.key} label={f.label} value={fmt(f.key, d?.[f.key])} />)}
          <DataField label="Linha" value={fmt("", d?.linha)} />
          <DataField label="Setor" value={fmt("", d?.setor)} />
        </div>
      </div>
      <div data-pdf-section>
        <SectionHeader icon={Package} title="Dados do Defeito" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 bg-card rounded-lg border border-border p-4">
          <DataField label="Fase" value={fmt("", d?.fase)} />
          <DataField label="Qtd. Inspecionada" value={fmt("", d?.quantidade_inspecionada)} />
          <DataField label="Qtd. NG" value={fmt("", d?.quantidade_ng)} />
          <DataField label="Qtd. OK" value={fmt("", d?.quantidade_ok)} />
          <DataField label="Modo de Falha" value={fmt("", d?.modo_falha)} />
          <DataField label="Parada de Linha" value={d?.parada_linha === "sim" ? "Sim" : "Não"} />
          {d?.parada_linha === "sim" && <DataField label="Tempo de Parada" value={fmt("", d?.parada_linha_tempo)} />}
        </div>
      </div>
      <div data-pdf-section>
        <SectionHeader icon={ClipboardCheck} title="Detalhes" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 bg-card rounded-lg border border-border p-4">
          <DataField label="Descrição" value={fmt("", d?.descricao)} />
          <DataField label="Severidade" value={fmt("", d?.severidade)} />
          <DataField label="Responsabilidade" value={fmt("", d?.responsabilidade_defeito)} />
          <DataField label="Comentário Adicional" value={fmt("", d?.comentario_adicional)} />
        </div>
      </div>
    </>
  );

  const renderOem = () => (
    <>
      <div data-pdf-section>
        <SectionHeader icon={FileText} title="Identificação" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 bg-card rounded-lg border border-border p-4">
          {identificationFields.map(f => <DataField key={f.key} label={f.label} value={fmt(f.key, d?.[f.key])} />)}
        </div>
      </div>
      <div data-pdf-section>
        <SectionHeader icon={Package} title="Dados OEM" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 bg-card rounded-lg border border-border p-4">
          <DataField label="VIN" value={fmt("", d?.vin_number)} />
          <DataField label="Qtd. Detectado" value={fmt("", d?.quantidade_detectado)} />
          <DataField label="Local de Detecção" value={fmt("", d?.local_deteccao)} />
          <DataField label="Lançamento" value={fmt("", d?.lancamento)} />
        </div>
      </div>
      <div data-pdf-section>
        <SectionHeader icon={ClipboardCheck} title="Análise e Ação" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 bg-card rounded-lg border border-border p-4">
          <DataField label="Descrição" value={fmt("", d?.descricao)} />
          <DataField label="Análise Inicial" value={fmt("", d?.analise_inicial)} />
          <DataField label="Ação Imediata" value={fmt("", d?.acao_imediata)} />
          <DataField label="Comentário Adicional" value={fmt("", d?.comentario_adicional)} />
        </div>
      </div>
    </>
  );

  const renderByType = () => {
    switch (tipo) {
      case "incoming": return renderIncoming();
      case "peca": return renderPeca();
      case "processo": return renderProcesso();
      case "oem": return renderOem();
      default: return renderIncoming();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 w-[95vw] md:w-full [&>button:last-child]:hidden">
        <DialogClose className="absolute left-3 top-3 z-50 rounded-full bg-background/80 backdrop-blur-sm border border-border w-8 h-8 flex items-center justify-center opacity-80 hover:opacity-100 transition-opacity shadow-sm">
          <X className="h-4 w-4" />
          <span className="sr-only">Fechar</span>
        </DialogClose>
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : d ? (
          <div className="flex flex-col" ref={contentRef}>
            {/* Header */}
            <div data-pdf-section className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-b border-border px-4 md:px-6 pt-4 md:pt-6 pb-3 md:pb-4">
              <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                <div className="flex items-center gap-3 md:gap-4">
                  <img src={hyundaiMobisLogo} alt="Hyundai Mobis" className="h-10 md:h-16 w-auto object-contain" />
                  <div className="space-y-1 md:space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`${typeBadgeClass[tipo] || typeBadgeClass.incoming} h-[29px] px-4 py-0 inline-flex items-center justify-center leading-none font-semibold text-[11px] shrink-0`}>
                        {typeLabels[tipo] || tipo}
                      </Badge>
                      {d.numero && (
                        <span className="inline-flex h-[29px] px-3 items-center justify-center font-mono text-sm font-bold text-primary leading-none shrink-0 bg-green-50 rounded-full border border-green-200">#{d.numero}</span>
                      )}
                      <Badge variant="outline" className={`h-[29px] px-4 py-0 inline-flex items-center justify-center leading-none text-[11px] shrink-0 ${d.status === "draft" ? "bg-yellow-100 border-yellow-300 text-yellow-800" : "bg-emerald-100 border-emerald-300 text-emerald-800"}`}>
                        {d.status === "draft" ? "Rascunho" : "Finalizado"}
                      </Badge>
                    </div>
                    <h2 className="text-sm md:text-lg font-bold text-foreground">
                      Relatório de Apontamento — {typeLabels[tipo] || tipo}
                    </h2>
                    <p className="text-[10px] md:text-xs text-muted-foreground">
                      {d.responsavel} • {fmt("data", d.data)}
                      {d.fornecedor ? ` • ${d.fornecedor}` : ""}
                    </p>
                  </div>
                </div>
                <ApontamentoExportButtons data={d} photos={photos} contentRef={contentRef} />
              </div>
            </div>

            {/* Content */}
            <div className="px-4 md:px-6 py-4 md:py-5 space-y-5 md:space-y-6">
              {/* NG KPI Banner */}
              {(tipo === "incoming" || tipo === "peca" || tipo === "processo") && (d.quantidade_inspecionada > 0 || d.quantidade_ng > 0) && (
                <div data-pdf-section className="rounded-xl border border-border bg-gradient-to-r from-card to-muted/30 p-3 md:p-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-lg md:text-xl font-bold text-foreground">{d.quantidade_inspecionada || 0}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">Inspecionada</p>
                    </div>
                    <div>
                      <p className="text-lg md:text-xl font-bold text-emerald-600">{d.quantidade_ok || 0}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">OK</p>
                    </div>
                    <div>
                      <p className="text-lg md:text-xl font-bold text-destructive">{d.quantidade_ng || 0}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">NG</p>
                    </div>
                  </div>
                </div>
              )}

              {renderByType()}

              {/* Second defects */}
              {segundoDefeitos.length > 0 && (
                <div data-pdf-section>
                  <SectionHeader icon={AlertTriangle} title={`Segundo Defeito (${segundoDefeitos.length})`} />
                  <div className="space-y-2">
                    {segundoDefeitos.map((def: any, idx: number) => (
                      <div key={idx} className="border border-border rounded-lg p-3 bg-card">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10 text-destructive text-[10px] font-bold">{idx + 1}</span>
                          <span className="text-sm font-semibold">{def.part_number}</span>
                          <span className="text-xs text-muted-foreground">{def.part_name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground pl-8">Qtd: {def.qty}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Photos */}
              {photos.length > 0 && (
                <div data-pdf-section>
                  <SectionHeader icon={Camera} title={`Fotos (${photos.length})`} />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {photos.map((photo) => {
                      const { data: urlData } = supabase.storage.from("checklist-photos").getPublicUrl(photo.file_path);
                      return (
                        <div key={photo.id} className="rounded-lg border border-border overflow-hidden bg-muted aspect-video">
                          <img src={urlData.publicUrl} alt={photo.file_name} className="w-full h-full object-cover" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div data-pdf-section className="border-t border-border px-6 py-3 bg-muted/30 text-center">
              <p className="text-[10px] text-muted-foreground">
                Hyundai Mobis — Apontamento Control • Gerado em {new Date().toLocaleDateString("pt-BR")}
              </p>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default ApontamentoViewDialog;
