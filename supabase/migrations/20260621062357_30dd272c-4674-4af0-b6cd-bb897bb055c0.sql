ALTER TABLE public.email_automation_log
  ADD COLUMN IF NOT EXISTS send_date date,
  ADD COLUMN IF NOT EXISTS pdf_url text;

UPDATE public.email_automation_log
SET send_date = (created_at AT TIME ZONE 'America/Sao_Paulo')::date
WHERE send_date IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS email_automation_log_one_per_day
ON public.email_automation_log (config_id, send_date)
WHERE trigger_type IN ('scheduled','manual') AND config_id IS NOT NULL AND send_date IS NOT NULL;