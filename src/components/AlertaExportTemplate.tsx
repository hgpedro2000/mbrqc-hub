import React from "react";
import logo from "@/assets/hyundai-mobis-logo.png";

const RED = "#8B0000";
const BLUE = "#1F4E79";
const PAGE_W = 1122;
const PAGE_H = 794;
const SIDEBAR_W = 48;
const CONTENT_W = PAGE_W - SIDEBAR_W;

const fmt = (dateStr: string) => {
  if (!dateStr) return "—";
  try { return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR"); } catch { return "—"; }
};

const Field = ({ label, value, style }: { label: string; value: string; style?: React.CSSProperties }) => (
  <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "4px 8px", borderRight: "1px solid #ccc", ...style }}>
    <span style={{ fontSize: "8px", fontWeight: "bold", color: RED, textTransform: "uppercase", marginBottom: "3px" }}>{label}</span>
    <span style={{ fontSize: "11px", color: BLUE, fontWeight: "600" }}>{value || "—"}</span>
  </div>
);

interface Props {
  alerta: any;
  exportedAt: string;
  templateRef: React.RefObject<HTMLDivElement>;
}

const AlertaExportTemplate = ({ alerta: a, exportedAt, templateRef }: Props) => {
  const formatSeq = (seq: number) => `AQ-${String(seq).padStart(5, "0")}`;

  return (
    <div
      ref={templateRef}
      style={{
        position: "fixed", left: "-9999px", top: 0,
        width: PAGE_W, height: PAGE_H,
        fontFamily: "Arial, sans-serif",
        backgroundColor: "#fff",
        display: "flex", flexDirection: "row",
        overflow: "hidden",
      }}
    >
      {/* Main content */}
      <div style={{ width: CONTENT_W, height: PAGE_H, display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{ backgroundColor: RED, color: "white", textAlign: "center", padding: "7px 0", fontWeight: "bold", fontSize: "16px", letterSpacing: "2px", flexShrink: 0 }}>
          {formatSeq(a.sequencial)}
        </div>

        {/* Fields block */}
        <div style={{ border: "1px solid #ccc", borderTop: "none", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "stretch" }}>
            {/* Logo */}
            <div style={{ width: 110, padding: "8px", display: "flex", alignItems: "center", justifyContent: "center", borderRight: "1px solid #ccc", flexShrink: 0 }}>
              <img src={logo} alt="Hyundai Mobis" style={{ width: 95, objectFit: "contain" }} />
            </div>
            {/* Fields */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", borderBottom: "1px solid #ccc" }}>
                <Field label="Modelo do Carro" value={a.modelo} />
                <Field label="Modo de Falha" value={a.modo_falha} />
                <Field label="Linha/Peça" value={a.linha_peca} />
                <Field label="Data Ocorrência" value={fmt(a.data_ocorrencia)} />
                <Field label="Documento N°" value={a.numero_documento || "—"} style={{ borderRight: "none" }} />
              </div>
              <div style={{ display: "flex" }}>
                <Field label="Local Detectado" value={a.local_detectado} />
                <Field label="VIN" value={a.vin} />
                <Field label="Turno" value={a.turno} />
                <Field label="Data Validade" value={fmt(a.data_validade)} />
                <Field label="Responsável" value={a.responsabilidade} style={{ borderRight: "none" }} />
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        <div style={{ display: "flex", border: "1px solid #ccc", borderTop: "none", flexShrink: 0 }}>
          <div style={{ backgroundColor: RED, color: "white", padding: "6px 10px", fontWeight: "bold", fontSize: "10px", display: "flex", alignItems: "center", textTransform: "uppercase", flexShrink: 0 }}>
            Descrição
          </div>
          <div style={{ flex: 1, padding: "6px 12px", fontSize: "13px", color: BLUE, fontWeight: "600", display: "flex", alignItems: "center" }}>
            {a.descricao || "—"}
          </div>
        </div>

        {/* Photos */}
        <div style={{ flex: 1, display: "flex", gap: "8px", padding: "8px", minHeight: 0 }}>
          {/* NG */}
          <div style={{ flex: 1, position: "relative", border: "4px solid #c0392b", borderRadius: "4px", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, backgroundColor: "#c0392b", color: "white", fontWeight: "bold", fontSize: "12px", padding: "4px 12px", zIndex: 2 }}>NG</div>
            {a.foto_ng_url
              ? <img src={a.foto_ng_url} alt="NG" style={{ width: "100%", height: "100%", objectFit: "cover" }} crossOrigin="anonymous" />
              : <div style={{ width: "100%", height: "100%", backgroundColor: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", color: "#999", fontSize: "12px" }}>Sem foto</div>
            }
          </div>
          {/* OK */}
          <div style={{ flex: 1, position: "relative", border: "4px solid #1e8449", borderRadius: "4px", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, backgroundColor: "#1e8449", color: "white", fontWeight: "bold", fontSize: "12px", padding: "4px 12px", zIndex: 2 }}>OK</div>
            {a.foto_ok_url
              ? <img src={a.foto_ok_url} alt="OK" style={{ width: "100%", height: "100%", objectFit: "cover" }} crossOrigin="anonymous" />
              : <div style={{ width: "100%", height: "100%", backgroundColor: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", color: "#999", fontSize: "12px" }}>Sem foto</div>
            }
          </div>
        </div>

        {/* Observações + Brake Point */}
        <div style={{ display: "flex", border: "1px solid #ccc", minHeight: 80, flexShrink: 0 }}>
          <div style={{ flex: 2, display: "flex" }}>
            <div style={{ backgroundColor: RED, color: "white", fontWeight: "bold", fontSize: "10px", padding: "6px 8px", display: "flex", alignItems: "flex-start", textTransform: "uppercase", flexShrink: 0 }}>
              Observações
            </div>
            <div style={{ flex: 1, padding: "6px 10px", fontSize: "11px", color: "#333" }}>
              {a.observacoes || "—"}
            </div>
          </div>
          <div style={{ flex: 1, borderLeft: "1px solid #ccc", display: "flex" }}>
            <div style={{ backgroundColor: RED, color: "white", fontWeight: "bold", fontSize: "10px", padding: "6px 8px", display: "flex", alignItems: "flex-start", textTransform: "uppercase", flexShrink: 0 }}>
              Brake Point
            </div>
            <div style={{ flex: 1, padding: "6px 10px" }}>
              <div style={{ marginBottom: "6px" }}>
                <div style={{ fontSize: "8px", color: RED, fontWeight: "bold", textTransform: "uppercase" }}>SEQ</div>
                <div style={{ fontSize: "11px", color: BLUE, fontWeight: "600" }}>{a.sequencia_bp || "—"}</div>
              </div>
              <div>
                <div style={{ fontSize: "8px", color: RED, fontWeight: "bold", textTransform: "uppercase" }}>VIN</div>
                <div style={{ fontSize: "11px", color: BLUE, fontWeight: "600" }}>{a.vin_bp || "—"}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ backgroundColor: RED, color: "white", textAlign: "center", padding: "6px", fontSize: "10px", flexShrink: 0 }}>
          EMITIDO POR: {a.emitido_por || "—"}&nbsp;&nbsp;&nbsp;EXPORTADO EM: {exportedAt}
        </div>
      </div>

      {/* Right sidebar */}
      <div style={{ width: SIDEBAR_W, backgroundColor: RED, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <div style={{ color: "white", fontWeight: "bold", fontSize: "13px", letterSpacing: "4px", textTransform: "uppercase", writingMode: "vertical-rl", transform: "rotate(180deg)", whiteSpace: "nowrap" }}>
          ALERTA DE QUALIDADE
        </div>
      </div>
    </div>
  );
};

export default AlertaExportTemplate;
