import { useState, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Package, QrCode, X, AlertTriangle, Camera, ImagePlus, Loader2, Pencil, Send, Barcode, ScanSearch, Sparkles, Factory, Layers, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { parseHyundaiQR, HyundaiQRData } from "@/lib/parseHyundaiQR";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import ReportErrorButton from "@/components/ReportErrorButton";

const READER_ID = "qr-reader-consulta";

const QR_FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
  Html5QrcodeSupportedFormats.AZTEC,
  Html5QrcodeSupportedFormats.PDF_417,
];

const BARCODE_FORMATS = [
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.CODABAR,
];

const ALL_FORMATS = [...QR_FORMATS, ...BARCODE_FORMATS];

const ConsultaPecas = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [scanMode, setScanMode] = useState<"search" | "check">("search");
  const [specDialogOpen, setSpecDialogOpen] = useState(false);
  const [specPart, setSpecPart] = useState<any>(null);

  // Scanner state
  const [typeChooserOpen, setTypeChooserOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [selectedScanType, setSelectedScanType] = useState<"qrcode" | "barcode" | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasScanned = useRef(false);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  // Incompatible dialog
  const [incompatibleOpen, setIncompatibleOpen] = useState(false);
  const [rawQR, setRawQR] = useState("");
  const [sending, setSending] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  // Suffix picker
  const [suffixPickerOpen, setSuffixPickerOpen] = useState(false);
  const [suffixOptions, setSuffixOptions] = useState<Array<{
    part_number: string;
    part_name: string;
    project: string;
    line_module: string;
    supplier_name: string;
  }>>([]);
  const [selectedSuffixPn, setSelectedSuffixPn] = useState("");

  const { data: partNumbers = [], isLoading } = useQuery({
    queryKey: ["consulta-part-numbers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("part_numbers")
        .select("*, suppliers(name, code)")
        .eq("active", true)
        .order("part_number");
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return partNumbers;
    const term = searchTerm.toLowerCase();
    return partNumbers.filter((p: any) =>
      p.part_number?.toLowerCase().includes(term) ||
      p.part_name?.toLowerCase().includes(term) ||
      p.suppliers?.name?.toLowerCase().includes(term) ||
      p.suppliers?.code?.toLowerCase().includes(term) ||
      p.alc_code?.toLowerCase().includes(term)
    );
  }, [partNumbers, searchTerm]);

  const origemBadge = (origem: string | null) => {
    switch (origem) {
      case "CKD": return <Badge className="bg-purple-500/10 text-purple-700 border-purple-200 text-[10px]">CKD</Badge>;
      case "CONSIGNADA": return <Badge className="bg-orange-500/10 text-orange-700 border-orange-200 text-[10px]">CONSIGNADA</Badge>;
      default: return <Badge className="bg-blue-500/10 text-blue-700 border-blue-200 text-[10px]">LP</Badge>;
    }
  };

  // ── Scanner helpers ──

  const getFormats = useCallback(() => {
    if (selectedScanType === "barcode") return BARCODE_FORMATS;
    if (selectedScanType === "qrcode") return QR_FORMATS;
    return ALL_FORMATS;
  }, [selectedScanType]);

  const createScanner = useCallback(() => {
    return new Html5Qrcode(READER_ID, {
      formatsToSupport: getFormats(),
      verbose: false,
    });
  }, [getFormats]);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try { await scanner.stop(); } catch {}
    try { await scanner.clear(); } catch {}
  }, []);

  const closeScanner = useCallback(() => {
    void stopScanner();
    setScannerOpen(false);
    setCameraError(null);
    setIsProcessingImage(false);
  }, [stopScanner]);

  const applyScannedPartNumber = useCallback(async (pn: string) => {
    const pnNormalized = pn.replace(/-/g, "");

    // Search for exact or normalized match
    const exactMatch = partNumbers.find((p: any) =>
      p.part_number === pn || p.part_number.replace(/-/g, "") === pnNormalized
    );

    const openMatch = (part: any) => {
      if (scanMode === "check") {
        setSpecPart(part);
        setSpecDialogOpen(true);
        toast({ title: "Peça identificada!", description: `PN: ${part.part_number}` });
      } else {
        setSearchTerm(part.part_number);
        toast({ title: "Peça encontrada!", description: `PN: ${part.part_number}` });
      }
    };

    if (exactMatch) {
      openMatch(exactMatch);
      return;
    }

    // Strategy 1: scanned PN is the base, DB has base+suffix
    let matches = partNumbers.filter((p: any) => {
      const norm = p.part_number.replace(/-/g, "");
      return norm.length > pnNormalized.length && norm.startsWith(pnNormalized);
    });

    // Strategy 2: scanned PN has suffix, strip last 3 to find siblings
    if (matches.length === 0 && pnNormalized.length > 3) {
      const baseNormalized = pnNormalized.slice(0, -3);
      matches = partNumbers.filter((p: any) => {
        const norm = p.part_number.replace(/-/g, "");
        return norm.startsWith(baseNormalized) && norm.length === baseNormalized.length + 3;
      });
    }

    // Strategy 3: fuzzy match — handle OCR misreads (B↔8, 0↔O, 1↔I, 5↔S)
    if (matches.length === 0 && pnNormalized.length >= 6) {
      const fuzzyNormalize = (s: string) =>
        s.toUpperCase().replace(/8/g, "B").replace(/0/g, "O").replace(/1/g, "I").replace(/5/g, "S");
      const fuzzyScanned = fuzzyNormalize(pnNormalized);
      matches = partNumbers.filter((p: any) => {
        const norm = p.part_number.replace(/-/g, "");
        return fuzzyNormalize(norm) === fuzzyScanned;
      });
      // Also try fuzzy on base (without last 3 suffix chars)
      if (matches.length === 0) {
        const fuzzyBase = fuzzyScanned.slice(0, -3);
        matches = partNumbers.filter((p: any) => {
          const norm = p.part_number.replace(/-/g, "");
          const fuzzyNorm = fuzzyNormalize(norm);
          return fuzzyNorm.length >= fuzzyBase.length && fuzzyNorm.startsWith(fuzzyBase);
        });
      }
    }

    if (matches.length === 1) {
      openMatch(matches[0]);
    } else if (matches.length > 1) {
      const options = matches.map((m: any) => ({
        part_number: m.part_number,
        part_name: m.part_name || "",
        project: m.project || "",
        line_module: m.line_module || "",
        supplier_name: m.suppliers?.name || "",
      }));
      setSuffixOptions(options);
      setSelectedSuffixPn("");
      setSuffixPickerOpen(true);
      toast({ title: "Múltiplas variantes encontradas", description: "Selecione o Part Number correto." });
    } else {
      // No match at all — just set search term
      setSearchTerm(pn);
      toast({ title: "Part Number não cadastrado", description: `Buscando por: ${pn}`, variant: "destructive" });
    }
  }, [partNumbers, toast, scanMode]);

  const handleDecodedText = useCallback((decoded: string) => {
    const parsed = parseHyundaiQR(decoded);

    if (parsed) {
      void applyScannedPartNumber(parsed.partNumber);
      return;
    }

    // For barcodes, the decoded text might be a part number directly
    const cleanDecoded = decoded.trim();
    if (cleanDecoded && !cleanDecoded.includes("\x1d") && cleanDecoded.length >= 5) {
      void applyScannedPartNumber(cleanDecoded);
      return;
    }

    setRawQR(decoded);
    setReportSent(false);
    setIncompatibleOpen(true);
  }, [applyScannedPartNumber]);

  const handleParsedLabel = useCallback((parsed: HyundaiQRData) => {
    void applyScannedPartNumber(parsed.partNumber);
  }, [applyScannedPartNumber]);

  const handleScanTypeChosen = useCallback(async (type: "qrcode" | "barcode") => {
    setSelectedScanType(type);
    setTypeChooserOpen(false);
    hasScanned.current = false;
    setCameraError(null);
    setScannerOpen(true);

    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    if (!document.getElementById(READER_ID)) {
      setCameraError("Elemento do leitor não encontrado. Tente novamente.");
      return;
    }

    const formats = type === "barcode" ? BARCODE_FORMATS : QR_FORMATS;

    try {
      const scanner = new Html5Qrcode(READER_ID, { formatsToSupport: formats, verbose: false });
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: { exact: "environment" } },
        { fps: 25, qrbox: { width: 350, height: type === "barcode" ? 150 : 350 }, aspectRatio: type === "barcode" ? 2 : 1, disableFlip: true },
        (decoded) => {
          if (hasScanned.current) return;
          hasScanned.current = true;
          void stopScanner();
          setScannerOpen(false);
          handleDecodedText(decoded);
        },
        () => {}
      );
    } catch {
      try {
        const scanner = new Html5Qrcode(READER_ID, { formatsToSupport: formats, verbose: false });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 25, qrbox: { width: 350, height: type === "barcode" ? 150 : 350 }, aspectRatio: type === "barcode" ? 2 : 1, disableFlip: true },
          (decoded) => {
            if (hasScanned.current) return;
            hasScanned.current = true;
            void stopScanner();
            setScannerOpen(false);
            handleDecodedText(decoded);
          },
          () => {}
        );
      } catch {
        setCameraError("Não foi possível acessar a câmera. Use a opção de tirar foto.");
      }
    }
  }, [handleDecodedText, stopScanner]);

  // Image processing helpers (same as QRScannerButton)
  const loadImageElement = useCallback((file: File) => {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Falha ao carregar imagem")); };
      img.src = url;
    });
  }, []);

  const canvasToFile = useCallback(async (canvas: HTMLCanvasElement, name: string) => {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 1));
    if (!blob) throw new Error("Falha ao processar imagem");
    return new File([blob], name, { type: "image/png" });
  }, []);

  const fileToDataUrl = useCallback((file: Blob) => {
    return new Promise<string>((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 800;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
          else { width = Math.round((width * MAX) / height); height = MAX; }
        }
        const c = document.createElement("canvas");
        c.width = width; c.height = height;
        c.getContext("2d")!.drawImage(img, 0, 0, width, height);
        resolve(c.toDataURL("image/jpeg", 0.6));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Falha ao converter imagem")); };
      img.src = url;
    });
  }, []);

  const buildImageVariants = useCallback(async (file: File) => {
    const img = await loadImageElement(file);
    const variants: File[] = [file];
    const recipes = [
      { name: "full-contrast", cropX: 0, cropY: 0, cropW: 1, cropH: 1, mode: "contrast" as const },
      { name: "center-contrast", cropX: 0.12, cropY: 0.12, cropW: 0.76, cropH: 0.76, mode: "contrast" as const },
      { name: "center-threshold", cropX: 0.12, cropY: 0.12, cropW: 0.76, cropH: 0.76, mode: "threshold" as const },
    ];
    for (const recipe of recipes) {
      const sx = Math.round(img.width * recipe.cropX);
      const sy = Math.round(img.height * recipe.cropY);
      const sw = Math.max(1, Math.round(img.width * recipe.cropW));
      const sh = Math.max(1, Math.round(img.height * recipe.cropH));
      const scale = Math.max(1, Math.min(2, 800 / Math.max(sw, sh)));
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) continue;
      canvas.width = Math.max(1, Math.round(sw * scale));
      canvas.height = Math.max(1, Math.round(sh * scale));
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
        if (recipe.mode === "threshold") {
          const value = gray > 150 ? 255 : 0;
          d[i] = value; d[i + 1] = value; d[i + 2] = value;
        } else {
          const contrast = 1.9;
          const value = Math.max(0, Math.min(255, (gray - 128) * contrast + 128));
          d[i] = value; d[i + 1] = value; d[i + 2] = value;
        }
      }
      ctx.putImageData(imageData, 0, 0);
      variants.push(await canvasToFile(canvas, `${recipe.name}.png`));
    }
    return variants;
  }, [canvasToFile, loadImageElement]);

  const analyzePhotoLabel = useCallback(async (file: File, variants: File[]) => {
    const images = await Promise.all([file, ...variants.slice(1, 3)].map(fileToDataUrl));
    const { data, error } = await supabase.functions.invoke("extract-label-data", { body: { images } });
    if (error) throw error;
    if (!data?.partNumber) return null;
    return {
      vendorCode: "", partNumber: data.partNumber, supplierCode: "",
      lotNumber: data.lotNumber || "", raw: data.visibleText || data.partNumber,
    } satisfies HyundaiQRData;
  }, [fileToDataUrl]);

  const handleImageSelected = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setCameraError(null);
    setIsProcessingImage(true);

    try {
      await stopScanner();
      const variants = await buildImageVariants(file);
      let decoded: string | null = null;

      const formats = getFormats();
      for (const variant of variants) {
        const scanner = new Html5Qrcode("qr-reader-consulta-tmp", { formatsToSupport: formats, verbose: false });
        try {
          decoded = await scanner.scanFile(variant, true);
          await scanner.clear();
          if (decoded) break;
        } catch { try { await scanner.clear(); } catch {} }
      }

      // Also try ALL formats if specific type didn't work
      if (!decoded) {
        for (const variant of variants) {
          const scanner = new Html5Qrcode("qr-reader-consulta-tmp", { formatsToSupport: ALL_FORMATS, verbose: false });
          try {
            decoded = await scanner.scanFile(variant, true);
            await scanner.clear();
            if (decoded) break;
          } catch { try { await scanner.clear(); } catch {} }
        }
      }

      if (!decoded) {
        const aiParsed = await analyzePhotoLabel(file, variants);
        if (aiParsed) {
          setScannerOpen(false);
          handleParsedLabel(aiParsed);
          toast({ title: "Etiqueta identificada pela foto!" });
          return;
        }
        throw new Error("decode_failed");
      }

      setScannerOpen(false);
      handleDecodedText(decoded);
    } catch {
      setCameraError("Não foi possível ler a etiqueta pela foto. Tente enquadrar mais de perto.");
    } finally {
      setIsProcessingImage(false);
    }
  }, [analyzePhotoLabel, buildImageVariants, getFormats, handleDecodedText, handleParsedLabel, stopScanner, toast]);

  const handleSendReport = async () => {
    setSending(true);
    try {
      await supabase.from("error_reports").insert({
        user_id: user?.id,
        user_name: profile?.full_name || "",
        module: "Leitura QR/Barcode — Consulta de Peças",
        description: `Código incompatível detectado.\n\nConteúdo capturado:\n${rawQR}`,
        photos: [],
      } as any);
      setReportSent(true);
      toast({ title: "Relatório enviado ao HelpDesk!" });
    } catch {
      toast({ title: "Erro ao enviar", variant: "destructive" });
    } finally { setSending(false); }
  };

  const applySuffixSelection = (option: typeof suffixOptions[0]) => {
    setSuffixPickerOpen(false);
    if (scanMode === "check") {
      const full = partNumbers.find((p: any) => p.part_number === option.part_number);
      if (full) {
        setSpecPart(full);
        setSpecDialogOpen(true);
        toast({ title: "Peça identificada!", description: `PN: ${option.part_number}` });
        return;
      }
    }
    setSearchTerm(option.part_number);
    toast({ title: "Peça selecionada!", description: `PN: ${option.part_number}` });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-12">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-accent flex items-center justify-center">
                <Search className="w-4 h-4 md:w-5 md:h-5 text-accent-foreground" />
              </div>
              <span className="text-xs md:text-sm font-medium tracking-wider uppercase opacity-80">Consulta de Peças</span>
            </div>
            <div className="flex items-center gap-1 md:gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 px-2 md:px-3">
                <ArrowLeft className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">Hub</span>
              </Button>
              <ReportErrorButton moduleName="Consulta de Peças" />
            </div>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-4xl font-heading font-bold mt-3 md:mt-4">Consulta de Peças</h1>
          <p className="hidden sm:block mt-1 md:mt-2 text-primary-foreground/70 max-w-xl text-xs sm:text-sm md:text-lg">Pesquise peças por Part Number, nome, fornecedor ou ALC Code.</p>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 -mt-6 pb-12 flex flex-col" style={{ height: "calc(100vh - 180px)" }}>
        <div className="form-section shrink-0 sticky top-0 z-10 bg-card shadow-sm">
          <div className="flex gap-2 w-full">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por Part Number, nome, fornecedor..."
                className="pl-10 h-12 text-base"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              title="Buscar por QR / Código de Barras"
              className="h-12 w-12 shrink-0 border-primary/30 bg-primary/5 hover:bg-primary/10"
              onClick={() => { setScanMode("search"); setTypeChooserOpen(true); }}
            >
              <QrCode className="w-5 h-5" />
            </Button>
            <Button
              type="button"
              variant="default"
              className="h-12 shrink-0 gap-2 bg-gradient-to-br from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white shadow-md hidden sm:flex"
              onClick={() => { setScanMode("check"); setTypeChooserOpen(true); }}
            >
              <ScanSearch className="w-5 h-5" />
              <span className="font-semibold">Checar SPEC/ALC</span>
            </Button>
            <Button
              type="button"
              variant="default"
              size="icon"
              title="Checar SPEC/ALC"
              className="h-12 w-12 shrink-0 bg-gradient-to-br from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white shadow-md sm:hidden"
              onClick={() => { setScanMode("check"); setTypeChooserOpen(true); }}
            >
              <ScanSearch className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Hidden element for scanFile */}
        <div id="qr-reader-consulta-tmp" className="hidden" />

        <div className="flex-1 overflow-y-auto mt-4 space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" /></div>
        ) : filtered.length === 0 ? (
          <div className="form-section text-center py-12">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">{searchTerm ? "Nenhuma peça encontrada" : "Digite para buscar peças"}</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((p: any) => (
              <div key={p.id} className="form-section hover:border-accent/30 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-heading font-bold text-foreground">{p.part_number}</span>
                      {origemBadge(p.origem)}
                    </div>
                    <p className="text-sm font-medium text-foreground">{p.part_name}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
                      <span className="text-muted-foreground">Fornecedor: <span className="font-semibold text-blue-700">{p.suppliers?.name || "—"}</span></span>
                      <span className="text-muted-foreground">Code Vendor: <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 border-amber-400 text-amber-700 bg-amber-50">{p.suppliers?.code || "—"}</Badge></span>
                      <span className="text-muted-foreground">ALC Code: <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 border-violet-400 text-violet-700 bg-violet-50">{p.alc_code || "N/A"}</Badge></span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
                      <span className="text-muted-foreground">Projeto: <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-400 text-emerald-700 bg-emerald-50">{p.project || "—"}</Badge></span>
                      <span className="text-muted-foreground">Linha/Módulo: <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-cyan-400 text-cyan-700 bg-cyan-50">{p.line_module || "—"}</Badge></span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground text-center">{filtered.length} peça(s) encontrada(s)</p>
          </div>
        )}
        </div>
      </main>

      {/* Type Chooser Dialog */}
      <Dialog open={typeChooserOpen} onOpenChange={setTypeChooserOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-xs p-4">
          <DialogHeader>
            <DialogTitle>Tipo de Leitura</DialogTitle>
            <DialogDescription>Selecione o tipo de código para escanear:</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-2">
            <Button
              variant="outline"
              className="w-full gap-3 min-h-[56px] text-left justify-start"
              onClick={() => { setTypeChooserOpen(false); handleScanTypeChosen("qrcode"); }}
            >
              <QrCode className="w-6 h-6 shrink-0" />
              <div>
                <p className="font-semibold text-sm">QR Code / Data Matrix</p>
                <p className="text-xs text-muted-foreground">Etiquetas Hyundai Mobis, QR Codes</p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full gap-3 min-h-[56px] text-left justify-start"
              onClick={() => { setTypeChooserOpen(false); handleScanTypeChosen("barcode"); }}
            >
              <Barcode className="w-6 h-6 shrink-0" />
              <div>
                <p className="font-semibold text-sm">Código de Barras</p>
                <p className="text-xs text-muted-foreground">Code 128, Code 39, EAN, UPC</p>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Scanner Dialog */}
      <Dialog open={scannerOpen} onOpenChange={(open) => { if (!open) closeScanner(); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-sm p-3 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-10">
              {selectedScanType === "barcode" ? <Barcode className="w-5 h-5" /> : <QrCode className="w-5 h-5" />}
              {selectedScanType === "barcode" ? "Escanear Código de Barras" : "Escanear QR Code"}
            </DialogTitle>
            <Button variant="ghost" size="icon" className="absolute right-3 top-3" onClick={closeScanner}>
              <X className="w-4 h-4" />
            </Button>
          </DialogHeader>
          <div className="space-y-3">
            {cameraError && (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <AlertTriangle className="w-10 h-10 text-amber-500" />
                <p className="text-sm text-muted-foreground">{cameraError}</p>
              </div>
            )}

            <div id={READER_ID} className="w-full min-h-[280px] rounded-lg overflow-hidden bg-muted" />

            <p className="text-xs text-muted-foreground text-center">
              {selectedScanType === "barcode"
                ? "Aponte a câmera para o código de barras da peça."
                : "Aponte a câmera para o QR Code / Data Matrix da etiqueta."}
            </p>

            <div className="flex flex-col gap-2">
              <Button type="button" onClick={() => cameraInputRef.current?.click()} variant="secondary" className="w-full gap-2 min-h-[44px]">
                {isProcessingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                {isProcessingImage ? "Lendo foto..." : "Tirar foto da etiqueta"}
              </Button>
              <Button type="button" onClick={() => galleryInputRef.current?.click()} variant="outline" className="w-full gap-2 min-h-[44px]">
                <ImagePlus className="w-4 h-4" />
                Escolher foto da galeria
              </Button>
            </div>

            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageSelected} />
            <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelected} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Incompatible Dialog */}
      <Dialog open={incompatibleOpen} onOpenChange={setIncompatibleOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Código Incompatível
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Este código não foi reconhecido.</p>
              <p className="text-xs text-amber-700 dark:text-amber-300">Reporte ao HelpDesk para análise.</p>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Conteúdo capturado</p>
              <div className="bg-muted rounded-lg p-3 max-h-24 overflow-y-auto">
                <code className="text-xs break-all">{rawQR || "—"}</code>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={() => setIncompatibleOpen(false)} className="w-full gap-2 min-h-[44px]">
                <Pencil className="w-4 h-4" />
                Buscar manualmente
              </Button>
              {!reportSent ? (
                <Button variant="outline" onClick={handleSendReport} disabled={sending} className="w-full gap-2 min-h-[44px]">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Reportar ao HelpDesk
                </Button>
              ) : (
                <p className="text-center text-sm text-emerald-600 dark:text-emerald-400 font-medium py-2">✓ Relatório enviado</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Suffix Picker Dialog */}
      <Dialog open={suffixPickerOpen} onOpenChange={setSuffixPickerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Selecionar Variante
            </DialogTitle>
            <DialogDescription className="text-sm">
              O Part Number lido possui variantes de cor/sufixo. Selecione o correto:
            </DialogDescription>
          </DialogHeader>
          <RadioGroup value={selectedSuffixPn} onValueChange={setSelectedSuffixPn} className="space-y-2">
            {suffixOptions.map((opt) => {
              const suffix = opt.part_number.replace(/-/g, "").slice(-3);
              return (
                <label
                  key={opt.part_number}
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    selectedSuffixPn === opt.part_number ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <RadioGroupItem value={opt.part_number} className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-sm">{opt.part_number}</span>
                      <Badge variant="outline" className="text-[10px]">{suffix}</Badge>
                    </div>
                    {opt.part_name && <p className="text-xs text-muted-foreground mt-0.5 truncate">{opt.part_name}</p>}
                    {opt.supplier_name && <p className="text-xs text-muted-foreground truncate">{opt.supplier_name}</p>}
                  </div>
                </label>
              );
            })}
          </RadioGroup>
          <Button
            onClick={() => {
              const selected = suffixOptions.find((o) => o.part_number === selectedSuffixPn);
              if (selected) applySuffixSelection(selected);
            }}
            disabled={!selectedSuffixPn}
            className="w-full mt-2"
          >
            Confirmar
          </Button>
        </DialogContent>
      </Dialog>

      {/* Spec / ALC Dialog */}
      <Dialog open={specDialogOpen} onOpenChange={setSpecDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg md:max-w-xl p-0 overflow-hidden border-0">
          {specPart && (
            <div className="flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-600 px-5 py-4 text-white relative">
                <div className="flex items-center gap-2 mb-1 opacity-90">
                  <ScanSearch className="w-4 h-4" />
                  <span className="text-xs font-medium tracking-wider uppercase">Resultado da Leitura</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-heading font-bold leading-tight font-mono break-all">
                  {specPart.part_number}
                </h2>
                <p className="text-sm md:text-base opacity-90 mt-1">{specPart.part_name || "—"}</p>
                <div className="mt-2">{origemBadge(specPart.origem)}</div>
              </div>

              {/* Body */}
              <div className="px-5 py-4 space-y-4 overflow-y-auto">
                {/* ALC Highlight */}
                <div className={`rounded-xl p-4 border-2 ${
                  specPart.alc_code
                    ? "bg-gradient-to-br from-violet-50 to-fuchsia-50 dark:from-violet-950/40 dark:to-fuchsia-950/40 border-violet-400 dark:border-violet-600 shadow-lg shadow-violet-200/50 dark:shadow-violet-900/30"
                    : "bg-muted/40 border-dashed border-muted-foreground/30"
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className={`w-5 h-5 ${specPart.alc_code ? "text-violet-600 dark:text-violet-400" : "text-muted-foreground"}`} />
                    <span className={`text-sm font-bold uppercase tracking-wider ${
                      specPart.alc_code ? "text-violet-700 dark:text-violet-300" : "text-muted-foreground"
                    }`}>
                      ALC Code
                    </span>
                  </div>
                  {specPart.alc_code ? (
                    <p className="font-mono font-bold text-3xl md:text-4xl text-violet-900 dark:text-violet-100 break-all text-center py-2">
                      {specPart.alc_code}
                    </p>
                  ) : (
                    <p className="text-base text-muted-foreground text-center py-2 italic">
                      Sem ALC cadastrado
                    </p>
                  )}
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-lg border bg-card p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <Factory className="w-3.5 h-3.5" /> Fornecedor
                    </div>
                    <p className="text-base font-semibold text-foreground break-words">
                      {specPart.suppliers?.name || "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-card p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <Hash className="w-3.5 h-3.5" /> Code Vendor
                    </div>
                    <p className="text-base font-mono font-semibold text-amber-700 dark:text-amber-400">
                      {specPart.suppliers?.code || "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-card p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <Layers className="w-3.5 h-3.5" /> Projeto
                    </div>
                    <p className="text-base font-semibold text-emerald-700 dark:text-emerald-400">
                      {specPart.project || "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-card p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <Package className="w-3.5 h-3.5" /> Linha / Módulo
                    </div>
                    <p className="text-base font-semibold text-cyan-700 dark:text-cyan-400">
                      {specPart.line_module || "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t bg-muted/30 flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  className="flex-1 min-h-[44px]"
                  onClick={() => {
                    setSearchTerm(specPart.part_number);
                    setSpecDialogOpen(false);
                  }}
                >
                  <Search className="w-4 h-4 mr-2" /> Ver na lista
                </Button>
                <Button
                  className="flex-1 min-h-[44px] bg-gradient-to-br from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white"
                  onClick={() => {
                    setSpecDialogOpen(false);
                    setScanMode("check");
                    setTypeChooserOpen(true);
                  }}
                >
                  <ScanSearch className="w-4 h-4 mr-2" /> Ler outra
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConsultaPecas;
