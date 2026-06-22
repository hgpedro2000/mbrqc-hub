ALTER TABLE public.alertas REPLICA IDENTITY FULL;
ALTER TABLE public.ciencias REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alertas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ciencias;