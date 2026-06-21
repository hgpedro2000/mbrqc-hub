-- Estender email_automation_config para múltiplos módulos
ALTER TABLE public.email_automation_config
  ADD COLUMN IF NOT EXISTS modulo  TEXT NOT NULL DEFAULT 'apontamentos',
  ADD COLUMN IF NOT EXISTS subtipo TEXT NOT NULL DEFAULT 'agendado',
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS email_automation_config_modulo_idx
  ON public.email_automation_config (modulo, subtipo);

-- Estender email_automation_log
ALTER TABLE public.email_automation_log
  ADD COLUMN IF NOT EXISTS modulo       TEXT NOT NULL DEFAULT 'apontamentos',
  ADD COLUMN IF NOT EXISTS tipo_disparo TEXT NOT NULL DEFAULT 'agendado',
  ADD COLUMN IF NOT EXISTS entity_id    UUID;

CREATE INDEX IF NOT EXISTS email_automation_log_modulo_idx
  ON public.email_automation_log (modulo, created_at DESC);

-- Idempotência por evento (1 envio por (config, entidade))
CREATE UNIQUE INDEX IF NOT EXISTS email_automation_log_one_per_entity
  ON public.email_automation_log (config_id, entity_id)
  WHERE entity_id IS NOT NULL
    AND tipo_disparo = 'evento'
    AND status IN ('queued','sent','pending');

-- Changelog
INSERT INTO public.app_changelog (version, change_type, title, description)
VALUES (
  '1.0.4.84', 'minor',
  'Automação de E-mails — suporte a múltiplos módulos',
  'Adicionados campos modulo/subtipo/metadata em email_automation_config e modulo/tipo_disparo/entity_id em email_automation_log para suportar Alerta de Qualidade (imediato + semanal), Contenção, Consumíveis e Matriz de Versatilidade. Idempotência por entidade para disparos por evento.'
);