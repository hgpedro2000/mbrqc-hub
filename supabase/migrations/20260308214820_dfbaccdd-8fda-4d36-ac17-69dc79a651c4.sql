
-- Admin can delete alertas_qualidade
CREATE POLICY "Admins can delete alertas_qualidade"
ON public.alertas_qualidade FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admin can delete apontamentos
CREATE POLICY "Admins can delete apontamentos"
ON public.apontamentos FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admin can update and delete assembly_checklists
CREATE POLICY "Admins can update assembly_checklists"
ON public.assembly_checklists FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete assembly_checklists"
ON public.assembly_checklists FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admin can delete audit_responses
CREATE POLICY "Admins can delete audit_responses"
ON public.audit_responses FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admin can delete auditorias
CREATE POLICY "Admins can delete auditorias"
ON public.auditorias FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admin can update and delete checklist_photos
CREATE POLICY "Admins can update checklist_photos"
ON public.checklist_photos FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete checklist_photos"
ON public.checklist_photos FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admin can delete contencao
CREATE POLICY "Admins can delete contencao"
ON public.contencao FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admin can update and delete injection_checklists
CREATE POLICY "Admins can update injection_checklists"
ON public.injection_checklists FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete injection_checklists"
ON public.injection_checklists FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admin can update and delete painting_checklists
CREATE POLICY "Admins can update painting_checklists"
ON public.painting_checklists FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete painting_checklists"
ON public.painting_checklists FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
