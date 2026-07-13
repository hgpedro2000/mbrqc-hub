import logo from "@/assets/hyundai-mobis-logo.png";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  audit: any;
  ncs: any[];
}

function fmtDate(d?: string | null) {
  if (!d) return "-";
  return new Date(d + "T12:00:00").toLocaleDateString("en-GB");
}
function storageUrl(path?: string | null) {
  if (!path) return null;
  return supabase.storage.from("audit-photos").getPublicUrl(path).data.publicUrl;
}

const PURPOSE_ITEMS = ["T/Out", "TFT", "New Car", "CM Validation", "Process Check"];
const PROCESS_ITEMS = ["Injection", "Assembly", "Paint", "Other"];

const norm = (s: string) => s.toLowerCase().replace(/[\s/]/g, "");
const has = (arr: string[] | null | undefined, v: string) =>
  Array.isArray(arr) && arr.some((x) => norm(String(x)) === norm(v));

const Chk = ({ on, label }: { on: boolean; label: string }) => (
  <span className="inline-flex items-center gap-1 mr-3 whitespace-nowrap">
    <span className={`inline-block w-3 h-3 border border-black ${on ? "bg-black" : "bg-white"}`} />
    <span>{label}</span>
  </span>
);

export default function SupplierVisitReportView({ audit, ncs }: Props) {
  const purpose: string[] = audit.purpose || [];
  const proc: string[] = audit.process || [];
  const ok = Number(audit.mbr_aql_ok ?? 0);
  const ng = Number(audit.mbr_aql_ng ?? 0);
  const total = Number(audit.mbr_aql_total ?? (ok + ng));
  const rate = total > 0 ? Math.round((ok / total) * 100) : 0;
  const reqs: string[] = Array.isArray(audit.major_requests) ? audit.major_requests.filter(Boolean) : [];
  const participants: any[] = Array.isArray(audit.participants) ? audit.participants : [];

  const openN = ncs.filter((n) => (n.status || "open") === "open").length;
  const partialN = ncs.filter((n) => ["in_progress", "partial"].includes(n.status)).length;
  const doneN = ncs.filter((n) => n.status === "done").length;
  const totN = ncs.length;
  const pct = (n: number) => (totN > 0 ? `${((n / totN) * 100).toFixed(2)}%` : "0%");

  const dateStr = `${fmtDate(audit.audit_date_start)}${
    audit.audit_date_end && audit.audit_date_end !== audit.audit_date_start
      ? " & " + fmtDate(audit.audit_date_end)
      : ""
  }`;

  return (
    <div
      className="mx-auto bg-white text-[#1F1F1F] shadow-2xl border overflow-hidden"
      style={{
        width: "1100px",
        maxWidth: "100%",
        aspectRatio: "1100 / 760",
        fontFamily: "Calibri, Arial, sans-serif",
        fontSize: 12,
      }}
    >
      <div className="p-4 h-full flex flex-col gap-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[26px] font-bold">
            <span className="text-[24px]">❑</span>
            <span>Supplier Visit Report</span>
          </div>
          <img src={logo} alt="Hyundai Mobis" className="h-8 object-contain" />
        </div>

        {/* Top info table */}
        <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "9%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "17%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "25%" }} />
          </colgroup>
          <tbody>
            <tr>
              <td className="border border-[#8FAADC] bg-[#D9E2F3] text-center font-bold px-1 py-1">Description</td>
              <td colSpan={5} className="border border-[#8FAADC] px-2 py-1">{audit.title || "-"}</td>
              <td className="border border-[#8FAADC] bg-[#D9E2F3] text-center font-bold px-1 py-1">Purpose</td>
            </tr>
            <tr>
              <td className="border border-[#8FAADC] bg-[#D9E2F3] text-center font-bold px-1 py-1">Supplier</td>
              <td className="border border-[#8FAADC] px-2 py-1">{audit.supplier_name || "-"}</td>
              <td className="border border-[#8FAADC] bg-[#D9E2F3] text-center font-bold px-1 py-1">Place</td>
              <td className="border border-[#8FAADC] px-2 py-1">{audit.place || "-"}</td>
              <td className="border border-[#8FAADC] bg-[#D9E2F3] text-center font-bold px-1 py-1">Date</td>
              <td className="border border-[#8FAADC] px-2 py-1">{dateStr}</td>
              <td className="border border-[#8FAADC] px-2 py-1">
                {["T/Out", "TFT", "New Car"].map((p) => (
                  <Chk key={p} on={has(purpose, p)} label={p} />
                ))}
              </td>
            </tr>
            <tr>
              <td className="border border-[#8FAADC] bg-[#D9E2F3] text-center font-bold px-1 py-1">Process</td>
              <td colSpan={3} className="border border-[#8FAADC] px-2 py-1">
                {PROCESS_ITEMS.map((p) => (
                  <Chk key={p} on={has(proc, p)} label={p} />
                ))}
              </td>
              <td className="border border-[#8FAADC] bg-[#D9E2F3] text-center font-bold px-1 py-1">PIC</td>
              <td className="border border-[#8FAADC] px-2 py-1">{audit.pic_name || "-"}</td>
              <td className="border border-[#8FAADC] px-2 py-1">
                {["CM Validation", "Process Check"].map((p) => (
                  <Chk key={p} on={has(purpose, p)} label={p} />
                ))}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Middle: schedule / participants / main product */}
        <div className="grid gap-2 flex-1 min-h-0" style={{ gridTemplateColumns: "32% 42% 26%" }}>
          {/* Schedule */}
          <div className="border border-[#8FAADC] flex flex-col min-h-0">
            <div className="bg-[#D9E2F3] font-bold text-center py-1 border-b border-[#8FAADC]">Schedule</div>
            <div className="p-2 text-[11px] whitespace-pre-wrap overflow-hidden">
              {audit.schedule_notes || "-"}
            </div>
          </div>

          {/* Participants */}
          <div className="border border-[#8FAADC] flex flex-col min-h-0">
            <div className="bg-[#D9E2F3] font-bold text-center py-1 border-b border-[#8FAADC]">Participants</div>
            <table className="w-full border-collapse text-[11px]" style={{ tableLayout: "fixed" }}>
              <thead>
                <tr className="bg-[#D9E2F3]">
                  <th className="border border-[#8FAADC] py-1">Name</th>
                  <th className="border border-[#8FAADC] py-1">Area</th>
                  <th className="border border-[#8FAADC] py-1">Position</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 4 }).map((_, i) => {
                  const p = participants[i] || {};
                  return (
                    <tr key={i}>
                      <td className="border border-[#8FAADC] text-center py-1">{p.name || ""}</td>
                      <td className="border border-[#8FAADC] text-center py-1">{p.area || ""}</td>
                      <td className="border border-[#8FAADC] text-center py-1">{p.position || p.role || ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Main Product */}
          <div className="border border-dashed border-[#8FAADC] flex flex-col items-center p-2 min-h-0">
            <div className="font-bold underline mb-1">Main Product</div>
            <div className="flex-1 min-h-0 w-full flex items-center justify-center">
              {audit.product_image_url ? (
                <img
                  src={storageUrl(audit.product_image_url) || ""}
                  alt="Produto"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <div className="text-[#9CA3AF] text-xs">Sem imagem</div>
              )}
            </div>
            <div className="text-center mt-1">{audit.product_name || ""}</div>
          </div>
        </div>

        {/* Main Contents header */}
        <div className="bg-[#1F3864] text-white font-bold text-[13px] px-3 py-1 w-fit">Main Contents</div>

        {/* GeneralOpinion | Paint rate | Major Request */}
        <div className="grid gap-0" style={{ gridTemplateColumns: "14% 42% 14% 30%" }}>
          <div className="border border-[#8FAADC] flex items-center justify-center text-center font-bold p-2">
            GeneralOpinion<br />(Special Notes)
          </div>
          <div className="border border-[#8FAADC] border-l-0 p-1">
            <div className="bg-[#D9E2F3] font-bold px-2 py-0.5 mb-1">Paint approval rate:</div>
            <table className="w-full border-collapse text-[11px] text-center" style={{ tableLayout: "fixed" }}>
              <thead>
                <tr className="bg-[#D9E2F3]">
                  <th className="border border-[#8FAADC] py-1">Inspection</th>
                  <th className="border border-[#8FAADC] py-1">Total Paint</th>
                  <th className="border border-[#8FAADC] py-1">OK</th>
                  <th className="border border-[#8FAADC] py-1">NG</th>
                  <th className="border border-[#8FAADC] py-1">% Rate</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-[#8FAADC] font-bold py-1">MBR AQL</td>
                  <td className="border border-[#8FAADC] py-1">{total || "-"}</td>
                  <td className="border border-[#8FAADC] py-1">{ok || "-"}</td>
                  <td className="border border-[#8FAADC] py-1 font-bold text-[#DC2626]">{ng || "-"}</td>
                  <td className="border border-[#8FAADC] py-1 font-bold text-[#1F3864]">{total > 0 ? `${rate}%` : "-"}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="border border-[#8FAADC] border-l-0 flex items-center justify-center text-center font-bold p-2">
            Major<br />Request of<br />Improvement
          </div>
          <div className="border border-[#8FAADC] border-l-0">
            <table className="w-full h-full border-collapse text-[11px]">
              <tbody>
                {Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td className="border-b border-[#8FAADC] px-2 py-1 align-middle" style={{ height: "25%" }}>
                      {reqs[i] ? `${i + 1}. ${reqs[i]}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Classification / Problem Status / Conclusion */}
        <div className="grid gap-0" style={{ gridTemplateColumns: "42% 58%" }}>
          <table className="border-collapse text-[11px] text-center w-full" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "20%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "20%" }} />
            </colgroup>
            <tbody>
              <tr>
                <td rowSpan={2} className="border border-[#8FAADC] bg-[#D9E2F3] font-bold py-1">Classification</td>
                <td rowSpan={2} className="border border-[#8FAADC] bg-[#D9E2F3] font-bold py-1">Total</td>
                <td colSpan={3} className="border border-[#8FAADC] bg-[#D9E2F3] font-bold py-1">Problem Status</td>
              </tr>
              <tr>
                <td className="border border-[#8FAADC] bg-[#C00000] text-white font-bold py-1">Open</td>
                <td className="border border-[#8FAADC] bg-[#ED7D31] text-white font-bold py-1">Partial</td>
                <td className="border border-[#8FAADC] bg-[#70AD47] text-white font-bold py-1">Done</td>
              </tr>
              <tr>
                <td className="border border-[#8FAADC] bg-[#D9E2F3] font-bold py-1">Qty</td>
                <td className="border border-[#8FAADC] py-1">{totN}</td>
                <td className="border border-[#8FAADC] py-1">{openN}</td>
                <td className="border border-[#8FAADC] py-1">{partialN}</td>
                <td className="border border-[#8FAADC] py-1">{doneN}</td>
              </tr>
              <tr>
                <td className="border border-[#8FAADC] bg-[#D9E2F3] font-bold py-1">%</td>
                <td className="border border-[#8FAADC] py-1">{totN > 0 ? "100%" : "0%"}</td>
                <td className="border border-[#8FAADC] py-1">{pct(openN)}</td>
                <td className="border border-[#8FAADC] py-1">{pct(partialN)}</td>
                <td className="border border-[#8FAADC] py-1">{pct(doneN)}</td>
              </tr>
            </tbody>
          </table>
          <div className="border border-[#8FAADC] border-l-0 flex flex-col">
            <div className="bg-[#D9E2F3] font-bold text-center py-1 border-b border-[#8FAADC]">Conclusion</div>
            <div className="p-2 text-[11px] whitespace-pre-wrap overflow-hidden flex-1">
              {audit.conclusion || "-"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
