ALTER TABLE public.monitor_slides_media
  ADD COLUMN IF NOT EXISTS vigencia_inicio timestamptz,
  ADD COLUMN IF NOT EXISTS vigencia_fim    timestamptz,
  ADD COLUMN IF NOT EXISTS slot            smallint NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'monitor_slides_media_slot_check'
  ) THEN
    ALTER TABLE public.monitor_slides_media
      ADD CONSTRAINT monitor_slides_media_slot_check CHECK (slot BETWEEN 1 AND 4);
  END IF;
END$$;