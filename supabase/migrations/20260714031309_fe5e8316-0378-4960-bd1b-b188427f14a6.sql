
CREATE OR REPLACE FUNCTION public.enforce_ng_zero_descricao()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.quantidade_ng, 0) = 0 THEN
    NEW.descricao := 'Sem defeito encontrado durante essa inspeção';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_ng_zero_descricao ON public.apontamentos;
CREATE TRIGGER trg_enforce_ng_zero_descricao
BEFORE INSERT OR UPDATE ON public.apontamentos
FOR EACH ROW
EXECUTE FUNCTION public.enforce_ng_zero_descricao();
