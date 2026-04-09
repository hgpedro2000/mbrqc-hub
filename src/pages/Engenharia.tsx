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
          <p className="text-primary-foreground/70 text-sm mt-1">{t("engenharia.subtitle")}</p>
        </div>
      </header>

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
