import type { CSSProperties, ReactNode } from "react";
import { SignedAuditImg } from "./SignedAuditImg";

interface Props {
  nc: any;
}

const W = 1084;
const H = 760;

const COLORS = {
  border: "#111111",
  text: "#111111",
  muted: "#9CA3AF",
};

function fmtDate(d?: string | null) {
  if (!d) return "";
  const dt = new Date(d + "T12:00:00");
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  return `${mm}.${dd}`;
}

function Box({
  x, y, w, h, children, bold, center, size = 16, style, padding = "8px 12px",
}: {
  x: number; y: number; w: number; h: number; children?: ReactNode;
  bold?: boolean; center?: boolean; size?: number; style?: CSSProperties; padding?: string;
}) {
  return (
    <div
      style={{
        position: "absolute", left: x, top: y, width: w, height: h,
        boxSizing: "border-box", border: `2px solid ${COLORS.border}`,
        color: COLORS.text, fontSize: size, fontWeight: bold ? 700 : 400,
        display: "flex",
        alignItems: center ? "center" : "flex-start",
        justifyContent: center ? "center" : "flex-start",
        textAlign: center ? "center" : "left",
        padding: center ? "0 8px" : padding,
        overflow: "hidden", lineHeight: 1.3, whiteSpace: "pre-wrap",
        background: "#FFFFFF",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default function ImprovementCaseView({ nc }: Props) {
  const seq = String(nc?.seq_number ?? 1);
  const issue = nc?.issue_category || "";
  const details = nc?.problem_description || "";
  const cm = nc?.counter_measure || nc?.responses?.[0]?.corrective_measure_text || "";
  const targetDate = fmtDate(nc?.due_date);
  const completionDate = fmtDate(nc?.responses?.[0]?.completion_date);
  const obs = nc?.responses?.[0]?.obs || "";
  const beforePath = nc?.before_photo_url;
  const afterPath = nc?.responses?.[0]?.after_photo_url;

  // Layout coordinates
  const HEAD_H = 80;
  const NUM_W = 110;
  const TITLE_W = 490;
  const DATE_LBL_W = 220;
  const DATE_VAL_W = W - NUM_W - TITLE_W - DATE_LBL_W; // 264

  const BA_Y = HEAD_H;
  const BA_H = 44;
  const COL_W = W / 2;

  const BODY_Y = BA_Y + BA_H;
  const BODY_H = 470;

  const FOOT_Y = BODY_Y + BODY_H;
  const FOOT_H = H - FOOT_Y;
  const OBS_LBL_W = 90;
  const CM_LBL_W = 90;

  return (
    <div style={{ width: "100%", overflowX: "auto", paddingBottom: 8 }}>
      <div
        style={{
          width: W, height: H, position: "relative", background: "#FFFFFF",
          color: COLORS.text, fontFamily: "Calibri, Arial, sans-serif",
          boxShadow: "0 22px 60px rgba(0,0,0,0.35)",
        }}
      >
        {/* Header: number, title, target/completion */}
        <Box x={0} y={0} w={NUM_W} h={HEAD_H} center bold size={42}>{seq}</Box>
        <Box x={NUM_W} y={0} w={TITLE_W} h={HEAD_H} center bold size={30}>IMPROVEMENT CASE</Box>
        <Box x={NUM_W + TITLE_W} y={0} w={DATE_LBL_W} h={HEAD_H / 2} bold size={16} center>TARGET DATE</Box>
        <Box x={NUM_W + TITLE_W + DATE_LBL_W} y={0} w={DATE_VAL_W} h={HEAD_H / 2} center size={18}>{targetDate}</Box>
        <Box x={NUM_W + TITLE_W} y={HEAD_H / 2} w={DATE_LBL_W} h={HEAD_H / 2} bold size={16} center>COMPLETION DATE</Box>
        <Box x={NUM_W + TITLE_W + DATE_LBL_W} y={HEAD_H / 2} w={DATE_VAL_W} h={HEAD_H / 2} center size={18}>{completionDate}</Box>

        {/* BEFORE / AFTER */}
        <Box x={0} y={BA_Y} w={COL_W} h={BA_H} center bold size={20}>BEFORE</Box>
        <Box x={COL_W} y={BA_Y} w={COL_W} h={BA_H} center bold size={20}>AFTER</Box>

        {/* BEFORE body: issue/details + photo */}
        <Box x={0} y={BODY_Y} w={COL_W} h={BODY_H} padding="14px 18px" size={15}>
          <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
            <div style={{ marginBottom: 6 }}>
              <b>Issue:</b> {issue}
            </div>
            <div style={{ marginBottom: 10 }}>
              <b>Details:</b> {details}
            </div>
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0 }}>
              {beforePath ? (
                <SignedAuditImg
                  path={beforePath}
                  style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                  fallback={<span style={{ color: COLORS.muted }}>…</span>}
                />
              ) : (
                <span style={{ color: COLORS.muted }}>Sem imagem</span>
              )}
            </div>
          </div>
        </Box>

        {/* AFTER body */}
        <Box x={COL_W} y={BODY_Y} w={COL_W} h={BODY_H} padding="14px 18px" center>
          {afterPath ? (
            <SignedAuditImg
              path={afterPath}
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
              fallback={<span style={{ color: COLORS.muted }}>…</span>}
            />
          ) : (
            <span style={{ color: COLORS.muted }}>Sem imagem</span>
          )}
        </Box>

        {/* Footer: OBS + C/M */}
        <Box x={0} y={FOOT_Y} w={OBS_LBL_W} h={FOOT_H} center bold size={18}>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
            <span>O</span><span>B</span><span>S</span>
          </div>
        </Box>
        <Box x={OBS_LBL_W} y={FOOT_Y} w={COL_W - OBS_LBL_W} h={FOOT_H} size={14}>
          {obs}
        </Box>
        <Box x={COL_W} y={FOOT_Y} w={CM_LBL_W} h={FOOT_H} center bold size={20}>C/M</Box>
        <Box x={COL_W + CM_LBL_W} y={FOOT_Y} w={COL_W - CM_LBL_W} h={FOOT_H} size={14}>
          {cm}
        </Box>
      </div>
    </div>
  );
}
