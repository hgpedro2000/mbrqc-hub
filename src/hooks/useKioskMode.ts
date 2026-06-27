import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Kiosk Lockdown hook.
 * - Forces fullscreen (re-enters on unauthorized exit)
 * - Blocks system / nav keyboard shortcuts (Esc, F11, Alt+Tab, Alt+F4, Ctrl+W/T/N/R, Win, etc.)
 * - Re-focuses the window on blur
 * - Disables context menu
 * - All listeners are cleaned up on deactivate
 */
export function useKioskMode(initial = false) {
  const [isKioskMode, setIsKioskMode] = useState(initial);
  const activeRef = useRef(initial);
  activeRef.current = isKioskMode;

  const enterFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        // navigationUI is non-standard but supported; cast to any.
        await (document.documentElement as any).requestFullscreen?.({ navigationUI: "hide" });
      }
    } catch {
      /* requires a user gesture; caller may retry */
    }
  }, []);

  const exitKiosk = useCallback(async () => {
    activeRef.current = false;
    setIsKioskMode(false);
    try { if (document.fullscreenElement) await document.exitFullscreen(); } catch { /* noop */ }
  }, []);

  const enterKiosk = useCallback(async () => {
    activeRef.current = true;
    setIsKioskMode(true);
    await enterFullscreen();
  }, [enterFullscreen]);

  useEffect(() => {
    if (!isKioskMode) return;

    const blockKioskKeys = (e: KeyboardEvent) => {
      if (!activeRef.current) return;
      const k = e.key;
      const blocked = [
        "F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12",
        "Escape","Meta","ContextMenu",
      ];
      const isAltTab = e.altKey && k === "Tab";
      const isAltF4  = e.altKey && k === "F4";
      const isWin    = e.metaKey;
      const isCtrlCombo = e.ctrlKey && ["w","t","n","r","W","T","N","R"].includes(k);

      if (blocked.includes(k) || isAltTab || isAltF4 || isWin || isCtrlCombo) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const onFsChange = () => {
      if (!activeRef.current) return;
      if (!document.fullscreenElement) {
        // Re-enter; will succeed if browser still considers context user-activated
        enterFullscreen();
      }
    };

    const onBlur = () => {
      if (!activeRef.current) return;
      try { window.focus(); } catch { /* noop */ }
    };

    const onContextMenu = (e: MouseEvent) => {
      if (!activeRef.current) return;
      e.preventDefault();
    };

    window.addEventListener("keydown", blockKioskKeys, true);
    document.addEventListener("fullscreenchange", onFsChange);
    window.addEventListener("blur", onBlur);
    document.addEventListener("contextmenu", onContextMenu);

    return () => {
      window.removeEventListener("keydown", blockKioskKeys, true);
      document.removeEventListener("fullscreenchange", onFsChange);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("contextmenu", onContextMenu);
    };
  }, [isKioskMode, enterFullscreen]);

  return { isKioskMode, enterKiosk, exitKiosk, enterFullscreen };
}
