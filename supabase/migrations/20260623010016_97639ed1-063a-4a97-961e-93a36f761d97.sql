
-- 1) Slide media table
CREATE TABLE IF NOT EXISTS public.monitor_slides_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('comunicado','alteracao_4m')),
  titulo text,
  descricao text,
  file_path text NOT NULL,
  file_name text,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.monitor_slides_media TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitor_slides_media TO authenticated;
GRANT ALL ON public.monitor_slides_media TO service_role;

ALTER TABLE public.monitor_slides_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view monitor media"
  ON public.monitor_slides_media FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins insert monitor media"
  ON public.monitor_slides_media FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Admins update monitor media"
  ON public.monitor_slides_media FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Admins delete monitor media"
  ON public.monitor_slides_media FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_monitor_slides_media_updated_at
  BEFORE UPDATE ON public.monitor_slides_media
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Storage policies for monitor-comunicados bucket
CREATE POLICY "Public read monitor-comunicados"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'monitor-comunicados');

CREATE POLICY "Admin insert monitor-comunicados"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'monitor-comunicados' AND public.has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Admin update monitor-comunicados"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'monitor-comunicados' AND public.has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Admin delete monitor-comunicados"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'monitor-comunicados' AND public.has_role(auth.uid(),'admin'::app_role));

-- 3) Anon read on checklist_photos for Monitor "Últimos Defeitos"
GRANT SELECT ON public.checklist_photos TO anon;

CREATE POLICY "Monitor anon read checklist_photos"
  ON public.checklist_photos FOR SELECT
  TO anon
  USING (true);
