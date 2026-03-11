
-- Add unique constraints on code columns for upsert support
ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_code_unique UNIQUE (code);
ALTER TABLE public.defects ADD CONSTRAINT defects_code_unique UNIQUE (code);
ALTER TABLE public.defect_categories ADD CONSTRAINT defect_categories_code_unique UNIQUE (code);
ALTER TABLE public.responsibilities ADD CONSTRAINT responsibilities_code_unique UNIQUE (code);
ALTER TABLE public.part_numbers ADD CONSTRAINT part_numbers_part_number_unique UNIQUE (part_number);

-- Add delete policies for catalog tables (admin or engenharia)
CREATE POLICY "Admin/Engenharia can delete defects"
ON public.defects FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'engenharia'::app_role));

CREATE POLICY "Admin/Engenharia can delete defect_categories"
ON public.defect_categories FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'engenharia'::app_role));

CREATE POLICY "Admin/Engenharia can delete responsibilities"
ON public.responsibilities FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'engenharia'::app_role));

CREATE POLICY "Admin/Engenharia can delete suppliers"
ON public.suppliers FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'engenharia'::app_role));

CREATE POLICY "Admin/Engenharia can delete part_numbers"
ON public.part_numbers FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'engenharia'::app_role));
