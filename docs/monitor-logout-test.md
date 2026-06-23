# Teste manual — /monitor independente do logout

Objetivo: validar que a tela `/monitor` continua atualizando em tempo real por pelo menos **5 minutos** após o `signOut` do app principal, sem exigir login.

## Pré-requisitos
- Estar logado no app principal em uma aba.
- Outra aba/janela aberta em `/monitor?debug` (painel DBG visível no canto inferior direito).

## Passos
1. Na janela `/monitor?debug`, confirmar:
   - **BC: ok** (ou `fallback(ls)` se o navegador bloquear BroadcastChannel).
   - **Realtime: connected**.
   - Cada tabela com timestamp recente em verde (`< 60s`).
2. Na aba principal, clicar em **Sair** (signOut).
3. Imediatamente no monitor deve aparecer:
   - Toast inferior: *"Sessão principal encerrada — monitor mantido"* (3s).
   - Evento `MAIN_LOGOUT` (ou `MAIN_LOGOUT(ls)`) no painel DBG.
4. Inserir um novo apontamento/alerta/contenção a partir de outra sessão.
   - O painel DBG deve registrar nova chamada (timestamp da tabela correspondente atualiza).
   - O slide correspondente reflete o novo dado.
5. Repetir o passo 4 a cada minuto por **5 minutos**. O `Realtime` deve permanecer `connected` e os timestamps `< 60s`.

## Fallback localStorage
Para forçar o fallback, desabilitar `BroadcastChannel` no console **antes** de abrir `/monitor`:
```js
Object.defineProperty(window, 'BroadcastChannel', { value: undefined });
```
Recarregar `/monitor?debug`. O cabeçalho deve mostrar `BC: fallback(ls)`. Repetir passos 2–4; o evento aparecerá como `MAIN_LOGOUT(ls)`.

## Critério de aceite
- Nenhum redirecionamento para `/login` no monitor após o signOut.
- Dados continuam chegando via Realtime por ≥ 5 min.
- Painel DBG mostra `MAIN_LOGOUT` registrado em até 500ms após o clique em Sair.
