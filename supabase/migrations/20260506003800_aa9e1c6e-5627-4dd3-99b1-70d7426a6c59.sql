INSERT INTO public.app_changelog (version, change_type, title, description, released_at) VALUES
('1.0.2.2', 'minor', 'Câmera dentro do app (Android)', 'Botão "Câmera" no Apontamento agora abre câmera embutida via getUserMedia, evitando que o Android encerre o WebView e perca a foto.', now()),
('1.0.2.3', 'minor', 'Múltiplas TAGs por apontamento NG', 'Em "Pendentes de TAG", o card abre N campos conforme a quantidade NG (ex.: 3 NGs → 3 campos). Salva tudo de uma vez.', now()),
('1.0.2.4', 'patch', 'Validação ao salvar TAGs', 'Pop-up avisa quando faltam TAGs e pede confirmação antes de descartar campos preenchidos.', now()),
('1.0.2.5', 'patch', 'Pendentes de TAG responsivo', 'Diálogo ajustado para mobile (95vw) e ampliado para desktop, corrigindo o corte da lista.', now()),
('1.0.2.6', 'patch', 'Versão na tela de login', 'Badge da versão posicionada abaixo do link de Política de Privacidade.', now());