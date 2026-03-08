
-- Suppliers table
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view suppliers" ON public.suppliers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin/Engenharia can manage suppliers" ON public.suppliers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'engenharia'));

CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Part Numbers table
CREATE TABLE public.part_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  part_number text NOT NULL,
  part_name text NOT NULL,
  project text NOT NULL DEFAULT '',
  line_module text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(supplier_id, part_number)
);

ALTER TABLE public.part_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view part_numbers" ON public.part_numbers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin/Engenharia can manage part_numbers" ON public.part_numbers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'engenharia'));

CREATE INDEX idx_part_numbers_supplier ON public.part_numbers(supplier_id);

CREATE TRIGGER update_part_numbers_updated_at
  BEFORE UPDATE ON public.part_numbers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
