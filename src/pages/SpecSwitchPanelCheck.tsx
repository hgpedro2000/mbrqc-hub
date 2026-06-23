import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, Clock, RotateCcw, Upload, Database, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseHyundaiQR } from "@/lib/parseHyundaiQR";
import * as XLSX from "xlsx";

interface DbRow {
  switch: string;
  panel: string;
  alc: string;
}

const DEFAULT_DB: DbRow[] = [
  { switch: "93700BP000", panel: "84705BP000YJT", alc: "LL31" },
  { switch: "93700BP000", panel: "84705BP000NNB", alc: "LL30" },
  { switch: "93700BP020", panel: "84705BP050NNB", alc: "LL42" },
  { switch: "93700BP020", panel: "84705BP010YJT", alc: "LL32" },
  { switch: "93700BP020", panel: "84705BP050YJT", alc: "LL33" },
  { switch: "93700BP030", panel: "84705BP060YJT", alc: "LL34" },
  { switch: "93700BP030", panel: "84705BP060NNB", alc: "LL35" },
  { switch: "93700BP030", panel: "84705BP110NNB", alc: "LL44" },
  { switch: "93700BP030", panel: "84705BP110YJT", alc: "LL47" },
  { switch: "93700BP030", panel: "84705BP210NNB", alc: "LL48" },
  { switch: "93700BP110", panel: "84705BP210YJT", alc: "LL49" },
  { switch: "93700BP120", panel: "84705BP220NNB", alc: "LL51" },
  { switch: "93700BP120", panel: "84705BP220YJT", alc: "LL52" },
  { switch: "93700BP100", panel: "84705BP230NNB", alc: "LL53" },
  { switch: "93700BP130", panel: "84705BP230YJT", alc: "LL54" },
  { switch: "93700BP010", panel: "84705BP300NNB", alc: "LL55" },
  { switch: "93700BP110", panel: "84705BP300YJT", alc: "LL58" },
  { switch: "93700BP130", panel: "84705BP310NNB", alc: "LL57" },
  { switch: "93700BP120", panel: "84705BP310YJT", alc: "LL60" },
  { switch: "93700BP120", panel: "84705BP320NNB", alc: "LL59" },
  { switch: "93700BP120", panel: "84705BP320YJT", alc: "LL59" },
];

const DB_STORAGE_KEY = "spec_switch_panel_db_v1";

const normalize = (s: string) => (s || "").toUpperCase().replace(/[\s\r\n\-_.]/g, "");

/**
 * Smart extractor: searches for known part-number patterns inside the QR.
 * - Tries parseHyundaiQR first (returns clean partNumber when applicable).
 * - Then scans normalized text for any of the candidate prefixes derived from the DB.
 * - Returns { code, error } where error is set when nothing plausible was found.
 */
function extractPart(
  raw: string,
  knownPrefixes: string[]
): { code: string; error?: string } {
  if (!raw) return { code: "" };
  const parsed = parseHyundaiQR(raw);
  const candidates: string[] = [];
  if (parsed?.partNumber) candidates.push(parsed.partNumber);
  candidates.push(raw);

  for (const c of candidates) {
    const n = normalize(c);
    // Try each known prefix (longest-first to prefer specific matches)
    const sorted = [...knownPrefixes].sort((a, b) => b.length - a.length);
    for (const pref of sorted) {
      const idx = n.indexOf(pref);
      if (idx >= 0) {
        // Take prefix + up to 13 chars total (covers 10–13 char PNs with suffix)
        return { code: n.slice(idx, idx + 13) };
      }
    }
  }
  // Fallback: if raw is already a clean PN-like token (>=8 alnum)
  const n = normalize(raw);
  if (/^[A-Z0-9]{8,16}$/.test(n)) return { code: n };
  return {
    code: "",
    error: `Padrão não reconhecido. Esperado um dos prefixos: ${knownPrefixes.join(", ")}`,
  };
}

type Status = "waiting" | "ok" | "alc_diff" | "not_found" | "parse_error";

interface LogEntry {
  ts: string;
  panel: string;
  switchPn: string;
  status: Status;
  alcExpected?: string;
}

function loadDb(): DbRow[] {
  try {
    const raw = localStorage.getItem(DB_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {}
  return DEFAULT_DB;
}

export default function SpecSwitchPanelCheck() {
  const [db, setDb] = useState<DbRow[]>(() => loadDb());
  const [panelRaw, setPanelRaw] = useState("");
  const [switchRaw, setSwitchRaw] = useState("");
  const [importMsg, setImportMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [showDb, setShowDb] = useState(false);
  const panelRef = useRef<HTMLInputElement>(null);
  const switchRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [log, setLog] = useState<LogEntry[]>([]);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  // Build prefix sets from current DB (first 5 chars of each PN)
  const { panelPrefixes, switchPrefixes } = useMemo(() => {
    const pp = new Set<string>();
    const sp = new Set<string>();
    for (const r of db) {
      if (r.panel) pp.add(normalize(r.panel).slice(0, 5));
      if (r.switch) sp.add(normalize(r.switch).slice(0, 5));
    }
    return { panelPrefixes: [...pp], switchPrefixes: [...sp] };
  }, [db]);

  const panelExtract = useMemo(
    () => (panelRaw ? extractPart(panelRaw, panelPrefixes) : { code: "" }),
    [panelRaw, panelPrefixes]
  );
  const switchExtract = useMemo(
    () => (switchRaw ? extractPart(switchRaw, switchPrefixes) : { code: "" }),
    [switchRaw, switchPrefixes]
  );

  const panelPn = panelExtract.code;
  const switchPn = switchExtract.code;

  const result = useMemo(() => {
    if (panelRaw && panelExtract.error) {
      return {
        status: "parse_error" as Status,
        alc: "",
        message: `Painel: ${panelExtract.error}`,
        expectedRows: [] as DbRow[],
      };
    }
    if (switchRaw && switchExtract.error) {
      return {
        status: "parse_error" as Status,
        alc: "",
        message: `Switch: ${switchExtract.error}`,
        expectedRows: [] as DbRow[],
      };
    }
    if (!panelPn || !switchPn) {
      return {
        status: "waiting" as Status,
        alc: "",
        message: "Aguardando leitura...",
        expectedRows: [] as DbRow[],
      };
    }
    const exact = db.find((r) => r.panel === panelPn && r.switch === switchPn);
    if (exact) {
      return {
        status: "ok" as Status,
        alc: exact.alc,
        message: "SPEC OK — Combinação válida",
        expectedRows: [exact],
      };
    }
    const byPanel = db.filter((r) => r.panel === panelPn);
    const bySwitch = db.filter((r) => r.switch === switchPn);
    if (byPanel.length && bySwitch.length) {
      return {
        status: "alc_diff" as Status,
        alc: `${byPanel[0].alc} ≠ ${bySwitch[0].alc}`,
        message: `ALC DIVERGENTE — Painel=${byPanel[0].alc} / Switch=${bySwitch[0].alc}`,
        expectedRows: [...byPanel, ...bySwitch],
      };
    }
    return {
      status: "not_found" as Status,
      alc: "",
      message: "SPEC INCORRETO — Combinação não encontrada no banco",
      expectedRows: [...byPanel, ...bySwitch],
    };
  }, [panelPn, switchPn, panelRaw, switchRaw, panelExtract.error, switchExtract.error, db]);

  const lastLoggedRef = useRef<string>("");
  useEffect(() => {
    if (result.status === "waiting" || result.status === "parse_error") return;
    const key = `${panelPn}|${switchPn}|${result.status}`;
    if (lastLoggedRef.current === key) return;
    lastLoggedRef.current = key;
    setLog((prev) =>
      [
        {
          ts: new Date().toLocaleTimeString("pt-BR"),
          panel: panelPn,
          switchPn,
          status: result.status,
          alcExpected: result.alc,
        },
        ...prev,
      ].slice(0, 50)
    );
  }, [panelPn, switchPn, result.status, result.alc]);

  const reset = useCallback(() => {
    setPanelRaw("");
    setSwitchRaw("");
    lastLoggedRef.current = "";
    setTimeout(() => panelRef.current?.focus(), 50);
  }, []);

  const handlePanelKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      switchRef.current?.focus();
    }
  };
  const handleSwitchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") e.preventDefault();
  };

  /** Import CSV or Excel. Accepts columns SWITCH, PANEL, ALC CODE (any case, with spaces). */
  const handleImport = async (file: File) => {
    setImportMsg(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      // Prefer a sheet named "BANCO"
      const sheetName =
        wb.SheetNames.find((n) => n.trim().toUpperCase() === "BANCO") || wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      if (!ws) throw new Error("Planilha vazia");
      const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
      if (!rows.length) throw new Error("Nenhuma linha encontrada");

      const findKey = (obj: Record<string, any>, names: string[]) => {
        const keys = Object.keys(obj);
        for (const n of names) {
          const k = keys.find((kk) => kk.trim().toUpperCase().replace(/\s+/g, "") === n);
          if (k) return k;
        }
        return null;
      };
      const sample = rows[0];
      const kSwitch = findKey(sample, ["SWITCH"]);
      const kPanel = findKey(sample, ["PANEL", "PAINEL"]);
      const kAlc = findKey(sample, ["ALCCODE", "ALC", "CODEALC"]);
      if (!kSwitch || !kPanel || !kAlc) {
        throw new Error(
          `Colunas obrigatórias não encontradas. Esperado: SWITCH, PANEL, ALC CODE. Encontrado: ${Object.keys(
            sample
          ).join(", ")}`
        );
      }
      const parsed: DbRow[] = rows
        .map((r) => ({
          switch: normalize(String(r[kSwitch] ?? "")),
          panel: normalize(String(r[kPanel] ?? "")),
          alc: String(r[kAlc] ?? "").trim().toUpperCase(),
        }))
        .filter((r) => r.switch && r.panel && r.alc);
      if (!parsed.length) throw new Error("Nenhuma linha válida após validação");
      localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(parsed));
      setDb(parsed);
      setImportMsg({ kind: "ok", text: `Banco atualizado: ${parsed.length} linhas importadas (aba "${sheetName}").` });
    } catch (e: any) {
      setImportMsg({ kind: "err", text: e?.message || "Falha ao importar arquivo" });
    }
  };

  const restoreDefault = () => {
    localStorage.removeItem(DB_STORAGE_KEY);
    setDb(DEFAULT_DB);
    setImportMsg({ kind: "ok", text: `Banco padrão restaurado (${DEFAULT_DB.length} linhas).` });
  };

  const palette: Record<Status, { bg: string; border: string; text: string; icon: JSX.Element; label: string }> = {
    waiting: { bg: "bg-slate-700", border: "border-slate-500", text: "text-slate-100", icon: <Clock className="w-16 h-16" />, label: "AGUARDANDO" },
    ok: { bg: "bg-emerald-600", border: "border-emerald-400", text: "text-white", icon: <CheckCircle2 className="w-16 h-16" />, label: "SPEC OK" },
    alc_diff: { bg: "bg-amber-500", border: "border-amber-300", text: "text-black", icon: <AlertTriangle className="w-16 h-16" />, label: "ALC DIVERGENTE" },
    not_found: { bg: "bg-red-600", border: "border-red-400", text: "text-white", icon: <XCircle className="w-16 h-16" />, label: "SPEC INCORRETO" },
    parse_error: { bg: "bg-orange-600", border: "border-orange-400", text: "text-white", icon: <AlertTriangle className="w-16 h-16" />, label: "QR INVÁLIDO" },
  };
  const p = palette[result.status];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => window.close()} className="text-slate-300 hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-2" /> Fechar
          </Button>
          <h1 className="text-xl md:text-2xl font-bold tracking-wide">VALIDAÇÃO SPEC — PAINEL × SWITCH</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="text-slate-900">
              <Upload className="w-4 h-4 mr-2" /> Importar Banco
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowDb((s) => !s)} className="text-slate-900">
              <Database className="w-4 h-4 mr-2" /> Banco ({db.length})
            </Button>
            <Button variant="outline" size="sm" onClick={reset} className="text-slate-900">
              <RotateCcw className="w-4 h-4 mr-2" /> Nova Leitura
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImport(f);
              e.target.value = "";
            }}
          />
        </div>

        {importMsg && (
          <div
            className={`mb-3 px-3 py-2 rounded text-sm flex items-center justify-between gap-2 ${
              importMsg.kind === "ok" ? "bg-emerald-900/40 border border-emerald-600 text-emerald-100" : "bg-red-900/40 border border-red-600 text-red-100"
            }`}
          >
            <span>{importMsg.text}</span>
            <button onClick={restoreDefault} className="underline text-xs">Restaurar padrão</button>
          </div>
        )}

        <div className="bg-slate-100 text-slate-900 rounded-lg overflow-hidden shadow-2xl border-2 border-slate-400">
          {/* QR PAINEL */}
          <div className="grid grid-cols-[160px_1fr] border-b-2 border-slate-400">
            <div className="bg-slate-300 p-3 font-bold border-r-2 border-slate-400 flex items-center">QR PAINEL</div>
            <div className="p-2 flex items-center gap-2">
              <input
                ref={panelRef}
                value={panelRaw}
                onChange={(e) => setPanelRaw(e.target.value)}
                onKeyDown={handlePanelKey}
                placeholder="Leia o QR do PAINEL..."
                className="flex-1 px-3 py-2 text-base font-mono bg-white border-2 border-blue-400 rounded outline-none focus:border-blue-600"
                autoComplete="off"
              />
            </div>
          </div>

          {/* QR SWITCH */}
          <div className="grid grid-cols-[160px_1fr] border-b-2 border-slate-400">
            <div className="bg-slate-300 p-3 font-bold border-r-2 border-slate-400 flex items-center">QR SWITCH</div>
            <div className="p-2 flex items-center gap-2">
              <input
                ref={switchRef}
                value={switchRaw}
                onChange={(e) => setSwitchRaw(e.target.value)}
                onKeyDown={handleSwitchKey}
                placeholder="Leia o QR do SWITCH..."
                className="flex-1 px-3 py-2 text-base font-mono bg-white border-2 border-blue-400 rounded outline-none focus:border-blue-600"
                autoComplete="off"
              />
            </div>
          </div>

          {/* PAINEL EXTRAIDO */}
          <div className="grid grid-cols-[160px_1fr] border-b-2 border-slate-400">
            <div className="bg-slate-300 p-3 font-bold border-r-2 border-slate-400 flex items-center">PAINEL EXTRAIDO</div>
            <div className="p-3 font-mono text-lg">
              {panelPn || (panelExtract.error ? <span className="text-orange-700 text-sm">⚠ {panelExtract.error}</span> : <span className="text-slate-400">—</span>)}
            </div>
          </div>

          {/* SWITCH EXTRAIDO */}
          <div className="grid grid-cols-[160px_1fr] border-b-2 border-slate-400">
            <div className="bg-slate-300 p-3 font-bold border-r-2 border-slate-400 flex items-center">SWITCH EXTRAIDO</div>
            <div className="p-3 font-mono text-lg">
              {switchPn || (switchExtract.error ? <span className="text-orange-700 text-sm">⚠ {switchExtract.error}</span> : <span className="text-slate-400">—</span>)}
            </div>
          </div>

          {/* ALC CODE */}
          <div className="grid grid-cols-[160px_1fr] border-b-2 border-slate-400">
            <div className="bg-slate-300 p-3 font-bold border-r-2 border-slate-400 flex items-center">ALC CODE</div>
            <div className="p-3 font-mono text-xl font-bold">
              {result.alc || <span className="text-slate-400 font-normal text-base">—</span>}
            </div>
          </div>

          {/* RESULTADO */}
          <div className={`grid grid-cols-[160px_1fr] border-b-2 border-slate-400 ${p.bg} ${p.text}`}>
            <div className="bg-black/20 p-3 font-bold border-r-2 border-slate-400 flex items-center">RESULTADO</div>
            <div className="p-4 flex items-center gap-4">
              <div className="shrink-0">{p.icon}</div>
              <div className="text-3xl md:text-4xl font-black tracking-tight">{p.label}</div>
            </div>
          </div>

          {/* MENSAGEM */}
          <div className="grid grid-cols-[160px_1fr] border-b-2 border-slate-400">
            <div className="bg-slate-300 p-3 font-bold border-r-2 border-slate-400 flex items-center">MENSAGEM</div>
            <div className="p-3 text-base">{result.message}</div>
          </div>

          {/* Detalhes esperados quando divergência */}
          {(result.status === "alc_diff" || result.status === "not_found") && result.expectedRows.length > 0 && (
            <div className="grid grid-cols-[160px_1fr] border-b-2 border-slate-400">
              <div className="bg-slate-300 p-3 font-bold border-r-2 border-slate-400 flex items-center text-xs">ESPERADO</div>
              <div className="p-3 overflow-x-auto">
                <table className="w-full text-sm font-mono">
                  <thead className="text-xs text-slate-600">
                    <tr><th className="text-left pr-3 pb-1">SWITCH</th><th className="text-left pr-3 pb-1">PANEL</th><th className="text-left pb-1">ALC</th></tr>
                  </thead>
                  <tbody>
                    {result.expectedRows.slice(0, 6).map((r, i) => (
                      <tr key={i} className="border-t border-slate-300">
                        <td className={`pr-3 py-1 ${r.switch === switchPn ? "font-bold" : ""}`}>{r.switch}</td>
                        <td className={`pr-3 py-1 ${r.panel === panelPn ? "font-bold" : ""}`}>{r.panel}</td>
                        <td className="py-1 font-bold">{r.alc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Botões LIMPAR / VALIDAR */}
          <div className="grid grid-cols-2 gap-3 p-4 bg-slate-200">
            <button
              type="button"
              onClick={reset}
              className="py-3 bg-white border-2 border-slate-400 rounded font-bold text-slate-800 hover:bg-slate-50 active:bg-slate-100"
            >
              LIMPAR
            </button>
            <button
              type="button"
              onClick={() => { switchRef.current?.blur(); panelRef.current?.blur(); }}
              className="py-3 bg-white border-2 border-slate-400 rounded font-bold text-slate-800 hover:bg-slate-50 active:bg-slate-100"
            >
              VALIDAR
            </button>
          </div>
        </div>

        {showDb && (
          <div className="mt-4 bg-slate-800/60 backdrop-blur rounded-lg p-4 border border-slate-700 max-h-80 overflow-auto">
            <h2 className="font-bold text-slate-200 mb-2">Banco atual ({db.length} linhas)</h2>
            <table className="w-full font-mono text-xs">
              <thead className="text-slate-400 border-b border-slate-700">
                <tr><th className="text-left py-1 px-2">SWITCH</th><th className="text-left py-1 px-2">PANEL</th><th className="text-left py-1 px-2">ALC</th></tr>
              </thead>
              <tbody>
                {db.map((r, i) => (
                  <tr key={i} className="border-b border-slate-700/50">
                    <td className="py-1 px-2">{r.switch}</td>
                    <td className="py-1 px-2">{r.panel}</td>
                    <td className="py-1 px-2 text-emerald-300">{r.alc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 bg-slate-800/60 backdrop-blur rounded-lg p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-slate-200">Log de validações</h2>
            <span className="text-xs text-slate-400">{log.length} registros</span>
          </div>
          <div className="max-h-64 overflow-y-auto text-sm">
            {log.length === 0 ? (
              <div className="text-slate-500 text-center py-4 italic">Nenhuma leitura ainda</div>
            ) : (
              <table className="w-full font-mono text-xs">
                <thead className="text-slate-400 border-b border-slate-700">
                  <tr><th className="text-left py-1 px-2">Hora</th><th className="text-left py-1 px-2">Painel</th><th className="text-left py-1 px-2">Switch</th><th className="text-left py-1 px-2">Resultado</th></tr>
                </thead>
                <tbody>
                  {log.map((l, i) => (
                    <tr key={i} className="border-b border-slate-700/50">
                      <td className="py-1 px-2 text-slate-400">{l.ts}</td>
                      <td className="py-1 px-2">{l.panel}</td>
                      <td className="py-1 px-2">{l.switchPn}</td>
                      <td className={`py-1 px-2 font-bold ${l.status === "ok" ? "text-emerald-400" : l.status === "alc_diff" ? "text-amber-400" : "text-red-400"}`}>
                        {l.status === "ok" ? `OK (${l.alcExpected})` : l.status === "alc_diff" ? `DIVERGENTE (${l.alcExpected})` : "INCORRETO"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-4">
          Importe CSV/Excel com colunas <b>SWITCH</b>, <b>PANEL</b>, <b>ALC CODE</b> (aba opcional "BANCO"). Os prefixos de extração do QR são derivados automaticamente do banco carregado.
        </p>
      </div>
    </div>
  );
}
