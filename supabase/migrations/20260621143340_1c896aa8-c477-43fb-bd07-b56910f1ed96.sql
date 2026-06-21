
ALTER TABLE public.email_automation_log
  ADD COLUMN IF NOT EXISTS preview_html TEXT,
  ADD COLUMN IF NOT EXISTS preview_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS period_start DATE,
  ADD COLUMN IF NOT EXISTS period_end DATE,
  ADD COLUMN IF NOT EXISTS attempt INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS error_notified BOOLEAN NOT NULL DEFAULT false;

DROP INDEX IF EXISTS email_automation_log_one_per_day;

CREATE UNIQUE INDEX IF NOT EXISTS email_automation_log_one_success_per_day
  ON public.email_automation_log (config_id, send_date)
  WHERE status IN ('queued','sent','pending')
    AND trigger_type IN ('scheduled','manual');

ALTER TABLE public.email_automation_config
  ADD COLUMN IF NOT EXISTS error_notify_recipients TEXT[] DEFAULT ARRAY[]::TEXT[];

INSERT INTO public.app_changelog (version, change_type, title, description)
VALUES (
  '1.0.4.83', 'minor',
  'Automação de E-mails — rascunho, reenvio, alertas e período custom',
  'Modo rascunho (gera HTML+PDF sem enviar), seleção de período custom no teste, botão de reenvio respeitando idempotência por automação/data, registro de tentativas e alertas automáticos por e-mail/histórico quando o worker falha.'
);
