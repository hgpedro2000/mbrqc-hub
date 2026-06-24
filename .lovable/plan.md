## Visão geral
Reformular o módulo Contenção em 4 frentes: **status em 4 etapas**, **campo Local**, **registros por turno** e **resumo mensal em tempo real**. Tudo que existe hoje (lista, formulário, dashboard, e-mails, RLS, exports) é preservado — apenas estendido.

A tabela atual chama-se `public.contencao` (não `containments`). Vou seguir esse nome para não quebrar nada; a nova tabela será `public.contencao_registros` (não `containment_records`) pela mesma razão. Bucket de fotos: `containment-photos` (novo, público), seguindo o padrão dos outros buckets do projeto.

## 1. Banco de dados (migração única)

**Alterar `public.contencao`:**
- `local text`
- `data_conclusao timestamptz`
- `total_horas numeric` (calculado por trigger ao inserir/editar/excluir registro)
- `dias_andamento integer` (calculado on-the-fly em view ou no client; coluna gerada `GENERATED ALWAYS AS` para evitar trigger)
- Alterar `status_check` para aceitar `'emitida' | 'iniciada' | 'em_andamento' | 'concluida' | 'cancelada'` (manter `aberta` como alias migrando dados antigos → `emitida`).

**Criar `public.contencao_registros`:**
```
id, contencao_id, turno (1T|2T|3T), data, hora_inicio, hora_fim,
horas_trabalhadas numeric GENERATED, local, inspetores jsonb,
qtd_inspetores int, qtd_inspecionada int, qtd_ok int, qtd_ng int,
mark_check bool, fotos jsonb, observacoes text, finaliza_contencao bool,
created_by uuid, created_at, updated_at
```
GRANTs para `authenticated` + `service_role`; RLS espelhando `contencao` (todos autenticados leem, qualquer autenticado insere, admin/líder/engenharia editam, admin deleta).

**Triggers:**
- `trg_contencao_recompute_status_totais` → após insert/update/delete em `contencao_registros`, recalcula `total_horas`, ajusta `status` automaticamente (regra: 0 registros → `emitida`; 1 registro de 1 turno → `iniciada`; registros de ≥2 turnos OU ≥2 registros do mesmo turno → `em_andamento`; `finaliza_contencao=true` → `concluida` + `data_conclusao`).
- Bucket `containment-photos` (público, via tool) com policies de upload por autenticado.

## 2. Tipos e dados gerados
- Regenerar `src/integrations/supabase/types.ts` (automático após migração).
- Adicionar helpers em `src/lib/contencao.ts`: `STATUS_META` (label/cor/animação), `computeDiasAndamento(c)`, `formatHoras(n)`.

## 3. UI — formulário (`ContencaoForm.tsx`)
- Adicionar campo **Local** na seção "Informações Gerais".
- Sem outras mudanças no fluxo de criação.

## 4. UI — detalhe da contenção (nova tela ou painel em `Contencao.tsx`)
- Stepper visual de 4 etapas no topo (componente novo `ContencaoStatusStepper`).
- Seção **"Registros de Contenção"** com botão **+ Novo Registro de Turno**.
- Lista de registros em cards, agrupada por data desc, com chips de inspetores, contagens, ícone de câmera, botão editar (desabilitado se `concluida`).
- Totais acumulados no topo da seção (Inspecionada/OK/NG).
- Exibe **total de horas** e **dias em andamento**.

**Novo modal `ContencaoRegistroDialog`:**
- Campos conforme spec (turno, data, horários, local pré-preenchido, co-inspetores via popover de busca em `profiles`, quantidades com NG auto-calc, mark check + upload múltiplo para `containment-photos`, observações).
- Botões: `Salvar Registro`, `Salvar e Finalizar Contenção` (com `AlertDialog` de confirmação), `Cancelar`.

## 5. UI — lista mestra (`Contencao.tsx`)
- Badges coloridas conforme status (cinza/azul/laranja-pulsando/verde) — animação via classe `animate-pulse`.
- Linhas extras em cada card: "X dias em andamento", "Yh Zmin registradas", "Último: 2T — há 3 horas".
- Barra horizontal OK/NG (proporção visual).
- Card fixo no topo **"Resumo do Mês — [mês atual]"** com totais (horas, abertas, concluídas, média), atualizado via Supabase Realtime na tabela `contencao_registros` + `contencao`.

## 6. Realtime
- `ALTER PUBLICATION supabase_realtime ADD TABLE public.contencao_registros, public.contencao` (a contenção pode já estar na publicação — usar `DO $$ ... EXCEPTION` para evitar erro).
- Subscriber só no card de resumo mensal e na tela aberta.

## 7. Compatibilidade
- Mapear status legados ao carregar: `aberta` → `emitida`. Migration faz `UPDATE contencao SET status='emitida' WHERE status='aberta'`.
- Dashboard, exports e e-mails continuam funcionando — eles tratam status por string, então adiciono os novos labels mas mantenho os filtros existentes.

## 8. Changelog / versão
- Bump `VITE_APP_VERSION` para `1.2.9.0` (mudança de escopo maior → minor bump).
- Inserir entrada em `app_changelog` (change_type=`minor`).

## Detalhes técnicos (referência)

```text
Contencao.tsx
├── ResumoMensalCard           (novo)
├── ContencaoCard
│   ├── StatusBadge (animado se em_andamento)
│   ├── Métricas (dias, horas, último turno)
│   └── Barra OK/NG
└── ContencaoDetalheDrawer    (novo painel/rota)
    ├── ContencaoStatusStepper (novo)
    ├── RegistrosTotaisHeader
    ├── RegistroCard[]
    └── ContencaoRegistroDialog (novo modal)
```

Arquivos novos: `src/components/contencao/ContencaoStatusStepper.tsx`, `ContencaoRegistroDialog.tsx`, `RegistroCard.tsx`, `ResumoMensalCard.tsx`, `ContencaoDetalheDrawer.tsx`, `src/lib/contencao.ts`.
Arquivos alterados: `src/pages/Contencao.tsx`, `src/pages/ContencaoForm.tsx`, possivelmente `ContencaoDashboard.tsx` para refletir novos status.

## Pontos a confirmar antes de implementar
1. **Onde abrir o detalhe?** A página atual `Contencao.tsx` é uma lista simples sem rota de detalhe. Posso abrir num **drawer lateral** ao clicar no card (mais rápido em mobile) ou criar **rota nova** `/contencao/:id`. Sugestão: drawer.
2. **Co-inspetores** — usar `get_co_inspection_profiles()` que já existe (ativos, sem terceiros, sem TESTER)? Sugestão: sim.
3. **Bucket `containment-photos`** — criar público (mais simples para mostrar nos cards) ou privado com signed URLs? Sugestão: público, alinhado a `checklist-photos`/`alertas-fotos`.
4. **Detectar "Em Andamento" automaticamente** — minha regra é ≥2 turnos distintos OU ≥2 registros no mesmo turno. Confirma?

Posso seguir com as sugestões padrão (drawer, RPC existente, bucket público, regra acima) se você só responder "ok".