import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";

export const useTagPermission = () => {
  const { user, profile } = useAuth();
  const { impersonating } = useImpersonation();
  const [canInsertTag, setCanInsertTag] = useState(false);
  const [userRole, setUserRole] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const targetUserId = impersonating?.id || user?.id;
  const activeProfile = impersonating || profile;

  useEffect(() => {
    if (!targetUserId) { setLoading(false); return; }
    const check = async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", targetUserId)
        .maybeSingle();
      const role = data?.role || "user";
      setUserRole(role);
      const allowedRoles = ["admin", "lider", "engenharia"];
      const allowedCargos = ["supervisor", "gerente", "analista de qualidade", "lider de qualidade"];
      const cargoLower = (activeProfile?.cargo || "").toLowerCase();
      const isThirdParty = activeProfile?.empresa === "empresa_terceira" || !!activeProfile?.empresa_terceira;
      const canTag = allowedRoles.includes(role) ||
        allowedCargos.some(c => cargoLower.includes(c));
      setCanInsertTag(!isThirdParty && canTag);
      setLoading(false);
    };
    check();
  }, [targetUserId, activeProfile]);

  return { canInsertTag, userRole, loading };
};
