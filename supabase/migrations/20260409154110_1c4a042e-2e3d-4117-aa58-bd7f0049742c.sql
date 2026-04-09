CREATE TABLE public.app_config (
  key text PRIMARY KEY,
  value text NOT NULL
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read app_config"
ON public.app_config FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins can manage app_config"
ON public.app_config FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.app_config (key, value) VALUES ('app_version', '1.0.0');
INSERT INTO public.app_config (key, value) VALUES ('min_required_version', '1.0.0');