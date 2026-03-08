
ALTER TABLE public.injection_checklists
  ADD COLUMN total_pecas integer DEFAULT 0,
  ADD COLUMN pecas_ok integer DEFAULT 0,
  ADD COLUMN pecas_ng integer DEFAULT 0,
  ADD COLUMN rate numeric DEFAULT 0,
  ADD COLUMN defects jsonb DEFAULT '[]'::jsonb;
