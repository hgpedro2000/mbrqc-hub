CREATE TABLE public.email_automation_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Relatório NG Diário',
  enabled boolean NOT NULL DEFAULT false,
  schedule_time time NOT NULL DEFAULT '18:00',
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  recipients text[] NOT NULL DEFAULT '{}',
  cc_recipients text[] NOT NULL DEFAULT '{}',
  subject_template text NOT NULL DEFAULT 'Relatório de Peças NG — {{date}}',
  message_body text NOT NULL DEFAULT 'Segue o relatório diário de peças com defeito (NG).',
  include_dashboard_html boolean NOT NULL DEFAULT true,
  include_ng_pdf boolean NOT NULL DEFAULT true,
  weekdays int[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  last_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_automation_config TO authenticated;
GRANT ALL ON public.email_automation_config TO service_role;
ALTER TABLE public.email_automation_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage automation config" ON public.email_automation_config FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER email_automation_config_updated_at BEFORE UPDATE ON public.email_automation_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.email_automation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid REFERENCES public.email_automation_config(id) ON DELETE SET NULL,
  triggered_by uuid,
  trigger_type text NOT NULL DEFAULT 'manual',
  recipients text[] NOT NULL DEFAULT '{}',
  subject text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  ng_count integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.email_automation_log TO authenticated;
GRANT ALL ON public.email_automation_log TO service_role;
ALTER TABLE public.email_automation_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read automation log" ON public.email_automation_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins insert automation log" ON public.email_automation_log FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.email_automation_config (name, recipients) VALUES ('Relatório NG Diário', ARRAY['informacao@mbrqc.com.br']);