CREATE POLICY "Anyone can read monitor_default_preferences"
ON public.app_config
FOR SELECT
TO anon, authenticated
USING (key = 'monitor_default_preferences');