import React from "react";
import logoMobis from "@/assets/hyundai-mobis-logo.png";

interface Props {
  alerta: any;
  innerRef?: React.RefObject<HTMLDivElement>;
}

/** Robust date parser supporting ISO (YYYY-MM-DD[THH:mm...]) and DD/MM/YYYY */
function parseDateSafe(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const s = String(value).trim();
  if (!s) return null;

  // ISO date-only
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const d = new Date(+iso[1], +iso[2] - 1, +iso[3], 12, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    let y = +dmy[3]; if (y < 100) y += 2000;
    const d = new Date(y, +dmy[2] - 1, +dmy[1], 12, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }
  // ISO with time / fallback
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

const fmtDate = (d: string | null | undefined) => {
  const dt = parseDateSafe(d);
  return dt ? dt.toLocaleDateString("pt-BR") : "—";
};

const fmtDateTime = (d: string | null | undefined) => {
  const dt = parseDateSafe(d);
  if (!dt) return "—";
  return `${dt.toLocaleDateString("pt-BR")} – ${dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
};

const formatSeq = (seq: number) => `AQ-${String(seq).padStart(5, "0")}`;

// A4 LANDSCAPE @ ~96dpi
export const PAGE_W = 1123;
export const PAGE_H = 794;

const RED = "#8B0000";
const BLUE = "#1F4E79";
const GREEN = "#1e8449";
const BORDER = "#9ca3af";

/**
 * A4 LANDSCAPE template — Page 1 (Alerta).
 */
export const AlertaExportTemplate: React.FC<Props> = ({ alerta, innerRef }) => {
  const a = alerta || {};

  const cellLabel: React.CSSProperties = {
    color: RED,
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    display: "block",
    marginBottom: 2,
    lineHeight: 1.1,
  };
  const cellValue: React.CSSProperties = {
    color: BLUE,
    fontSize: 11,
    fontWeight: 600,
    wordBreak: "break-word",
    lineHeight: 1.15,
    display: "block",
  };
  const tdStyle: React.CSSProperties = {
    border: `1px solid ${BORDER}`,
    padding: "5px 8px",
    verticalAlign: "top",
    background: "#fff",
  };

  const issuedAt = a.created_at || a.data_ocorrencia;

  return (
    <div
      ref={innerRef}
      style={{
        position: "absolute",
        left: -10000,
        top: 0,
        width: PAGE_W,
        height: PAGE_H,
        background: "#fff",
        fontFamily: "Arial, Helvetica, sans-serif",
        color: "#000",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* Right vertical red band */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 38,
          height: PAGE_H,
          background: RED,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            color: "#fff",
            fontWeight: 800,
            fontSize: 18,
            letterSpacing: 6,
            transform: "rotate(-90deg)",
            whiteSpace: "nowrap",
          }}
        >
          ALERTA DE QUALIDADE
        </div>
      </div>

      {/* Inner area, leaving room for the red band */}
      <div
        style={{
          padding: "0 38px 0 0",
          height: PAGE_H,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Top red header */}
        <div
          style={{
            background: RED,
            color: "#fff",
            padding: "8px 12px",
            fontWeight: 800,
            fontSize: 20,
            textAlign: "center",
            letterSpacing: 1,
            flex: "0 0 auto",
          }}
        >
          {formatSeq(a.sequencial || 0)}
        </div>

        {/* Outer table */}
        <div style={{ padding: "8px 10px 6px", flex: "0 0 auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "12%" }} />
              <col style={{ width: "17.6%" }} />
              <col style={{ width: "17.6%" }} />
              <col style={{ width: "17.6%" }} />
              <col style={{ width: "17.6%" }} />
              <col style={{ width: "17.6%" }} />
            </colgroup>
            <tbody>
              {/* Row 1 — logo + 5 fields */}
              <tr>
                <td rowSpan={2} style={{ ...tdStyle, textAlign: "center", verticalAlign: "middle", padding: 6 }}>
                  <img
                    src={logoMobis}
                    alt="Hyundai Mobis"
                    crossOrigin="anonymous"
                    style={{ maxWidth: "100%", maxHeight: 56, objectFit: "contain", display: "inline-block" }}
                  />
                </td>
                <td style={tdStyle}>
                  <span style={cellLabel}>MODELO DO CARRO</span>
                  <span style={cellValue}>{a.modelo || "—"}</span>
                </td>
                <td style={tdStyle}>
                  <span style={cellLabel}>MODO DE FALHA</span>
                  <span style={cellValue}>{a.modo_falha || "—"}</span>
                </td>
                <td style={tdStyle}>
                  <span style={cellLabel}>LINHA/PEÇA</span>
                  <span style={cellValue}>{a.linha_peca || "—"}</span>
                </td>
                <td style={tdStyle}>
                  <span style={cellLabel}>DATA OCORRÊNCIA</span>
                  <span style={cellValue}>{fmtDate(a.data_ocorrencia)}</span>
                </td>
                <td style={tdStyle}>
                  <span style={cellLabel}>DOCUMENTO N°</span>
                  <span style={cellValue}>{a.etiqueta_fora_spec || a.documento || "—"}</span>
                </td>
              </tr>
              {/* Row 2 */}
              <tr>
                <td style={tdStyle}>
                  <span style={cellLabel}>LOCAL DETECTADO</span>
                  <span style={cellValue}>{a.local_detectado || "—"}</span>
                </td>
                <td style={tdStyle}>
                  <span style={cellLabel}>VIN</span>
                  <span style={cellValue}>{a.vin || "—"}</span>
                </td>
                <td style={tdStyle}>
                  <span style={cellLabel}>TURNO</span>
                  <span style={cellValue}>{a.turno || "—"}</span>
                </td>
                <td style={tdStyle}>
                  <span style={cellLabel}>DATA VALIDADE</span>
                  <span style={cellValue}>{fmtDate(a.data_validade)}</span>
                </td>
                <td style={tdStyle}>
                  <span style={cellLabel}>RESPONSÁVEL</span>
                  <span style={cellValue}>{a.responsabilidade || "—"}</span>
                </td>
              </tr>
              {/* DESCRIÇÃO row */}
              <tr>
                <td
                  style={{
                    ...tdStyle,
                    background: RED,
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: 12,
                    textAlign: "left",
                    verticalAlign: "middle",
                    letterSpacing: 0.3,
                  }}
                >
                  DESCRIÇÃO
                </td>
                <td colSpan={5} style={{ ...tdStyle, padding: "6px 10px" }}>
                  <span style={{ color: BLUE, fontSize: 14, fontWeight: 600, lineHeight: 1.2 }}>
                    {a.descricao || "—"}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Photos NG/OK */}
        <div
          style={{
            display: "flex",
            gap: 10,
            padding: "0 10px",
            flex: "1 1 auto",
            minHeight: 0,
          }}
        >
          {/* NG */}
          <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div
              style={{
                position: "absolute",
                top: 6,
                left: 6,
                background: RED,
                color: "#fff",
                fontWeight: 800,
                fontSize: 14,
                padding: "4px 14px",
                zIndex: 2,
                borderRadius: 2,
              }}
            >
              NG
            </div>
            <div
              style={{
                border: `5px solid ${RED}`,
                width: "100%",
                flex: "1 1 auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#f8f8f8",
                overflow: "hidden",
                minHeight: 0,
              }}
            >
              {a.foto_ng_url ? (
                <img
                  src={a.foto_ng_url}
                  crossOrigin="anonymous"
                  alt="NG"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <span style={{ color: "#999", fontSize: 12 }}>Sem foto NG</span>
              )}
            </div>
          </div>
          {/* OK */}
          <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div
              style={{
                position: "absolute",
                top: 6,
                left: 6,
                background: GREEN,
                color: "#fff",
                fontWeight: 800,
                fontSize: 14,
                padding: "4px 14px",
                zIndex: 2,
                borderRadius: 2,
              }}
            >
              OK
            </div>
            <div
              style={{
                border: `5px solid ${GREEN}`,
                width: "100%",
                flex: "1 1 auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#f8f8f8",
                overflow: "hidden",
                minHeight: 0,
              }}
            >
              {a.foto_ok_url ? (
                <img
                  src={a.foto_ok_url}
                  crossOrigin="anonymous"
                  alt="OK"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <span style={{ color: "#999", fontSize: 12 }}>Sem foto OK</span>
              )}
            </div>
          </div>
        </div>

        {/* OBSERVAÇÕES + BRAKE POINT split */}
        <div style={{ padding: "8px 10px 0", flex: "0 0 auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "12%" }} />
              <col style={{ width: "48%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
            </colgroup>
            <tbody>
              <tr>
                <td
                  style={{
                    ...tdStyle,
                    border: `2px solid ${RED}`,
                    background: RED,
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: 11,
                    textAlign: "left",
                    verticalAlign: "top",
                    padding: "6px 10px",
                  }}
                >
                  OBSERVAÇÕES
                </td>
                <td
                  style={{
                    ...tdStyle,
                    border: `2px solid ${RED}`,
                    color: BLUE,
                    fontSize: 11,
                    fontWeight: 500,
                    padding: "6px 10px",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {a.observacoes || ""}
                </td>
                <td
                  style={{
                    ...tdStyle,
                    border: `2px solid ${RED}`,
                    background: RED,
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: 11,
                    textAlign: "left",
                    verticalAlign: "top",
                    padding: "6px 10px",
                  }}
                >
                  BRAKE POINT
                </td>
                <td style={{ ...tdStyle, border: `2px solid ${RED}`, padding: "5px 8px" }}>
                  <span style={{ ...cellLabel, fontSize: 10 }}>SEQ</span>
                  <span style={{ ...cellValue, fontSize: 12 }}>{a.sequencia_bp || "—"}</span>
                </td>
                <td style={{ ...tdStyle, border: `2px solid ${RED}`, padding: "5px 8px" }}>
                  <span style={{ ...cellLabel, fontSize: 10 }}>VIN</span>
                  <span style={{ ...cellValue, fontSize: 12 }}>{a.vin_bp || "—"}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* EMITIDO POR strip */}
        <div
          style={{
            background: RED,
            color: "#fff",
            padding: "6px 14px",
            textAlign: "center",
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: 0.4,
            margin: "6px 10px 8px",
            flex: "0 0 auto",
          }}
        >
          EMITIDO POR: {a.emitido_por || "—"}&nbsp;&nbsp;&nbsp;&nbsp;EM: {fmtDateTime(issuedAt)}
        </div>
      </div>
    </div>
  );
};

// ===================== Page 2 — Signatures =====================

interface SigProps {
  alerta: any;
  inspetores: any[];
  ciencias: any[];
  innerRef?: React.RefObject<HTMLDivElement>;
}

export const AlertaSignaturesTemplate: React.FC<SigProps> = ({
  alerta,
  inspetores,
  ciencias,
  innerRef,
}) => {
  const a = alerta || {};

  const cell: React.CSSProperties = {
    border: `1px solid ${BORDER}`,
    padding: "6px 10px",
    fontSize: 11,
    verticalAlign: "middle",
    color: "#000",
  };
  const headerCell: React.CSSProperties = {
    ...cell,
    background: RED,
    color: "#fff",
    fontWeight: 700,
    fontSize: 11,
    textTransform: "none",
    letterSpacing: 0.2,
    textAlign: "left",
  };

  const sortedCiencias = [...(ciencias || [])].sort(
    (x: any, y: any) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime()
  );

  const issuedAt = a.created_at || a.data_ocorrencia;
  const insList = inspetores || [];

  return (
    <div
      ref={innerRef}
      style={{
        position: "absolute",
        left: -10000,
        top: 1300,
        width: PAGE_W,
        height: PAGE_H,
        background: "#fff",
        fontFamily: "Arial, Helvetica, sans-serif",
        color: "#000",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* Right vertical red band */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 38,
          height: PAGE_H,
          background: RED,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            color: "#fff",
            fontWeight: 800,
            fontSize: 18,
            letterSpacing: 6,
            transform: "rotate(-90deg)",
            whiteSpace: "nowrap",
          }}
        >
          ALERTA DE QUALIDADE
        </div>
      </div>

      <div
        style={{
          padding: "0 38px 0 0",
          height: PAGE_H,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Top red header */}
        <div
          style={{
            background: RED,
            color: "#fff",
            padding: "8px 12px",
            fontWeight: 800,
            fontSize: 20,
            textAlign: "center",
            letterSpacing: 1,
            flex: "0 0 auto",
          }}
        >
          {formatSeq(a.sequencial || 0)}
        </div>

        {/* TABLE 1 - Status */}
        <div style={{ padding: "12px 14px 6px", flex: "1 1 50%", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, margin: "0 0 6px", color: "#000" }}>
            Status de Ciência dos Inspetores
          </h2>

          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", height: "100%" }}>
            <colgroup>
              <col style={{ width: "26%" }} />
              <col style={{ width: "24%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "16%" }} />
            </colgroup>
            <thead>
              <tr>
                <th style={headerCell}>Nome</th>
                <th style={headerCell}>Cargo</th>
                <th style={headerCell}>Status</th>
                <th style={headerCell}>Data/Hora</th>
                <th style={headerCell}>Método</th>
              </tr>
            </thead>
            <tbody>
              {insList.map((ins: any) => {
                const c = (ciencias || []).find((x: any) => x.inspetor_id === ins.id);
                const dt = c ? new Date(c.created_at) : null;
                return (
                  <tr key={ins.id}>
                    <td style={cell}>{ins.full_name}</td>
                    <td style={cell}>{ins.cargo || "—"}</td>
                    <td style={{ ...cell, fontWeight: 700, color: c ? BLUE : "#d35400" }}>
                      {c ? "Ciente ✓" : "Pendente"}
                    </td>
                    <td style={cell}>
                      {dt
                        ? `${dt.toLocaleDateString("pt-BR")} ${dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                        : "—"}
                    </td>
                    <td style={cell}>{c ? (c.metodo === "qr_lider" ? "QR Líder" : "App Próprio") : "—"}</td>
                  </tr>
                );
              })}
              {insList.length === 0 && (
                <tr>
                  <td style={{ ...cell, textAlign: "center" }} colSpan={5}>
                    Nenhum inspetor habilitado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* TABLE 2 - Records */}
        <div style={{ padding: "6px 14px 0", flex: "1 1 50%", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <h3 style={{ fontSize: 13, fontWeight: 800, margin: "0 0 6px", color: "#000" }}>
            Registros de Ciência ({sortedCiencias.length})
          </h3>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", height: "100%" }}>
            <colgroup>
              <col style={{ width: "32%" }} />
              <col style={{ width: "24%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "24%" }} />
            </colgroup>
            <thead>
              <tr>
                <th style={headerCell}>Inspetor</th>
                <th style={headerCell}>Data/Hora</th>
                <th style={headerCell}>Método</th>
                <th style={headerCell}>Termo</th>
              </tr>
            </thead>
            <tbody>
              {sortedCiencias.map((c: any) => {
                const dt = new Date(c.created_at);
                return (
                  <tr key={c.id}>
                    <td style={cell}>{c.profiles?.full_name || "—"}</td>
                    <td style={cell}>
                      {dt.toLocaleDateString("pt-BR")} {dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td style={cell}>{c.metodo === "qr_lider" ? "QR Líder" : "App Próprio"}</td>
                    <td style={{ ...cell, fontFamily: "monospace", fontSize: 10 }}>{c.versao_termo || "—"}</td>
                  </tr>
                );
              })}
              {sortedCiencias.length === 0 && (
                <tr>
                  <td style={{ ...cell, textAlign: "center" }} colSpan={4}>
                    Nenhuma ciência registrada
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div
          style={{
            background: RED,
            color: "#fff",
            padding: "8px 14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.4,
            margin: "8px 10px",
            flex: "0 0 auto",
          }}
        >
          <span>EMITIDO POR: {a.emitido_por || "—"}&nbsp;&nbsp;&nbsp;&nbsp;DATA: {fmtDate(issuedAt)}</span>
          <span>{formatSeq(a.sequencial || 0)}</span>
        </div>
      </div>
    </div>
  );
};

export default AlertaExportTemplate;
