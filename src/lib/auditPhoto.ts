import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, { url: string; exp: number }>();
const EXPIRES = 60 * 60; // 1h

export async function getAuditPhotoUrl(path?: string | null): Promise<string | null> {
  if (!path) return null;
  const now = Date.now();
  const hit = cache.get(path);
  if (hit && hit.exp > now + 60_000) return hit.url;
  const { data, error } = await supabase.storage
    .from("audit-photos")
    .createSignedUrl(path, EXPIRES);
  if (error || !data?.signedUrl) return null;
  cache.set(path, { url: data.signedUrl, exp: now + EXPIRES * 1000 });
  return data.signedUrl;
}

export function useAuditPhotoUrl(path?: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!path) { setUrl(null); return; }
    getAuditPhotoUrl(path).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [path]);
  return url;
}
