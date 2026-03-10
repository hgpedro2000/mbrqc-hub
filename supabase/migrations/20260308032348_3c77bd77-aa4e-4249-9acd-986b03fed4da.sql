
-- 1. Contenção table
CREATE TABLE public.contencao (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo text NOT NULL CHECK (tipo IN ('interno_mbr', 'externo_hmb')),
    titulo text NOT NULL,
    responsavel text NOT NULL,
    data date NOT NULL,
    setor text,
    linha text,
    part_number text,
    part_name text,
    fornecedor text,
    quantidade_contida integer DEFAULT 0,
    quantidade_aprovada integer DEFAULT 0,
    quantidade_rejeitada integer DEFAULT 0,
    motivo text,
    acao_contencao text,
    status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'em_andamento', 'concluida', 'cancelada')),
    observacoes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contencao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth can view contencao" ON public.contencao FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert contencao" ON public.contencao FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update contencao" ON public.contencao FOR UPDATE TO authenticated USING (true);

CREATE TRIGGER update_contencao_updated_at
  BEFORE UPDATE ON public.contencao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Apontamentos table
CREATE TABLE public.apontamentos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo text NOT NULL CHECK (tipo IN ('defeito_processo', 'defeito_peca', 'parada_linha')),
    titulo text NOT NULL,
    responsavel text NOT NULL,
    data date NOT NULL,
    setor text,
    linha text,
    part_number text,
    part_name text,
    descricao text NOT NULL,
    quantidade integer DEFAULT 1,
    causa_raiz text,
    acao_corretiva text,
    responsavel_acao text,
    prazo date,
    status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_analise', 'acao_definida', 'concluido', 'cancelado')),
    severidade text DEFAULT 'media' CHECK (severidade IN ('baixa', 'media', 'alta', 'critica')),
    observacoes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.apontamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth can view apontamentos" ON public.apontamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert apontamentos" ON public.apontamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update apontamentos" ON public.apontamentos FOR UPDATE TO authenticated USING (true);

CREATE TRIGGER update_apontamentos_updated_at
  BEFORE UPDATE ON public.apontamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Alertas de Qualidade table
CREATE TABLE public.alertas_qualidade (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_alerta text NOT NULL,
    titulo text NOT NULL,
    emitente text NOT NULL,
    data_emissao date NOT NULL,
    data_validade date,
    setor text,
    linha text,
    part_number text,
    part_name text,
    fornecedor text,
    descricao_problema text NOT NULL,
    acao_imediata text,
    acao_corretiva text,
    responsavel text,
    severidade text DEFAULT 'media' CHECK (severidade IN ('baixa', 'media', 'alta', 'critica')),
    status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'em_verificacao', 'encerrado', 'cancelado')),
    observacoes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.alertas_qualidade ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth can view alertas" ON public.alertas_qualidade FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert alertas" ON public.alertas_qualidade FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update alertas" ON public.alertas_qualidade FOR UPDATE TO authenticated USING (true);

CREATE TRIGGER update_alertas_updated_at
  BEFORE UPDATE ON public.alertas_qualidade
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Seed dropdown options for new modules
INSERT INTO public.dropdown_options (category, label, value, sort_order) VALUES
  ('tipo_contencao', 'Estoque Interno MBR', 'interno_mbr', 1),
  ('tipo_contencao', 'Externo HMB', 'externo_hmb', 2),
  ('tipo_apontamento', 'Defeito de Processo', 'defeito_processo', 1),
  ('tipo_apontamento', 'Defeito de Peça', 'defeito_peca', 2),
  ('tipo_apontamento', 'Parada de Linha', 'parada_linha', 3),
  ('severidade', 'Baixa', 'baixa', 1),
  ('severidade', 'Média', 'media', 2),
  ('severidade', 'Alta', 'alta', 3),
  ('severidade', 'Crítica', 'critica', 4);
