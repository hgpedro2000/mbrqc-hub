
-- Allow anonymous (monitor) read access on the 4 tables consumed by /monitor
GRANT SELECT ON public.apontamentos TO anon;
GRANT SELECT ON public.alertas_qualidade TO anon;
GRANT SELECT ON public.contencao TO anon;
GRANT SELECT ON public.consumable_items TO anon;

DROP POLICY IF EXISTS "Monitor anon read apontamentos" ON public.apontamentos;
CREATE POLICY "Monitor anon read apontamentos" ON public.apontamentos FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Monitor anon read alertas_qualidade" ON public.alertas_qualidade;
CREATE POLICY "Monitor anon read alertas_qualidade" ON public.alertas_qualidade FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Monitor anon read contencao" ON public.contencao;
CREATE POLICY "Monitor anon read contencao" ON public.contencao FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Monitor anon read consumable_items" ON public.consumable_items;
CREATE POLICY "Monitor anon read consumable_items" ON public.consumable_items FOR SELECT TO anon USING (true);
