CREATE OR REPLACE FUNCTION public.admin_set_must_change_password(_user_id uuid, _value boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.bypass_profile_guard', 'on', true);
  UPDATE public.profiles
  SET must_change_password = _value
  WHERE id = _user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_must_change_password(uuid, boolean) FROM anon, public, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_must_change_password(uuid, boolean) TO service_role;

INSERT INTO public.app_changelog (version, change_type, title, description)
VALUES ('1.2.8.11', 'patch', 'Reset de senha (Help Desk)',
        'Corrigido erro ao redefinir senha de usuários sem e-mail cadastrado: a Edge Function agora usa RPC SECURITY DEFINER para atualizar o flag de troca obrigatória sem violar a proteção do perfil.')
ON CONFLICT DO NOTHING;