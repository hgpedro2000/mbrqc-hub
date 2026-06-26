## 1. HelpDesk button — mover de Engenharia para Incoming

- **Remover** o `<ReportErrorButton moduleName="Engenharia" />` do header da página `Engenharia.tsx` (já existe a aba Help Desk lá dentro, redundante).
- **Manter** o botão "Chamados HelpDesk" do Hub (esse leva direto para a aba).
- **Adicionar** `<ReportErrorButton moduleName="Apontamento Incoming" />` no header de `ApontamentoForm.tsx`, exibido **apenas quando `tipo === "incoming"`** (rota `/apontamentos/novo/incoming`).

## 2. Monitor — slide "Avisos / Comunicados"

Hoje o slide mostra **1 aviso por vez**, em rotação de 8s, sem janela de validade. Vou expandir:

### 2.1 Banco (`monitor_slides_media`)
Migration adicionando três colunas (não-quebrantes):
- `vigencia_inicio  timestamptz null` — quando o aviso começa a aparecer
- `vigencia_fim     timestamptz null` — quando para de aparecer
- `slot             smallint default 1 check (slot between 1 and 4)` — em qual posição (1–4) ele aparece quando o slide está em modo multi-aviso

Itens sem vigência continuam sempre vigentes (compatibilidade).

### 2.2 Admin (`MonitorAdmin.tsx`)
Na seção "Comunicados", adicionar ao formulário de upload **e** ao card de edição:
- Seletor "Posição no slide" (1, 2, 3 ou 4) — define em qual quadrante o aviso aparece.
- "Início da vigência" e "Fim da vigência" (datetime-local, ambos opcionais).
- Mostrar badge "Agendado" / "Expirado" / "Ativo" no card baseado nas datas.

### 2.3 Slide do Monitor (`Monitor.tsx`, case `comunicados`/`alteracoes_4m`)
- Filtrar `items` por vigência (`now ∈ [inicio, fim]` quando preenchidos).
- Agrupar por `slot`. Layout dinâmico conforme quantidade de slots **com itens ativos no momento**:
  - 1 slot → tela cheia (como hoje)
  - 2 slots → grid 2 colunas
  - 3 slots → grid 3 colunas
  - 4 slots → grid 2×2
- Dentro de cada slot, se houver vários avisos no mesmo slot, rotaciona-os a cada 8s (mantém o comportamento atual, mas por slot).
- Contador "x / total" passa a ser por slot.

## Detalhes técnicos

- Migration emite `GRANT`s já presentes na tabela; só adiciono colunas.
- `MonitorAdmin` envia `vigencia_inicio`, `vigencia_fim` (ISO) e `slot` no `insert`/`update`.
- `Monitor.tsx` recalcula slots a cada tick (já há `now` rodando), sem refazer fetch.
- Sem mudança nas políticas RLS (colunas novas herdam as policies existentes).
- Nenhuma alteração nos slides de "Alterações 4M" (mesmo case mas a UI multi-slot é opt-in: o `slot` default = 1, então sem configuração ele continua igual).

## Changelog
Bump patch + entrada em `app_changelog` descrevendo as três mudanças.
