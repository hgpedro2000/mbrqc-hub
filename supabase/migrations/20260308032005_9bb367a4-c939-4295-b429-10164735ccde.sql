
-- 1. Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. RLS policies for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 5. Dropdown options table (engineering mode - configurable dropdowns)
CREATE TABLE public.dropdown_options (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category text NOT NULL,
    label text NOT NULL,
    value text NOT NULL,
    sort_order integer DEFAULT 0,
    active boolean DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dropdown_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active dropdown options" ON public.dropdown_options
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage dropdown options" ON public.dropdown_options
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 6. Auditorias table
CREATE TABLE public.auditorias (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo text NOT NULL CHECK (tipo IN ('processo', 'produto', 'fornecedor')),
    titulo text NOT NULL,
    auditor text NOT NULL,
    data date NOT NULL,
    setor text,
    linha text,
    fornecedor text,
    status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'em_andamento', 'concluida', 'cancelada')),
    pontuacao_total numeric DEFAULT 0,
    pontuacao_obtida numeric DEFAULT 0,
    observacoes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.auditorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view auditorias" ON public.auditorias
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert auditorias" ON public.auditorias
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update auditorias" ON public.auditorias
  FOR UPDATE TO authenticated USING (true);

-- 7. Audit items (configurable checklist items for audits)
CREATE TABLE public.audit_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_type text NOT NULL CHECK (audit_type IN ('processo', 'produto', 'fornecedor')),
    category text NOT NULL,
    description text NOT NULL,
    sort_order integer DEFAULT 0,
    active boolean DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view audit items" ON public.audit_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage audit items" ON public.audit_items
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 8. Audit responses (answers for each audit)
CREATE TABLE public.audit_responses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    auditoria_id uuid REFERENCES public.auditorias(id) ON DELETE CASCADE NOT NULL,
    audit_item_id uuid REFERENCES public.audit_items(id) ON DELETE CASCADE NOT NULL,
    score integer DEFAULT 0,
    conformidade text CHECK (conformidade IN ('conforme', 'nao_conforme', 'na', 'parcial')),
    observacao text,
    created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view audit responses" ON public.audit_responses
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert audit responses" ON public.audit_responses
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update audit responses" ON public.audit_responses
  FOR UPDATE TO authenticated USING (true);

-- 9. Trigger for updated_at on auditorias
CREATE TRIGGER update_auditorias_updated_at
  BEFORE UPDATE ON public.auditorias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10. Seed some default audit items
INSERT INTO public.audit_items (audit_type, category, description, sort_order) VALUES
  ('processo', '5S', 'Área de trabalho organizada e limpa', 1),
  ('processo', '5S', 'Ferramentas e materiais nos locais definidos', 2),
  ('processo', '5S', 'Identificação visual adequada', 3),
  ('processo', 'Processo', 'Parâmetros de processo dentro da especificação', 4),
  ('processo', 'Processo', 'Instrução de trabalho disponível e atualizada', 5),
  ('processo', 'Processo', 'Operador treinado e qualificado', 6),
  ('processo', 'Qualidade', 'Plano de controle sendo seguido', 7),
  ('processo', 'Qualidade', 'Registros de qualidade preenchidos corretamente', 8),
  ('processo', 'Segurança', 'EPIs sendo utilizados corretamente', 9),
  ('processo', 'Segurança', 'Condições seguras de trabalho', 10),
  ('produto', 'Dimensional', 'Dimensões dentro da tolerância', 1),
  ('produto', 'Dimensional', 'Geometria conforme especificação', 2),
  ('produto', 'Visual', 'Acabamento superficial conforme padrão', 3),
  ('produto', 'Visual', 'Ausência de defeitos visuais', 4),
  ('produto', 'Funcional', 'Encaixe e montagem adequados', 5),
  ('produto', 'Funcional', 'Funcionamento conforme requisito', 6),
  ('fornecedor', 'Documentação', 'Certificados de qualidade disponíveis', 1),
  ('fornecedor', 'Documentação', 'Rastreabilidade de lote garantida', 2),
  ('fornecedor', 'Entrega', 'Prazo de entrega cumprido', 3),
  ('fornecedor', 'Entrega', 'Embalagem conforme especificação', 4),
  ('fornecedor', 'Qualidade', 'Índice de rejeição dentro da meta', 5),
  ('fornecedor', 'Qualidade', 'Ações corretivas implementadas', 6);

-- 11. Seed default dropdown options
INSERT INTO public.dropdown_options (category, label, value, sort_order) VALUES
  ('setor', 'Injeção', 'injecao', 1),
  ('setor', 'Pintura', 'pintura', 2),
  ('setor', 'Montagem', 'montagem', 3),
  ('setor', 'Expedição', 'expedicao', 4),
  ('linha', 'Linha 1', 'linha_1', 1),
  ('linha', 'Linha 2', 'linha_2', 2),
  ('linha', 'Linha 3', 'linha_3', 3),
  ('audit_category', 'Processo', 'processo', 1),
  ('audit_category', 'Produto', 'produto', 2),
  ('audit_category', 'Fornecedor', 'fornecedor', 3);
