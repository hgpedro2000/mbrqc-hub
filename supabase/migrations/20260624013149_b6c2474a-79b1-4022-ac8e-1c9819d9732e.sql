
-- 1) Extend contencao
ALTER TABLE public.contencao
  ADD COLUMN IF NOT EXISTS local text,
  ADD COLUMN IF NOT EXISTS data_conclusao timestamptz,
  ADD COLUMN IF NOT EXISTS total_horas numeric NOT NULL DEFAULT 0;

-- Replace status check to include new values; migrate legacy 'aberta' to 'emitida'
ALTER TABLE public.contencao DROP CONSTRAINT IF EXISTS contencao_status_check;
UPDATE public.contencao SET status = 'emitida' WHERE status = 'aberta';
ALTER TABLE public.contencao ALTER COLUMN status SET DEFAULT 'emitida';
ALTER TABLE public.contencao
  ADD CONSTRAINT contencao_status_check
  CHECK (status = ANY (ARRAY['emitida','iniciada','em_andamento','concluida','cancelada']));

-- 2) Create contencao_registros
CREATE TABLE IF NOT EXISTS public.contencao_registros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contencao_id uuid NOT NULL REFERENCES public.contencao(id) ON DELETE CASCADE,
  turno text NOT NULL CHECK (turno IN ('1T','2T','3T')),
  data date NOT NULL DEFAULT CURRENT_DATE,
  hora_inicio time NOT NULL,
  hora_fim time NOT NULL,
  horas_trabalhadas numeric GENERATED ALWAYS AS (
    GREATEST(0, EXTRACT(EPOCH FROM (hora_fim - hora_inicio)) / 3600.0)
  ) STORED,
  local text,
  inspetores jsonb NOT NULL DEFAULT '[]'::jsonb,
  qtd_inspetores integer NOT NULL DEFAULT 0,
  qtd_inspecionada integer NOT NULL DEFAULT 0,
  qtd_ok integer NOT NULL DEFAULT 0,
  qtd_ng integer NOT NULL DEFAULT 0,
  mark_check boolean NOT NULL DEFAULT false,
  fotos jsonb NOT NULL DEFAULT '[]'::jsonb,
  observacoes text,
  finaliza_contencao boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contencao_registros_contencao ON public.contencao_registros(contencao_id);
CREATE INDEX IF NOT EXISTS idx_contencao_registros_data ON public.contencao_registros(data DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contencao_registros TO authenticated;
GRANT ALL ON public.contencao_registros TO service_role;

ALTER TABLE public.contencao_registros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth can view contencao_registros"
  ON public.contencao_registros FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth can insert contencao_registros"
  ON public.contencao_registros FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admin/lider/engenharia can update contencao_registros"
  ON public.contencao_registros FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'lider'::app_role)
    OR public.has_role(auth.uid(), 'engenharia'::app_role)
  );

CREATE POLICY "Admins can delete contencao_registros"
  ON public.contencao_registros FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_contencao_registros_updated_at
  BEFORE UPDATE ON public.contencao_registros
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Recompute trigger
CREATE OR REPLACE FUNCTION public.recompute_contencao_totais()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_id uuid;
  total_h numeric;
  total_reg integer;
  distinct_turnos integer;
  has_final boolean;
  cur_status text;
BEGIN
  c_id := COALESCE(NEW.contencao_id, OLD.contencao_id);

  SELECT COALESCE(SUM(horas_trabalhadas),0),
         COUNT(*),
         COUNT(DISTINCT turno),
         BOOL_OR(finaliza_contencao)
    INTO total_h, total_reg, distinct_turnos, has_final
  FROM public.contencao_registros
  WHERE contencao_id = c_id;

  SELECT status INTO cur_status FROM public.contencao WHERE id = c_id;

  IF cur_status = 'cancelada' THEN
    UPDATE public.contencao SET total_horas = total_h WHERE id = c_id;
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF has_final THEN
    UPDATE public.contencao
      SET total_horas = total_h,
          status = 'concluida',
          data_conclusao = COALESCE(data_conclusao, now())
      WHERE id = c_id;
  ELSIF total_reg = 0 THEN
    UPDATE public.contencao
      SET total_horas = 0,
          status = 'emitida',
          data_conclusao = NULL
      WHERE id = c_id;
  ELSIF total_reg = 1 OR distinct_turnos = 1 THEN
    UPDATE public.contencao
      SET total_horas = total_h,
          status = CASE WHEN total_reg = 1 THEN 'iniciada' ELSE 'em_andamento' END,
          data_conclusao = NULL
      WHERE id = c_id;
  ELSE
    UPDATE public.contencao
      SET total_horas = total_h,
          status = 'em_andamento',
          data_conclusao = NULL
      WHERE id = c_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_contencao_registros_recompute ON public.contencao_registros;
CREATE TRIGGER trg_contencao_registros_recompute
  AFTER INSERT OR UPDATE OR DELETE ON public.contencao_registros
  FOR EACH ROW EXECUTE FUNCTION public.recompute_contencao_totais();

-- 4) Storage policies for containment-photos
CREATE POLICY "Auth can view containment-photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'containment-photos');

CREATE POLICY "Auth can upload containment-photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'containment-photos');

CREATE POLICY "Auth can update containment-photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'containment-photos');

CREATE POLICY "Auth can delete containment-photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'containment-photos');

-- 5) Realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.contencao_registros;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.contencao;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.contencao_registros REPLICA IDENTITY FULL;
ALTER TABLE public.contencao REPLICA IDENTITY FULL;

-- 6) Changelog
INSERT INTO public.app_changelog (version, change_type, title, description)
VALUES ('1.2.9.0', 'minor', 'Contenção: registros por turno e status em 4 etapas',
'Novo fluxo de status (Emitida/Iniciada/Em Andamento/Concluída), campo Local, registros por turno com inspetores, Mark Check com fotos, totais de horas e resumo mensal em tempo real.');
