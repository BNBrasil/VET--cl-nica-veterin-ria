// ============================================================
// TECMASTER OS — Game Data
// ============================================================

const CLASSES = {
  eletricista: {
    id: 'eletricista',
    title: 'Eletricista',
    icon: '⚡',
    color: '#FFD700',
    desc: 'Especialista em sistemas elétricos e controle',
    baseStats: { str: 8, vit: 8, agi: 10, dex: 12, intel: 12 },
  },
  mecanico: {
    id: 'mecanico',
    title: 'Mecânico',
    icon: '🔧',
    color: '#FF6347',
    desc: 'Mestre em manutenção mecânica e estruturas',
    baseStats: { str: 14, vit: 12, agi: 8, dex: 10, intel: 8 },
  },
  eletronico: {
    id: 'eletronico',
    title: 'Eletrônico',
    icon: '🔌',
    color: '#9370DB',
    desc: 'Especialista em eletrônica e circuitos',
    baseStats: { str: 8, vit: 8, agi: 10, dex: 14, intel: 14 },
  },
  hidraulico: {
    id: 'hidraulico',
    title: 'Hidráulico',
    icon: '💧',
    color: '#00CED1',
    desc: 'Especialista em sistemas hidráulicos',
    baseStats: { str: 12, vit: 12, agi: 8, dex: 10, intel: 10 },
  },
  automacao: {
    id: 'automacao',
    title: 'Automação',
    icon: '🤖',
    color: '#32CD32',
    desc: 'Especialista em automação e programação',
    baseStats: { str: 8, vit: 8, agi: 10, dex: 12, intel: 16 },
  },
  polivalente: {
    id: 'polivalente',
    title: 'Polivalente',
    icon: '🛠️',
    color: '#FF8C00',
    desc: 'Técnico versátil em todas as áreas',
    baseStats: { str: 10, vit: 10, agi: 10, dex: 10, intel: 10 },
  },
};

const MAINT_SKILLS = {
  eletrica: {
    id: 'eletrica',
    name: 'Elétrica',
    icon: '⚡',
    color: '#FFD700',
    desc: 'Sistemas elétricos, circuitos e controle',
  },
  hidraulica: {
    id: 'hidraulica',
    name: 'Hidráulica',
    icon: '💧',
    color: '#00CED1',
    desc: 'Sistemas hidráulicos e pneumáticos',
  },
  mecanica: {
    id: 'mecanica',
    name: 'Mecânica',
    icon: '⚙️',
    color: '#FF6347',
    desc: 'Manutenção mecânica e estruturas',
  },
  eletronica: {
    id: 'eletronica',
    name: 'Eletrônica',
    icon: '🔌',
    color: '#9370DB',
    desc: 'Eletrônica e componentes',
  },
  automacao: {
    id: 'automacao',
    name: 'Automação',
    icon: '🤖',
    color: '#32CD32',
    desc: 'Automação e programação',
  },
  nr12: {
    id: 'nr12',
    name: 'NR-12',
    icon: '⚠️',
    color: '#FF8C00',
    desc: 'Segurança em máquinas e equipamentos',
  },
};

const ZONES = {
  hub: {
    id: 'hub',
    name: 'Hub Central',
    icon: '🏭',
    type: 'hub',
    desc: 'Centro de operações - Escolha sua zona de trabalho',
    x: 330,
    y: 260,
  },
  zona1: {
    id: 'zona1',
    name: 'Zona 1 — Elétrica',
    icon: '⚡',
    type: 'work',
    desc: 'Painéis de controle e sistemas elétricos',
    x: 150,
    y: 150,
    skillId: 'eletrica',
    machines: ['painel', 'motor', 'transformador', 'gerador'],
  },
  zona2: {
    id: 'zona2',
    name: 'Zona 2 — Mecânica',
    icon: '⚙️',
    type: 'work',
    desc: 'Máquinas e equipamentos mecânicos',
    x: 510,
    y: 150,
    skillId: 'mecanica',
    machines: ['prensa', 'torno', 'bomba', 'esteira'],
  },
  zona3: {
    id: 'zona3',
    name: 'Zona 3 — Hidráulica',
    icon: '💧',
    type: 'work',
    desc: 'Sistemas hidráulicos e pneumáticos',
    x: 150,
    y: 370,
    skillId: 'hidraulica',
    machines: ['cilindro', 'valvula', 'compressor', 'atuador'],
  },
  zona4: {
    id: 'zona4',
    name: 'Zona 4 — Eletrônica',
    icon: '🔌',
    type: 'work',
    desc: 'Circuitos e componentes eletrônicos',
    x: 510,
    y: 370,
    skillId: 'eletronica',
    machines: ['placa', 'sensor', 'inversor', 'ihm'],
  },
  estudo: {
    id: 'estudo',
    name: 'Sala de Estudo',
    icon: '📚',
    type: 'study',
    desc: 'Aprimore suas habilidades técnicas',
    x: 330,
    y: 500,
  },
};

const MACHINES = {
  painel: { id: 'painel', name: 'Painel de Controle', icon: '📊', skill: 'eletrica', hp: 60, dmg: 8 },
  motor: { id: 'motor', name: 'Motor Elétrico', icon: '⚡', skill: 'eletrica', hp: 80, dmg: 12 },
  transformador: { id: 'transformador', name: 'Transformador', icon: '🔌', skill: 'eletrica', hp: 100, dmg: 15 },
  gerador: { id: 'gerador', name: 'Gerador Diesel', icon: '🔋', skill: 'eletrica', hp: 150, dmg: 20 },
  prensa: { id: 'prensa', name: 'Prensa Hidráulica', icon: '⚙️', skill: 'mecanica', hp: 120, dmg: 18 },
  torno: { id: 'torno', name: 'Torno CNC', icon: '🔧', skill: 'mecanica', hp: 100, dmg: 14 },
  bomba: { id: 'bomba', name: 'Bomba Centrífuga', icon: '💧', skill: 'mecanica', hp: 90, dmg: 10 },
  esteira: { id: 'esteira', name: 'Esteira Transportadora', icon: '🛤️', skill: 'mecanica', hp: 70, dmg: 9 },
  cilindro: { id: 'cilindro', name: 'Cilindro Hidráulico', icon: '💧', skill: 'hidraulica', hp: 70, dmg: 11 },
  valvula: { id: 'valvula', name: 'Válvula Direcional', icon: '🔀', skill: 'hidraulica', hp: 50, dmg: 8 },
  compressor: { id: 'compressor', name: 'Compressor', icon: '💨', skill: 'hidraulica', hp: 110, dmg: 16 },
  atuador: { id: 'atuador', name: 'Atuador Pneumático', icon: '🦾', skill: 'hidraulica', hp: 65, dmg: 10 },
  placa: { id: 'placa', name: 'Placa Eletrônica', icon: '🔌', skill: 'eletronica', hp: 40, dmg: 6 },
  sensor: { id: 'sensor', name: 'Sensor Inteligente', icon: '📡', skill: 'eletronica', hp: 55, dmg: 9 },
  inversor: { id: 'inversor', name: 'Inversor de Frequência', icon: '⚡', skill: 'eletronica', hp: 85, dmg: 13 },
  ihm: { id: 'ihm', name: 'Interface IHM', icon: '🖥️', skill: 'eletronica', hp: 60, dmg: 7 },
};

const OS_TYPES = {
  instalacao: { id: 'instalacao', name: 'Instalação', icon: '🔨', risk: 'medio', pay: 150 },
  revisao: { id: 'revisao', name: 'Revisão', icon: '🔍', risk: 'baixo', pay: 100 },
  preventiva: { id: 'preventiva', name: 'Preventiva', icon: '🛡️', risk: 'baixo', pay: 120 },
  corretiva: { id: 'corretiva', name: 'Corretiva', icon: '🚨', risk: 'alto', pay: 200 },
  nr12: { id: 'nr12', name: 'NR-12', icon: '⚠️', risk: 'critico', pay: 250 },
};

const SHOP_ITEMS = [
  // Consumíveis
  { id: 'isot', name: 'Isotônico', icon: '🥤', type: 'consumable', tier: 'basic', price: 50, desc: 'Recupera 20 de DF', effect: 'recover_stamina_work', value: 20 },
  { id: 'cafe', name: 'Café Expresso', icon: '☕', type: 'consumable', tier: 'basic', price: 30, desc: 'Recupera 15 de HE', effect: 'recover_stamina_study', value: 15 },
  { id: 'energy', name: 'Energético', icon: '⚡', type: 'consumable', tier: 'advanced', price: 100, desc: 'Recupera 50 de DF', effect: 'recover_stamina_work', value: 50 },
  { id: 'vitamina', name: 'Vitamina', icon: '💊', type: 'consumable', tier: 'advanced', price: 80, desc: 'Recupera 40 de HE', effect: 'recover_stamina_study', value: 40 },
  { id: 'marmita', name: 'Marmita Reforçada', icon: '🍱', type: 'consumable', tier: 'expert', price: 200, desc: 'Recupera 100 de DF', effect: 'recover_stamina_work', value: 100 },

  // Capacetes
  { id: 'capacete_basico', name: 'Capacete Básico', icon: '🪖', type: 'helmet', tier: 'basic', price: 200, desc: '+5 VIT', statBonus: { vit: 5 } },
  { id: 'capacete_industrial', name: 'Capacete Industrial', icon: '⛑️', type: 'helmet', tier: 'advanced', price: 500, desc: '+10 VIT', statBonus: { vit: 10 } },
  { id: 'capacete_expert', name: 'Capacete Profissional', icon: '🛡️', type: 'helmet', tier: 'expert', price: 1200, desc: '+15 VIT, +5 STR', statBonus: { vit: 15, str: 5 } },
  { id: 'capacete_mestre', name: 'Capacete de Mestre', icon: '👑', type: 'helmet', tier: 'master', price: 3000, desc: '+25 VIT, +10 STR', statBonus: { vit: 25, str: 10 } },

  // Botas
  { id: 'bota_basica', name: 'Bota de Segurança', icon: '👢', type: 'boots', tier: 'basic', price: 150, desc: '+5 AGI', statBonus: { agi: 5 } },
  { id: 'bota_industrial', name: 'Bota Industrial', icon: '🥾', type: 'boots', tier: 'advanced', price: 400, desc: '+10 AGI', statBonus: { agi: 10 } },
  { id: 'bota_expert', name: 'Bota Profissional', icon: '👞', type: 'boots', tier: 'expert', price: 1000, desc: '+15 AGI, +5 DEX', statBonus: { agi: 15, dex: 5 } },
  { id: 'bota_mestre', name: 'Bota de Mestre', icon: '🦿', type: 'boots', tier: 'master', price: 2500, desc: '+25 AGI, +10 DEX', statBonus: { agi: 25, dex: 10 } },

  // Luvas
  { id: 'luva_basica', name: 'Luva de Algodão', icon: '🧤', type: 'gloves', tier: 'basic', price: 100, desc: '+5 DEX', statBonus: { dex: 5 } },
  { id: 'luva_industrial', name: 'Luva de Couro', icon: '🧤', type: 'gloves', tier: 'advanced', price: 300, desc: '+10 DEX', statBonus: { dex: 10 } },
  { id: 'luva_expert', name: 'Luva Profissional', icon: '🧤', type: 'gloves', tier: 'expert', price: 800, desc: '+15 DEX, +5 AGI', statBonus: { dex: 15, agi: 5 } },
  { id: 'luva_mestre', name: 'Luva de Mestre', icon: '🦾', type: 'gloves', tier: 'master', price: 2000, desc: '+25 DEX, +10 AGI', statBonus: { dex: 25, agi: 10 } },

  // Armaduras
  { id: 'colete_basico', name: 'Colete Básico', icon: '🦺', type: 'armor', tier: 'basic', price: 300, desc: '+8 STR', statBonus: { str: 8 } },
  { id: 'colete_industrial', name: 'Colete Industrial', icon: '🦺', type: 'armor', tier: 'advanced', price: 700, desc: '+15 STR', statBonus: { str: 15 } },
  { id: 'colete_expert', name: 'Colete Profissional', icon: '🦺', type: 'armor', tier: 'expert', price: 1500, desc: '+25 STR, +10 VIT', statBonus: { str: 25, vit: 10 } },
  { id: 'traje_mestre', name: 'Traje de Mestre', icon: '🥋', type: 'armor', tier: 'master', price: 4000, desc: '+40 STR, +20 VIT', statBonus: { str: 40, vit: 20 } },

  // Ferramentas
  { id: 'chave_basica', name: 'Chave Inglesa', icon: '🔧', type: 'tool', tier: 'basic', price: 120, desc: '+5 INT', statBonus: { intel: 5 } },
  { id: 'chave_industrial', name: 'Kit de Ferramentas', icon: '🔨', type: 'tool', tier: 'advanced', price: 450, desc: '+12 INT', statBonus: { intel: 12 } },
  { id: 'chave_expert', name: 'Kit Profissional', icon: '⚒️', type: 'tool', tier: 'expert', price: 1100, desc: '+20 INT, +5 DEX', statBonus: { intel: 20, dex: 5 } },
  { id: 'ferramenta_mestre', name: 'Maleta de Mestre', icon: '🧰', type: 'tool', tier: 'master', price: 2800, desc: '+35 INT, +15 DEX', statBonus: { intel: 35, dex: 15 } },

  // Acessórios
  { id: 'relogio', name: 'Relógio Inteligente', icon: '⌚', type: 'accessory', tier: 'advanced', price: 600, desc: '+10 INT', statBonus: { intel: 10 } },
  { id: 'anel', name: 'Anel de Proteção', icon: '💍', type: 'accessory', tier: 'advanced', price: 500, desc: '+10 VIT', statBonus: { vit: 10 } },
  { id: 'colar', name: 'Colar de Sorte', icon: '📿', type: 'accessory', tier: 'expert', price: 1300, desc: '+20 AGI', statBonus: { agi: 20 } },
  { id: 'oculos', name: 'Óculos de Proteção AR', icon: '🥽', type: 'accessory', tier: 'master', price: 3500, desc: '+20 INT, +20 DEX', statBonus: { intel: 20, dex: 20 } },
];

const REPUTATION_TIERS = [
  { tier: 0, name: 'Aprendiz', icon: '📚', minRep: 0, multiplier: 1 },
  { tier: 1, name: 'Técnico', icon: '🔧', minRep: 500, multiplier: 1.2 },
  { tier: 2, name: 'Especialista', icon: '⭐', minRep: 1500, multiplier: 1.5 },
  { tier: 3, name: 'Mestre', icon: '👑', minRep: 3000, multiplier: 2 },
  { tier: 4, name: 'Instrutor', icon: '📖', minRep: 5000, multiplier: 2.5 },
  { tier: 5, name: 'Consultor Industrial', icon: '🏆', minRep: 8000, multiplier: 3 },
  { tier: 6, name: 'Lenda da Manutenção', icon: '🌟', minRep: 15000, multiplier: 4 },
];

const QUIZ_QUESTIONS = [
  // ==========================================
  // ELÉTRICA (20 Questões)
  // ==========================================
  { q: 'Qual é a unidade de medida para resistência elétrica?', a: ['Ampere', 'Ohm', 'Volt', 'Watt'], c: 1, lv: 1, skill: 'eletrica', tip: 'Ohm (Ω) é a unidade de resistência elétrica no SI' },
  { q: 'O que é corrente elétrica?', a: ['Fluxo de carga', 'Resistência', 'Tensão', 'Potência'], c: 0, lv: 1, skill: 'eletrica', tip: 'Corrente é o fluxo de elétrons através de um condutor' },
  { q: 'Qual é a lei de Ohm?', a: ['V = I × R', 'P = V × I', 'R = V / I', 'I = V / R'], c: 0, lv: 2, skill: 'eletrica', tip: 'Lei de Ohm: V = I × R (Tensão = Corrente × Resistência)' },
  { q: 'Como se calcula a potência elétrica?', a: ['P = V × I', 'P = V / I', 'P = R × I', 'P = V × R'], c: 0, lv: 2, skill: 'eletrica', tip: 'Potência = Tensão × Corrente (P = V × I)' },
  { q: 'O que é um circuito em série?', a: ['Componentes em paralelo', 'Componentes em sequência', 'Componentes aleatórios', 'Sem componentes'], c: 1, lv: 3, skill: 'eletrica', tip: 'Em série, os componentes estão conectados um após o outro' },
  { q: 'Qual a função de um disjuntor?', a: ['Aumentar a tensão', 'Proteger contra curtos e sobrecargas', 'Reduzir a resistência', 'Gerar energia'], c: 1, lv: 1, skill: 'eletrica', tip: 'Disjuntores desarmam para proteger o circuito.' },
  { q: 'O que significa AC em eletricidade?', a: ['Alta Corrente', 'Corrente Alternada', 'Amperagem Contínua', 'Aceleração de Carga'], c: 1, lv: 1, skill: 'eletrica', tip: 'AC vem do inglês Alternating Current.' },
  { q: 'Qual a cor padrão para o fio de aterramento (terra) no Brasil?', a: ['Azul', 'Preto', 'Verde ou Verde/Amarelo', 'Vermelho'], c: 2, lv: 1, skill: 'eletrica', tip: 'O fio terra é padronizado como verde ou verde com listras amarelas.' },
  { q: 'O que mede um multímetro?', a: ['Apenas tensão', 'Apenas corrente', 'Tensão, corrente, resistência, etc.', 'Apenas temperatura'], c: 2, lv: 2, skill: 'eletrica', tip: 'É um medidor múltiplo (multi-meter).' },
  { q: 'O que é um transformador?', a: ['Converte AC para DC', 'Altera os níveis de tensão AC', 'Armazena energia', 'Gera energia mecânica'], c: 1, lv: 2, skill: 'eletrica', tip: 'Transformadores elevam ou rebaixam a tensão alternada.' },
  { q: 'Qual a unidade de capacitância?', a: ['Henry', 'Farad', 'Tesla', 'Weber'], c: 1, lv: 3, skill: 'eletrica', tip: 'Farad (F) é a unidade de capacitância.' },
  { q: 'O que é potência reativa?', a: ['Potência útil', 'Potência que oscila entre a fonte e a carga', 'Potência dissipada em calor', 'Potência mecânica'], c: 1, lv: 3, skill: 'eletrica', tip: 'Medida em VAr, não realiza trabalho útil.' },
  { q: 'O que causa o Efeito Joule?', a: ['Campo magnético', 'Passagem de corrente elétrica gerando calor', 'Falta de aterramento', 'Tensão muito baixa'], c: 1, lv: 2, skill: 'eletrica', tip: 'Corrente passando por resistência gera calor.' },
  { q: 'O que é um contator?', a: ['Um tipo de resistor', 'Uma chave magnética para acionar motores', 'Um medidor de energia', 'Um fusível reutilizável'], c: 1, lv: 2, skill: 'eletrica', tip: 'Contator é usado para manobras de cargas pesadas.' },
  { q: 'Em um sistema trifásico equilibrado, qual a defasagem entre as fases?', a: ['90 graus', '120 graus', '180 graus', '360 graus'], c: 1, lv: 3, skill: 'eletrica', tip: 'As três fases são defasadas em 120 graus elétricos.' },
  { q: 'O que é Fator de Potência?', a: ['Razão entre potência ativa e aparente', 'Soma das potências', 'Tensão dividida pela corrente', 'Potência reativa máxima'], c: 0, lv: 3, skill: 'eletrica', tip: 'FP = kW / kVA.' },
  { q: 'Qual a função de um relé térmico?', a: ['Proteger contra curto-circuito', 'Proteger o motor contra sobrecarga', 'Medir temperatura ambiente', 'Aumentar a velocidade do motor'], c: 1, lv: 2, skill: 'eletrica', tip: 'Atua pelo aquecimento causado por sobrecorrente prolongada.' },
  { q: 'O que é um inversor de frequência?', a: ['Inverte a polaridade', 'Controla a velocidade de motores AC', 'Converte DC para AC', 'Aumenta a tensão da rede'], c: 1, lv: 3, skill: 'eletrica', tip: 'Varia a frequência e a tensão fornecida ao motor.' },
  { q: 'O que é um curto-circuito?', a: ['Caminho de baixa resistência que causa corrente excessiva', 'Circuito muito pequeno', 'Falta de tensão', 'Excesso de resistência'], c: 0, lv: 1, skill: 'eletrica', tip: 'A corrente tende ao infinito devido à resistência quase nula.' },
  { q: 'Qual a unidade de indutância?', a: ['Farad', 'Ohm', 'Henry', 'Tesla'], c: 2, lv: 3, skill: 'eletrica', tip: 'Henry (H) é a unidade de indutância.' },

  // ==========================================
  // MECÂNICA (20 Questões)
  // ==========================================
  { q: 'Qual é a unidade de medida para força?', a: ['Joule', 'Newton', 'Pascal', 'Watt'], c: 1, lv: 1, skill: 'mecanica', tip: 'Newton (N) é a unidade de força no SI' },
  { q: 'O que é atrito?', a: ['Força de movimento', 'Força de resistência', 'Força gravitacional', 'Força elétrica'], c: 1, lv: 1, skill: 'mecanica', tip: 'Atrito é a força que resiste ao movimento entre superfícies' },
  { q: 'Qual é a fórmula da força?', a: ['F = m × a', 'F = m / a', 'F = a / m', 'F = m + a'], c: 0, lv: 2, skill: 'mecanica', tip: 'F = m × a (Força = Massa × Aceleração)' },
  { q: 'O que é torque?', a: ['Força linear', 'Momento de rotação', 'Velocidade', 'Aceleração'], c: 1, lv: 2, skill: 'mecanica', tip: 'Torque é o momento de uma força que causa rotação' },
  { q: 'Como funciona uma alavanca?', a: ['Sem ponto de apoio', 'Com ponto de apoio', 'Sem força', 'Sem resistência'], c: 1, lv: 3, skill: 'mecanica', tip: 'Uma alavanca funciona com um ponto de apoio (fulcro)' },
  { q: 'Qual a função principal de um rolamento?', a: ['Aumentar o atrito', 'Reduzir o atrito rotacional', 'Gerar energia', 'Travar o eixo'], c: 1, lv: 1, skill: 'mecanica', tip: 'Rolamentos facilitam a rotação reduzindo o atrito.' },
  { q: 'O que é engrenagem?', a: ['Roda dentada para transmitir torque', 'Tipo de mola', 'Ferramenta de corte', 'Dispositivo de frenagem'], c: 0, lv: 1, skill: 'mecanica', tip: 'Engrenagens transmitem movimento e força.' },
  { q: 'O que é fadiga de material?', a: ['Derretimento do metal', 'Falha por ciclos repetidos de tensão', 'Oxidação rápida', 'Aumento de dureza'], c: 1, lv: 3, skill: 'mecanica', tip: 'Ocorre após muitos ciclos de carga e descarga.' },
  { q: 'Qual a finalidade da lubrificação?', a: ['Aumentar a temperatura', 'Reduzir desgaste e atrito', 'Aumentar o ruído', 'Enferrujar a peça'], c: 1, lv: 1, skill: 'mecanica', tip: 'Cria uma película protetora entre as superfícies.' },
  { q: 'O que é um paquímetro?', a: ['Ferramenta de corte', 'Instrumento de medição de precisão', 'Tipo de martelo', 'Equipamento de solda'], c: 1, lv: 2, skill: 'mecanica', tip: 'Mede dimensões lineares internas, externas e de profundidade.' },
  { q: 'O que é um micrômetro?', a: ['Mede distâncias muito longas', 'Mede dimensões com altíssima precisão', 'Mede temperatura', 'Mede pressão'], c: 1, lv: 2, skill: 'mecanica', tip: 'Mais preciso que o paquímetro, usado para medidas exatas.' },
  { q: 'O que é usinagem?', a: ['Processo de pintura', 'Processo de desgaste mecânico para dar forma', 'Processo de soldagem', 'Processo de fundição'], c: 1, lv: 2, skill: 'mecanica', tip: 'Envolve remoção de cavaco (torno, fresa).' },
  { q: 'O que é um Torno CNC?', a: ['Torno manual', 'Torno a Comando Numérico Computadorizado', 'Torno de madeira', 'Torno hidráulico'], c: 1, lv: 2, skill: 'mecanica', tip: 'Controlado por computador para alta precisão.' },
  { q: 'Qual a função de uma correia de transmissão?', a: ['Transmitir movimento entre polias', 'Gerar eletricidade', 'Filtrar óleo', 'Resfriar o motor'], c: 0, lv: 1, skill: 'mecanica', tip: 'Liga duas ou mais polias.' },
  { q: 'O que é um mancal?', a: ['Suporte para eixos rotativos', 'Tipo de engrenagem', 'Ferramenta de aperto', 'Bomba de água'], c: 0, lv: 2, skill: 'mecanica', tip: 'Apoia e guia o eixo.' },
  { q: 'O que é soldagem MIG/MAG?', a: ['Solda a frio', 'Solda a arco elétrico com gás de proteção', 'Solda por fricção', 'Solda a laser'], c: 1, lv: 3, skill: 'mecanica', tip: 'Usa arame consumível e gás de proteção.' },
  { q: 'O que é dureza de um material?', a: ['Resistência à quebra', 'Resistência ao risco ou penetração', 'Capacidade de esticar', 'Capacidade de derreter'], c: 1, lv: 3, skill: 'mecanica', tip: 'Materiais duros são difíceis de riscar.' },
  { q: 'O que é tenacidade?', a: ['Resistência ao risco', 'Capacidade de absorver energia antes de romper', 'Facilidade de derreter', 'Capacidade de conduzir calor'], c: 1, lv: 3, skill: 'mecanica', tip: 'Materiais tenazes resistem a impactos.' },
  { q: 'O que é um acoplamento mecânico?', a: ['Conecta dois eixos para transmitir potência', 'Separa dois eixos', 'Aumenta a velocidade', 'Reduz a temperatura'], c: 0, lv: 2, skill: 'mecanica', tip: 'Une eixos de máquinas diferentes.' },
  { q: 'Qual a função de uma mola?', a: ['Aumentar o peso', 'Armazenar energia mecânica', 'Gerar atrito', 'Transmitir eletricidade'], c: 1, lv: 1, skill: 'mecanica', tip: 'Deforma-se e retorna à forma original.' },

  // ==========================================
  // HIDRÁULICA (20 Questões)
  // ==========================================
  { q: 'Qual é a unidade de pressão?', a: ['Newton', 'Pascal', 'Joule', 'Watt'], c: 1, lv: 1, skill: 'hidraulica', tip: 'Pascal (Pa) é a unidade de pressão no SI' },
  { q: 'O que é pressão hidráulica?', a: ['Fluxo de água', 'Força por unidade de área', 'Temperatura da água', 'Velocidade da água'], c: 1, lv: 1, skill: 'hidraulica', tip: 'Pressão é a força distribuída sobre uma área' },
  { q: 'Qual é o princípio de Pascal?', a: ['Pressão se dissipa', 'Pressão se transmite igualmente', 'Pressão aumenta', 'Pressão diminui'], c: 1, lv: 2, skill: 'hidraulica', tip: 'Pressão aplicada em um fluido se transmite igualmente em todas as direções' },
  { q: 'O que é vazão?', a: ['Pressão', 'Volume por unidade de tempo', 'Temperatura', 'Densidade'], c: 1, lv: 2, skill: 'hidraulica', tip: 'Vazão é o volume de fluido que passa por uma seção por unidade de tempo' },
  { q: 'Como funciona um cilindro hidráulico?', a: ['Por ar comprimido', 'Por fluido pressurizado', 'Por mola', 'Por eletricidade'], c: 1, lv: 3, skill: 'hidraulica', tip: 'Um cilindro hidráulico usa fluido pressurizado para gerar movimento linear' },
  { q: 'Qual a função de uma bomba hidráulica?', a: ['Gerar pressão', 'Gerar fluxo (vazão) de fluido', 'Resfriar o óleo', 'Filtrar o óleo'], c: 1, lv: 2, skill: 'hidraulica', tip: 'Bombas geram fluxo; a pressão é resultado da resistência ao fluxo.' },
  { q: 'O que é cavitação?', a: ['Formação e colapso de bolhas de vapor no fluido', 'Vazamento de óleo', 'Aumento excessivo de pressão', 'Congelamento do fluido'], c: 0, lv: 3, skill: 'hidraulica', tip: 'Causa danos severos às bombas.' },
  { q: 'Qual a função de uma válvula de alívio?', a: ['Aumentar a pressão', 'Limitar a pressão máxima do sistema', 'Aumentar a vazão', 'Inverter o fluxo'], c: 1, lv: 2, skill: 'hidraulica', tip: 'Abre quando a pressão atinge um limite seguro.' },
  { q: 'O que é um fluido incompressível?', a: ['Fluido que muda de volume facilmente', 'Fluido cujo volume não muda significativamente com a pressão', 'Gás', 'Vapor'], c: 1, lv: 2, skill: 'hidraulica', tip: 'Líquidos são geralmente considerados incompressíveis.' },
  { q: 'Qual a diferença principal entre hidráulica e pneumática?', a: ['Hidráulica usa gases, pneumática usa líquidos', 'Hidráulica usa líquidos, pneumática usa gases', 'Nenhuma diferença', 'Ambas usam eletricidade'], c: 1, lv: 1, skill: 'hidraulica', tip: 'Hidro = água/líquido, Pneumo = ar/gás.' },
  { q: 'O que é um acumulador hidráulico?', a: ['Armazena fluido sob pressão', 'Filtra o óleo', 'Resfria o sistema', 'Gera energia elétrica'], c: 0, lv: 3, skill: 'hidraulica', tip: 'Funciona como uma "bateria" hidráulica.' },
  { q: 'Qual a função do reservatório hidráulico?', a: ['Apenas armazenar óleo', 'Armazenar, resfriar e decantar impurezas', 'Aumentar a pressão', 'Gerar vazão'], c: 1, lv: 1, skill: 'hidraulica', tip: 'Tem múltiplas funções além de guardar o óleo.' },
  { q: 'O que significa válvula 4/3 vias?', a: ['4 posições, 3 vias', '4 vias, 3 posições', '4 pressões, 3 vazões', '4 cilindros, 3 bombas'], c: 1, lv: 3, skill: 'hidraulica', tip: 'O primeiro número é vias (conexões), o segundo é posições.' },
  { q: 'O que é viscosidade?', a: ['Cor do fluido', 'Resistência do fluido ao escoamento', 'Temperatura do fluido', 'Densidade do fluido'], c: 1, lv: 2, skill: 'hidraulica', tip: 'Óleo grosso tem alta viscosidade.' },
  { q: 'Qual a função de um filtro de retorno?', a: ['Filtrar o óleo antes de entrar na bomba', 'Filtrar o óleo que volta para o reservatório', 'Aumentar a pressão', 'Reduzir a temperatura'], c: 1, lv: 2, skill: 'hidraulica', tip: 'Limpa o óleo após ele ter passado pelo sistema.' },
  { q: 'O que é um motor hidráulico?', a: ['Converte energia mecânica em hidráulica', 'Converte energia hidráulica em mecânica rotativa', 'Bomba de água', 'Motor a combustão'], c: 1, lv: 2, skill: 'hidraulica', tip: 'Faz o oposto da bomba.' },
  { q: 'O que é golpe de aríete?', a: ['Pico de pressão causado por fechamento brusco de válvula', 'Ferramenta de bater', 'Vazamento rápido', 'Falta de óleo'], c: 0, lv: 3, skill: 'hidraulica', tip: 'Pode romper tubulações.' },
  { q: 'Qual o símbolo de uma bomba hidráulica?', a: ['Círculo com triângulo apontando para fora', 'Círculo com triângulo apontando para dentro', 'Quadrado', 'Retângulo'], c: 0, lv: 3, skill: 'hidraulica', tip: 'Triângulo cheio apontando para fora.' },
  { q: 'O que é uma válvula direcional?', a: ['Controla a pressão', 'Controla a direção do fluxo do fluido', 'Controla a temperatura', 'Controla a viscosidade'], c: 1, lv: 1, skill: 'hidraulica', tip: 'Direciona o óleo para o cilindro avançar ou recuar.' },
  { q: 'Por que sistemas pneumáticos são mais rápidos que hidráulicos?', a: ['O ar é mais pesado', 'O ar é compressível e tem menor inércia', 'O óleo é mais leve', 'A pressão é maior'], c: 1, lv: 3, skill: 'hidraulica', tip: 'Ar flui mais rápido devido à baixa densidade.' },

  // ==========================================
  // ELETRÔNICA (20 Questões)
  // ==========================================
  { q: 'O que é um diodo?', a: ['Resistor', 'Condutor de uma via', 'Capacitor', 'Indutor'], c: 1, lv: 1, skill: 'eletronica', tip: 'Um diodo permite fluxo de corrente em apenas uma direção' },
  { q: 'Qual é a função de um transistor?', a: ['Armazenar carga', 'Amplificar ou comutar', 'Resistir corrente', 'Armazenar energia'], c: 1, lv: 1, skill: 'eletronica', tip: 'Transistor amplifica ou comuta sinais eletrônicos' },
  { q: 'O que é um capacitor?', a: ['Resistor', 'Dispositivo de armazenamento de carga', 'Fonte de energia', 'Amplificador'], c: 1, lv: 2, skill: 'eletronica', tip: 'Um capacitor armazena energia em um campo elétrico' },
  { q: 'Qual é a função de um indutor?', a: ['Armazenar carga', 'Armazenar energia em campo magnético', 'Resistir corrente', 'Amplificar sinal'], c: 1, lv: 2, skill: 'eletronica', tip: 'Um indutor armazena energia em um campo magnético' },
  { q: 'O que é um circuito integrado?', a: ['Circuito simples', 'Múltiplos componentes em um chip', 'Apenas resistores', 'Apenas capacitores'], c: 1, lv: 3, skill: 'eletronica', tip: 'Um CI contém múltiplos componentes eletrônicos integrados em um chip' },
  { q: 'O que é um LED?', a: ['Diodo Emissor de Luz', 'Resistor Variável', 'Capacitor Eletrolítico', 'Transistor de Potência'], c: 0, lv: 1, skill: 'eletronica', tip: 'Light Emitting Diode.' },
  { q: 'Qual a função de um resistor?', a: ['Aumentar a corrente', 'Limitar a corrente elétrica', 'Armazenar energia', 'Gerar luz'], c: 1, lv: 1, skill: 'eletronica', tip: 'Ele resiste à passagem da corrente.' },
  { q: 'O que é um amplificador operacional (Op-Amp)?', a: ['Bateria', 'Circuito integrado usado para amplificar sinais', 'Motor DC', 'Antena'], c: 1, lv: 3, skill: 'eletronica', tip: 'Muito usado em processamento de sinais analógicos.' },
  { q: 'O que é PWM?', a: ['Modulação por Largura de Pulso', 'Potência Watt Máxima', 'Processador de Waveform', 'Ponte de Wheatstone'], c: 0, lv: 2, skill: 'eletronica', tip: 'Pulse Width Modulation, usado para controle de potência.' },
  { q: 'O que é um microcontrolador?', a: ['Um resistor grande', 'Um computador inteiro em um único chip', 'Um tipo de tela', 'Um cabo de rede'], c: 1, lv: 2, skill: 'eletronica', tip: 'Possui CPU, memória e periféricos (ex: Arduino).' },
  { q: 'Qual a diferença entre sinal analógico e digital?', a: ['Analógico é contínuo, digital é discreto (0 e 1)', 'Analógico é rápido, digital é lento', 'Não há diferença', 'Digital usa válvulas'], c: 0, lv: 1, skill: 'eletronica', tip: 'Digital trabalha com níveis lógicos definidos.' },
  { q: 'O que é uma porta lógica AND?', a: ['Saída 1 se qualquer entrada for 1', 'Saída 1 apenas se todas as entradas forem 1', 'Inverte o sinal', 'Soma os sinais analógicos'], c: 1, lv: 2, skill: 'eletronica', tip: 'A E B precisam ser verdadeiros.' },
  { q: 'O que é solda de estanho?', a: ['Cola plástica', 'Liga metálica fundida para unir componentes', 'Fita adesiva', 'Parafuso pequeno'], c: 1, lv: 1, skill: 'eletronica', tip: 'Usada para fixar componentes na placa de circuito impresso.' },
  { q: 'O que é um osciloscópio?', a: ['Mede peso', 'Visualiza formas de onda de sinais elétricos', 'Gera energia', 'Mede temperatura'], c: 1, lv: 2, skill: 'eletronica', tip: 'Mostra o gráfico da tensão em função do tempo.' },
  { q: 'O que é uma PCB?', a: ['Placa de Circuito Impresso', 'Processador Central', 'Ponte de Corrente', 'Porta de Comunicação'], c: 0, lv: 1, skill: 'eletronica', tip: 'Printed Circuit Board.' },
  { q: 'O que é um diodo Zener?', a: ['Emite luz', 'Mantém uma tensão constante quando polarizado reversamente', 'Amplifica corrente', 'Armazena dados'], c: 1, lv: 3, skill: 'eletronica', tip: 'Usado como regulador de tensão.' },
  { q: 'O que é um MOSFET?', a: ['Tipo de capacitor', 'Tipo de transistor de efeito de campo', 'Tipo de bateria', 'Tipo de motor'], c: 1, lv: 3, skill: 'eletronica', tip: 'Metal-Oxide-Semiconductor Field-Effect Transistor.' },
  { q: 'O que é a Lei de Moore?', a: ['Tensão = Corrente x Resistência', 'O número de transistores em um chip dobra a cada dois anos', 'Toda ação tem reação', 'A energia se conserva'], c: 1, lv: 2, skill: 'eletronica', tip: 'Previsão histórica sobre a evolução dos chips.' },
  { q: 'O que é um termistor?', a: ['Resistor cuja resistência varia com a temperatura', 'Bateria térmica', 'Motor a vapor', 'Lâmpada halógena'], c: 0, lv: 2, skill: 'eletronica', tip: 'Pode ser NTC ou PTC.' },
  { q: 'O que é um relé de estado sólido (SSR)?', a: ['Relé com contatos mecânicos', 'Relé que usa semicondutores para comutar, sem partes móveis', 'Relé a gás', 'Relé de água'], c: 1, lv: 3, skill: 'eletronica', tip: 'Mais rápido e durável que o relé eletromecânico.' },

  // ==========================================
  // AUTOMAÇÃO (20 Questões)
  // ==========================================
  { q: 'O que é um PLC?', a: ['Computador pessoal', 'Controlador lógico programável', 'Placa de circuito', 'Processador'], c: 1, lv: 1, skill: 'automacao', tip: 'PLC (Programmable Logic Controller) controla máquinas industriais' },
  { q: 'Qual é a função de um sensor?', a: ['Controlar', 'Detectar e medir', 'Amplificar', 'Armazenar'], c: 1, lv: 1, skill: 'automacao', tip: 'Um sensor detecta e mede grandezas físicas' },
  { q: 'O que é lógica booleana?', a: ['Lógica de números', 'Lógica de verdadeiro/falso', 'Lógica de cores', 'Lógica de sons'], c: 1, lv: 2, skill: 'automacao', tip: 'Lógica booleana trabalha com valores verdadeiro (1) ou falso (0)' },
  { q: 'Qual é a função de um atuador?', a: ['Detectar', 'Executar ação', 'Armazenar', 'Amplificar'], c: 1, lv: 2, skill: 'automacao', tip: 'Um atuador executa uma ação baseado em um sinal de controle' },
  { q: 'O que é um sistema SCADA?', a: ['Sistema de controle local', 'Sistema de supervisão e controle', 'Sistema de armazenamento', 'Sistema de comunicação'], c: 1, lv: 3, skill: 'automacao', tip: 'SCADA monitora e controla processos industriais remotamente' },
  { q: 'O que é uma IHM (HMI)?', a: ['Interface Homem-Máquina', 'Índice de Hardware Máximo', 'Inversor de Alta Marcha', 'Interruptor Híbrido'], c: 0, lv: 1, skill: 'automacao', tip: 'Tela onde o operador interage com a máquina.' },
  { q: 'O que é malha fechada (Closed Loop)?', a: ['Sistema sem controle', 'Sistema que usa feedback (retroalimentação) para corrigir erros', 'Circuito elétrico em curto', 'Rede de computadores isolada'], c: 1, lv: 2, skill: 'automacao', tip: 'O sensor lê a saída e ajusta a entrada.' },
  { q: 'O que é um controle PID?', a: ['Proporcional, Integral, Derivativo', 'Pressão, Intensidade, Distância', 'Painel Interno Digital', 'Processador Integrado Duplo'], c: 0, lv: 3, skill: 'automacao', tip: 'Algoritmo de controle muito usado na indústria.' },
  { q: 'O que é um sensor indutivo?', a: ['Detecta luz', 'Detecta objetos metálicos sem contato', 'Detecta temperatura', 'Detecta som'], c: 1, lv: 2, skill: 'automacao', tip: 'Gera um campo eletromagnético.' },
  { q: 'O que é um sensor capacitivo?', a: ['Detecta apenas metais', 'Detecta metais e não-metais (plástico, água, etc)', 'Detecta apenas fumaça', 'Detecta apenas radiação'], c: 1, lv: 2, skill: 'automacao', tip: 'Funciona pela variação da capacitância.' },
  { q: 'O que é um encoder?', a: ['Motor de passo', 'Sensor que converte movimento rotativo em sinais elétricos digitais', 'Válvula pneumática', 'Fonte de alimentação'], c: 1, lv: 3, skill: 'automacao', tip: 'Usado para medir velocidade e posição de eixos.' },
  { q: 'O que é a Indústria 4.0?', a: ['Quarta revolução industrial (IoT, Big Data, Nuvem)', 'Fábricas movidas a vapor', 'Invenção da linha de montagem', 'Uso de relés eletromecânicos'], c: 0, lv: 1, skill: 'automacao', tip: 'Focada em conectividade e dados.' },
  { q: 'O que é um protocolo de comunicação industrial?', a: ['Regras para máquinas conversarem entre si (ex: Modbus, Profibus)', 'Manual de segurança', 'Tipo de cabo de aço', 'Linguagem de programação web'], c: 0, lv: 2, skill: 'automacao', tip: 'Padroniza a troca de dados.' },
  { q: 'O que é linguagem Ladder?', a: ['Linguagem de web design', 'Linguagem de programação gráfica para CLPs baseada em relés', 'Linguagem de banco de dados', 'Linguagem de máquina pura'], c: 1, lv: 1, skill: 'automacao', tip: 'Parece um diagrama de contatos elétricos.' },
  { q: 'O que é um servomotor?', a: ['Motor de geladeira', 'Motor de alta precisão com feedback integrado', 'Motor a combustão', 'Motor de passo simples sem controle'], c: 1, lv: 3, skill: 'automacao', tip: 'Usado em robótica e CNC.' },
  { q: 'O que é um robô colaborativo (Cobot)?', a: ['Robô que trabalha isolado em gaiola', 'Robô projetado para trabalhar lado a lado com humanos com segurança', 'Robô gigante', 'Software de chat'], c: 1, lv: 2, skill: 'automacao', tip: 'Para se o tocar em uma pessoa.' },
  { q: 'O que é telemetria?', a: ['Medição de temperatura', 'Medição e transmissão de dados à distância', 'Controle de motores', 'Visão computacional'], c: 1, lv: 2, skill: 'automacao', tip: 'Tele = distância, Metria = medida.' },
  { q: 'Qual a vantagem da automação industrial?', a: ['Aumentar o esforço físico', 'Aumentar produtividade, qualidade e segurança', 'Tornar o processo mais lento', 'Aumentar o desperdício'], c: 1, lv: 1, skill: 'automacao', tip: 'Reduz erros humanos e aumenta a eficiência.' },
  { q: 'O que é um sistema supervisório?', a: ['Software para monitorar e controlar a planta industrial', 'Câmera de segurança', 'Chefe de turno', 'Alarme de incêndio'], c: 0, lv: 2, skill: 'automacao', tip: 'Interface gráfica do SCADA.' },
  { q: 'O que é um atuador pneumático?', a: ['Motor elétrico', 'Cilindro movido a ar comprimido', 'Bomba de água', 'Aquecedor'], c: 1, lv: 1, skill: 'automacao', tip: 'Usa ar para gerar movimento.' },

  // ==========================================
  // NR-12 (20 Questões)
  // ==========================================
  { q: 'O que é NR-12?', a: ['Norma de segurança', 'Norma de máquinas e equipamentos', 'Norma de eletricidade', 'Norma de transporte'], c: 1, lv: 1, skill: 'nr12', tip: 'NR-12 é a Norma Regulamentadora de Segurança em Máquinas' },
  { q: 'Qual é o objetivo principal da NR-12?', a: ['Aumentar produção', 'Proteger trabalhadores', 'Reduzir custos', 'Melhorar qualidade'], c: 1, lv: 1, skill: 'nr12', tip: 'NR-12 visa proteger a saúde e integridade dos trabalhadores' },
  { q: 'O que é uma zona de perigo?', a: ['Área de descanso', 'Área onde há risco de acidentes', 'Área de armazenamento', 'Área de escritório'], c: 1, lv: 2, skill: 'nr12', tip: 'Zona de perigo é onde há risco de acidentes com máquinas' },
  { q: 'Qual é a distância segura de uma máquina?', a: ['Sem limite', 'Conforme NR-12', '1 metro', '10 metros'], c: 1, lv: 2, skill: 'nr12', tip: 'A distância segura é definida pela NR-12 conforme o tipo de máquina' },
  { q: 'O que é um dispositivo de proteção?', a: ['Ferramenta', 'Equipamento que previne acidentes', 'Máquina', 'Uniforme'], c: 1, lv: 3, skill: 'nr12', tip: 'Dispositivo de proteção previne acidentes em máquinas industriais' },
  { q: 'O que é LOTO (Lockout/Tagout)?', a: ['Marca de ferramenta', 'Bloqueio e etiquetagem de energias perigosas', 'Tipo de óleo', 'Software de gestão'], c: 1, lv: 2, skill: 'nr12', tip: 'Garante que a máquina não ligue durante a manutenção.' },
  { q: 'O que é uma proteção fixa?', a: ['Proteção que pode ser aberta facilmente', 'Proteção mantida em sua posição por fixadores (parafusos)', 'Cortina de luz', 'Tapete de segurança'], c: 1, lv: 1, skill: 'nr12', tip: 'Requer ferramentas para ser removida.' },
  { q: 'O que é uma proteção móvel com intertravamento?', a: ['Porta normal', 'Porta que, se aberta, desliga a máquina automaticamente', 'Cerca de arame', 'Vidro blindado'], c: 1, lv: 2, skill: 'nr12', tip: 'O interlock impede o funcionamento com a porta aberta.' },
  { q: 'O que é um botão de parada de emergência?', a: ['Botão verde para ligar', 'Botão tipo cogumelo vermelho para parar a máquina imediatamente', 'Botão de reset', 'Botão de luz'], c: 1, lv: 1, skill: 'nr12', tip: 'Deve ser facilmente acessível e reter a posição.' },
  { q: 'O que é uma cortina de luz de segurança?', a: ['Luz de decoração', 'Sensor optoeletrônico que para a máquina se o feixe for interrompido', 'Lâmpada fluorescente', 'Sinalizador visual'], c: 1, lv: 2, skill: 'nr12', tip: 'Protege o acesso a áreas de risco sem barreiras físicas.' },
  { q: 'O que é falha segura (fail-safe)?', a: ['A máquina quebra sempre', 'Se houver falha no sistema, ele vai para um estado seguro (desligado)', 'Ignorar o erro', 'Alarme falso'], c: 1, lv: 3, skill: 'nr12', tip: 'Princípio fundamental de segurança de máquinas.' },
  { q: 'Quem pode fazer manutenção em máquinas segundo a NR-12?', a: ['Qualquer pessoa', 'Apenas profissionais capacitados, qualificados ou habilitados', 'Apenas o gerente', 'O operador da máquina'], c: 1, lv: 1, skill: 'nr12', tip: 'Exige treinamento específico.' },
  { q: 'O que é um comando bimanual?', a: ['Volante de carro', 'Dispositivo que exige as duas mãos simultaneamente para acionar a máquina', 'Teclado de computador', 'Controle remoto'], c: 1, lv: 2, skill: 'nr12', tip: 'Garante que as mãos do operador estejam fora da zona de perigo (ex: prensas).' },
  { q: 'Qual a cor padrão para botões de parada de emergência?', a: ['Verde', 'Amarelo', 'Vermelho com fundo amarelo', 'Azul'], c: 2, lv: 1, skill: 'nr12', tip: 'Alta visibilidade para emergências.' },
  { q: 'O que é apreciação de riscos?', a: ['Ignorar os riscos', 'Processo de identificar perigos e avaliar os riscos associados', 'Comprar EPIs', 'Limpar a máquina'], c: 1, lv: 3, skill: 'nr12', tip: 'Passo inicial para adequar uma máquina à NR-12.' },
  { q: 'Pisos nos locais de trabalho ao redor de máquinas devem ser:', a: ['Escorregadios', 'Nivelados, limpos e antiderrapantes', 'De terra', 'Inclinados'], c: 1, lv: 1, skill: 'nr12', tip: 'Previne quedas perto de equipamentos perigosos.' },
  { q: 'O que é um relé de segurança?', a: ['Relé comum', 'Componente redundante e monitorado para garantir funções de segurança', 'Disjuntor', 'Fusível'], c: 1, lv: 3, skill: 'nr12', tip: 'Garante que a falha de um componente não perca a função de segurança.' },
  { q: 'É permitido burlar (fazer "jump") em sistemas de segurança?', a: ['Sim, para não parar a produção', 'Nunca, é infração gravíssima', 'Apenas o chefe pode', 'Sim, se for rápido'], c: 1, lv: 1, skill: 'nr12', tip: 'Burlar segurança é a principal causa de acidentes graves.' },
  { q: 'O que são manuais de instrução segundo a NR-12?', a: ['Opcionais', 'Obrigatórios, em português (BR), claros e objetivos', 'Apenas em inglês', 'Apenas para máquinas grandes'], c: 1, lv: 2, skill: 'nr12', tip: 'Toda máquina deve ter manual acessível.' },
  { q: 'Qual a distância mínima entre máquinas segundo a NR-12?', a: ['Não há distância', 'Distância que garanta operação, manutenção e circulação segura', '10 centímetros', '1 metro exato'], c: 1, lv: 2, skill: 'nr12', tip: 'Depende do layout, mas deve garantir segurança e fluxo.' },
];
