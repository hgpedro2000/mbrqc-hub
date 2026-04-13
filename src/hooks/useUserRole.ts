import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";

export const useUserRole = () => {
  const { user } = useAuth();
  const { impersonating } = useImpersonation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // When impersonating, check the impersonated user's role instead
  const targetUserId = impersonating?.id || user?.id;

  useEffect(() => {
    if (!targetUserId) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    const checkRole = async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", targetUserId)
        .eq("role", "admin")
        .maybeSingle();

      setIsAdmin(!!data);
      setLoading(false);
    };

    checkRole();
  }, [targetUserId]);

  return { isAdmin, loading };
};
