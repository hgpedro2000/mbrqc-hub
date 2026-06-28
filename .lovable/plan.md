## Objetivo
Melhorar legibilidade dos rótulos dos gráficos e tornar o diálogo "Peças desconsideradas" simétrico e responsivo (desktop + mobile).

## Mudanças em `src/pages/AnaliseRisco.tsx`

### 1. Rótulos de dados dos gráficos
- Aumentar `fontSize` dos `<LabelList>` de ~10/11px para **13px desktop / 12px mobile** (via hook `useIsMobile` já existente no projeto).
- Aplicar `fontWeight: 600` e `fill` com cor de alto contraste (token `--foreground`) em todos os charts (Pareto modos de falha, barras por projeto, por fornecedor, mapa de risco, etc.).
- Em gráficos de barra horizontal, mover rótulo para `position="right"` com offset para não cortar.
- Em barras verticais, usar `position="top"` com offset 6.

### 2. Diálogo "Peças desconsideradas" — simetria
- Padronizar o grid de filtros (Projeto / Modelo / Fornecedor / Busca) em:
  - Mobile: `grid-cols-1` (stack)
  - Tablet: `grid-cols-2`
  - Desktop: `grid-cols-4` com larguras iguais (`gap-3`)
- Altura uniforme nos `Select`/`Input` (`h-10`), labels com mesmo tamanho/peso.
- Botões "Limpar filtros", "Pré-visualizar" e "Exportar PDF" alinhados em uma barra inferior `flex flex-wrap justify-end gap-2`, com `w-full sm:w-auto` no mobile.

### 3. Responsividade da tabela de excluídos
- Wrap em `overflow-x-auto` com `min-w-[720px]` para preservar colunas no desktop.
- No mobile (`<768px`): renderizar como **cards empilhados** (padrão do projeto — ver memory Mobile Patterns) com PN/Projeto/Fornecedor/NG/Último NG, mantendo os cabeçalhos clicáveis para ordenação acima da lista (chips de "Ordenar por").
- Cabeçalhos da tabela desktop: padding consistente `px-3 py-2`, ordenação com ícone alinhado.

### 4. Diálogo geral
- `DialogContent` com `max-w-5xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col`.
- Corpo scrollável `flex-1 overflow-y-auto` para evitar que filtros/botões saiam da viewport.

## Sem alterações
- Lógica de filtros, ordenação, persistência (localStorage) e geração de PDF permanecem intactas.
