DROP POLICY IF EXISTS "Owner or admin/lider can update apontamentos" ON public.apontamentos;

CREATE POLICY "Owner or admin can update apontamentos"
ON public.apontamentos
FOR UPDATE
TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));