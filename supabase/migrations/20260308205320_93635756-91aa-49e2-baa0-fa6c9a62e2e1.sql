
-- Defects catalog
CREATE TABLE public.defects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  description text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.defects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view defects" ON public.defects
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin/Engenharia can manage defects" ON public.defects
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'engenharia'));

CREATE TRIGGER update_defects_updated_at
  BEFORE UPDATE ON public.defects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Responsibilities catalog
CREATE TABLE public.responsibilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  description text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.responsibilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view responsibilities" ON public.responsibilities
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin/Engenharia can manage responsibilities" ON public.responsibilities
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'engenharia'));

CREATE TRIGGER update_responsibilities_updated_at
  BEFORE UPDATE ON public.responsibilities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
