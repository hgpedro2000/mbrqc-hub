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
  failureModeFilter?: string | null;
  tipoFilter?: string | null;
  projectFilter?: string | null;
  pnSetFilter?: Set<string> | null;
  initialDateFrom?: string;
  initialDateTo?: string;
}

const typeLabels: Record<string, string> = {
  incoming: "Incoming", peca: "Peça", processo: "Processo", oem: "OEM",
};

/* ── Helpers to aggregate multi-failure data per record ── */
const getTagsList = (r: any): string[] => {
  const out: string[] = [];
  const main = r?.numero_tag ?? r?.tag_number;
  if (main) String(main).split(/[,;]+/).map((s: string) => s.trim()).filter(Boolean).forEach(t => out.push(t));
  const sd = (r?.segundo_defeitos || []) as any[];
  if (Array.isArray(sd)) sd.forEach((d: any) => { const t = (d?.tag || "").toString().trim(); if (t) out.push(t); });
  return Array.from(new Set(out));
};

const getDescList = (r: any): string[] => {
  const out: string[] = [];
  const norm = (v: any) => (v == null ? "" : String(v).trim());
  const skipPlaceholder = (s: string) => s && s.toLowerCase() !== "sem descrição" && s.toLowerCase() !== "sem descricao";
  const d0 = norm(r?.descricao);
  if (skipPlaceholder(d0)) out.push(d0);
  const sd = (r?.segundo_defeitos || []) as any[];
  if (Array.isArray(sd)) sd.forEach((d: any) => { const v = norm(d?.descricao); if (skipPlaceholder(v)) out.push(v); });
  return out;
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
const NgMobileCard = ({ r, photos, onNumberClick, onPhotoClick, onMore }: { r: any; photos: string[]; onNumberClick: (id: string) => void; onPhotoClick: (url: string) => void; onMore: () => void }) => {
  const tags = getTagsList(r);
  const descs = getDescList(r);
  const extraTags = Math.max(0, tags.length - 1);
  const extraDescs = Math.max(0, descs.length - 1);
  const extraPhotos = Math.max(0, photos.length - 1);
  const firstDesc = stripCode(r.modo_falha) || descs[0] || "";
  const photoUrl = photos[0];
  return (
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
    <div className="flex justify-between items-center gap-2">
      <div className="flex items-center gap-1 flex-wrap min-w-0">
        {tags.length > 0 ? (
          <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-200 text-[10px]">TAG: {tags[0]}</Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">Sem TAG</Badge>
        )}
        {extraTags > 0 && (
          <button onClick={onMore} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 font-semibold">+{extraTags}</button>
        )}
      </div>
      {photoUrl ? (
        <div className="relative shrink-0">
          <img
            src={photoUrl}
            alt="Foto NG"
            className="w-16 h-16 object-cover rounded border border-border cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
            style={{ aspectRatio: "1/1" }}
            onClick={() => onPhotoClick(photoUrl)}
          />
          {extraPhotos > 0 && (
            <button onClick={onMore} className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[10px] px-1.5 rounded-full font-bold shadow">+{extraPhotos}</button>
          )}
        </div>
      ) : (
        <span className="text-muted-foreground text-[10px]">—</span>
      )}
    </div>
    {firstDesc && (
      <div className="flex items-center gap-1 mt-1">
        <p className="text-xs text-muted-foreground truncate flex-1">{firstDesc}</p>
        {extraDescs > 0 && (
          <button onClick={onMore} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 font-semibold shrink-0">+{extraDescs}</button>
        )}
      </div>
    )}
  </div>
  );
};

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

  /* ── NG report v2 styles ── */
  ngHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "#1a1a2e",
    paddingBottom: 8,
    marginBottom: 10,
  },
  ngHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  ngHeaderDivider: { width: 1, height: 32, backgroundColor: "#e5e7eb" },
  ngLogo: { width: 80, height: 34, objectFit: "contain" },
  ngBadgeNg: {
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
    fontSize: 6,
    fontWeight: 700,
    paddingVertical: 1,
    paddingHorizontal: 5,
    borderRadius: 3,
    marginBottom: 1,
    alignSelf: "flex-start",
  },
  ngTitleText: { fontSize: 11, fontWeight: 700, color: "#1a1a2e" },
  ngSubtitleText: { fontSize: 7, color: "#6b7280" },
  ngHeaderCards: { flexDirection: "row", gap: 5 },
  ngHeaderCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 3,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: "#f9fafb",
    minWidth: 58,
    alignItems: "center",
  },
  ngHeaderCardValue: { fontSize: 13, fontWeight: 700, color: "#1a1a2e" },
  ngHeaderCardValueNg: { fontSize: 13, fontWeight: 700, color: "#ef4444" },
  ngHeaderCardLabel: { fontSize: 5, color: "#9ca3af", textTransform: "uppercase" },

  ngSectionTitle: {
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    marginBottom: 8,
    paddingBottom: 3,
  },

  ngSumHead: { flexDirection: "row", backgroundColor: "#1a1a2e" },
  ngSumHeadCell: {
    paddingVertical: 5,
    paddingHorizontal: 6,
    color: "#ffffff",
    fontSize: 7,
    fontWeight: 700,
  },
  ngSumRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#f0f0f0", minHeight: 30, alignItems: "center" },
  ngSumCell: { paddingVertical: 6, paddingHorizontal: 6, fontSize: 7, color: "#1a1a2e" },
  ngSumIdxCircle: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#1a1a2e", alignItems: "center", justifyContent: "center" },
  ngSumIdxText: { fontSize: 6, color: "#ffffff", fontWeight: 700 },
  ngSumNgPill: {
    backgroundColor: "#fee2e2", color: "#b91c1c",
    fontSize: 6, fontWeight: 700,
    paddingVertical: 1, paddingHorizontal: 5, borderRadius: 2,
    alignSelf: "flex-start",
  },
  ngSumPagePill: {
    backgroundColor: "#1a1a2e", color: "#ffffff",
    fontSize: 6, fontWeight: 700,
    paddingVertical: 2, paddingHorizontal: 7, borderRadius: 2,
    alignSelf: "flex-start",
  },
  ngSumTagOk: {
    backgroundColor: "#d1fae5", color: "#065f46",
    fontSize: 6, fontWeight: 700,
    paddingVertical: 2, paddingHorizontal: 5, borderRadius: 2,
    marginBottom: 2, alignSelf: "flex-start",
  },
  ngSumTagMissing: {
    backgroundColor: "#fef3c7", color: "#92400e",
    fontSize: 6, fontWeight: 700,
    paddingVertical: 2, paddingHorizontal: 5, borderRadius: 2,
    alignSelf: "flex-start",
  },
  ngSumNote: {
    fontSize: 6, color: "#9ca3af", marginTop: 10,
    borderTopWidth: 1, borderTopColor: "#f3f4f6", paddingTop: 6,
  },

  /* ── NG detailed block (v2) ── */
  ngDBlock: { marginBottom: 8, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 3 },
  ngDHeader: { backgroundColor: "#1a1a2e", paddingVertical: 5, paddingHorizontal: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ngDHeaderTitle: { fontSize: 8, fontWeight: 700, color: "#ffffff" },
  ngDHeaderSub: { fontSize: 6, color: "#94a3b8", marginTop: 1 },
  ngDHeaderQty: { fontSize: 9, fontWeight: 700, color: "#fca5a5" },
  ngDHeaderOf: { fontSize: 6, color: "#94a3b8" },
  ngDBody: { paddingVertical: 6, paddingHorizontal: 8, gap: 5 },
  ngDMetaGrid: { flexDirection: "row", backgroundColor: "#f9fafb", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 3, paddingVertical: 5, paddingHorizontal: 6 },
  ngDMetaCol: { flex: 1, paddingHorizontal: 2 },
  ngDMetaLabel: { fontSize: 5, color: "#9ca3af", textTransform: "uppercase", marginBottom: 1 },
  ngDMetaValue: { fontSize: 6, fontWeight: 500, color: "#1a1a2e" },
  ngDSectionTitle: { fontSize: 6, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: 3 },
  ngDFalhaItem: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 2, paddingVertical: 3, paddingHorizontal: 6, marginBottom: 3 },
  ngDFalhaNum: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#ef4444", alignItems: "center", justifyContent: "center" },
  ngDFalhaNumText: { fontSize: 5, fontWeight: 700, color: "#ffffff" },
  ngDFalhaName: { fontSize: 6, fontWeight: 700, color: "#1a1a2e", flex: 1 },
  ngDFalhaQty: { fontSize: 6, fontWeight: 700, backgroundColor: "#fee2e2", color: "#b91c1c", paddingVertical: 1, paddingHorizontal: 4, borderRadius: 2 },
  ngDTagOk: { backgroundColor: "#d1fae5", color: "#065f46", fontSize: 5, fontWeight: 700, paddingVertical: 1, paddingHorizontal: 4, borderRadius: 2 },
  ngDTagMissing: { backgroundColor: "#fef3c7", color: "#92400e", fontSize: 5, fontWeight: 700, paddingVertical: 1, paddingHorizontal: 4, borderRadius: 2 },
  ngFooter: {
    position: "absolute",
    bottom: 10,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 4,
    fontSize: 6,
    color: "#9ca3af",
  },
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

// NG summary columns (sums to 100)
const NG_SUM_COLS = [
  { key: "idx",   label: "#",              w: 3,  align: "center" as const },
  { key: "num",   label: "Nº",             w: 8 },
  { key: "pn",    label: "Part Number",    w: 11 },
  { key: "pname", label: "Part Name",      w: 13 },
  { key: "forn",  label: "Fornecedor",     w: 10 },
  { key: "td",    label: "Turno/Data",     w: 7 },
  { key: "insp",  label: "Insp.",          w: 4,  align: "center" as const },
  { key: "ng",    label: "NG",             w: 4,  align: "center" as const },
  { key: "modos", label: "Modos de Falha", w: 14 },
  { key: "tags",  label: "Tags",           w: 11 },
  { key: "desc",  label: "Descrição",      w: 11 },
  { key: "pag",   label: "Pág.",           w: 4,  align: "center" as const },
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
  supplierOrigemMap?: Record<string, string>;
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

const CIRCLED = ["①","②","③","④","⑤","⑥","⑦","⑧","⑨","⑩","⑪","⑫","⑬","⑭","⑮","⑯","⑰","⑱","⑲","⑳"];

const NgSharedHeader = ({ logoUrl, titleText, dateLabel, totals, filtered }: { logoUrl: string; titleText: string; dateLabel: string; totals: { count: number; insp: number; ng: number }; filtered: any[] }) => (
  <View style={pdfStyles.ngHeader} fixed>
    <View style={pdfStyles.ngHeaderLeft}>
      {logoUrl ? <PdfImage src={logoUrl} style={pdfStyles.ngLogo} /> : null}
      <View style={pdfStyles.ngHeaderDivider} />
      <View>
        <Text style={pdfStyles.ngBadgeNg}>PEÇAS NG</Text>
        <Text style={pdfStyles.ngTitleText}>{titleText}</Text>
        <Text style={pdfStyles.ngSubtitleText}>Data: {dateLabel} • {filtered.length} registros</Text>
      </View>
    </View>
    <View style={pdfStyles.ngHeaderCards}>
      <View style={pdfStyles.ngHeaderCard}>
        <Text style={pdfStyles.ngHeaderCardValue}>{totals.count}</Text>
        <Text style={pdfStyles.ngHeaderCardLabel}>Registros</Text>
      </View>
      <View style={pdfStyles.ngHeaderCard}>
        <Text style={pdfStyles.ngHeaderCardValue}>{totals.insp}</Text>
        <Text style={pdfStyles.ngHeaderCardLabel}>Inspecionadas</Text>
      </View>
      <View style={pdfStyles.ngHeaderCard}>
        <Text style={pdfStyles.ngHeaderCardValueNg}>{totals.ng}</Text>
        <Text style={pdfStyles.ngHeaderCardLabel}>Total NG</Text>
      </View>
    </View>
  </View>
);

const NgFooter = ({ generatedAt }: { generatedAt: string }) => (
  <View style={pdfStyles.ngFooter} fixed>
    <Text>Hyundai Mobis — Apontamento Control</Text>
    <Text render={({ pageNumber, totalPages }) => `${generatedAt} • Página ${pageNumber}/${totalPages}`} />
  </View>
);

const ApontamentoPDFDocument = ({ mode, filtered, byType, totals, dateLabel, locationFilter, logoUrl, photoMap, supplierOrigemMap }: PdfProps) => {
  const titleText =
    mode === "ng"
      ? "Relatório de Peças com Defeito (NG)"
      : locationFilter === "Área de Incoming"
      ? "Relatório Incoming"
      : "Relatório Diário de Apontamentos";

  const generatedAt = `${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

  /* ─────────── NG REPORT (v2) ─────────── */
  if (mode === "ng") {
    // Build a flat sorted-by-input list (preserve filtered order). Each item gets index + page calculation.
    const list = filtered;
    const pageOf = (i: number) => 2 + Math.floor(i / 2);

    // Helper: treat "Sem descrição" placeholder as empty
    const cleanDesc = (v: any) => {
      const s = (v ?? "").toString().trim();
      if (!s) return "—";
      if (/^sem\s+descri[çc][ãa]o$/i.test(s)) return "—";
      return s;
    };

    // Pair items into groups of 2 for detailed pages.
    // Validation: ensure every detail page renders exactly 2 slots, padding with null when odd.
    const pairs: (any | null)[][] = [];
    for (let i = 0; i < list.length; i += 2) {
      const slice: (any | null)[] = list.slice(i, i + 2);
      while (slice.length < 2) slice.push(null);
      pairs.push(slice);
    }

    // Strict validation: every detail page MUST have exactly 2 slots before rendering.
    pairs.forEach((p, idx) => {
      if (p.length !== 2) {
        console.error(`[NG PDF] Detail page ${idx + 1} has ${p.length} slots, expected exactly 2.`, p);
        while (p.length < 2) p.push(null);
        if (p.length > 2) p.length = 2;
      }
    });
    const invalidPages = pairs.filter((p) => p.length !== 2);
    if (invalidPages.length > 0) {
      throw new Error(`[NG PDF] Validation failed: ${invalidPages.length} detail page(s) do not contain exactly 2 occurrences.`);
    }

    return (
      <Document>
        {/* PAGE 1 — SUMMARY */}
        <Page size="A4" orientation="landscape" style={{ paddingTop: 20, paddingBottom: 28, paddingHorizontal: 16, fontSize: 7, fontFamily: "Helvetica", color: "#1a1a2e" }}>
          <NgSharedHeader logoUrl={logoUrl} titleText={titleText} dateLabel={dateLabel} totals={totals} filtered={filtered} />

          <Text style={pdfStyles.ngSectionTitle}>Sumário de Ocorrências</Text>

          {list.length === 0 ? (
            <Text style={pdfStyles.empty}>Nenhum registro com NG encontrado.</Text>
          ) : (
            <View>
              <View style={pdfStyles.ngSumHead} fixed>
                {NG_SUM_COLS.map((c) => (
                  <Text key={c.key} style={[pdfStyles.ngSumHeadCell, { width: `${c.w}%`, textAlign: c.align || "left" }]}>{c.label}</Text>
                ))}
              </View>
              {list.map((r, idx) => {
                const tags = parseTags(r);
                const modos = parseModos(r);
                const modosTxt = modos.map((m) => m.qty ? `${m.nome} (${m.qty})` : m.nome).join(" • ");
                const turnoData = `${r.turno || "—"} ${r.data ? "/ " + new Date(r.data + "T12:00:00").toLocaleDateString("pt-BR") : ""}`.trim();
                return (
                  <View key={r.id || idx} style={[pdfStyles.ngSumRow, { backgroundColor: idx % 2 ? "#f9fafb" : "#ffffff" }]} wrap={false}>
                    <View style={[pdfStyles.ngSumCell, { width: `${NG_SUM_COLS[0].w}%`, alignItems: "center" }]}>
                      <View style={pdfStyles.ngSumIdxCircle}><Text style={pdfStyles.ngSumIdxText}>{idx + 1}</Text></View>
                    </View>
                    <Text style={[pdfStyles.ngSumCell, { width: `${NG_SUM_COLS[1].w}%`, fontWeight: 700 }]}>{r.numero || "—"}</Text>
                    <Text style={[pdfStyles.ngSumCell, { width: `${NG_SUM_COLS[2].w}%`, fontWeight: 700, fontSize: 6 }]}>{r.part_number || "—"}</Text>
                    <Text style={[pdfStyles.ngSumCell, { width: `${NG_SUM_COLS[3].w}%` }]}>{r.part_name || "—"}</Text>
                    <Text style={[pdfStyles.ngSumCell, { width: `${NG_SUM_COLS[4].w}%` }]}>{r.fornecedor || "—"}</Text>
                    <Text style={[pdfStyles.ngSumCell, { width: `${NG_SUM_COLS[5].w}%`, fontSize: 6 }]}>{turnoData}</Text>
                    <Text style={[pdfStyles.ngSumCell, { width: `${NG_SUM_COLS[6].w}%`, textAlign: "center" }]}>{r.quantidade_inspecionada || 0}</Text>
                    <View style={[pdfStyles.ngSumCell, { width: `${NG_SUM_COLS[7].w}%`, alignItems: "center" }]}>
                      <Text style={pdfStyles.ngSumNgPill}>{r.quantidade_ng || 0}</Text>
                    </View>
                    <Text style={[pdfStyles.ngSumCell, { width: `${NG_SUM_COLS[8].w}%`, fontSize: 6 }]}>{modosTxt || "—"}</Text>
                    <View style={[pdfStyles.ngSumCell, { width: `${NG_SUM_COLS[9].w}%` }]}>
                      {tags.length > 0
                        ? tags.map((t, i) => <Text key={i} style={pdfStyles.ngSumTagOk}>TAG: {t}</Text>)
                        : <Text style={pdfStyles.ngSumTagMissing}>Sem TAG</Text>}
                    </View>
                    <Text style={[pdfStyles.ngSumCell, { width: `${NG_SUM_COLS[10].w}%`, fontStyle: "italic", fontSize: 6, color: "#374151" }]}>{cleanDesc(r.descricao)}</Text>
                    <View style={[pdfStyles.ngSumCell, { width: `${NG_SUM_COLS[11].w}%`, alignItems: "center" }]}>
                      <Text style={pdfStyles.ngSumPagePill}>{pageOf(idx)}</Text>
                    </View>
                  </View>
                );
              })}
              <Text style={pdfStyles.ngSumNote}>* "Pág." indica onde o detalhamento completo com fotos de cada ocorrência pode ser encontrado.</Text>
            </View>
          )}

          <NgFooter generatedAt={generatedAt} />
        </Page>

        {/* DETAILED PAGES — 2 blocks per page */}
        {pairs.map((pair, pageIdx) => (
          <Page key={pageIdx} size="A4" orientation="landscape" style={{ paddingTop: 20, paddingBottom: 28, paddingHorizontal: 16, fontSize: 7, fontFamily: "Helvetica", color: "#1a1a2e" }}>
            <NgSharedHeader logoUrl={logoUrl} titleText={titleText} dateLabel={dateLabel} totals={totals} filtered={filtered} />

            {pair.map((r, sub) => {
              const globalIdx = pageIdx * 2 + sub;
              if (!r) {
                // Placeholder slot to guarantee 2 blocks per detail page
                return <View key={`empty-${pageIdx}-${sub}`} style={pdfStyles.ngDBlock} />;
              }
              const modos = parseModos(r);
              const tags = parseTags(r);
              const photos = photoMap?.[r.id] || [];
              return (
                <View key={r.id || globalIdx} style={pdfStyles.ngDBlock} wrap={false}>
                  <View style={pdfStyles.ngDHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={pdfStyles.ngDHeaderTitle}>{globalIdx + 1}. {r.numero || "—"} — {r.part_number || "—"} — {r.part_name || "—"}</Text>
                      <Text style={pdfStyles.ngDHeaderSub}>
                        {(r.fornecedor || "—")} • Turno {r.turno || "—"} • {r.data ? new Date(r.data + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={pdfStyles.ngDHeaderQty}>{r.quantidade_ng || 0} NG</Text>
                      <Text style={pdfStyles.ngDHeaderOf}>de {r.quantidade_inspecionada || 0} insp. • {r.quantidade_ok || 0} OK</Text>
                    </View>
                  </View>

                  <View style={pdfStyles.ngDBody}>
                    <View style={pdfStyles.ngDMetaGrid}>
                      <View style={pdfStyles.ngDMetaCol}>
                        <Text style={pdfStyles.ngDMetaLabel}>Local</Text>
                        <Text style={pdfStyles.ngDMetaValue}>{r.local_deteccao || "—"}</Text>
                      </View>
                      <View style={pdfStyles.ngDMetaCol}>
                        <Text style={pdfStyles.ngDMetaLabel}>Lote Inspecionado</Text>
                        <Text style={pdfStyles.ngDMetaValue}>{r.lote_inspecionado || "—"}</Text>
                      </View>
                      <View style={pdfStyles.ngDMetaCol}>
                        <Text style={pdfStyles.ngDMetaLabel}>Responsabilidade</Text>
                        <Text style={pdfStyles.ngDMetaValue}>{stripCode(r.responsabilidade_defeito || r.responsabilidade) || "—"}</Text>
                      </View>
                      <View style={pdfStyles.ngDMetaCol}>
                        <Text style={pdfStyles.ngDMetaLabel}>Origem</Text>
                        <Text style={pdfStyles.ngDMetaValue}>{(r.fornecedor && supplierOrigemMap?.[r.fornecedor]) || r.origem || "—"}</Text>
                      </View>
                      <View style={pdfStyles.ngDMetaCol}>
                        <Text style={pdfStyles.ngDMetaLabel}>ALC</Text>
                        <Text style={pdfStyles.ngDMetaValue}>{r.alc_code || "N/A"}</Text>
                      </View>
                      <View style={pdfStyles.ngDMetaCol}>
                        <Text style={pdfStyles.ngDMetaLabel}>Projeto</Text>
                        <Text style={pdfStyles.ngDMetaValue}>{r.projeto || "—"}</Text>
                      </View>
                    </View>

                    <View>
                      <Text style={pdfStyles.ngDSectionTitle}>Modos de Falha</Text>
                      {modos.length > 0 ? (
                        modos.map((m, idx) => (
                          <View key={idx} style={pdfStyles.ngDFalhaItem}>
                            <View style={pdfStyles.ngDFalhaNum}><Text style={pdfStyles.ngDFalhaNumText}>{idx + 1}</Text></View>
                            <Text style={pdfStyles.ngDFalhaName}>{m.nome}</Text>
                            {m.qty ? <Text style={pdfStyles.ngDFalhaQty}>Qty: {m.qty}</Text> : null}
                          </View>
                        ))
                      ) : (
                        <View style={pdfStyles.ngDFalhaItem}>
                          <Text style={pdfStyles.ngDFalhaName}>—</Text>
                        </View>
                      )}
                    </View>

                    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 4 }}>
                      <Text style={pdfStyles.tagsLabel}>Tags:</Text>
                      {tags.length > 0
                        ? tags.map((t, i) => <Text key={i} style={pdfStyles.ngDTagOk}>TAG: {t}</Text>)
                        : <Text style={pdfStyles.ngDTagMissing}>Sem TAG</Text>}
                    </View>

                    <View>
                      <Text style={pdfStyles.ngDSectionTitle}>Descrição</Text>
                      <Text style={{ fontSize: 7, color: "#1a1a2e", backgroundColor: "#f9fafb", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 2, paddingVertical: 4, paddingHorizontal: 6 }}>
                        {cleanDesc(r.descricao)}
                      </Text>
                    </View>

                    {photos.length > 0 && (
                      <View wrap={false}>
                        <Text style={pdfStyles.ngDSectionTitle}>Fotos ({photos.length})</Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                          {photos.slice(0, 4).map((url, i) => (
                            <PdfImage key={i} src={url} style={{ width: 70, height: 70, objectFit: "cover", borderRadius: 3 }} />
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}

            <NgFooter generatedAt={generatedAt} />
          </Page>
        ))}
      </Document>
    );
  }

  /* ─────────── DAILY / INCOMING REPORT (unchanged) ─────────── */
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={pdfStyles.page}>
        {/* Header */}
        <View style={pdfStyles.header} fixed>
          <View style={pdfStyles.headerLeft}>
            {logoUrl ? <PdfImage src={logoUrl} style={pdfStyles.logo} /> : null}
            <View>
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
          <Text style={pdfStyles.empty}>Nenhum registro nesta data.</Text>
        )}

        {/* Groups */}
        {Object.entries(byType).map(([tipo, records]) => (
          <View key={tipo} wrap>
            <View style={pdfStyles.groupHeader}>
              <Text style={pdfStyles.groupBadge}>{typeLabels[tipo] || tipo}</Text>
              <Text style={pdfStyles.groupCount}>({records.length} registros)</Text>
            </View>

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

const ApontamentoDailyReport = ({ open, onOpenChange, items, mode, onViewRecord, locationFilter, failureModeFilter, tipoFilter, projectFilter, pnSetFilter, initialDateFrom, initialDateTo }: Props) => {
  const today = getLocalDateString();
  const [dateFrom, setDateFrom] = useState(initialDateFrom ?? today);
  const [dateTo, setDateTo] = useState(initialDateTo ?? today);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [selectedFornecedores, setSelectedFornecedores] = useState<string[]>([]);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [pdfStage, setPdfStage] = useState<string>("");

  useEffect(() => {
    if (open) {
      setDateFrom(initialDateFrom ?? today);
      setDateTo(initialDateTo ?? today);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialDateFrom, initialDateTo]);

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

  // Fetch supplier origem map for NG report
  const ngFornecedores = useMemo(() => {
    if (mode !== "ng") return [];
    return Array.from(new Set(items.filter(i => (i.quantidade_ng || 0) > 0 && i.fornecedor).map(i => i.fornecedor as string)));
  }, [items, mode]);

  const { data: supplierOrigemRows = [] } = useQuery({
    queryKey: ["ng-report-supplier-origem", ngFornecedores],
    queryFn: async () => {
      if (ngFornecedores.length === 0) return [];
      const { data, error } = await supabase.from("suppliers").select("name, origem").in("name", ngFornecedores).eq("active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: mode === "ng" && ngFornecedores.length > 0,
  });

  const supplierOrigemMap = useMemo(() => {
    const map: Record<string, string> = {};
    (supplierOrigemRows as any[]).forEach((s) => { if (s?.name && s?.origem) map[s.name] = s.origem; });
    return map;
  }, [supplierOrigemRows]);

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
    if (tipoFilter) list = list.filter((i) => i.tipo === tipoFilter);
    if (projectFilter) list = list.filter((i) => (i.projeto || "") === projectFilter);
    if (pnSetFilter) list = list.filter((i) => i.part_number && pnSetFilter.has(i.part_number));
    if (failureModeFilter) {
      const norm = failureModeFilter.replace(/^\d+\s*-\s*/, "").trim().toLowerCase();
      list = list.filter((i) => {
        const main = (i.modo_falha || "").replace(/^\d+\s*-\s*/, "").trim().toLowerCase();
        if (main === norm) return true;
        const sd = (i as any).segundo_defeitos as any[] | null;
        if (sd && Array.isArray(sd)) {
          return sd.some((d) => (d.modo_falha || "").replace(/^\d+\s*-\s*/, "").trim().toLowerCase() === norm);
        }
        return false;
      });
    }
    return list;
  }, [items, dateFrom, dateTo, mode, locationFilter, selectedFornecedores, failureModeFilter, tipoFilter, projectFilter, pnSetFilter]);

  const byType = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filtered.forEach((i) => { const t = i.tipo || "outro"; if (!groups[t]) groups[t] = []; groups[t].push(i); });
    return groups;
  }, [filtered]);

  const totalNG = filtered.reduce((s, i) => s + (i.quantidade_ng || 0), 0);
  const totalInsp = filtered.reduce((s, i) => s + (i.quantidade_inspecionada || 0), 0);

  const handleNumberClick = (id: string) => {
    if (onViewRecord) {
      // Keep the report dialog open so the user can return to the list
      // by simply closing the view dialog (overlay behavior).
      onViewRecord(id);
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
      supplierOrigemMap={supplierOrigemMap}
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
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
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
                <div className="flex items-center gap-2 w-full sm:w-auto">
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
                <div className="flex flex-col gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={generatingPdf}
                    onClick={async () => {
                      if (generatingPdf) return;
                      setGeneratingPdf(true);
                      setPdfProgress(0);
                      setPdfStage("Preparando...");
                      try {
                        let safePhotoMap: Record<string, string[]> = {};
                        if (mode === "ng") {
                          const allUrls = Array.from(new Set(filtered.flatMap((r) => allPhotosByItem[r.id] || [])));
                          const total = allUrls.length;
                          let done = 0;
                          setPdfStage(total > 0 ? `Baixando fotos (0/${total})` : "Preparando...");
                          const compressBlob = (blob: Blob): Promise<string> =>
                            new Promise((resolve, reject) => {
                              const img = new Image();
                              const objUrl = URL.createObjectURL(blob);
                              img.onload = () => {
                                URL.revokeObjectURL(objUrl);
                                const MAX = 800;
                                let { width, height } = img;
                                if (width > MAX || height > MAX) {
                                  if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
                                  else { width = Math.round((width * MAX) / height); height = MAX; }
                                }
                                const canvas = document.createElement("canvas");
                                canvas.width = width; canvas.height = height;
                                const ctx = canvas.getContext("2d");
                                if (!ctx) return reject(new Error("no ctx"));
                                ctx.drawImage(img, 0, 0, width, height);
                                resolve(canvas.toDataURL("image/jpeg", 0.6));
                              };
                              img.onerror = () => { URL.revokeObjectURL(objUrl); reject(new Error("img load")); };
                              img.src = objUrl;
                            });
                          const fetchOne = (url: string) =>
                            new Promise<[string, string | null]>((resolve) => {
                              const timer = setTimeout(() => resolve([url, null]), 12000);
                              fetch(url)
                                .then((r) => (r.ok ? r.blob() : Promise.reject()))
                                .then((b) => compressBlob(b))
                                .then((dataUri) => { clearTimeout(timer); resolve([url, dataUri]); })
                                .catch(() => { clearTimeout(timer); resolve([url, null]); });
                            }).then((res) => {
                              done++;
                              // Photos take ~80% of total progress
                              setPdfProgress(total > 0 ? Math.round((done / total) * 80) : 0);
                              setPdfStage(`Baixando fotos (${done}/${total})`);
                              return res;
                            });
                          const results = await Promise.all(allUrls.map(fetchOne));
                          const urlToData = new Map(results);
                          Object.entries(allPhotosByItem).forEach(([id, urls]) => {
                            safePhotoMap[id] = urls.map((u) => urlToData.get(u)).filter(Boolean) as string[];
                          });
                        }
                        setPdfProgress(85);
                        setPdfStage("Renderizando PDF...");
                        // Yield so UI can paint
                        await new Promise((r) => setTimeout(r, 50));
                        const docToRender = (
                          <ApontamentoPDFDocument
                            mode={mode}
                            filtered={filtered}
                            byType={byType}
                            totals={{ count: filtered.length, insp: totalInsp, ng: totalNG }}
                            dateLabel={dateLabel}
                            locationFilter={locationFilter}
                            logoUrl={hyundaiMobisLogo}
                            photoMap={mode === "ng" ? safePhotoMap : allPhotosByItem}
                            supplierOrigemMap={supplierOrigemMap}
                          />
                        );
                        const blob = await pdf(docToRender).toBlob();
                        setPdfProgress(100);
                        setPdfStage("Concluído");
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = pdfFileName;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                      } catch (e: any) {
                        console.error("PDF generation failed", e);
                        toast({ title: "Falha ao gerar PDF", description: e?.message || "Tente um período menor.", variant: "destructive" });
                      } finally {
                        setTimeout(() => {
                          setGeneratingPdf(false);
                          setPdfProgress(0);
                          setPdfStage("");
                        }, 600);
                      }
                    }}
                  >
                    <Download className="w-4 h-4" /> {generatingPdf ? `Gerando ${pdfProgress}%` : "PDF"}
                  </Button>
                  {generatingPdf && (
                    <div className="w-full min-w-[140px]">
                      <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-200"
                          style={{ width: `${pdfProgress}%` }}
                        />
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-0.5 truncate">{pdfStage}</p>
                    </div>
                  )}
                </div>
                </div>
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
                      {records.map((r) => {
                        const tags = getTagsList(r);
                        const descs = getDescList(r);
                        const photos = allPhotosByItem[r.id] || [];
                        const extraTags = Math.max(0, tags.length - 1);
                        const extraDescs = Math.max(0, descs.length - 1);
                        const extraPhotos = Math.max(0, photos.length - 1);
                        const mainDesc = stripCode(r.modo_falha) || descs[0] || "—";
                        const openMore = () => setMoreInfo({ numero: r.numero, part_number: r.part_number, tags, descs, photos });
                        return (
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
                              <div className="flex items-center gap-1">
                                {tags.length > 0 ? (
                                  <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-200 text-[10px]">TAG: {tags[0]}</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">Sem TAG</Badge>
                                )}
                                {extraTags > 0 && (
                                  <button onClick={openMore} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 font-semibold">+{extraTags}</button>
                                )}
                              </div>
                            </td>
                          )}
                          <td className="px-3 py-1.5 max-w-[200px]">
                            <div className="flex items-center gap-1">
                              <span className="truncate flex-1">{mainDesc}</span>
                              {extraDescs > 0 && (
                                <button onClick={openMore} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 font-semibold shrink-0">+{extraDescs}</button>
                              )}
                            </div>
                          </td>
                          {mode === "ng" && (
                            <td className="px-3 py-1.5 text-center">
                              {photos[0] ? (
                                <div className="relative inline-block">
                                  <img
                                    src={photos[0]}
                                    alt="Foto NG"
                                    className="w-16 h-16 object-cover rounded border border-border inline-block cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                                    style={{ aspectRatio: "1/1" }}
                                    onClick={(e) => { e.stopPropagation(); setLightboxUrl(photos[0]); }}
                                  />
                                  {extraPhotos > 0 && (
                                    <button onClick={openMore} className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[10px] px-1.5 rounded-full font-bold shadow">+{extraPhotos}</button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-[10px]">—</span>
                              )}
                            </td>
                          )}
                        </tr>
                        );
                      })}
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
