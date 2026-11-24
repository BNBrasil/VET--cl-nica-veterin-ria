// Rede: carrega /shared/rooms.json e mantém o WebSocket /ws com reconexão (backoff exponencial).

export async function loadRooms() {
  const r = await fetch('/shared/rooms.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error('rooms.json: HTTP ' + r.status);
  return r.json();
}

/**
 * Conecta ao servidor e chama os handlers:
 *  onStatus(status, info)  status ∈ 'connecting' | 'open' | 'closed'; info.retryIn (ms) quando closed
 *  onSnapshot(agents, serverTime)
 *  onAgent(agent)
 *  onEvent(event)
 * Retorna { close() }.
 */
export function connect({ onStatus, onSnapshot, onAgent, onEvent }) {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${proto}//${location.host}/ws`;
  let ws = null;
  let delay = 1000;
  const MAX = 15000;
  let timer = null;
  let stopped = false;

  function schedule() {
    if (stopped) return;
    const wait = delay;
    delay = Math.min(MAX, delay * 2);
    onStatus?.('closed', { retryIn: wait, retryAt: Date.now() + wait });
    timer = setTimeout(open, wait);
  }

  function open() {
    if (stopped) return;
    onStatus?.('connecting', {});
    try {
      ws = new WebSocket(url);
    } catch (e) {
      schedule();
      return;
    }
    ws.onopen = () => { delay = 1000; onStatus?.('open', {}); };
    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.type === 'snapshot') onSnapshot?.(msg.agents || [], msg.serverTime);
      else if (msg.type === 'agent' && msg.agent) onAgent?.(msg.agent);
      else if (msg.type === 'event' && msg.event) onEvent?.(msg.event);
    };
    ws.onclose = () => { ws = null; schedule(); };
    ws.onerror = () => { /* onclose vem em seguida */ };
  }

  open();
  return {
    close() { stopped = true; clearTimeout(timer); ws?.close(); },
  };
}
