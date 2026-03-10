import { useLocation } from "react-router-dom";
import { useEffect } from "react";
<<<<<<< HEAD

const NotFound = () => {
  const location = useLocation();
=======
import { useTranslation } from "react-i18next";

const NotFound = () => {
  const location = useLocation();
  const { t } = useTranslation();
>>>>>>> 853a538787cf446c7d01e628ea96edf722a8086f

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
<<<<<<< HEAD
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          Return to Home
=======
        <h1 className="mb-4 text-4xl font-bold">{t("notFound.title")}</h1>
        <p className="mb-4 text-xl text-muted-foreground">{t("notFound.message")}</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          {t("notFound.returnHome")}
>>>>>>> 853a538787cf446c7d01e628ea96edf722a8086f
        </a>
      </div>
    </div>
  );
};

export default NotFound;
