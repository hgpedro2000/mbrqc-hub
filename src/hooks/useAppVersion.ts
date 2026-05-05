import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { compareVersions } from "@/lib/version";

const CLIENT_VERSION = import.meta.env.VITE_APP_VERSION || "1.0.0.0";

export const useAppVersion = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [criticalUpdate, setCriticalUpdate] = useState(false);

  const checkVersion = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("app_config" as any)
        .select("key, value")
        .in("key", ["app_version", "min_required_version"]);
      if (error || !data) return;
      const configMap: Record<string, string> = {};
      (data as any[]).forEach((r: any) => { configMap[r.key] = r.value; });
      const serverVersion = configMap.app_version || CLIENT_VERSION;
      const minVersion = configMap.min_required_version || "1.0.0";
      if (compareVersions(CLIENT_VERSION, serverVersion) < 0) {
        setUpdateAvailable(true);
      }
      if (compareVersions(CLIENT_VERSION, minVersion) < 0) {
        setCriticalUpdate(true);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    checkVersion();
    const interval = setInterval(checkVersion, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkVersion]);

  // We intentionally ignore generic "SW_UPDATED" messages here. The service
  // worker fires them every time it activates (including the very first
  // install on a fresh browser), which would incorrectly show the
  // "New Version Available" modal and block the user from logging in on the
  // published site. The version check above is the source of truth for
  // surfacing real updates.

  return { updateAvailable, criticalUpdate, clientVersion: CLIENT_VERSION };
};
