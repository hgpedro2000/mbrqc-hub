
-- Error reports table for help desk
CREATE TABLE public.error_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_name text NOT NULL DEFAULT '',
  module text NOT NULL DEFAULT '',
  description text NOT NULL,
  photos jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pendente',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.error_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert error reports" ON public.error_reports FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can view own error reports" ON public.error_reports FOR SELECT TO authenticated USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update error reports" ON public.error_reports FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete error reports" ON public.error_reports FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_error_reports_updated_at BEFORE UPDATE ON public.error_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add empresa columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS empresa text DEFAULT 'mobis_brasil';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS empresa_terceira text;

-- Add origem column to part_numbers
ALTER TABLE public.part_numbers ADD COLUMN IF NOT EXISTS origem text DEFAULT 'LP';
