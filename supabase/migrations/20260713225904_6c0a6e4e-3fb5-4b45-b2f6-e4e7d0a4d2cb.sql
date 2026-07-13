UPDATE public.app_config
SET value = '1.3.6.1'
WHERE key = 'app_version';

INSERT INTO public.app_config (key, value)
SELECT 'app_version', '1.3.6.1'
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_config WHERE key = 'app_version'
);

INSERT INTO public.app_changelog (version, change_type, title, description)
VALUES (
  '1.3.6.1',
  'patch',
  'Auditorias: proporções do Supplier Visit Report',
  'Revisadas as proporções da capa Supplier Visit Report no PPTX e na visualização do app usando medidas fixas equivalentes ao template padrão Mobis, com áreas, tabelas e rodapé alinhados à referência.'
)
ON CONFLICT (version) DO NOTHING;