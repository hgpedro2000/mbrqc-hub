
-- Add created_by column to all 3 checklist tables
ALTER TABLE public.injection_checklists ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.painting_checklists ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.assembly_checklists ADD COLUMN IF NOT EXISTS created_by uuid;

-- Update RLS: allow owner to update injection_checklists
DROP POLICY IF EXISTS "Admins can update injection_checklists" ON public.injection_checklists;
CREATE POLICY "Admin or owner can update injection_checklists" ON public.injection_checklists
FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Update RLS: allow owner to update painting_checklists
DROP POLICY IF EXISTS "Admins can update painting_checklists" ON public.painting_checklists;
CREATE POLICY "Admin or owner can update painting_checklists" ON public.painting_checklists
FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Update RLS: allow owner to update assembly_checklists
DROP POLICY IF EXISTS "Admins can update assembly_checklists" ON public.assembly_checklists;
CREATE POLICY "Admin or owner can update assembly_checklists" ON public.assembly_checklists
FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
