import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import ReportErrorButton from "@/components/ReportErrorButton";

const ConsultaPecas = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

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
      p.suppliers?.code?.toLowerCase().includes(term)
    );
  }, [partNumbers, searchTerm]);

  const origemBadge = (origem: string | null) => {
    switch (origem) {
      case "CKD": return <Badge className="bg-purple-500/10 text-purple-700 border-purple-200 text-[10px]">CKD</Badge>;
      case "CONSIGNADA": return <Badge className="bg-orange-500/10 text-orange-700 border-orange-200 text-[10px]">CONSIGNADA</Badge>;
      default: return <Badge className="bg-blue-500/10 text-blue-700 border-blue-200 text-[10px]">LP</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-4 py-6 md:py-12">
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
          <h1 className="text-2xl md:text-4xl font-heading font-bold mt-3 md:mt-4">Consulta de Peças</h1>
          <p className="mt-1 md:mt-2 text-primary-foreground/70 max-w-xl text-sm md:text-lg">Pesquise peças por Part Number, nome ou fornecedor.</p>
        </div>
      </header>

      <main className="container mx-auto px-4 -mt-6 pb-12 space-y-4">
        <div className="form-section">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por Part Number, nome da peça ou fornecedor..."
              className="pl-10 h-12 text-base"
              autoFocus
            />
          </div>
        </div>

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
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-heading font-bold text-foreground">{p.part_number}</span>
                      {origemBadge(p.origem)}
                    </div>
                    <p className="text-sm text-muted-foreground">{p.part_name}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>Fornecedor: <span className="font-medium text-foreground">{p.suppliers?.name || "—"}</span></span>
                      <span>•</span>
                      <span>Projeto: <span className="font-medium text-foreground">{p.project || "—"}</span></span>
                      <span>•</span>
                      <span>Linha/Módulo: <span className="font-medium text-foreground">{p.line_module || "—"}</span></span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground text-center">{filtered.length} peça(s) encontrada(s)</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default ConsultaPecas;
