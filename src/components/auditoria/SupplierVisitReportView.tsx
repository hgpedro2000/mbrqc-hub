import type { CSSProperties, ReactNode } from "react";
import logo from "@/assets/hyundai-mobis-logo.png";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  audit: any;
  ncs: any[];
}

function fmtDate(d?: string | null) {
  if (!d) return "-";
  return new Date(d + "T12:00:00").toLocaleDateString("en-GB");
}

function storageUrl(path?: string | null) {
  if (!path) return null;
  return supabase.storage.from("audit-photos").getPublicUrl(path).data.publicUrl;
}

const W = 1084;
const H = 770;
const COLORS = {
  header: "#2F5F8F",
  headerDark: "#1F4E79",
  label: "#DCE6F1",
  border: "#B7B7B7",
  text: "#111111",
  open: "#D00000",
  partial: "#F28C18",
  done: "#00A84F",
  blueText: "#003399",
  redText: "#D93636",
};

const PROCESS_ITEMS = ["Injection", "Assembly", "Paint", "Other"];

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s/]/g, "");

const has = (arr: string[] | null | undefined, v: string) =>
  Array.isArray(arr) && arr.some((x) => norm(String(x)) === norm(v));

function Chk({ on, label }: { on: boolean; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap", marginRight: 18 }}>
      <span
        style={{
          width: 18,
          height: 18,
          display: "inline-block",
          border: `2px solid ${on ? "#000000" : "#9A9A9A"}`,
          background: on ? "#000000" : "#FFFFFF",
          boxSizing: "border-box",
        }}
      />
      <span>{label}</span>
    </span>
  );
}

function Cell({
  x,
  y,
  w,
  h,
  children,
  bg,
  bold,
  center = false,
  size = 16,
  border = true,
  style,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  children?: ReactNode;
  bg?: string;
  bold?: boolean;
  center?: boolean;
  size?: number;
  border?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        boxSizing: "border-box",
        border: border ? `1px solid ${COLORS.border}` : undefined,
        background: bg,
        color: COLORS.text,
        fontSize: size,
        fontWeight: bold ? 700 : 400,
        display: "flex",
        alignItems: "center",
        justifyContent: center ? "center" : "flex-start",
        textAlign: center ? "center" : "left",
        padding: center ? "0 4px" : "0 10px",
        overflow: "hidden",
        lineHeight: 1.15,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default function SupplierVisitReportView({ audit, ncs }: Props) {
  const purpose: string[] = audit.purpose || [];
  const proc: string[] = audit.process || [];
  const inspectionTotal = Number(audit.paint_inspection_total ?? audit.mbr_aql_total ?? 0);
  const inspectionOk = Number(audit.paint_inspection_ok ?? audit.mbr_aql_ok ?? 0);
  const inspectionNg = Number(audit.paint_inspection_ng ?? Math.max(inspectionTotal - inspectionOk, 0));
  const inspectionRate = inspectionTotal > 0 ? Math.round((inspectionOk / inspectionTotal) * 100) : 0;
  const ok = Number(audit.mbr_aql_ok ?? 0);
  const ng = Number(audit.mbr_aql_ng ?? 0);
  const total = Number(audit.mbr_aql_total ?? ok + ng);
  const rate = total > 0 ? Math.round((ok / total) * 100) : 0;
  const reqs: string[] = Array.isArray(audit.major_requests) ? audit.major_requests.filter(Boolean) : [];
  const participants: any[] = Array.isArray(audit.participants) ? audit.participants : [];

  const openN = ncs.filter((n) => (n.status || "open") === "open").length;
  const partialN = ncs.filter((n) => ["in_progress", "partial"].includes(n.status)).length;
  const doneN = ncs.filter((n) => n.status === "done").length;
  const totN = ncs.length;
  const pct = (n: number) => (totN > 0 ? `${((n / totN) * 100).toFixed(2)}%` : "0%");
  const dateStr = `${fmtDate(audit.audit_date_start)}${
    audit.audit_date_end && audit.audit_date_end !== audit.audit_date_start ? " & " + fmtDate(audit.audit_date_end) : ""
  }`;
  const productSrc = storageUrl(audit.product_image_url);
  const inspectionLabel = audit.paint_inspection_label || audit.supplier_code || audit.supplier_name || "Supplier";

  return (
    <div style={{ width: "100%", overflowX: "auto", paddingBottom: 8 }}>
      <div
        style={{
          width: W,
          height: H,
          position: "relative",
          background: "#FFFFFF",
          color: COLORS.text,
          fontFamily: "Calibri, Arial, sans-serif",
          boxShadow: "0 22px 60px rgba(0,0,0,0.35)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 958,
            height: 68,
            background: `linear-gradient(90deg, ${COLORS.headerDark} 0%, ${COLORS.header} 72%, #9EB4C9 100%)`,
          }}
        />
        <div style={{ position: "absolute", left: 958, top: 0, width: 126, height: 68, background: "#FFFFFF" }} />
        <div style={{ position: "absolute", left: 12, top: 17, color: "#FFFFFF", fontSize: 35, lineHeight: 1 }}>□</div>
        <div style={{ position: "absolute", left: 56, top: 14, color: "#FFFFFF", fontSize: 34, lineHeight: 1.1, letterSpacing: 0 }}>
          Supplier Visit Report
        </div>
        <img src={logo} alt="Hyundai Mobis" style={{ position: "absolute", left: 957, top: 8, width: 118, height: 50, objectFit: "contain" }} />

        <Cell x={0} y={75} w={125} h={36} bg={COLORS.label} bold center size={19}>Description</Cell>
        <Cell x={125} y={75} w={657} h={36} size={16}>{audit.title || "-"}</Cell>
        <Cell x={782} y={75} w={302} h={36} bg={COLORS.label} bold center size={20}>Purpose</Cell>

        <Cell x={0} y={111} w={125} h={36} bg={COLORS.label} bold center size={20}>Supplier</Cell>
        <Cell x={125} y={111} w={179} h={36} size={16}>{audit.supplier_name || "-"}</Cell>
        <Cell x={304} y={111} w={76} h={36} bg={COLORS.label} bold center size={20}>Place</Cell>
        <Cell x={380} y={111} w={167} h={36} size={16}>{audit.place || "-"}</Cell>
        <Cell x={547} y={111} w={73} h={36} bg={COLORS.label} bold center size={20}>Date</Cell>
        <Cell x={620} y={111} w={162} h={36} size={16}>{dateStr}</Cell>
        <Cell x={782} y={111} w={302} h={36} size={16} style={{ flexWrap: "nowrap" }}>
          <Chk on={has(purpose, "T/Out")} label="T/Out" />
          <Chk on={has(purpose, "TFT")} label="TFT" />
          <Chk on={has(purpose, "New Car")} label="New Car" />
        </Cell>

        <Cell x={0} y={147} w={125} h={36} bg={COLORS.label} bold center size={20}>Process</Cell>
        <Cell x={125} y={147} w={422} h={36} size={16} style={{ flexWrap: "nowrap" }}>
          {PROCESS_ITEMS.map((p) => <Chk key={p} on={has(proc, p)} label={p} />)}
        </Cell>
        <Cell x={547} y={147} w={73} h={36} bg={COLORS.label} bold center size={20}>PIC</Cell>
        <Cell x={620} y={147} w={162} h={36} size={16}>{audit.pic_name || "-"}</Cell>
        <Cell x={782} y={147} w={302} h={36} size={16} style={{ flexWrap: "nowrap" }}>
          <Chk on={has(purpose, "CM Validation")} label="CM Validation" />
          <Chk on={has(purpose, "Process Check")} label="Process Check" />
        </Cell>

        <Cell x={0} y={188} w={418} h={35} bg={COLORS.label} bold center size={20}>Schedule</Cell>
        <Cell x={0} y={223} w={418} h={144} size={11} style={{ alignItems: "flex-start", padding: "7px 8px", whiteSpace: "pre-wrap", lineHeight: 1.22 }}>
          {audit.schedule_notes || "-"}
        </Cell>

        <Cell x={418} y={188} w={365} h={35} bg={COLORS.label} bold center size={20}>Participants</Cell>
        <Cell x={418} y={223} w={153} h={29} bg="#FFFFFF" bold center size={16}>Name</Cell>
        <Cell x={571} y={223} w={113} h={29} bg="#FFFFFF" bold center size={16}>Area</Cell>
        <Cell x={684} y={223} w={99} h={29} bg="#FFFFFF" bold center size={16}>Position</Cell>
        {Array.from({ length: 4 }).map((_, i) => {
          const p = participants[i] || {};
          const y = 252 + i * 29;
          return (
            <div key={i}>
              <Cell x={418} y={y} w={153} h={29} center size={14}>{p.name || ""}</Cell>
              <Cell x={571} y={y} w={113} h={29} center size={14}>{p.area || ""}</Cell>
              <Cell x={684} y={y} w={99} h={29} center size={14}>{p.position || p.role || ""}</Cell>
            </div>
          );
        })}

        <div style={{ position: "absolute", left: 793, top: 188, width: 291, height: 179, border: `1px dashed ${COLORS.border}`, boxSizing: "border-box" }}>
          <div style={{ textAlign: "center", fontWeight: 700, textDecoration: "underline", fontSize: 16, marginTop: 7 }}>Main Product</div>
          <div style={{ position: "absolute", left: 18, top: 37, width: 255, height: 92, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {productSrc ? <img src={productSrc} alt="Produto" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} /> : <span style={{ color: "#8A8A8A", fontSize: 12 }}>Sem imagem</span>}
          </div>
          <div style={{ position: "absolute", left: 12, right: 12, bottom: 40, textAlign: "center", fontSize: 15 }}>{audit.product_name || ""}</div>
        </div>

        <div style={{ position: "absolute", left: 0, top: 367, width: 218, height: 39, background: `linear-gradient(90deg, ${COLORS.headerDark}, #9DB5CE)`, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18, borderTopRightRadius: 14, border: `1px solid ${COLORS.border}`, boxSizing: "border-box" }}>
          Main Contents
        </div>

        <Cell x={0} y={406} w={158} h={164} bg={COLORS.label} bold center size={16}>GeneralOpinion<br />(Special Notes)</Cell>
        <Cell x={158} y={406} w={340} h={164} size={16} style={{ alignItems: "flex-start", padding: 0 }}>
          <div style={{ position: "absolute", left: 12, top: 10, fontWeight: 700, display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 12, height: 12, border: "2px solid #111", display: "inline-block", boxSizing: "border-box" }} />
            Paint approval rate:
          </div>
          <table style={{ position: "absolute", left: 25, top: 34, width: 305, height: 113, borderCollapse: "collapse", tableLayout: "fixed", fontSize: 12, textAlign: "center" }}>
            <thead>
              <tr style={{ height: 40 }}>
                <th style={{ borderRight: `1px solid ${COLORS.border}` }}>Inspection</th>
                <th style={{ borderRight: `1px solid ${COLORS.border}` }}>Total<br />Paint</th>
                <th style={{ borderRight: `1px solid ${COLORS.border}` }}>OK</th>
                <th style={{ borderRight: `1px solid ${COLORS.border}` }}>NG</th>
                <th>% Rate</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ height: 37, borderTop: `2px solid ${COLORS.border}` }}>
                <td style={{ borderRight: `1px solid ${COLORS.border}`, fontWeight: 700 }}>{String(inspectionLabel).slice(0, 14)}</td>
                <td style={{ borderRight: `1px solid ${COLORS.border}` }}>{inspectionTotal || "-"}</td>
                <td style={{ borderRight: `1px solid ${COLORS.border}` }}>{inspectionOk || "-"}</td>
                <td style={{ borderRight: `1px solid ${COLORS.border}`, color: COLORS.redText, fontWeight: 700 }}>{inspectionNg || "-"}</td>
                <td style={{ color: COLORS.blueText, fontWeight: 700 }}>{inspectionTotal ? `${inspectionRate}%` : "-"}</td>
              </tr>
              <tr style={{ height: 37, borderTop: `2px solid ${COLORS.border}` }}>
                <td style={{ borderRight: `1px solid ${COLORS.border}`, fontWeight: 700 }}>MBR AQL</td>
                <td style={{ borderRight: `1px solid ${COLORS.border}` }}>{total || "-"}</td>
                <td style={{ borderRight: `1px solid ${COLORS.border}` }}>{ok || "-"}</td>
                <td style={{ borderRight: `1px solid ${COLORS.border}`, color: COLORS.redText, fontWeight: 700 }}>{ng || "-"}</td>
                <td style={{ color: COLORS.blueText, fontWeight: 700 }}>{total > 0 ? `${rate}%` : "-"}</td>
              </tr>
            </tbody>
          </table>
        </Cell>
        <Cell x={498} y={406} w={137} h={164} bg={COLORS.label} bold center size={16}>Major<br /><span style={{ textDecoration: "underline", textDecorationColor: COLORS.redText }}>Request of</span><br />Improvement</Cell>
        {Array.from({ length: 4 }).map((_, i) => (
          <Cell key={i} x={635} y={406 + i * 41} w={449} h={41} size={16}>
            {reqs[i] ? `${i + 1}.  ${reqs[i]}` : ""}
          </Cell>
        ))}

        <Cell x={0} y={590} w={91} h={83} bg="#F3F6F8" center size={16}>Classificat<br />ion</Cell>
        <Cell x={91} y={590} w={407} h={41} bg="#F3F6F8" center size={17}>Problem Status</Cell>
        <Cell x={91} y={631} w={84} h={42} bg="#F3F6F8" center size={16}>Total</Cell>
        <Cell x={175} y={631} w={323} h={42} bg="#F3F6F8" center size={16}>Status</Cell>
        <Cell x={0} y={673} w={91} h={31} center size={16}>Qty</Cell>
        <Cell x={91} y={673} w={84} h={31} center size={16}>{totN}</Cell>
        <Cell x={175} y={673} w={103} h={31} bg={COLORS.open} center size={16} style={{ color: "#FFFFFF" }}>Open</Cell>
        <Cell x={278} y={673} w={115} h={31} bg={COLORS.partial} center size={16} style={{ color: "#FFFFFF" }}>Partial</Cell>
        <Cell x={393} y={673} w={105} h={31} bg={COLORS.done} center size={16} style={{ color: "#FFFFFF" }}>Done</Cell>
        <Cell x={0} y={704} w={91} h={54} center size={16}>%</Cell>
        <Cell x={91} y={704} w={84} h={54} center size={16}>{totN > 0 ? "100%" : "0%"}</Cell>
        <Cell x={175} y={704} w={103} h={54} center size={16}>{pct(openN)}</Cell>
        <Cell x={278} y={704} w={115} h={54} center size={16}>{pct(partialN)}</Cell>
        <Cell x={393} y={704} w={105} h={54} center size={16}>{pct(doneN)}</Cell>

        <Cell x={503} y={590} w={581} h={38} bg="#F3F6F8" center size={17}>Conclusion</Cell>
        <Cell x={503} y={628} w={581} h={130} size={16} style={{ alignItems: "flex-start", padding: "8px 12px", whiteSpace: "pre-wrap", lineHeight: 1.18 }}>
          {audit.conclusion || "-"}
        </Cell>
      </div>
    </div>
  );
}