// Modo demo offline (?demo=1): gera estados falsos localmente, ciclando por todos os estados.

const SEQ = [
  { state: 'working', activity: 'thinking', tool: null, hook: 'UserPromptSubmit', msg: 'Planejando a próxima tarefa' },
  { state: 'working', activity: 'typing', tool: 'Edit', hook: 'PreToolUse', msg: 'Editando roteiro.md' },
  { state: 'working', activity: 'reading', tool: 'Read', hook: 'PreToolUse', msg: 'Lendo briefing.txt' },
  { state: 'working', activity: 'machine', tool: 'Bash', hook: 'PreToolUse', msg: 'ffmpeg -i bruto.mp4 final.mp4' },
  { state: 'working', activity: 'searching', tool: 'WebSearch', hook: 'PreToolUse', msg: 'Pesquisando referências' },
  { state: 'waiting', activity: null, tool: null, hook: 'Notification', msg: 'Posso rodar este comando?' },
  { state: 'error', activity: null, tool: 'Bash', hook: 'PostToolUseFailure', msg: 'Comando falhou (exit 1)' },
  { state: 'done', activity: null, tool: null, hook: 'SubagentStop', msg: 'Tarefa concluída', done: true },
  { state: 'idle', activity: null, tool: null, hook: null },
  { state: 'dozing', activity: null, tool: null, hook: null },
  { state: 'sleeping', activity: null, tool: null, hook: null },
  { state: 'sleeping', activity: null, tool: null, hook: null, lounge: true },
  { state: 'sleeping', activity: null, tool: null, hook: null, lounge: true },
  { state: 'working', activity: 'typing', tool: 'Write', hook: 'SubagentStart', msg: 'Acordou e voltou ao trabalho' },
  { state: 'absent', activity: null, tool: null, hook: 'SessionEnd' },
  { state: 'idle', activity: null, tool: null, hook: 'SessionStart' },
];

// Falas falsas para os balões do mapa (o chat de verdade fica desligado no demo).
const FALAS = [
  'Bom dia! Vou dividir o trabalho entre as salas.',
  'Roteiro pronto: 3 cenas, 45 segundos.',
  'Renderizando o vídeo em 1080p, já volto.',
  'Achei um bug no login, corrigindo agora.',
  'Paleta nova aprovada? Ficou ótima!',
  'Revisão feita: 2 ajustes de texto no final.',
  'Preciso da sua confirmação para rodar o build.',
  'Animação do logo exportada em 24 fps.',
  'Café na copa, alguém quer?',
  'Testes passaram (42/42). Pode publicar!',
  'Pesquisando referências de estilo isométrico…',
  'Hmm, esse arquivo é enorme. Lendo com calma.',
];

/**
 * @param rooms   shared/rooms.json
 * @param h       { onSnapshot(agents), onAgent(agent), onEvent(event), onChat?(msg) }
 * @param stepMs  intervalo entre mudanças de cada agente
 */
export function startDemo(rooms, h, stepMs = 2600) {
  const ids = rooms.rooms.map((r) => r.id);
  const now = Date.now();
  const agents = ids.map((id, i) => ({
    id, room: id, location: id, visitor: false,
    state: 'idle', activity: null, tool: null,
    since: now, lastEventAt: now, tasksDone: (i * 3) % 7, lastMessage: '',
    _i: (i * 2) % SEQ.length,
  }));
  // Começa mostrando estados variados (um de cada) para o primeiro screenshot.
  const initial = [0, 1, 3, 2, 4, 5, 7, 6];
  agents.forEach((a, i) => { a._i = initial[i % initial.length]; apply(a, SEQ[a._i], now, false); });
  const visitor = {
    id: 'visitante:Explore', room: 'lounge', location: 'lounge', visitor: true,
    state: 'working', activity: 'reading', tool: 'Grep', since: now, lastEventAt: now, tasksDone: 0,
    lastMessage: 'Explorando o repositório',
  };
  // Um agente já começa dormindo no lounge (para mostrar o sofá).
  const sleeper = agents[agents.length - 1];
  sleeper._i = 11; apply(sleeper, SEQ[11], now, false);

  const visitor2 = {
    id: 'visitante:Plan', room: 'lounge', location: 'lounge', visitor: true,
    state: 'idle', activity: null, tool: null, since: now, lastEventAt: now, tasksDone: 0, lastMessage: '',
  };
  const pub = (a) => { const { _i, ...rest } = a; return { ...rest }; };
  h.onSnapshot([...agents.map(pub), visitor, visitor2], now);

  function apply(a, s, t, count) {
    a.state = s.state; a.activity = s.activity; a.tool = s.tool;
    a.location = s.lounge ? 'lounge' : a.room;
    a.since = t; if (s.hook) a.lastEventAt = t;
    if (s.msg) a.lastMessage = s.msg;
    if (s.done && count) a.tasksDone++;
  }

  let k = 0;
  const timer = setInterval(() => {
    const t = Date.now();
    // avança um agente por vez (em rodízio) para a tela ficar viva sem virar bagunça
    const a = agents[k % agents.length];
    k++;
    a._i = (a._i + 1) % SEQ.length;
    const s = SEQ[a._i];
    apply(a, s, t, true);
    h.onAgent(pub(a));
    if (s.hook) {
      h.onEvent({ at: t, agentId: a.id, hook: s.hook, tool: s.tool, summary: s.msg || s.hook });
    }
    // visitante entra e sai de vez em quando
    if (k % 9 === 0) {
      visitor.state = visitor.state === 'absent' ? 'working' : 'absent';
      visitor.since = t;
      h.onAgent({ ...visitor });
      h.onEvent({ at: t, agentId: visitor.id, hook: visitor.state === 'absent' ? 'SubagentStop' : 'SubagentStart', tool: null,
        summary: visitor.state === 'absent' ? 'Visitante foi embora' : 'Visitante chegou no lounge' });
    }
    // de vez em quando alguém vai tirar um cochilo no sofá do lounge
    if (k % 13 === 5) {
      const b = agents[(k * 5) % agents.length];
      if (b.state !== 'absent' && b.location !== 'lounge') {
        b._i = 11; apply(b, SEQ[11], t, false);
        h.onAgent(pub(b));
      }
    }
  }, stepMs / ids.length * 2);

  // balões de fala falsos
  let f = 0;
  const talk = setInterval(() => {
    if (!h.onChat) return;
    const present = [...agents, visitor, visitor2].filter((a) => a.state !== 'absent');
    if (!present.length) return;
    const a = present[(f * 7 + 3) % present.length];
    const text = FALAS[f % FALAS.length];
    f++;
    h.onChat({ type: 'chat', mensagem: { kind: 'text', agent: a.id, text, at: Date.now() } });
  }, 1300);
  // primeiros balões logo de cara (para o screenshot)
  setTimeout(() => {
    if (!h.onChat) return;
    h.onChat({ type: 'chat', mensagem: { kind: 'text', agent: 'orquestrador', text: FALAS[0] } });
    h.onChat({ type: 'chat', mensagem: { kind: 'text', agent: 'visitante:Explore', text: FALAS[10] } });
    h.onChat({ type: 'chat', mensagem: { kind: 'text', agent: 'visitante:Plan', text: FALAS[8] } });
  }, 300);

  return { stop() { clearInterval(timer); clearInterval(talk); } };
}
