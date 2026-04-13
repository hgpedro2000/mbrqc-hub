CREATE TABLE public.training_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  area TEXT NOT NULL,
  training_date DATE NOT NULL,
  next_training_date DATE NOT NULL,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.training_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Lider can manage training_history"
ON public.training_history
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lider'::app_role));

CREATE POLICY "Auth can view training_history"
ON public.training_history
FOR SELECT
TO authenticated
USING (true);

CREATE INDEX idx_training_history_user_area ON public.training_history (user_id, area);
