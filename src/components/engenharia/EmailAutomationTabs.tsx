import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, GraduationCap, ShieldAlert, Package, KeyRound, ClipboardList } from "lucide-react";
import EmailAutomationTab from "./EmailAutomationTab";
import AlertaEmailTab from "./AlertaEmailTab";
import ContencaoEmailTab from "./ContencaoEmailTab";

type SubTab = {
  value: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  bullets: string[];
};

const COMING_SOON: SubTab[] = [
  {
    value: "matriz",
    label: "Matriz de Versatilidade",
    icon: GraduationCap,
    description:
      "Resumo semanal de inspetores com treinamentos vencidos ou a vencer (janela configurável).",
    bullets: [
      "Frequência semanal com dia/horário/fuso reaproveitando o agendamento atual",
      "Campo configurável de dias de antecedência para 'a vencer'",
      "Destinatários fixos: Responsável pela Matriz, Supervisor, Gerente e Pedro",
    ],
  },
  {
    value: "consumiveis",
    label: "Consumíveis",
    icon: Package,
    description:
      "Notificações para novas solicitações, contagem semanal de estoque e alerta de estoque mínimo.",
    bullets: [
      "Nova solicitação: dispara a cada requisição criada",
      "Contagem semanal: tabela completa de itens com status OK/Baixo",
      "Estoque mínimo: alerta com idempotência (não reenvia até subir e cair novamente, ou após intervalo configurável)",
    ],
  },
  {
    value: "consumiveis",
    label: "Consumíveis",
    icon: Package,
    description:
      "Notificações para novas solicitações, contagem semanal de estoque e alerta de estoque mínimo.",
    bullets: [
      "Nova solicitação: dispara a cada requisição criada",
      "Contagem semanal: tabela completa de itens com status OK/Baixo",
      "Estoque mínimo: alerta com idempotência (não reenvia até subir e cair novamente, ou após intervalo configurável)",
    ],
  },
  {
    value: "acesso",
    label: "Acesso",
    icon: KeyRound,
    description:
      "Gestão dos templates de e-mail de autenticação do sistema (cadastro, recuperação, MFA, etc.).",
    bullets: [
      "Listagem e edição dos templates atuais com preview antes de salvar",
      "Acesso restrito a administradores",
      "Registro de cada alteração no log de auditoria (audit_logs → 'email_template_updated')",
    ],
  },
];

const ComingSoonCard = ({ tab }: { tab: SubTab }) => {
  const Icon = tab.icon;
  return (
    <Card className="border-dashed">
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="h-5 w-5 text-primary" />
            {tab.label}
          </CardTitle>
          <Badge variant="secondary">Em breve</Badge>
        </div>
        <CardDescription>{tab.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
          {tab.bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

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
          {COMING_SOON.map((t) => {
            const Icon = t.icon;
            return (
              <TabsTrigger key={t.value} value={t.value} className="gap-2">
                <Icon className="h-4 w-4" />
                <span>{t.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>

      <TabsContent value="apontamentos" className="mt-4">
        <EmailAutomationTab />
      </TabsContent>

      <TabsContent value="alerta" className="mt-4">
        <AlertaEmailTab />
      </TabsContent>

      {COMING_SOON.map((t) => (
        <TabsContent key={t.value} value={t.value} className="mt-4">
          <ComingSoonCard tab={t} />
        </TabsContent>
      ))}
    </Tabs>
  );
};

export default EmailAutomationTabs;
