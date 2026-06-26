Ajustar a barra de busca da aba Usuários (modo Engenharia) para recolher ao rolar a página e exibir uma lupinha flutuante transparente que a reabre no topo.

## O que será feito

1. **Estado de recolhimento**
   - Adicionar `searchCollapsed` e `searchFocused` no `UsersTab`.
   - Recolher a barra quando o scroll passar de um limiar (ex: 80px) e o campo não estiver focado nem preenchido.
   - Reexpandir automaticamente quando o usuário voltar ao topo da página ou digitar algo.

2. **Barra de busca recolhível**
   - Na posição expandida: input de busca inline com ícone de lupa, ocupando a largura total.
   - Na posição recolhida: a barra some suavemente (transição de altura/opacidade/translateY) e deixa um espaço limpo, sem spacer fixo.

3. **Lupinha flutuante transparente**
   - Botão circular flutuante fixed, posicionado abaixo do header/abas em ambos os breakpoints (mobile e desktop), usando offset dinâmico calculado via `ResizeObserver` sobre o header e a lista de abas.
   - Fundo translúcido (`bg-background/60` com `backdrop-blur`), borda sutil, ícone de lupa.
   - Só aparece quando `searchCollapsed === true`.

4. **Interação de clique**
   - Ao clicar na lupinha:
     - Define `searchCollapsed = false`.
     - Rola suavemente a página para o topo da aba Usuários (`window.scrollTo({ top: 0, behavior: 'smooth' })`).
     - Foca o input de busca após a transição.

5. **Transições suaves**
   - Aplicar `transition-all duration-300 ease-out` na barra e na lupinha.
   - Evitar "piscar" usando `overflow-hidden` combinado com altura/opacity controladas, não apenas `display: none`.

6. **Responsivo e sem sobreposição**
   - Recalcular o offset superior quando o header ou as abas mudarem de altura (mobile vs desktop).
   - Garantir z-index da lupinha abaixo do header principal e das abas, mas acima do conteúdo da lista.
   - Não usar `sticky` diretamente na barra (já vimos que ancestrais com `overflow-clip` quebram), mantendo a barra inline e a lupinha `fixed`.

7. **Verificação visual**
   - Testar via preview em mobile e desktop para confirmar que:
     - a barra recolhe ao rolar;
     - a lupinha aparece no lugar certo;
     - ao clicar, a barra reabre e o scroll volta ao topo;
     - o conteúdo da lista não fica cortado nem sobreposto.

## Arquivo principal
- `src/components/engenharia/UsersTab.tsx`

## Não alterar
- Lógica de criação/edição/exclusão de usuários.
- Layout das abas, header, toolbar ou botão "Modo Usuário Padrão".
- Comportamento do botão "Voltar ao início" já existente.