
-- Função para atualizar timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ===========================================
-- TABELA: Checklist de Injeção Plástica
-- ===========================================
CREATE TABLE public.injection_checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  data DATE NOT NULL,
  fornecedor TEXT NOT NULL,
  projeto TEXT NOT NULL,
  part_number TEXT NOT NULL,
  part_name TEXT NOT NULL,
  modulo TEXT NOT NULL,
  qtd_tryout INTEGER NOT NULL,
  materia_prima TEXT NOT NULL,
  injetora TEXT NOT NULL,
  tonelagem NUMERIC NOT NULL,
  cycle_time NUMERIC NOT NULL,
  cooling_time NUMERIC NOT NULL,
  weight NUMERIC NOT NULL,
  dimensional TEXT NOT NULL,
  needs_improvement BOOLEAN NOT NULL DEFAULT false,
  improvement_category INTEGER,
  comentarios TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.injection_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert injection checklists"
  ON public.injection_checklists FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view injection checklists"
  ON public.injection_checklists FOR SELECT
  USING (true);

CREATE TRIGGER update_injection_checklists_updated_at
  BEFORE UPDATE ON public.injection_checklists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================
-- TABELA: Checklist de Pintura
-- ===========================================
CREATE TABLE public.painting_checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  data DATE NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  checked_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  comentarios TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.painting_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert painting checklists"
  ON public.painting_checklists FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view painting checklists"
  ON public.painting_checklists FOR SELECT
  USING (true);

CREATE TRIGGER update_painting_checklists_updated_at
  BEFORE UPDATE ON public.painting_checklists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================
-- TABELA: Checklist de Montagem
-- ===========================================
CREATE TABLE public.assembly_checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  data DATE NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  checked_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  comentarios TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.assembly_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert assembly checklists"
  ON public.assembly_checklists FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view assembly checklists"
  ON public.assembly_checklists FOR SELECT
  USING (true);

CREATE TRIGGER update_assembly_checklists_updated_at
  BEFORE UPDATE ON public.assembly_checklists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================
-- TABELA: Fotos dos checklists
-- ===========================================
CREATE TABLE public.checklist_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checklist_id UUID NOT NULL,
  checklist_type TEXT NOT NULL CHECK (checklist_type IN ('injection', 'painting', 'assembly')),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.checklist_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert checklist photos"
  ON public.checklist_photos FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view checklist photos"
  ON public.checklist_photos FOR SELECT
  USING (true);

-- ===========================================
-- STORAGE: Bucket para fotos
-- ===========================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('checklist-photos', 'checklist-photos', true);

CREATE POLICY "Anyone can upload checklist photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'checklist-photos');

CREATE POLICY "Anyone can view checklist photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'checklist-photos');
