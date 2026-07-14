import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, GraduationCap, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useEnabledModules } from "@/hooks/useModulePermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import logo from "@/assets/hyundai-mobis-logo.png";

const MODULES = [
  {
    id: "sesmt-matriz-treinamentos" as const,
    title: "Matriz de Treinamentos",
    description:
      "Gestão de treinamentos de Segurança do Trabalho, Meio Ambiente e capacitações da área.",
    path: "/sesmt/matriz-treinamentos",
    icon: GraduationCap,
    color: "from-orange-500/15 to-red-500/5",
    iconBg: "bg-orange-500/10 text-orange-600",
  },
];

const SesmtHub = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { impersonating } = useImpersonation();
  const { isAdmin } = useUserRole();
  const { enabledModules } = useEnabledModules(impersonating?.id);
  const enabledSet = new Set(enabledModules);

  const canAccess = (id: string) => (isAdmin && !impersonating) || enabledSet.has(id as any);

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-4 py-6 md:py-10">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => navigate("/")} className="header-btn text-xs md:text-sm">
                <ArrowLeft className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Voltar</span>
              </Button>
              <img src={logo} alt="Hyundai Mobis" className="h-8 md:h-10 object-contain bg-white rounded-md px-2 py-1" />
            </div>
          </div>
          <h1 className="text-2xl md:text-4xl font-heading font-bold mt-3 md:mt-4">SESMT</h1>
          <p className="mt-1 md:mt-2 text-primary-foreground/70 max-w-xl text-sm md:text-lg">
            Segurança do Trabalho, Meio Ambiente e Saúde Ocupacional.
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 -mt-6 pb-12">
        <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => {
            const hasAccess = canAccess(m.id);
            const Icon = m.icon;
            return (
              <div
                key={m.id}
                className={`module-card relative animate-fade-in ${hasAccess ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                onClick={() => hasAccess && navigate(m.path)}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${m.color} pointer-events-none`} />
                <div className="relative">
                  <div className="flex items-start justify-between">
                    <div className={`w-10 h-10 md:w-14 md:h-14 rounded-xl ${m.iconBg} flex items-center justify-center mb-3 md:mb-4`}>
                      <Icon className="w-5 h-5 md:w-7 md:h-7" />
                    </div>
                    {!hasAccess && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Lock className="w-3 h-3" /> Sem acesso
                      </Badge>
                    )}
                  </div>
                  <h2 className="text-lg md:text-xl font-heading font-semibold text-card-foreground mb-1 md:mb-2">
                    {m.title}
                  </h2>
                  <p className="text-muted-foreground text-xs md:text-sm leading-relaxed mb-3 md:mb-4">
                    {m.description}
                  </p>
                  <div className="flex items-center justify-end">
                    <ArrowRight className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground shrink-0" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default SesmtHub;
