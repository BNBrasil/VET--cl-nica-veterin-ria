// Servidor do Escritório de IA: HTTP nativo + WebSocket (ws) em /ws.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { createState, DEFAULT_ROOMS_PATH } from './state.js';
import { ClaudeBridge } from './claude.js';
import { RemoteAccess, originOk, networkAddresses, tailscaleInfo } from './remote.js';
import qrcode from 'qrcode-generator';
import { createProducao } from './producao.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const MAX_BODY = 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
};

function send(res, status, body = '', type = 'text/plain; charset=utf-8', extra = {}) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...extra });
  res.end(body);
}

function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj), 'application/json; charset=utf-8');
}

async function serveFile(res, file, method) {
  try {
    const st = await stat(file);
    if (!st.isFile()) return false;
    const data = await readFile(file);
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': data.length, 'Cache-Control': 'no-cache' });
    res.end(method === 'HEAD' ? undefined : data);
    return true;
  } catch {
    return false;
  }
}

/** Resolve um caminho de URL dentro de baseDir; null se escapar (path traversal) ou for inválido. */
export function safeResolve(baseDir, urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const base = path.resolve(baseDir);
  const full = path.resolve(base, '.' + path.posix.normalize('/' + decoded.replace(/\\/g, '/')));
  // Também rejeita explicitamente qualquer segmento ".." no caminho original.
  if (decoded.split(/[\\/]/).includes('..')) return null;
  if (full !== base && !full.startsWith(base + path.sep)) return null;
  return full;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/**
 * Cria (sem iniciar) o servidor.
 * @param {object} [opts] { publicDir, roomsPath, now, timers, tickMs, log }
 */
export function createServer(opts = {}) {
  const publicDir = opts.publicDir || path.join(ROOT, 'public');
  const roomsPath = opts.roomsPath || DEFAULT_ROOMS_PATH;
  const log = opts.log === undefined ? console.log : opts.log || (() => {});
  const state = createState({ now: opts.now, roomsPath, rooms: opts.rooms, timers: opts.timers });
  const tickMs = opts.tickMs ?? 1000;
  const bridge = opts.chat ? (opts.bridge || new ClaudeBridge({ rooms: state.config.rooms, dataDir: opts.dataDir })) : null;
  let onShutdown = opts.onShutdown || (() => {});

  const remote = bridge ? (opts.remote || new RemoteAccess({ dataDir: bridge.dataDir })) : null;
  // Produção do canal gamer (fila de posts, aprovação, redes sociais, agenda). Só com o chat ligado.
  const producao = bridge ? createProducao({
    bridge, dataDir: bridge.dataDir, dir: opts.producaoDir, now: opts.now, log, rooms: state.config.rooms,
    pollMs: opts.producaoPollMs, agendaMs: opts.agendaMs, publicar: opts.publicar,
    broadcast: (m) => broadcast(m), ingest: (ev) => ingest(ev),
  }) : null;
  let current = { port: 0, host: '127.0.0.1' };

  // Quem está pedindo? Local (o próprio computador) ou um aparelho pareado. Sem o chat ligado, tudo é local.
  function access(req) {
    if (!remote) return { local: true, allowed: true };
    return remote.check(req);
  }
  // Só aceita chamadas da própria página (protege contra outros sites mandando comandos).
  function sameOrigin(req) {
    const a = access(req);
    return a.allowed && originOk(req);
  }

  const LOCAL_ONLY = new Set(['/api/verificar', '/api/instalar', '/api/login', '/api/login/codigo', '/api/login/cancelar',
    '/api/chave', '/api/desligar', '/api/remoto/ativar', '/api/remoto/codigo', '/api/remoto/revogar']);

  async function handleRemoteApi(req, res, p, a) {
    if (p === '/api/acesso') {
      return sendJson(res, 200, { local: a.local, pareado: a.local || !!a.device, remoto: remote.enabled, aparelho: a.device ? remote.publicDevice(a.device) : null });
    }
    if (p === '/api/parear' && req.method === 'POST') {
      if (!remote.enabled) return sendJson(res, 403, { ok: false, erro: 'O acesso pelo celular está desligado no computador.' });
      let body = {};
      try { body = JSON.parse((await readBody(req)) || '{}') || {}; } catch { return send(res, 400, 'invalid json'); }
      const r = remote.pair(body.codigo, req.headers['user-agent']);
      if (!r.ok) return sendJson(res, 403, r);
      const secure = String(req.headers['x-forwarded-proto'] || '').includes('https') || !!req.socket.encrypted;
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Set-Cookie': remote.cookieFor(r.token, secure) });
      return res.end(JSON.stringify({ ok: true, aparelho: r.aparelho }));
    }
    if (p === '/api/remoto/sair' && req.method === 'POST') {
      if (a.device) remote.revoke(a.device.id);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': 'esc_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict' });
      return res.end('{"ok":true}');
    }
    if (!a.local) return send(res, 403, 'só no computador');
    if (p === '/api/remoto' && req.method === 'GET') {
      return sendJson(res, 200, {
        ativo: remote.enabled, porta: current.port, ouvindo: current.host,
        enderecos: networkAddresses(current.port), tailscale: await tailscaleInfo(), aparelhos: remote.list(),
      });
    }
    if (p === '/api/remoto/qr.svg' && req.method === 'GET') {
      const url = new URL(req.url, 'http://x').searchParams.get('url') || '';
      if (!/^https?:\/\/[\w.\-:\[\]]+\/\?parear=\d{6}$/.test(url)) return send(res, 400, 'url inválida');
      const qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      return send(res, 200, qr.createSvgTag({ cellSize: 6, margin: 3, scalable: true }), 'image/svg+xml');
    }
    return null;
  }

  async function relisten() {
    const port = current.port;
    for (const c of wss.clients) c.terminate();
    await new Promise((r) => { server.close(() => r()); server.closeAllConnections?.(); });
    await listenRaw(port, current.baseHost);
  }

  async function handleApi(req, res, p) {
    if (!bridge) return send(res, 404, 'chat desativado');
    const a = access(req);
    if (!originOk(req)) return send(res, 403, 'forbidden');
    if (req.method === 'POST' && !/^application\/json/i.test(req.headers['content-type'] || '')) return send(res, 415, 'use application/json');
    if (p === '/api/acesso' || p === '/api/parear' || p === '/api/remoto/sair' || p.startsWith('/api/remoto')) {
      if (!a.allowed && p !== '/api/acesso' && p !== '/api/parear') return send(res, 401, 'aparelho não pareado');
      if (p === '/api/remoto/ativar' && req.method === 'POST') {
        if (!a.local) return send(res, 403, 'só no computador');
        let body = {};
        try { body = JSON.parse((await readBody(req)) || '{}') || {}; } catch { return send(res, 400, 'invalid json'); }
        remote.setEnabled(!!body.ativo);
        sendJson(res, 200, { ok: true, ativo: remote.enabled });
        setTimeout(() => relisten().catch((e) => log(`[escritorio] erro ao reabrir: ${e.message}`)), 300);
        return;
      }
      if (p === '/api/remoto/codigo' && req.method === 'POST') {
        if (!a.local) return send(res, 403, 'só no computador');
        if (!remote.enabled) return sendJson(res, 400, { erro: 'Ligue o acesso pelo celular primeiro.' });
        const c = remote.newCode();
        const ts = await tailscaleInfo();
        const bases = [...(ts.https ? [{ tipo: 'tailscale-https', url: ts.https }] : []),
          ...networkAddresses(current.port).map((x) => ({ tipo: x.tipo, url: x.url }))];
        return sendJson(res, 200, { ...c, links: bases.map((b) => ({ ...b, url: b.url + '?parear=' + c.codigo })) });
      }
      if (p === '/api/remoto/revogar' && req.method === 'POST') {
        if (!a.local) return send(res, 403, 'só no computador');
        let body = {};
        try { body = JSON.parse((await readBody(req)) || '{}') || {}; } catch { return send(res, 400, 'invalid json'); }
        return sendJson(res, 200, { ok: remote.revoke(String(body.id || '')), aparelhos: remote.list() });
      }
      const r = await handleRemoteApi(req, res, p, a);
      if (r !== null) return;
      return send(res, 404, 'not found');
    }
    if (!a.allowed) return send(res, 401, 'aparelho não pareado');
    if (LOCAL_ONLY.has(p) && !a.local) return send(res, 403, 'só no computador');
    if (p.startsWith('/api/producao') || p === '/api/redes' || p === '/api/agenda') {
      const readJsonBody = async () => {
        try { return JSON.parse((await readBody(req)) || '{}') || {}; } catch { send(res, 400, 'invalid json'); return null; }
      };
      const r = await producao.handle(req, res, p, a, readJsonBody);
      if (r === null && !res.headersSent) return send(res, 404, 'not found');
      return;
    }
    if (req.method === 'GET') {
      if (p === '/api/claude') return sendJson(res, 200, bridge.status());
      if (p === '/api/nomes') return sendJson(res, 200, bridge.nomes);
      return send(res, 404, 'not found');
    }
    if (req.method !== 'POST') return send(res, 405, 'method not allowed');
    if (!/^application\/json/i.test(req.headers['content-type'] || '')) return send(res, 415, 'use application/json');
    let body = {};
    try { body = JSON.parse((await readBody(req)) || '{}') || {}; } catch { return send(res, 400, 'invalid json'); }
    switch (p) {
      case '/api/chat': return sendJson(res, 200, bridge.send(body.texto));
      case '/api/parar': return sendJson(res, 200, { ok: bridge.stop() });
      case '/api/nova-conversa': bridge.newConversation(); return sendJson(res, 200, { ok: true });
      case '/api/verificar': return sendJson(res, 200, await bridge.refresh());
      case '/api/instalar': return sendJson(res, 200, { ok: bridge.install() });
      case '/api/login': return sendJson(res, 200, bridge.startLogin(body.metodo));
      case '/api/login/codigo': return sendJson(res, 200, { ok: bridge.sendLoginCode(body.codigo) });
      case '/api/login/cancelar': bridge.cancelLogin(); await bridge.refresh(); return sendJson(res, 200, { ok: true });
      case '/api/chave': return sendJson(res, 200, await bridge.setApiKey(body.chave || ''));
      case '/api/nomes': return sendJson(res, 200, bridge.setNames(body.nomes));
      case '/api/permissao': return sendJson(res, 200, { ok: bridge.setPermissionMode(body.modo) });
      case '/api/desligar':
        sendJson(res, 200, { ok: true });
        setTimeout(() => onShutdown(), 200);
        return;
      default: return send(res, 404, 'not found');
    }
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const p = url.pathname;

      if (p === '/event') {
        if (remote && !access(req).local) return send(res, 403, 'forbidden');
        if (req.method !== 'POST') return send(res, 405, 'method not allowed', undefined, { Allow: 'POST' });
        let body;
        try {
          body = await readBody(req);
        } catch (e) {
          return send(res, e.status || 400, e.status === 413 ? 'payload too large' : 'bad request', undefined, { Connection: 'close' });
        }
        let ev;
        try {
          ev = JSON.parse(body);
        } catch {
          return send(res, 400, 'invalid json');
        }
        if (!ev || typeof ev !== 'object' || Array.isArray(ev)) return send(res, 400, 'expected json object');
        ingest(ev);
        res.writeHead(204);
        return res.end();
      }

      if (p.startsWith('/api/')) return await handleApi(req, res, p);

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return send(res, 405, 'method not allowed', undefined, { Allow: 'GET, HEAD, POST' });
      }

      if (p === '/state') {
        if (!access(req).allowed) return send(res, 401, 'aparelho não pareado');
        return sendJson(res, 200, { agents: state.snapshot(), rooms: state.config, serverTime: state.now() });
      }
      if (p === '/shared/rooms.json') {
        if (await serveFile(res, roomsPath, req.method)) return;
        return send(res, 404, 'not found');
      }

      const rel = p === '/' ? '/index.html' : p.endsWith('/') ? p + 'index.html' : p;
      const file = safeResolve(publicDir, rel);
      if (!file) return send(res, 403, 'forbidden');
      if (await serveFile(res, file, req.method)) return;
      return send(res, 404, 'not found');
    } catch (e) {
      if (!res.headersSent) send(res, 500, 'internal error');
      else res.end();
    }
  });

  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    let pathname = '';
    try {
      pathname = new URL(req.url, 'http://localhost').pathname;
    } catch {}
    if (pathname !== '/ws' || (bridge && !sameOrigin(req))) {
      socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });
  wss.on('connection', (ws) => {
    ws.on('error', () => {});
    ws.send(JSON.stringify({ type: 'snapshot', agents: state.snapshot(), serverTime: state.now() }));
    if (bridge) {
      ws.send(JSON.stringify({ type: 'chat_snapshot', mensagens: bridge.history, nomes: bridge.nomes, claude: bridge.status() }));
      try { ws.send(JSON.stringify({ type: 'producao', ...producao.estado() })); } catch {}
    }
  });

  if (bridge) {
    bridge.on('chat', (m) => broadcast({ type: 'chat', mensagem: m }));
    bridge.on('status', (st) => broadcast({ type: 'claude', claude: st }));
    bridge.on('nomes', (n) => broadcast({ type: 'nomes', nomes: n }));
    bridge.on('reset', () => broadcast({ type: 'chat_snapshot', mensagens: bridge.history, nomes: bridge.nomes, claude: bridge.status() }));
    bridge.refresh().catch(() => {});
  }

  function broadcast(msg) {
    const data = JSON.stringify(msg);
    for (const c of wss.clients) if (c.readyState === WebSocket.OPEN) c.send(data);
  }

  function ingest(ev) {
    const { changed, log: entry } = state.handle(ev);
    for (const agent of changed) broadcast({ type: 'agent', agent });
    if (entry) broadcast({ type: 'event', event: entry });
  }

  function tick() {
    for (const agent of state.tick()) broadcast({ type: 'agent', agent });
  }

  let timer = null;
  let producaoIniciada = false;
  function listenRaw(port, baseHost) {
    const host = remote?.enabled && ['127.0.0.1', 'localhost', '::1'].includes(baseHost) ? '0.0.0.0' : baseHost;
    return new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, () => {
        server.off('error', reject);
        const addr = server.address();
        current = { port: addr.port, host: addr.address, baseHost };
        const shownHost = addr.address === '0.0.0.0' ? '127.0.0.1' : addr.address.includes(':') ? `[${addr.address}]` : addr.address;
        const url = `http://${shownHost}:${addr.port}`;
        log(`[escritorio] ${url}  (WebSocket ${url.replace('http', 'ws')}/ws)${addr.address === '0.0.0.0' ? '  · acesso pelo celular LIGADO' : ''}`);
        resolve({ port: addr.port, url });
      });
    });
  }
  async function listen(port = 4317, host = '127.0.0.1') {
    const r = await listenRaw(port, host);
    if (tickMs > 0 && !timer) {
      timer = setInterval(tick, tickMs);
      timer.unref();
    }
    if (producao && !producaoIniciada) { producaoIniciada = true; producao.iniciar(); }
    return r;
  }

  function close() {
    if (timer) clearInterval(timer);
    producao?.parar();
    bridge?.shutdown();
    for (const c of wss.clients) c.terminate();
    wss.close();
    return new Promise((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections?.();
    });
  }

  return { server, wss, state, bridge, remote, producao, listen, close, tick, ingest, set onShutdown(fn) { onShutdown = fn; } };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.ESCRITORIO_PORT) || 4317;
  const host = process.env.ESCRITORIO_HOST || '127.0.0.1';
  const app = createServer({ chat: process.env.ESCRITORIO_CHAT !== '0' });
  app.listen(port, host).catch((e) => {
    console.error(`[escritorio] não foi possível abrir ${host}:${port}: ${e.message}`);
    process.exit(1);
  });
  const stop = () => app.close().then(() => process.exit(0));
  app.onShutdown = () => { console.log('[escritorio] desligado pela página.'); stop(); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
