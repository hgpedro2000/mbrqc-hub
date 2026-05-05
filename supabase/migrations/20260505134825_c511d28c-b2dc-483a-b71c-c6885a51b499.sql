-- 1) History table
CREATE TABLE IF NOT EXISTS public.apontamento_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apontamento_id UUID NOT NULL,
  edited_by UUID,
  edited_by_name TEXT,
  edited_by_email TEXT,
  edited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_admin_edit BOOLEAN NOT NULL DEFAULT false,
  changes JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_apontamento_history_apontamento_id
  ON public.apontamento_history(apontamento_id, edited_at DESC);

ALTER TABLE public.apontamento_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view apontamento_history" ON public.apontamento_history;
CREATE POLICY "Authenticated can view apontamento_history"
  ON public.apontamento_history FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "System inserts apontamento_history" ON public.apontamento_history;
CREATE POLICY "System inserts apontamento_history"
  ON public.apontamento_history FOR INSERT TO authenticated
  WITH CHECK (edited_by = auth.uid() OR edited_by IS NULL);

DROP POLICY IF EXISTS "Admins delete apontamento_history" ON public.apontamento_history;
CREATE POLICY "Admins delete apontamento_history"
  ON public.apontamento_history FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) Trigger function: log diff between OLD and NEW
CREATE OR REPLACE FUNCTION public.log_apontamento_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  is_admin BOOLEAN := false;
  user_name TEXT;
  user_email TEXT;
  old_j JSONB;
  new_j JSONB;
  diff JSONB := '{}'::jsonb;
  k TEXT;
BEGIN
  IF uid IS NULL THEN
    RETURN NEW;
  END IF;

  is_admin := public.has_role(uid, 'admin'::app_role);

  SELECT full_name, email INTO user_name, user_email
  FROM public.profiles WHERE id = uid;

  old_j := to_jsonb(OLD) - 'updated_at' - 'created_at';
  new_j := to_jsonb(NEW) - 'updated_at' - 'created_at';

  FOR k IN SELECT jsonb_object_keys(new_j) LOOP
    IF (old_j -> k) IS DISTINCT FROM (new_j -> k) THEN
      diff := diff || jsonb_build_object(k, jsonb_build_object('old', old_j -> k, 'new', new_j -> k));
    END IF;
  END LOOP;

  IF diff = '{}'::jsonb THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.apontamento_history(
    apontamento_id, edited_by, edited_by_name, edited_by_email,
    is_admin_edit, changes
  ) VALUES (
    NEW.id, uid, COALESCE(user_name, user_email, 'Usuário'),
    user_email, is_admin, diff
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_apontamento_changes ON public.apontamentos;
CREATE TRIGGER trg_log_apontamento_changes
AFTER UPDATE ON public.apontamentos
FOR EACH ROW EXECUTE FUNCTION public.log_apontamento_changes();

-- 3) Tighten apontamentos INSERT: require created_by = auth.uid() (or admin)
DROP POLICY IF EXISTS "Auth can insert apontamentos" ON public.apontamentos;
CREATE POLICY "Auth can insert apontamentos"
  ON public.apontamentos FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role)
  );