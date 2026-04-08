
-- Add turno column to profiles (for user shift)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS turno text;

-- Add co_inspetores and tempo_inspecao to apontamentos
ALTER TABLE public.apontamentos ADD COLUMN IF NOT EXISTS co_inspetores jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.apontamentos ADD COLUMN IF NOT EXISTS tempo_inspecao text;
