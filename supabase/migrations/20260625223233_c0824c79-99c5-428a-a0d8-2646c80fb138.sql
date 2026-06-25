CREATE TABLE IF NOT EXISTS public.capsule_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.capsule_notes TO authenticated;
GRANT ALL ON public.capsule_notes TO service_role;

ALTER TABLE public.capsule_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notes"
  ON public.capsule_notes
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_capsule_notes_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_capsule_notes_updated_at
  BEFORE UPDATE ON public.capsule_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_capsule_notes_updated_at();