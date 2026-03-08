import { useNavigate } from "react-router-dom";
import { ArrowLeft, Construction } from "lucide-react";
import { Button } from "@/components/ui/button";

const ComingSoon = ({ title }: { title: string }) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center mx-auto mb-6">
          <Construction className="w-8 h-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-heading font-bold text-foreground mb-2">{title}</h1>
        <p className="text-muted-foreground mb-6">
          Este módulo está em desenvolvimento e será disponibilizado em breve.
        </p>
        <Button variant="outline" onClick={() => navigate("/")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar ao Hub
        </Button>
      </div>
    </div>
  );
};

export default ComingSoon;
