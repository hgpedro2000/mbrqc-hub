import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
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
  is_admin: boolean | null;
  password_changed_at: string | null;
}

export type MFAStatus =
  | "checking"
  | "not-enrolled"
  | "needs-verify"
  | "verified"
  | "not-required";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  versionKicked: boolean;
  isAdmin: boolean;
  mfaStatus: MFAStatus;
  refreshMFAStatus: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  versionKicked: false,
  isAdmin: false,
  mfaStatus: "checking",
  refreshMFAStatus: async () => {},
  refreshProfile: async () => {},
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
  const [mfaStatus, setMfaStatus] = useState<MFAStatus>("checking");

  const isAdmin = !!profile?.is_admin;

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, employee_number, must_change_password, status, turno, empresa, empresa_terceira, cargo, qr_code_id, email, is_admin, password_changed_at")
      .eq("id", userId)
      .maybeSingle();
    setProfile(data as Profile | null);
    return data as Profile | null;
  }, []);

  const checkMinVersion = useCallback(async () => {
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
        return true;
      }
    } catch { /* ignore */ }
    return false;
  }, []);

  const checkMFAStatus = useCallback(async (adminFlag: boolean): Promise<MFAStatus> => {
    if (!adminFlag) return "not-required";
    try {
      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) {
        console.error("MFA listFactors error:", factorsError);
        return "not-enrolled";
      }
      const verifiedFactors = (factorsData?.totp || []).filter(
        (f: any) => f.status === "verified"
      );
      if (verifiedFactors.length === 0) {
        return "not-enrolled";
      }
      const { data: aalData, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError) {
        console.error("MFA AAL error:", aalError);
        return "needs-verify";
      }
      if (aalData?.currentLevel === "aal2") {
        return "verified";
      }
      return "needs-verify";
    } catch (err) {
      console.error("checkMFAStatus error:", err);
      return "not-enrolled";
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return;
    await fetchProfile(session.user.id);
  }, [session, fetchProfile]);

  const refreshMFAStatus = useCallback(async () => {
    if (!session?.user) {
      setMfaStatus("not-required");
      return;
    }
    const currentProfile = profile ?? (await fetchProfile(session.user.id));
    const status = await checkMFAStatus(!!currentProfile?.is_admin);
    setMfaStatus(status);
  }, [session, profile, checkMFAStatus, fetchProfile]);

  const hydrateAuthState = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);

    if (!nextSession?.user) {
      setProfile(null);
      setMfaStatus("not-required");
      setLoading(false);
      return;
    }

    setLoading(true);
    setMfaStatus("checking");

    const currentProfile = await fetchProfile(nextSession.user.id);
    const kicked = await checkMinVersion();

    if (kicked) {
      setMfaStatus("not-required");
      setLoading(false);
      return;
    }

    const status = await checkMFAStatus(!!currentProfile?.is_admin);
    setMfaStatus(status);
    setLoading(false);
  }, [checkMFAStatus, checkMinVersion, fetchProfile]);

  useEffect(() => {
    setLoading(true);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void hydrateAuthState(nextSession);
    });

    void supabase.auth.getSession().then(({ data: { session } }) => hydrateAuthState(session));

    return () => subscription.unsubscribe();
  }, [hydrateAuthState]);

  const signOut = async () => {
    // Fire-and-forget audit before clearing the session
    try {
      const { logAction } = await import("@/lib/logAction");
      await logAction("logout", "auth");
    } catch { /* ignore */ }
    await supabase.auth.signOut();
    setProfile(null);
    setMfaStatus("not-required");
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        signOut,
        versionKicked,
        isAdmin,
        mfaStatus,
        refreshMFAStatus,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
