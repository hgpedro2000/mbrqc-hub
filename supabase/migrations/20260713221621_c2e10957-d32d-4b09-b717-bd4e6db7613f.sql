
CREATE TYPE public.audit_type_v2 AS ENUM ('processo', 'produto', 'fornecedor');
CREATE TYPE public.audit_status_v2 AS ENUM ('planejada','em_andamento','aguardando_fornecedor','respondida','concluida','atrasada');
CREATE TYPE public.audit_nc_status AS ENUM ('open','partial','done');
CREATE TYPE public.audit_alert_type AS ENUM ('auditoria_proxima','fornecedor_atrasado');

CREATE TABLE public.audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE,
  title TEXT NOT NULL,
  type public.audit_type_v2 NOT NULL DEFAULT 'processo',
  purpose TEXT[] NOT NULL DEFAULT '{}',
  supplier_name TEXT NOT NULL DEFAULT '',
  place TEXT,
  process TEXT[] NOT NULL DEFAULT '{}',
  auditor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  auditor_name TEXT,
  pic_name TEXT,
  audit_date_start DATE,
  audit_date_end DATE,
  schedule_notes TEXT,
  product_name TEXT,
  product_image_url TEXT,
  participants JSONB NOT NULL DEFAULT '[]'::jsonb,
  paint_inspection_total NUMERIC,
  paint_inspection_ok NUMERIC,
  paint_inspection_ng NUMERIC,
  mbr_aql_total NUMERIC,
  mbr_aql_ok NUMERIC,
  mbr_aql_ng NUMERIC,
  major_requests TEXT[] NOT NULL DEFAULT '{}',
  conclusion TEXT,
  status public.audit_status_v2 NOT NULL DEFAULT 'planejada',
  score NUMERIC,
  pptx_sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audits TO authenticated;
GRANT ALL ON public.audits TO service_role;
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audits_select_authenticated" ON public.audits FOR SELECT TO authenticated USING (true);
CREATE POLICY "audits_insert_own" ON public.audits FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by OR public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "audits_update_owner_or_admin" ON public.audits FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR auth.uid() = auditor_id OR public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (auth.uid() = created_by OR auth.uid() = auditor_id OR public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "audits_delete_owner_or_admin" ON public.audits FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(),'admin'::app_role));

CREATE OR REPLACE FUNCTION public.generate_audit_code()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE next_num INTEGER;
BEGIN
  IF NEW.code IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('audits_code'));
    SELECT COALESCE(MAX(NULLIF(regexp_replace(code,'^AUD-',''),'')::int),0)+1
      INTO next_num FROM public.audits WHERE code IS NOT NULL;
    NEW.code := 'AUD-' || LPAD(next_num::text, 4, '0');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_audits_code BEFORE INSERT ON public.audits
  FOR EACH ROW EXECUTE FUNCTION public.generate_audit_code();
CREATE TRIGGER trg_audits_updated_at BEFORE UPDATE ON public.audits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.audit_ncs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
  seq_number INTEGER NOT NULL DEFAULT 1,
  issue_category TEXT,
  problem_description TEXT,
  before_photo_url TEXT,
  counter_measure TEXT,
  due_date DATE,
  in_charge TEXT,
  status public.audit_nc_status NOT NULL DEFAULT 'open',
  has_file_attachment BOOLEAN NOT NULL DEFAULT false,
  attachment_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_ncs_audit_id ON public.audit_ncs(audit_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_ncs TO authenticated;
GRANT ALL ON public.audit_ncs TO service_role;
ALTER TABLE public.audit_ncs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_ncs_select_authenticated" ON public.audit_ncs FOR SELECT TO authenticated USING (true);
CREATE POLICY "audit_ncs_write_owner_or_admin" ON public.audit_ncs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.audits a WHERE a.id = audit_ncs.audit_id
    AND (a.created_by = auth.uid() OR a.auditor_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.audits a WHERE a.id = audit_ncs.audit_id
    AND (a.created_by = auth.uid() OR a.auditor_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role))));
CREATE TRIGGER trg_audit_ncs_updated_at BEFORE UPDATE ON public.audit_ncs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.audit_nc_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_nc_id UUID NOT NULL UNIQUE REFERENCES public.audit_ncs(id) ON DELETE CASCADE,
  target_date DATE,
  completion_date DATE,
  after_photo_url TEXT,
  corrective_measure_text TEXT,
  obs TEXT,
  responded BOOLEAN NOT NULL DEFAULT false,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_nc_responses TO authenticated;
GRANT ALL ON public.audit_nc_responses TO service_role;
ALTER TABLE public.audit_nc_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_nc_responses_select_authenticated" ON public.audit_nc_responses FOR SELECT TO authenticated USING (true);
CREATE POLICY "audit_nc_responses_write_owner_or_admin" ON public.audit_nc_responses FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.audit_ncs n JOIN public.audits a ON a.id = n.audit_id
    WHERE n.id = audit_nc_responses.audit_nc_id
      AND (a.created_by = auth.uid() OR a.auditor_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.audit_ncs n JOIN public.audits a ON a.id = n.audit_id
    WHERE n.id = audit_nc_responses.audit_nc_id
      AND (a.created_by = auth.uid() OR a.auditor_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role))));
CREATE TRIGGER trg_audit_nc_responses_updated_at BEFORE UPDATE ON public.audit_nc_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.audit_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
  type public.audit_alert_type NOT NULL,
  trigger_date DATE NOT NULL DEFAULT CURRENT_DATE,
  message TEXT,
  dismissed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_audit_alerts_unique ON public.audit_alerts(audit_id, type, trigger_date);
CREATE INDEX idx_audit_alerts_active ON public.audit_alerts(dismissed) WHERE dismissed = false;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_alerts TO authenticated;
GRANT ALL ON public.audit_alerts TO service_role;
ALTER TABLE public.audit_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_alerts_select_authenticated" ON public.audit_alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "audit_alerts_write_authenticated" ON public.audit_alerts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_audit_alerts_updated_at BEFORE UPDATE ON public.audit_alerts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
