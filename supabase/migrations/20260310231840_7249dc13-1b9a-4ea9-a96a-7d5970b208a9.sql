
ALTER TABLE public.injection_checklists ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'submitted';
ALTER TABLE public.painting_checklists ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'submitted';
ALTER TABLE public.assembly_checklists ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'submitted';
