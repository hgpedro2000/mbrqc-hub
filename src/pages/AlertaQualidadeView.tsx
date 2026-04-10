import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, Clock } from "lucide-react";
import logo from "@/assets/hyundai-mobis-logo.png";

const AlertaQualidadeView = () => {
  const navigate = useNavigate();
  const { id } = useParams();

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

  // Get all inspetores
  const { data: inspetores = [] } = useQuery({
    queryKey: ["inspetores-all"],
    queryFn: async () => {
      const { data: roleData, error: roleErr } = await supabase.from("user_roles").select("user_id").eq("role", "inspetor");
      if (roleErr) throw roleErr;
      const ids = roleData.map((r: any) => r.user_id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase.from("profiles").select("id, full_name, cargo").in("id", ids);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" /></div>;
  if (!alerta) return <div className="min-h-screen flex items-center justify-center"><p>Alerta não encontrado</p></div>;

  const a = alerta as any;
  const fieldRow = (label: string, value: string, color: "red" | "blue" = "blue") => (
    <div className="space-y-0.5">
      <span className={`text-[10px] font-bold uppercase ${color === "red" ? "text-[#c0392b]" : "text-[#1a5276]"}`}>{label}</span>
      <p className="text-sm text-foreground bg-muted/20 rounded px-2 py-1">{value || "—"}</p>
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
            <img src={logo} alt="Hyundai Mobis" className="h-6 sm:h-8 bg-white rounded-md px-2 py-0.5" />
          </div>
          <div className="text-center mt-2">
            <h1 className="text-lg sm:text-xl font-bold tracking-wide">ALERTA DE QUALIDADE #{a.sequencial}</h1>
            <Badge className={a.status === "ativo" ? "bg-white/20 text-white" : "bg-white/10 text-white/70"}>{a.status === "ativo" ? "Ativo" : "Encerrado"}</Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 max-w-4xl space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 form-section">
          {fieldRow("Modelo", a.modelo)}
          {fieldRow("Modo de Falha", a.modo_falha, "red")}
          {fieldRow("Linha/Peça", a.linha_peca)}
          {fieldRow("Local Detectado", a.local_detectado, "red")}
          {fieldRow("Data Ocorrência", a.data_ocorrencia ? new Date(a.data_ocorrencia).toLocaleDateString("pt-BR") : "", "red")}
          {fieldRow("Data Validade", a.data_validade ? new Date(a.data_validade).toLocaleDateString("pt-BR") : "", "red")}
          {fieldRow("Turno", a.turno, "red")}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 form-section">
          <div className="md:col-span-2">{fieldRow("Descrição", a.descricao)}</div>
          <div className="space-y-2">
            {fieldRow("Responsabilidade", a.responsabilidade, "red")}
            {fieldRow("VIN", a.vin)}
          </div>
        </div>

        {/* Photos */}
        {(a.foto_ng_url || a.foto_ok_url) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {a.foto_ng_url && (
              <div>
                <span className="bg-[#c0392b] text-white text-xs font-bold px-3 py-1 rounded inline-block mb-2">NG</span>
                <div className="border-[3px] border-[#c0392b] rounded-lg overflow-hidden">
                  <img src={a.foto_ng_url} alt="NG" className="w-full object-contain max-h-[250px]" />
                </div>
              </div>
            )}
            {a.foto_ok_url && (
              <div>
                <span className="bg-[#1e8449] text-white text-xs font-bold px-3 py-1 rounded inline-block mb-2">OK</span>
                <div className="border-[3px] border-[#1e8449] rounded-lg overflow-hidden">
                  <img src={a.foto_ok_url} alt="OK" className="w-full object-contain max-h-[250px]" />
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
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div><span className="text-[10px] opacity-80">Sequência</span><p>{a.sequencia_bp || "—"}</p></div>
              <div><span className="text-[10px] opacity-80">VIN</span><p>{a.vin_bp || "—"}</p></div>
              <div><span className="text-[10px] opacity-80">Emitido</span><p>{a.emitido_por || "—"}</p></div>
            </div>
          </div>
        )}

        {/* Inspetores status */}
        <div className="form-section">
          <h3 className="text-sm font-heading font-bold mb-3">Status de Ciência dos Inspetores</h3>
          <div className="divide-y divide-border">
            {inspetores.map((ins: any) => {
              const ciencia = ciencias.find((c: any) => c.inspetor_id === ins.id);
              return (
                <div key={ins.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">{ins.full_name}</p>
                    {ins.cargo && <p className="text-xs text-muted-foreground">{ins.cargo}</p>}
                  </div>
                  {ciencia ? (
                    <div className="flex items-center gap-1.5 text-emerald-600">
                      <Check className="w-4 h-4" />
                      <div className="text-right">
                        <p className="text-xs font-medium">Ciente</p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(ciencia.created_at).toLocaleDateString("pt-BR")} • {ciencia.metodo === "qr_lider" ? "QR" : "App"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span className="text-xs">Pendente</span>
                    </div>
                  )}
                </div>
              );
            })}
            {inspetores.length === 0 && <p className="text-center text-muted-foreground py-4 text-sm">Nenhum inspetor cadastrado</p>}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AlertaQualidadeView;
