// Textos em português e cores de estado (UI e placeholder).

export const STATE_PT = {
  absent: 'Ausente',
  idle: 'Ocioso',
  working: 'Trabalhando',
  waiting: 'Esperando você',
  done: 'Concluído',
  error: 'Erro',
  dozing: 'Cochilando',
  sleeping: 'Dormindo',
};

export const ACTIVITY_PT = {
  typing: 'digitando',
  reading: 'lendo',
  machine: 'na máquina',
  searching: 'pesquisando',
  thinking: 'pensando',
};

// Cores do personagem no MODO PLACEHOLDER (verde por atividade, cinza dormindo, etc.).
export const ACTIVITY_COLOR = {
  typing: '#38c048',
  reading: '#78d878',
  machine: '#208c40',
  searching: '#a8e040',
  thinking: '#40b890',
};

export const STATE_COLOR = {
  working: '#38c048',
  idle: '#f0f0e8',
  dozing: '#a0a0a8',
  sleeping: '#787880',
  waiting: '#f0d030',
  done: '#4880f0',
  error: '#e03838',
  absent: '#404048',
};

export function colorFor(agent) {
  if (!agent) return STATE_COLOR.absent;
  if (agent.state === 'working') return ACTIVITY_COLOR[agent.activity] || STATE_COLOR.working;
  return STATE_COLOR[agent.state] || STATE_COLOR.idle;
}

export function stateText(agent) {
  if (!agent) return STATE_PT.absent;
  let s = STATE_PT[agent.state] || agent.state;
  if (agent.state === 'working' && agent.activity) s += ' · ' + (ACTIVITY_PT[agent.activity] || agent.activity);
  if (agent.location === 'lounge' && !agent.visitor && agent.state !== 'absent') s += ' (no lounge)';
  return s;
}
