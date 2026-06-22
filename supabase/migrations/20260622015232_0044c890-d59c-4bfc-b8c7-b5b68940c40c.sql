CREATE OR REPLACE FUNCTION public.notify_alerta_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  cfg_id uuid;
  should_send boolean := false;
BEGIN
  -- Skip drafts. Send on INSERT only when not draft, or on UPDATE when transitioning from rascunho to a non-draft status.
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.status, 'ativo') <> 'rascunho' THEN
      should_send := true;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF COALESCE(OLD.status, 'ativo') = 'rascunho' AND COALESCE(NEW.status, 'ativo') <> 'rascunho' THEN
      should_send := true;
    END IF;
  END IF;

  IF NOT should_send THEN
    RETURN NEW;
  END IF;

  SELECT id INTO cfg_id
  FROM public.email_automation_config
  WHERE modulo = 'alerta_qualidade'
    AND subtipo = 'imediato'
    AND enabled = true
  LIMIT 1;

  IF cfg_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://fjsayyuuukmedrjmvexj.supabase.co/functions/v1/send-alerta-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqc2F5eXV1dWttZWRyam12ZXhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5Mjk2MjAsImV4cCI6MjA4ODUwNTYyMH0.5PFjsXcTjNZfqHjCbYuJh2EoYB3UbrRinazwALRH55E'
    ),
    body := jsonb_build_object(
      'config_id', cfg_id,
      'alerta_id', NEW.id,
      'subtipo', 'imediato'
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_alerta_email_ins ON public.alertas;
DROP TRIGGER IF EXISTS trg_notify_alerta_email_upd ON public.alertas;

CREATE TRIGGER trg_notify_alerta_email_ins
AFTER INSERT ON public.alertas
FOR EACH ROW EXECUTE FUNCTION public.notify_alerta_email();

CREATE TRIGGER trg_notify_alerta_email_upd
AFTER UPDATE ON public.alertas
FOR EACH ROW EXECUTE FUNCTION public.notify_alerta_email();