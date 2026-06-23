// Dedicated Supabase client for the /monitor route.
// Uses the anon key with NO session persistence so the monitor stays
// connected as a public reader even when the main app signs out.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const monitorClient = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: "sb-monitor-noop",
  },
  realtime: { params: { eventsPerSecond: 5 } },
});
