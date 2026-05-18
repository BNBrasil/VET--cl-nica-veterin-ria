// ============================================================
// TECMASTER OS — Screen Rendering
// ============================================================

class ScreenRenderer {
  static renderLoginScreen(state) {
    return `
      <div class="login-screen">
        <div class="login-card">
          <div class="login-header">
            <div class="login-logo">⚙️</div>
            <div class="login-title">TECMASTER OS</div>
            <div class="login-subtitle">SIMULADOR DE MANUTENÇÃO INDUSTRIAL</div>
          </div>

          <div class="login-form" id="login-form">
            <div class="login-tabs">
              <button class="login-tab active" data-tab="login">LOGIN</button>
              <button class="login-tab" data-tab="register">REGISTRAR</button>
            </div>

            <div id="login-error" class="form-group hidden" style="color: var(--color-error); font-size: 14px; text-align: center; font-weight: bold;"></div>

            <div id="login-tab" class="login-tab-content">
              <div class="form-group">
                <label class="form-label">Usuário</label>
                <input type="text" class="form-input" id="login-username" placeholder="Digite seu usuário">
              </div>
              <div class="form-group">
                <label class="form-label">Senha</label>
                <div class="password-wrapper">
                  <input type="password" class="form-input" id="login-password" placeholder="Digite sua senha">
                  <button type="button" class="password-toggle" data-target="login-password">👁️</button>
                </div>
              </div>
              <button class="btn btn-primary btn-block" id="login-btn">FAZER LOGIN</button>
            </div>

            <div id="register-tab" class="login-tab-content hidden">
              <div class="form-group">
                <label class="form-label">Novo Usuário</label>
                <input type="text" class="form-input" id="register-username" placeholder="Escolha um usuário">
              </div>
              <div class="form-group">
                <label class="form-label">Senha</label>
                <div class="password-wrapper">
                  <input type="password" class="form-input" id="register-password" placeholder="Escolha uma senha">
                  <button type="button" class="password-toggle" data-target="register-password">👁️</button>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Confirmar Senha</label>
                <div class="password-wrapper">
                  <input type="password" class="form-input" id="register-password-confirm" placeholder="Confirme a senha">
                  <button type="button" class="password-toggle" data-target="register-password-confirm">👁️</button>
                </div>
              </div>
              <button class="btn btn-primary btn-block" id="register-btn">CRIAR CONTA</button>
            </div>
            
            <div style="margin-top: 16px;">
              <a href="/" class="btn btn-secondary btn-block" style="text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 8px;">
                <span>🏠</span> VOLTAR AO DASHBOARD
              </a>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  static renderTitleScreen(state) {
    const currentAcc = state.currentAccount ? state.accounts.find(a => a && a.username === state.currentAccount) : null;

    return `
      <div class="title-screen">
        <div class="title-logo">⚙️</div>
        <div class="title-name">TECMASTER OS</div>
        <div class="title-tagline">Simulador de Manutenção Industrial</div>
        <div class="title-subtitle">Torne-se o melhor técnico industrial</div>

        <div class="title-buttons">
          <button class="btn btn-primary btn-block" id="new-game-btn">
            <span>▶</span> NOVO JOGO
          </button>
          <button class="btn btn-secondary btn-block" id="logout-btn">
            <span>🔄</span> TROCAR DE CONTA
          </button>
          <a href="/" class="btn btn-secondary btn-block" style="text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <span>🏠</span> VOLTAR AO DASHBOARD
          </a>
        </div>

        ${currentAcc && currentAcc.save ? `
          <div class="title-saves">
            <h3 style="color: var(--color-text-muted); font-size: 12px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px;">SEU SAVE</h3>
            <div class="save-item" data-username="${currentAcc.username}">
              <div class="save-name">${currentAcc.save.player?.name || 'Técnico Desconhecido'}</div>
              <div class="save-info">
                <span>${currentAcc.save.player?.classId || 'Sem Classe'}</span> · 
                <span>Lv ${currentAcc.save.player?.level || 1}</span> · 
                <span>${currentAcc.save.timestamp ? new Date(currentAcc.save.timestamp).toLocaleDateString('pt-BR') : 'Data Desconhecida'}</span>
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  static renderCreateScreen(state) {
    return `
      <div class="create-screen">
        <div class="create-card">
          <div class="create-header">
            <div class="create-title">CRIAR PERSONAGEM</div>
          </div>

          <div class="create-form" id="create-form">
            <div id="create-error" class="form-group hidden" style="color: var(--color-error); font-size: 14px; text-align: center; font-weight: bold;"></div>
            <div class="form-group">
              <label class="form-label">Nome do Técnico</label>
              <input type="text" class="form-input" id="create-name" placeholder="Digite o nome do seu técnico">
            </div>

            <div class="form-group">
              <label class="form-label">Gênero</label>
              <div class="gender-selector">
                <button class="gender-btn active" data-gender="male">👨 Masculino</button>
                <button class="gender-btn" data-gender="female">👩 Feminino</button>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Especialidade</label>
              <div class="class-grid">
                ${Object.values(CLASSES).map(cls => `
                  <button class="class-btn ${cls.id === 'eletricista' ? 'active' : ''}" data-class="${cls.id}">
                    <div class="class-icon">${cls.icon}</div>
                    <div>${cls.title}</div>
                  </button>
                `).join('')}
              </div>
            </div>

            <button class="btn btn-primary btn-block" id="create-btn">COMEÇAR JOGO</button>
            <button class="btn btn-secondary btn-block" id="back-btn">VOLTAR</button>
          </div>
        </div>
      </div>
    `;
  }

  static renderMapScreen(state) {
    const player = state.player;
    const maxHp = GameFormulas.calcMaxHp(player);
    const maxStaminaWork = GameFormulas.calcMaxStaminaWork(player);
    const maxStaminaStudy = GameFormulas.calcMaxStaminaStudy(player);

    return `
      <div class="map-screen">
        <div class="map-header">
          <div class="map-stat">
            <div class="bar-container">
              <div class="bar-label">HP</div>
              <div class="bar-wrapper">
                <div class="bar-fill" style="width: ${(player.currentHp / maxHp) * 100}%">
                  <span class="bar-text">${player.currentHp}/${maxHp}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="map-stat">
            <div class="bar-container">
              <div class="bar-label">DF</div>
              <div class="bar-wrapper">
                <div class="bar-fill" style="width: ${(player.staminaWork / maxStaminaWork) * 100}%; background: linear-gradient(90deg, #3B82F6, #06B6D4);">
                  <span class="bar-text">${player.staminaWork}/${maxStaminaWork}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="map-stat">
            <div class="bar-container">
              <div class="bar-label">HE</div>
              <div class="bar-wrapper">
                <div class="bar-fill" style="width: ${(player.staminaStudy / maxStaminaStudy) * 100}%; background: linear-gradient(90deg, #A855F7, #EC4899);">
                  <span class="bar-text">${player.staminaStudy}/${maxStaminaStudy}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="map-content">
          <div class="map-canvas" id="map-canvas"></div>

          ${state.zone && state.zone !== 'hub' ? `
            <div class="zone-panel">
              <div class="zone-title">${ZONES[state.zone]?.name}</div>
              <div class="zone-info">${ZONES[state.zone]?.desc}</div>
              <div class="zone-actions">
                <button class="btn btn-primary" id="start-work-btn">🔨 TRABALHAR</button>
                <button class="btn btn-secondary" id="start-study-btn">📚 ESTUDAR</button>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  static renderBattleScreen(state) {
    const player = state.player;
    const enemy = state.enemy;
    const maxHp = GameFormulas.calcMaxHp(player);

    return `
      <div class="battle-screen">
        <div class="battle-header">
          <button class="btn btn-secondary btn-small" id="battle-exit-btn">MAPA</button>
          <div style="text-align: center;">
            <strong>${state.currentOS?.type?.toUpperCase()}</strong><br>
            <small>Dificuldade: ${state.currentOS?.difficulty}</small>
          </div>
          <div style="text-align: right;">
            <strong>${player.name}</strong><br>
            <small>Lv ${player.level}</small>
          </div>
        </div>

        <div class="battle-content">
          <div class="battle-vs">
            <div class="battle-entity">
              <div class="battle-entity-icon">👨‍🔧</div>
              <div class="battle-entity-name">${player.name}</div>
              <div class="battle-entity-hp">${player.currentHp}/${maxHp} HP</div>
            </div>
            <div style="font-size: 20px; color: var(--color-text-muted);">VS</div>
            <div class="battle-entity">
              <div class="battle-entity-icon">${enemy?.icon}</div>
              <div class="battle-entity-name">${enemy?.name}</div>
              <div class="battle-entity-hp">${enemy?.currentHp}/${enemy?.hp} HP</div>
            </div>
          </div>

          <div class="battle-log" id="battle-log">
            ${state.battleLog.map(entry => `<div class="log-entry">${entry}</div>`).join('')}
          </div>

          <div class="battle-actions">
            <button class="action-btn" data-action="attack">
              <div class="action-icon">🔨</div>
              <div>REPARAR</div>
            </button>
            <button class="action-btn" data-action="defend">
              <div class="action-icon">🛡️</div>
              <div>PROTEGER</div>
            </button>
            <button class="action-btn" data-action="special">
              <div class="action-icon">⚡</div>
              <div>ESPECIAL</div>
            </button>
            <button class="action-btn" id="auto-battle-btn">
              <div class="action-icon">🤖</div>
              <div>AUTO</div>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  static renderLearningScreen(state) {
    const player = state.player;
    const skillId = state.studySkill;
    const skill = MAINT_SKILLS[skillId];

    return `
      <div class="learning-screen">
        <div class="learning-header">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h2 style="color: var(--color-text);">📚 Sala de Estudo</h2>
              <p style="color: var(--color-text-muted); font-size: 12px;">${skill?.name}</p>
            </div>
            <button class="btn btn-secondary btn-small" id="exit-study-btn">SAIR</button>
          </div>
        </div>

        <div class="learning-content">
          <div class="learning-card">
            <div class="learning-skill">
              <div>
                <div class="learning-skill-name">${skill?.name}</div>
                <div class="learning-skill-level">Nível ${player.maintSkills[skillId]}</div>
              </div>
              <div style="font-size: 24px;">${skill?.icon}</div>
            </div>

            <div class="bar-container">
              <div class="bar-label">EXP</div>
              <div class="bar-wrapper">
                <div class="bar-fill" style="width: ${(player.maintSkillExp[skillId] / GameFormulas.skillExpNeeded(player.maintSkills[skillId])) * 100}%">
                  <span class="bar-text">${player.maintSkillExp[skillId]}/${GameFormulas.skillExpNeeded(player.maintSkills[skillId])}</span>
                </div>
              </div>
            </div>

            <p style="color: var(--color-text-muted); font-size: 12px; margin-top: 12px; line-height: 1.6;">
              ${skill?.desc}
            </p>

            <button class="btn btn-primary btn-block" id="start-quiz-btn" style="margin-top: 12px;">
              📝 COMEÇAR QUIZ
            </button>
          </div>
        </div>
      </div>
    `;
  }

  static renderDeadScreen(state) {
    const player = state.player;

    return `
      <div class="dead-screen">
        <div class="dead-icon">💀</div>
        <div class="dead-title">GAME OVER</div>
        <div class="dead-message">
          Você foi derrotado. Seus pontos foram salvos.
        </div>

        <div class="dead-stats">
          <div class="dead-stat">
            <span class="dead-stat-label">Nível:</span>
            <span class="dead-stat-value">${player.level}</span>
          </div>
          <div class="dead-stat">
            <span class="dead-stat-label">Total de OS:</span>
            <span class="dead-stat-value">${player.totalOs}</span>
          </div>
          <div class="dead-stat">
            <span class="dead-stat-label">Estrelas:</span>
            <span class="dead-stat-value">${player.totalStars}</span>
          </div>
          <div class="dead-stat">
            <span class="dead-stat-label">Zeny:</span>
            <span class="dead-stat-value">${GameFormulas.formatNumber(player.zeny)}</span>
          </div>
        </div>

        <div class="dead-buttons">
          <button class="btn btn-primary" id="restart-btn">🔄 REINICIAR</button>
          <button class="btn btn-secondary" id="menu-btn">🏠 MENU</button>
        </div>
      </div>
    `;
  }

  static render(state) {
    const container = document.getElementById('screen-container');
    if (!container) return;

    let html = '';

    switch (state.screen) {
      case 'login':
        html = this.renderLoginScreen(state);
        break;
      case 'title':
        html = this.renderTitleScreen(state);
        break;
      case 'create':
        html = this.renderCreateScreen(state);
        break;
      case 'map':
        html = this.renderMapScreen(state);
        break;
      case 'battle':
        html = this.renderBattleScreen(state);
        break;
      case 'learning':
        html = this.renderLearningScreen(state);
        break;
      case 'dead':
        html = this.renderDeadScreen(state);
        break;
    }

    container.innerHTML = html;
    this.attachEventListeners(state);
  }

  static attachEventListeners(state) {
    // Login screen
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        const errorDiv = document.getElementById('login-error');
        const result = gameState.login(username, password);
        if (result.success) {
          errorDiv.classList.add('hidden');
          gameState.setState({ screen: 'title' });
        } else {
          errorDiv.textContent = result.error;
          errorDiv.classList.remove('hidden');
        }
      });
    }

    // Register button
    const registerBtn = document.getElementById('register-btn');
    if (registerBtn) {
      registerBtn.addEventListener('click', () => {
        const username = document.getElementById('register-username').value;
        const password = document.getElementById('register-password').value;
        const confirm = document.getElementById('register-password-confirm').value;
        const errorDiv = document.getElementById('login-error');
        
        if (password !== confirm) {
          errorDiv.textContent = 'Senhas não conferem';
          errorDiv.classList.remove('hidden');
          return;
        }
        const result = gameState.createAccount(username, password);
        if (result.success) {
          // Automatically log in after creating the account
          gameState.login(username, password);
          errorDiv.classList.add('hidden');
          gameState.setState({ screen: 'title' });
        } else {
          errorDiv.textContent = result.error;
          errorDiv.style.color = 'var(--color-error)';
          errorDiv.classList.remove('hidden');
        }
      });
    }

    // Password visibility toggle
    document.querySelectorAll('.password-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetId = e.currentTarget.dataset.target;
        const input = document.getElementById(targetId);
        if (input) {
          if (input.type === 'password') {
            input.type = 'text';
            e.currentTarget.textContent = '🙈';
          } else {
            input.type = 'password';
            e.currentTarget.textContent = '👁️';
          }
        }
      });
    });

    // Block spaces in inputs
    const noSpaceInputs = ['login-username', 'login-password', 'register-username', 'register-password', 'register-password-confirm'];
    noSpaceInputs.forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('keydown', (e) => {
          if (e.key === ' ') {
            e.preventDefault();
          }
        });
        input.addEventListener('input', (e) => {
          if (e.target.value.includes(' ')) {
            e.target.value = e.target.value.replace(/\s/g, '');
          }
        });
      }
    });

    // Tab switching
    document.querySelectorAll('.login-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.login-tab-content').forEach(c => c.classList.add('hidden'));
        e.target.classList.add('active');
        document.getElementById(e.target.dataset.tab + '-tab').classList.remove('hidden');
      });
    });

    // Title screen
    const newGameBtn = document.getElementById('new-game-btn');
    if (newGameBtn) {
      newGameBtn.addEventListener('click', () => {
        gameState.setState({ screen: 'create' });
      });
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        gameState.logout();
      });
    }

    const saveItems = document.querySelectorAll('.save-item');
    saveItems.forEach(item => {
      item.addEventListener('click', () => {
        const username = item.dataset.username;
        gameState.loadGame(username);
      });
    });

    // Create screen
    const createBtn = document.getElementById('create-btn');
    if (createBtn) {
      createBtn.addEventListener('click', () => {
        const name = document.getElementById('create-name').value;
        const genderBtn = document.querySelector('.gender-btn.active');
        const classBtn = document.querySelector('.class-btn.active');
        const errorDiv = document.getElementById('create-error');
        
        if (!name) {
          errorDiv.textContent = 'Digite um nome para o seu técnico';
          errorDiv.classList.remove('hidden');
          return;
        }

        if (!genderBtn || !classBtn) {
          errorDiv.textContent = 'Selecione o gênero e a especialidade';
          errorDiv.classList.remove('hidden');
          return;
        }

        const gender = genderBtn.dataset.gender;
        const classId = classBtn.dataset.class;
        
        errorDiv.classList.add('hidden');
        gameState.startNewGame(name, gender, classId);
      });
    }

    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        gameState.setState({ screen: 'title' });
      });
    }

    // Gender/Class selection
    document.querySelectorAll('.gender-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
      });
    });

    document.querySelectorAll('.class-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.class-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
      });
    });

    // Map screen
    const startWorkBtn = document.getElementById('start-work-btn');
    if (startWorkBtn) {
      startWorkBtn.addEventListener('click', () => {
        gameState.startBattle(state.zone);
      });
    }

    const startStudyBtn = document.getElementById('start-study-btn');
    if (startStudyBtn) {
      startStudyBtn.addEventListener('click', () => {
        const skillId = ZONES[state.zone].skillId;
        gameState.startLearning(skillId);
      });
    }

    // Battle screen
    const battleExitBtn = document.getElementById('battle-exit-btn');
    if (battleExitBtn) {
      battleExitBtn.addEventListener('click', () => {
        gameState.setState({ screen: 'map' });
      });
    }

    document.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.action;
        if (action) {
          gameState.executeBattleAction(action);
        }
      });
    });

    const autoBattleBtn = document.getElementById('auto-battle-btn');
    if (autoBattleBtn) {
      autoBattleBtn.addEventListener('click', () => {
        gameState.toggleAutoBattle();
      });
    }

    // Learning screen
    const exitStudyBtn = document.getElementById('exit-study-btn');
    if (exitStudyBtn) {
      exitStudyBtn.addEventListener('click', () => {
        gameState.setState({ screen: 'map' });
      });
    }

    const startQuizBtn = document.getElementById('start-quiz-btn');
    if (startQuizBtn) {
      startQuizBtn.addEventListener('click', () => {
        gameState.startQuiz(state.studySkill);
      });
    }

    // Dead screen
    const restartBtn = document.getElementById('restart-btn');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        gameState.setState({ screen: 'create' });
      });
    }

    const menuBtn = document.getElementById('menu-btn');
    if (menuBtn) {
      menuBtn.addEventListener('click', () => {
        gameState.setState({ screen: 'title' });
      });
    }
  }
}
