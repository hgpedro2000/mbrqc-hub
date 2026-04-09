CREATE POLICY "All authenticated can view profiles for co-inspection"
ON public.profiles
FOR SELECT
TO authenticated
USING (status = 'active');