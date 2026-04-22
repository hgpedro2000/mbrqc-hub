-- 1. Tabela de histórico de senhas
CREATE TABLE IF NOT EXISTS public.password_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_history_user_created
  ON public.password_history (user_id, created_at DESC);

ALTER TABLE public.password_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own password history"
  ON public.password_history
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own password history"
  ON public.password_history
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 2. Coluna de expiração de senha
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP WITH TIME ZONE;

-- 3. Forçar reset imediato para todos os usuários existentes
UPDATE public.profiles
SET must_change_password = true,
    password_changed_at = NULL;
