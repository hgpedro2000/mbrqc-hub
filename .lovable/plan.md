# Configuração DNS na KingHost para e-mails Lovable

Objetivo: fazer o subdomínio `notify.mbrqc.com.br` verificar na Lovable, corrigindo os 2 problemas atuais (CNAME incorreto no `notify` e TXT de verificação faltando).

---

## Passo 1 — Testar se a KingHost aceita NS em subdomínio

A KingHost historicamente **não permite** criar registros do tipo NS em subdomínios pelo painel padrão. Antes de qualquer coisa, confirme:

1. Entre no painel KingHost → **Painel de Controle** → domínio `mbrqc.com.br` → **Zona de DNS**.
2. Clique em **Adicionar registro**.
3. Abra a lista "Tipo" e verifique se aparece a opção **NS**.
   - Se **NS aparece na lista** → siga o Passo 2 (caminho A).
   - Se **NS NÃO aparece** (só tem A, AAAA, CNAME, MX, TXT, SRV) → siga o Passo 2 (caminho B), pois a KingHost está bloqueando.
4. Teste extra: tente salvar um NS de teste (`teste.mbrqc.com.br` → `ns5.lovable.cloud`). Se der erro tipo "tipo não suportado" ou "operação não permitida", confirma o bloqueio.

Se tiver dúvida, abra chamado com o suporte KingHost perguntando literalmente: "Vocês permitem a criação de registros NS em subdomínio pela Zona de DNS?"

---

## Passo 2A — KingHost aceita NS (caminho feliz)

Na Zona de DNS do `mbrqc.com.br`:

1. **Remover** o registro atual errado:
   - `CNAME  notify  →  ns5.lovable.cloud.`
2. **Adicionar** os 2 registros NS:
   - Tipo `NS`, Nome/Host `notify`, Destino `ns5.lovable.cloud.`
   - Tipo `NS`, Nome/Host `notify`, Destino `ns6.lovable.cloud.`
3. **Adicionar** o TXT de verificação (falta hoje):
   - Tipo `TXT`, Nome/Host `_lovable-email`, Destino `lovable_email_verify=a8f1eea78cb0fa2a670b7046f3e5b2012d7e426c29b36d8f906cec48405b5052`
4. Salvar. Aguardar propagação (10 min a algumas horas, até 24h no pior caso).
5. Ir para o Passo 4 (verificação).

Não alterar nem remover: registros MX (@ → mx-vip-01/02.kinghost.net), TXT `_lovable` (do domínio principal), CNAME `www` (Vercel), A `@` (site), nem os demais CNAMEs (webmail, imap, smtp, etc.). Eles são de outros serviços.

---

## Passo 2B — KingHost NÃO aceita NS (mais provável)

Duas opções, escolha uma:

### Opção 1 (recomendada) — Mover DNS para Cloudflare (grátis) mantendo o domínio na KingHost

O registro do domínio continua na KingHost; só a hospedagem de DNS muda para o Cloudflare, que permite NS em subdomínio.

1. Criar conta grátis em cloudflare.com.
2. Adicionar o site `mbrqc.com.br` (plano Free).
3. Cloudflare vai importar automaticamente os registros existentes. **Confira se importou todos** os da KingHost (A `@`, `firebird`, `pgsql`, todos os CNAMEs, MX, TXT `_lovable`, CNAME `www` Vercel, etc.). Adicione manualmente qualquer que faltar.
4. Cloudflare vai mostrar 2 nameservers (ex.: `xxx.ns.cloudflare.com` e `yyy.ns.cloudflare.com`).
5. No painel KingHost → **Registro de domínio** → `mbrqc.com.br` → **Alterar DNS**, troque os nameservers da KingHost pelos 2 do Cloudflare. Salvar.
6. Aguardar propagação (algumas horas, pode chegar a 24h).
7. Quando o Cloudflare marcar o domínio como "Active", entrar na Zona DNS dele e adicionar:
   - Tipo `NS`, Nome `notify`, Destino `ns5.lovable.cloud`, Proxy status **DNS only** (nuvem cinza — obrigatório para NS).
   - Tipo `NS`, Nome `notify`, Destino `ns6.lovable.cloud`, Proxy **DNS only**.
   - Tipo `TXT`, Nome `_lovable-email`, Destino `lovable_email_verify=a8f1eea78cb0fa2a670b7046f3e5b2012d7e426c29b36d8f906cec48405b5052`.
8. Remover no Cloudflare o CNAME antigo `notify → ns5.lovable.cloud` (se foi importado).

### Opção 2 — Transferir o domínio para dentro da Lovable

Workspace Settings → Workspace Domains → transferir `mbrqc.com.br`. A partir daí a Lovable gerencia o DNS e a delegação de `notify` acontece sozinha. Cuidado: você perde a gestão de DNS na KingHost, então antes de transferir replique todos os registros atuais no gerenciador da Lovable (MX KingHost, CNAMEs de webmail/imap/smtp, A `@` do site, CNAME `www` Vercel, TXT `_lovable`).

---

## Passo 3 — Testar propagação DNS (antes de re-verificar)

Rodar no navegador ou terminal:

1. https://dnschecker.org → digite `notify.mbrqc.com.br` → tipo **NS**. Deve aparecer `ns5.lovable.cloud` e `ns6.lovable.cloud` em pelo menos 60% dos servidores globais.
2. https://dnschecker.org → digite `_lovable-email.mbrqc.com.br` → tipo **TXT**. Deve retornar o valor `lovable_email_verify=a8f1...`.
3. Terminal (opcional): `dig NS notify.mbrqc.com.br +short` e `dig TXT _lovable-email.mbrqc.com.br +short`.

Só avance para o Passo 4 depois que os dois retornarem os valores certos.

---

## Passo 4 — Reiniciar a verificação na Lovable

Como o status atual é **Failed** (passaram os 14 dias da janela original), verificar de novo pelo botão pode não ser suficiente:

1. Lovable → **Cloud → Emails → Manage Domains**.
2. Clicar em **Verify Domain** no `notify.mbrqc.com.br`. Se voltar a rodar, aguardar.
3. Se continuar como Failed depois de alguns minutos com DNS correto: **remover o domínio** e **adicionar de novo** pela mesma tela. Isso reinicia a janela de 14 dias e força nova verificação com os DNS que já estão no ar.
4. Acompanhar o status até virar **Active**.

---

## Resumo dos registros finais esperados (independente do caminho A ou B)

| Tipo | Host | Valor |
|------|------|-------|
| NS | `notify.mbrqc.com.br` | `ns5.lovable.cloud` |
| NS | `notify.mbrqc.com.br` | `ns6.lovable.cloud` |
| TXT | `_lovable-email.mbrqc.com.br` | `lovable_email_verify=a8f1eea78cb0fa2a670b7046f3e5b2012d7e426c29b36d8f906cec48405b5052` |

E o CNAME atual `notify → ns5.lovable.cloud.` **deve ser removido**.

---

## Detalhes técnicos

- Este plano não altera nenhum código do projeto — é 100% configuração externa de DNS/painéis.
- A Lovable delega o subdomínio via NS e passa a gerenciar SPF/DKIM/DMARC dentro dele; por isso NS (delegação) e não CNAME (apelido).
- Ponto (`.`) no final do destino NS/CNAME é opcional na maioria dos painéis, mas se a KingHost/Cloudflare pedirem FQDN, use `ns5.lovable.cloud.` com ponto final.
- Nada em código muda depois que o domínio ficar **Active**; os edge functions de e-mail já apontam para `notify.mbrqc.com.br` via `SENDER_DOMAIN`.
