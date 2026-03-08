import { useNavigate } from "react-router-dom";
import { Droplets, Paintbrush, Wrench, ClipboardCheck, ArrowRight, LogOut, BarChart3, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const modules = [
  {
    id: "injecao",
    title: "Injeção Plástica",
    description: "Checklist completo para processo de injeção: matéria-prima, injetora, parâmetros dimensionais e melhorias.",
    icon: Droplets,
    path: "/tryout/injecao",
    stats: "19 campos",
    color: "from-blue-500/10 to-blue-600/5",
  },
  {
    id: "pintura",
    title: "Pintura",
    description: "Checklist editável para processo de pintura com upload de fotos e controle de qualidade.",
    icon: Paintbrush,
    path: "/tryout/pintura",
    stats: "Editável",
    color: "from-amber-500/10 to-orange-500/5",
  },
  {
    id: "montagem",
    title: "Montagem e Finalização",
    description: "Checklist editável para montagem final, verificação de acabamento e controle dimensional.",
    icon: Wrench,
    path: "/montagem",
    stats: "Editável",
    color: "from-emerald-500/10 to-green-500/5",
  },
];

const Index = () => {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="gradient-header">
        <div className="container mx-auto px-4 py-8 md:py-12">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                <ClipboardCheck className="w-5 h-5 text-accent-foreground" />
              </div>
              <span className="text-sm font-medium tracking-wider uppercase opacity-80">
                Try-Out Control
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/")}
                className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Hub
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/tryout/dashboard")}
                className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
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
          </div>
          <h1 className="text-3xl md:text-4xl font-heading font-bold mt-4">
            Controle de Try-Out
          </h1>
          <p className="mt-2 text-primary-foreground/70 max-w-xl text-lg">
            Selecione o módulo do processo para iniciar o preenchimento do checklist.
          </p>
        </div>
      </header>

      {/* Modules */}
      <main className="container mx-auto px-4 -mt-6 pb-12">
        <div className="grid gap-6 md:grid-cols-3">
          {modules.map((mod, i) => (
            <div
              key={mod.id}
              className="module-card opacity-0 animate-fade-in"
              style={{ animationDelay: `${i * 100}ms` }}
              onClick={() => navigate(mod.path)}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${mod.color} pointer-events-none`} />
              <div className="relative">
                <div className="module-card-icon">
                  <mod.icon className="w-7 h-7" />
                </div>
                <h2 className="text-xl font-heading font-semibold text-card-foreground mb-2">
                  {mod.title}
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                  {mod.description}
                </p>
                <div className="flex items-center justify-between">
                  <span className="status-badge bg-secondary text-secondary-foreground">
                    {mod.stats}
                  </span>
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

export default Index;
