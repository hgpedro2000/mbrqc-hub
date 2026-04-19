import React from "react";

interface Props {
  alerta: any;
  innerRef?: React.RefObject<HTMLDivElement>;
}

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—";

const formatSeq = (seq: number) => `AQ-${String(seq).padStart(5, "0")}`;

/**
 * Hidden A4 portrait template for exporting Alerta de Qualidade.
 * Renders off-screen at fixed pixel dimensions (794x1123 ~ A4 @ 96dpi)
 * for predictable html2canvas capture.
 */
export const AlertaExportTemplate: React.FC<Props> = ({ alerta, innerRef }) => {
  const a = alerta || {};
  const RED = "#9b1b1b";
  const GREEN = "#1e7e34";
  const LABEL = "#9b1b1b";
  const VALUE = "#000000";
  const BORDER = "#9ca3af";

  // Map fields per spec
  const row1 = [
    { label: "MODELO DO CARRO", value: a.modelo },
    { label: "DESCRIÇÃO", value: a.descricao },
    { label: "MODO DE FALHA", value: a.modo_falha },
    { label: "LINHA/PEÇA", value: a.linha_peca },
    { label: "ETIQUETA FORA DE SPEC", value: a.etiqueta_fora_spec || "—" },
  ];
  const row2 = [
    { label: "LOCAL DETECTADO", value: a.local_detectado },
    { label: "RESPONSÁVEL", value: a.responsabilidade },
    { label: "VIN", value: a.vin },
    { label: "DATA OCORRÊNCIA", value: fmtDate(a.data_ocorrencia) },
    { label: "DATA VALIDADE", value: fmtDate(a.data_validade) },
    { label: "TURNO", value: a.turno },
  ];

  const cellStyle: React.CSSProperties = {
    border: `1px solid ${BORDER}`,
    padding: "6px 8px",
    verticalAlign: "top",
    background: "#ffffff",
  };
  const labelStyle: React.CSSProperties = {
    color: LABEL,
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    display: "block",
    marginBottom: 4,
    lineHeight: 1.1,
  };
  const valueStyle: React.CSSProperties = {
    color: VALUE,
    fontSize: 11,
    fontWeight: 500,
    wordBreak: "break-word",
    lineHeight: 1.2,
  };

  return (
    <div
      ref={innerRef}
      style={{
        position: "absolute",
        left: -10000,
        top: 0,
        width: 794,
        height: 1123,
        background: "#ffffff",
        fontFamily: "Arial, Helvetica, sans-serif",
        color: "#000",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* Right red vertical band */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 60,
          height: 1123,
          background: RED,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            color: "#fff",
            fontWeight: 900,
            fontSize: 28,
            letterSpacing: 4,
            transform: "rotate(-90deg)",
            whiteSpace: "nowrap",
          }}
        >
          ALERTA DE QUALIDADE
        </div>
      </div>

      {/* Main content area (avoids the red band) */}
      <div
        style={{
          padding: "20px 80px 20px 24px",
          height: 1123,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Title bar */}
        <div
          style={{
            background: RED,
            color: "#fff",
            padding: "8px 12px",
            fontWeight: 800,
            fontSize: 14,
            letterSpacing: 1,
            textAlign: "center",
            marginBottom: 12,
          }}
        >
          {formatSeq(a.sequencial || 0)}
        </div>

        {/* Fields table */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "fixed",
            marginBottom: 14,
          }}
        >
          <tbody>
            <tr>
              {row1.map((f, i) => (
                <td key={i} style={cellStyle}>
                  <span style={labelStyle}>{f.label}</span>
                  <span style={valueStyle}>{f.value || "—"}</span>
                </td>
              ))}
            </tr>
            <tr>
              {row2.map((f, i) => (
                <td key={i} style={cellStyle}>
                  <span style={labelStyle}>{f.label}</span>
                  <span style={valueStyle}>{f.value || "—"}</span>
                </td>
              ))}
              {/* fill the 5th column to keep alignment with row1 */}
              <td style={cellStyle}></td>
            </tr>
          </tbody>
        </table>

        {/* Photos row */}
        <div
          style={{
            display: "flex",
            gap: 16,
            justifyContent: "center",
            marginBottom: 14,
          }}
        >
          {/* NG */}
          <div style={{ flex: 1, position: "relative" }}>
            <div
              style={{
                position: "absolute",
                top: 6,
                left: 6,
                background: RED,
                color: "#fff",
                fontWeight: 800,
                fontSize: 12,
                padding: "3px 10px",
                zIndex: 2,
                borderRadius: 2,
              }}
            >
              NG
            </div>
            <div
              style={{
                border: `4px solid ${RED}`,
                width: "100%",
                height: 280,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#f8f8f8",
                overflow: "hidden",
              }}
            >
              {a.foto_ng_url ? (
                <img
                  src={a.foto_ng_url}
                  crossOrigin="anonymous"
                  alt="NG"
                  style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                />
              ) : (
                <span style={{ color: "#999", fontSize: 12 }}>Sem foto NG</span>
              )}
            </div>
          </div>
          {/* OK */}
          <div style={{ flex: 1, position: "relative" }}>
            <div
              style={{
                position: "absolute",
                top: 6,
                left: 6,
                background: GREEN,
                color: "#fff",
                fontWeight: 800,
                fontSize: 12,
                padding: "3px 10px",
                zIndex: 2,
                borderRadius: 2,
              }}
            >
              OK
            </div>
            <div
              style={{
                border: `4px solid ${GREEN}`,
                width: "100%",
                height: 280,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#f8f8f8",
                overflow: "hidden",
              }}
            >
              {a.foto_ok_url ? (
                <img
                  src={a.foto_ok_url}
                  crossOrigin="anonymous"
                  alt="OK"
                  style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                />
              ) : (
                <span style={{ color: "#999", fontSize: 12 }}>Sem foto OK</span>
              )}
            </div>
          </div>
        </div>

        {/* Observações */}
        <div style={{ flex: 1, marginBottom: 14 }}>
          <span
            style={{
              color: RED,
              fontWeight: 800,
              fontSize: 12,
              textDecoration: "underline",
              textDecorationColor: RED,
            }}
          >
            Observações:
          </span>
          <p
            style={{
              fontSize: 11,
              color: "#000",
              marginTop: 6,
              lineHeight: 1.4,
              whiteSpace: "pre-wrap",
            }}
          >
            {a.observacoes || "—"}
          </p>
        </div>

        {/* Footer */}
        <div
          style={{
            background: RED,
            color: "#fff",
            padding: "10px 14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.5,
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          <span>BRAKE POINT</span>
          <span>SEQUÊNCIA: {a.sequencia_bp || "—"}</span>
          <span>VIN: {a.vin_bp || a.vin || "—"}</span>
          <span>EMITIDO POR: {a.emitido_por || "—"}</span>
          <span>DATA: {fmtDate(a.data_ocorrencia)}</span>
        </div>
      </div>
    </div>
  );
};

export default AlertaExportTemplate;
