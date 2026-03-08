
-- Create triggers for sequential number generation on all relevant tables
CREATE TRIGGER set_sequential_number_apontamentos
  BEFORE INSERT ON public.apontamentos
  FOR EACH ROW
  WHEN (NEW.numero IS NULL)
  EXECUTE FUNCTION public.generate_sequential_number();

CREATE TRIGGER set_sequential_number_contencao
  BEFORE INSERT ON public.contencao
  FOR EACH ROW
  WHEN (NEW.numero IS NULL)
  EXECUTE FUNCTION public.generate_sequential_number();

CREATE TRIGGER set_sequential_number_auditorias
  BEFORE INSERT ON public.auditorias
  FOR EACH ROW
  WHEN (NEW.numero IS NULL)
  EXECUTE FUNCTION public.generate_sequential_number();

CREATE TRIGGER set_sequential_number_injection
  BEFORE INSERT ON public.injection_checklists
  FOR EACH ROW
  WHEN (NEW.numero IS NULL)
  EXECUTE FUNCTION public.generate_sequential_number();

CREATE TRIGGER set_sequential_number_painting
  BEFORE INSERT ON public.painting_checklists
  FOR EACH ROW
  WHEN (NEW.numero IS NULL)
  EXECUTE FUNCTION public.generate_sequential_number();

CREATE TRIGGER set_sequential_number_assembly
  BEFORE INSERT ON public.assembly_checklists
  FOR EACH ROW
  WHEN (NEW.numero IS NULL)
  EXECUTE FUNCTION public.generate_sequential_number();
