-- Add ALC validation tracking columns
ALTER TABLE public.apontamentos
  ADD COLUMN IF NOT EXISTS alc_expected TEXT,
  ADD COLUMN IF NOT EXISTS alc_validation_method TEXT,
  ADD COLUMN IF NOT EXISTS alc_validation_status TEXT;

-- Clean existing data: when "Sem defeito encontrado durante essa inspeção",
-- responsabilidade should be N/A (NULL) instead of "Sorting" or similar
UPDATE public.apontamentos
SET responsabilidade_defeito = NULL
WHERE tipo = 'incoming'
  AND descricao = 'Sem defeito encontrado durante essa inspeção'
  AND responsabilidade_defeito IS NOT NULL;