// ============================================================
// TECMASTER OS — Animations
// ============================================================

class AnimationManager {
  static renderMapCanvas(state) {
    const canvas = document.getElementById('map-canvas');
    if (!canvas) return;
    
    canvas.innerHTML = '';
    
    // Render zones
    if (typeof ZONES !== 'undefined') {
      const REF_WIDTH = 660;
      const REF_HEIGHT = 600;

      Object.values(ZONES).forEach(zone => {
        const marker = document.createElement('div');
        marker.className = `map-marker ${state.zone === zone.id ? 'active' : ''}`;
        
        // Calculate percentages
        const leftPercent = (zone.x / REF_WIDTH) * 100;
        const topPercent = (zone.y / REF_HEIGHT) * 100;
        
        marker.style.left = `${leftPercent}%`;
        marker.style.top = `${topPercent}%`;
        marker.innerHTML = `
          <div class="marker-icon">${zone.icon}</div>
          <div class="marker-label">${zone.name}</div>
        `;
        
        marker.addEventListener('click', () => {
          gameState.setState({ zone: zone.id });
        });
        
        canvas.appendChild(marker);
      });
      
      // Render player
      const currentZone = ZONES[state.zone || 'hub'];
      if (currentZone) {
        const playerMarker = document.createElement('div');
        playerMarker.className = 'player-marker';
        
        const leftPercent = (currentZone.x / REF_WIDTH) * 100;
        const topPercent = (currentZone.y / REF_HEIGHT) * 100;
        
        playerMarker.style.left = `${leftPercent}%`;
        playerMarker.style.top = `${topPercent}%`;
        playerMarker.innerHTML = '👤';
        canvas.appendChild(playerMarker);
      }
    } else {
      // Fallback if ZONES is not defined
      canvas.innerHTML = `
        <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background-color: #1a1a1a; border-radius: 8px; border: 1px solid #333;">
          <div style="text-align: center;">
            <div style="font-size: 48px; margin-bottom: 16px;">🏭</div>
            <div style="color: #888; font-size: 14px;">Fábrica Principal</div>
          </div>
        </div>
      `;
    }
  }
}
