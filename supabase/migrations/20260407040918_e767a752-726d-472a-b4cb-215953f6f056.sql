
-- Drop old check constraints
ALTER TABLE public.apontamentos DROP CONSTRAINT IF EXISTS apontamentos_status_check;
ALTER TABLE public.apontamentos DROP CONSTRAINT IF EXISTS apontamentos_tipo_check;
ALTER TABLE public.apontamentos DROP CONSTRAINT IF EXISTS apontamentos_severidade_check;

-- Add updated constraints
ALTER TABLE public.apontamentos ADD CONSTRAINT apontamentos_status_check 
  CHECK (status IN ('aberto', 'em_analise', 'acao_definida', 'concluido', 'cancelado', 'draft', 'submitted'));

ALTER TABLE public.apontamentos ADD CONSTRAINT apontamentos_tipo_check 
  CHECK (tipo IN ('defeito_processo', 'defeito_peca', 'parada_linha', 'incoming', 'peca', 'processo', 'oem'));
