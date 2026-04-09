
-- Add numero column to error_reports
ALTER TABLE public.error_reports ADD COLUMN numero text;

-- Populate existing rows with sequential numbers
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
  FROM public.error_reports
)
UPDATE public.error_reports e
SET numero = 'HD-' || LPAD(n.rn::text, 4, '0')
FROM numbered n
WHERE e.id = n.id;

-- Create trigger function for auto-numbering
CREATE OR REPLACE FUNCTION public.generate_helpdesk_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(numero, '^HD-', ''), '')::integer), 0) + 1
  INTO next_num
  FROM public.error_reports
  WHERE numero IS NOT NULL;
  
  NEW.numero := 'HD-' || LPAD(next_num::text, 4, '0');
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER set_helpdesk_number
  BEFORE INSERT ON public.error_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_helpdesk_number();
