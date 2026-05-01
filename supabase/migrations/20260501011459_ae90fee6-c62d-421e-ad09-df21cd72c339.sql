
-- =========================================================================
-- 1) Profiles: bloqueio em nível de RLS para impedir auto-escalada
-- =========================================================================
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile (safe fields only)"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND NOT public.has_role(auth.uid(), 'admin'::app_role) IS NULL  -- placeholder
  );

-- A linha acima é só para garantir o WITH CHECK; o bloqueio real fica no trigger.
-- Reescrevendo de forma correta usando uma função auxiliar:
DROP POLICY IF EXISTS "Users can update own profile (safe fields only)" ON public.profiles;

-- Função que valida se as alterações pretendidas são apenas em campos seguros
-- comparando com a linha atual no banco.
CREATE OR REPLACE FUNCTION public.profile_update_is_safe(_new public.profiles)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _new.id
      AND p.id = auth.uid()
      AND p.is_admin               IS NOT DISTINCT FROM _new.is_admin
      AND p.status                 IS NOT DISTINCT FROM _new.status
      AND p.must_change_password   IS NOT DISTINCT FROM _new.must_change_password
      AND p.employee_number        IS NOT DISTINCT FROM _new.employee_number
      AND p.email                  IS NOT DISTINCT FROM _new.email
      AND p.empresa                IS NOT DISTINCT FROM _new.empresa
      AND p.empresa_terceira       IS NOT DISTINCT FROM _new.empresa_terceira
      AND p.cargo                  IS NOT DISTINCT FROM _new.cargo
      AND p.qr_code_id             IS NOT DISTINCT FROM _new.qr_code_id
      AND p.turno                  IS NOT DISTINCT FROM _new.turno
  );
$$;

REVOKE EXECUTE ON FUNCTION public.profile_update_is_safe(public.profiles) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.profile_update_is_safe(public.profiles) TO authenticated;

CREATE POLICY "Users can update own profile (safe fields only)"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND public.profile_update_is_safe(profiles.*)
  );

-- =========================================================================
-- 2) Checklists: remover leitura pública anônima
-- =========================================================================
DROP POLICY IF EXISTS "Anyone can view assembly checklists" ON public.assembly_checklists;
CREATE POLICY "Authenticated can view assembly_checklists"
  ON public.assembly_checklists FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can view painting checklists" ON public.painting_checklists;
CREATE POLICY "Authenticated can view painting_checklists"
  ON public.painting_checklists FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can view injection checklists" ON public.injection_checklists;
CREATE POLICY "Authenticated can view injection_checklists"
  ON public.injection_checklists FOR SELECT
  TO authenticated
  USING (true);

-- =========================================================================
-- 3) Storage capsule-files: restringir INSERT a admin/engenharia
-- =========================================================================
DROP POLICY IF EXISTS "Auth can upload capsule files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload capsule-files" ON storage.objects;
CREATE POLICY "Admin/engenharia can upload capsule-files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'capsule-files'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'engenharia'::app_role)
    )
  );

-- =========================================================================
-- 4) Reforçar revoke das SECURITY DEFINER internas
-- =========================================================================
REVOKE EXECUTE ON FUNCTION public.generate_sequential_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_qr_code_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_helpdesk_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_consumable_request_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_privilege_escalation() FROM PUBLIC, anon, authenticated;
