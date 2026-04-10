-- Add new roles to enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'lider';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'inspetor';

-- Add cargo and qr_code_id to existing profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS cargo text,
ADD COLUMN IF NOT EXISTS qr_code_id text UNIQUE;

-- Trigger to auto-generate qr_code_id for profiles
CREATE OR REPLACE FUNCTION public.generate_qr_code_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_num integer;
BEGIN
  IF NEW.qr_code_id IS NULL THEN
    SELECT COALESCE(MAX(NULLIF(regexp_replace(qr_code_id, '^INSP-', ''), '')::integer), 0) + 1
    INTO next_num
    FROM public.profiles
    WHERE qr_code_id IS NOT NULL;
    NEW.qr_code_id := 'INSP-' || LPAD(next_num::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_qr_code_id
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.generate_qr_code_id();

-- Generate qr_code_id for existing profiles that don't have one
DO $$
DECLARE
  r RECORD;
  counter integer := 0;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE qr_code_id IS NULL ORDER BY created_at LOOP
    counter := counter + 1;
    UPDATE public.profiles SET qr_code_id = 'INSP-' || LPAD(counter::text, 5, '0') WHERE id = r.id;
  END LOOP;
END;
$$;