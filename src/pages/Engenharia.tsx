import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { ArrowLeft, Settings2, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import logo from "@/assets/hyundai-mobis-logo.png";
import UsersTab from "@/components/engenharia/UsersTab";
import SuppliersTab from "@/components/engenharia/SuppliersTab";
import PartNumbersTab from "@/components/engenharia/PartNumbersTab";
import CatalogTab from "@/components/engenharia/CatalogTab";
import ErrorReportsTab from "@/components/engenharia/ErrorReportsTab";
import CapsuleTab from "@/components/engenharia/CapsuleTab";
import PrivacyPolicyTab from "@/components/engenharia/PrivacyPolicyTab";
import SecurityConfigTab from "@/components/engenharia/SecurityConfigTab";
import AuditLogsTab from "@/components/engenharia/AuditLogsTab";
import EmailAutomationTabs from "@/components/engenharia/EmailAutomationTabs";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const Engenharia = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();
  const { profile } = useAuth();
  const isSpecialAdmin = profile?.employee_number === "3501165";
  const [impersonateOpen, setImpersonateOpen] = useState(false);
  const [impersonateSearch, setImpersonateSearch] = useState("");
  const { impersonating, setImpersonating, stopImpersonating } = useImpersonation();
  const initialTab = searchParams.get("tab") || "usuarios";
  const [activeTab, setActiveTab] = useState(initialTab);
  useEffect(() => {
    const t = searchParams.get("tab");
    if (t && t !== activeTab) setActiveTab(t);
  }, [searchParams]);

  const { data: pendingErrors = 0 } = useQuery({
    queryKey: ["pending-error-reports-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("error_reports")
        .select("*", { count: "exact", head: true })
        .eq("status", "pendente");
      if (error) return 0;
      return count || 0;
    },
  });

  const queryClient = useQueryClient();

  const { data: userRequests = [] } = useQuery({
    queryKey: ["user-requests"],
    queryFn: async () => {
      const { data } = await supabase
        .from("error_reports")
        .select("*")
        .ilike("module", "%usuário%")
        .neq("status", "resolvido")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["eng-profiles-impersonate"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("public_profiles").select("id, full_name, employee_number, turno, empresa, empresa_terceira, cargo").order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: isSpecialAdmin,
  });

  const handleImpersonate = (user: any) => {
    setImpersonating(user);
    setImpersonateOpen(false);
    toast.success(`Modo Usuário Padrão: ${user.full_name} (${user.employee_number})`);
  };

  const handleStopImpersonating = () => {
    stopImpersonating();
    toast.info("Voltando ao modo Admin");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header sticky top-0 z-40">
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-primary-foreground/70 hover:text-primary-foreground px-2">
                <ArrowLeft className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">{t("common.hub")}</span>
              </Button>
              <img src={logo} alt="Hyundai Mobis" className="h-6 sm:h-8 object-contain bg-white rounded-md px-2 py-0.5" />
            </div>
            <div className="flex items-center gap-2" />

          </div>
          <div className="flex items-center gap-2 sm:gap-3 mt-3 sm:mt-4">
            <Settings2 className="w-5 h-5 sm:w-8 sm:h-8" />
            <h1 className="text-lg sm:text-2xl font-heading font-bold">{t("engenharia.title")}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <p className="text-primary-foreground/70 text-xs sm:text-sm">{t("engenharia.subtitle")}</p>
          </div>

        </div>
      </header>

      {/* Impersonate user dialog */}
      <Dialog open={impersonateOpen} onOpenChange={setImpersonateOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Selecionar Usuário Padrão</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground mb-3">Escolha um usuário para simular sua visualização dos módulos.</p>
          <div className="space-y-1">
            {allUsers.map((u: any) => (
              <button
                key={u.id}
                onClick={() => handleImpersonate(u)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-accent/10 text-left transition-colors"
              >
                <div>
                  <p className="text-sm font-medium">{u.full_name}</p>
                  <p className="text-xs text-muted-foreground">{u.employee_number} {u.turno ? `• ${u.turno}` : ""}</p>
                </div>
                <Badge variant="outline" className="text-[9px]">
                  {u.empresa === "empresa_terceira" ? (u.empresa_terceira || "Terceira") : "Mobis"}
                </Badge>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl w-full overflow-x-clip">
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSearchParams((prev) => { const p = new URLSearchParams(prev); p.set("tab", v); return p; }, { replace: true }); }} className="space-y-4 sm:space-y-6 w-full min-w-0">
          <div className="sticky top-[112px] sm:top-[148px] z-30 w-full overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70 py-2 border-b border-border">
            <TabsList className="inline-flex w-auto min-w-full xl:grid xl:grid-cols-12 h-auto gap-1 p-1">
              <TabsTrigger value="usuarios" className="text-xs md:text-sm px-3 py-1.5 sm:py-2 whitespace-nowrap shrink-0 xl:w-full">{t("engenharia.tabs.users")}</TabsTrigger>
              <TabsTrigger value="fornecedores" className="text-xs md:text-sm px-3 py-1.5 sm:py-2 whitespace-nowrap shrink-0 xl:w-full">{t("engenharia.tabs.suppliers")}</TabsTrigger>
              <TabsTrigger value="partnumbers" className="text-xs md:text-sm px-3 py-1.5 sm:py-2 whitespace-nowrap shrink-0 xl:w-full">{t("engenharia.tabs.partNumbers")}</TabsTrigger>
              <TabsTrigger value="defeitos" className="text-xs md:text-sm px-3 py-1.5 sm:py-2 whitespace-nowrap shrink-0 xl:w-full">{t("engenharia.tabs.defects")}</TabsTrigger>
              <TabsTrigger value="cat_defeitos" className="text-xs md:text-sm px-3 py-1.5 sm:py-2 whitespace-nowrap shrink-0 xl:w-full">{t("engenharia.tabs.defectCategories")}</TabsTrigger>
              <TabsTrigger value="responsabilidades" className="text-xs md:text-sm px-3 py-1.5 sm:py-2 whitespace-nowrap shrink-0 xl:w-full">{t("engenharia.tabs.responsibilities")}</TabsTrigger>
              <TabsTrigger value="capsula" className="text-xs md:text-sm px-3 py-1.5 sm:py-2 whitespace-nowrap shrink-0 xl:w-full">Cápsula</TabsTrigger>
              <TabsTrigger value="erros" className="text-xs md:text-sm px-3 py-1.5 sm:py-2 whitespace-nowrap shrink-0 xl:w-full relative">
                Help Desk
                {pendingErrors > 0 && <Badge className="absolute -top-1 -right-1 h-4 min-w-4 text-[9px] bg-destructive text-destructive-foreground p-0.5">{pendingErrors}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="emails" className="text-xs md:text-sm px-3 py-1.5 sm:py-2 whitespace-nowrap shrink-0 xl:w-full">E-mails</TabsTrigger>
              <TabsTrigger value="seguranca" className="text-xs md:text-sm px-3 py-1.5 sm:py-2 whitespace-nowrap shrink-0 xl:w-full">Segurança</TabsTrigger>
              <TabsTrigger value="privacidade" className="text-xs md:text-sm px-3 py-1.5 sm:py-2 whitespace-nowrap shrink-0 xl:w-full">Privacidade</TabsTrigger>
              <TabsTrigger value="auditoria" className="text-xs md:text-sm px-3 py-1.5 sm:py-2 whitespace-nowrap shrink-0 xl:w-full">Auditoria</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="usuarios" className="form-section">
            <UsersTab
              pendingRequests={userRequests}
              onRequestResolved={() => queryClient.invalidateQueries({ queryKey: ["user-requests"] })}
              toolbarExtras={
                isSpecialAdmin ? (
                  impersonating ? (
                    <div className="flex items-center gap-1.5 col-span-2 sm:col-span-1">
                      <Badge className="bg-amber-500/20 text-amber-700 border-amber-400/40 text-[10px]">
                        <UserCheck className="w-3 h-3 mr-1" /> {impersonating.full_name}
                      </Badge>
                      <Button variant="ghost" size="sm" onClick={handleStopImpersonating} className="h-7 text-[10px] px-2">
                        Sair
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setImpersonateOpen(true)}
                      className="col-span-2 sm:col-span-1 border-purple-400 text-purple-700 bg-purple-50 hover:bg-purple-100"
                    >
                      <UserCheck className="w-4 h-4 mr-1" /> Modo Usuário Padrão
                    </Button>
                  )
                ) : null
              }
            />
          </TabsContent>


          <TabsContent value="fornecedores" className="form-section">
            <SuppliersTab />
          </TabsContent>

          <TabsContent value="partnumbers" className="form-section">
            <PartNumbersTab />
          </TabsContent>

          <TabsContent value="defeitos" className="form-section">
            <CatalogTab
              tableName="defects"
              title={t("engenharia.defectsTitle")}
              codeLabel={t("engenharia.code")}
              codePlaceholder={t("engenharia.codePlaceholder")}
            />
          </TabsContent>

          <TabsContent value="cat_defeitos" className="form-section">
            <CatalogTab
              tableName="defect_categories"
              title={t("engenharia.defectCategoryTitle")}
              codeLabel={t("engenharia.code")}
              codePlaceholder={t("engenharia.catPlaceholder")}
            />
          </TabsContent>

          <TabsContent value="responsabilidades" className="form-section">
            <CatalogTab
              tableName="responsibilities"
              title={t("engenharia.responsibilitiesTitle")}
              codeLabel={t("engenharia.code")}
              codePlaceholder={t("engenharia.respPlaceholder")}
            />
          </TabsContent>

          <TabsContent value="capsula" className="form-section">
            <CapsuleTab />
          </TabsContent>

          <TabsContent value="erros" className="form-section">
            <ErrorReportsTab onCreateUserFromRequest={(parsed: any) => {
              // Parse data from HelpDesk request and pre-fill user creation form
              const empresaRaw = parsed["Empresa"] || "";
              const isMobis = empresaRaw.includes("Mobis");
              const empNumber = parsed["Número do Usuário"] || "";
              const fullNameVal = parsed["Nome Completo"] || "";
              const turnoVal = parsed["Turno"] || "";
              const cargoVal = parsed["Cargo"] || "";
              const emailVal = parsed["E-mail"] || "";
              
              // Switch to users tab and open create dialog with pre-filled data
              // We store it in sessionStorage for the UsersTab to pick up
              sessionStorage.setItem("prefill_new_user", JSON.stringify({
                empresa: isMobis ? "mobis_brasil" : "empresa_terceira",
                empresa_terceira: !isMobis ? empresaRaw.replace("Empresa Terceira - ", "") : "",
                employee_number: empNumber,
                full_name: fullNameVal,
                turno: turnoVal,
                cargo: cargoVal,
                email: emailVal,
              }));
              
              // Switch tab
              const tabBtn = document.querySelector('[value="usuarios"]') as HTMLElement;
              if (tabBtn) tabBtn.click();
              
              toast.info("Dados pré-preenchidos no formulário de Novo Usuário. Clique em 'Novo Usuário' para finalizar.");
            }} />
          </TabsContent>

          <TabsContent value="emails" className="form-section">
            <EmailAutomationTabs />
          </TabsContent>

          <TabsContent value="seguranca" className="form-section">
            <SecurityConfigTab />
          </TabsContent>

          <TabsContent value="privacidade" className="form-section">
            <PrivacyPolicyTab />
          </TabsContent>

          <TabsContent value="auditoria" className="form-section">
            <AuditLogsTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Engenharia;
