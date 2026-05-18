// ============================================================
// TECMASTER OS — Game State Management
// ============================================================

class GameState {
  constructor() {
    this.state = {
      screen: 'login',
      player: null,
      enemy: null,
      currentOS: null,
      zone: 'hub',
      pos: { x: 330, y: 260 },
      autoBattle: false,
      battleLog: [],
      status: { defBuff: 0, atkBuff: 0, shield: false, evade: false, freeze: 0 },
      busy: false,
      popup: null,
      showStats: false,
      showShop: false,
      showProfile: false,
      learningZone: null,
      studySkill: null,
      showRating: false,
      lastRating: null,
      showNR12: false,
      showReview: false,
      activeQuiz: null,
      accounts: [],
      currentAccount: null,
      session: null,
    };

    this.listeners = [];
    this.loadAccounts();
  }

  // ============================================================
  // STATE MANAGEMENT
  // ============================================================

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  setState(partial) {
    this.state = { ...this.state, ...partial };
    this.notifyListeners();
  }

  notifyListeners() {
    this.listeners.forEach(listener => listener(this.state));
  }

  // ============================================================
  // PERSISTENCE
  // ============================================================

  loadAccounts() {
    const saved = localStorage.getItem('tecmaster_accounts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          this.state.accounts = parsed;
        }
      } catch (e) {
        console.error('Error loading accounts:', e);
      }
    }
  }

  saveAccounts() {
    localStorage.setItem('tecmaster_accounts', JSON.stringify(this.state.accounts));
  }

  savePlayer(player) {
    if (!this.state.currentAccount) return;

    const accountIdx = this.state.accounts.findIndex(a => a && a.username === this.state.currentAccount);
    if (accountIdx !== -1) {
      this.state.accounts[accountIdx].save = {
        player,
        zone: this.state.zone,
        pos: this.state.pos,
        timestamp: Date.now(),
      };
      this.saveAccounts();
    }
  }

  loadPlayer(username) {
    const account = this.state.accounts.find(a => a && a.username === username);
    if (account && account.save) {
      return account.save.player;
    }
    return null;
  }

  // ============================================================
  // ACCOUNT MANAGEMENT
  // ============================================================

  createAccount(username, password) {
    if (!username || !password) {
      return { success: false, error: 'Preencha todos os campos' };
    }
    
    username = username.replace(/\s/g, '');
    password = password.replace(/\s/g, '');

    if (this.state.accounts.find(a => a && a.username && a.username.toLowerCase() === username.toLowerCase())) {
      return { success: false, error: 'Usuário já existe' };
    }

    const account = {
      username,
      password: this.hashPassword(password),
      save: null,
      createdAt: Date.now(),
    };

    this.state.accounts.push(account);
    this.saveAccounts();
    return { success: true };
  }

  login(username, password) {
    if (!username || !password) {
      return { success: false, error: 'Preencha todos os campos' };
    }
    
    username = username.replace(/\s/g, '');
    password = password.replace(/\s/g, '');

    const account = this.state.accounts.find(a => a && a.username && a.username.toLowerCase() === username.toLowerCase());
    if (!account) {
      return { success: false, error: 'Usuário não encontrado' };
    }

    // Check both hashed password and plaintext (for backward compatibility with older saves)
    if (this.hashPassword(password) !== account.password && password !== account.password) {
      return { success: false, error: 'Senha incorreta' };
    }

    this.state.currentAccount = account.username;
    this.state.session = { username: account.username, loginAt: Date.now() };
    return { success: true };
  }

  logout() {
    this.state.currentAccount = null;
    this.state.session = null;
    this.state.player = null;
    this.setState({ screen: 'login' });
  }

  hashPassword(password) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  // ============================================================
  // GAME ACTIONS
  // ============================================================

  startNewGame(name, gender, classId) {
    const player = GameFormulas.createNewPlayer(name, gender, classId);
    if (!player) return;
    
    this.setState({
      player,
      screen: 'map',
      zone: 'hub',
    });
    this.savePlayer(player);
  }

  loadGame(username) {
    const player = this.loadPlayer(username);
    if (player) {
      this.setState({
        player,
        screen: 'map',
      });
    }
  }

  toggleAutoBattle() {
    const autoBattle = !this.state.autoBattle;
    this.setState({ autoBattle });
    if (autoBattle) {
      this.autoBattleInterval = setInterval(() => {
        if (this.state.autoBattle && this.state.screen === 'battle') {
          this.executeBattleAction('attack');
        } else {
          clearInterval(this.autoBattleInterval);
        }
      }, 1000);
    } else {
      clearInterval(this.autoBattleInterval);
    }
  }

  // ============================================================
  // BATTLE ACTIONS
  // ============================================================

  startBattle(zone) {

    const os = GameFormulas.generateOS(ZONES[zone], this.state.player);

    this.setState({
      screen: 'battle',
      zone,
      enemy: { ...machine, currentHp: machine.hp },
      currentOS: os,
      battleLog: [],
    });
  }

  executeBattleAction(action) {
    if (!this.state.player || !this.state.enemy || !this.state.currentOS) return;

    if (this.state.autoBattle && action !== 'auto') {
      this.setState({ autoBattle: false });
    }
    
    const player = this.state.player;
    const enemy = this.state.enemy;
    const log = [...this.state.battleLog];
    const skillLevel = player.maintSkills[this.state.currentOS.skill] || 1;

    let playerDmg = 0;
    let enemyDmg = 0;
    let log_entry = '';

    switch (action) {
      case 'attack':
        const failChance = GameFormulas.calcFailChance(skillLevel);
        if (Math.random() < failChance) {
          log_entry = `[FALHA] Tentativa de reparo falhou!`;
          log.push(log_entry);
        } else {
          playerDmg = GameFormulas.calcPlayerDmg(player);
          enemy.currentHp -= playerDmg;
          log_entry = `[ATAQUE] Dano: ${playerDmg}`;
          log.push(log_entry);
        }
        break;

      case 'defend':
        const defAmount = GameFormulas.calcPlayerDef(player);
        log_entry = `[DEFESA] Proteção ativada: ${defAmount}`;
        log.push(log_entry);
        this.state.status.defBuff = defAmount;
        break;

      case 'special':
        playerDmg = Math.floor(GameFormulas.calcPlayerDmg(player) * 1.5);
        enemy.currentHp -= playerDmg;
        log_entry = `[ESPECIAL] Dano crítico: ${playerDmg}`;
        log.push(log_entry);
        break;
    }

    // Enemy counter-attack
    if (enemy.currentHp > 0 && Math.random() > 0.3) {
      const accidentChance = GameFormulas.calcAccidentChance(skillLevel);
      if (Math.random() < accidentChance) {
        const accDmg = GameFormulas.calcAccidentDmg(player, skillLevel);
        player.currentHp -= accDmg;
        log_entry = `[ACIDENTE] Dano recebido: ${accDmg}`;
        log.push(log_entry);
        this.showAccidentFeedback();
      } else {
        enemyDmg = GameFormulas.calcMachineDmg(enemy, skillLevel);
        const defReduction = this.state.status.defBuff || 0;
        enemyDmg = Math.max(1, enemyDmg - defReduction);
        player.currentHp -= enemyDmg;
        log_entry = `[MÁQUINA] Dano recebido: ${enemyDmg}`;
        log.push(log_entry);
      }
    }

    // Check if battle ended
    if (enemy.currentHp <= 0) {
      this.endBattle(true);
    } else if (player.currentHp <= 0) {
      this.endBattle(false);
    }

    this.setState({
      player: { ...player },
      enemy: { ...enemy },
      battleLog: log,
    });

    this.savePlayer(player);
  }

  endBattle(victory) {
    if (!this.state.player || !this.state.currentOS) return;

    const player = this.state.player;

    if (victory) {
      const stars = GameFormulas.calcOSRating(
        player,
        this.state.enemy,
        this.state.currentOS.deadline - Date.now(),
        this.state.currentOS.difficulty
      );

      const pay = GameFormulas.calcOSPay(
        this.state.currentOS.type,
        this.state.currentOS.difficulty,
        stars
      );

      player.zeny += pay;
      player.totalStars += stars;
      player.totalOs += 1;
      player.osCount[this.state.currentOS.type] += 1;

      const skillExp = 50 + this.state.currentOS.difficulty * 10;
      player.maintSkillExp[this.state.currentOS.skill] += skillExp;
      player.exp += 100 + this.state.currentOS.difficulty * 20;

      this.setState({
        showRating: true,
        lastRating: { stars, msg: `Parabéns! ${stars} ⭐`, pay },
      });
    } else {
      this.setState({ screen: 'dead' });
    }

    this.savePlayer(player);
  }

  // ============================================================
  // LEARNING ACTIONS
  // ============================================================

  startLearning(skillId) {
    this.setState({
      screen: 'learning',
      learningZone: ZONES.estudo,
      studySkill: skillId,
    });
  }

  startQuiz(skillId) {
    const questions = QUIZ_QUESTIONS.filter(q => q.skill === skillId);
    if (questions.length === 0) return;
    
    const question = questions[Math.floor(Math.random() * questions.length)];
    this.setState({
      activeQuiz: { skillId, question }
    });
  }

  answerQuiz(isCorrect) {
    if (!this.state.player || !this.state.activeQuiz) return;

    const player = this.state.player;
    const skillId = this.state.activeQuiz.skillId;

    if (isCorrect) {
      player.maintSkillExp[skillId] += 30;
      player.exp += 50;
      player.skillQuizBank[skillId] += 1;
      this.showQuizFeedback(true);
    } else {
      player.wrongAnswers.push(this.state.activeQuiz.question.q);
      this.showQuizFeedback(false);
    }

    // Check for level up
    const skillLevel = player.maintSkills[skillId];
    const expNeeded = GameFormulas.skillExpNeeded(skillLevel);
    if (player.maintSkillExp[skillId] >= expNeeded) {
      player.maintSkills[skillId] += 1;
      player.maintSkillExp[skillId] = 0;
      this.showLevelUpFeedback();
    }

    this.setState({
      player: { ...player },
      activeQuiz: null,
    });

    this.savePlayer(player);
  }

  // ============================================================
  // SHOP ACTIONS
  // ============================================================

  buyItem(itemId) {
    if (!this.state.player) return;

    const player = this.state.player;
    const item = SHOP_ITEMS.find(i => i.id === itemId);

    if (!item) return;
    if (player.zeny < item.price) {
      return { success: false, error: 'Zeny insuficiente' };
    }

    player.zeny -= item.price;

    if (item.type === 'consumable') {
      if (item.effect === 'recover_stamina_work') {
        player.staminaWork = Math.min(player.maxStaminaWork, player.staminaWork + item.value);
      } else if (item.effect === 'recover_stamina_study') {
        player.staminaStudy = Math.min(player.maxStaminaStudy, player.staminaStudy + item.value);
      }
    } else {
      // Equipment
      player.equipment[item.type] = item;
      if (item.statBonus) {
        Object.keys(item.statBonus).forEach(stat => {
          player[stat] += item.statBonus[stat];
        });
      }
    }

    this.setState({ player: { ...player } });
    this.savePlayer(player);
    return { success: true };
  }

  // ============================================================
  // FEEDBACK ANIMATIONS
  // ============================================================

  showLevelUpFeedback() {
    const feedback = document.getElementById('level-up-feedback');
    if (feedback) {
      feedback.classList.remove('hidden');
      setTimeout(() => feedback.classList.add('hidden'), 2000);
    }
  }

  showAccidentFeedback() {
    const feedback = document.getElementById('accident-feedback');
    if (feedback) {
      feedback.classList.remove('hidden');
      setTimeout(() => feedback.classList.add('hidden'), 1000);
    }
  }

  showQuizFeedback(isCorrect) {
    const feedback = document.getElementById('quiz-feedback');
    if (feedback) {
      feedback.classList.remove('hidden');
      feedback.dataset.correct = isCorrect;
      setTimeout(() => feedback.classList.add('hidden'), 1500);
    }
  }
}

// Global game state instance
const gameState = new GameState();
