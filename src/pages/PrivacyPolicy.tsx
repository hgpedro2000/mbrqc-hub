import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/hyundai-mobis-logo.png";
import { renderMarkdown } from "@/lib/renderMarkdown";

const PrivacyPolicy = () => {
  const navigate = useNavigate();
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_config")
        .select("value")
        .eq("key", "privacy_policy")
        .maybeSingle();
      setContent(data?.value || "Política de Privacidade não disponível.");
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-header">
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="header-btn header-btn-back">
                <ArrowLeft className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Voltar</span>
              </Button>
              <img src={logo} alt="Hyundai Mobis" className="h-6 sm:h-8 object-contain bg-white rounded-md px-2 py-0.5" />
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 mt-3 sm:mt-4">
            <ShieldCheck className="w-5 h-5 sm:w-8 sm:h-8" />
            <h1 className="text-lg sm:text-2xl font-heading font-bold">Política de Privacidade</h1>
          </div>
          <p className="text-primary-foreground/70 text-xs sm:text-sm mt-1">Quality Tools MBR</p>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-6 py-6 sm:py-10 max-w-3xl">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" />
          </div>
        ) : (
          <article
            className="prose prose-invert prose-sm sm:prose-base max-w-none
              prose-headings:font-heading prose-headings:text-foreground
              prose-h1:text-2xl prose-h1:sm:text-3xl prose-h1:mb-6 prose-h1:mt-0
              prose-h2:text-lg prose-h2:sm:text-xl prose-h2:mt-8 prose-h2:mb-3 prose-h2:text-accent
              prose-p:text-foreground/90 prose-p:leading-relaxed
              prose-strong:text-foreground prose-li:text-foreground/90
              prose-a:text-accent hover:prose-a:underline"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
          />
        )}
      </main>
    </div>
  );
};

export default PrivacyPolicy;
