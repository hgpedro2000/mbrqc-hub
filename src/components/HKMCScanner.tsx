import { useEffect, useRef, useState } from "react";
import { QrCode } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { playBeep } from "@/lib/beep";

const DEMO = "[)>\x1E06\x1DVANFC\x1DP86511BP000T5G\x1DSBUT5\x1DE\x1DTP1PFBUT52604072329\x1D\x1EEOT";
const HISTORY_KEY = "hkmc_history";

export interface HKMCParsed {
  raw: string;
  header: string;
  supplierCode: string;
  partNumber: string;
  sequenceCode: string;
  eoNumber: string;
  productionDate: string;
  part4M: string;
  aOrAt: string;
  traceNo: string;
  supplierItself: string;
  trailer: string;
}

function normalizeRaw(input: string): string {
  return input
    .replace(/\\x1D/gi, "\x1D")
    .replace(/\\x1E/gi, "\x1E")
    .replace(/\\x04/gi, "\x04")
    .replace(/\\u001d/gi, "\x1D")
    .replace(/\\u001e/gi, "\x1E")
    .replace(/\\u0004/gi, "\x04")
    .replace(/<gs>/gi, "\x1D")
    .replace(/<rs>/gi, "\x1E")
    .replace(/<eot>/gi, "\x04")
    .replace(/\[GS\]/gi, "\x1D")
    .replace(/\[RS\]/gi, "\x1E")
    .replace(/\[EOT\]/gi, "\x04");
}

export function parseHKMC(input: string): HKMCParsed {
  const raw = normalizeRaw(input);
  const result: HKMCParsed = {
    raw: input,
    header: "",
    supplierCode: "",
    partNumber: "",
    sequenceCode: "",
    eoNumber: "",
    productionDate: "",
    part4M: "",
    aOrAt: "",
    traceNo: "",
    supplierItself: "",
    trailer: "",
  };

  // Header: between [)> and first GS (\x1D), commonly "[)>\x1E06"
  const headerMatch = raw.match(/^\[\)>\x1E?\d*/);
  if (headerMatch) result.header = headerMatch[0];

  // Tokens split by GS
  const tokens = raw
    .split("\x1D")
    .map((t) => t.replace(/[\x04]/g, ""))
    .filter((t) => t.length > 0);

  for (const tokRaw of tokens) {
    const tok = tokRaw.replace(/\x1E/g, "").trim();
    if (!tok) continue;
    if (tok.startsWith("[)>")) continue;
    const prefix = tok[0];
    const value = tok.slice(1);
    switch (prefix) {
      case "V": result.supplierCode = value; break;
      case "P": result.partNumber = value; break;
      case "S": result.sequenceCode = value; break;
      case "E": result.eoNumber = value; break;
      case "D": result.productionDate = value; break;
      case "C": result.supplierItself = value; break;
      case "T": {
        // Composite: YYMMDD(6) + Part4M(4) + A/@(1) + TraceNo(7) = 18 chars
        result.productionDate = value.slice(0, 6);
        result.part4M = value.slice(6, 10);
        const ch = value.slice(10, 11);
        if (ch === "A" || ch === "@") result.aOrAt = ch;
        result.traceNo = value.slice(11, 18);
        break;
      }
      default:
        // Unprefixed token → "Supplier itself" (ETC section)
        if (!result.supplierItself) result.supplierItself = tok;
    }
  }

  if (raw.includes("EOT") || raw.includes("\x04")) result.trailer = "EOT";

  return result;
}

function highlightRaw(s: string): string {
  const esc = (c: string) =>
    c.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let out = "";
  for (const ch of s) {
    if (ch === "\x1D") out += `<span style="color:#16a34a;font-weight:700">[GS]</span>`;
    else if (ch === "\x1E") out += `<span style="color:#ea580c;font-weight:700">[RS]</span>`;
    else if (ch === "\x04") out += `<span style="color:#dc2626;font-weight:700">[EOT]</span>`;
    else out += esc(ch);
  }
  return out;
}

interface HistoryEntry {
  ts: number;
  partNumber: string;
  supplierCode: string;
  raw: string;
}

const HKMCScanner = () => {
  const [data, setData] = useState<HKMCParsed>(() => parseHKMC(DEMO));
  const [historyOpen, setHistoryOpen] = useState(false);
  const [directOpen, setDirectOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [directText, setDirectText] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannedRef = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {}
  }, []);

  const saveHistory = (parsed: HKMCParsed) => {
    const entry: HistoryEntry = {
      ts: Date.now(),
      partNumber: parsed.partNumber,
      supplierCode: parsed.supplierCode,
      raw: parsed.raw,
    };
    const next = [entry, ...history].slice(0, 30);
    setHistory(next);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {}
  };

  const handleParse = (input: string) => {
    const parsed = parseHKMC(input);
    setData(parsed);
    saveHistory(parsed);
  };

  // Scanner lifecycle
  useEffect(() => {
    if (!scanOpen) {
      scannedRef.current = false;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        s.stop().catch(() => {}).finally(() => { try { s.clear(); } catch {} });
      }
      return;
    }
    const id = "hkmc-reader";
    const t = setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode(id);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (decoded) => {
            if (scannedRef.current) return;
            scannedRef.current = true;
            playBeep();
            handleParse(decoded);
            setScanOpen(false);
          },
          () => {}
        );
      } catch {}
    }, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanOpen]);

  // Sections matching the official H/KMC app layout (grouped left column with rowspan)
  const sections: Array<{ group: string; rows: Array<{ label: string; key: keyof HKMCParsed }> }> = [
    {
      group: "",
      rows: [{ label: "Header", key: "header" }],
    },
    {
      group: "Spec",
      rows: [
        { label: "Supplier Code", key: "supplierCode" },
        { label: "Part Number", key: "partNumber" },
        { label: "Sequence Code", key: "sequenceCode" },
      ],
    },
    {
      group: "Trace-ability",
      rows: [
        { label: "Production date", key: "productionDate" },
        { label: "Part 4M", key: "part4M" },
        { label: "A or @", key: "aOrAt" },
        { label: "Trace No. (7~)", key: "traceNo" },
      ],
    },
    {
      group: "ETC",
      rows: [{ label: "Supplier itself", key: "supplierItself" }],
    },
    {
      group: "",
      rows: [{ label: "Trailer", key: "trailer" }],
    },
  ];

  return (
    <div className="bg-background pb-24 md:pb-4 w-full max-w-full overflow-x-hidden">
      {/* Raw string area */}
      <div
        className="px-3 py-3 text-xs sm:text-sm font-mono break-all leading-relaxed"
        style={{ background: "#fffacd", color: "#111" }}
        dangerouslySetInnerHTML={{ __html: highlightRaw(normalizeRaw(data.raw)) }}
      />

      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-3 text-white font-semibold text-sm sm:text-base"
        style={{ background: "#2d6db5" }}
      >
        <QrCode className="w-5 h-5 shrink-0" />
        <span className="truncate">H/KMC Part 2D Barcode Standard</span>
      </div>

      {/* Table */}
      <div className="w-full">
        <table className="w-full text-xs sm:text-sm border-collapse table-fixed">
          <colgroup>
            <col className="w-16 sm:w-20" />
            <col />
            <col className="w-12 sm:w-16" />
            <col className="w-[42%]" />
          </colgroup>
          <thead>
            <tr style={{ background: "#e0e8f5" }}>
              <th colSpan={2} className="text-center px-2 py-2 border border-border font-semibold">Item</th>
              <th className="text-center px-2 py-2 border border-border font-semibold">Result</th>
              <th className="text-center px-2 py-2 border border-border font-semibold">Data</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((section, si) =>
              section.rows.map((r, ri) => {
                const value = (data[r.key] as string) || "";
                const isFirst = ri === 0;
                return (
                  <tr key={`${si}-${ri}`} className="align-middle">
                    {isFirst && (
                      <td
                        rowSpan={section.rows.length}
                        className="text-center px-1 py-2 border border-border font-semibold"
                        style={{ background: "#f5f7fb" }}
                      >
                        {section.group}
                      </td>
                    )}
                    <td className="text-center px-2 py-2 border border-border">{r.label}</td>
                    <td className="text-center px-2 py-2 border border-border">
                      {value ? (
                        <span style={{ color: "#2d6db5" }} className="font-semibold">OK</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 border border-border font-mono break-all">{value}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer buttons */}
      <div className="fixed bottom-0 left-0 right-0 md:static md:mt-3 grid grid-cols-3 gap-2 p-3 bg-background border-t border-border md:border-t-0">
        <Button
          onClick={() => setHistoryOpen(true)}
          style={{ background: "#2d6db5", color: "#fff" }}
          className="hover:opacity-90"
        >
          History
        </Button>
        <Button
          onClick={() => { setDirectText(""); setDirectOpen(true); }}
          style={{ background: "#2d6db5", color: "#fff" }}
          className="hover:opacity-90"
        >
          Direct input
        </Button>
        <Button
          onClick={() => setScanOpen(true)}
          style={{ background: "#2d6db5", color: "#fff" }}
          className="hover:opacity-90"
        >
          Scan
        </Button>
      </div>

      {/* History sheet */}
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>History</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {history.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma leitura salva.</p>
            )}
            {history.map((h, i) => (
              <button
                key={i}
                onClick={() => {
                  setData(parseHKMC(h.raw));
                  setHistoryOpen(false);
                }}
                className="w-full text-left p-3 rounded-md border border-border hover:bg-muted/50 transition-colors"
              >
                <div className="font-mono text-sm">{h.partNumber || "—"}</div>
                <div className="text-xs text-muted-foreground">
                  {h.supplierCode || "—"} · {new Date(h.ts).toLocaleString()}
                </div>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Direct input dialog */}
      <Dialog open={directOpen} onOpenChange={setDirectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Direct input</DialogTitle>
          </DialogHeader>
          <Textarea
            value={directText}
            onChange={(e) => setDirectText(e.target.value)}
            placeholder="Cole aqui a string bruta do QR..."
            rows={6}
            className="font-mono text-xs"
          />
          <div className="flex justify-end">
            <Button
              onClick={() => {
                if (directText.trim()) {
                  handleParse(directText);
                  setDirectOpen(false);
                }
              }}
              style={{ background: "#2d6db5", color: "#fff" }}
            >
              Ler
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Scan dialog */}
      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Scan QR</DialogTitle>
          </DialogHeader>
          <div id="hkmc-reader" className="w-full min-h-[300px] rounded-lg overflow-hidden bg-muted" />
          <p className="text-xs text-muted-foreground text-center">Aponte a câmera para o QR Code H/KMC</p>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HKMCScanner;
