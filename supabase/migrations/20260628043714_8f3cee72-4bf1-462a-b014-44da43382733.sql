
ALTER TABLE public.consumable_requests ADD COLUMN IF NOT EXISTS pedido_id uuid;
CREATE INDEX IF NOT EXISTS idx_consumable_requests_pedido_id ON public.consumable_requests(pedido_id);

CREATE OR REPLACE FUNCTION public.generate_consumable_request_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  next_num integer;
  existing text;
BEGIN
  -- If row belongs to an existing pedido, reuse its numero
  IF NEW.pedido_id IS NOT NULL THEN
    SELECT numero INTO existing
    FROM public.consumable_requests
    WHERE pedido_id = NEW.pedido_id AND numero IS NOT NULL
    LIMIT 1;
    IF existing IS NOT NULL THEN
      NEW.numero := existing;
      RETURN NEW;
    END IF;
  END IF;

  -- Otherwise generate a new sequential REQ-####
  PERFORM pg_advisory_xact_lock(hashtext('consumable_request_number'));
  SELECT COALESCE(MAX(NULLIF(regexp_replace(numero, '^REQ-', ''), '')::integer), 0) + 1
  INTO next_num
  FROM public.consumable_requests
  WHERE numero IS NOT NULL;
  NEW.numero := 'REQ-' || LPAD(next_num::text, 4, '0');
  RETURN NEW;
END;
$function$;
