// ============================================================
// TECMASTER OS — Formulas
// ============================================================

class GameFormulas {
  static calcMaxHp(player) {
    return 100 + (player.level * 10) + (player.vit * 5);
  }

  static calcMaxMp(player) {
    return 50 + (player.level * 5) + (player.intel * 5);
  }

  static calcMaxStaminaWork(player) {
    return 50 + (player.level * 5) + (player.str * 2);
  }

  static calcMaxStaminaStudy(player) {
    return 50 + (player.level * 5) + (player.intel * 2);
  }

  static formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  static expNeeded(level) {
    return level * 1000;
  }

  static skillExpNeeded(level) {
    return level * 100;
  }

  static calcReputation(player) {
    return player.totalStars * 10;
  }

  static getRepTier(player) {
    const rep = this.calcReputation(player);
    if (rep >= 1000) return 'Mestre Industrial';
    if (rep >= 500) return 'Especialista';
    if (rep >= 200) return 'Técnico Pleno';
    if (rep >= 50) return 'Técnico Júnior';
    return 'Aprendiz';
  }

  static calcPlayerDmg(player) {
    return 10 + (player.str * 2) + (player.dex * 1);
  }

  static calcPlayerMatk(player) {
    return 5 + (player.intel * 3);
  }

  static calcPlayerDef(player) {
    return 5 + (player.vit * 2) + (player.agi * 1);
  }

  static calcPlayerSpd(player) {
    return 10 + (player.agi * 2);
  }

  static calcFailChance(skillLevel) {
    return Math.max(0.05, 0.5 - (skillLevel * 0.05));
  }

  static generateOS(zone, player) {
    const types = typeof OS_TYPES !== 'undefined' ? Object.keys(OS_TYPES) : ['preventiva', 'corretiva', 'preditiva', 'inspecao'];
    const type = types[Math.floor(Math.random() * types.length)];
    const difficulty = Math.floor(Math.random() * 5) + 1;
    const deadline = Date.now() + (difficulty * 60 * 1000);
    return {
      type,
      difficulty,
      deadline,
      skill: zone.skillId || 'mecanica',
      id: Math.random().toString(36).substr(2, 9)
    };
  }

  static calcAccidentChance(skillLevel) {
    return Math.max(0.01, 0.1 - (skillLevel * 0.01));
  }

  static calcAccidentDmg(player, skillLevel) {
    return Math.floor(20 + (player.level * 2) - (skillLevel * 2));
  }

  static calcMachineDmg(enemy, skillLevel) {
    const baseDmg = enemy.dmg || 10;
    return Math.floor(baseDmg * (1.5 - (skillLevel * 0.05)));
  }

  static calcOSRating(player, enemy, timeLeft, difficulty) {
    let stars = 3;
    if (timeLeft > 0) stars++;
    if (player.currentHp > (this.calcMaxHp(player) * 0.8)) stars++;
    return Math.min(5, stars);
  }

  static calcOSPay(type, difficulty, stars) {
    const basePay = (typeof OS_TYPES !== 'undefined' && OS_TYPES[type]) ? OS_TYPES[type].pay : 100;
    return Math.floor(basePay * difficulty * (stars / 3));
  }

  static createNewPlayer(name, gender, classId) {
    if (!CLASSES || !CLASSES[classId]) {
      console.error('Class not found:', classId);
      return null;
    }
    const baseStats = CLASSES[classId].baseStats;
    const player = {
      name,
      gender,
      classId,
      level: 1,
      exp: 0,
      zeny: 1000,
      str: baseStats.str,
      vit: baseStats.vit,
      agi: baseStats.agi,
      dex: baseStats.dex,
      intel: baseStats.intel,
      totalOs: 0,
      totalStars: 0,
      maintSkills: {},
      maintSkillExp: {},
      skillQuizBank: {},
      wrongAnswers: [],
      equipment: {
        head: null,
        body: null,
        tool: null,
        accessory: null
      },
      osCount: {
        preventiva: 0,
        corretiva: 0,
        preditiva: 0,
        inspecao: 0
      }
    };

    if (typeof MAINT_SKILLS !== 'undefined') {
      Object.keys(MAINT_SKILLS).forEach(skillId => {
        player.maintSkills[skillId] = 1;
        player.maintSkillExp[skillId] = 0;
        player.skillQuizBank[skillId] = 0;
      });
    }

    player.currentHp = this.calcMaxHp(player);
    player.currentMp = this.calcMaxMp(player);
    player.staminaWork = this.calcMaxStaminaWork(player);
    player.staminaStudy = this.calcMaxStaminaStudy(player);

    return player;
  }
}
