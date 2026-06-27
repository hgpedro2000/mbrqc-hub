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
              <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 px-2 md:px-3">
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

      {/* Spec / ALC Dialog */}
      <Dialog open={specDialogOpen} onOpenChange={setSpecDialogOpen}>
        <DialogContent className="max-w-[96vw] sm:max-w-lg md:max-w-xl p-0 overflow-hidden border-0 w-[96vw] sm:w-auto">
          {specPart && (
            <div className="flex flex-col max-h-[92vh]">
              {/* Header */}
              <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-black px-3 sm:px-5 py-3 sm:py-4 text-white relative">
                <div className="flex items-center gap-2 mb-1 opacity-90">
                  <ScanSearch className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="text-[10px] sm:text-xs font-medium tracking-wider uppercase">{t("consultaPecas.spec.headerLabel")}</span>
                </div>
                <h2 className="text-lg sm:text-2xl md:text-3xl font-heading font-bold leading-tight font-mono break-all">
                  {specPart.part_number}
                </h2>
                <p className="text-xs sm:text-sm md:text-base opacity-90 mt-1 break-words">{specPart.part_name || "—"}</p>
                <div className="mt-2">{origemBadge(specPart.origem)}</div>
              </div>

              {/* Body */}
              <div className="px-3 sm:px-5 py-3 sm:py-4 space-y-3 sm:space-y-4 overflow-y-auto">
                {/* ALC Highlight */}
                <div className={`rounded-xl p-3 sm:p-4 border-2 ${
                  specPart.alc_code
                    ? "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border-amber-500 dark:border-amber-600 shadow-lg shadow-amber-200/50 dark:shadow-amber-900/30"
                    : "bg-muted/40 border-dashed border-muted-foreground/30"
                }`}>
                  <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                    <Sparkles className={`w-4 h-4 sm:w-5 sm:h-5 ${specPart.alc_code ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`} />
                    <span className={`text-[11px] sm:text-sm font-bold uppercase tracking-wider ${
                      specPart.alc_code ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"
                    }`}>
                      {t("consultaPecas.spec.alcCode")}
                    </span>
                  </div>
                  {specPart.alc_code ? (
                    <p className="font-mono font-bold text-2xl sm:text-3xl md:text-4xl text-slate-900 dark:text-amber-100 break-all text-center py-1 sm:py-2">
                      {specPart.alc_code}
                    </p>
                  ) : (
                    <p className="text-sm sm:text-base text-muted-foreground text-center py-1 sm:py-2 italic">
                      {t("consultaPecas.spec.noAlcRegistered")}
                    </p>
                  )}
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div className="rounded-lg border bg-card p-2 sm:p-3 min-w-0">
                    <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground mb-1">
                      <Factory className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" /> <span className="truncate">{t("consultaPecas.spec.supplier")}</span>
                    </div>
                    <p className="text-xs sm:text-base font-semibold text-foreground break-words">
                      {specPart.suppliers?.name || "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-card p-2 sm:p-3 min-w-0">
                    <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground mb-1">
                      <Hash className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" /> <span className="truncate">{t("consultaPecas.spec.codeVendor")}</span>
                    </div>
                    <p className="text-xs sm:text-base font-mono font-semibold text-amber-700 dark:text-amber-400 break-all">
                      {specPart.suppliers?.code || "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-card p-2 sm:p-3 min-w-0">
                    <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground mb-1">
                      <Layers className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" /> <span className="truncate">{t("consultaPecas.spec.project")}</span>
                    </div>
                    <p className="text-xs sm:text-base font-semibold text-emerald-700 dark:text-emerald-400 break-words">
                      {specPart.project || "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-card p-2 sm:p-3 min-w-0">
                    <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground mb-1">
                      <Package className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" /> <span className="truncate">{t("consultaPecas.spec.lineModule")}</span>
                    </div>
                    <p className="text-xs sm:text-base font-semibold text-cyan-700 dark:text-cyan-400 break-words">
                      {specPart.line_module || "—"}
                    </p>
                  </div>
                </div>
              </div>


              {/* Footer */}
              <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-t bg-muted/30 flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 min-h-[40px] sm:min-h-[44px] text-xs sm:text-sm"
                  onClick={() => {
                    setSearchTerm(specPart.part_number);
                    setSpecDialogOpen(false);
                  }}
                >
                  <Search className="w-4 h-4 mr-2" /> {t("consultaPecas.spec.viewInList")}
                </Button>
                <Button
                  size="sm"
                  className="flex-1 min-h-[40px] sm:min-h-[44px] text-xs sm:text-sm bg-gradient-to-br from-slate-700 to-slate-900 hover:from-slate-800 hover:to-black text-white"
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
            <DialogTitle className="flex items-center gap-2"><Barcode className="w-5 h-5 text-sky-600" /> Barcode Scanner H/KMC</DialogTitle>
            <DialogDescription>Leitor de códigos Hyundai/KIA</DialogDescription>
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
              <span className="text-xs font-medium tracking-wider uppercase">Leitor de Código de Barras</span>
            </div>
            <DialogTitle className="text-xl font-bold text-white">Checar SPEC / ALC</DialogTitle>
            <DialogDescription className="text-white/85 text-sm">
              Aponte o leitor para o QR Code Hyundai/Mobis — o Part Number será extraído automaticamente. Você também pode digitar e pressionar Enter.
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
                placeholder="Leia o QR Code ou digite o Part Number..."
                autoFocus
                className="h-14 text-lg font-mono pl-11 border-2 border-violet-300 focus-visible:ring-violet-500 focus-visible:ring-2"
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setSpecReaderOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-br from-slate-700 to-slate-900 hover:from-slate-800 hover:to-black text-white"
                disabled={!specReaderInput.trim()}
              >
                <ScanSearch className="w-4 h-4 mr-2" /> Checar
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              Dica: leitores de QR Hyundai/Mobis enviam o payload completo — o Part Number é detectado automaticamente.
            </p>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConsultaPecas;
