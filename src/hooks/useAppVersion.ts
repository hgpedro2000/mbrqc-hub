import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { compareVersions } from "@/lib/version";

const CLIENT_VERSION = import.meta.env.VITE_APP_VERSION || "1.0.0.0";

/**
 * Fetches the version meta tag from the currently DEPLOYED index.html.
 * This is the source of truth for "is there a newer build live?".
 *
 * Why not just trust `app_config.app_version` in the DB?
 * The DB value is bumped as soon as we edit `.env`, but Vercel may take a
 * minute (or longer) to deploy. If we trusted the DB, users would see the
 * "Update available" modal, click Refresh, and reload the SAME stale build —
 * infinite loop. By reading the deployed HTML, the modal only appears once
 * the new build is actually live.
 */
const fetchDeployedVersion = async (): Promise<string | null> => {
  try {
    const res = await fetch(`/?_v=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(
      /<meta\s+name=["']app-version["']\s+content=["']([^"']+)["']/i
    );
    return match?.[1] ?? null;
  } catch {
    return null;
  }
};

export const useAppVersion = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [criticalUpdate, setCriticalUpdate] = useState(false);
  const [deployedVersion, setDeployedVersion] = useState<string | null>(null);
  const [minRequiredVersion, setMinRequiredVersion] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

  const checkVersion = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("app_config" as any)
        .select("key, value")
        .eq("key", "min_required_version")
        .maybeSingle();
      const minVersion = (data as any)?.value || "1.0.0";
      setMinRequiredVersion(minVersion);
      if (compareVersions(CLIENT_VERSION, minVersion) < 0) {
        setCriticalUpdate(true);
      }

      const dv = await fetchDeployedVersion();
      setDeployedVersion(dv);
      if (dv && compareVersions(CLIENT_VERSION, dv) < 0) {
        setUpdateAvailable(true);
      } else {
        setUpdateAvailable(false);
      }
      setLastCheckedAt(new Date());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    checkVersion();
    const interval = setInterval(checkVersion, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkVersion]);

  return {
    updateAvailable,
    criticalUpdate,
    clientVersion: CLIENT_VERSION,
    deployedVersion,
    minRequiredVersion,
    lastCheckedAt,
    recheck: checkVersion,
  };
};
