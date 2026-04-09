import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import ReportErrorButton from "@/components/ReportErrorButton";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const Engenharia = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { profile } = useAuth();
  const isSpecialAdmin = profile?.employee_number === "3501165";
  const [impersonateOpen, setImpersonateOpen] = useState(false);
  const [impersonating, setImpersonating] = useState<any>(null);

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

  const { data: allUsers = [] } = useQuery({
    queryKey: ["eng-profiles-impersonate"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, employee_number, turno, empresa, empresa_terceira").eq("status", "active").order("full_name");
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

  const stopImpersonating = () => {
    setImpersonating(null);
    toast.info("Voltando ao modo Admin");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-primary-foreground/70 hover:text-primary-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" /> {t("common.hub")}
            </Button>
            <img src={logo} alt="Hyundai Mobis" className="h-8 object-contain bg-white rounded-md px-2 py-0.5" />
          </div>
          <div className="flex items-center gap-3 mt-4">
            <Settings2 className="w-8 h-8" />
            <h1 className="text-2xl font-heading font-bold">{t("engenharia.title")}</h1>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-primary-foreground/70 text-sm">{t("engenharia.subtitle")}</p>
            {isSpecialAdmin && (
              <>
                {impersonating ? (
                  <div className="flex items-center gap-1.5">
                    <Badge className="bg-amber-500/20 text-amber-200 border-amber-400/30 text-[10px]">
                      <UserCheck className="w-3 h-3 mr-1" /> {impersonating.full_name}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={stopImpersonating} className="text-primary-foreground/70 hover:text-primary-foreground h-6 text-[10px] px-2">
                      Sair
                    </Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setImpersonateOpen(true)} className="text-primary-foreground/70 hover:text-primary-foreground h-7 text-xs gap-1">
                    <UserCheck className="w-3.5 h-3.5" /> Modo Usuário Padrão
                  </Button>
                )}
              </>
            )}
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

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl">
        <Tabs defaultValue="usuarios" className="space-y-4 sm:space-y-6">
          <div className="overflow-x-auto -mx-3 px-3 sm:-mx-4 sm:px-4 pb-1">
            <TabsList className="inline-flex w-auto min-w-full md:grid md:w-full md:grid-cols-7 h-auto gap-1">
              <TabsTrigger value="usuarios" className="text-[10px] sm:text-xs md:text-sm px-2 sm:px-3 py-1.5 sm:py-2 whitespace-nowrap">{t("engenharia.tabs.users")}</TabsTrigger>
              <TabsTrigger value="fornecedores" className="text-[10px] sm:text-xs md:text-sm px-2 sm:px-3 py-1.5 sm:py-2 whitespace-nowrap">{t("engenharia.tabs.suppliers")}</TabsTrigger>
              <TabsTrigger value="partnumbers" className="text-[10px] sm:text-xs md:text-sm px-2 sm:px-3 py-1.5 sm:py-2 whitespace-nowrap">{t("engenharia.tabs.partNumbers")}</TabsTrigger>
              <TabsTrigger value="defeitos" className="text-[10px] sm:text-xs md:text-sm px-2 sm:px-3 py-1.5 sm:py-2 whitespace-nowrap">{t("engenharia.tabs.defects")}</TabsTrigger>
              <TabsTrigger value="cat_defeitos" className="text-[10px] sm:text-xs md:text-sm px-2 sm:px-3 py-1.5 sm:py-2 whitespace-nowrap">{t("engenharia.tabs.defectCategories")}</TabsTrigger>
              <TabsTrigger value="responsabilidades" className="text-[10px] sm:text-xs md:text-sm px-2 sm:px-3 py-1.5 sm:py-2 whitespace-nowrap">{t("engenharia.tabs.responsibilities")}</TabsTrigger>
              <TabsTrigger value="erros" className="text-[10px] sm:text-xs md:text-sm px-2 sm:px-3 py-1.5 sm:py-2 whitespace-nowrap relative">
                Help Desk
                {pendingErrors > 0 && <Badge className="absolute -top-1 -right-1 h-4 min-w-4 text-[9px] bg-destructive text-destructive-foreground p-0.5">{pendingErrors}</Badge>}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="usuarios" className="form-section">
            <UsersTab />
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

          <TabsContent value="erros" className="form-section">
            <ErrorReportsTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Engenharia;
