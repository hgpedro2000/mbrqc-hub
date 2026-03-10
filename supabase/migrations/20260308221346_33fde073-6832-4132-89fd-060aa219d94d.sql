
-- Add numero column to tables that don't have it
ALTER TABLE public.apontamentos ADD COLUMN IF NOT EXISTS numero text;
ALTER TABLE public.contencao ADD COLUMN IF NOT EXISTS numero text;
ALTER TABLE public.auditorias ADD COLUMN IF NOT EXISTS numero text;
ALTER TABLE public.injection_checklists ADD COLUMN IF NOT EXISTS numero text;
ALTER TABLE public.painting_checklists ADD COLUMN IF NOT EXISTS numero text;
ALTER TABLE public.assembly_checklists ADD COLUMN IF NOT EXISTS numero text;

-- Create function to generate sequential numbers per table
CREATE OR REPLACE FUNCTION public.generate_sequential_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  prefix text;
  next_num integer;
BEGIN
  -- Determine prefix based on table
  CASE TG_TABLE_NAME
    WHEN 'apontamentos' THEN prefix := 'APT';
    WHEN 'contencao' THEN prefix := 'CTN';
    WHEN 'auditorias' THEN prefix := 'AUD';
    WHEN 'injection_checklists' THEN prefix := 'INJ';
    WHEN 'painting_checklists' THEN prefix := 'PIN';
    WHEN 'assembly_checklists' THEN prefix := 'MTG';
    ELSE prefix := 'REG';
  END CASE;

  -- Get next sequential number
  EXECUTE format(
    'SELECT COALESCE(MAX(NULLIF(regexp_replace(numero, ''^[A-Z]+-'', ''''), '''')::integer), 0) + 1 FROM public.%I WHERE numero IS NOT NULL',
    TG_TABLE_NAME
  ) INTO next_num;

  NEW.numero := prefix || '-' || LPAD(next_num::text, 4, '0');
  RETURN NEW;
END;
$$;

-- Create triggers for each table
CREATE TRIGGER set_numero_apontamentos
  BEFORE INSERT ON public.apontamentos
  FOR EACH ROW
  WHEN (NEW.numero IS NULL)
  EXECUTE FUNCTION public.generate_sequential_number();

CREATE TRIGGER set_numero_contencao
  BEFORE INSERT ON public.contencao
  FOR EACH ROW
  WHEN (NEW.numero IS NULL)
  EXECUTE FUNCTION public.generate_sequential_number();

CREATE TRIGGER set_numero_auditorias
  BEFORE INSERT ON public.auditorias
  FOR EACH ROW
  WHEN (NEW.numero IS NULL)
  EXECUTE FUNCTION public.generate_sequential_number();

CREATE TRIGGER set_numero_injection
  BEFORE INSERT ON public.injection_checklists
  FOR EACH ROW
  WHEN (NEW.numero IS NULL)
  EXECUTE FUNCTION public.generate_sequential_number();

CREATE TRIGGER set_numero_painting
  BEFORE INSERT ON public.painting_checklists
  FOR EACH ROW
  WHEN (NEW.numero IS NULL)
  EXECUTE FUNCTION public.generate_sequential_number();

CREATE TRIGGER set_numero_assembly
  BEFORE INSERT ON public.assembly_checklists
  FOR EACH ROW
  WHEN (NEW.numero IS NULL)
  EXECUTE FUNCTION public.generate_sequential_number();

-- Backfill existing records with sequential numbers
DO $$
DECLARE
  tbl text;
  prefix text;
  rec record;
  counter integer;
BEGIN
  FOR tbl, prefix IN VALUES 
    ('apontamentos', 'APT'),
    ('contencao', 'CTN'),
    ('auditorias', 'AUD'),
    ('injection_checklists', 'INJ'),
    ('painting_checklists', 'PIN'),
    ('assembly_checklists', 'MTG')
  LOOP
    counter := 1;
    FOR rec IN EXECUTE format('SELECT id FROM public.%I WHERE numero IS NULL ORDER BY created_at ASC', tbl)
    LOOP
      EXECUTE format('UPDATE public.%I SET numero = $1 WHERE id = $2', tbl)
        USING prefix || '-' || LPAD(counter::text, 4, '0'), rec.id;
      counter := counter + 1;
    END LOOP;
  END LOOP;
END;
$$;
