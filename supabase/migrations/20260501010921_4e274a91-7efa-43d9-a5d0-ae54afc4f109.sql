
-- =========================================================================
-- 1) PROFILES: revogar exposição ampla + view pública mínima + trigger anti-escalada
-- =========================================================================

DROP POLICY IF EXISTS "All authenticated can view profiles for co-inspection" ON public.profiles;

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = on) AS
SELECT
  id,
  full_name,
  employee_number,
  cargo,
  turno,
  empresa,
  empresa_terceira,
  qr_code_id,
  status
FROM public.profiles
WHERE status = 'active';

GRANT SELECT ON public.public_profiles TO authenticated;

-- Trigger: impede usuário comum de alterar campos privilegiados no próprio perfil
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins podem alterar tudo
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Para todos os outros, bloqueia alteração de campos sensíveis
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    RAISE EXCEPTION 'Não é permitido alterar is_admin';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Não é permitido alterar status';
  END IF;
  IF NEW.must_change_password IS DISTINCT FROM OLD.must_change_password THEN
    -- permitir apenas via clear_must_change_password() (security definer) ou admin
    -- bloqueia tentativas diretas
    RAISE EXCEPTION 'Não é permitido alterar must_change_password diretamente';
  END IF;
  IF NEW.employee_number IS DISTINCT FROM OLD.employee_number THEN
    RAISE EXCEPTION 'Não é permitido alterar employee_number';
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Não é permitido alterar email diretamente';
  END IF;
  IF NEW.empresa IS DISTINCT FROM OLD.empresa THEN
    RAISE EXCEPTION 'Não é permitido alterar empresa';
  END IF;
  IF NEW.empresa_terceira IS DISTINCT FROM OLD.empresa_terceira THEN
    RAISE EXCEPTION 'Não é permitido alterar empresa_terceira';
  END IF;
  IF NEW.cargo IS DISTINCT FROM OLD.cargo THEN
    RAISE EXCEPTION 'Não é permitido alterar cargo';
  END IF;
  IF NEW.qr_code_id IS DISTINCT FROM OLD.qr_code_id THEN
    RAISE EXCEPTION 'Não é permitido alterar qr_code_id';
  END IF;
  IF NEW.turno IS DISTINCT FROM OLD.turno THEN
    RAISE EXCEPTION 'Não é permitido alterar turno';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_privilege_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- A função clear_must_change_password é SECURITY DEFINER e não passa pelo trigger?
-- Na verdade triggers BEFORE UPDATE rodam mesmo via security definer.
-- Precisamos liberar a alteração de must_change_password quando vier dela.
-- Solução: marcar via GUC.
CREATE OR REPLACE FUNCTION public.clear_must_change_password()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.bypass_profile_guard', 'on', true);
  UPDATE public.profiles
  SET must_change_password = false,
      password_changed_at = now()
  WHERE id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.bypass_profile_guard', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.must_change_password IS DISTINCT FROM OLD.must_change_password
     OR NEW.employee_number IS DISTINCT FROM OLD.employee_number
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.empresa IS DISTINCT FROM OLD.empresa
     OR NEW.empresa_terceira IS DISTINCT FROM OLD.empresa_terceira
     OR NEW.cargo IS DISTINCT FROM OLD.cargo
     OR NEW.qr_code_id IS DISTINCT FROM OLD.qr_code_id
     OR NEW.turno IS DISTINCT FROM OLD.turno THEN
    RAISE EXCEPTION 'Alteração de campo privilegiado não permitida';
  END IF;
  RETURN NEW;
END;
$$;

-- =========================================================================
-- 2) CHECKLIST_PHOTOS: tirar leitura pública anônima
-- =========================================================================
DROP POLICY IF EXISTS "Anyone can view checklist photos" ON public.checklist_photos;
CREATE POLICY "Authenticated can view checklist_photos"
  ON public.checklist_photos FOR SELECT
  TO authenticated
  USING (true);

-- =========================================================================
-- 3) Realtime: política básica em realtime.messages
-- =========================================================================
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can subscribe to realtime" ON realtime.messages;
CREATE POLICY "Authenticated can subscribe to realtime"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (true);

-- =========================================================================
-- 4) STORAGE: capsule-files privado + DELETE com ownership
-- =========================================================================
UPDATE storage.buckets SET public = false WHERE id = 'capsule-files';

DROP POLICY IF EXISTS "Anyone can read capsule files" ON storage.objects;
DROP POLICY IF EXISTS "Public can read capsule files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can read capsule-files" ON storage.objects;

CREATE POLICY "Authenticated can read capsule-files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'capsule-files');

-- DELETE em capsule-files: apenas uploader (via tabela capsule_files) ou admin
DROP POLICY IF EXISTS "Anyone can delete capsule files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete capsule-files" ON storage.objects;
CREATE POLICY "Owner or admin can delete capsule-files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'capsule-files'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.capsule_files cf
        WHERE cf.file_path = storage.objects.name
          AND cf.uploaded_by = auth.uid()
      )
    )
  );

-- DELETE em alertas-fotos: apenas admin/lider
DROP POLICY IF EXISTS "Anyone can delete alertas fotos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete alertas-fotos" ON storage.objects;
CREATE POLICY "Admin/lider can delete alertas-fotos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'alertas-fotos'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'lider'::app_role)
    )
  );

-- =========================================================================
-- 5) Restringir UPDATE em tabelas com USING(true) -> criador + admin/lider/engenharia
-- =========================================================================

-- apontamentos
DROP POLICY IF EXISTS "Auth can update apontamentos" ON public.apontamentos;
CREATE POLICY "Owner or admin/lider can update apontamentos"
  ON public.apontamentos FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'lider'::app_role)
    OR public.has_role(auth.uid(), 'engenharia'::app_role)
  );

-- contencao (não há created_by; restringir a admin/lider/engenharia)
DROP POLICY IF EXISTS "Auth can update contencao" ON public.contencao;
CREATE POLICY "Admin/lider/engenharia can update contencao"
  ON public.contencao FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'lider'::app_role)
    OR public.has_role(auth.uid(), 'engenharia'::app_role)
  );

-- auditorias (sem created_by)
DROP POLICY IF EXISTS "Authenticated can update auditorias" ON public.auditorias;
CREATE POLICY "Admin/lider/engenharia can update auditorias"
  ON public.auditorias FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'lider'::app_role)
    OR public.has_role(auth.uid(), 'engenharia'::app_role)
  );

DROP POLICY IF EXISTS "Authenticated can update audit responses" ON public.audit_responses;
CREATE POLICY "Admin/lider/engenharia can update audit_responses"
  ON public.audit_responses FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'lider'::app_role)
    OR public.has_role(auth.uid(), 'engenharia'::app_role)
  );

-- alertas_qualidade
DROP POLICY IF EXISTS "Auth can update alertas" ON public.alertas_qualidade;
CREATE POLICY "Admin/lider can update alertas_qualidade"
  ON public.alertas_qualidade FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'lider'::app_role)
    OR public.has_role(auth.uid(), 'engenharia'::app_role)
  );

-- =========================================================================
-- 6) Revogar EXECUTE em funções SECURITY DEFINER internas (chamadas por triggers)
-- =========================================================================
REVOKE EXECUTE ON FUNCTION public.generate_sequential_number() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_qr_code_id() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_helpdesk_number() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_consumable_request_number() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_privilege_escalation() FROM anon, authenticated;
-- Manter has_role e clear_must_change_password executáveis por authenticated
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_must_change_password() TO authenticated;
