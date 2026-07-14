
-- Categorias de treinamento SESMT (abas dinâmicas)
CREATE TABLE public.sesmt_training_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT 'bg-orange-700',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sesmt_training_categories TO authenticated;
GRANT ALL ON public.sesmt_training_categories TO service_role;
ALTER TABLE public.sesmt_training_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read sesmt categories"
  ON public.sesmt_training_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage sesmt categories"
  ON public.sesmt_training_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_sesmt_cat_updated
  BEFORE UPDATE ON public.sesmt_training_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Registros de treinamento por usuário / categoria
CREATE TABLE public.sesmt_training_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.sesmt_training_categories(id) ON DELETE CASCADE,
  habilitado BOOLEAN NOT NULL DEFAULT FALSE,
  last_training_date DATE,
  next_training_date DATE,
  notes TEXT,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, category_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sesmt_training_records TO authenticated;
GRANT ALL ON public.sesmt_training_records TO service_role;
ALTER TABLE public.sesmt_training_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read sesmt records"
  ON public.sesmt_training_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage sesmt records"
  ON public.sesmt_training_records FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_sesmt_rec_updated
  BEFORE UPDATE ON public.sesmt_training_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Categorias iniciais
INSERT INTO public.sesmt_training_categories (name, description, color, sort_order) VALUES
  ('NR-06 - EPI', 'Equipamentos de Proteção Individual', 'bg-orange-700', 1),
  ('NR-10 - Elétrica', 'Segurança em Instalações e Serviços em Eletricidade', 'bg-yellow-700', 2),
  ('NR-11 - Movimentação', 'Transporte, movimentação e armazenagem de materiais', 'bg-lime-700', 3),
  ('NR-12 - Máquinas', 'Segurança no Trabalho em Máquinas e Equipamentos', 'bg-emerald-700', 4),
  ('NR-33 - Confinado', 'Espaços Confinados', 'bg-cyan-700', 5),
  ('NR-35 - Altura', 'Trabalho em Altura', 'bg-blue-700', 6),
  ('Brigada de Incêndio', 'Prevenção e combate a incêndios', 'bg-red-700', 7),
  ('Primeiros Socorros', 'Atendimento pré-hospitalar básico', 'bg-rose-700', 8),
  ('Meio Ambiente', 'Gestão ambiental e resíduos', 'bg-green-700', 9),
  ('Integração de Segurança', 'Integração de novos colaboradores', 'bg-slate-700', 10);
