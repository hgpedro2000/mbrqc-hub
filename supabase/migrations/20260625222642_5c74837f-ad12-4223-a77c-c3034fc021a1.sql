CREATE OR REPLACE FUNCTION public.next_employee_number(_prefix text, _pad int)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i int;
  candidate text;
  maxv int;
  pfx text := upper(_prefix);
BEGIN
  -- Serialize concurrent generators for the same prefix
  PERFORM pg_advisory_xact_lock(hashtext('employee_number:' || pfx));
  maxv := (10 ^ _pad)::int;
  FOR i IN 1..maxv-1 LOOP
    candidate := pfx || lpad(i::text, _pad, '0');
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE upper(employee_number) = candidate
    ) THEN
      RETURN candidate;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_employee_number(text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_employee_number(text, int) TO service_role;