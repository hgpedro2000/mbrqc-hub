INSERT INTO public.app_changelog (version, change_type, title, description)
VALUES (
  '1.3.0.10',
  'patch',
  'Tradução completa do módulo Contenção (PT/EN)',
  'Tradução completa do módulo Contenção (PT/EN): ContencaoRegistroDialog e ContencaoClaimReport agora usam useTranslation com namespace contencao.*, datas e horas localizada para pt-BR/en-US conforme idioma ativo.'
)
ON CONFLICT DO NOTHING;

UPDATE public.app_config
SET value = '1.3.0.10'
WHERE key = 'app_version';

INSERT INTO public.app_config (key, value)
SELECT 'app_version', '1.3.0.10'
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_config WHERE key = 'app_version'
);
