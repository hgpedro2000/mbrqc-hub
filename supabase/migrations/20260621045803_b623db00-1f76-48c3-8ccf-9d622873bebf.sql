CREATE TABLE public.empresas_terceiras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresas_terceiras TO authenticated;
GRANT ALL ON public.empresas_terceiras TO service_role;

ALTER TABLE public.empresas_terceiras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view empresas_terceiras"
  ON public.empresas_terceiras FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert empresas_terceiras"
  ON public.empresas_terceiras FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update empresas_terceiras"
  ON public.empresas_terceiras FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete empresas_terceiras"
  ON public.empresas_terceiras FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER empresas_terceiras_set_updated_at
  BEFORE UPDATE ON public.empresas_terceiras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.empresas_terceiras (name) VALUES
  ('IL AUTOMOTIVE'),
  ('TRIGO INSPEÇÕES')
ON CONFLICT (name) DO NOTHING;