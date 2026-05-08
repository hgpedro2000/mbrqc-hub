CREATE OR REPLACE FUNCTION public.get_co_inspection_profiles()
RETURNS TABLE (
  id uuid,
  full_name text,
  turno text,
  empresa text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.full_name,
    p.turno,
    p.empresa
  FROM public.profiles p
  WHERE p.status = 'active'
    AND COALESCE(p.empresa, '') <> 'empresa_terceira'
    AND p.full_name <> 'TESTER'
  ORDER BY p.full_name;
$$;

REVOKE EXECUTE ON FUNCTION public.get_co_inspection_profiles() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_co_inspection_profiles() TO authenticated;