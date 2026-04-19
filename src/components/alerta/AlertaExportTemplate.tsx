import React from "react";

interface Props {
  alerta: any;
  innerRef?: React.RefObject<HTMLDivElement>;
}

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—";

const formatSeq = (seq: number) => `AQ-${String(seq).padStart(5, "0")}`;

/**
 * Hidden A4 landscape template for exporting Alerta de Qualidade.
 * Renders off-screen at fixed pixel dimensions (1123x794 ~ A4 landscape @ 96dpi)
 * for predictable html2canvas capture. Photos fill all available height
 * between the fields table and the footer.
 */
export const AlertaExportTemplate: React.FC<Props> = ({ alerta, innerRef }) => {
  const a = alerta || {};
  const RED = "#9b1b1b";
  const GREEN = "#1e7e34";
  const LABEL = "#9b1b1b";
  const VALUE = "#000000";
  const BORDER = "#9ca3af";

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
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    display: "block",
    marginBottom: 4,
    lineHeight: 1.1,
  };
  const valueStyle: React.CSSProperties = {
    color: VALUE,
    fontSize: 12,
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
        width: 1123,
        height: 794,
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
          width: 50,
          height: 794,
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
            fontSize: 22,
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
          padding: "12px 64px 0 16px",
          height: 794,
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
            padding: "6px 12px",
            fontWeight: 800,
            fontSize: 14,
            letterSpacing: 1,
            textAlign: "center",
            marginBottom: 8,
            flex: "0 0 auto",
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
            marginBottom: 8,
            flex: "0 0 auto",
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
              <td style={cellStyle}></td>
            </tr>
          </tbody>
        </table>

        {/* Photos row — flex:1 to fill remaining height */}
        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            marginBottom: 8,
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

        {/* Observações — compact, above footer */}
        <div style={{ flex: "0 0 auto", marginBottom: 6, maxHeight: 60, overflow: "hidden" }}>
          <span
            style={{
              color: RED,
              fontWeight: 800,
              fontSize: 11,
              textDecoration: "underline",
              textDecorationColor: RED,
            }}
          >
            Observações:
          </span>
          <span
            style={{
              fontSize: 11,
              color: "#000",
              marginLeft: 6,
              lineHeight: 1.3,
              whiteSpace: "pre-wrap",
            }}
          >
            {a.observacoes || "—"}
          </span>
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
            letterSpacing: 0.5,
            gap: 6,
            flex: "0 0 auto",
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

// ------- Page 2 — Signatures / Ciências -------

interface SigProps {
  alerta: any;
  inspetores: any[]; // {id, full_name, cargo}
  ciencias: any[]; // {id, inspetor_id, created_at, metodo, versao_termo, profiles:{full_name, cargo}}
  innerRef?: React.RefObject<HTMLDivElement>;
}

export const AlertaSignaturesTemplate: React.FC<SigProps> = ({
  alerta,
  inspetores,
  ciencias,
  innerRef,
}) => {
  const a = alerta || {};
  const RED = "#9b1b1b";
  const BORDER = "#9ca3af";

  const cell: React.CSSProperties = {
    border: `1px solid ${BORDER}`,
    padding: "5px 8px",
    fontSize: 10,
    verticalAlign: "top",
    color: "#000",
  };
  const headerCell: React.CSSProperties = {
    ...cell,
    background: RED,
    color: "#fff",
    fontWeight: 700,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  };

  const sortedCiencias = [...(ciencias || [])].sort(
    (x: any, y: any) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime()
  );

  return (
    <div
      ref={innerRef}
      style={{
        position: "absolute",
        left: -10000,
        top: 900,
        width: 1123,
        height: 794,
        background: "#ffffff",
        fontFamily: "Arial, Helvetica, sans-serif",
        color: "#000",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* Right red band */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 50,
          height: 794,
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
            fontSize: 22,
            letterSpacing: 4,
            transform: "rotate(-90deg)",
            whiteSpace: "nowrap",
          }}
        >
          ALERTA DE QUALIDADE
        </div>
      </div>

      <div
        style={{
          padding: "16px 64px 0 16px",
          height: 794,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            background: RED,
            color: "#fff",
            padding: "6px 12px",
            fontWeight: 800,
            fontSize: 14,
            letterSpacing: 1,
            textAlign: "center",
            marginBottom: 12,
          }}
        >
          {formatSeq(a.sequencial || 0)} — Status de Ciência
        </div>

        <h2 style={{ fontSize: 14, fontWeight: 800, margin: "0 0 6px", color: "#000" }}>
          Status de Ciência dos Inspetores
        </h2>

        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}>
          {/* Inspector status table */}
          <div style={{ flex: "0 0 auto", maxHeight: 280, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "32%" }} />
                <col style={{ width: "23%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "13%" }} />
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
                {(inspetores || []).map((ins: any) => {
                  const c = (ciencias || []).find((x: any) => x.inspetor_id === ins.id);
                  const dt = c ? new Date(c.created_at) : null;
                  return (
                    <tr key={ins.id}>
                      <td style={cell}>{ins.full_name}</td>
                      <td style={cell}>{ins.cargo || "—"}</td>
                      <td style={{ ...cell, fontWeight: 700, color: c ? "#1e7e34" : "#9b1b1b" }}>
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
                {(!inspetores || inspetores.length === 0) && (
                  <tr>
                    <td style={{ ...cell, textAlign: "center" }} colSpan={5}>
                      Nenhum inspetor habilitado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Ciencias log */}
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <h3 style={{ fontSize: 12, fontWeight: 800, margin: "0 0 4px", color: "#000" }}>
              Registros de Ciência ({sortedCiencias.length})
            </h3>
            <div style={{ flex: 1, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "38%" }} />
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "20%" }} />
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
                        <td style={cell}>
                          <div style={{ fontWeight: 600 }}>{c.profiles?.full_name || "—"}</div>
                          {c.profiles?.cargo && (
                            <div style={{ fontSize: 9, color: "#666" }}>{c.profiles.cargo}</div>
                          )}
                        </td>
                        <td style={cell}>
                          {dt.toLocaleDateString("pt-BR")} {dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td style={cell}>{c.metodo === "qr_lider" ? "QR Líder" : "App Próprio"}</td>
                        <td style={{ ...cell, fontFamily: "monospace", fontSize: 9 }}>{c.versao_termo || "—"}</td>
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
          </div>
        </div>

        {/* Footer (same as page 1) */}
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
            letterSpacing: 0.5,
            gap: 6,
            marginTop: 6,
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
