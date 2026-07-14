import { useNavigate } from "react-router-dom";
import { useMemo, useEffect, useRef } from "react";
import {
  LogOut, Settings2, QrCode, ShieldCheck, Factory, Briefcase, HardHat, ClipboardCheck, Lock, ArrowRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useEnabledModules } from "@/hooks/useModulePermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import logo from "@/assets/hyundai-mobis-logo.png";
import LanguageToggle from "@/components/LanguageToggle";
import ReportErrorButton from "@/components/ReportErrorButton";
import { useTranslation } from "react-i18next";
import VersionBadge from "@/components/VersionBadge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type SubHub = {
  id: string;
  permission: string;
  title: string;
  description: string;
  path: string | null;
  icon: any;
  color: string;
  iconBg: string;
  status: "active" | "coming_soon";
};

const SUB_HUBS: SubHub[] = [
  {
    id: "qualidade",
    permission: "subhub_qualidade",
    title: "Qualidade",
    description: "Try-Out, Auditorias, Apontamentos, Alertas, Contenção, Consumíveis, Matriz de Versatilidade e mais.",
    path: "/qualidade",
    icon: ShieldCheck,
    color: "from-emerald-500/15 to-green-500/5",
    iconBg: "bg-emerald-500/10 text-emerald-600",
    status: "active",
  },
  {
    id: "ga",
    permission: "subhub_ga",
    title: "G.A.",
    description: "Módulo Administrativo Geral. Em breve.",
    path: null,
    icon: Briefcase,
    color: "from-slate-500/15 to-slate-500/5",
    iconBg: "bg-slate-500/10 text-slate-600",
    status: "coming_soon",
  },
  {
    id: "producao",
    permission: "subhub_producao",
    title: "Produção",
    description: "Controle e indicadores de Produção. Em breve.",
    path: null,
    icon: Factory,
    color: "from-blue-500/15 to-cyan-500/5",
    iconBg: "bg-blue-500/10 text-blue-600",
    status: "coming_soon",
  },
  {
    id: "vendas",
    permission: "subhub_vendas",
    title: "Vendas",
    description: "Módulo Comercial e de Vendas. Em breve.",
    path: null,
    icon: ClipboardCheck,
    color: "from-violet-500/15 to-purple-500/5",
    iconBg: "bg-violet-500/10 text-violet-600",
    status: "coming_soon",
  },
  {
    id: "sesmt",
    permission: "subhub_sesmt",
    title: "SESMT",
    description: "Segurança do Trabalho, Meio Ambiente e Saúde Ocupacional.",
    path: "/sesmt",
    icon: HardHat,
    color: "from-orange-500/15 to-red-500/5",
    iconBg: "bg-orange-500/10 text-orange-600",
    status: "active",
  },
];

const Hub = () => {
  const { signOut, profile, isAdmin: realIsAdmin, user } = useAuth();
  const { impersonating, stopImpersonating } = useImpersonation();
  const { isAdmin } = useUserRole();
  const { enabledModules } = useEnabledModules(impersonating?.id);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const enabledSet = useMemo(() => new Set(enabledModules), [enabledModules]);

  const activeProfile = impersonating || profile;
  const isMobisBrasil = activeProfile?.empresa === "mobis_brasil";
  const activeCargo = profile?.cargo || "";
  const canRequestNewUser = ["lider", "assistente", "analista", "supervisor", "gerente"].some(
    (r) => activeCargo.toLowerCase().includes(r)
  );
  const showEngineering = realIsAdmin;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t("greeting.morning");
    if (hour < 18) return t("greeting.afternoon");
    return t("greeting.evening");
  };

  const canAccessSubHub = (permission: string) => {
    if (isAdmin && !impersonating) return true;
    return enabledSet.has(permission as any);
  };

  // Show quick-notice popups when entering the Hub for any unread direct messages.
  const shownMsgIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const targetId = impersonating?.id || user?.id;
    if (!targetId) return;
    let cancelled = false;
    (async () => {
      const { data: msgs } = await supabase
        .from("direct_messages" as any)
        .select("id, body, from_user_id, created_at")
        .eq("to_user_id", targetId)
        .is("read_at", null)
        .order("created_at", { ascending: true });
      if (cancelled || !msgs || msgs.length === 0) return;

      const fromIds = Array.from(new Set(msgs.map((m: any) => m.from_user_id).filter(Boolean)));
      const { data: senders } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", fromIds);
      const nameMap = new Map((senders || []).map((s: any) => [s.id, s.full_name]));

      const ids: string[] = [];
      for (const m of msgs as any[]) {
        if (shownMsgIdsRef.current.has(m.id)) continue;
        shownMsgIdsRef.current.add(m.id);
        ids.push(m.id);
        const name = nameMap.get(m.from_user_id) || "Alguém";
        toast.info(`💬 Mensagem de ${name}`, {
          description: (m.body || "").slice(0, 200),
          duration: 10000,
        });
      }
      if (ids.length > 0) {
        await supabase
          .from("direct_messages" as any)
          .update({ read_at: new Date().toISOString() })
          .in("id", ids);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, impersonating?.id]);

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-4 py-6 md:py-12">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 md:gap-3">
              <img src={logo} alt="Hyundai Mobis" className="h-8 md:h-10 object-contain bg-white rounded-md px-2 py-1" />
              <span className="text-xs md:text-sm font-medium tracking-wider uppercase opacity-80">MBRQC</span>
            </div>
            <div className="flex items-center gap-1 md:gap-2">
              <LanguageToggle />
              <ReportErrorButton moduleName="Hub" showNewUserRequest={canRequestNewUser} showAdminHelpDeskTickets={showEngineering} />
              {isMobisBrasil && (
                <Button variant="ghost" onClick={() => navigate("/meu-qr")} className="header-btn text-xs md:text-sm px-2 md:px-3">
                  <QrCode className="w-4 h-4 md:mr-2" />
                  <span className="hidden md:inline">Meu QR Code</span>
                </Button>
              )}
              {showEngineering && (
                <Button variant="ghost" onClick={() => navigate("/engenharia")} className="header-btn text-xs md:text-sm px-2 md:px-3">
                  <Settings2 className="w-4 h-4 md:mr-2" />
                  <span className="hidden md:inline">{t("common.engineering")}</span>
                </Button>
              )}
              <Button variant="ghost" onClick={signOut} className="header-btn header-btn-danger text-xs md:text-sm px-2 md:px-3">
                <LogOut className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">{t("common.logout")}</span>
              </Button>
            </div>
          </div>
          {impersonating ? (
            <div className="flex items-center gap-2 mt-3">
              <h1 className="text-2xl md:text-4xl font-heading font-bold">
                {getGreeting()}, {impersonating.full_name.split(" ")[0]}.
              </h1>
              <Badge className="bg-amber-500/20 text-amber-200 border-amber-400/30 text-xs">Modo Teste</Badge>
              <Button variant="ghost" size="sm" onClick={stopImpersonating} className="text-primary-foreground/70 hover:text-primary-foreground text-xs">
                Sair
              </Button>
            </div>
          ) : (
            <h1 className="text-2xl md:text-4xl font-heading font-bold mt-3 md:mt-4">
              {getGreeting()}, {profile?.full_name?.split(" ")[0] || t("hub.user")}.
            </h1>
          )}
          <p className="mt-1 md:mt-2 text-primary-foreground/70 max-w-xl text-sm md:text-lg">
            Selecione uma área para acessar seus módulos.
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 -mt-6 pb-12">
        <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {SUB_HUBS.map((sh) => {
            const hasAccess = canAccessSubHub(sh.permission);
            const isActive = sh.status === "active";
            const clickable = isActive && hasAccess;
            const Icon = sh.icon;
            return (
              <div
                key={sh.id}
                className={`module-card relative animate-fade-in ${
                  clickable ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                }`}
                onClick={() => clickable && sh.path && navigate(sh.path)}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${sh.color} pointer-events-none`} />
                <div className="relative">
                  <div className="flex items-start justify-between">
                    <div className={`w-10 h-10 md:w-14 md:h-14 rounded-xl ${sh.iconBg} flex items-center justify-center mb-3 md:mb-4`}>
                      <Icon className="w-5 h-5 md:w-7 md:h-7" />
                    </div>
                    {!isActive && (
                      <Badge variant="outline" className="text-[10px]">Em breve</Badge>
                    )}
                    {isActive && !hasAccess && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Lock className="w-3 h-3" /> Sem acesso
                      </Badge>
                    )}
                  </div>
                  <h2 className="text-lg md:text-xl font-heading font-semibold text-card-foreground mb-1 md:mb-2">
                    {sh.title}
                  </h2>
                  <p className="text-muted-foreground text-xs md:text-sm leading-relaxed mb-3 md:mb-4">
                    {sh.description}
                  </p>
                  <div className="flex items-center justify-end">
                    <ArrowRight className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground shrink-0" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex justify-center">
          <VersionBadge />
        </div>
      </main>
    </div>
  );
};

export default Hub;
