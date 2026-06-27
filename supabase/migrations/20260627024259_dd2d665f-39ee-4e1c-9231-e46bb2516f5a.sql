ALTER TABLE public.monitor_slides_media DROP CONSTRAINT IF EXISTS monitor_slides_media_tipo_check;
ALTER TABLE public.monitor_slides_media ADD CONSTRAINT monitor_slides_media_tipo_check CHECK (tipo IN ('comunicado','alteracao_4m','retrabalho'));
INSERT INTO public.app_changelog (version, change_type, title, description)
VALUES ('1.3.0.12','minor','Monitor: novo slide "Retrabalhos em Andamento"','Adiciona o tipo "retrabalho" em monitor_slides_media para upload de mídia (imagens/PDFs) com mesmas configurações de slot e vigência usadas em Comunicados.');