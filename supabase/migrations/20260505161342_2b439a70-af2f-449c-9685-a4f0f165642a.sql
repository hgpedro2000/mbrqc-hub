-- Changelog de versões do app (4 níveis: MAJOR.SECURITY.MINOR.PATCH)
CREATE TABLE public.app_changelog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,
  change_type TEXT NOT NULL CHECK (change_type IN ('major','security','minor','patch')),
  title TEXT NOT NULL,
  description TEXT,
  released_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_app_changelog_released ON public.app_changelog (released_at DESC);

ALTER TABLE public.app_changelog ENABLE ROW LEVEL SECURITY;

-- Todos autenticados podem ler o histórico
CREATE POLICY "Anyone authenticated can read changelog"
ON public.app_changelog FOR SELECT TO authenticated USING (true);

-- Somente admins podem inserir/alterar/deletar
CREATE POLICY "Admins can insert changelog"
ON public.app_changelog FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update changelog"
ON public.app_changelog FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete changelog"
ON public.app_changelog FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed inicial: marca a versão atual
INSERT INTO public.app_changelog (version, change_type, title, description)
VALUES ('1.0.0.0', 'major', 'Versão inicial', 'Início do controle de versão estruturado (MAJOR.SECURITY.MINOR.PATCH).');

-- Atualiza app_config para o novo formato 4-níveis
UPDATE public.app_config SET value = '1.0.0.0' WHERE key IN ('app_version','min_required_version');