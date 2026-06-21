# Testes Manuais — Login & MFA (layout, UX e desempenho)

> Cobertura: layout responsivo, descoberta do "Sou Terceiro", botão Ajuda e desempenho percebido do login.
> Versão alvo: a versão atual no rodapé do Login (`vX.Y.Z`).

## Dispositivos de referência
- **Mobile pequeno**: iPhone SE / 320×568
- **Mobile médio**: 390×844 (iPhone 14)
- **Mobile grande / phablet**: 414×896
- **Tablet**: 768×1024
- **Desktop**: 1280×800 ou 1920×1080

Para cada cenário abaixo, repetir em **mobile (390×844)** e **desktop (1366×768)**, salvo indicação contrária.

---

## 1. Tela de Login — layout

| # | Passo | Resultado esperado |
|---|---|---|
| 1.1 | Abrir `/login` | Logo Hyundai Mobis visível, sem clipping; rodapé com versão dentro do viewport. |
| 1.2 | Observar campo "N° de empregado" | Label à esquerda, botão "Ajuda" discreto à direita (mesma linha). |
| 1.3 | Tocar no campo "N° de empregado" no celular | Abre **teclado numérico** (sem letras). |
| 1.4 | Digitar `12a3b4` | Campo aceita apenas `1234`. |
| 1.5 | Observar botão "Sou Terceiro — meu código tem letras" | **Minimalista**: borda padrão, fundo translúcido, sem destaque colorido berrante, sem texto "Visitante". |
| 1.6 | Em 320px de largura | Sem overflow horizontal; botão "Entrar" ocupa 100% da largura, sem cortar texto. |

## 2. Botão "Ajuda" (Terceiros)

| # | Passo | Resultado esperado |
|---|---|---|
| 2.1 | Carregar `/login` pela primeira vez (limpar storage) | Painel "Primeira vez? Veja onde clicar" **NÃO aparece automaticamente**. |
| 2.2 | Tocar em "Ajuda" | O painel aparece com 2 itens: Mobis (números) e Terceiro (letras). |
| 2.3 | Tocar no "X" do painel | Painel fecha. |
| 2.4 | Recarregar a página | Painel continua escondido até nova interação. |

## 3. Alternância "Sou Terceiro" → alfanumérico

| # | Passo | Resultado esperado |
|---|---|---|
| 3.1 | Tocar em "Sou Terceiro" | Aparece botão "Voltar para teclado numérico (Mobis)"; campo passa a aceitar letras. |
| 3.2 | Digitar `abc 123` no campo | Conteúdo exibido: `ABC123` (uppercase, sem espaços). |
| 3.3 | No celular, focar o campo após alternar | Abre **teclado alfanumérico**. |
| 3.4 | Tocar em "Voltar para teclado numérico" | Volta ao modo numérico; valor é re-sanitizado. |

## 4. Tela de MFA (`/mfa-verify`)

| # | Passo | Resultado esperado |
|---|---|---|
| 4.1 | Abrir `/mfa-verify` autenticado | Título "Verificação em 2 etapas", ícone escudo, glow ambiente. |
| 4.2 | Observar dica contextual | Mostra 1. abrir Authenticator e 2. digitar 6 dígitos. |
| 4.3 | Observar OTP | **6 slots em 3 + 3** com separador "–"; slot ativo destacado em accent. |
| 4.4 | Em 320px de largura | Slots usam `h-14 w-11`; nada quebra na horizontal. |
| 4.5 | Em ≥640px (sm) | Slots crescem para `h-16 w-12`. |
| 4.6 | Botão "Verificar e entrar" | **Desabilitado** até 6 dígitos. |
| 4.7 | Digitar 6 dígitos válidos | Verificação dispara **automaticamente** sem precisar clicar no botão. |
| 4.8 | Digitar código errado | Toast "Código inválido"; campos OTP limpos; sem travar a UI. |
| 4.9 | Botão "Sair e usar outra conta" | Realiza logout e volta para `/login`. |
| 4.10 | No celular, focar OTP | Abre **teclado numérico**. |

## 5. Desempenho do Login

> Objetivo: identificar latência percebida e regressões.

| # | Passo | Resultado esperado |
|---|---|---|
| 5.1 | Cronometrar do clique em "Entrar" até a Home aparecer (boa rede) | ≤ ~1,5 s. |
| 5.2 | Verificar: o pedido de **permissão de câmera** não bloqueia a navegação | A Home aparece *antes* do pop-up de câmera; o pop-up surge em paralelo. |
| 5.3 | DevTools → Network throttling "Fast 3G" | Login conclui em ≤ ~3,5 s. |
| 5.4 | DevTools → Network: requisição `auth-login-by-number` | Tempo total da função idealmente < 600 ms; `last_login_at` não bloqueia o retorno. |
| 5.5 | Repetir login 3× seguidas | Sem aumento de latência (sem leak de listener / sem promessa pendurada). |
| 5.6 | Logout + login com câmera **negada** anteriormente | Mesma velocidade — a negação não trava nada. |

### Melhorias de desempenho aplicadas nesta versão
1. `getUserMedia` (priming da câmera) passou a ser **fire-and-forget** após o sucesso do login — antes era `await`, o que prendia o redirecionamento até o usuário responder ao pop-up de permissão.
2. `update last_login_at` na Edge Function `auth-login-by-number` agora roda via `EdgeRuntime.waitUntil`, devolvendo a sessão imediatamente.

## 6. Testes E2E manuais (contas reais)

| Conta | Esperado |
|---|---|
| `hgpedro@gmail.com` | Login OK, MFA solicitado se ativo, Home carrega. |
| `hgpedro@icloud.com` | Idem; comparar tempo de login com a conta acima. |

## 7. Regressões a observar
- Console limpo (sem warnings de React / acessibilidade).
- Sem **layout shift** após carregar a fonte / logo.
- `LanguageToggle` no canto superior direito não sobrepõe o card em telas pequenas.
- Em rotação portrait→landscape o card permanece centralizado.

---

## Cobertura automatizada

`bunx vitest run src/test/loginLayout.test.tsx src/test/mfaLayout.test.tsx`

- **loginLayout.test.tsx** — 7 testes: teclado numérico por padrão, sanitização de entrada, estilo minimalista do botão "Sou Terceiro", alternância para modo alfanumérico, botão Ajuda escondido por padrão e revelação do onboarding.
- **mfaLayout.test.tsx** — 4 testes: presença da dica contextual, 6 slots OTP 3+3 com separador, botão desabilitado até 6 dígitos, classes responsivas (`h-14` mobile / `sm:h-16`).
