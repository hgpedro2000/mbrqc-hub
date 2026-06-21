import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Bell, GraduationCap, ShieldAlert, Package, KeyRound, ClipboardList } from "lucide-react";
import EmailAutomationTab from "./EmailAutomationTab";
import AlertaEmailTab from "./AlertaEmailTab";
import ContencaoEmailTab from "./ContencaoEmailTab";
import ConsumiveisEmailTab from "./ConsumiveisEmailTab";
import MatrizEmailTab from "./MatrizEmailTab";
import AcessoEmailTab from "./AcessoEmailTab";

const EmailAutomationTabs = () => {
  const [tab, setTab] = useState("apontamentos");

  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <div className="overflow-x-auto -mx-2 px-2 pb-1">
        <TabsList className="inline-flex w-auto min-w-full md:grid md:grid-cols-6 gap-1 h-auto p-1">
          <TabsTrigger value="apontamentos" className="gap-1.5 px-2.5 py-2 text-xs sm:text-sm whitespace-nowrap">
            <ClipboardList className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Apontamentos</span>
            <span className="sm:hidden">Apont.</span>
          </TabsTrigger>
          <TabsTrigger value="alerta" className="gap-1.5 px-2.5 py-2 text-xs sm:text-sm whitespace-nowrap">
            <Bell className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Alerta de Qualidade</span>
            <span className="sm:hidden">Alerta</span>
          </TabsTrigger>
          <TabsTrigger value="contencao" className="gap-1.5 px-2.5 py-2 text-xs sm:text-sm whitespace-nowrap">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>Contenção</span>
          </TabsTrigger>
          <TabsTrigger value="consumiveis" className="gap-1.5 px-2.5 py-2 text-xs sm:text-sm whitespace-nowrap">
            <Package className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Consumíveis</span>
            <span className="sm:hidden">Consum.</span>
          </TabsTrigger>
          <TabsTrigger value="matriz" className="gap-1.5 px-2.5 py-2 text-xs sm:text-sm whitespace-nowrap">
            <GraduationCap className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Matriz de Versatilidade</span>
            <span className="sm:hidden">Matriz</span>
          </TabsTrigger>
          <TabsTrigger value="acesso" className="gap-1.5 px-2.5 py-2 text-xs sm:text-sm whitespace-nowrap">
            <KeyRound className="h-4 w-4 shrink-0" />
            <span>Acesso</span>
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="apontamentos" className="mt-4"><EmailAutomationTab /></TabsContent>
      <TabsContent value="alerta" className="mt-4"><AlertaEmailTab /></TabsContent>
      <TabsContent value="contencao" className="mt-4"><ContencaoEmailTab /></TabsContent>
      <TabsContent value="consumiveis" className="mt-4"><ConsumiveisEmailTab /></TabsContent>
      <TabsContent value="matriz" className="mt-4"><MatrizEmailTab /></TabsContent>
      <TabsContent value="acesso" className="mt-4"><AcessoEmailTab /></TabsContent>
    </Tabs>
  );
};

export default EmailAutomationTabs;
