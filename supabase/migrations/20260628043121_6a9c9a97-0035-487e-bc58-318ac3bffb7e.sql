
CREATE POLICY "Users can update own aguardando requests"
ON public.consumable_requests
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND status = 'aguardando')
WITH CHECK (user_id = auth.uid() AND status = 'aguardando');

CREATE POLICY "Users can delete own aguardando requests"
ON public.consumable_requests
FOR DELETE
TO authenticated
USING (user_id = auth.uid() AND status = 'aguardando');
