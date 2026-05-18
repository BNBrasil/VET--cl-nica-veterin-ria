---
name: pokemon-deck-navigation
description: "Padrões de roteamento dinâmico para coleções, roteamento estruturado via React Router e interceptação avançada do botão Voltar do navegador (Back Trap Session Exit)."
---

# Navegação e Roteamento Dinâmico PokéDecks

Este módulo documenta os padrões de arquitetura para migrar de estados internos renderizados localmente para um ecossistema completo de roteamento e histórico de navegador, incluindo roteamento curinga (wildcards) para coleções e interceptação de sessão.

## 🚀 Visão Geral do Sistema

1. **Subdiretórios Dinâmicos**: Permite que coleções do Pokémon TCG tenham URLs únicas e compartilháveis (ex: `/pokemon/Perfect%20Order`).
2. **Resolução Assíncrona**: Faz match inteligente entre slugs de URL e conjuntos dinâmicos (IDs de coleções da API ou Nomes), garantindo que links diretos funcionem.
3. **Armadilha de Histórico (Back Trap)**: Captura o clique do botão Voltar físico do navegador na página raiz para disparar diálogos de confirmação de logout ao invés de fechar o app abruptamente.

---

## 🛠️ Padrões de Implementação

### 1. Wrapper de Roteamento Dinâmico (Dynamic Interceptor)

Intercepte segmentos de URL curinga (`:collectionName`), filtre rotas do sistema e synchronize o contexto global de seleção assincronamente após a recuperação das listas da API.

```tsx
function CollectionRouteWrapper({ 
  selectedCard, 
  onSelectCard 
}: { 
  selectedCard: Card | null; 
  onSelectCard: (card: Card | null) => void; 
}) {
  const { collectionName } = useParams<{ collectionName: string }>();
  const { sets, currentSetId, setCurrentSetId, setView } = useCollection();
  
  useEffect(() => {
    if (!collectionName) return;
    
    // 1. Salvaguarda para evitar interceptar rotas estáticas
    const systemRoutes = ['profile', 'theme', 'support', 'apoio', 'login'];
    if (systemRoutes.includes(collectionName.toLowerCase())) return;

    const decoded = decodeURIComponent(collectionName);
    
    // 2. Procura por correspondência exata em Nomes ou IDs
    let target = sets.find(s => s.name.toLowerCase() === decoded.toLowerCase());
    if (!target) {
      target = sets.find(s => s.id.toLowerCase() === decoded.toLowerCase());
    }
    
    // 3. Procura flexível por slugs hifenizados
    if (!target) {
      const slugified = decoded.replace(/-/g, ' ').toLowerCase();
      target = sets.find(s => s.name.toLowerCase() === slugified);
    }
    
    // 4. Sincroniza seleção de coleção no Contexto Global
    if (target) {
      if (currentSetId !== target.id) {
        setCurrentSetId(target.id);
      }
      setView('collection'); // Alinha visualizações
    }
  }, [collectionName, sets, currentSetId, setCurrentSetId, setView]);

  return (
    <DashboardContent 
      selectedCard={selectedCard} 
      onSelectCard={onSelectCard} 
    />
  );
}
```

### 2. Sincronização de Estados no Mount (Context Sync)

Componentes estáticos renderizados em rotas específicas devem usar hooks de montagem para notificar APIs de estado compartilhadas sobre sua ativação, mantendo componentes irmãos (como Headers ou Footers) atualizados.

```tsx
function ProfileView({ tabMode }) {
  const { setView: setContextView } = useCollection();
  
  useEffect(() => {
    // Sincroniza o enum de view interna com a URL montada
    setContextView(tabMode || 'profile');
  }, [setContextView, tabMode]);

  // ... lógica de visualização
}
```

### 3. Interceptação de Botão Voltar (PopState Session Trap)

Para evitar perda de progresso ou saídas inesperadas de contas na raiz da aplicação, adicione um estado fantasma na pilha de histórico (`window.history.pushState`) e capture eventos `popstate`.

```tsx
const [showExitConfirm, setShowExitConfirm] = useState(false);

useEffect(() => {
  // Aplica somente na raiz da Dashboard
  const isAtPokemonRoot = location.pathname === '/pokemon' || location.pathname === '/pokemon/';
  if (!isAtPokemonRoot) return;

  // Injeta um estado fantasma imediatamente
  window.history.pushState({ backTrap: true }, "", window.location.href);

  const handlePopState = (event: PopStateEvent) => {
    // Usuário clicou em voltar!
    // Reinjeta para manter preso no loop até aprovação
    window.history.pushState({ backTrap: true }, "", window.location.href);
    
    // Dispara componente de interface personalizado para logout
    setShowExitConfirm(true);
  };

  window.addEventListener('popstate', handlePopState);

  return () => {
    window.removeEventListener('popstate', handlePopState);
  };
}, [location.pathname]);
```

---

## 📋 Check-list de Manutenção

- [ ] **Verificar Inclusão de Novas Rotas**: Qualquer rota nova criada (ex: `/ranking`, `/scanner`) DEVE ser adicionada na constante `systemRoutes` no wrapper dinâmico para evitar que o app a confunda com o nome de uma coleção de cartas.
- [ ] **Encoding de URL**: Sempre use `encodeURIComponent(set.name)` em chamadas de `navigate` em grids ou links para lidar com caracteres especiais em nomes de coleções brasileiras/japonesas (ex: `~`, `&`, `-`).
- [ ] **Cleanup de Event Listeners**: O hook de `PopStateEvent` DEVE retornar a função de limpeza para remover o event listener, evitando vazamento de memória e múltiplos modais ao navegar para fora da tela inicial.
