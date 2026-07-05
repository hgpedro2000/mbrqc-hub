import { useState, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Package, QrCode, AlertTriangle, ScanSearch, Sparkles, Factory, Layers, Hash, ShieldCheck, Barcode, LayoutList, LayoutGrid, Rows3 } from "lucide-react";
import HKMCScanner from "@/components/HKMCScanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { HyundaiQRData, parseHyundaiQR } from "@/lib/parseHyundaiQR";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import LanguageToggle from "@/components/LanguageToggle";

import ReportErrorButton from "@/components/ReportErrorButton";
import { QRScannerButton, type QRScannerButtonHandle } from "@/components/apontamento/QRScannerButton";
import { useIsMobile } from "@/hooks/use-mobile";

const ConsultaPecas = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [scanMode, setScanMode] = useState<"search" | "check">("search");
  const [specDialogOpen, setSpecDialogOpen] = useState(false);
  const [specPart, setSpecPart] = useState<any>(null);
  const [hkmcOpen, setHkmcOpen] = useState(false);
  const [specReaderOpen, setSpecReaderOpen] = useState(false);
  const [specReaderInput, setSpecReaderInput] = useState("");
  const specReaderInputRef = useRef<HTMLInputElement | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grid" | "compact">("list");
  const cycleViewMode = () =>
    setViewMode((m) => (m === "list" ? "grid" : m === "grid" ? "compact" : "list"));
  const viewModeMeta = {
    list: { icon: LayoutList, label: t("consultaPecas.viewMode.large") },
    grid: { icon: LayoutGrid, label: t("consultaPecas.viewMode.normal") },
    compact: { icon: Rows3, label: t("consultaPecas.viewMode.compact") },
  } as const;
  const ViewIcon = viewModeMeta[viewMode].icon;

  // Scanner refs (reuse Apontamento incoming logic)
  const qrScannerRef = useRef<QRScannerButtonHandle | null>(null);

  // Open SPEC/ALC: camera on mobile, barcode-reader dialog on desktop
  const openSpecScanner = useCallback(() => {
    setScanMode("check");
    if (isMobile) {
      qrScannerRef.current?.openScanner();
    } else {
      setSpecReaderInput("");
      setSpecReaderOpen(true);
      setTimeout(() => specReaderInputRef.current?.focus(), 100);
    }
  }, [isMobile]);


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

  // ── Scanner: usa o mesmo componente do Apontamento (Incoming) ──


  const applyScannedPartNumber = useCallback(async (pn: string) => {
    const pnNormalized = pn.replace(/-/g, "");

    // Search for exact or normalized match
    const exactMatch = partNumbers.find((p: any) =>
      p.part_number === pn || p.part_number.replace(/-/g, "") === pnNormalized
    );

    const openMatch = (part: any) => {
      // Feedback tátil/sonoro ao capturar
      try { navigator.vibrate?.([60, 30, 60]); } catch { /* noop */ }
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = 880; g.gain.value = 0.08;
        o.start(); o.stop(ctx.currentTime + 0.12);
      } catch { /* noop */ }
      if (scanMode === "check") {
        setSpecReaderOpen(false);
        setSpecPart(part);
        setSpecDialogOpen(true);
        toast({ title: t("consultaPecas.toasts.partIdentified"), description: t("consultaPecas.toasts.pnLabel", { pn: part.part_number }) });
      } else {
        setSearchTerm(part.part_number);
        toast({ title: t("consultaPecas.toasts.partFound"), description: t("consultaPecas.toasts.pnLabel", { pn: part.part_number }) });
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
      toast({ title: t("consultaPecas.toasts.multipleVariants"), description: t("consultaPecas.toasts.selectCorrectPn") });
    } else {
      // No match at all — just set search term
      setSearchTerm(pn);
      toast({ title: t("consultaPecas.toasts.pnNotRegistered"), description: t("consultaPecas.toasts.searchingFor", { pn }), variant: "destructive" });
    }
  }, [partNumbers, toast, scanMode, t]);

  const handleQRScan = useCallback((data: HyundaiQRData) => {
    void applyScannedPartNumber(data.partNumber);
  }, [applyScannedPartNumber]);


  const applySuffixSelection = (option: typeof suffixOptions[0]) => {
    setSuffixPickerOpen(false);
    if (scanMode === "check") {
      const full = partNumbers.find((p: any) => p.part_number === option.part_number);
      if (full) {
        setSpecPart(full);
        setSpecDialogOpen(true);
        toast({ title: t("consultaPecas.toasts.partIdentified"), description: t("consultaPecas.toasts.pnLabel", { pn: option.part_number }) });
        return;
      }
    }
    setSearchTerm(option.part_number);
    toast({ title: t("consultaPecas.toasts.partSelected"), description: t("consultaPecas.toasts.pnLabel", { pn: option.part_number }) });
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
              <span className="text-xs md:text-sm font-medium tracking-wider uppercase opacity-80">{t("consultaPecas.moduleName")}</span>
            </div>
            <div className="flex items-center gap-1 md:gap-2">
              <LanguageToggle />
              <Button variant="ghost" onClick={() => navigate("/")} className="header-btn px-2 md:px-3">
                <ArrowLeft className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">{t("consultaPecas.hub")}</span>
              </Button>
              <ReportErrorButton moduleName={t("consultaPecas.moduleName")} />
            </div>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-4xl font-heading font-bold mt-3 md:mt-4">{t("consultaPecas.title")}</h1>
          <p className="hidden sm:block mt-1 md:mt-2 text-primary-foreground/70 max-w-2xl text-xs sm:text-sm md:text-lg">{t("consultaPecas.subtitle")}</p>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 mt-3 sm:-mt-6 pb-12 flex flex-col" style={{ height: "calc(100vh - 180px)" }}>
        <div className="form-section shrink-0 sticky top-0 z-10 bg-card shadow-sm">
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <div className="relative w-full sm:flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t("consultaPecas.searchPlaceholder")}
                className="pl-10 h-12 text-base w-full"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex">
              <Button
                type="button"
                variant="outline"
                className="h-11 sm:h-12 px-2 sm:px-3 gap-1.5 text-xs sm:text-sm border-primary/30 bg-primary/5 hover:bg-primary/10 w-full sm:w-32 justify-center"
                onClick={() => { setScanMode("search"); qrScannerRef.current?.openScanner(); }}
                title={t("consultaPecas.buttons.qrTitle")}
              >
                <QrCode className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span className="font-semibold truncate">{t("consultaPecas.buttons.qr")}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 sm:h-12 px-2 sm:px-3 gap-1.5 text-xs sm:text-sm border-sky-400/40 bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 w-full sm:w-32 justify-center"
                onClick={() => setHkmcOpen(true)}
                title={t("consultaPecas.buttons.hkmcTitle")}
              >
                <Barcode className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span className="font-semibold truncate">{t("consultaPecas.buttons.hkmc")}</span>
              </Button>
              <Button
                type="button"
                variant="default"
                className="h-11 sm:h-12 px-2 sm:px-3 gap-1.5 text-xs sm:text-sm bg-gradient-to-br from-slate-700 to-slate-900 hover:from-slate-800 hover:to-black text-white shadow-md w-full sm:w-32 justify-center"
                onClick={openSpecScanner}
                title={t("consultaPecas.buttons.specAlcTitle")}
              >
                <ScanSearch className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span className="font-semibold truncate">{t("consultaPecas.buttons.specAlc")}</span>
              </Button>
              <Button
                type="button"
                variant="default"
                className="h-11 sm:h-12 px-2 sm:px-3 gap-1.5 text-xs sm:text-sm bg-gradient-to-br from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md w-full sm:w-32 justify-center"
                onClick={() => navigate("/spec-switch-panel")}
                title={t("consultaPecas.buttons.panelSwitchTitle")}
              >
                <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span className="font-semibold truncate">{t("consultaPecas.buttons.panelSwitch")}</span>
              </Button>
            </div>
          </div>
        </div>


        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{t("consultaPecas.viewMode.label")}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={cycleViewMode}
            className="h-9 gap-2 border-accent/40 hover:bg-accent/10"
            title={t("consultaPecas.viewMode.title")}
          >
            <ViewIcon className="w-4 h-4" />
            <span className="font-semibold">{viewModeMeta[viewMode].label}</span>
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto mt-4 space-y-4">

        {isLoading ? (
          <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" /></div>
        ) : filtered.length === 0 ? (
          <div className="form-section text-center py-12">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">{searchTerm ? t("consultaPecas.emptySearch") : t("consultaPecas.emptyType")}</p>
          </div>
        ) : viewMode === "compact" ? (
          <div className="form-section p-0 overflow-hidden">
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur shadow-sm">
                  <tr className="text-left">
                    <th className="px-2 py-2 font-semibold whitespace-nowrap">{t("consultaPecas.table.partNumber")}</th>
                    <th className="px-2 py-2 font-semibold">{t("consultaPecas.table.description")}</th>
                    <th className="px-2 py-2 font-semibold whitespace-nowrap">{t("consultaPecas.table.supplier")}</th>
                    <th className="px-2 py-2 font-semibold whitespace-nowrap">{t("consultaPecas.table.codeVendor")}</th>
                    <th className="px-2 py-2 font-semibold whitespace-nowrap">{t("consultaPecas.table.alcCode")}</th>
                    <th className="px-2 py-2 font-semibold whitespace-nowrap">{t("consultaPecas.table.project")}</th>
                    <th className="px-2 py-2 font-semibold whitespace-nowrap">{t("consultaPecas.table.lineModule")}</th>
                    <th className="px-2 py-2 font-semibold whitespace-nowrap">{t("consultaPecas.table.origin")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p: any) => {
                    const hasAlc = p.alc_code && p.alc_code !== "N/A";
                    return (
                    <tr key={p.id} className={`border-t border-border/60 hover:bg-accent/5 ${hasAlc ? "bg-rose-50/60" : ""}`}>
                      <td className="px-2 py-1.5 font-heading font-bold text-foreground whitespace-nowrap">{p.part_number}</td>
                      <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[220px]">{p.part_name}</td>
                      <td className="px-2 py-1.5 font-semibold text-blue-700 whitespace-nowrap">{p.suppliers?.name || "—"}</td>
                      <td className="px-2 py-1.5"><Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 border-amber-400 text-amber-700 bg-amber-50">{p.suppliers?.code || "—"}</Badge></td>
                      <td className="px-2 py-1.5"><Badge variant="outline" className={`font-mono text-[10px] px-1.5 py-0 ${hasAlc ? "border-rose-500 text-rose-800 bg-rose-100 font-bold" : "border-violet-400 text-violet-700 bg-violet-50"}`}>{p.alc_code || "N/A"}</Badge></td>
                      <td className="px-2 py-1.5"><Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-400 text-emerald-700 bg-emerald-50">{p.project || "—"}</Badge></td>
                      <td className="px-2 py-1.5"><Badge variant="outline" className="text-[10px] px-1.5 py-0 border-cyan-400 text-cyan-700 bg-cyan-50">{p.line_module || "—"}</Badge></td>
                      <td className="px-2 py-1.5">{origemBadge(p.origem)}</td>
                    </tr>
                    );
                  })}

                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground text-center py-2 border-t border-border/60">{t("consultaPecas.found", { count: filtered.length })}</p>
          </div>
        ) : (
          <div className={
            viewMode === "grid"
              ? "grid gap-3 sm:grid-cols-2"
              : "grid gap-3"
          }>
            {filtered.map((p: any) => (
              <div key={p.id} className={`form-section ${viewMode === "grid" ? "p-3 md:p-4" : "md:p-5"} hover:border-accent/30 transition-colors`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className={`${viewMode === "grid" ? "space-y-1.5" : "space-y-1.5 md:space-y-2.5"} flex-1 min-w-0`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-heading font-bold text-foreground ${viewMode === "grid" ? "text-base md:text-lg" : "text-base md:text-2xl"}`}>{p.part_number}</span>
                      {origemBadge(p.origem)}
                    </div>
                    <p className={`font-medium text-foreground ${viewMode === "grid" ? "text-sm" : "text-sm md:text-lg"}`}>{p.part_name}</p>
                    <div className={`flex flex-wrap gap-x-4 md:gap-x-6 gap-y-1.5 ${viewMode === "grid" ? "text-xs" : "text-xs md:text-base"}`}>
                      <span className="text-muted-foreground">{t("consultaPecas.card.supplier")}: <span className="font-semibold text-blue-700">{p.suppliers?.name || "—"}</span></span>
                      <span className="text-muted-foreground">{t("consultaPecas.card.codeVendor")}: <Badge variant="outline" className={`font-mono px-1.5 md:px-2 py-0 md:py-0.5 border-amber-400 text-amber-700 bg-amber-50 ${viewMode === "grid" ? "text-[10px]" : "text-[10px] md:text-sm"}`}>{p.suppliers?.code || "—"}</Badge></span>
                      <span className="text-muted-foreground">{t("consultaPecas.card.alcCode")}: <Badge variant="outline" className={`font-mono px-1.5 md:px-2 py-0 md:py-0.5 ${p.alc_code && p.alc_code !== "N/A" ? "border-rose-500 text-rose-800 bg-rose-100 font-bold" : "border-violet-400 text-violet-700 bg-violet-50"} ${viewMode === "grid" ? "text-[10px]" : "text-[10px] md:text-sm"}`}>{p.alc_code || "N/A"}</Badge></span>
                    </div>
                    <div className={`flex flex-wrap gap-x-4 md:gap-x-6 gap-y-1.5 ${viewMode === "grid" ? "text-xs" : "text-xs md:text-base"}`}>
                      <span className="text-muted-foreground">{t("consultaPecas.card.project")}: <Badge variant="outline" className={`px-1.5 md:px-2 py-0 md:py-0.5 border-emerald-400 text-emerald-700 bg-emerald-50 ${viewMode === "grid" ? "text-[10px]" : "text-[10px] md:text-sm"}`}>{p.project || "—"}</Badge></span>
                      <span className="text-muted-foreground">{t("consultaPecas.card.lineModule")}: <Badge variant="outline" className={`px-1.5 md:px-2 py-0 md:py-0.5 border-cyan-400 text-cyan-700 bg-cyan-50 ${viewMode === "grid" ? "text-[10px]" : "text-[10px] md:text-sm"}`}>{p.line_module || "—"}</Badge></span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground text-center sm:col-span-2">{t("consultaPecas.found", { count: filtered.length })}</p>
          </div>
        )}

        </div>
      </main>

      {/* Scanners ocultos — reaproveitam toda a lógica do Apontamento (Incoming) */}
      <div className="hidden">
        <QRScannerButton ref={qrScannerRef} onScan={handleQRScan} />
      </div>


      {/* Suffix Picker Dialog */}
      <Dialog open={suffixPickerOpen} onOpenChange={setSuffixPickerOpen}>
        <DialogContent className="w-[96vw] max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              {t("consultaPecas.suffix.title")}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {t("consultaPecas.suffix.description")}
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
            {t("consultaPecas.suffix.confirm")}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Spec / ALC Dialog — Cinematic reveal */}
      <Dialog open={specDialogOpen} onOpenChange={setSpecDialogOpen}>
        <DialogContent
          className="max-w-[96vw] sm:max-w-lg md:max-w-2xl p-0 overflow-hidden border-0 w-[96vw] sm:w-auto bg-transparent shadow-none"
        >
          {specPart && (
            <div className="relative rounded-2xl overflow-hidden animate-scale-in max-h-[92vh] flex flex-col shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] ring-1 ring-white/10">
              {/* Ambient background */}
              <div className="absolute inset-0 -z-10 bg-slate-950" />
              <div className="absolute inset-0 -z-10 opacity-70 bg-[radial-gradient(circle_at_20%_-10%,rgba(251,191,36,0.35),transparent_55%),radial-gradient(circle_at_120%_110%,rgba(56,189,248,0.30),transparent_55%),radial-gradient(circle_at_50%_130%,rgba(168,85,247,0.25),transparent_60%)]" />
              <div className="absolute inset-0 -z-10 opacity-[0.08] mix-blend-overlay [background-image:linear-gradient(rgba(255,255,255,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:28px_28px]" />

              {/* Header */}
              <div className="relative px-4 sm:px-6 pt-5 sm:pt-6 pb-4 sm:pb-5 text-white">
                <div className="flex items-center justify-between mb-3">
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[10px] sm:text-xs font-medium tracking-[0.18em] uppercase">
                    <ScanSearch className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    {t("consultaPecas.spec.headerLabel")}
                  </div>
                  <div className="animate-fade-in">{origemBadge(specPart.origem)}</div>
                </div>
                <p className="text-[10px] sm:text-[11px] uppercase tracking-widest text-white/50 mb-1">Part Number</p>
                <h2 className="font-mono font-bold leading-none text-2xl sm:text-4xl md:text-5xl break-all bg-clip-text text-transparent bg-gradient-to-br from-white via-white to-white/60 drop-shadow-[0_2px_20px_rgba(255,255,255,0.15)]">
                  {specPart.part_number}
                </h2>
                <p className="text-sm sm:text-base text-white/70 mt-2 break-words">{specPart.part_name || "—"}</p>
              </div>

              {/* Body */}
              <div className="relative px-4 sm:px-6 pb-4 sm:pb-5 space-y-4 overflow-y-auto">
                {/* ALC — spotlight */}
                <div className="relative">
                  <div className={`absolute inset-0 rounded-2xl blur-2xl opacity-70 ${specPart.alc_code ? "bg-gradient-to-r from-amber-500/40 via-orange-500/40 to-amber-400/40" : "bg-white/5"}`} />
                  <div className={`relative rounded-2xl border backdrop-blur-xl px-4 sm:px-6 py-4 sm:py-5 ${
                    specPart.alc_code
                      ? "bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-amber-400/15 border-amber-300/40"
                      : "bg-white/[0.03] border-white/10 border-dashed"
                  }`}>
                    <div className="flex items-center justify-center gap-2 mb-2 sm:mb-3">
                      <Sparkles className={`w-4 h-4 sm:w-5 sm:h-5 ${specPart.alc_code ? "text-amber-300 animate-pulse" : "text-white/40"}`} />
                      <span className={`text-[11px] sm:text-xs font-bold uppercase tracking-[0.22em] ${specPart.alc_code ? "text-amber-200" : "text-white/50"}`}>
                        {t("consultaPecas.spec.alcCode")}
                      </span>
                      <Sparkles className={`w-4 h-4 sm:w-5 sm:h-5 ${specPart.alc_code ? "text-amber-300 animate-pulse" : "text-white/40"}`} />
                    </div>
                    {specPart.alc_code ? (
                      <p className="font-mono font-black text-center text-4xl sm:text-5xl md:text-6xl leading-none tracking-tight break-all text-white [text-shadow:0_0_30px_rgba(251,191,36,0.55)] animate-fade-in">
                        {specPart.alc_code}
                      </p>
                    ) : (
                      <p className="text-sm sm:text-base text-white/60 text-center py-1 sm:py-2 italic">
                        {t("consultaPecas.spec.noAlcRegistered")}
                      </p>
                    )}
                  </div>
                </div>

                {/* Info chips */}
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {[
                    { icon: Factory, label: t("consultaPecas.spec.supplier"), value: specPart.suppliers?.name || "—", accent: "text-sky-200" },
                    { icon: Hash, label: t("consultaPecas.spec.codeVendor"), value: specPart.suppliers?.code || "—", accent: "text-amber-200", mono: true },
                    { icon: Layers, label: t("consultaPecas.spec.project"), value: specPart.project || "—", accent: "text-emerald-200" },
                    { icon: Package, label: t("consultaPecas.spec.lineModule"), value: specPart.line_module || "—", accent: "text-fuchsia-200" },
                  ].map((c, i) => (
                    <div
                      key={i}
                      className="group relative rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-2.5 sm:p-3 min-w-0 transition-all hover:bg-white/[0.08] hover:border-white/20 hover:-translate-y-0.5"
                    >
                      <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] uppercase tracking-wider text-white/50 mb-1">
                        <c.icon className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                        <span className="truncate">{c.label}</span>
                      </div>
                      <p className={`text-sm sm:text-base font-semibold break-words ${c.accent} ${c.mono ? "font-mono" : ""}`}>
                        {c.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="relative px-4 sm:px-6 py-3 sm:py-3.5 border-t border-white/10 bg-black/40 backdrop-blur-xl flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 min-h-[42px] text-xs sm:text-sm bg-white/5 border-white/15 text-white hover:bg-white/10 hover:text-white"
                  onClick={() => {
                    setSearchTerm(specPart.part_number);
                    setSpecDialogOpen(false);
                  }}
                >
                  <Search className="w-4 h-4 mr-2" /> {t("consultaPecas.spec.viewInList")}
                </Button>
                <Button
                  size="sm"
                  className="flex-1 min-h-[42px] text-xs sm:text-sm bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:via-orange-400 hover:to-amber-400 text-slate-950 font-semibold shadow-lg shadow-amber-500/30"
                  onClick={() => {
                    setSpecDialogOpen(false);
                    setTimeout(() => openSpecScanner(), 150);
                  }}
                >
                  <ScanSearch className="w-4 h-4 mr-2" /> {t("consultaPecas.spec.readAnother")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>


      {/* HKMC Barcode Scanner Dialog */}
      <Dialog open={hkmcOpen} onOpenChange={setHkmcOpen}>
        <DialogContent className="w-[96vw] max-w-2xl p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle className="flex items-center gap-2"><Barcode className="w-5 h-5 text-sky-600" /> {t("consultaPecas.hkmc.title")}</DialogTitle>
            <DialogDescription>{t("consultaPecas.hkmc.description")}</DialogDescription>
          </DialogHeader>
          <div className="p-2">
            <HKMCScanner />
          </div>
        </DialogContent>
      </Dialog>

      {/* Desktop SPEC/ALC Barcode Reader Dialog (HW scanner / manual) */}
      <Dialog open={specReaderOpen} onOpenChange={setSpecReaderOpen}>
        <DialogContent className="w-[96vw] max-w-md p-0 overflow-hidden border-0">
          <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-black px-5 py-4 text-white">
            <div className="flex items-center gap-2 mb-1 opacity-90">
              <ScanSearch className="w-4 h-4" />
              <span className="text-xs font-medium tracking-wider uppercase">{t("consultaPecas.specReader.label")}</span>
            </div>
            <DialogTitle className="text-xl font-bold text-white">{t("consultaPecas.specReader.title")}</DialogTitle>
            <DialogDescription className="text-white/85 text-sm">
              {t("consultaPecas.specReader.description")}
            </DialogDescription>
          </div>
          <form
            className="p-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const val = specReaderInput.trim();
              if (!val) return;
              // Try to extract the Part Number from a full Hyundai QR payload
              // (e.g. "[)><rs>06<gs>VBZWC<gs>P84705BP050YJT<gs>SLL43<gs>T...").
              // Falls back to the raw value when it's already a clean PN.
              const parsed = parseHyundaiQR(val);
              const pn = parsed?.partNumber || val;
              void applyScannedPartNumber(pn);
              setSpecReaderInput("");
            }}
          >
            <div className="relative">
              <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-violet-500" />
              <Input
                ref={specReaderInputRef}
                value={specReaderInput}
                onChange={(e) => setSpecReaderInput(e.target.value)}
                placeholder={t("consultaPecas.specReader.placeholder")}
                autoFocus
                className="h-14 text-lg font-mono pl-11 border-2 border-violet-300 focus-visible:ring-violet-500 focus-visible:ring-2"
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setSpecReaderOpen(false)}>
                {t("consultaPecas.specReader.cancel")}
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-br from-slate-700 to-slate-900 hover:from-slate-800 hover:to-black text-white"
                disabled={!specReaderInput.trim()}
              >
                <ScanSearch className="w-4 h-4 mr-2" /> {t("consultaPecas.specReader.check")}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              {t("consultaPecas.specReader.hint")}
            </p>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConsultaPecas;
