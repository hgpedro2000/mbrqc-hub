CREATE OR REPLACE FUNCTION public.get_creator_empresa_map()
RETURNS TABLE (id uuid, empresa text, empresa_terceira text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.empresa, p.empresa_terceira FROM public.profiles p;
$$;

GRANT EXECUTE ON FUNCTION public.get_creator_empresa_map() TO authenticated;