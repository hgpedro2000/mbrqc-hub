
-- 1) Drop public-anon SELECT policies on sensitive tables
DROP POLICY IF EXISTS "Monitor anon read apontamentos" ON public.apontamentos;
DROP POLICY IF EXISTS "Monitor anon read alertas_qualidade" ON public.alertas_qualidade;
DROP POLICY IF EXISTS "Monitor anon read contencao" ON public.contencao;
DROP POLICY IF EXISTS "Monitor anon read consumable_items" ON public.consumable_items;

-- 2) Curated views for the public Monitor kiosk display.
-- security_invoker = false (definer) → bypasses base-table RLS, runs as view owner.
-- Only non-PII operational columns are exposed.
CREATE OR REPLACE VIEW public.monitor_apontamentos
WITH (security_invoker = false) AS
SELECT
  id, tipo, titulo, data, setor, linha,
  part_number, part_name, descricao, quantidade, prazo,
  status, severidade, created_at, updated_at, numero,
  turno, fase, projeto, fornecedor,
  quantidade_inspecionada, quantidade_ng, quantidade_ok,
  lote_inspecionado, modo_falha, parada_linha, parada_linha_tempo,
  local_deteccao, responsabilidade_defeito, segundo_defeitos,
  quantidade_detectado
FROM public.apontamentos
WHERE status <> 'draft';

CREATE OR REPLACE VIEW public.monitor_alertas_qualidade
WITH (security_invoker = false) AS
SELECT
  id, numero_alerta, titulo, data_emissao, data_validade,
  setor, linha, part_number, part_name, fornecedor,
  descricao_problema, acao_imediata, acao_corretiva,
  severidade, status, created_at, updated_at
FROM public.alertas_qualidade
WHERE COALESCE(status, 'ativo') <> 'rascunho';

CREATE OR REPLACE VIEW public.monitor_contencao
WITH (security_invoker = false) AS
SELECT
  id, tipo, titulo, data, setor, linha, part_number, part_name, fornecedor,
  quantidade_contida, quantidade_aprovada, quantidade_rejeitada,
  motivo, acao_contencao, status, created_at, updated_at, numero, local,
  data_conclusao, total_horas, dias_andamento,
  mark_check, responsabilidade, estoque_indefinido
FROM public.contencao;

CREATE OR REPLACE VIEW public.monitor_consumable_items
WITH (security_invoker = false) AS
SELECT
  id, name, unit, stock_qty, min_qty, active, created_at, updated_at,
  low_stock_alerted_at
FROM public.consumable_items;

REVOKE ALL ON public.monitor_apontamentos        FROM PUBLIC;
REVOKE ALL ON public.monitor_alertas_qualidade   FROM PUBLIC;
REVOKE ALL ON public.monitor_contencao           FROM PUBLIC;
REVOKE ALL ON public.monitor_consumable_items    FROM PUBLIC;
GRANT SELECT ON public.monitor_apontamentos        TO anon, authenticated;
GRANT SELECT ON public.monitor_alertas_qualidade   TO anon, authenticated;
GRANT SELECT ON public.monitor_contencao           TO anon, authenticated;
GRANT SELECT ON public.monitor_consumable_items    TO anon, authenticated;

-- 3) Set fixed search_path on functions that were missing it.
ALTER FUNCTION public.delete_email(text, bigint)        SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb)        SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.normalize_part_number(text)       SET search_path = public;
ALTER FUNCTION public.tg_normalize_part_number()        SET search_path = public;

-- 4) Revoke EXECUTE from anon/public on SECURITY DEFINER functions that
--    should never be callable without authentication.
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint)                FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb)                FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb)    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer)  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.next_employee_number(text, integer)       FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_creator_empresa_map()                 FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.recompute_contencao_totais()              FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.notify_alerta_email()                     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.notify_consumivel_low_stock()             FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.notify_consumivel_request_email()         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.notify_contencao_email()                  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_apontamento_changes()                 FROM PUBLIC, anon;

-- Re-grant EXECUTE to roles that legitimately need them.
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint)                 TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb)                 TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb)     TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer)   TO service_role;
GRANT EXECUTE ON FUNCTION public.next_employee_number(text, integer)        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_creator_empresa_map()                  TO authenticated, service_role;
