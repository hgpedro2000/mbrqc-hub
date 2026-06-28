
-- 1. Add columns to consumable_requests for collective orders
ALTER TABLE public.consumable_requests
  ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Create consumption_lists table
CREATE TABLE IF NOT EXISTS public.consumption_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_por_nome TEXT NOT NULL DEFAULT '',
  itens JSONB NOT NULL DEFAULT '[]'::jsonb,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consumption_lists TO authenticated;
GRANT ALL ON public.consumption_lists TO service_role;

ALTER TABLE public.consumption_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view consumption lists"
  ON public.consumption_lists FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can create consumption lists"
  ON public.consumption_lists FOR INSERT TO authenticated
  WITH CHECK (criado_por = auth.uid());

CREATE POLICY "Creator or admin can update consumption lists"
  ON public.consumption_lists FOR UPDATE TO authenticated
  USING (criado_por = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Creator or admin can delete consumption lists"
  ON public.consumption_lists FOR DELETE TO authenticated
  USING (criado_por = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_consumption_lists_updated_at
  BEFORE UPDATE ON public.consumption_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Policy: leaders/managers can view team requests by turno
-- (used by "Consumo do Time" and "Pedido de Time" views)
CREATE POLICY "Leaders and managers can view team requests"
  ON public.consumable_requests FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.cargo IS NOT NULL
        AND (
          me.cargo ILIKE '%lider%' OR me.cargo ILIKE '%líder%' OR
          me.cargo ILIKE '%assistente%' OR me.cargo ILIKE '%analista%' OR
          me.cargo ILIKE '%supervisor%' OR me.cargo ILIKE '%gerente%'
        )
    )
  );
