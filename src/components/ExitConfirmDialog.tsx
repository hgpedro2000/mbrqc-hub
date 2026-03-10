import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Save, LogOut } from "lucide-react";

interface ExitConfirmDialogProps {
  open: boolean;
  onSaveAndExit: () => void;
  onExitWithoutSave: () => void;
  onCancel: () => void;
  saving?: boolean;
}

const ExitConfirmDialog = ({ open, onSaveAndExit, onExitWithoutSave, onCancel, saving }: ExitConfirmDialogProps) => {
  const { t } = useTranslation();
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("common.exitWithoutSaving")}</AlertDialogTitle>
          <AlertDialogDescription>{t("common.exitWithoutSavingDesc")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={onCancel}>{t("common.stay")}</AlertDialogCancel>
          <Button variant="outline" onClick={onExitWithoutSave} className="gap-2">
            <LogOut className="w-4 h-4" /> {t("common.exitWithoutSave")}
          </Button>
          <Button onClick={onSaveAndExit} disabled={saving} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
            <Save className="w-4 h-4" /> {t("common.saveAndExit")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ExitConfirmDialog;
