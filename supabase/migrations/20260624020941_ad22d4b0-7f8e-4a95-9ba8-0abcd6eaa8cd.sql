
ALTER TABLE public.contencao
  ADD COLUMN IF NOT EXISTS mark_check boolean NOT NULL DEFAULT false;

ALTER TABLE public.contencao_registros
  ADD COLUMN IF NOT EXISTS qtd_diferenca numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS justificativa_diferenca text,
  ADD COLUMN IF NOT EXISTS fotos_falha text[] NOT NULL DEFAULT '{}'::text[];
