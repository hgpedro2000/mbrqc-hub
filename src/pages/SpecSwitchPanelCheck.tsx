import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, Clock, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseHyundaiQR } from "@/lib/parseHyundaiQR";

interface DbRow {
  switch: string;
  panel: string;
  alc: string;
}

const DB: DbRow[] = [
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

const SWITCH_PREFIX = "93700";
const PANEL_PREFIX = "84705";

const normalize = (s: string) => (s || "").toUpperCase().replace(/[\s\r\n\-_.]/g, "");

function extractPart(raw: string, prefix: string): string {
  if (!raw) return "";
  const parsed = parseHyundaiQR(raw);
  const candidates: string[] = [];
  if (parsed?.partNumber) candidates.push(parsed.partNumber);
  candidates.push(raw);
  for (const c of candidates) {
    const n = normalize(c);
    const idx = n.indexOf(prefix);
    if (idx >= 0) {
      // 10-14 char part numbers; pick from prefix forward up to 13 chars
      return n.slice(idx, idx + 13);
    }
  }
  return normalize(raw);
}

type Status = "waiting" | "ok" | "alc_diff" | "not_found";

interface LogEntry {
  ts: string;
  panel: string;
  switchPn: string;
  status: Status;
  alcExpected?: string;
}

export default function SpecSwitchPanelCheck() {
  const [panelRaw, setPanelRaw] = useState("");
  const [switchRaw, setSwitchRaw] = useState("");
  const panelRef = useRef<HTMLInputElement>(null);
  const switchRef = useRef<HTMLInputElement>(null);
  const [log, setLog] = useState<LogEntry[]>([]);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const panelPn = useMemo(() => (panelRaw ? extractPart(panelRaw, PANEL_PREFIX) : ""), [panelRaw]);
  const switchPn = useMemo(() => (switchRaw ? extractPart(switchRaw, SWITCH_PREFIX) : ""), [switchRaw]);

  const result = useMemo(() => {
    if (!panelPn || !switchPn) {
      return { status: "waiting" as Status, alc: "", message: "Aguardando leitura..." };
    }
    // Try exact pair
    const exact = DB.find((r) => r.panel === panelPn && r.switch === switchPn);
    if (exact) {
      return { status: "ok" as Status, alc: exact.alc, message: "SPEC OK — Combinação válida" };
    }
    // Try ALC by panel and by switch separately
    const byPanel = DB.find((r) => r.panel === panelPn);
    const bySwitch = DB.find((r) => r.switch === switchPn);
    if (byPanel && bySwitch) {
      return {
        status: "alc_diff" as Status,
        alc: `${byPanel.alc} ≠ ${bySwitch.alc}`,
        message: `ALC DIVERGENTE — Painel=${byPanel.alc} / Switch=${bySwitch.alc}`,
      };
    }
    return {
      status: "not_found" as Status,
      alc: "",
      message: "SPEC INCORRETO — Combinação não encontrada no banco",
    };
  }, [panelPn, switchPn]);

  // Log when both filled and status changes
  const lastLoggedRef = useRef<string>("");
  useEffect(() => {
    if (result.status === "waiting") return;
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
    if (e.key === "Enter") {
      e.preventDefault();
      // Already evaluated automatically
    }
  };

  const palette: Record<Status, { bg: string; border: string; text: string; icon: JSX.Element; label: string }> = {
    waiting: {
      bg: "bg-slate-700",
      border: "border-slate-500",
      text: "text-slate-100",
      icon: <Clock className="w-16 h-16" />,
      label: "AGUARDANDO",
    },
    ok: {
      bg: "bg-emerald-600",
      border: "border-emerald-400",
      text: "text-white",
      icon: <CheckCircle2 className="w-16 h-16" />,
      label: "SPEC OK",
    },
    alc_diff: {
      bg: "bg-amber-500",
      border: "border-amber-300",
      text: "text-black",
      icon: <AlertTriangle className="w-16 h-16" />,
      label: "ALC DIVERGENTE",
    },
    not_found: {
      bg: "bg-red-600",
      border: "border-red-400",
      text: "text-white",
      icon: <XCircle className="w-16 h-16" />,
      label: "SPEC INCORRETO",
    },
  };

  const p = palette[result.status];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.close()}
            className="text-slate-300 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Fechar
          </Button>
          <h1 className="text-xl md:text-2xl font-bold tracking-wide">
            VALIDAÇÃO SPEC — PAINEL × SWITCH
          </h1>
          <Button variant="outline" size="sm" onClick={reset} className="text-slate-900">
            <RotateCcw className="w-4 h-4 mr-2" /> Nova Leitura
          </Button>
        </div>

        {/* Spreadsheet-like grid */}
        <div className="bg-slate-100 text-slate-900 rounded-lg overflow-hidden shadow-2xl border-2 border-slate-300">
          {/* Header row */}
          <div className="grid grid-cols-[60px_1fr] bg-slate-300 border-b border-slate-400 font-mono text-xs">
            <div className="p-2 text-center border-r border-slate-400">　</div>
            <div className="p-2 text-center font-bold">A</div>
          </div>

          {/* B2 - Panel */}
          <div className="grid grid-cols-[60px_1fr] border-b border-slate-300">
            <div className="bg-slate-300 p-3 text-center font-mono text-sm font-bold border-r border-slate-400 flex items-center justify-center">
              B2
            </div>
            <div className="p-3 flex items-center gap-3">
              <label className="font-bold w-32 shrink-0">PAINEL (QR):</label>
              <input
                ref={panelRef}
                value={panelRaw}
                onChange={(e) => setPanelRaw(e.target.value)}
                onKeyDown={handlePanelKey}
                placeholder="Leia o QR do PAINEL..."
                className="flex-1 px-3 py-2 text-lg font-mono bg-white border-2 border-blue-400 rounded outline-none focus:border-blue-600"
                autoComplete="off"
              />
              {panelPn && (
                <span className="font-mono text-sm bg-blue-100 px-2 py-1 rounded border border-blue-300">
                  {panelPn}
                </span>
              )}
            </div>
          </div>

          {/* B3 - Switch */}
          <div className="grid grid-cols-[60px_1fr] border-b border-slate-300">
            <div className="bg-slate-300 p-3 text-center font-mono text-sm font-bold border-r border-slate-400 flex items-center justify-center">
              B3
            </div>
            <div className="p-3 flex items-center gap-3">
              <label className="font-bold w-32 shrink-0">SWITCH (QR):</label>
              <input
                ref={switchRef}
                value={switchRaw}
                onChange={(e) => setSwitchRaw(e.target.value)}
                onKeyDown={handleSwitchKey}
                placeholder="Leia o QR do SWITCH..."
                className="flex-1 px-3 py-2 text-lg font-mono bg-white border-2 border-blue-400 rounded outline-none focus:border-blue-600"
                autoComplete="off"
              />
              {switchPn && (
                <span className="font-mono text-sm bg-blue-100 px-2 py-1 rounded border border-blue-300">
                  {switchPn}
                </span>
              )}
            </div>
          </div>

          {/* Spacer rows (locked) */}
          {["B4", "B5", "B6", "B7", "B8"].map((r) => (
            <div key={r} className="grid grid-cols-[60px_1fr] border-b border-slate-300">
              <div className="bg-slate-300 p-2 text-center font-mono text-xs text-slate-500 border-r border-slate-400">
                {r}
              </div>
              <div className="p-2 bg-slate-50 text-slate-400 text-xs italic">
                🔒 bloqueado
              </div>
            </div>
          ))}

          {/* B9:B11 - Result */}
          <div className={`grid grid-cols-[60px_1fr] ${p.bg} ${p.text} border-y-4 ${p.border} transition-all duration-200`}>
            <div className="bg-black/20 p-3 text-center font-mono text-sm font-bold border-r border-black/30 flex items-center justify-center">
              B9:B11
            </div>
            <div className="p-6 flex items-center gap-6">
              <div className="shrink-0">{p.icon}</div>
              <div className="flex-1">
                <div className="text-3xl md:text-5xl font-black tracking-tight leading-tight">
                  {p.label}
                </div>
                <div className="text-base md:text-xl font-semibold opacity-90 mt-1">
                  {result.message}
                </div>
                {result.alc && (
                  <div className="text-2xl md:text-3xl font-mono font-bold mt-2 bg-black/20 inline-block px-3 py-1 rounded">
                    ALC: {result.alc}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Log */}
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
                  <tr>
                    <th className="text-left py-1 px-2">Hora</th>
                    <th className="text-left py-1 px-2">Painel</th>
                    <th className="text-left py-1 px-2">Switch</th>
                    <th className="text-left py-1 px-2">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {log.map((l, i) => (
                    <tr key={i} className="border-b border-slate-700/50">
                      <td className="py-1 px-2 text-slate-400">{l.ts}</td>
                      <td className="py-1 px-2">{l.panel}</td>
                      <td className="py-1 px-2">{l.switchPn}</td>
                      <td className={`py-1 px-2 font-bold ${
                        l.status === "ok" ? "text-emerald-400" :
                        l.status === "alc_diff" ? "text-amber-400" :
                        "text-red-400"
                      }`}>
                        {l.status === "ok" ? `OK (${l.alcExpected})` :
                         l.status === "alc_diff" ? `DIVERGENTE (${l.alcExpected})` :
                         "INCORRETO"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-4">
          Dica: use um leitor QR USB. Os campos B2 e B3 aceitam Enter/Tab para avançar. A validação é instantânea ao preencher ambos.
        </p>
      </div>
    </div>
  );
}
