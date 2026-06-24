
ALTER TABLE public.empresas_terceiras ADD COLUMN IF NOT EXISTS prefix text;
ALTER TABLE public.empresas_terceiras ADD COLUMN IF NOT EXISTS pad integer NOT NULL DEFAULT 4;

UPDATE public.empresas_terceiras SET prefix = 'IL',  pad = 4 WHERE upper(name) LIKE 'IL%'    AND (prefix IS NULL OR prefix = '');
UPDATE public.empresas_terceiras SET prefix = 'TRI', pad = 4 WHERE upper(name) LIKE 'TRIGO%' AND (prefix IS NULL OR prefix = '');
UPDATE public.empresas_terceiras SET prefix = 'AB',  pad = 4 WHERE upper(name) LIKE 'ABCD%'  AND (prefix IS NULL OR prefix = '');
UPDATE public.empresas_terceiras
   SET prefix = upper(regexp_replace(name, '[^A-Za-z0-9]', '', 'g'))
   WHERE prefix IS NULL OR prefix = '';
UPDATE public.empresas_terceiras SET prefix = left(prefix, 4) WHERE length(prefix) > 4;
