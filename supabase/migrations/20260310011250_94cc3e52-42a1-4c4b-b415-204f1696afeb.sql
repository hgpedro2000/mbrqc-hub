
CREATE TABLE public.user_module_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, module)
);

ALTER TABLE public.user_module_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage module permissions"
  ON public.user_module_permissions
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own module permissions"
  ON public.user_module_permissions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
