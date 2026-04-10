import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  full_name: string;
  employee_number: string;
  must_change_password: boolean;
  status: string;
  turno: string | null;
  empresa: string | null;
  empresa_terceira: string | null;
  cargo: string | null;
  qr_code_id: string | null;
  email: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  versionKicked: boolean;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  versionKicked: false,
});

export const useAuth = () => useContext(AuthContext);

const CLIENT_VERSION = import.meta.env.VITE_APP_VERSION || "1.0.0";

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [versionKicked, setVersionKicked] = useState(false);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, employee_number, must_change_password, status, turno, empresa, empresa_terceira, cargo, qr_code_id, email")
      .eq("id", userId)
      .maybeSingle();
    setProfile(data as Profile | null);
  };

  const checkMinVersion = async () => {
    try {
      const { data } = await supabase
        .from("app_config" as any)
        .select("value")
        .eq("key", "min_required_version")
        .maybeSingle();
      if (data && compareVersions(CLIENT_VERSION, (data as any).value) < 0) {
        setVersionKicked(true);
        await supabase.auth.signOut();
        setProfile(null);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        setTimeout(() => {
          fetchProfile(session.user.id);
          checkMinVersion();
        }, 0);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
        checkMinVersion();
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, loading, signOut, versionKicked }}>
      {children}
    </AuthContext.Provider>
  );
};
