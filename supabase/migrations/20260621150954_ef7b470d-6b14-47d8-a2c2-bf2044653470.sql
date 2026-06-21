-- Seed configs for Contenção (3 gatilhos)
INSERT INTO public.email_automation_config (
  name, modulo, subtipo, enabled, schedule_time, timezone, weekdays,
  recipients, cc_recipients, error_notify_recipients,
  subject_template, message_body, include_dashboard_html, include_ng_pdf, metadata
) VALUES
  (
    'Contenção — Iniciada', 'contencao', 'iniciada', false,
    '08:00', 'America/Sao_Paulo', '{}', '{}', '{}', '{}',
    'Contenção #{{numero}} iniciada — {{titulo}}',
    'Uma nova Contenção foi iniciada.

Número: {{numero}}
Título: {{titulo}}
Tipo: {{tipo}}
Part Number: {{part_number}}
Fornecedor: {{fornecedor}}
Responsável: {{responsavel}}
Data: {{data}}

Acesse o sistema para acompanhar.',
    false, false, '{}'::jsonb
  ),
  (
    'Contenção — Em Andamento', 'contencao', 'em_andamento', false,
    '08:00', 'America/Sao_Paulo', '{}', '{}', '{}', '{}',
    'Contenção #{{numero}} em andamento — {{titulo}}',
    'A Contenção #{{numero}} mudou para o status "Em Andamento".

Título: {{titulo}}
Part Number: {{part_number}}
Fornecedor: {{fornecedor}}
Responsável: {{responsavel}}
Ação de contenção: {{acao_contencao}}',
    false, false, '{}'::jsonb
  ),
  (
    'Contenção — Concluída', 'contencao', 'concluida', false,
    '08:00', 'America/Sao_Paulo', '{}', '{}', '{}', '{}',
    'Contenção #{{numero}} concluída — {{titulo}}',
    'A Contenção #{{numero}} foi concluída e encerra o ciclo de notificações.

Título: {{titulo}}
Part Number: {{part_number}}
Fornecedor: {{fornecedor}}
Quantidade contida: {{quantidade_contida}}
Quantidade aprovada: {{quantidade_aprovada}}
Quantidade rejeitada: {{quantidade_rejeitada}}
Responsável: {{responsavel}}',
    false, false, '{}'::jsonb
  )
ON CONFLICT DO NOTHING;

-- Trigger function: notify Contenção status events
CREATE OR REPLACE FUNCTION public.notify_contencao_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg_id uuid;
  evt text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    evt := 'iniciada';
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status = 'em_andamento' THEN evt := 'em_andamento';
      ELSIF NEW.status = 'concluida' THEN evt := 'concluida';
      ELSE RETURN NEW;
      END IF;
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  SELECT id INTO cfg_id
  FROM public.email_automation_config
  WHERE modulo = 'contencao' AND subtipo = evt AND enabled = true
  LIMIT 1;

  IF cfg_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://fjsayyuuukmedrjmvexj.supabase.co/functions/v1/send-contencao-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqc2F5eXV1dWttZWRyam12ZXhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5Mjk2MjAsImV4cCI6MjA4ODUwNTYyMH0.5PFjsXcTjNZfqHjCbYuJh2EoYB3UbrRinazwALRH55E'
    ),
    body := jsonb_build_object(
      'config_id', cfg_id,
      'contencao_id', NEW.id,
      'subtipo', evt
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_contencao_insert_email ON public.contencao;
CREATE TRIGGER on_contencao_insert_email
AFTER INSERT ON public.contencao
FOR EACH ROW EXECUTE FUNCTION public.notify_contencao_email();

DROP TRIGGER IF EXISTS on_contencao_update_email ON public.contencao;
CREATE TRIGGER on_contencao_update_email
AFTER UPDATE OF status ON public.contencao
FOR EACH ROW EXECUTE FUNCTION public.notify_contencao_email();
