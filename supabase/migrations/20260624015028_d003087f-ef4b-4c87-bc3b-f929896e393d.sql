
ALTER TABLE public.contencao ADD COLUMN IF NOT EXISTS dias_andamento integer DEFAULT 0;

CREATE OR REPLACE FUNCTION public.recompute_contencao_totais()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c_id uuid;
  total_h numeric;
  total_reg integer;
  distinct_turnos integer;
  has_final boolean;
  cur_status text;
  min_data date;
  end_data date;
  dias int;
BEGIN
  c_id := COALESCE(NEW.contencao_id, OLD.contencao_id);

  SELECT COALESCE(SUM(horas_trabalhadas),0),
         COUNT(*),
         COUNT(DISTINCT turno),
         BOOL_OR(finaliza_contencao),
         MIN(data)
    INTO total_h, total_reg, distinct_turnos, has_final, min_data
  FROM public.contencao_registros
  WHERE contencao_id = c_id;

  SELECT status INTO cur_status FROM public.contencao WHERE id = c_id;

  IF cur_status = 'cancelada' THEN
    UPDATE public.contencao SET total_horas = total_h WHERE id = c_id;
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF has_final THEN
    end_data := CURRENT_DATE;
    dias := GREATEST(0, (end_data - COALESCE(min_data, end_data)) + 1);
    UPDATE public.contencao
      SET total_horas = total_h,
          status = 'concluida',
          data_conclusao = COALESCE(data_conclusao, now()),
          dias_andamento = dias
      WHERE id = c_id;
  ELSIF total_reg = 0 THEN
    UPDATE public.contencao
      SET total_horas = 0,
          status = 'emitida',
          data_conclusao = NULL,
          dias_andamento = 0
      WHERE id = c_id;
  ELSE
    dias := GREATEST(1, (CURRENT_DATE - COALESCE(min_data, CURRENT_DATE)) + 1);
    UPDATE public.contencao
      SET total_horas = total_h,
          status = CASE
            WHEN distinct_turnos >= 2 OR total_reg >= 2 THEN 'em_andamento'
            ELSE 'iniciada'
          END,
          data_conclusao = NULL,
          dias_andamento = dias
      WHERE id = c_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Recalcula tudo uma vez para popular dias_andamento
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT contencao_id AS id FROM public.contencao_registros LOOP
    UPDATE public.contencao SET updated_at = updated_at WHERE id = r.id;
  END LOOP;
END $$;
