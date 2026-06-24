INSERT INTO public.app_changelog (version, change_type, title, description)
VALUES (
  '1.2.8.12',
  'patch',
  'Help Desk: reset de senha seguro',
  'Reset de senha do Help Desk agora evita a senha fraca admin123*, gera senha temporária segura no reset padrão, valida a política de senha na provisória e retorna mensagens reais do backend.'
)
ON CONFLICT DO NOTHING;