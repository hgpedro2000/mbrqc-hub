import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import HKMCScanner from "@/components/HKMCScanner";

const BarcodeScanner = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [loading, user, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3 border-b border-border bg-background">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-heading font-bold">Barcode Scanner H/KMC</h1>
      </header>
      <HKMCScanner />
    </div>
  );
};

export default BarcodeScanner;
