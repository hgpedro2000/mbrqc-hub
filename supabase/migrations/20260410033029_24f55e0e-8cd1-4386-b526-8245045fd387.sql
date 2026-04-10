
-- 1. Create inspector_qualifications table for Versatility Matrix
CREATE TABLE public.inspector_qualifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  area text NOT NULL,
  habilitado boolean NOT NULL DEFAULT false,
  last_evaluation_date date,
  next_evaluation_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, area)
);

ALTER TABLE public.inspector_qualifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth can view qualifications"
ON public.inspector_qualifications FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Admin/Lider can manage qualifications"
ON public.inspector_qualifications FOR ALL
TO authenticated USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lider'::app_role)
);

CREATE TRIGGER update_inspector_qualifications_updated_at
BEFORE UPDATE ON public.inspector_qualifications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Fix consumable request number duplication with advisory lock
CREATE OR REPLACE FUNCTION public.generate_consumable_request_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  next_num integer;
BEGIN
  -- Use advisory lock to prevent race conditions
  PERFORM pg_advisory_xact_lock(hashtext('consumable_request_number'));
  
  SELECT COALESCE(MAX(NULLIF(regexp_replace(numero, '^REQ-', ''), '')::integer), 0) + 1
  INTO next_num
  FROM public.consumable_requests
  WHERE numero IS NOT NULL;
  
  NEW.numero := 'REQ-' || LPAD(next_num::text, 4, '0');
  RETURN NEW;
END;
$function$;
