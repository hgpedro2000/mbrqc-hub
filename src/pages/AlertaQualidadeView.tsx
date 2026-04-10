import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Check, Clock, Download } from "lucide-react";
import logo from "@/assets/hyundai-mobis-logo.png";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const AlertaQualidadeView = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [photoPopup, setPhotoPopup] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportDialog, setExportDialog] = useState(false);
  const [includeCiencias, setIncludeCiencias] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const cienciasRef = useRef<HTMLDivElement>(null);

  const { data: alerta, isLoading } = useQuery({
    queryKey: ["alerta-view", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("alertas").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: ciencias = [] } = useQuery({
    queryKey: ["ciencias-alerta", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("ciencias").select("*, profiles:inspetor_id(full_name, cargo)").eq("alerta_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: inspetores = [] } = useQuery({
    queryKey: ["inspetores-qualificados", id, alerta?.linha_peca],
    queryFn: async () => {
      const lineAreaMap: Record<string, string> = {
        "CP": "cp", "BP": "bp", "CH": "ch", "OEM": "oem",
        "Incoming": "incoming", "Pintura": "pintura", "Injeção": "injecao",
        "Sala do Áudio": "sala_audio", "Inspeção de Peça": "inspecao_peca",
      };

      let query = supabase.from("inspector_qualifications").select("user_id").eq("habilitado", true);
      const areaKey = alerta?.linha_peca ? lineAreaMap[alerta.linha_peca] : null;
      if (areaKey) {
        query = query.eq("area", areaKey);
      }

      const { data: qualData, error: qualErr } = await query;
      if (qualErr) throw qualErr;

      const qualifiedIds = [...new Set((qualData || []).map((q: any) => q.user_id))];
      if (qualifiedIds.length === 0) return [];

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, cargo")
        .in("id", qualifiedIds)
        .eq("status", "active");
      if (error) throw error;
      return data || [];
    },
    enabled: !!id && !!alerta,
  });

  useEffect(() => {
    const exportFormat = searchParams.get("export") as "jpg" | "pdf" | null;
    const showCiencias = searchParams.get("ciencias");
    if (exportFormat && alerta && !isLoading) {
      const timer = setTimeout(() => {
        handleExport(exportFormat, showCiencias === "1");
        setSearchParams({}, { replace: true });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [searchParams, alerta, isLoading]);

  const handleExport = async (format: "jpg" | "pdf", withCiencias: boolean = true) => {
    if (!contentRef.current) return;
    setExporting(true);
    try {
      if (cienciasRef.current && !withCiencias) {
        cienciasRef.current.style.display = "none";
      }
      const canvas = await html2canvas(contentRef.current, { useCORS: true, scale: 2, backgroundColor: "#f8fafc" });
      if (cienciasRef.current && !withCiencias) {
        cienciasRef.current.style.display = "";
      }
      if (format === "jpg") {
        const link = document.createElement("a");
        link.download = `alerta-${alerta?.sequencial || "export"}.jpg`;
        link.href = canvas.toDataURL("image/jpeg", 0.95);
        link.click();
      } else {
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF({ orientation: canvas.width > canvas.height ? "landscape" : "portrait", unit: "px", format: [canvas.width, canvas.height] });
        pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
        pdf.save(`alerta-${alerta?.sequencial || "export"}.pdf`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
    }
  };

  const handleExportWithDialog = (format: "jpg" | "pdf") => {
    handleExport(format, includeCiencias);
    setExportDialog(false);
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" /></div>;
  if (!alerta) return <div className="min-h-screen flex items-center justify-center"><p>Alerta não encontrado</p></div>;

  const a = alerta as any;
  const formatSeq = (seq: number) => `AQ-${String(seq).padStart(5, "0")}`;

  const fieldRow = (label: string, value: string, color: "red" | "blue" = "blue") => (
    <div className="space-y-0.5 min-w-0">
      <span className={`text-[10px] font-bold uppercase block ${color === "red" ? "text-[#c0392b]" : "text-[#1a5276]"}`}>{label}</span>
      <p className="text-sm text-foreground bg-muted/20 rounded px-2 py-1 break-words">{value || "—"}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-[#c0392b] text-white">
        <div className="container mx-auto px-3 sm:px-4 py-3">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => navigate("/alerta-qualidade")} className="text-white/80 hover:text-white px-2">
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={exporting}
                className="text-white/80 hover:text-white gap-1 text-xs"
                onClick={() => { setExportDialog(true); setIncludeCiencias(true); }}
              >
                <Download className="w-4 h-4" /> Exportar
              </Button>
              <img src={logo} alt="Hyundai Mobis" className="h-6 sm:h-8 bg-white rounded-md px-2 py-0.5" />
            </div>
          </div>
          <div className="text-center mt-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-wide">ALERTA DE QUALIDADE</h1>
            <p className="text-lg sm:text-xl font-mono font-bold mt-1">{formatSeq(a.sequencial)}</p>
            <Badge className={`mt-1 ${a.status === "ativo" ? "bg-white/20 text-white" : "bg-white/10 text-white/70"}`}>{a.status === "ativo" ? "Ativo" : "Encerrado"}</Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 max-w-4xl space-y-4" ref={contentRef}>
        <div className="bg-[#c0392b] text-white rounded-lg p-3 text-center" style={{ display: "none" }} id="export-header">
          <h2 className="text-lg font-bold">ALERTA DE QUALIDADE {formatSeq(a.sequencial)}</h2>
        </div>

        {/* Fields grid - labels with red color for key fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 form-section">
          {fieldRow("Modelo", a.modelo, "red")}
          {fieldRow("Modo de Falha", a.modo_falha, "red")}
          {fieldRow("Linha/Peça", a.linha_peca, "red")}
          {fieldRow("Local Detectado", a.local_detectado, "red")}
          {fieldRow("Data Ocorrência", a.data_ocorrencia ? new Date(a.data_ocorrencia + "T00:00:00").toLocaleDateString("pt-BR") : "", "red")}
          {fieldRow("Data Validade", a.data_validade ? new Date(a.data_validade + "T00:00:00").toLocaleDateString("pt-BR") : "", "red")}
          {fieldRow("Turno", a.turno, "red")}
          {fieldRow("Responsabilidade", a.responsabilidade, "red")}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3 form-section">
          <div className="md:col-span-2">{fieldRow("Descrição", a.descricao, "red")}</div>
          <div>{fieldRow("VIN", a.vin, "red")}</div>
        </div>

        {/* Photos */}
        {(a.foto_ng_url || a.foto_ok_url) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {a.foto_ng_url && (
              <div>
                <span className="bg-[#c0392b] text-white text-xs font-bold px-3 py-1 rounded inline-block mb-2">NG</span>
                <div className="border-[3px] border-[#c0392b] rounded-lg overflow-hidden cursor-pointer" onClick={() => setPhotoPopup(a.foto_ng_url)}>
                  <img src={a.foto_ng_url} alt="NG" className="w-full object-contain max-h-[250px] hover:opacity-90 transition-opacity" />
                </div>
              </div>
            )}
            {a.foto_ok_url && (
              <div>
                <span className="bg-[#1e8449] text-white text-xs font-bold px-3 py-1 rounded inline-block mb-2">OK</span>
                <div className="border-[3px] border-[#1e8449] rounded-lg overflow-hidden cursor-pointer" onClick={() => setPhotoPopup(a.foto_ok_url)}>
                  <img src={a.foto_ok_url} alt="OK" className="w-full object-contain max-h-[250px] hover:opacity-90 transition-opacity" />
                </div>
              </div>
            )}
          </div>
        )}

        {a.observacoes && (
          <div className="form-section">
            <span className="text-sm font-bold underline">Observações:</span>
            <p className="text-sm text-[#c0392b] font-semibold mt-1">{a.observacoes}</p>
          </div>
        )}

        {/* Brake Point */}
        {(a.sequencia_bp || a.vin_bp) && (
          <div className="bg-[#c0392b] text-white rounded-lg p-3">
            <p className="text-xs font-bold mb-2">Brake Point</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div><span className="text-[10px] opacity-80">Sequência</span><p>{a.sequencia_bp || "—"}</p></div>
              <div><span className="text-[10px] opacity-80">VIN</span><p>{a.vin_bp || "—"}</p></div>
              <div><span className="text-[10px] opacity-80">Emitido</span><p>{a.emitido_por || "—"}</p></div>
            </div>
          </div>
        )}

        {/* Inspetores status */}
        <div className="form-section" ref={cienciasRef}>
          <h3 className="text-sm font-heading font-bold mb-3">Status de Ciência dos Inspetores</h3>
          <div className="divide-y divide-border">
            {inspetores.map((ins: any) => {
              const ciencia = ciencias.find((c: any) => c.inspetor_id === ins.id);
              return (
                <div key={ins.id} className="flex items-center justify-between py-2 gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{ins.full_name}</p>
                    {ins.cargo && <p className="text-xs text-muted-foreground">{ins.cargo}</p>}
                  </div>
                  {ciencia ? (
                    <div className="flex items-center gap-1.5 text-emerald-600 shrink-0">
                      <Check className="w-4 h-4" />
                      <div className="text-right">
                        <p className="text-xs font-medium">Ciente</p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(ciencia.created_at).toLocaleDateString("pt-BR")} • {ciencia.metodo === "qr_lider" ? "QR" : "App"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
                      <Clock className="w-4 h-4" />
                      <span className="text-xs">Pendente</span>
                    </div>
                  )}
                </div>
              );
            })}
            {inspetores.length === 0 && <p className="text-center text-muted-foreground py-4 text-sm">Nenhum inspetor habilitado para esta área</p>}
          </div>
        </div>
      </main>

      {/* Photo popup */}
      <Dialog open={!!photoPopup} onOpenChange={() => setPhotoPopup(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl p-2 sm:p-4">
          {photoPopup && (
            <img src={photoPopup} alt="Foto ampliada" className="w-full max-h-[80vh] object-contain rounded" />
          )}
        </DialogContent>
      </Dialog>

      {/* Export dialog */}
      <Dialog open={exportDialog} onOpenChange={setExportDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Exportar Alerta</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 py-2">
            <Checkbox
              id="include-ciencias-view"
              checked={includeCiencias}
              onCheckedChange={(c) => setIncludeCiencias(!!c)}
            />
            <Label htmlFor="include-ciencias-view" className="text-sm cursor-pointer">
              Incluir lista de ciências
            </Label>
          </div>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExportWithDialog("jpg")} disabled={exporting}>
              JPG
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExportWithDialog("pdf")} disabled={exporting}>
              PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AlertaQualidadeView;
