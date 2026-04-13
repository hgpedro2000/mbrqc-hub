
CREATE TABLE public.stock_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.consumable_items(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'entrada',
  quantity INTEGER NOT NULL DEFAULT 0,
  previous_qty INTEGER NOT NULL DEFAULT 0,
  new_qty INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_by_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Engenharia can manage stock_history"
ON public.stock_history
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'engenharia'::app_role));

CREATE POLICY "Auth can view stock_history"
ON public.stock_history
FOR SELECT
TO authenticated
USING (true);

CREATE INDEX idx_stock_history_item ON public.stock_history (item_id, created_at DESC);
