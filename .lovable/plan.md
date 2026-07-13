# Plano: Módulo de Auditorias MBRQC — versão completa

Escopo grande. Vou entregar em **4 fases** para você validar cada etapa antes da próxima (evita retrabalho e mantém o app estável).

## Fase 1 — Banco de dados + Storage
- Nova migração criando/ajustando tabelas: `audits`, `audit_ncs`, `audit_nc_responses`, `audit_alerts` (com todos os campos da spec).
- Enums: `audit_type`, `audit_status`, `audit_nc_status`, `audit_alert_type`.
- Bucket privado `audit-photos` com políticas RLS por usuário autenticado.
- Trigger de numeração automática (`AUD-0001`) e `updated_at`.
- RLS: leitura para autenticados, escrita para auditor dono + admin.
- GRANTs padrão.
- Manter tabela `auditorias` antiga intacta (não migro dados — módulo atual é protótipo, conforme você disse). Se quiser migração de dados, me avise.

## Fase 2 — Listagem + Wizard de Nova Auditoria
- Refatorar `src/pages/Auditorias.tsx`: badges de status com as 6 cores, indicador de alerta no card, botão **Agenda**.
- Novo wizard `AuditoriaWizard.tsx` (3 etapas, stepper, mobile-first):
  - Etapa 1: dados gerais, participantes dinâmicos, upload da foto do produto (câmera).
  - Etapa 2: lista dinâmica de NCs (card expansível, foto via câmera, reordenar/excluir, contador).
  - Etapa 3: pedidos de melhoria, conclusão, resumo automático, salvar.
- Auto-status "planejada" ou "em_andamento" conforme data.

## Fase 3 — Detalhe + Geração PPTX
- Tela de detalhe com abas (Visão Geral, NCs, Cronograma, Histórico).
- Marcar NC como respondida + inserir foto After + texto de contramedida manualmente.
- Geração PPTX (`pptxgenjs`) reproduzindo os 3 layouts das imagens:
  - Slide capa (Supplier Visit Report).
  - Slides de lista (General Issues, máx 4 NCs por slide, paginação automática).
  - Slides Improvement Case (1 por NC, Before/After).
- Paleta `MOBIS_COLORS` como constantes; logo Mobis em todos os slides.
- Nome do arquivo: `AUD-XXXX_Fornecedor_DDMMYYYY.pptx`.
- Ao gerar, status → `aguardando_fornecedor` + timestamp de envio.

## Fase 4 — Agenda + Sistema de Alertas
- Nova rota `/auditorias/agenda` com toggle Calendário/Lista.
- Calendário mensal (grid), pontos coloridos por status, popover do dia.
- Lista agrupada (Esta semana / 2 semanas / Mês / Futuras) + badge urgência <3 dias.
- Filtros compartilhados com a listagem.
- Motor de alertas via edge function agendada (`audit-alerts-cron`) + verificação client-side ao carregar:
  - "Auditoria próxima" (3 dias antes, status planejada).
  - "Fornecedor atrasado" (NC vencida sem resposta).
- Sino no header com contador + dropdown (Ver / Dispensar).

## Detalhes técnicos

- Stack existente: React + Vite + Tailwind + shadcn + Supabase + react-i18next + pptxgenjs (já uso em Dashboard).
- Rotas novas: `/auditorias/nova` (wizard), `/auditorias/:id` (detalhe com abas), `/auditorias/agenda`.
- Componentes novos previstos: `AuditoriaWizard/`, `AuditoriaDetalhe/`, `AuditoriaAgenda/`, `AuditoriaAlertsBell/`, `lib/exportAuditoriaPPTX.ts`.
- i18n: adiciono chaves PT/EN para todos os textos novos.
- Changelog + bump de versão a cada fase entregue.
- Mobile-first: wizard e captura de foto otimizados (`capture="environment"` respeitando a regra do projeto — botão Câmera abre `InAppCamera`).

## Confirmações necessárias antes de começar

1. **Fase 1 dispara migração de banco** (aprovação sua no diálogo). Ok começar por ela?
2. Confirma que posso **descartar** o esquema atual `auditorias`/`audit_items`/`audit_responses` (não migro dados)? Ou prefere manter em paralelo?
3. Alguma preferência de idioma dos slides PPTX gerados: **inglês** (como nas imagens) ou seguir idioma do usuário logado?

Assim que responder, começo pela Fase 1.
