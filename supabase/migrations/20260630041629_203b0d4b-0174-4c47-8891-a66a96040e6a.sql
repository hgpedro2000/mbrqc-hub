
-- Switch views to security_invoker = true (querying user's perms apply)
ALTER VIEW public.monitor_apontamentos        SET (security_invoker = true);
ALTER VIEW public.monitor_alertas_qualidade   SET (security_invoker = true);
ALTER VIEW public.monitor_contencao           SET (security_invoker = true);
ALTER VIEW public.monitor_consumable_items    SET (security_invoker = true);

-- Re-add narrow anon SELECT policies on base tables, scoped to published rows.
CREATE POLICY "Monitor anon read (non-draft) apontamentos"
  ON public.apontamentos FOR SELECT TO anon
  USING (status <> 'draft');

CREATE POLICY "Monitor anon read (published) alertas_qualidade"
  ON public.alertas_qualidade FOR SELECT TO anon
  USING (COALESCE(status, 'ativo') <> 'rascunho');

CREATE POLICY "Monitor anon read contencao"
  ON public.contencao FOR SELECT TO anon
  USING (true);

CREATE POLICY "Monitor anon read consumable_items"
  ON public.consumable_items FOR SELECT TO anon
  USING (active = true);

-- Lock anon to column-level access containing only the non-PII fields
-- already exposed by the monitor_* views. Direct `select *` from anon
-- fails with permission denied; only the curated columns are readable.
REVOKE SELECT ON public.apontamentos        FROM anon;
REVOKE SELECT ON public.alertas_qualidade   FROM anon;
REVOKE SELECT ON public.contencao           FROM anon;
REVOKE SELECT ON public.consumable_items    FROM anon;

GRANT SELECT (
  id, tipo, titulo, data, setor, linha,
  part_number, part_name, descricao, quantidade, prazo,
  status, severidade, created_at, updated_at, numero,
  turno, fase, projeto, fornecedor,
  quantidade_inspecionada, quantidade_ng, quantidade_ok,
  lote_inspecionado, modo_falha, parada_linha, parada_linha_tempo,
  local_deteccao, responsabilidade_defeito, segundo_defeitos,
  quantidade_detectado
) ON public.apontamentos TO anon;

GRANT SELECT (
  id, numero_alerta, titulo, data_emissao, data_validade,
  setor, linha, part_number, part_name, fornecedor,
  descricao_problema, acao_imediata, acao_corretiva,
  severidade, status, created_at, updated_at
) ON public.alertas_qualidade TO anon;

GRANT SELECT (
  id, tipo, titulo, data, setor, linha, part_number, part_name, fornecedor,
  quantidade_contida, quantidade_aprovada, quantidade_rejeitada,
  motivo, acao_contencao, status, created_at, updated_at, numero, local,
  data_conclusao, total_horas, dias_andamento,
  mark_check, responsabilidade, estoque_indefinido
) ON public.contencao TO anon;

GRANT SELECT (
  id, name, unit, stock_qty, min_qty, active, created_at, updated_at,
  low_stock_alerted_at
) ON public.consumable_items TO anon;
