
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS apontamentos_view_scope text[];

CREATE OR REPLACE FUNCTION public.profile_update_is_safe(_new profiles)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      AND p.apontamentos_view_scope IS NOT DISTINCT FROM _new.apontamentos_view_scope
  );
$function$;

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
     OR NEW.turno IS DISTINCT FROM OLD.turno
     OR NEW.apontamentos_view_scope IS DISTINCT FROM OLD.apontamentos_view_scope THEN
    RAISE EXCEPTION 'Alteração de campo privilegiado não permitida';
  END IF;
  RETURN NEW;
END;
$function$;
