import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  LogOut, Beaker, ShieldCheck, ShieldAlert, FileBarChart, AlertTriangle, ArrowRight, Settings2, Package, Search, QrCode, Users, GripVertical,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useEnabledModules } from "@/hooks/useModulePermissions";
import { Button } from "@/components/ui/button";
import logo from "@/assets/hyundai-mobis-logo.png";
import LanguageToggle from "@/components/LanguageToggle";
import ReportErrorButton from "@/components/ReportErrorButton";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const allModules = [
  { id: "tryout", titleKey: "modules.tryout.title", descriptionKey: "modules.tryout.description", icon: Beaker, path: "/tryout", color: "from-blue-500/15 to-cyan-500/5", iconBg: "bg-blue-500/10 text-blue-600" },
  { id: "auditorias", titleKey: "modules.auditorias.title", descriptionKey: "modules.auditorias.description", icon: ShieldCheck, path: "/auditorias", color: "from-emerald-500/15 to-green-500/5", iconBg: "bg-emerald-500/10 text-emerald-600" },
  { id: "contencao", titleKey: "modules.contencao.title", descriptionKey: "modules.contencao.description", icon: ShieldAlert, path: "/contencao", color: "from-orange-500/15 to-amber-500/5", iconBg: "bg-orange-500/10 text-orange-600" },
  { id: "apontamentos", titleKey: "modules.apontamentos.title", descriptionKey: "modules.apontamentos.description", icon: FileBarChart, path: "/apontamentos", color: "from-violet-500/15 to-purple-500/5", iconBg: "bg-violet-500/10 text-violet-600" },
  { id: "alerta-qualidade", titleKey: "modules.alertaQualidade.title", descriptionKey: "modules.alertaQualidade.description", icon: AlertTriangle, path: "/alerta-qualidade", color: "from-red-500/15 to-rose-500/5", iconBg: "bg-red-500/10 text-red-600" },
  { id: "consumiveis", titleKey: "modules.consumiveis.title", descriptionKey: "modules.consumiveis.description", icon: Package, path: "/consumiveis", color: "from-teal-500/15 to-cyan-500/5", iconBg: "bg-teal-500/10 text-teal-600" },
  { id: "consulta-pecas", titleKey: "modules.consultaPecas.title", descriptionKey: "modules.consultaPecas.description", icon: Search, path: "/consulta-pecas", color: "from-indigo-500/15 to-blue-500/5", iconBg: "bg-indigo-500/10 text-indigo-600" },
  { id: "matriz-versatilidade", titleKey: "modules.matrizVersatilidade.title", descriptionKey: "modules.matrizVersatilidade.description", icon: Users, path: "/matriz-versatilidade", color: "from-pink-500/15 to-fuchsia-500/5", iconBg: "bg-pink-500/10 text-pink-600" },
];

const SortableModuleCard = ({ mod, index, t, navigate }: { mod: typeof allModules[0]; index: number; t: any; navigate: any }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: mod.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="module-card opacity-0 animate-fade-in cursor-pointer relative"
      {...attributes}
      onClick={() => navigate(mod.path)}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${mod.color} pointer-events-none`} />
      <div className="relative">
        <div className="flex items-start justify-between">
          <div className={`w-10 h-10 md:w-14 md:h-14 rounded-xl ${mod.iconBg} flex items-center justify-center mb-3 md:mb-4`}>
            <mod.icon className="w-5 h-5 md:w-7 md:h-7" />
          </div>
          <button
            {...listeners}
            className="touch-none p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
            aria-label="Reordenar"
          >
            <GripVertical className="w-4 h-4" />
          </button>
        </div>
        <h2 className="text-lg md:text-xl font-heading font-semibold text-card-foreground mb-1 md:mb-2">{t(mod.titleKey)}</h2>
        <p className="text-muted-foreground text-xs md:text-sm leading-relaxed mb-3 md:mb-4">{t(mod.descriptionKey)}</p>
        <div className="flex items-center justify-end">
          <ArrowRight className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
};

const Hub = () => {
  const { signOut, profile, user } = useAuth();
  const { impersonating, stopImpersonating } = useImpersonation();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { enabledModules } = useEnabledModules(impersonating?.id);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data: savedOrder } = useQuery({
    queryKey: ["user-module-order", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("user_module_order")
        .select("module_order")
        .eq("user_id", user.id)
        .maybeSingle();
      return (data?.module_order as string[]) || null;
    },
    enabled: !!user?.id,
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t("greeting.morning");
    if (hour < 18) return t("greeting.afternoon");
    return t("greeting.evening");
  };

  const showEngineering = isAdmin;
  const visibleModuleIds = new Set(enabledModules);
  
  // Sort modules based on saved order
  const sortedModules = (() => {
    const visible = allModules.filter((mod) => visibleModuleIds.has(mod.id as any));
    if (!savedOrder || savedOrder.length === 0) return visible;
    const orderMap = new Map(savedOrder.map((id, idx) => [id, idx]));
    return [...visible].sort((a, b) => {
      const aIdx = orderMap.get(a.id) ?? 999;
      const bIdx = orderMap.get(b.id) ?? 999;
      return aIdx - bIdx;
    });
  })();

  const [orderedModules, setOrderedModules] = useState(sortedModules);

  useEffect(() => {
    setOrderedModules(sortedModules);
  }, [savedOrder, enabledModules]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedModules.findIndex((m) => m.id === active.id);
    const newIndex = orderedModules.findIndex((m) => m.id === over.id);
    const newOrder = arrayMove(orderedModules, oldIndex, newIndex);
    setOrderedModules(newOrder);

    // Save to DB
    const moduleIds = newOrder.map((m) => m.id);
    if (user?.id) {
      const { data: existing } = await supabase
        .from("user_module_order")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("user_module_order")
          .update({ module_order: moduleIds as any, updated_at: new Date().toISOString() } as any)
          .eq("user_id", user.id);
      } else {
        await supabase
          .from("user_module_order")
          .insert({ user_id: user.id, module_order: moduleIds as any } as any);
      }
      qc.invalidateQueries({ queryKey: ["user-module-order"] });
    }
  };

  const isMobisBrasil = !impersonating ? profile?.empresa === "mobis_brasil" : impersonating?.empresa === "mobis_brasil";
  
  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-4 py-6 md:py-12">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 md:gap-3">
              <img src={logo} alt="Hyundai Mobis" className="h-8 md:h-10 object-contain bg-white rounded-md px-2 py-1" />
              <span className="text-xs md:text-sm font-medium tracking-wider uppercase opacity-80">Quality Tools</span>
            </div>
            <div className="flex items-center gap-1 md:gap-2">
              <LanguageToggle />
              <ReportErrorButton moduleName="Hub" />
              {isMobisBrasil && (
                <Button variant="ghost" size="sm" onClick={() => navigate("/meu-qr")} className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 text-xs md:text-sm px-2 md:px-3">
                  <QrCode className="w-4 h-4 md:mr-2" />
                  <span className="hidden md:inline">Meu QR Code</span>
                </Button>
              )}
              {showEngineering && (
                <Button variant="ghost" size="sm" onClick={() => navigate("/engenharia")} className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 text-xs md:text-sm px-2 md:px-3">
                  <Settings2 className="w-4 h-4 md:mr-2" />
                  <span className="hidden md:inline">{t("common.engineering")}</span>
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={signOut} className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 text-xs md:text-sm px-2 md:px-3">
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
              <Badge className="bg-amber-500/20 text-amber-200 border-amber-400/30 text-xs">
                Modo Teste
              </Badge>
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
            {t("hub.selectModule")}
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 -mt-6 pb-12">
        {orderedModules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <ShieldAlert className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-heading font-semibold text-foreground mb-2">{t("hub.noModules")}</h2>
            <p className="text-muted-foreground max-w-md text-sm">{t("hub.noModulesDesc")}</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={orderedModules.map((m) => m.id)} strategy={rectSortingStrategy}>
              <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {orderedModules.map((mod, i) => (
                  <SortableModuleCard key={mod.id} mod={mod} index={i} t={t} navigate={navigate} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </main>
    </div>
  );
};

export default Hub;
