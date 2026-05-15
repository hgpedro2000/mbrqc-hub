-- 1. Normalization helpers
CREATE OR REPLACE FUNCTION public.normalize_part_number(_pn text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN _pn IS NULL THEN NULL ELSE UPPER(REPLACE(_pn, '-', '')) END;
$$;

CREATE OR REPLACE FUNCTION public.tg_normalize_part_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.part_number := public.normalize_part_number(NEW.part_number);
  RETURN NEW;
END;
$$;

-- 2. Triggers
DROP TRIGGER IF EXISTS normalize_part_number_apontamentos ON public.apontamentos;
CREATE TRIGGER normalize_part_number_apontamentos
  BEFORE INSERT OR UPDATE OF part_number ON public.apontamentos
  FOR EACH ROW EXECUTE FUNCTION public.tg_normalize_part_number();

DROP TRIGGER IF EXISTS normalize_part_number_alertas_qualidade ON public.alertas_qualidade;
CREATE TRIGGER normalize_part_number_alertas_qualidade
  BEFORE INSERT OR UPDATE OF part_number ON public.alertas_qualidade
  FOR EACH ROW EXECUTE FUNCTION public.tg_normalize_part_number();

DROP TRIGGER IF EXISTS normalize_part_number_assembly_checklists ON public.assembly_checklists;
CREATE TRIGGER normalize_part_number_assembly_checklists
  BEFORE INSERT OR UPDATE OF part_number ON public.assembly_checklists
  FOR EACH ROW EXECUTE FUNCTION public.tg_normalize_part_number();

DROP TRIGGER IF EXISTS normalize_part_number_injection_checklists ON public.injection_checklists;
CREATE TRIGGER normalize_part_number_injection_checklists
  BEFORE INSERT OR UPDATE OF part_number ON public.injection_checklists
  FOR EACH ROW EXECUTE FUNCTION public.tg_normalize_part_number();

DROP TRIGGER IF EXISTS normalize_part_number_painting_checklists ON public.painting_checklists;
CREATE TRIGGER normalize_part_number_painting_checklists
  BEFORE INSERT OR UPDATE OF part_number ON public.painting_checklists
  FOR EACH ROW EXECUTE FUNCTION public.tg_normalize_part_number();

DROP TRIGGER IF EXISTS normalize_part_number_part_numbers ON public.part_numbers;
CREATE TRIGGER normalize_part_number_part_numbers
  BEFORE INSERT OR UPDATE OF part_number ON public.part_numbers
  FOR EACH ROW EXECUTE FUNCTION public.tg_normalize_part_number();

DROP TRIGGER IF EXISTS normalize_part_number_contencao ON public.contencao;
CREATE TRIGGER normalize_part_number_contencao
  BEFORE INSERT OR UPDATE OF part_number ON public.contencao
  FOR EACH ROW EXECUTE FUNCTION public.tg_normalize_part_number();

-- 3. Dedup part_numbers before backfill: delete rows whose normalized form already exists as another row
DELETE FROM public.part_numbers a
USING public.part_numbers b
WHERE a.id <> b.id
  AND a.supplier_id = b.supplier_id
  AND public.normalize_part_number(a.part_number) = public.normalize_part_number(b.part_number)
  AND a.part_number <> public.normalize_part_number(a.part_number)  -- a is the "messy" one
  AND b.part_number = public.normalize_part_number(b.part_number); -- b is already clean

-- 4. Backfill all tables
UPDATE public.apontamentos SET part_number = public.normalize_part_number(part_number)
  WHERE part_number IS DISTINCT FROM public.normalize_part_number(part_number);
UPDATE public.alertas_qualidade SET part_number = public.normalize_part_number(part_number)
  WHERE part_number IS DISTINCT FROM public.normalize_part_number(part_number);
UPDATE public.assembly_checklists SET part_number = public.normalize_part_number(part_number)
  WHERE part_number IS DISTINCT FROM public.normalize_part_number(part_number);
UPDATE public.injection_checklists SET part_number = public.normalize_part_number(part_number)
  WHERE part_number IS DISTINCT FROM public.normalize_part_number(part_number);
UPDATE public.painting_checklists SET part_number = public.normalize_part_number(part_number)
  WHERE part_number IS DISTINCT FROM public.normalize_part_number(part_number);
UPDATE public.part_numbers SET part_number = public.normalize_part_number(part_number)
  WHERE part_number IS DISTINCT FROM public.normalize_part_number(part_number);
UPDATE public.contencao SET part_number = public.normalize_part_number(part_number)
  WHERE part_number IS DISTINCT FROM public.normalize_part_number(part_number);