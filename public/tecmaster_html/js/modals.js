// ============================================================
// TECMASTER OS — Modal Rendering
// ============================================================

class ModalRenderer {
  static renderQuizModal(state) {
    if (!state.activeQuiz) return '';

    const quiz = state.activeQuiz;
    const question = quiz.question;
    const skill = MAINT_SKILLS[quiz.skillId];

    return `
      <div class="modal-content quiz-modal-content">
        <div class="quiz-header">
          <div class="quiz-icon">${skill?.icon}</div>
          <div class="quiz-info">
            <div class="quiz-type">📝 DESAFIO TÉCNICO</div>
            <div class="quiz-skill">${skill?.name}</div>
          </div>
          <div class="quiz-level">Lv${question.lv}</div>
        </div>

        <div class="quiz-body">
          <div class="quiz-question">${question.q}</div>

          <div class="quiz-answers">
            ${question.a.map((ans, i) => `
              <div class="quiz-answer" data-answer="${i}">
                <div class="quiz-answer-letter">${String.fromCharCode(65 + i)})</div>
                <div class="quiz-answer-text">${ans}</div>
              </div>
            `).join('')}
          </div>

          <div class="quiz-tip">
            <div class="quiz-tip-title">💡 Dica:</div>
            <div>${question.tip}</div>
          </div>
        </div>

        <div class="quiz-footer">
          <button class="quiz-confirm" id="quiz-confirm-btn">CONFIRMAR</button>
        </div>
      </div>
    `;
  }

  static renderRatingModal(state) {
    if (!state.lastRating) return '';

    const rating = state.lastRating;

    return `
      <div class="modal-content rating-modal-content">
        <div class="rating-icon">⭐</div>
        <div class="rating-title">AVALIAÇÃO DO CLIENTE</div>

        <div class="rating-stars">
          ${Array(5).fill(0).map((_, i) => `
            <div class="rating-star ${i < rating.stars ? 'active' : ''}">⭐</div>
          `).join('')}
        </div>

        <div class="rating-message">${rating.msg}</div>
        <div style="font-size: 14px; color: var(--color-warning); font-weight: bold; margin-bottom: 16px;">
          +${GameFormulas.formatNumber(rating.pay)} Zeny
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
          <button class="btn btn-primary btn-block" id="rating-new-os-btn">INICIAR NOVA OS</button>
          <button class="btn btn-secondary btn-block" id="rating-close-btn">VOLTAR AO MAPA</button>
        </div>
      </div>
    `;
  }

  static renderStatsModal(state) {
    if (!state.player) return '';

    const player = state.player;
    const rep = GameFormulas.calcReputation(player);
    const repTier = GameFormulas.getRepTier(player);
    const hp = GameFormulas.calcMaxHp(player);
    const mp = GameFormulas.calcMaxMp(player);
    const atk = GameFormulas.calcPlayerDmg(player);
    const matk = GameFormulas.calcPlayerMatk(player);
    const def = GameFormulas.calcPlayerDef(player);
    const spd = GameFormulas.calcPlayerSpd(player);

    return `
      <div class="modal-content stats-modal-content">
        <div class="modal-header">
          <div class="modal-title">📊 STATUS</div>
          <button class="modal-close" id="stats-close-btn">✕</button>
        </div>

        <div class="stats-section">
          <div class="stats-section-title">Informações Básicas</div>
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-label">Nível</div>
              <div class="stat-value">${player.level}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">EXP</div>
              <div class="stat-value">${player.exp}/${GameFormulas.expNeeded(player.level)}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Zeny</div>
              <div class="stat-value">${GameFormulas.formatNumber(player.zeny)}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Reputação</div>
              <div class="stat-value">${GameFormulas.formatNumber(rep)}</div>
            </div>
          </div>
        </div>

        <div class="stats-section">
          <div class="stats-section-title">Atributos</div>
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-label">STR</div>
              <div class="stat-value">${player.str}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">VIT</div>
              <div class="stat-value">${player.vit}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">AGI</div>
              <div class="stat-value">${player.agi}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">DEX</div>
              <div class="stat-value">${player.dex}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">INT</div>
              <div class="stat-value">${player.intel}</div>
            </div>
          </div>
        </div>

        <div class="stats-section">
          <div class="stats-section-title">Derivados</div>
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-label">HP</div>
              <div class="stat-value">${hp}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">MP</div>
              <div class="stat-value">${mp}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">ATK</div>
              <div class="stat-value">${atk}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">MATK</div>
              <div class="stat-value">${matk}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">DEF</div>
              <div class="stat-value">${def}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">SPD</div>
              <div class="stat-value">${spd}</div>
            </div>
          </div>
        </div>

        <div class="stats-section">
          <div class="stats-section-title">Habilidades Técnicas</div>
          ${Object.entries(MAINT_SKILLS).map(([skillId, skill]) => `
            <div style="margin-bottom: 12px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="color: var(--color-text);">${skill.name}</span>
                <span style="color: var(--color-text-muted);">Lv ${player.maintSkills[skillId]}</span>
              </div>
              <div class="bar-wrapper">
                <div class="bar-fill" style="width: ${(player.maintSkillExp[skillId] / GameFormulas.skillExpNeeded(player.maintSkills[skillId])) * 100}%; background: ${skill.color};">
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  static renderShopModal(state) {
    if (!state.player) return '';

    const player = state.player;
    const categories = ['consumable', 'helmet', 'boots', 'gloves', 'armor', 'tool', 'accessory'];

    return `
      <div class="modal-content shop-modal-content">
        <div class="shop-header">
          <div class="shop-title">🛒 LOJA INDUSTRIAL</div>
          <div class="modal-close" id="shop-close-btn">✕</div>
        </div>

        <div class="shop-header" style="border-bottom: none; padding-top: 0;">
          <div class="shop-zeny">💰 ${GameFormulas.formatNumber(player.zeny)} Zeny</div>
        </div>

        <div id="shop-message" class="hidden" style="padding: 8px 16px; text-align: center; font-weight: bold; font-size: 14px;"></div>

        <div class="shop-tabs">
          ${categories.map(cat => {
            const icon = {
              consumable: '🥤',
              helmet: '🪖',
              boots: '👢',
              gloves: '🧤',
              armor: '🦺',
              tool: '🔧',
              accessory: '💍',
            }[cat];
            return `<button class="shop-tab ${cat === 'consumable' ? 'active' : ''}" data-category="${cat}">${icon}</button>`;
          }).join('')}
        </div>

        <div class="shop-body">
          <div class="shop-items" id="shop-items">
            ${SHOP_ITEMS.filter(item => item.type === 'consumable').map(item => `
              <div class="shop-item" data-item-id="${item.id}">
                <div class="shop-item-icon">${item.icon}</div>
                <div class="shop-item-name">${item.name}</div>
                <div class="shop-item-price">${item.price} Zeny</div>
                <button class="shop-item-btn" data-item-id="${item.id}">COMPRAR</button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  static renderProfileModal(state) {
    if (!state.player) return '';

    const player = state.player;
    const cls = CLASSES[player.classId];
    const rep = GameFormulas.calcReputation(player);
    const repTier = GameFormulas.getRepTier(player);

    return `
      <div class="modal-content profile-modal-content">
        <div class="modal-header">
          <div class="modal-title">👤 PERFIL</div>
          <button class="modal-close" id="profile-close-btn">✕</button>
        </div>

        <div class="profile-header">
          <div class="profile-avatar">${cls?.icon}</div>
          <div class="profile-name">${player.name}</div>
          <div class="profile-class">${cls?.title}</div>
          <div style="color: var(--color-text-muted); font-size: 12px; margin-top: 8px;">
            ${repTier.icon} ${repTier.name}
          </div>
        </div>

        <div class="profile-body">
          <div class="profile-section">
            <div class="profile-section-title">Estatísticas</div>
            <div class="profile-stat">
              <span class="profile-stat-label">Nível</span>
              <span class="profile-stat-value">${player.level}</span>
            </div>
            <div class="profile-stat">
              <span class="profile-stat-label">Total de OS</span>
              <span class="profile-stat-value">${player.totalOs}</span>
            </div>
            <div class="profile-stat">
              <span class="profile-stat-label">Estrelas</span>
              <span class="profile-stat-value">${player.totalStars}</span>
            </div>
            <div class="profile-stat">
              <span class="profile-stat-label">Reputação</span>
              <span class="profile-stat-value">${GameFormulas.formatNumber(rep)}</span>
            </div>
          </div>

          <div class="profile-section">
            <div class="profile-section-title">Equipamento</div>
            ${Object.entries(player.equipment).map(([slot, item]) => `
              <div class="profile-stat">
                <span class="profile-stat-label">${slot.toUpperCase()}</span>
                <span class="profile-stat-value">${item ? item.name : '-'}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  static renderNR12Modal(state) {
    return `
      <div class="modal-content nr12-modal-content">
        <div class="modal-header">
          <div class="modal-title">⚠️ NR-12 — SEGURANÇA EM MÁQUINAS</div>
          <button class="modal-close" id="nr12-close-btn">✕</button>
        </div>

        <div class="nr12-body">
          <div class="nr12-section">
            <div class="nr12-section-title">1. Objetivo da NR-12</div>
            <div class="nr12-section-content">
              A NR-12 estabelece requisitos de segurança para máquinas e equipamentos, visando proteger a saúde e integridade dos trabalhadores.
            </div>
          </div>

          <div class="nr12-section">
            <div class="nr12-section-title">2. Zona de Perigo</div>
            <div class="nr12-section-content">
              Área onde há risco de acidentes. Deve ser sinalizada e protegida com barreiras físicas.
            </div>
          </div>

          <div class="nr12-section">
            <div class="nr12-section-title">3. Dispositivos de Proteção</div>
            <div class="nr12-section-content">
              Incluem: proteções fixas, móveis, interlock, sensores de presença e sistemas de parada de emergência.
            </div>
          </div>

          <div class="nr12-section">
            <div class="nr12-section-title">4. Manutenção</div>
            <div class="nr12-section-content">
              Toda manutenção deve ser realizada com a máquina parada e travada. Usar LOTO (Lockout/Tagout).
            </div>
          </div>

          <div class="nr12-section">
            <div class="nr12-section-title">5. Treinamento</div>
            <div class="nr12-section-content">
              Todos os operadores e técnicos devem receber treinamento específico sobre segurança em máquinas.
            </div>
          </div>
        </div>
      </div>
    `;
  }

  static renderReviewModal(state) {
    return `
      <div class="modal-content review-modal-content">
        <div class="modal-header">
          <div class="modal-title">📝 REVISAR QUESTÕES</div>
          <button class="modal-close" id="review-close-btn">✕</button>
        </div>

        <div class="review-filters">
          ${Object.entries(MAINT_SKILLS).map(([skillId, skill]) => `
            <button class="review-filter-btn active" data-skill="${skillId}">
              ${skill.icon} ${skill.name}
            </button>
          `).join('')}
        </div>

        <div class="review-body">
          ${QUIZ_QUESTIONS.slice(0, 10).map((q, i) => `
            <div class="review-question">
              <div class="review-question-text">${i + 1}. ${q.q}</div>
              <div class="review-answers">
                ${q.a.map((ans, j) => `
                  <div class="review-answer" ${j === q.c ? 'style="color: var(--color-success); font-weight: bold;"' : ''}>
                    ${ans} ${j === q.c ? '✓' : ''}
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  static render(state) {
    const quizModal = document.getElementById('quiz-modal');
    const ratingModal = document.getElementById('rating-modal');
    const statsModal = document.getElementById('stats-modal');
    const shopModal = document.getElementById('shop-modal');
    const profileModal = document.getElementById('profile-modal');
    const nr12Modal = document.getElementById('nr12-modal');
    const reviewModal = document.getElementById('review-modal');

    // Quiz Modal
    if (state.activeQuiz) {
      quizModal.innerHTML = this.renderQuizModal(state);
      quizModal.classList.remove('hidden');
    } else {
      quizModal.classList.add('hidden');
    }

    // Rating Modal
    if (state.showRating && state.lastRating) {
      ratingModal.innerHTML = this.renderRatingModal(state);
      ratingModal.classList.remove('hidden');
    } else {
      ratingModal.classList.add('hidden');
    }

    // Stats Modal
    if (state.showStats) {
      statsModal.innerHTML = this.renderStatsModal(state);
      statsModal.classList.remove('hidden');
    } else {
      statsModal.classList.add('hidden');
    }

    // Shop Modal
    if (state.showShop) {
      shopModal.innerHTML = this.renderShopModal(state);
      shopModal.classList.remove('hidden');
    } else {
      shopModal.classList.add('hidden');
    }

    // Profile Modal
    if (state.showProfile) {
      profileModal.innerHTML = this.renderProfileModal(state);
      profileModal.classList.remove('hidden');
    } else {
      profileModal.classList.add('hidden');
    }

    // NR-12 Modal
    if (state.showNR12) {
      nr12Modal.innerHTML = this.renderNR12Modal(state);
      nr12Modal.classList.remove('hidden');
    } else {
      nr12Modal.classList.add('hidden');
    }

    // Review Modal
    if (state.showReview) {
      reviewModal.innerHTML = this.renderReviewModal(state);
      reviewModal.classList.remove('hidden');
    } else {
      reviewModal.classList.add('hidden');
    }

    this.attachEventListeners(state);
  }

  static attachEventListeners(state) {
    // Quiz answers
    document.querySelectorAll('.quiz-answer').forEach(ans => {
      ans.addEventListener('click', (e) => {
        document.querySelectorAll('.quiz-answer').forEach(a => a.classList.remove('selected'));
        e.currentTarget.classList.add('selected');
      });
    });

    // Quiz confirm
    const quizConfirmBtn = document.getElementById('quiz-confirm-btn');
    if (quizConfirmBtn) {
      quizConfirmBtn.addEventListener('click', () => {
        const selected = document.querySelector('.quiz-answer.selected');
        if (selected) {
          const answer = parseInt(selected.dataset.answer);
          const isCorrect = answer === state.activeQuiz.question.c;
          gameState.answerQuiz(isCorrect);
        }
      });
    }

    // Rating close
    const ratingCloseBtn = document.getElementById('rating-close-btn');
    if (ratingCloseBtn) {
      ratingCloseBtn.addEventListener('click', () => {
        gameState.setState({ showRating: false, screen: 'map' });
      });
    }

    const ratingNewOsBtn = document.getElementById('rating-new-os-btn');
    if (ratingNewOsBtn) {
      ratingNewOsBtn.addEventListener('click', () => {
        gameState.setState({ showRating: false });
        gameState.startBattle(state.zone);
      });
    }

    // Close buttons
    document.getElementById('stats-close-btn')?.addEventListener('click', () => {
      gameState.setState({ showStats: false });
    });

    document.getElementById('shop-close-btn')?.addEventListener('click', () => {
      gameState.setState({ showShop: false });
    });

    document.getElementById('profile-close-btn')?.addEventListener('click', () => {
      gameState.setState({ showProfile: false });
    });

    document.getElementById('nr12-close-btn')?.addEventListener('click', () => {
      gameState.setState({ showNR12: false });
    });

    document.getElementById('review-close-btn')?.addEventListener('click', () => {
      gameState.setState({ showReview: false });
    });

    // Review filter buttons
    document.querySelectorAll('.review-filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.review-filter-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const skillId = e.currentTarget.dataset.skill;
        // Filter questions by skillId
        const filteredQuestions = QUIZ_QUESTIONS.filter(q => q.skill === skillId);
        const reviewBody = document.querySelector('.review-body');
        if (reviewBody) {
          reviewBody.innerHTML = filteredQuestions.map((q, i) => `
            <div class="review-question">
              <div class="review-question-text">${i + 1}. ${q.q}</div>
              <div class="review-answers">
                ${q.a.map((ans, j) => `
                  <div class="review-answer" ${j === q.c ? 'style="color: var(--color-success); font-weight: bold;"' : ''}>
                    ${ans} ${j === q.c ? '✓' : ''}
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('');
        }
      });
    });

    // Shop tabs
    document.querySelectorAll('.shop-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        const category = e.target.dataset.category;
        const items = SHOP_ITEMS.filter(item => item.type === category);
        const itemsContainer = document.getElementById('shop-items');
        if (itemsContainer) {
          itemsContainer.innerHTML = items.map(item => `
            <div class="shop-item" data-item-id="${item.id}">
              <div class="shop-item-icon">${item.icon}</div>
              <div class="shop-item-name">${item.name}</div>
              <div class="shop-item-price">${item.price} Zeny</div>
              <button class="shop-item-btn" data-item-id="${item.id}">COMPRAR</button>
            </div>
          `).join('');
        }
      });
    });

    // Shop buy buttons
    // Use event delegation for dynamically added buttons
    const shopItemsContainer = document.getElementById('shop-items');
    if (shopItemsContainer) {
      shopItemsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('shop-item-btn')) {
          const itemId = e.target.dataset.itemId;
          const result = gameState.buyItem(itemId);
          const msgDiv = document.getElementById('shop-message');
          if (msgDiv) {
            msgDiv.classList.remove('hidden');
            if (result.success) {
              msgDiv.textContent = 'Item comprado com sucesso!';
              msgDiv.style.color = 'var(--color-success)';
              msgDiv.style.backgroundColor = 'rgba(34, 197, 94, 0.1)';
            } else {
              msgDiv.textContent = result.error;
              msgDiv.style.color = 'var(--color-error)';
              msgDiv.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
            }
            setTimeout(() => {
              msgDiv.classList.add('hidden');
            }, 3000);
          }
        }
      });
    }
  }
}
