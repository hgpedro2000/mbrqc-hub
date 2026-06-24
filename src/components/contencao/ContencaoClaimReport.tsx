import { forwardRef, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatHoras, aggregateRegistrosDrawer, ContencaoRegistro } from "@/lib/contencao";
import logo from "@/assets/hyundai-mobis-logo.png";

interface Props {
  contencao: any;
  registros: ContencaoRegistro[];
}

const BUCKET = "containment-photos";

const useSignedUrls = (paths: string[]) => {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    if (!paths.length) { setUrls([]); return; }
    Promise.all(
      paths.map((p) =>
        supabase.storage.from(BUCKET).createSignedUrl(p, 60 * 60)
          .then(({ data }) => data?.signedUrl || "")
      ),
    ).then((u) => { if (active) setUrls(u.filter(Boolean)); });
    return () => { active = false; };
  }, [paths.join("|")]);
  return urls;
};

const fmtDate = (s?: string | null) =>
  s ? new Date(`${s.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";

const fmtDateTime = (s?: string | null) =>
  s ? new Date(s).toLocaleString("pt-BR") : "—";

/**
 * Visual A4-styled claim report. Rendered identically on-screen and in the
 * exported PDF (html2canvas captures this exact DOM tree).
 * Distinct from the Incoming Apontamento export: focus on horas faturáveis,
 * histórico turno a turno e responsabilização do fornecedor.
 */
const ContencaoClaimReport = forwardRef<HTMLDivElement, Props>(
  ({ contencao, registros }, ref) => {
    const totais = aggregateRegistrosDrawer(registros as any[]);
    const horasTotal = Number(contencao?.total_horas ?? totais.horas) || 0;

    const fotosProblema: string[] = Array.isArray(contencao?.fotos_problema) ? contencao.fotos_problema : [];
    const fotosMark: string[] = Array.isArray(contencao?.mark_check_fotos) ? contencao.mark_check_fotos : [];
    const urlsProblema = useSignedUrls(fotosProblema.slice(0, 4));
    const urlsMark = useSignedUrls(fotosMark.slice(0, 4));

    const emitido = new Date().toLocaleString("pt-BR");

    return (
      <div
        ref={ref}
        // A4 width @96dpi ~ 794px. Fixed light theme so PDF stays readable.
        className="bg-white text-slate-900"
        style={{ width: "794px", minHeight: "1123px", padding: "32px", fontFamily: "Inter, system-ui, sans-serif" }}
      >
        {/* ---------- Cabeçalho ---------- */}
        <header className="flex items-start justify-between border-b-2 border-slate-900 pb-3">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Hyundai Mobis" style={{ height: 40 }} />
            <div>
              <h1 className="text-[20px] font-bold leading-tight tracking-tight">RELATÓRIO DE CONTENÇÃO</h1>
              <p className="text-[11px] uppercase tracking-wider text-slate-500">Ação de Contenção de Qualidade</p>

            </div>
          </div>
          <div className="text-right text-[10px] text-slate-600">
            <p><span className="font-semibold text-slate-900">Nº:</span> {contencao?.numero || "—"}</p>
            <p>Emitido em {emitido}</p>
          </div>
        </header>

        {/* ---------- Identificação ---------- */}
        <section className="mt-4 grid grid-cols-2 gap-3 text-[11px]">
          <Field label="Fornecedor" value={contencao?.fornecedor || "—"} highlight />
          <Field label="Responsabilidade" value={contencao?.responsabilidade || "—"} />
          <Field label="Part Number" value={contencao?.part_number || "—"} />
          <Field label="Descrição da Peça" value={contencao?.part_name || "—"} />
          <Field label="Setor / Linha" value={[contencao?.setor, contencao?.linha].filter(Boolean).join(" / ") || "—"} />
          <Field label="Local" value={contencao?.local || "—"} />
          <Field label="Data de Abertura" value={fmtDate(contencao?.data || contencao?.created_at)} />
          <Field label="Data de Conclusão" value={fmtDate(contencao?.data_conclusao)} />
          <Field label="Responsável (Mobis)" value={contencao?.responsavel || "—"} />
          <Field label="Status" value={contencao?.status || "—"} />
        </section>

        {/* ---------- Defeito ---------- */}
        <section className="mt-4">
          <SectionTitle>Motivo / Descrição do Defeito</SectionTitle>
          <p className="text-[11px] leading-relaxed text-slate-800 whitespace-pre-wrap border border-slate-200 rounded p-3 bg-slate-50 min-h-[60px]">
            {contencao?.motivo || "—"}
          </p>
          {contencao?.acao_contencao && (
            <>
              <SectionTitle className="mt-3">Ação de Contenção Executada</SectionTitle>
              <p className="text-[11px] leading-relaxed text-slate-800 whitespace-pre-wrap border border-slate-200 rounded p-3 bg-slate-50">
                {contencao.acao_contencao}
              </p>
            </>
          )}
        </section>

        {/* ---------- DESTAQUE: HORAS FATURÁVEIS ---------- */}
        <section className="mt-4">
          <div className="border-2 border-slate-700 bg-slate-50 rounded p-3">
            <div className="flex items-baseline justify-between flex-wrap gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-800">
                  Resumo da Contenção
                </p>
                <p className="text-[10px] text-slate-600">
                  Total de horas de inspeção realizadas pela equipe de contenção.
                </p>
              </div>
              <p className="text-[34px] font-extrabold text-slate-900 leading-none">
                {formatHoras(horasTotal)}
              </p>
            </div>

            <div className="mt-2 grid grid-cols-4 gap-2 text-center text-[10px]">
              <Mini label="Dias em contenção" value={String(contencao?.dias_andamento ?? "—")} />
              <Mini label="Registros (turnos)" value={String(registros.length)} />
              <Mini label="Peças inspecionadas" value={String(totais.insp)} />
              <Mini label="Peças NG (rejeitadas)" value={String(totais.ng)} accent="text-red-600" />
            </div>
          </div>
        </section>

        {/* ---------- Tabela de horas por turno ---------- */}
        <section className="mt-4">
          <SectionTitle>Detalhamento de Horas por Turno</SectionTitle>
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white">
                <Th>Data</Th>
                <Th>Turno</Th>
                <Th>Início</Th>
                <Th>Fim</Th>
                <Th className="text-right">Horas</Th>
                <Th className="text-right">Inspetores</Th>
                <Th className="text-right">Inspec.</Th>
                <Th className="text-right">NG</Th>
                <Th className="text-right">OK</Th>
              </tr>
            </thead>
            <tbody>
              {registros.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-3 text-slate-400 border border-slate-200">Nenhum registro</td></tr>
              ) : registros.map((r) => {
                const ok = Math.max(0, (r.qtd_inspecionada || 0) - (r.qtd_ng || 0));
                return (
                  <tr key={r.id} className="odd:bg-white even:bg-slate-50">
                    <Td>{fmtDate(r.data)}</Td>
                    <Td>{r.turno}</Td>
                    <Td>{r.hora_inicio?.slice(0, 5) || "—"}</Td>
                    <Td>{r.hora_fim?.slice(0, 5) || "—"}</Td>
                    <Td className="text-right font-semibold text-amber-700">{formatHoras(Number(r.horas_trabalhadas || 0))}</Td>
                    <Td className="text-right">{r.qtd_inspetores || 0}</Td>
                    <Td className="text-right">{r.qtd_inspecionada || 0}</Td>
                    <Td className="text-right text-red-600 font-semibold">{r.qtd_ng || 0}</Td>
                    <Td className="text-right text-emerald-700">{ok}</Td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold">
                <Td colSpan={4} className="text-right">TOTAL</Td>
                <Td className="text-right text-amber-700">{formatHoras(horasTotal)}</Td>
                <Td className="text-right">—</Td>
                <Td className="text-right">{totais.insp}</Td>
                <Td className="text-right text-red-600">{totais.ng}</Td>
                <Td className="text-right text-emerald-700">{totais.ok}</Td>
              </tr>
            </tfoot>
          </table>
        </section>

        {/* ---------- Fotos ---------- */}
        {(urlsProblema.length > 0 || urlsMark.length > 0) && (
          <section className="mt-4">
            <SectionTitle>Evidências Fotográficas</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              {urlsProblema.length > 0 && (
                <PhotoBlock title="Defeito" color="border-red-500" urls={urlsProblema} />
              )}
              {urlsMark.length > 0 && (
                <PhotoBlock title="Mark Check" color="border-emerald-500" urls={urlsMark} />
              )}
            </div>
          </section>
        )}

        {/* ---------- Rodapé ---------- */}
        <footer className="mt-6 pt-3 border-t border-slate-300 text-[9px] text-slate-500 flex items-center justify-between">
          <span>Hyundai Mobis Brasil — Departamento de Qualidade</span>
          <span>Documento gerado em {emitido} • Nº {contencao?.numero || "—"}</span>
        </footer>
      </div>
    );
  },
);
ContencaoClaimReport.displayName = "ContencaoClaimReport";

// ----- partials -----
const SectionTitle = ({ children, className = "" }: any) => (
  <h2 className={`text-[11px] font-bold uppercase tracking-widest text-slate-700 border-b border-slate-300 pb-1 mb-2 ${className}`}>{children}</h2>
);
const Field = ({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) => (
  <div className={`border rounded px-2 py-1.5 ${highlight ? "border-amber-500 bg-amber-50" : "border-slate-200 bg-white"}`}>
    <p className="text-[9px] uppercase tracking-wider text-slate-500">{label}</p>
    <p className={`text-[12px] font-semibold ${highlight ? "text-amber-700" : "text-slate-900"}`}>{value}</p>
  </div>
);
const Mini = ({ label, value, accent = "text-slate-900" }: any) => (
  <div className="bg-white border border-amber-200 rounded px-1.5 py-1">
    <p className="text-[8px] uppercase text-slate-500">{label}</p>
    <p className={`text-[14px] font-bold ${accent}`}>{value}</p>
  </div>
);
const Th = ({ children, className = "" }: any) => (
  <th className={`border border-slate-700 px-1.5 py-1 text-left font-semibold ${className}`}>{children}</th>
);
const Td = ({ children, className = "", colSpan }: any) => (
  <td colSpan={colSpan} className={`border border-slate-200 px-1.5 py-1 ${className}`}>{children}</td>
);
const PhotoBlock = ({ title, color, urls }: { title: string; color: string; urls: string[] }) => (
  <div>
    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-700 mb-1">{title}</p>
    <div className="grid grid-cols-2 gap-1.5">
      {urls.map((u, i) => (
        <div key={i} className={`border-2 ${color} rounded overflow-hidden bg-slate-100`} style={{ height: 130 }}>
          <img src={u} alt={`${title} ${i + 1}`} crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      ))}
    </div>
  </div>
);

export default ContencaoClaimReport;
