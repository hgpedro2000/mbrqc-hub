GRANT SELECT ON public.app_changelog TO authenticated;
GRANT ALL ON public.app_changelog TO service_role;

ALTER TABLE public.app_changelog REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'app_changelog'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_changelog;
  END IF;
END $$;

UPDATE public.app_config
SET value = '1.3.0.16'
WHERE key = 'app_version';

INSERT INTO public.app_config (key, value)
SELECT 'app_version', '1.3.0.16'
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_config WHERE key = 'app_version'
);

INSERT INTO public.app_changelog (version, change_type, title, description)
VALUES (
  '1.3.0.16',
  'patch',
  'Pareto com layout alternável e histórico em tempo real',
  'Adiciona alternância 1 por linha/2 por linha nos gráficos da Análise de Risco, reposiciona rótulos do Pareto para não sobrepor valores e habilita atualização em tempo real do histórico de versões com polling apenas como fallback.'
)
ON CONFLICT (version) DO NOTHING;