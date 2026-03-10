
CREATE TABLE public.defect_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  description TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.defect_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Engenharia can manage defect_categories"
  ON public.defect_categories FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'engenharia'::app_role));

CREATE POLICY "Authenticated can view defect_categories"
  ON public.defect_categories FOR SELECT
  TO authenticated
  USING (true);
