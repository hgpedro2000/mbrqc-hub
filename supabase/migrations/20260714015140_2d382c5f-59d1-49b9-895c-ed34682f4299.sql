
CREATE TABLE public.sesmt_training_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  category_id UUID NOT NULL REFERENCES public.sesmt_training_categories(id) ON DELETE CASCADE,
  training_date DATE NOT NULL,
  next_training_date DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sesmt_training_history TO authenticated;
GRANT ALL ON public.sesmt_training_history TO service_role;
ALTER TABLE public.sesmt_training_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sesmt_history_read_all_auth" ON public.sesmt_training_history
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "sesmt_history_admin_write" ON public.sesmt_training_history
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX sesmt_history_user_cat_idx ON public.sesmt_training_history(user_id, category_id);
