// ============================================================
// TECMASTER OS — Main Application
// ============================================================

class TecmasterOS {
  constructor() {
    this.init();
  }

  init() {
    // Initialize game state
    gameState.setState({ screen: 'login' });

    // Render initial screen
    ScreenRenderer.render(gameState.state);
    
    // Subscribe to state changes to re-render
    gameState.subscribe(state => {
      ScreenRenderer.render(state);
      if (typeof ModalRenderer !== 'undefined') {
        ModalRenderer.render(state);
      }
      
      // Handle bottom nav visibility
      const bottomNav = document.getElementById('bottom-nav');
      if (bottomNav) {
        if (['map', 'battle', 'learning'].includes(state.screen)) {
          bottomNav.classList.remove('hidden');
        } else {
          bottomNav.classList.add('hidden');
        }
      }

      if (state.screen === 'map' && typeof AnimationManager !== 'undefined') {
        AnimationManager.renderMapCanvas(state);
      }
    });

    // Setup event listeners
    this.setupEventListeners();

    // Load saved data
    this.loadSavedData();

    console.log('✅ Tecmaster OS initialized');
  }

  setupEventListeners() {
    // Bottom Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const screen = e.currentTarget.dataset.screen;
        if (screen === 'map') gameState.setState({ screen: 'map' });
        if (screen === 'status') gameState.setState({ showStats: true });
        if (screen === 'profile') gameState.setState({ showProfile: true });
        if (screen === 'shop') gameState.setState({ showShop: true });
        if (screen === 'nr12') gameState.setState({ showNR12: true });
        if (screen === 'review') gameState.setState({ showReview: true });
      });
    });

    // Modal close on background click
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal')) {
        const modal = e.target;
        modal.classList.add('hidden');
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        gameState.setState({
          showStats: false,
          showShop: false,
          showProfile: false,
          showNR12: false,
          showReview: false,
          showRating: false,
        });
      }
    });
  }

  loadSavedData() {
    // Load accounts from localStorage
    gameState.loadAccounts();
  }
}

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new TecmasterOS();
});

// Handle window resize
window.addEventListener('resize', () => {
  // Re-render map canvas if needed
  if (gameState.state.screen === 'map') {
    AnimationManager.renderMapCanvas(gameState.state);
  }
});

// Prevent accidental page reload
window.addEventListener('beforeunload', (e) => {
  if (gameState.state.player) {
    gameState.savePlayer(gameState.state.player);
  }
});
