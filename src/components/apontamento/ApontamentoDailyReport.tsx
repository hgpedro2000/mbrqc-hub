import { useState, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogClose, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Download, FileText, AlertTriangle, CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { exportPdfFromRef } from "@/lib/exportPdfFromRef";
import hyundaiMobisLogo from "@/assets/hyundai-mobis-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { stripCode } from "@/lib/stripCode";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: any[];
  mode: "daily" | "ng";
  onViewRecord?: (id: string) => void;
  locationFilter?: string | null;
}

const typeLabels: Record<string, string> = {
  incoming: "Incoming", peca: "Peça", processo: "Processo", oem: "OEM",
};

/* ── Mobile card for Daily mode ── */
const DailyMobileCard = ({ r, onNumberClick }: { r: any; onNumberClick: (id: string) => void }) => (
  <div className="border border-border rounded-lg p-3 bg-card shadow-sm">
    <div className="flex justify-between items-center mb-1">
      {r.numero ? (
        <button onClick={() => onNumberClick(r.id)} className="font-bold text-sm text-primary hover:underline">{r.numero}</button>
      ) : <span className="font-bold text-sm text-muted-foreground">—</span>}
      <span className="text-[10px] text-muted-foreground">{r.turno || "—"} • {new Date(r.data + "T12:00:00").toLocaleDateString("pt-BR")}</span>
    </div>
    <p className="font-semibold text-sm">{r.part_number || "—"}</p>
    <p className="text-xs text-muted-foreground truncate">{r.part_name || "—"}</p>
    <p className="text-xs text-muted-foreground/70 mb-2">{r.fornecedor || "—"}</p>
    <div className="flex gap-3 text-xs">
      <span>Insp: {r.quantidade_inspecionada || 0}</span>
      <span className={`font-bold ${(r.quantidade_ng || 0) > 0 ? "text-destructive" : ""}`}>NG: {r.quantidade_ng || 0}</span>
      <span>OK: {r.quantidade_ok || 0}</span>
    </div>
    {(stripCode(r.modo_falha) || r.descricao) && (
      <p className="text-xs text-muted-foreground mt-1 truncate">{stripCode(r.modo_falha) || r.descricao}</p>
    )}
  </div>
);

/* ── Mobile card for NG mode ── */
const NgMobileCard = ({ r, photoUrl, onNumberClick, onPhotoClick }: { r: any; photoUrl?: string; onNumberClick: (id: string) => void; onPhotoClick: (url: string) => void }) => (
  <div className="border border-border rounded-lg p-3 bg-card shadow-sm">
    <div className="flex justify-between items-center mb-1">
      {r.numero ? (
        <button onClick={() => onNumberClick(r.id)} className="font-bold text-sm text-primary hover:underline">{r.numero}</button>
      ) : <span className="font-bold text-sm text-muted-foreground">—</span>}
      <span className="text-[10px] text-muted-foreground">{r.turno || "—"} • {new Date(r.data + "T12:00:00").toLocaleDateString("pt-BR")}</span>
    </div>
    <p className="font-semibold text-sm">{r.part_number || "—"}</p>
    <p className="text-xs text-muted-foreground truncate">{r.part_name || "—"}</p>
    <p className="text-xs text-muted-foreground/70 mb-2">{r.fornecedor || "—"}</p>
    <div className="flex gap-3 text-xs mb-2">
      <span>Insp: {r.quantidade_inspecionada || 0}</span>
      <span className="text-destructive font-bold">NG: {r.quantidade_ng || 0}</span>
      <span>OK: {r.quantidade_ok || 0}</span>
    </div>
    <div className="flex justify-between items-center">
      <div>
        {(r.numero_tag || r.tag_number) ? (
          <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-200 text-[10px]">TAG: {r.numero_tag || r.tag_number}</Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">Sem TAG</Badge>
        )}
      </div>
      {photoUrl ? (
        <img
          src={photoUrl}
          alt="Foto NG"
          className="w-16 h-16 object-cover rounded border border-border cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
          style={{ aspectRatio: "1/1" }}
          onClick={() => onPhotoClick(photoUrl)}
        />
      ) : (
        <span className="text-muted-foreground text-[10px]">—</span>
      )}
    </div>
    {(stripCode(r.modo_falha) || r.descricao) && (
      <p className="text-xs text-muted-foreground mt-1 truncate">{stripCode(r.modo_falha) || r.descricao}</p>
    )}
  </div>
);

const ApontamentoDailyReport = ({ open, onOpenChange, items, mode, onViewRecord, locationFilter }: Props) => {
  const today = new Date().toISOString().split("T")[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const contentRef = useRef<HTMLDivElement>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Fetch photos for NG report
  const ngItemIds = useMemo(() => {
    if (mode !== "ng") return [];
    return items.filter(i => (i.quantidade_ng || 0) > 0).map(i => i.id);
  }, [items, mode]);

  const { data: ngPhotos = [] } = useQuery({
    queryKey: ["ng-report-photos", ngItemIds],
    queryFn: async () => {
      if (ngItemIds.length === 0) return [];
      const { data, error } = await supabase.from("checklist_photos").select("checklist_id, file_path").eq("checklist_type", "apontamento");
      if (error) throw error;
      return data;
    },
    enabled: mode === "ng" && ngItemIds.length > 0,
  });

  const firstPhotoByItem = useMemo(() => {
    const map: Record<string, string> = {};
    ngPhotos.forEach((p) => {
      if (!map[p.checklist_id]) {
        const { data: urlData } = supabase.storage.from("checklist-photos").getPublicUrl(p.file_path);
        map[p.checklist_id] = urlData.publicUrl;
      }
    });
    return map;
  }, [ngPhotos]);

  const filtered = useMemo(() => {
    let list = items;
    if (locationFilter) {
      list = list.filter((i) => {
        const loc = i.local_deteccao === "Sala do Audio" || i.local_deteccao === "Área de Incoming"
          ? i.local_deteccao
          : (i.fase === "Sala do Audio" || i.fase === "Área de Incoming" ? i.fase : null);
        return loc === locationFilter;
      });
    }
    if (mode === "daily") {
      list = list.filter((i) => i.data >= dateFrom && i.data <= dateTo);
    }
    if (mode === "ng") {
      list = list.filter((i) => (i.quantidade_ng || 0) > 0);
      if (dateFrom && dateTo) {
        list = list.filter((i) => i.data >= dateFrom && i.data <= dateTo);
      }
    }
    return list;
  }, [items, dateFrom, dateTo, mode, locationFilter]);

  const byType = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filtered.forEach((i) => { const t = i.tipo || "outro"; if (!groups[t]) groups[t] = []; groups[t].push(i); });
    return groups;
  }, [filtered]);

  const totalNG = filtered.reduce((s, i) => s + (i.quantidade_ng || 0), 0);
  const totalInsp = filtered.reduce((s, i) => s + (i.quantidade_inspecionada || 0), 0);

  const handleExportPdf = async () => {
    if (!contentRef.current) return;
    const el = contentRef.current;
    const exportBtns = el.querySelectorAll("[data-export-btn]");
    const mobileCards = el.querySelectorAll("[data-mobile-cards]");
    exportBtns.forEach((btn) => (btn as HTMLElement).style.display = "none");
    mobileCards.forEach((c) => (c as HTMLElement).style.display = "none");
    const desktopTables = el.querySelectorAll("[data-desktop-table]");
    desktopTables.forEach((t) => (t as HTMLElement).style.display = "block");
    try {
      const fileName = mode === "daily" ? `relatorio-diario-${dateFrom}.pdf` : `relatorio-ng-${today}.pdf`;
      await exportPdfFromRef(el, fileName, { orientation: "landscape", pageWidthMm: 297, windowWidth: 1200 });
    } finally {
      exportBtns.forEach((btn) => (btn as HTMLElement).style.display = "");
      mobileCards.forEach((c) => (c as HTMLElement).style.display = "");
      desktopTables.forEach((t) => (t as HTMLElement).style.display = "");
    }
  };

  const handleNumberClick = (id: string) => {
    if (onViewRecord) {
      onOpenChange(false);
      setTimeout(() => onViewRecord(id), 200);
    }
  };

  const dateLabel = dateFrom === dateTo
    ? new Date(dateFrom + "T12:00:00").toLocaleDateString("pt-BR")
    : `${new Date(dateFrom + "T12:00:00").toLocaleDateString("pt-BR")} a ${new Date(dateTo + "T12:00:00").toLocaleDateString("pt-BR")}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 w-[95vw] [&>button:last-child]:hidden">
        <DialogClose className="absolute left-3 top-3 z-50 rounded-full bg-background/80 backdrop-blur-sm border border-border w-8 h-8 flex items-center justify-center opacity-80 hover:opacity-100 transition-opacity shadow-sm">
          <X className="h-4 w-4" /><span className="sr-only">Fechar</span>
        </DialogClose>

        <div ref={contentRef} className="flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-b border-border px-4 md:px-6 pt-4 md:pt-6 pb-3 md:pb-4">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
              <div className="flex items-center gap-4">
                <img src={hyundaiMobisLogo} alt="Hyundai Mobis" className="h-10 md:h-14 w-auto object-contain" />
                <div>
                  <div className="flex items-center gap-2">
                    {mode === "ng" && <Badge className="bg-destructive/10 text-destructive border-destructive/20"><AlertTriangle className="w-3 h-3 mr-1" />Peças NG</Badge>}
                  </div>
                  <h2 className="text-sm md:text-lg font-bold text-foreground">
                    {mode === "daily" ? "Relatório Diário de Apontamentos" : "Relatório de Peças com Defeito (NG)"}
                  </h2>
                  <p className="text-[10px] md:text-xs text-muted-foreground">
                    Data: {dateLabel} {` • ${filtered.length} registros`}
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2" data-export-btn>
                <div className="flex items-center gap-1">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("w-[120px] text-xs h-8 justify-start", !dateFrom && "text-muted-foreground")}>
                        <CalendarIcon className="w-3 h-3 mr-1" />
                        {dateFrom ? format(new Date(dateFrom + "T12:00:00"), "dd/MM/yyyy") : "De"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dateFrom ? new Date(dateFrom + "T12:00:00") : undefined} onSelect={(d) => setDateFrom(d ? format(d, "yyyy-MM-dd") : today)} locale={ptBR} className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                  <span className="text-xs text-muted-foreground">a</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("w-[120px] text-xs h-8 justify-start", !dateTo && "text-muted-foreground")}>
                        <CalendarIcon className="w-3 h-3 mr-1" />
                        {dateTo ? format(new Date(dateTo + "T12:00:00"), "dd/MM/yyyy") : "Até"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dateTo ? new Date(dateTo + "T12:00:00") : undefined} onSelect={(d) => setDateTo(d ? format(d, "yyyy-MM-dd") : today)} locale={ptBR} className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportPdf}><Download className="w-4 h-4" /> PDF</Button>
              </div>
            </div>
          </div>

          {/* Summary cards */}
          <div className="px-4 md:px-6 py-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 w-full">
              <div className="text-center p-3 bg-card rounded-lg border border-border w-full"><p className="text-xl font-bold text-foreground">{filtered.length}</p><p className="text-[10px] text-muted-foreground uppercase">Total Registros</p></div>
              <div className="text-center p-3 bg-card rounded-lg border border-border w-full"><p className="text-xl font-bold text-foreground">{totalInsp}</p><p className="text-[10px] text-muted-foreground uppercase">Inspecionadas</p></div>
              <div className="text-center p-3 bg-card rounded-lg border border-border w-full col-span-2 sm:col-span-1"><p className="text-xl font-bold text-destructive">{totalNG}</p><p className="text-[10px] text-muted-foreground uppercase">Total NG</p></div>
            </div>
          </div>

          {/* Content by type */}
          <div className="px-4 md:px-6 pb-4 space-y-4">
            {Object.entries(byType).map(([tipo, records]) => (
              <div key={tipo}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary" className="text-xs">{typeLabels[tipo] || tipo}</Badge>
                  <span className="text-xs text-muted-foreground">({records.length} registros)</span>
                </div>

                {/* Mobile cards */}
                <div className="block sm:hidden space-y-2" data-mobile-cards>
                  {records.map((r) =>
                    mode === "ng" ? (
                      <NgMobileCard key={r.id} r={r} photoUrl={firstPhotoByItem[r.id]} onNumberClick={handleNumberClick} onPhotoClick={setLightboxUrl} />
                    ) : (
                      <DailyMobileCard key={r.id} r={r} onNumberClick={handleNumberClick} />
                    )
                  )}
                </div>

                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto rounded-lg border border-border" data-desktop-table>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">Nº</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">Turno</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">Data</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">Part Number</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">Part Name</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">Fornecedor</th>
                        <th className="text-right px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">Insp.</th>
                        <th className="text-right px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">NG</th>
                        <th className="text-right px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">OK</th>
                        {mode === "ng" && <th className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">Tag</th>}
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">Descrição</th>
                        {mode === "ng" && <th className="text-center px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">Foto</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r) => (
                        <tr key={r.id} className="border-b last:border-b-0 hover:bg-muted/20">
                          <td className="px-3 py-1.5 font-mono text-muted-foreground">
                            {r.numero ? (
                              <button onClick={() => handleNumberClick(r.id)} className="text-primary hover:underline cursor-pointer font-semibold" data-export-btn>{r.numero}</button>
                            ) : "—"}
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap">{r.turno || "—"}</td>
                          <td className="px-3 py-1.5 whitespace-nowrap">{new Date(r.data + "T12:00:00").toLocaleDateString("pt-BR")}</td>
                          <td className="px-3 py-1.5 font-semibold">{r.part_number || "—"}</td>
                          <td className="px-3 py-1.5">{r.part_name || "—"}</td>
                          <td className="px-3 py-1.5">{r.fornecedor || "—"}</td>
                          <td className="px-3 py-1.5 text-right">{r.quantidade_inspecionada || 0}</td>
                          <td className={`px-3 py-1.5 text-right font-semibold ${(r.quantidade_ng || 0) > 0 ? "text-destructive" : ""}`}>{r.quantidade_ng || 0}</td>
                          <td className="px-3 py-1.5 text-right">{r.quantidade_ok || 0}</td>
                          {mode === "ng" && (
                            <td className="px-3 py-1.5 whitespace-nowrap">
                              {(r.numero_tag || r.tag_number) ? (
                                <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-200 text-[10px]">TAG: {r.numero_tag || r.tag_number}</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">Sem TAG</Badge>
                              )}
                            </td>
                          )}
                          <td className="px-3 py-1.5 max-w-[200px] truncate">{stripCode(r.modo_falha) || r.descricao || "—"}</td>
                          {mode === "ng" && (
                            <td className="px-3 py-1.5 text-center">
                              {firstPhotoByItem[r.id] ? (
                                <img
                                  src={firstPhotoByItem[r.id]}
                                  alt="Foto NG"
                                  className="w-16 h-16 object-cover rounded border border-border inline-block cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                                  style={{ aspectRatio: "1/1" }}
                                  onClick={(e) => { e.stopPropagation(); setLightboxUrl(firstPhotoByItem[r.id]); }}
                                />
                              ) : (
                                <span className="text-muted-foreground text-[10px]">—</span>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>{mode === "daily" ? "Nenhum registro nesta data." : "Nenhum registro com NG encontrado."}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border px-4 md:px-6 py-3 bg-muted/20">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">Hyundai Mobis — Apontamento Control</p>
              <p className="text-[10px] text-muted-foreground">{new Date().toLocaleDateString("pt-BR")} {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Photo lightbox */}
      {lightboxUrl && (
        <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none [&>button:last-child]:hidden">
            <button onClick={() => setLightboxUrl(null)} className="absolute right-3 top-3 z-50 rounded-full bg-white/20 backdrop-blur-sm w-10 h-10 flex items-center justify-center hover:bg-white/40 transition-colors">
              <X className="h-5 w-5 text-white" />
            </button>
            <div className="flex items-center justify-center w-full h-[90vh] p-4">
              <img src={lightboxUrl} alt="Foto ampliada" className="max-w-full max-h-full object-contain rounded" />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
};

export default ApontamentoDailyReport;
