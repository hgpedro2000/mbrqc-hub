
-- Table for matriz attachments
CREATE TABLE public.matriz_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  area TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.matriz_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth can view matriz_attachments"
  ON public.matriz_attachments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage matriz_attachments"
  ON public.matriz_attachments FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Editors can insert matriz_attachments"
  ON public.matriz_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.matriz_editors WHERE matriz_editors.user_id = auth.uid())
  );

CREATE POLICY "Editors can delete matriz_attachments"
  ON public.matriz_attachments FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.matriz_editors WHERE matriz_editors.user_id = auth.uid())
  );

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('matriz-attachments', 'matriz-attachments', true);

CREATE POLICY "Auth can view matriz attachment files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'matriz-attachments');

CREATE POLICY "Auth can upload matriz attachment files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'matriz-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Auth can delete matriz attachment files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'matriz-attachments' AND auth.role() = 'authenticated');
