
-- Update INSERT policies to require authentication
DROP POLICY "Anyone can insert injection checklists" ON public.injection_checklists;
CREATE POLICY "Authenticated users can insert injection checklists"
  ON public.injection_checklists FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY "Anyone can insert painting checklists" ON public.painting_checklists;
CREATE POLICY "Authenticated users can insert painting checklists"
  ON public.painting_checklists FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY "Anyone can insert assembly checklists" ON public.assembly_checklists;
CREATE POLICY "Authenticated users can insert assembly checklists"
  ON public.assembly_checklists FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY "Anyone can insert checklist photos" ON public.checklist_photos;
CREATE POLICY "Authenticated users can insert checklist photos"
  ON public.checklist_photos FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY "Anyone can upload checklist photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload checklist photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'checklist-photos');
