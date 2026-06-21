ALTER TABLE public.consumable_items
  ADD COLUMN IF NOT EXISTS responsible_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS consumable_items_responsible_user_id_idx
  ON public.consumable_items(responsible_user_id);