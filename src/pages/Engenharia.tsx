import { useNavigate } from "react-router-dom";
import { ArrowLeft, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import logo from "@/assets/hyundai-mobis-logo.png";
import UsersTab from "@/components/engenharia/UsersTab";
import SuppliersTab from "@/components/engenharia/SuppliersTab";
import PartNumbersTab from "@/components/engenharia/PartNumbersTab";
import CatalogTab from "@/components/engenharia/CatalogTab";


const Engenharia = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-primary-foreground/70 hover:text-primary-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" /> Hub
            </Button>
            <img src={logo} alt="Hyundai Mobis" className="h-8 object-contain bg-white rounded-md px-2 py-0.5" />
          </div>
          <div className="flex items-center gap-3 mt-4">
            <Settings2 className="w-8 h-8" />
            <h1 className="text-2xl font-heading font-bold">Modo Engenharia</h1>
          </div>
          <p className="text-primary-foreground/70 text-sm mt-1">Cadastros centralizados e gestão de usuários</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <Tabs defaultValue="usuarios" className="space-y-6">
          <div className="overflow-x-auto -mx-4 px-4">
            <TabsList className="inline-flex w-auto min-w-full md:grid md:w-full md:grid-cols-7 h-auto">
              <TabsTrigger value="usuarios" className="text-xs md:text-sm px-3 py-2 whitespace-nowrap">Usuários</TabsTrigger>
              <TabsTrigger value="modulos" className="text-xs md:text-sm px-3 py-2 whitespace-nowrap">Módulos</TabsTrigger>
              <TabsTrigger value="fornecedores" className="text-xs md:text-sm px-3 py-2 whitespace-nowrap">Fornecedores</TabsTrigger>
              <TabsTrigger value="partnumbers" className="text-xs md:text-sm px-3 py-2 whitespace-nowrap">Part Numbers</TabsTrigger>
              <TabsTrigger value="defeitos" className="text-xs md:text-sm px-3 py-2 whitespace-nowrap">Defeitos</TabsTrigger>
              <TabsTrigger value="cat_defeitos" className="text-xs md:text-sm px-3 py-2 whitespace-nowrap">Cat. Defeito</TabsTrigger>
              <TabsTrigger value="responsabilidades" className="text-xs md:text-sm px-3 py-2 whitespace-nowrap">Responsab.</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="usuarios" className="form-section">
            <UsersTab />
          </TabsContent>

          <TabsContent value="modulos" className="form-section">
            <ModulePermissionsTab />
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
              title="Defeitos"
              codeLabel="Código"
              codePlaceholder="Ex: DEF001"
            />
          </TabsContent>

          <TabsContent value="cat_defeitos" className="form-section">
            <CatalogTab
              tableName="defect_categories"
              title="Categoria de Defeito"
              codeLabel="Código"
              codePlaceholder="Ex: CAT001"
            />
          </TabsContent>

          <TabsContent value="responsabilidades" className="form-section">
            <CatalogTab
              tableName="responsibilities"
              title="Responsabilidades"
              codeLabel="Código"
              codePlaceholder="Ex: FORN, INT, CLI"
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Engenharia;
