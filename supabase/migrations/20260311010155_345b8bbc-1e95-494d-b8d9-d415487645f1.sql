
ALTER TABLE public.painting_checklists
  ADD COLUMN IF NOT EXISTS projeto text DEFAULT '',
  ADD COLUMN IF NOT EXISTS fornecedor text DEFAULT '',
  ADD COLUMN IF NOT EXISTS part_number text DEFAULT '',
  ADD COLUMN IF NOT EXISTS part_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS modulo text DEFAULT '';

ALTER TABLE public.assembly_checklists
  ADD COLUMN IF NOT EXISTS projeto text DEFAULT '',
  ADD COLUMN IF NOT EXISTS fornecedor text DEFAULT '',
  ADD COLUMN IF NOT EXISTS part_number text DEFAULT '',
  ADD COLUMN IF NOT EXISTS part_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS modulo text DEFAULT '';
