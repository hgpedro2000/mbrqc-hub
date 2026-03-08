import { useNavigate } from "react-router-dom";
import {
  ClipboardCheck,
  LogOut,
  Beaker,
  ShieldCheck,
  ShieldAlert,
  FileBarChart,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const modules = [
  {
    id: "tryout",
    title: "Try-Out",
    description: "Controle de Try-Out com checklists de injeção, pintura e montagem. Dashboard com indicadores.",
    icon: Beaker,
    path: "/tryout",
    color: "from-blue-500/15 to-cyan-500/5",
    iconBg: "bg-blue-500/10 text-blue-600",
  },
  {
    id: "auditorias",
    title: "Auditorias",
    description: "Gestão de auditorias de processo e produto com rastreabilidade completa.",
    icon: ShieldCheck,
    path: "/auditorias",
    color: "from-emerald-500/15 to-green-500/5",
    iconBg: "bg-emerald-500/10 text-emerald-600",
  },
  {
    id: "contencao",
    title: "Contenção",
    description: "Registro e acompanhamento de ações de contenção para não conformidades.",
    icon: ShieldAlert,
    path: "/contencao",
    color: "from-orange-500/15 to-amber-500/5",
    iconBg: "bg-orange-500/10 text-orange-600",
  },
  {
    id: "apontamentos",
    title: "Apontamentos",
    description: "Apontamentos de produção, paradas e ocorrências em tempo real.",
    icon: FileBarChart,
    path: "/apontamentos",
    color: "from-violet-500/15 to-purple-500/5",
    iconBg: "bg-violet-500/10 text-violet-600",
  },
  {
    id: "alerta-qualidade",
    title: "Alerta de Qualidade",
    description: "Emissão e controle de alertas de qualidade com notificações e rastreabilidade.",
    icon: AlertTriangle,
    path: "/alerta-qualidade",
    color: "from-red-500/15 to-rose-500/5",
    iconBg: "bg-red-500/10 text-red-600",
  },
];

const Hub = () => {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-4 py-8 md:py-12">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                <ClipboardCheck className="w-5 h-5 text-accent-foreground" />
              </div>
              <span className="text-sm font-medium tracking-wider uppercase opacity-80">
                Quality Hub
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
          <h1 className="text-3xl md:text-4xl font-heading font-bold mt-4">
            Quality Hub
          </h1>
          <p className="mt-2 text-primary-foreground/70 max-w-xl text-lg">
            Selecione o módulo para acessar.
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 -mt-6 pb-12">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((mod, i) => (
            <div
              key={mod.id}
              className="module-card opacity-0 animate-fade-in cursor-pointer"
              style={{ animationDelay: `${i * 80}ms` }}
              onClick={() => navigate(mod.path)}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${mod.color} pointer-events-none`} />
              <div className="relative">
                <div className={`w-14 h-14 rounded-xl ${mod.iconBg} flex items-center justify-center mb-4`}>
                  <mod.icon className="w-7 h-7" />
                </div>
                <h2 className="text-xl font-heading font-semibold text-card-foreground mb-2">
                  {mod.title}
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                  {mod.description}
                </p>
                <div className="flex items-center justify-end">
                  <ArrowRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Hub;
