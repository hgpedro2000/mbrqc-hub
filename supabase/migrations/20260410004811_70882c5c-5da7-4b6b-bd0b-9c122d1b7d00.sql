-- Create alertas table
CREATE TABLE public.alertas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sequencial integer GENERATED ALWAYS AS IDENTITY UNIQUE,
  modelo text,
  modo_falha text,
  linha_peca text,
  local_detectado text,
  data_ocorrencia date,
  data_validade date,
  turno text DEFAULT 'Todos',
  descricao text,
  responsabilidade text,
  vin text,
  foto_ng_url text,
  foto_ok_url text,
  observacoes text,
  sequencia_bp text,
  vin_bp text,
  emitido_por text,
  criado_por_id uuid REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'ativo',
  total_destinatarios integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth can view alertas" ON public.alertas
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth can insert alertas" ON public.alertas
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admin/Lider can update alertas" ON public.alertas
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lider'::app_role));

CREATE POLICY "Admin/Lider can delete alertas" ON public.alertas
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lider'::app_role));

-- Create ciencias table
CREATE TABLE public.ciencias (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alerta_id uuid NOT NULL REFERENCES public.alertas(id) ON DELETE CASCADE,
  inspetor_id uuid NOT NULL REFERENCES public.profiles(id),
  metodo text NOT NULL DEFAULT 'app_proprio',
  registrado_por_id uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(alerta_id, inspetor_id)
);

ALTER TABLE public.ciencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth can view ciencias" ON public.ciencias
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth can insert ciencias" ON public.ciencias
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admin/Lider can delete ciencias" ON public.ciencias
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lider'::app_role));

-- Enable realtime for ciencias
ALTER PUBLICATION supabase_realtime ADD TABLE public.ciencias;

-- Storage bucket for alert photos
INSERT INTO storage.buckets (id, name, public) VALUES ('alertas-fotos', 'alertas-fotos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view alertas-fotos" ON storage.objects
FOR SELECT USING (bucket_id = 'alertas-fotos');

CREATE POLICY "Auth can upload alertas-fotos" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'alertas-fotos');

CREATE POLICY "Auth can delete alertas-fotos" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'alertas-fotos');