-- =========================
-- Consumable items: low-stock alert state
-- =========================
ALTER TABLE public.consumable_items
  ADD COLUMN IF NOT EXISTS low_stock_alerted_at TIMESTAMPTZ;

-- =========================
-- Auth email overrides (Acesso)
-- =========================
CREATE TABLE IF NOT EXISTS public.auth_email_overrides (
  template_key TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  intro_html TEXT NOT NULL DEFAULT '',
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.auth_email_overrides TO authenticated;
GRANT ALL ON public.auth_email_overrides TO service_role;

ALTER TABLE public.auth_email_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage auth email overrides" ON public.auth_email_overrides;
CREATE POLICY "Admins manage auth email overrides"
  ON public.auth_email_overrides FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated read auth email overrides" ON public.auth_email_overrides;
CREATE POLICY "Authenticated read auth email overrides"
  ON public.auth_email_overrides FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER auth_email_overrides_updated_at
  BEFORE UPDATE ON public.auth_email_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default rows (visible in UI even if not yet customized)
INSERT INTO public.auth_email_overrides (template_key, subject, intro_html) VALUES
  ('signup',          'Confirme seu e-mail',           ''),
  ('invite',          'Você foi convidado',            ''),
  ('magiclink',       'Seu link de login',             ''),
  ('recovery',        'Redefina sua senha',            ''),
  ('email_change',    'Confirme seu novo e-mail',      ''),
  ('reauthentication','Seu código de verificação',     '')
ON CONFLICT (template_key) DO NOTHING;

-- =========================
-- Consumíveis (3 configs)
-- =========================
INSERT INTO public.email_automation_config (
  name, modulo, subtipo, enabled, schedule_time, timezone, weekdays,
  recipients, cc_recipients, error_notify_recipients,
  subject_template, message_body, include_dashboard_html, include_ng_pdf, metadata
) VALUES
  (
    'Consumíveis — Nova Solicitação', 'consumiveis', 'nova_solicitacao', false,
    '08:00', 'America/Sao_Paulo', '{}', '{}', '{}', '{}',
    'Nova solicitação #{{numero}} — {{item_name}}',
    'Uma nova solicitação de consumível foi registrada.

Número: {{numero}}
Item: {{item_name}}
Quantidade: {{quantity}}
Solicitante: {{user_name}}
Turno: {{turno}}

Acesse o sistema para aprovar.',
    false, false, '{}'::jsonb
  ),
  (
    'Consumíveis — Contagem Semanal', 'consumiveis', 'agendado', false,
    '08:00', 'America/Sao_Paulo', '{1}', '{}', '{}', '{}',
    'Contagem Semanal de Consumíveis — {{date}}',
    'Resumo do estoque atual de consumíveis na semana de {{period}}.

Total de itens: {{total_items}}
Itens abaixo do mínimo: {{total_low}}',
    false, false, '{"variant":"contagem_semanal"}'::jsonb
  ),
  (
    'Consumíveis — Estoque Mínimo', 'consumiveis', 'estoque_minimo', false,
    '08:00', 'America/Sao_Paulo', '{}', '{}', '{}', '{}',
    'Estoque baixo — {{item_name}}',
    'O item {{item_name}} cruzou o estoque mínimo.

Estoque atual: {{stock_qty}} {{unit}}
Estoque mínimo: {{min_qty}} {{unit}}

Reposição recomendada.',
    false, false, '{}'::jsonb
  )
ON CONFLICT DO NOTHING;

-- =========================
-- Matriz de Versatilidade (1 config semanal)
-- =========================
INSERT INTO public.email_automation_config (
  name, modulo, subtipo, enabled, schedule_time, timezone, weekdays,
  recipients, cc_recipients, error_notify_recipients,
  subject_template, message_body, include_dashboard_html, include_ng_pdf, metadata
) VALUES
  (
    'Matriz de Versatilidade — Resumo Semanal', 'matriz', 'agendado', false,
    '08:00', 'America/Sao_Paulo', '{1}', '{}', '{}', '{}',
    'Matriz de Versatilidade — Resumo Semanal {{date}}',
    'Treinamentos vencidos: {{total_vencidos}}
Treinamentos a vencer (próx. {{dias_antecedencia}} dias): {{total_vencer}}',
    false, false, '{"dias_antecedencia":30}'::jsonb
  )
ON CONFLICT DO NOTHING;

-- =========================
-- Trigger: nova solicitação
-- =========================
CREATE OR REPLACE FUNCTION public.notify_consumivel_request_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg_id uuid;
BEGIN
  SELECT id INTO cfg_id
  FROM public.email_automation_config
  WHERE modulo = 'consumiveis' AND subtipo = 'nova_solicitacao' AND enabled = true
  LIMIT 1;

  IF cfg_id IS NULL THEN RETURN NEW; END IF;

  PERFORM net.http_post(
    url := 'https://fjsayyuuukmedrjmvexj.supabase.co/functions/v1/send-consumiveis-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqc2F5eXV1dWttZWRyam12ZXhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5Mjk2MjAsImV4cCI6MjA4ODUwNTYyMH0.5PFjsXcTjNZfqHjCbYuJh2EoYB3UbrRinazwALRH55E'
    ),
    body := jsonb_build_object('config_id', cfg_id, 'request_id', NEW.id, 'subtipo', 'nova_solicitacao')
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_consumable_request_insert_email ON public.consumable_requests;
CREATE TRIGGER on_consumable_request_insert_email
AFTER INSERT ON public.consumable_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_consumivel_request_email();

-- =========================
-- Trigger: estoque mínimo (idempotente)
-- =========================
CREATE OR REPLACE FUNCTION public.notify_consumivel_low_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg_id uuid;
BEGIN
  -- Reset alerted flag if stock rises back above min
  IF NEW.stock_qty > NEW.min_qty AND NEW.low_stock_alerted_at IS NOT NULL THEN
    NEW.low_stock_alerted_at := NULL;
    RETURN NEW;
  END IF;

  -- Only fire when crossing into low state
  IF NEW.stock_qty > NEW.min_qty THEN RETURN NEW; END IF;
  IF NEW.low_stock_alerted_at IS NOT NULL THEN RETURN NEW; END IF;
  IF OLD.stock_qty <= OLD.min_qty THEN
    -- Already low before; only mark if not yet alerted
    NEW.low_stock_alerted_at := now();
  ELSE
    NEW.low_stock_alerted_at := now();
  END IF;

  SELECT id INTO cfg_id
  FROM public.email_automation_config
  WHERE modulo = 'consumiveis' AND subtipo = 'estoque_minimo' AND enabled = true
  LIMIT 1;

  IF cfg_id IS NULL THEN RETURN NEW; END IF;

  PERFORM net.http_post(
    url := 'https://fjsayyuuukmedrjmvexj.supabase.co/functions/v1/send-consumiveis-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqc2F5eXV1dWttZWRyam12ZXhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5Mjk2MjAsImV4cCI6MjA4ODUwNTYyMH0.5PFjsXcTjNZfqHjCbYuJh2EoYB3UbrRinazwALRH55E'
    ),
    body := jsonb_build_object('config_id', cfg_id, 'item_id', NEW.id, 'subtipo', 'estoque_minimo')
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_consumable_low_stock_email ON public.consumable_items;
CREATE TRIGGER on_consumable_low_stock_email
BEFORE UPDATE OF stock_qty, min_qty ON public.consumable_items
FOR EACH ROW EXECUTE FUNCTION public.notify_consumivel_low_stock();
