
-- 1. apontamento_history: restrict SELECT to admin/lider
DROP POLICY IF EXISTS "Authenticated can view apontamento_history" ON public.apontamento_history;
CREATE POLICY "Admin/Lider can view apontamento_history"
ON public.apontamento_history
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'lider'::app_role));

-- 2. apontamentos: allow lider/engenharia to UPDATE
DROP POLICY IF EXISTS "Owner or admin can update apontamentos" ON public.apontamentos;
CREATE POLICY "Owner/admin/lider/engenharia can update apontamentos"
ON public.apontamentos
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'lider'::app_role)
  OR public.has_role(auth.uid(), 'engenharia'::app_role)
)
WITH CHECK (
  created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'lider'::app_role)
  OR public.has_role(auth.uid(), 'engenharia'::app_role)
);

-- 3. Storage: drop overly broad delete policies
DROP POLICY IF EXISTS "Auth can delete alertas-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Auth can delete capsule files" ON storage.objects;

-- 4. public_profiles view: switch to security_invoker
ALTER VIEW public.public_profiles SET (security_invoker = true);

-- 5. Revoke EXECUTE on SECURITY DEFINER functions from anon
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.profile_update_is_safe(public.profiles) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.clear_must_change_password() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.log_apontamento_changes() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_privilege_escalation() FROM anon, public, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.profile_update_is_safe(public.profiles) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_must_change_password() TO authenticated;

-- 6. Remove ciencias from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.ciencias;
