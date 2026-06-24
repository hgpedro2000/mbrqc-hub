
CREATE OR REPLACE FUNCTION public.admin_set_must_change_password(_user_id uuid, _value boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM set_config('app.bypass_profile_guard', 'on', true);
  UPDATE public.profiles
  SET must_change_password = _value,
      password_changed_at = CASE WHEN _value THEN now() ELSE password_changed_at END
  WHERE id = _user_id;
END;
$function$;

INSERT INTO public.app_config (key, value)
VALUES ('temp_password_expiry_days', '7')
ON CONFLICT (key) DO NOTHING;
