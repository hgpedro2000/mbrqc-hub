import React from "react";

const RED = "#8B0000";
const BLUE = "#1F4E79";
const PAGE_W = 1122;
const SIDEBAR_W = 48;
const CONTENT_W = PAGE_W - SIDEBAR_W;

const fmt = (dateStr: string) => {
  if (!dateStr) return "—";
  try { return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR"); } catch { return "—"; }
};

interface Props {
  alerta: any;
  inspetores: any[];
  ciencias: any[];
  templateRef: React.RefObject<HTMLDivElement>;
}

const AlertaAssinaturasExportTemplate = ({ alerta: a, inspetores, ciencias, templateRef }: Props) => {
  const formatSeq = (seq: number) => `AQ-${String(seq).padStart(5, "0")}`;

  const thStyle: React.CSSProperties = {
    padding: "6px 10px", textAlign: "left", color: "white",
    fontWeight: "bold", fontSize: "11px", backgroundColor: RED,
  };
  const tdStyle: React.CSSProperties = {
    padding: "6px 10px", fontSize: "11px", borderBottom: "1px solid #ddd",
  };

  return (
    <div
      ref={templateRef}
      style={{
        position: "fixed", left: "-9999px", top: 0,
        width: PAGE_W, minHeight: 794,
        fontFamily: "Arial, sans-serif",
        backgroundColor: "#fff",
        display: "flex", flexDirection: "row",
        overflow: "hidden",
      }}
    >
      <div style={{ width: CONTENT_W, display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{ backgroundColor: RED, color: "white", textAlign: "center", padding: "7px 0", fontWeight: "bold", fontSize: "16px", letterSpacing: "2px", flexShrink: 0 }}>
          {formatSeq(a.sequencial)}
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: "16px 20px" }}>
          <h3 style={{ fontWeight: "bold", fontSize: "14px", marginBottom: "12px", color: "#222" }}>
            Status de Ciência dos Inspetores
          </h3>

          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "24px" }}>
            <thead>
              <tr>
                <th style={thStyle}>Nome</th>
                <th style={thStyle}>Cargo</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Data/Hora</th>
                <th style={thStyle}>Método</th>
              </tr>
            </thead>
            <tbody>
              {inspetores.map((ins: any) => {
                const ciencia = ciencias.find((c: any) => c.inspetor_id === ins.id);
                return (
                  <tr key={ins.id}>
                    <td style={tdStyle}>{ins.full_name}</td>
                    <td style={{ ...tdStyle, color: "#666" }}>{ins.cargo || "—"}</td>
                    <td style={{ ...tdStyle, color: ciencia ? "#1e8449" : "#e67e22", fontWeight: "bold" }}>
                      {ciencia ? "Ciente ✓" : "Pendente"}
                    </td>
                    <td style={tdStyle}>
                      {ciencia ? new Date(ciencia.created_at).toLocaleString("pt-BR") : "—"}
                    </td>
                    <td style={tdStyle}>
                      {ciencia ? (ciencia.metodo === "qr_lider" ? "QR Líder" : "App Próprio") : "—"}
                    </td>
                  </tr>
                );
              })}
              {inspetores.length === 0 && (
                <tr><td colSpan={5} style={{ ...tdStyle, textAlign: "center", color: "#999" }}>Nenhum inspetor habilitado</td></tr>
              )}
            </tbody>
          </table>

          {ciencias.length > 0 && (
            <>
              <h3 style={{ fontWeight: "bold", fontSize: "14px", marginBottom: "12px", color: "#222" }}>
                Registros de Ciência ({ciencias.length})
              </h3>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Inspetor</th>
                    <th style={thStyle}>Data/Hora</th>
                    <th style={thStyle}>Método</th>
                    <th style={thStyle}>Termo</th>
                  </tr>
                </thead>
                <tbody>
                  {ciencias.map((c: any) => (
                    <tr key={c.id}>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: "600" }}>{c.profiles?.full_name || "—"}</div>
                        {c.profiles?.cargo && <div style={{ fontSize: "10px", color: "#666" }}>{c.profiles.cargo}</div>}
                      </td>
                      <td style={tdStyle}>{new Date(c.created_at).toLocaleString("pt-BR")}</td>
                      <td style={tdStyle}>{c.metodo === "qr_lider" ? "QR Líder" : "App Próprio"}</td>
                      <td style={{ ...tdStyle, color: "#666" }}>{c.versao_termo || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ backgroundColor: "#2c2c2c", color: "white", padding: "6px 16px", fontSize: "10px", display: "flex", justifyContent: "space-between", flexShrink: 0 }}>
          <span>EMITIDO POR: {a.emitido_por || "—"}&nbsp;&nbsp;&nbsp;DATA: {fmt(a.data_ocorrencia)}</span>
          <span>{formatSeq(a.sequencial)}</span>
        </div>
      </div>

      {/* Right sidebar */}
      <div style={{ width: SIDEBAR_W, backgroundColor: RED, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <div style={{ color: "white", fontWeight: "bold", fontSize: "13px", letterSpacing: "4px", textTransform: "uppercase", transform: "rotate(90deg)", whiteSpace: "nowrap" }}>
          ALERTA DE QUALIDADE
        </div>
      </div>
    </div>
  );
};

export default AlertaAssinaturasExportTemplate;
