
ALTER TABLE public.contencao
  ADD COLUMN IF NOT EXISTS responsabilidade text,
  ADD COLUMN IF NOT EXISTS estoque_indefinido boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mark_check_local text,
  ADD COLUMN IF NOT EXISTS mark_check_como text,
  ADD COLUMN IF NOT EXISTS mark_check_com_que text,
  ADD COLUMN IF NOT EXISTS mark_check_fotos text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS fotos_problema text[] NOT NULL DEFAULT ARRAY[]::text[];
