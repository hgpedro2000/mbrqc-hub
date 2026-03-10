import { useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";

interface UseUnsavedChangesGuardOptions {
  hasChanges: boolean;
  onSaveDraft: () => Promise<void>;
}

export const useUnsavedChangesGuard = ({ hasChanges, onSaveDraft }: UseUnsavedChangesGuardOptions) => {
  const navigate = useNavigate();
  const pendingNavRef = useRef<string | null>(null);
  const showDialogRef = useRef<((show: boolean) => void) | null>(null);

  // Browser beforeunload
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasChanges) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasChanges]);

  const handleNavigate = useCallback((path: string) => {
    if (hasChanges) {
      pendingNavRef.current = path;
      showDialogRef.current?.(true);
    } else {
      navigate(path);
    }
  }, [hasChanges, navigate]);

  const confirmSaveAndLeave = useCallback(async () => {
    await onSaveDraft();
    showDialogRef.current?.(false);
    if (pendingNavRef.current) navigate(pendingNavRef.current);
  }, [onSaveDraft, navigate]);

  const confirmLeaveWithoutSaving = useCallback(() => {
    showDialogRef.current?.(false);
    if (pendingNavRef.current) navigate(pendingNavRef.current);
  }, [navigate]);

  const cancelLeave = useCallback(() => {
    pendingNavRef.current = null;
    showDialogRef.current?.(false);
  }, []);

  const setShowDialog = useCallback((fn: (show: boolean) => void) => {
    showDialogRef.current = fn;
  }, []);

  return { handleNavigate, confirmSaveAndLeave, confirmLeaveWithoutSaving, cancelLeave, setShowDialog };
};
