import { useState, useMemo, useEffect } from "react";
import { getLocalDateString } from "@/lib/localDate";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Download, FileText, AlertTriangle, CalendarIcon, Filter } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import hyundaiMobisLogo from "@/assets/hyundai-mobis-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { stripCode } from "@/lib/stripCode";
import {
  Document,
  Page,
  View,
  Text,
  Image as PdfImage,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import { toast } from "@/hooks/use-toast";

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

/* ─────────────────────────── PDF DOCUMENT (react-pdf) ─────────────────────────── */

const pdfStyles = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingBottom: 32,
    paddingHorizontal: 20,
    fontSize: 8,
    fontFamily: "Helvetica",
    color: "#1a1a2e",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: "#1a1a2e",
    paddingBottom: 8,
    marginBottom: 10,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 80, height: 28, objectFit: "contain" },
  title: { fontSize: 13, fontWeight: 700, color: "#1a1a2e" },
  subtitle: { fontSize: 8, color: "#6b7280", marginTop: 2 },
  badgeNg: {
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    fontSize: 7,
    fontWeight: 700,
  },
  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 4,
    padding: 8,
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  summaryValue: { fontSize: 14, fontWeight: 700, color: "#1a1a2e" },
  summaryValueNg: { fontSize: 14, fontWeight: 700, color: "#ef4444" },
  summaryLabel: { fontSize: 7, color: "#6b7280", marginTop: 2, textTransform: "uppercase" },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  groupBadge: {
    backgroundColor: "#e5e7eb",
    color: "#1a1a2e",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    fontSize: 8,
    fontWeight: 700,
  },
  groupCount: { fontSize: 7, color: "#6b7280" },
  table: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 3,
    overflow: "hidden",
  },
  tHeadRow: {
    flexDirection: "row",
    backgroundColor: "#1a1a2e",
  },
  tRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  tHeadCell: {
    paddingVertical: 5,
    paddingHorizontal: 4,
    color: "#ffffff",
    fontSize: 7,
    fontWeight: 700,
  },
  tCell: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    fontSize: 7,
    color: "#1a1a2e",
  },
  tCellNg: { color: "#ef4444", fontWeight: 700 },
  tagOk: {
    backgroundColor: "#d1fae5",
    color: "#065f46",
    paddingVertical: 1,
    paddingHorizontal: 4,
    borderRadius: 2,
    fontSize: 6,
    fontWeight: 700,
  },
  tagMissing: {
    backgroundColor: "#fef3c7",
    color: "#92400e",
    paddingVertical: 1,
    paddingHorizontal: 4,
    borderRadius: 2,
    fontSize: 6,
    fontWeight: 700,
  },
  footer: {
    position: "absolute",
    bottom: 14,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 6,
    fontSize: 7,
    color: "#6b7280",
  },
  empty: { textAlign: "center", marginTop: 40, color: "#6b7280", fontSize: 10 },
  ngBlock: { marginBottom: 10, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 4 },
  ngBlockHeader: { backgroundColor: "#1a1a2e", padding: 6, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ngBlockRef: { fontSize: 9, fontWeight: 700, color: "#ffffff" },
  ngBlockSub: { fontSize: 7, color: "#94a3b8", marginTop: 1 },
  ngCount: { fontSize: 10, fontWeight: 700, color: "#fca5a5" },
  ngOf: { fontSize: 6, color: "#94a3b8" },
  ngBlockBody: { padding: 8, gap: 7 },
  metaGrid: { flexDirection: "row", backgroundColor: "#f9fafb", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 3, padding: 6 },
  metaCol: { flex: 1, paddingHorizontal: 2 },
  metaLabel: { fontSize: 6, color: "#9ca3af", textTransform: "uppercase", marginBottom: 1 },
  metaValue: { fontSize: 7, color: "#1a1a2e", fontWeight: 500 },
  sectionTitle: { fontSize: 7, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 },
  falhaItem: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 3, padding: 5, marginBottom: 3 },
  falhaNum: { width: 14, height: 14, borderRadius: 7, backgroundColor: "#ef4444", alignItems: "center", justifyContent: "center" },
  falhaNumText: { fontSize: 6, fontWeight: 700, color: "#ffffff" },
  falhaName: { fontSize: 7, fontWeight: 700, color: "#1a1a2e" },
  falhaDesc: { fontSize: 6, color: "#6b7280", marginTop: 1 },
  falhaQty: { fontSize: 7, fontWeight: 700, backgroundColor: "#fee2e2", color: "#b91c1c", paddingVertical: 2, paddingHorizontal: 5, borderRadius: 2 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 4 },
  tagsLabel: { fontSize: 6, color: "#9ca3af", textTransform: "uppercase" },
});

// Column widths (must sum to ~100)
const COLS = [
  { key: "numero",  label: "Nº",          w: 7 },
  { key: "turno",   label: "Turno",       w: 6 },
  { key: "data",    label: "Data",        w: 8 },
  { key: "pn",      label: "Part Number", w: 11 },
  { key: "pname",   label: "Part Name",   w: 14 },
  { key: "forn",    label: "Fornecedor",  w: 12 },
  { key: "insp",    label: "Insp.",       w: 5, align: "right" as const },
  { key: "ng",      label: "NG",          w: 5, align: "right" as const },
  { key: "ok",      label: "OK",          w: 5, align: "right" as const },
  { key: "tag",     label: "Tag",         w: 9 },
  { key: "desc",    label: "Descrição",   w: 18 },
];

interface PdfProps {
  mode: "daily" | "ng";
  filtered: any[];
  byType: Record<string, any[]>;
  totals: { count: number; insp: number; ng: number };
  dateLabel: string;
  locationFilter?: string | null;
  logoUrl: string;
  photoMap?: Record<string, string[]>;
}

const parseModos = (r: any) => {
  const raw = (r.modo_falha || "").toString();
  if (!raw.trim()) return [] as { nome: string; descricao?: string; qty?: number }[];
  const parts = raw.split(/[,;]+/).map((s: string) => stripCode(s.trim())).filter(Boolean);
  const detalhes = r.detalhes_modo_falha;
  const qtyMap: Record<string, number> = {};
  if (detalhes && typeof detalhes === "object") {
    Object.entries(detalhes).forEach(([k, v]: [string, any]) => {
      const n = typeof v === "number" ? v : (typeof v === "object" && v?.qty) ? Number(v.qty) : NaN;
      if (!Number.isNaN(n)) qtyMap[stripCode(k)] = n;
    });
  }
  return parts.map((nome: string, i: number) => ({
    nome,
    descricao: i === 0 ? r.descricao || undefined : undefined,
    qty: qtyMap[nome],
  }));
};

const parseTags = (r: any): string[] => {
  const raw = (r.numero_tag || r.tag_number || "").toString();
  return raw.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
};

const ApontamentoPDFDocument = ({ mode, filtered, byType, totals, dateLabel, locationFilter, logoUrl, photoMap }: PdfProps) => {
  const titleText =
    mode === "ng"
      ? "Relatório de Peças com Defeito (NG)"
      : locationFilter === "Área de Incoming"
      ? "Relatório Incoming"
      : "Relatório Diário de Apontamentos";

  const generatedAt = `${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={pdfStyles.page}>
        {/* Header */}
        <View style={pdfStyles.header} fixed>
          <View style={pdfStyles.headerLeft}>
            {logoUrl ? <PdfImage src={logoUrl} style={pdfStyles.logo} /> : null}
            <View>
              {mode === "ng" && <Text style={pdfStyles.badgeNg}>PEÇAS NG</Text>}
              <Text style={pdfStyles.title}>{titleText}</Text>
              <Text style={pdfStyles.subtitle}>
                Data: {dateLabel} • {filtered.length} registros
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: 9, fontWeight: 700, color: "#1a1a2e" }}>HYUNDAI MOBIS</Text>
        </View>

        {/* Summary */}
        <View style={pdfStyles.summaryRow}>
          <View style={pdfStyles.summaryCard}>
            <Text style={pdfStyles.summaryValue}>{totals.count}</Text>
            <Text style={pdfStyles.summaryLabel}>Total Registros</Text>
          </View>
          <View style={pdfStyles.summaryCard}>
            <Text style={pdfStyles.summaryValue}>{totals.insp}</Text>
            <Text style={pdfStyles.summaryLabel}>Inspecionadas</Text>
          </View>
          <View style={pdfStyles.summaryCard}>
            <Text style={pdfStyles.summaryValueNg}>{totals.ng}</Text>
            <Text style={pdfStyles.summaryLabel}>Total NG</Text>
          </View>
        </View>

        {/* Empty */}
        {filtered.length === 0 && (
          <Text style={pdfStyles.empty}>
            {mode === "daily" ? "Nenhum registro nesta data." : "Nenhum registro com NG encontrado."}
          </Text>
        )}

        {/* Groups */}
        {Object.entries(byType).map(([tipo, records]) => (
          <View key={tipo} wrap>
            <View style={pdfStyles.groupHeader}>
              <Text style={pdfStyles.groupBadge}>{typeLabels[tipo] || tipo}</Text>
              <Text style={pdfStyles.groupCount}>({records.length} registros)</Text>
            </View>

            {mode === "ng" ? (
              <View>
                {records.map((r) => {
                  const modos = parseModos(r);
                  const tags = parseTags(r);
                  const photos = photoMap?.[r.id] || [];
                  return (
                    <View key={r.id} style={pdfStyles.ngBlock} wrap={false}>
                      <View style={pdfStyles.ngBlockHeader}>
                        <View>
                          <Text style={pdfStyles.ngBlockRef}>
                            {r.numero || "—"} — {r.part_number || "—"} — {r.part_name || "—"}
                          </Text>
                          <Text style={pdfStyles.ngBlockSub}>
                            {r.fornecedor || "—"} • Turno {r.turno || "—"} • {r.data ? new Date(r.data + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                          </Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={pdfStyles.ngCount}>{r.quantidade_ng || 0} NG</Text>
                          <Text style={pdfStyles.ngOf}>de {r.quantidade_inspecionada || 0} insp. • {r.quantidade_ok || 0} OK</Text>
                        </View>
                      </View>

                      <View style={pdfStyles.ngBlockBody}>
                        <View style={pdfStyles.metaGrid}>
                          <View style={pdfStyles.metaCol}>
                            <Text style={pdfStyles.metaLabel}>Local</Text>
                            <Text style={pdfStyles.metaValue}>{r.local_deteccao || "—"}</Text>
                          </View>
                          <View style={pdfStyles.metaCol}>
                            <Text style={pdfStyles.metaLabel}>Lote Inspecionado</Text>
                            <Text style={pdfStyles.metaValue}>{r.lote_inspecionado || "—"}</Text>
                          </View>
                          <View style={pdfStyles.metaCol}>
                            <Text style={pdfStyles.metaLabel}>Responsabilidade</Text>
                            <Text style={pdfStyles.metaValue}>{stripCode(r.responsabilidade) || "—"}</Text>
                          </View>
                          <View style={pdfStyles.metaCol}>
                            <Text style={pdfStyles.metaLabel}>Origem</Text>
                            <Text style={pdfStyles.metaValue}>{r.origem || "—"}</Text>
                          </View>
                          <View style={pdfStyles.metaCol}>
                            <Text style={pdfStyles.metaLabel}>Projeto</Text>
                            <Text style={pdfStyles.metaValue}>{r.projeto || "—"}</Text>
                          </View>
                        </View>

                        {modos.length > 0 && (
                          <View>
                            <Text style={pdfStyles.sectionTitle}>Modos de Falha</Text>
                            {modos.map((modo, idx) => (
                              <View key={idx} style={pdfStyles.falhaItem}>
                                <View style={pdfStyles.falhaNum}>
                                  <Text style={pdfStyles.falhaNumText}>{idx + 1}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={pdfStyles.falhaName}>{modo.nome}</Text>
                                  {modo.descricao ? <Text style={pdfStyles.falhaDesc}>{modo.descricao}</Text> : null}
                                </View>
                                {modo.qty ? <Text style={pdfStyles.falhaQty}>Qty: {modo.qty}</Text> : null}
                              </View>
                            ))}
                          </View>
                        )}

                        <View style={pdfStyles.tagsRow}>
                          <Text style={pdfStyles.tagsLabel}>Tags: </Text>
                          {tags.length > 0
                            ? tags.map((t, i) => <Text key={i} style={pdfStyles.tagOk}>TAG: {t}</Text>)
                            : <Text style={pdfStyles.tagMissing}>Sem TAG</Text>
                          }
                        </View>

                        {photos.length > 0 && (
                          <View>
                            <Text style={pdfStyles.sectionTitle}>Fotos ({photos.length})</Text>
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
                              {photos.map((url, i) => (
                                <PdfImage
                                  key={i}
                                  src={url}
                                  style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 3 }}
                                />
                              ))}
                            </View>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={pdfStyles.table}>
                {/* Header row */}
                <View style={pdfStyles.tHeadRow} fixed>
                  {COLS.map((c) => (
                    <Text
                      key={c.key}
                      style={[
                        pdfStyles.tHeadCell,
                        { width: `${c.w}%`, textAlign: c.align || "left" },
                      ]}
                    >
                      {c.label}
                    </Text>
                  ))}
                </View>

                {/* Body rows */}
                {records.map((r, idx) => {
                  const ngVal = r.quantidade_ng || 0;
                  const tag = r.numero_tag || r.tag_number;
                  return (
                    <View
                      key={r.id || idx}
                      style={[pdfStyles.tRow, { backgroundColor: idx % 2 ? "#f9fafb" : "#ffffff" }]}
                      wrap={false}
                    >
                      <Text style={[pdfStyles.tCell, { width: `${COLS[0].w}%`, fontWeight: 700 }]}>{r.numero || "—"}</Text>
                      <Text style={[pdfStyles.tCell, { width: `${COLS[1].w}%` }]}>{r.turno || "—"}</Text>
                      <Text style={[pdfStyles.tCell, { width: `${COLS[2].w}%` }]}>
                        {r.data ? new Date(r.data + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                      </Text>
                      <Text style={[pdfStyles.tCell, { width: `${COLS[3].w}%`, fontWeight: 700 }]}>{r.part_number || "—"}</Text>
                      <Text style={[pdfStyles.tCell, { width: `${COLS[4].w}%` }]}>{r.part_name || "—"}</Text>
                      <Text style={[pdfStyles.tCell, { width: `${COLS[5].w}%` }]}>{r.fornecedor || "—"}</Text>
                      <Text style={[pdfStyles.tCell, { width: `${COLS[6].w}%`, textAlign: "right" }]}>{r.quantidade_inspecionada || 0}</Text>
                      <Text style={[pdfStyles.tCell, ngVal > 0 ? pdfStyles.tCellNg : {}, { width: `${COLS[7].w}%`, textAlign: "right" }]}>{ngVal}</Text>
                      <Text style={[pdfStyles.tCell, { width: `${COLS[8].w}%`, textAlign: "right" }]}>{r.quantidade_ok || 0}</Text>
                      <View style={[pdfStyles.tCell, { width: `${COLS[9].w}%` }]}>
                        {tag ? (
                          <Text style={pdfStyles.tagOk}>TAG: {tag}</Text>
                        ) : (
                          <Text>—</Text>
                        )}
                      </View>
                      <Text style={[pdfStyles.tCell, { width: `${COLS[10].w}%` }]}>
                        {(stripCode(r.modo_falha) || r.descricao || "—").toString().slice(0, 120)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ))}

        {/* Footer */}
        <View style={pdfStyles.footer} fixed>
          <Text>Hyundai Mobis — Apontamento Control</Text>
          <Text
            render={({ pageNumber, totalPages }) => `${generatedAt}  •  Página ${pageNumber}/${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
};

/* ─────────────────────────── MAIN COMPONENT ─────────────────────────── */

const ApontamentoDailyReport = ({ open, onOpenChange, items, mode, onViewRecord, locationFilter }: Props) => {
  const today = getLocalDateString();
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [selectedFornecedores, setSelectedFornecedores] = useState<string[]>([]);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => { setSelectedFornecedores([]); }, [dateFrom, dateTo]);

  const fornecedoresDisponiveis = useMemo(() => {
    return Array.from(new Set(
      items
        .filter((i) => (i.quantidade_ng || 0) > 0)
        .filter((i) => i.data >= dateFrom && i.data <= dateTo)
        .map((i) => i.fornecedor)
        .filter(Boolean)
    )).sort();
  }, [items, dateFrom, dateTo]);

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

  const allPhotosByItem = useMemo(() => {
    const map: Record<string, string[]> = {};
    ngPhotos.forEach((p) => {
      const { data: urlData } = supabase.storage.from("checklist-photos").getPublicUrl(p.file_path);
      if (!map[p.checklist_id]) map[p.checklist_id] = [];
      map[p.checklist_id].push(urlData.publicUrl);
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
      if (selectedFornecedores.length > 0) {
        list = list.filter((i) => selectedFornecedores.includes(i.fornecedor));
      }
    }
    return list;
  }, [items, dateFrom, dateTo, mode, locationFilter, selectedFornecedores]);

  const byType = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filtered.forEach((i) => { const t = i.tipo || "outro"; if (!groups[t]) groups[t] = []; groups[t].push(i); });
    return groups;
  }, [filtered]);

  const totalNG = filtered.reduce((s, i) => s + (i.quantidade_ng || 0), 0);
  const totalInsp = filtered.reduce((s, i) => s + (i.quantidade_inspecionada || 0), 0);

  const handleNumberClick = (id: string) => {
    if (onViewRecord) {
      onOpenChange(false);
      setTimeout(() => onViewRecord(id), 200);
    }
  };

  const dateLabel = dateFrom === dateTo
    ? new Date(dateFrom + "T12:00:00").toLocaleDateString("pt-BR")
    : `${new Date(dateFrom + "T12:00:00").toLocaleDateString("pt-BR")} a ${new Date(dateTo + "T12:00:00").toLocaleDateString("pt-BR")}`;

  const pdfFileName =
    mode === "ng"
      ? `relatorio-ng-${dateFrom}.pdf`
      : locationFilter === "Área de Incoming"
      ? `relatorio-incoming-${dateFrom}.pdf`
      : `relatorio-diario-${dateFrom}.pdf`;

  const pdfDoc = (
    <ApontamentoPDFDocument
      mode={mode}
      filtered={filtered}
      byType={byType}
      totals={{ count: filtered.length, insp: totalInsp, ng: totalNG }}
      dateLabel={dateLabel}
      locationFilter={locationFilter}
      logoUrl={hyundaiMobisLogo}
      photoMap={allPhotosByItem}
    />
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 w-[95vw] [&>button:last-child]:hidden">
        <DialogClose className="absolute left-3 top-3 z-50 rounded-full bg-background/80 backdrop-blur-sm border border-border w-8 h-8 flex items-center justify-center opacity-80 hover:opacity-100 transition-opacity shadow-sm">
          <X className="h-4 w-4" /><span className="sr-only">Fechar</span>
        </DialogClose>

        <div className="flex flex-col">
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
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
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
                {mode === "ng" && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "text-xs h-8 gap-1.5",
                          selectedFornecedores.length > 0 && "border-primary text-primary"
                        )}
                      >
                        <Filter className="w-3 h-3" />
                        {selectedFornecedores.length > 0
                          ? `Fornecedor (${selectedFornecedores.length})`
                          : "Fornecedor"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[220px] p-2 max-h-[280px] overflow-y-auto" align="start">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] text-muted-foreground font-medium">Filtrar por Fornecedor</span>
                        {selectedFornecedores.length > 0 && (
                          <button
                            onClick={() => setSelectedFornecedores([])}
                            className="text-[10px] text-primary hover:underline"
                          >
                            Limpar
                          </button>
                        )}
                      </div>
                      {fornecedoresDisponiveis.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-3">Nenhum fornecedor encontrado</p>
                      ) : (
                        <div className="space-y-1.5">
                          {fornecedoresDisponiveis.map((f) => {
                            const checked = selectedFornecedores.includes(f);
                            return (
                              <label
                                key={f}
                                className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-muted cursor-pointer"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(v) => {
                                    setSelectedFornecedores((prev) =>
                                      v ? [...prev, f] : prev.filter((x) => x !== f)
                                    );
                                  }}
                                />
                                <span className="text-xs flex-1 truncate">{f}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                )}
                <PDFDownloadLink document={pdfDoc} fileName={pdfFileName}>
                  {({ loading }) => (
                    <Button variant="outline" size="sm" className="gap-1.5" disabled={loading}>
                      <Download className="w-4 h-4" /> {loading ? "Gerando..." : "PDF"}
                    </Button>
                  )}
                </PDFDownloadLink>
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
                <div className="block sm:hidden space-y-2">
                  {records.map((r) =>
                    mode === "ng" ? (
                      <NgMobileCard key={r.id} r={r} photoUrl={firstPhotoByItem[r.id]} onNumberClick={handleNumberClick} onPhotoClick={setLightboxUrl} />
                    ) : (
                      <DailyMobileCard key={r.id} r={r} onNumberClick={handleNumberClick} />
                    )
                  )}
                </div>

                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto rounded-lg border border-border">
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
                              <button onClick={() => handleNumberClick(r.id)} className="text-primary hover:underline cursor-pointer font-semibold">{r.numero}</button>
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
