
-- 1) New timestamps
ALTER TABLE public.consumable_requests
  ADD COLUMN IF NOT EXISTS entregue_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmado_em TIMESTAMPTZ;

-- 2) Allow leaders/admins to insert orders on behalf of other members (pedido_coletivo)
DROP POLICY IF EXISTS "Users can insert own requests" ON public.consumable_requests;
CREATE POLICY "Users can insert requests"
  ON public.consumable_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR (
      criado_por = auth.uid()
      AND origem = 'pedido_coletivo'
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR EXISTS (
          SELECT 1 FROM public.profiles me
          WHERE me.id = auth.uid()
            AND (
              me.cargo ILIKE '%lider%' OR me.cargo ILIKE '%líder%'
              OR me.cargo ILIKE '%assistente%' OR me.cargo ILIKE '%analista%'
              OR me.cargo ILIKE '%supervisor%' OR me.cargo ILIKE '%gerente%'
            )
        )
      )
    )
  );

-- 3) Inspector can confirm receipt of their own delivery
DROP POLICY IF EXISTS "Users can confirm own delivery" ON public.consumable_requests;
CREATE POLICY "Users can confirm own delivery"
  ON public.consumable_requests
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'entregue_pendente_confirmacao')
  WITH CHECK (user_id = auth.uid() AND status = 'entregue');
