
-- Add new columns to apontamentos table
ALTER TABLE public.apontamentos
  ADD COLUMN IF NOT EXISTS turno text,
  ADD COLUMN IF NOT EXISTS fase text,
  ADD COLUMN IF NOT EXISTS projeto text,
  ADD COLUMN IF NOT EXISTS fornecedor text,
  ADD COLUMN IF NOT EXISTS quantidade_inspecionada integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantidade_ng integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantidade_ok integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lote_inspecionado text,
  ADD COLUMN IF NOT EXISTS modo_falha text,
  ADD COLUMN IF NOT EXISTS parada_linha text DEFAULT 'nao',
  ADD COLUMN IF NOT EXISTS parada_linha_tempo text,
  ADD COLUMN IF NOT EXISTS local_deteccao text,
  ADD COLUMN IF NOT EXISTS vin_number text,
  ADD COLUMN IF NOT EXISTS responsabilidade_defeito text,
  ADD COLUMN IF NOT EXISTS segundo_defeitos jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS lancamento text,
  ADD COLUMN IF NOT EXISTS analise_inicial text,
  ADD COLUMN IF NOT EXISTS acao_imediata text,
  ADD COLUMN IF NOT EXISTS comentario_adicional text,
  ADD COLUMN IF NOT EXISTS quantidade_detectado integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- Update the sequential number generator to handle new prefixes
CREATE OR REPLACE FUNCTION public.generate_sequential_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  prefix text;
  next_num integer;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'apontamentos' THEN
      CASE NEW.tipo
        WHEN 'incoming' THEN prefix := 'INC';
        WHEN 'peca' THEN prefix := 'PCA';
        WHEN 'processo' THEN prefix := 'PRC';
        WHEN 'oem' THEN prefix := 'OEM';
        ELSE prefix := 'APT';
      END CASE;
    WHEN 'contencao' THEN prefix := 'CTN';
    WHEN 'auditorias' THEN prefix := 'AUD';
    WHEN 'injection_checklists' THEN prefix := 'INJ';
    WHEN 'painting_checklists' THEN prefix := 'PIN';
    WHEN 'assembly_checklists' THEN prefix := 'MTG';
    ELSE prefix := 'REG';
  END CASE;

  EXECUTE format(
    'SELECT COALESCE(MAX(NULLIF(regexp_replace(numero, ''^[A-Z]+-'', ''''), '''')::integer), 0) + 1 FROM public.%I WHERE numero IS NOT NULL',
    TG_TABLE_NAME
  ) INTO next_num;

  NEW.numero := prefix || '-' || LPAD(next_num::text, 4, '0');
  RETURN NEW;
END;
$function$;

-- Ensure trigger exists for apontamentos
DROP TRIGGER IF EXISTS set_apontamento_number ON public.apontamentos;
CREATE TRIGGER set_apontamento_number
  BEFORE INSERT ON public.apontamentos
  FOR EACH ROW
  WHEN (NEW.numero IS NULL)
  EXECUTE FUNCTION public.generate_sequential_number();
