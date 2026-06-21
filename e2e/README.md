# E2E Tests — Playwright

Cobertura: indicador (badge vermelho) e cards de status do Help Desk reagindo
em tempo real quando um chamado é fechado, **sem recarregar a página**.

## Configuração

1. Instale os browsers do Playwright (uma vez):

   ```bash
   npx playwright install chromium
   ```

2. Defina as variáveis de ambiente:

   ```bash
   export E2E_BASE_URL="https://id-preview--<seu-id>.lovable.app"
   export E2E_ADMIN_EMAIL="admin@exemplo.com"
   export E2E_ADMIN_PASSWORD="********"
   ```

   > Use o usuário de teste sem MFA criado pela aba Engenharia → Usuários.

3. Pré-condição de dados: garanta **≥ 1 chamado** em `pendente` ou `em_andamento`
   antes de rodar (basta abrir um pelo botão "Reportar Erro").

## Rodar

```bash
npx playwright test                 # headless
npx playwright test --headed        # com janela
npx playwright show-report          # relatório HTML após falha
```

## O que o teste valida

1. Lê a contagem inicial do badge vermelho no botão Help Desk.
2. Abre Engenharia → Help Desk e captura os cards `Pendente`, `Em Andamento`, `Fechado`.
3. Resolve o primeiro chamado em aberto.
4. Sem `page.reload()`, aguarda (`expect.poll`) o canal Realtime do Supabase atualizar:
   - card `Fechado` aumenta em 1
   - soma `Pendente + Em Andamento` diminui em 1
   - badge vermelho do botão diminui em 1 (ou some)
