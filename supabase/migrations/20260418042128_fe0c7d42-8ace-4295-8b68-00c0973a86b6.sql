ALTER TABLE public.ciencias
  ADD COLUMN IF NOT EXISTS termo_aceito text,
  ADD COLUMN IF NOT EXISTS versao_termo text;