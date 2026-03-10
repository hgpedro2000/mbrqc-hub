import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";

const LanguageToggle = () => {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === "pt" ? "en" : "pt";
    i18n.changeLanguage(newLang);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLanguage}
      className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 text-xs md:text-sm px-2 md:px-3 gap-1"
    >
      <Languages className="w-4 h-4" />
      <span className="hidden md:inline">{i18n.language === "pt" ? "EN" : "PT"}</span>
      <span className="md:hidden">{i18n.language === "pt" ? "EN" : "PT"}</span>
    </Button>
  );
};

export default LanguageToggle;
