## Novo perfil Monitor v2

Criar um segundo perfil de monitor acessível via `/monitor?perfil=v2` (mantendo o atual em `/monitor` intacto). Um seletor de perfil será adicionado ao topo do `/monitor` para alternar entre **Padrão** e **V2 - Detalhado**.

### Slides redesenhados (perfil v2)

1. **Últimos Lançamentos** — adicionar coluna **Rate de Aprovação (%)** = `(OK / Inspecionada) × 100`, colorida (verde ≥98%, amarelo 90-97%, vermelho <90%).

2. **Alertas Vigentes → Alertas de Qualidade**
   - Buscar apenas de `alertas_qualidade` (lista mestra), com mais detalhes (nº, título, fornecedor, part number, modo de falha, data, severidade, foto).
   - Novo layout em cards com gradiente por severidade + animações `fade-in` / `pulse` em alertas críticos.

3. **Contenções Ativas → Contenções**
   - Renomear, dividir em duas seções: **Em Andamento** e **Finalizadas** (da lista mestra `contencao`).
   - Layout em lista vertical animada (`slide-in-right` escalonado), com badges de status.

4. **Ranking Fornecedores → Performance de Fornecedores**
   - Os 3 piores (top-worst por PPM) ganham animação `pulse` e destaque vermelho.
   - Alinhar cabeçalho INSP / NG / PPM com tabular-nums, larguras fixas, e formatação compacta de PPM (`1.2k`, `15k`).

5. **Gráfico de Defeitos → Principais Modos de Falhas Detectados**
   - Remover prefixos numéricos dos rótulos (já existe regra global, garantir aqui).
   - Animação de barras com easing + contador animado dos valores.

6. **Quantidade Inspecionada → Monitoramento de Inspeção**
   - Implementar **split-flap display** (estilo painel de aeroporto) para os números, com flip animado a cada atualização.
   - Grid responsivo que aceita N fornecedores (não fixo em 4).

7. **Resumo do Período** — animações `fade-in` + counter animado nos 4 KPIs, com ícones pulsantes.

### Slides novos (perfil v2)

8. **Comunicados** — slide que exibe imagens (JPG/PNG) em carrossel. Upload via nova página `/monitor/admin` (admin-only) para bucket `monitor-comunicados`. Tabela `monitor_slides_media` (tipo='comunicado').

9. **Alterações 4M/EO e Validações** — mesma mecânica do Comunicados, tipo='alteracao_4m'.

10. **Últimos Defeitos Detectados** — buscar últimos NG de `apontamentos` + fotos de `checklist_photos`, layout detalhado com foto grande, modo de falha, fornecedor, part number, data, inspetor.

### Backend

- Nova tabela `monitor_slides_media` (id, tipo, image_url, titulo, descricao, ordem, ativo, created_at, created_by) + RLS: SELECT público (anon), INSERT/UPDATE/DELETE admin.
- Novo bucket público `monitor-comunicados`.
- Página admin `/monitor/admin` para gerenciar uploads dos slides 8 e 9.

### Estrutura técnica

- `src/pages/Monitor.tsx` detecta `?perfil=v2` e renderiza `<MonitorV2 />` em vez do componente atual.
- Novo diretório `src/components/monitor-v2/` com um arquivo por slide:
  - `SlideLancamentosV2.tsx`, `SlideAlertasV2.tsx`, `SlideContencoesV2.tsx`, `SlidePerformanceV2.tsx`, `SlideModosFalhaV2.tsx`, `SlideMonitoramentoV2.tsx` (com `SplitFlapDigit.tsx`), `SlideResumoV2.tsx`, `SlideComunicadosV2.tsx`, `SlideAlteracoes4MV2.tsx`, `SlideUltimosDefeitosV2.tsx`.
- Todos consomem `monitorClient` (já existente) — sem auth.
- Animações via Tailwind keyframes existentes + novas (`flip-down`, `pulse-danger`) adicionadas a `tailwind.config.ts`.
- Bumpar `VITE_APP_VERSION` e registrar changelog.

### Confirmar com o usuário antes de prosseguir

1. Manter `/monitor` atual 100% intacto e o V2 acessível por seletor + `?perfil=v2`? (sim/não)
2. Página admin para upload dos slides Comunicados / 4M-EO deve ficar em `/monitor/admin` restrita a admin? (sim/não)
3. "Últimos Defeitos Detectados" — quantos itens exibir por vez (sugestão: 5 com rotação automática a cada 8s)?
