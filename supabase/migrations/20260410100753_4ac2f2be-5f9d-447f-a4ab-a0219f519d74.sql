CREATE TABLE public.user_module_order (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  module_order jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_module_order ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own module order"
  ON public.user_module_order
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own module order"
  ON public.user_module_order
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own module order"
  ON public.user_module_order
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());