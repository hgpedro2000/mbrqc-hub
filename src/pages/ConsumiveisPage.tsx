import { useNavigate } from "react-router-dom";
import { ArrowLeft, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/hyundai-mobis-logo.png";
import ReportErrorButton from "@/components/ReportErrorButton";
import { useAuth } from "@/contexts/AuthContext";

const ConsumiveisPage = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-4 py-6 md:py-12">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-accent flex items-center justify-center">
                <Package className="w-4 h-4 md:w-5 md:h-5 text-accent-foreground" />
              </div>
              <span className="text-xs md:text-sm font-medium tracking-wider uppercase opacity-80">Consumíveis</span>
            </div>
            <div className="flex items-center gap-1 md:gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 px-2 md:px-3">
                <ArrowLeft className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">Hub</span>
              </Button>
              <ReportErrorButton moduleName="Consumíveis" />
            </div>
          </div>
          <h1 className="text-2xl md:text-4xl font-heading font-bold mt-3 md:mt-4">Consumíveis</h1>
          <p className="mt-1 md:mt-2 text-primary-foreground/70 max-w-xl text-sm md:text-lg">Requisição de itens de consumo do setor da qualidade.</p>
        </div>
      </header>

      <main className="container mx-auto px-4 -mt-6 pb-12">
        <div className="form-section text-center py-16">
          <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-heading font-semibold mb-2">Em breve</h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Módulo de requisição de consumíveis como luvas, panos, tubo de mark check, tinta e pontas está em desenvolvimento.
          </p>
        </div>
      </main>
    </div>
  );
};

export default ConsumiveisPage;
