// Máquina de estados do Escritório de IA (servidor é a autoridade).
// Pura e testável: relógio injetável (`now`), sem I/O além da leitura opcional de shared/rooms.json.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_ROOMS_PATH = path.join(__dirname, '..', 'shared', 'rooms.json');

export function loadRoomsConfig(file = DEFAULT_ROOMS_PATH) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

const TOOL_ACTIVITY = {
  Edit: 'typing', Write: 'typing', MultiEdit: 'typing', NotebookEdit: 'typing',
  Read: 'reading', Grep: 'reading', Glob: 'reading', LS: 'reading',
  Bash: 'machine',
  WebSearch: 'searching', WebFetch: 'searching',
  Task: 'typing', Agent: 'typing',
};

export function activityForTool(tool) {
  return (tool && TOOL_ACTIVITY[tool]) || 'thinking';
}

const MAX_MSG = 160;
function clip(s) {
  if (s == null) return null;
  s = String(s).replace(/\s+/g, ' ').trim();
  if (!s) return null;
  return s.length > MAX_MSG ? s.slice(0, MAX_MSG - 1) + '…' : s;
}

function describeToolInput(input) {
  if (!input || typeof input !== 'object') return null;
  for (const k of ['command', 'file_path', 'notebook_path', 'pattern', 'url', 'query', 'description', 'path', 'prompt']) {
    if (typeof input[k] === 'string' && input[k]) return input[k];
  }
  return null;
}

const PUBLIC_FIELDS = ['id', 'room', 'location', 'visitor', 'state', 'activity', 'tool',
  'since', 'lastEventAt', 'tasksDone', 'lastMessage'];

/**
 * @param {object} [opts]
 * @param {() => number} [opts.now]   relógio (ms)
 * @param {object} [opts.rooms]       conteúdo de rooms.json (senão lê do disco)
 * @param {string} [opts.roomsPath]
 * @param {object} [opts.timers]      override parcial de rooms.timers
 */
export function createState(opts = {}) {
  const now = opts.now || (() => Date.now());
  const config = opts.rooms || loadRoomsConfig(opts.roomsPath);
  const timers = { ...config.timers, ...(opts.timers || {}) };
  const roomIds = config.rooms.map((r) => r.id);
  const defaultRoom = config.defaultRoom || 'orquestrador';

  /** @type {Map<string, any>} */
  const agents = new Map();
  /** agent_id do Claude Code → id do personagem */
  const agentIdMap = new Map();

  function makeAgent(id, room, visitor, t) {
    return {
      id, room, location: room, visitor,
      state: 'absent', activity: null, tool: null,
      since: t, lastEventAt: t, tasksDone: 0, lastMessage: null,
      // internos
      _until: null, // fim de done/error
      _resume: null, // estado a restaurar depois do error
    };
  }

  for (const id of roomIds) agents.set(id, makeAgent(id, id, false, now()));

  function pub(a) {
    const o = {};
    for (const k of PUBLIC_FIELDS) o[k] = a[k];
    return o;
  }

  function sig(a) {
    return PUBLIC_FIELDS.map((k) => a[k]).join('|');
  }

  function setState(a, state, activity = null, tool = a.tool, t = now()) {
    if (a.state !== state || a.activity !== activity) a.since = t;
    a.state = state;
    a.activity = state === 'working' ? activity : null;
    a.tool = tool;
  }

  function resolveAgent(ev) {
    const type = typeof ev.agent_type === 'string' ? ev.agent_type.trim() : '';
    const agentId = typeof ev.agent_id === 'string' && ev.agent_id ? ev.agent_id : null;
    let id;
    if (type) {
      const lower = type.toLowerCase();
      const match = roomIds.find((r) => r === type || r === lower);
      id = match || `visitante:${type}`;
    } else if (agentId && agentIdMap.has(agentId)) {
      id = agentIdMap.get(agentId);
    } else {
      id = defaultRoom;
    }
    if (agentId && id) agentIdMap.set(agentId, id);
    let a = agents.get(id);
    if (!a) {
      a = makeAgent(id, 'lounge', true, now());
      agents.set(id, a);
    }
    return a;
  }

  function summarize(hook, a, tool, msg) {
    const parts = [a.id, hook];
    if (tool) parts.push(tool);
    let s = parts.join(' · ');
    if (msg) s += `: ${msg}`;
    return s.length > 200 ? s.slice(0, 199) + '…' : s;
  }

  /**
   * Aplica um evento de hook. Retorna { changed: Agent[], log: object|null }.
   */
  function handle(ev) {
    if (!ev || typeof ev !== 'object') return { changed: [], log: null };
    const hook = ev.hook_event_name;
    if (typeof hook !== 'string' || !hook) return { changed: [], log: null };
    const t = now();
    const before = new Map([...agents].map(([k, a]) => [k, sig(a)]));
    const tool = typeof ev.tool_name === 'string' && ev.tool_name ? ev.tool_name : null;
    let target = null;
    let msg = null;

    const wake = (a) => {
      a.location = a.room;
      a.lastEventAt = t;
    };

    // Aplica um estado "de trabalho" respeitando um error em exibição.
    const apply = (a, state, activity, toolName) => {
      wake(a);
      if (a.state === 'error' && a._until != null && t < a._until) {
        a._resume = { state, activity, tool: toolName };
        return;
      }
      a._until = null;
      a._resume = null;
      setState(a, state, activity, toolName, t);
    };

    switch (hook) {
      case 'SessionStart': {
        for (const a of agents.values()) {
          if (a.visitor) continue;
          if (a.state === 'absent') {
            setState(a, 'idle', null, null, t);
            a.lastEventAt = t;
            a.location = a.room;
          }
        }
        target = agents.get(defaultRoom);
        msg = clip(ev.source ? `sessão (${ev.source})` : 'sessão iniciada');
        break;
      }
      case 'SessionEnd': {
        for (const a of agents.values()) {
          a._until = null;
          a._resume = null;
          setState(a, 'idle', null, null, t);
          wake(a);
        }
        target = agents.get(defaultRoom);
        msg = clip(ev.reason || 'sessão encerrada');
        break;
      }
      case 'UserPromptSubmit': {
        target = agents.get(defaultRoom);
        msg = clip(ev.prompt);
        apply(target, 'working', 'thinking', null);
        if (msg) target.lastMessage = msg;
        break;
      }
      case 'SubagentStart': {
        target = resolveAgent(ev);
        msg = clip(ev.message || ev.prompt || ev.description);
        apply(target, 'working', 'thinking', null);
        if (msg) target.lastMessage = msg;
        break;
      }
      case 'PreToolUse': {
        target = resolveAgent(ev);
        msg = clip(describeToolInput(ev.tool_input) || ev.message);
        apply(target, 'working', activityForTool(tool), tool);
        if (msg) target.lastMessage = msg;
        break;
      }
      case 'PostToolUse': {
        target = resolveAgent(ev);
        const keepActivity = target.state === 'working' ? target.activity : activityForTool(tool);
        apply(target, 'working', keepActivity, tool || target.tool);
        break;
      }
      case 'PostToolUseFailure': {
        target = resolveAgent(ev);
        wake(target);
        msg = clip(ev.error || ev.message);
        if (target.state !== 'error') {
          target._resume = { state: target.state, activity: target.activity, tool: target.tool };
          if (target._resume.state === 'absent') target._resume = { state: 'idle', activity: null, tool: null };
        }
        setState(target, 'error', null, tool || target.tool, t);
        target._until = t + timers.errorMs;
        if (msg) target.lastMessage = msg;
        break;
      }
      case 'Notification': {
        target = resolveAgent(ev);
        msg = clip(ev.message);
        apply(target, 'waiting', null, target.tool);
        if (msg) target.lastMessage = msg;
        break;
      }
      case 'SubagentStop': {
        target = resolveAgent(ev);
        wake(target);
        msg = clip(ev.message || 'tarefa concluída');
        setState(target, 'done', null, null, t);
        target._resume = null;
        target._until = t + timers.doneMs;
        target.tasksDone += 1;
        break;
      }
      case 'Stop': {
        target = agents.get(defaultRoom);
        wake(target);
        msg = clip(ev.message || 'resposta concluída');
        setState(target, 'done', null, null, t);
        target._resume = null;
        target._until = t + timers.doneMs;
        target.tasksDone += 1;
        break;
      }
      default: {
        // Evento desconhecido: acorda o agente e registra no log, sem mudar o estado.
        target = resolveAgent(ev);
        wake(target);
        msg = clip(ev.message);
      }
    }

    const changed = [];
    for (const [k, a] of agents) if (before.get(k) !== sig(a)) changed.push(pub(a));

    const log = {
      at: t,
      agentId: target ? target.id : defaultRoom,
      hook,
      tool,
      summary: summarize(hook, target || { id: defaultRoom }, tool, msg),
    };
    return { changed, log };
  }

  /** Aplica timers. Retorna os agentes que mudaram. */
  function tick() {
    const t = now();
    const changed = [];
    for (const a of agents.values()) {
      const before = sig(a);
      if ((a.state === 'error' || a.state === 'done') && a._until != null && t >= a._until) {
        const end = a._until;
        if (a.state === 'error' && a._resume) {
          const r = a._resume;
          setState(a, r.state, r.activity, r.tool, end);
        } else {
          setState(a, 'idle', null, null, end);
        }
        a._until = null;
        a._resume = null;
      }
      if (a.state === 'idle' || a.state === 'dozing' || a.state === 'sleeping') {
        const idleFor = t - a.lastEventAt;
        if (idleFor >= timers.loungeAfterMs) {
          setState(a, 'sleeping', null, null, t);
          a.location = 'lounge';
        } else if (idleFor >= timers.sleepAfterMs) {
          setState(a, 'sleeping', null, null, t);
        } else if (idleFor >= timers.dozeAfterMs) {
          setState(a, 'dozing', null, null, t);
        }
      }
      if (sig(a) !== before) changed.push(pub(a));
    }
    return changed;
  }

  function snapshot() {
    return [...agents.values()].map(pub);
  }

  function get(id) {
    const a = agents.get(id);
    return a ? pub(a) : undefined;
  }

  return { handle, tick, snapshot, get, config, timers, now };
}
