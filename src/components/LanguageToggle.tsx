import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

const BrazilFlag = () => (
  <svg viewBox="0 0 640 480" className="w-5 h-4 rounded-sm shadow-sm border border-white/20">
    <rect width="640" height="480" fill="#009c3b" />
    <polygon points="320,40 600,240 320,440 40,240" fill="#ffdf00" />
    <circle cx="320" cy="240" r="100" fill="#002776" />
    <path d="M200,260 Q320,200 440,260" fill="none" stroke="#fff" strokeWidth="12" />
  </svg>
);

const USAFlag = () => (
  <svg viewBox="0 0 640 480" className="w-5 h-4 rounded-sm shadow-sm border border-white/20">
    <rect width="640" height="480" fill="#fff" />
    {[0, 1, 2, 3, 4, 5, 6].map((i) => (
      <rect key={i} y={i * 69.23} width="640" height={34.6} fill="#b22234" />
    ))}
    <rect width="256" height="260" fill="#3c3b6e" />
    {[0, 1, 2, 3, 4].map((row) =>
      [0, 1, 2, 3, 4, 5].map((col) => (
        <circle key={`${row}-${col}`} cx={21 + col * 42} cy={20 + row * 52} r="8" fill="#fff" />
      ))
    )}
  </svg>
);

const LanguageToggle = () => {
  const { i18n } = useTranslation();
  const isPt = i18n.language === "pt";

  const toggleLanguage = () => {
    i18n.changeLanguage(isPt ? "en" : "pt");
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLanguage}
      className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10 px-2 md:px-3 gap-1.5 items-center"
      title={isPt ? "Switch to English" : "Mudar para Português"}
    >
      {isPt ? <USAFlag /> : <BrazilFlag />}
      <span className="text-xs font-medium tracking-wide">{isPt ? "EN" : "PT"}</span>
    </Button>
  );
};

export default LanguageToggle;
