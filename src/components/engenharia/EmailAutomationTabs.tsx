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
      <div className="overflow-x-auto -mx-2 px-2">
        <TabsList className="inline-flex w-auto min-w-full md:grid md:grid-cols-6 gap-1">
          <TabsTrigger value="apontamentos" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            <span>Apontamentos</span>
          </TabsTrigger>
          <TabsTrigger value="alerta" className="gap-2">
            <Bell className="h-4 w-4" />
            <span>Alerta de Qualidade</span>
          </TabsTrigger>
          <TabsTrigger value="contencao" className="gap-2">
            <ShieldAlert className="h-4 w-4" />
            <span>Contenção</span>
          </TabsTrigger>
          <TabsTrigger value="consumiveis" className="gap-2">
            <Package className="h-4 w-4" />
            <span>Consumíveis</span>
          </TabsTrigger>
          <TabsTrigger value="matriz" className="gap-2">
            <GraduationCap className="h-4 w-4" />
            <span>Matriz de Versatilidade</span>
          </TabsTrigger>
          <TabsTrigger value="acesso" className="gap-2">
            <KeyRound className="h-4 w-4" />
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
