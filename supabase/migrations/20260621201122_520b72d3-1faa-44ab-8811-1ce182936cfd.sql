INSERT INTO public.app_changelog (version, change_type, title, description, created_at)
VALUES (
  '1.0.5.0',
  'minor',
  'MFA: botão inteligente para abrir o app autenticador',
  'Nas telas de cadastro e verificação do MFA, agora existe um botão único que abre direto o app autenticador (Google Authenticator, Microsoft Authenticator, Authy, 1Password, Bitwarden ou outro). Na primeira vez, o usuário escolhe qual app usa — a escolha fica memorizada no dispositivo e nos próximos acessos abre com um único toque. Um link "trocar app" permite mudar a qualquer momento.',
  now()
);