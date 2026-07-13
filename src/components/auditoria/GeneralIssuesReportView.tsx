import type { CSSProperties, ReactNode } from "react";
import logo from "@/assets/hyundai-mobis-logo.png";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  ncs: any[];
  page?: number;
  perPage?: number;
}

function fmtDate(d?: string | null) {
  if (!d) return "-";
  const dt = new Date(d + "T12:00:00");
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  return `${mm}.${dd}`;
}

function storageUrl(path?: string | null) {
  if (!path) return null;
  return supabase.storage.from("audit-photos").getPublicUrl(path).data.publicUrl;
}

const W = 1084;
const HEAD_H = 68;
const ROW_HEAD_H = 40;
const ROW_H = 145;

const COLORS = {
  headerDark: "#1F4E79",
  header: "#2F5F8F",
  border: "#B7B7B7",
  text: "#111111",
  headerBg: "#F3F6F8",
  open: "#D93636",
  partial: "#F28C18",
  done: "#00A84F",
  redText: "#D93636",
  blueText: "#003399",
};

const COLS = [
  { key: "no", label: "NO", w: 55 },
  { key: "issue", label: "Issue", w: 90 },
  { key: "problem", label: "Problem Description", w: 230 },
  { key: "picture", label: "Picture", w: 200 },
  { key: "counter", label: "Counter Measure", w: 230 },
  { key: "due", label: "Due Date", w: 90 },
  { key: "charge", label: "In Charge", w: 90 },
  { key: "status", label: "Status", w: 65 },
  { key: "file", label: "File", w: 34 },
];

function colX(i: number) {
  return COLS.slice(0, i).reduce((s, c) => s + c.w, 0);
}

function Cell({
  x, y, w, h, children, bg, bold, center = false, size = 13, style,
}: {
  x: number; y: number; w: number; h: number; children?: ReactNode;
  bg?: string; bold?: boolean; center?: boolean; size?: number; style?: CSSProperties;
}) {
  return (
    <div
      style={{
        position: "absolute", left: x, top: y, width: w, height: h,
        boxSizing: "border-box", border: `1px solid ${COLORS.border}`,
        background: bg, color: COLORS.text, fontSize: size, fontWeight: bold ? 700 : 400,
        display: "flex", alignItems: center ? "center" : (style?.alignItems ?? "flex-start"),
        justifyContent: center ? "center" : "flex-start",
        textAlign: center ? "center" : "left",
        padding: center ? "0 4px" : "6px 8px",
        overflow: "hidden", lineHeight: 1.25, whiteSpace: "pre-wrap",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function StatusPill({ status }: { status?: string }) {
  const s = (status || "open").toLowerCase();
  const cfg =
    s === "done" ? { bg: COLORS.done, label: "Done" }
    : ["partial", "in_progress"].includes(s) ? { bg: COLORS.partial, label: "Partial" }
    : { bg: COLORS.open, label: "Open" };
  return (
    <span style={{
      display: "inline-block", padding: "3px 10px", background: cfg.bg,
      color: "#fff", fontWeight: 700, fontSize: 12, borderRadius: 2,
    }}>{cfg.label}</span>
  );
}

export default function GeneralIssuesReportView({ ncs, page = 0, perPage = 4 }: Props) {
  const chunk = ncs.slice(page * perPage, page * perPage + perPage);
  const H = HEAD_H + ROW_HEAD_H + ROW_H * perPage;

  return (
    <div style={{ width: "100%", overflowX: "auto", paddingBottom: 8 }}>
      <div
        style={{
          width: W, height: H, position: "relative", background: "#FFFFFF",
          color: COLORS.text, fontFamily: "Calibri, Arial, sans-serif",
          boxShadow: "0 22px 60px rgba(0,0,0,0.35)", overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          position: "absolute", left: 0, top: 0, width: 958, height: HEAD_H,
          background: `linear-gradient(90deg, ${COLORS.headerDark} 0%, ${COLORS.header} 72%, #9EB4C9 100%)`,
        }} />
        <div style={{ position: "absolute", left: 958, top: 0, width: 126, height: HEAD_H, background: "#FFFFFF" }} />
        <div style={{ position: "absolute", left: 14, top: 17, color: "#FFFFFF", fontSize: 32, lineHeight: 1 }}>□</div>
        <div style={{ position: "absolute", left: 58, top: 14, color: "#FFFFFF", fontSize: 30, letterSpacing: 0.2 }}>
          General Issues &amp; Improvement
        </div>
        <img src={logo} alt="Hyundai Mobis" style={{ position: "absolute", left: 962, top: 10, width: 112, height: 48, objectFit: "contain" }} />

        {/* Table header */}
        {COLS.map((c, i) => (
          <Cell key={c.key} x={colX(i)} y={HEAD_H} w={c.w} h={ROW_HEAD_H} bg={COLORS.headerBg} bold center size={14}>
            {c.label}
          </Cell>
        ))}

        {/* Rows */}
        {Array.from({ length: perPage }).map((_, r) => {
          const nc = chunk[r];
          const y = HEAD_H + ROW_HEAD_H + r * ROW_H;
          const picture = nc ? storageUrl(nc.before_photo_url) : null;
          return (
            <div key={r}>
              <Cell x={colX(0)} y={y} w={COLS[0].w} h={ROW_H} center size={14}>
                {nc ? String(nc.seq_number ?? r + 1).padStart(2, "0") : ""}
              </Cell>
              <Cell x={colX(1)} y={y} w={COLS[1].w} h={ROW_H} center size={13}>
                {nc?.issue_category || ""}
              </Cell>
              <Cell x={colX(2)} y={y} w={COLS[2].w} h={ROW_H} size={13} style={{ alignItems: "center" }}>
                {nc?.problem_description || ""}
              </Cell>
              <Cell x={colX(3)} y={y} w={COLS[3].w} h={ROW_H} center size={12} style={{ padding: 4 }}>
                {picture
                  ? <img src={picture} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                  : <span style={{ color: "#9CA3AF" }}>—</span>}
              </Cell>
              <Cell x={colX(4)} y={y} w={COLS[4].w} h={ROW_H} size={13} style={{ alignItems: "center" }}>
                {nc?.counter_measure || nc?.responses?.[0]?.corrective_measure_text || ""}
              </Cell>
              <Cell x={colX(5)} y={y} w={COLS[5].w} h={ROW_H} center size={14}>
                {nc ? fmtDate(nc.due_date) : ""}
              </Cell>
              <Cell x={colX(6)} y={y} w={COLS[6].w} h={ROW_H} center size={14}>
                {nc?.in_charge || ""}
              </Cell>
              <Cell x={colX(7)} y={y} w={COLS[7].w} h={ROW_H} center size={13}>
                {nc ? <StatusPill status={nc.status} /> : null}
              </Cell>
              <Cell x={colX(8)} y={y} w={COLS[8].w} h={ROW_H} center size={13}>
                {nc?.responses?.[0]?.after_photo_url ? (
                  <a
                    href={storageUrl(nc.responses[0].after_photo_url) || "#"}
                    target="_blank" rel="noreferrer"
                    style={{ color: COLORS.headerDark, textDecoration: "none" }}
                  >▶</a>
                ) : (
                  <span style={{ color: "#9CA3AF" }}>▷</span>
                )}
              </Cell>
            </div>
          );
        })}
      </div>
    </div>
  );
}
