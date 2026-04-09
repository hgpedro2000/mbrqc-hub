import { useQuery } from "@tanstack/react-query";
import { useRef, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ApontamentoExportButtons } from "./ApontamentoExportButtons";
import { FileText, AlertTriangle, Camera, Package, ClipboardCheck, Clock } from "lucide-react";
import hyundaiMobisLogo from "@/assets/hyundai-mobis-logo.png";
import { stripCode } from "@/lib/stripCode";

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

const DataField = ({ label, value, fullWidth }: { label: string; value: string; fullWidth?: boolean }) => (
  <div className={`space-y-0.5 ${fullWidth ? "col-span-full" : ""}`}>
    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</p>
    <p className="text-sm font-medium text-foreground whitespace-pre-wrap break-words">{value}</p>
  </div>
);

const ApontamentoViewDialog = ({ open, onOpenChange, apontamentoId }: Props) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

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

  // Fetch creator's profile for empresa info
  const { data: creatorProfile } = useQuery({
    queryKey: ["apontamento-creator-profile", item?.created_by],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("empresa, empresa_terceira")
        .eq("id", item!.created_by!)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!item?.created_by && open,
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

  // Fetch part_number origem
  const { data: partOrigemData } = useQuery({
    queryKey: ["apontamento-part-origem", item?.part_number],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("part_numbers")
        .select("origem")
        .eq("part_number", item!.part_number!)
        .eq("active", true)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!item?.part_number && open,
  });

  const origemLabel = partOrigemData?.origem || "LP";

  const d = item as any;
  const tipo = d?.tipo || "incoming";

  const segundoDefeitos = useMemo(() => {
    if (!d?.segundo_defeitos) return [];
    try {
      return Array.isArray(d.segundo_defeitos) ? d.segundo_defeitos : JSON.parse(d.segundo_defeitos);
    } catch { return []; }
  }, [d?.segundo_defeitos]);

  const coInspetores = useMemo(() => {
    if (!d?.co_inspetores) return [];
    try {
      return Array.isArray(d.co_inspetores) ? d.co_inspetores : JSON.parse(d.co_inspetores);
    } catch { return []; }
  }, [d?.co_inspetores]);

  const tempoDisplay = useMemo(() => {
    if (!d?.tempo_inspecao) return null;
    return d.tempo_inspecao;
  }, [d?.tempo_inspecao]);

  const empresaLabel = useMemo(() => {
    if (!creatorProfile) return null;
    if (creatorProfile.empresa === "empresa_terceira") {
      return creatorProfile.empresa_terceira || "Empresa Terceira";
    }
    return "Mobis Brasil";
  }, [creatorProfile]);

  const identificationFields = [
    { key: "numero", label: "Número" },
    { key: "data", label: "Data" },
    { key: "responsavel", label: "Apontado por" },
    { key: "turno", label: "Turno" },
    ...(empresaLabel ? [{ key: "_empresa", label: "Empresa" }] : []),
    { key: "_origem", label: "Origem" },
    { key: "projeto", label: "Projeto" },
    { key: "fornecedor", label: "Fornecedor" },
    { key: "part_number", label: "Part Number" },
    { key: "part_name", label: "Part Name" },
  ];

  const renderInspectionSection = () => {
    if (!tempoDisplay && coInspetores.length === 0) return null;
    return (
      <div data-pdf-section>
        <SectionHeader icon={Clock} title="Inspeção" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 bg-card rounded-lg border border-border p-4">
          {tempoDisplay && <DataField label="Tempo de Inspeção" value={tempoDisplay} />}
          {coInspetores.length > 0 && (
            <div className="space-y-0.5 col-span-full">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Co-Inspetores</p>
              <div className="flex flex-wrap gap-1.5">
                {coInspetores.map((name: string, idx: number) => (
                  <Badge key={idx} variant="secondary" className="text-xs">{name}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const getFieldValue = (f: { key: string; label: string }) => {
    if (f.key === "_empresa") return empresaLabel || "—";
    return fmt(f.key, d?.[f.key]);
  };

  // Check if has multiple failure mode details
  const hasMultipleFailureModes = segundoDefeitos.length > 0 && segundoDefeitos[0]?.modo_falha;
  const hasNg = (d?.quantidade_ng || 0) > 0;

  const renderDetailsSection = () => {
    return (
      <div data-pdf-section>
        <SectionHeader icon={ClipboardCheck} title="Detalhes" />
        <div className="bg-card rounded-lg border border-border p-4 space-y-4">
          {/* If NG > 0 and has multiple failure modes, show ONLY the individual detail */}
          {hasNg && hasMultipleFailureModes ? (
            <div className="space-y-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Detalhamento por Modo de Falha</p>
              {segundoDefeitos.map((def: any, idx: number) => (
                <div key={idx} className="border border-border rounded-lg p-3 bg-muted/20 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10 text-destructive text-[10px] font-bold">{idx + 1}</span>
                    <span className="text-sm font-semibold">{stripCode(def.modo_falha) || "—"}</span>
                    <Badge variant="outline" className="text-xs ml-auto">Qty: {def.qty || 0}</Badge>
                  </div>
                  {def.descricao && <p className="text-xs text-muted-foreground pl-8">{def.descricao}</p>}
                </div>
              ))}
            </div>
          ) : (
            /* Normal single defect info - NO Severidade/Responsabilidade */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              {d?.modo_falha && <DataField label="Modo de Falha" value={stripCode(d.modo_falha)} />}
              <DataField label="Descrição" value={fmt("", d?.descricao)} fullWidth={!d?.modo_falha} />
              {d?.comentario_adicional && <DataField label="Comentário Adicional" value={d.comentario_adicional} fullWidth />}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderIncoming = () => (
    <>
      <div data-pdf-section>
        <SectionHeader icon={FileText} title="Identificação" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 bg-card rounded-lg border border-border p-4">
          {identificationFields.map(f => <DataField key={f.key} label={f.label} value={getFieldValue(f)} />)}
        </div>
      </div>
      {renderInspectionSection()}
      <div data-pdf-section>
        <SectionHeader icon={Package} title="Dados da Inspeção" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 bg-card rounded-lg border border-border p-4">
          <DataField label="Fase" value={fmt("fase", d?.fase)} />
          <DataField label="Qtd. Inspecionada" value={fmt("", d?.quantidade_inspecionada)} />
          <DataField label="Qtd. NG" value={fmt("", d?.quantidade_ng)} />
          <DataField label="Qtd. OK" value={fmt("", d?.quantidade_ok)} />
          <DataField label="Lote Inspecionado" value={fmt("", d?.lote_inspecionado)} />
          {!hasMultipleFailureModes && d?.modo_falha && (
            <DataField label="Modo de Falha" value={stripCode(d.modo_falha)} />
          )}
        </div>
      </div>
      {renderDetailsSection()}
    </>
  );

  const renderPeca = () => (
    <>
      <div data-pdf-section>
        <SectionHeader icon={FileText} title="Identificação" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 bg-card rounded-lg border border-border p-4">
          {identificationFields.map(f => <DataField key={f.key} label={f.label} value={getFieldValue(f)} />)}
        </div>
      </div>
      <div data-pdf-section>
        <SectionHeader icon={Package} title="Dados do Defeito" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 bg-card rounded-lg border border-border p-4">
          <DataField label="Fase" value={fmt("", d?.fase)} />
          <DataField label="Qtd. Inspecionada" value={fmt("", d?.quantidade_inspecionada)} />
          <DataField label="Qtd. NG" value={fmt("", d?.quantidade_ng)} />
          <DataField label="Qtd. OK" value={fmt("", d?.quantidade_ok)} />
          <DataField label="Modo de Falha" value={stripCode(d?.modo_falha)} />
          <DataField label="Parada de Linha" value={d?.parada_linha === "sim" ? "Sim" : "Não"} />
          {d?.parada_linha === "sim" && <DataField label="Tempo de Parada" value={fmt("", d?.parada_linha_tempo)} />}
        </div>
      </div>
      {renderDetailsSection()}
    </>
  );

  const renderProcesso = () => (
    <>
      <div data-pdf-section>
        <SectionHeader icon={FileText} title="Identificação" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 bg-card rounded-lg border border-border p-4">
          {identificationFields.map(f => <DataField key={f.key} label={f.label} value={getFieldValue(f)} />)}
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
          <DataField label="Modo de Falha" value={stripCode(d?.modo_falha)} />
          <DataField label="Parada de Linha" value={d?.parada_linha === "sim" ? "Sim" : "Não"} />
          {d?.parada_linha === "sim" && <DataField label="Tempo de Parada" value={fmt("", d?.parada_linha_tempo)} />}
        </div>
      </div>
      {renderDetailsSection()}
    </>
  );

  const renderOem = () => (
    <>
      <div data-pdf-section>
        <SectionHeader icon={FileText} title="Identificação" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 bg-card rounded-lg border border-border p-4">
          {identificationFields.map(f => <DataField key={f.key} label={f.label} value={getFieldValue(f)} />)}
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
        <div className="bg-card rounded-lg border border-border p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
            <DataField label="Descrição" value={fmt("", d?.descricao)} fullWidth />
            <DataField label="Análise Inicial" value={fmt("", d?.analise_inicial)} fullWidth />
            <DataField label="Ação Imediata" value={fmt("", d?.acao_imediata)} fullWidth />
            {d?.comentario_adicional && <DataField label="Comentário Adicional" value={d.comentario_adicional} fullWidth />}
          </div>
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

  // Only render segundo defeitos section for non-incoming multiple failure modes
  const hasNonFailureModeSegundoDefeitos = segundoDefeitos.length > 0 && !segundoDefeitos[0]?.modo_falha;

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

              {/* Second defects (only non-failure-mode type, i.e. from Peça/Processo) */}
              {hasNonFailureModeSegundoDefeitos && (
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
                        <div
                          key={photo.id}
                          className="rounded-lg border border-border overflow-hidden bg-muted aspect-video cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                          onClick={() => setLightboxUrl(urlData.publicUrl)}
                        >
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

      {/* Lightbox for photos */}
      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none [&>button:last-child]:hidden">
          <DialogClose className="absolute right-3 top-3 z-50 rounded-full bg-white/20 backdrop-blur-sm w-10 h-10 flex items-center justify-center hover:bg-white/40 transition-colors">
            <X className="h-5 w-5 text-white" />
            <span className="sr-only">Fechar</span>
          </DialogClose>
          {lightboxUrl && (
            <div className="flex items-center justify-center w-full h-[90vh] p-4">
              <img src={lightboxUrl} alt="Foto ampliada" className="max-w-full max-h-full object-contain rounded" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};

export default ApontamentoViewDialog;
