
-- Capsule files table
CREATE TABLE public.capsule_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint DEFAULT 0,
  uploaded_by uuid NOT NULL,
  uploaded_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.capsule_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view capsule files" ON public.capsule_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/Engenharia can insert capsule files" ON public.capsule_files FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'engenharia'));
CREATE POLICY "Admin/Engenharia can delete capsule files" ON public.capsule_files FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'engenharia'));

-- Storage bucket for capsule files
INSERT INTO storage.buckets (id, name, public) VALUES ('capsule-files', 'capsule-files', true);
CREATE POLICY "Anyone can read capsule files" ON storage.objects FOR SELECT USING (bucket_id = 'capsule-files');
CREATE POLICY "Auth can upload capsule files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'capsule-files');
CREATE POLICY "Auth can delete capsule files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'capsule-files');

-- Consumable items (inventory catalog)
CREATE TABLE public.consumable_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'un',
  stock_qty integer NOT NULL DEFAULT 0,
  min_qty integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.consumable_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view consumable items" ON public.consumable_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/Engenharia can manage consumable items" ON public.consumable_items FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'engenharia'));
CREATE POLICY "Admin/Engenharia can delete consumable items" ON public.consumable_items FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'engenharia'));

CREATE TRIGGER update_consumable_items_updated_at BEFORE UPDATE ON public.consumable_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Consumable requests
CREATE TABLE public.consumable_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text,
  user_id uuid NOT NULL,
  user_name text NOT NULL DEFAULT '',
  turno text,
  item_id uuid NOT NULL REFERENCES public.consumable_items(id) ON DELETE CASCADE,
  item_name text NOT NULL DEFAULT '',
  quantity integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'aguardando',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.consumable_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own requests" ON public.consumable_requests FOR SELECT TO authenticated USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'engenharia'));
CREATE POLICY "Users can insert own requests" ON public.consumable_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admin can update requests" ON public.consumable_requests FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'engenharia'));
CREATE POLICY "Admin can delete requests" ON public.consumable_requests FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'engenharia'));

CREATE TRIGGER update_consumable_requests_updated_at BEFORE UPDATE ON public.consumable_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sequential numbering for consumable requests
CREATE OR REPLACE FUNCTION public.generate_consumable_request_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(numero, '^REQ-', ''), '')::integer), 0) + 1
  INTO next_num
  FROM public.consumable_requests
  WHERE numero IS NOT NULL;
  
  NEW.numero := 'REQ-' || LPAD(next_num::text, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_consumable_request_number
  BEFORE INSERT ON public.consumable_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_consumable_request_number();
