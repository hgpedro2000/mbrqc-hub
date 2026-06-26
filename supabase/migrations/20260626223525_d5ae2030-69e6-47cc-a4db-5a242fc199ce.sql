UPDATE public.app_config
SET value = '1.3.0.7'
WHERE key = 'app_version';

INSERT INTO public.app_config (key, value)
SELECT 'app_version', '1.3.0.7'
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_config WHERE key = 'app_version'
);

INSERT INTO public.app_changelog (version, change_type, title, description)
VALUES (
  '1.3.0.7',
  'patch',
  'Histórico de versões destravado',
  'Sincroniza a versão do app com o backend, remove duplicidade na meta tag de versão e renova o cache do PWA para que alterações recentes sejam detectadas corretamente.'
)
ON CONFLICT DO NOTHING;