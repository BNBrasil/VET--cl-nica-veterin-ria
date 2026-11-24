// Servidor do Escritório de IA: HTTP nativo + WebSocket (ws) em /ws.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { createState, DEFAULT_ROOMS_PATH } from './state.js';
import { ClaudeBridge } from './claude.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const MAX_BODY = 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
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

  // Só aceita chamadas da própria página (protege contra outros sites mandando comandos para o localhost).
  function sameOrigin(req) {
    const host = String(req.headers.host || '').toLowerCase();
    const hostname = host.replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
    if (!['127.0.0.1', 'localhost', '::1'].includes(hostname)) return false;
    const origin = req.headers.origin;
    if (origin && origin !== 'http://' + host) return false;
    return true;
  }

  async function handleApi(req, res, p) {
    if (!bridge) return send(res, 404, 'chat desativado');
    if (!sameOrigin(req)) return send(res, 403, 'forbidden');
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
  function listen(port = 4317, host = '127.0.0.1') {
    return new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, () => {
        server.off('error', reject);
        if (tickMs > 0) {
          timer = setInterval(tick, tickMs);
          timer.unref();
        }
        const addr = server.address();
        const shownHost = addr.address.includes(':') ? `[${addr.address}]` : addr.address;
        const url = `http://${shownHost}:${addr.port}`;
        log(`[escritorio] ${url}  (WebSocket ${url.replace('http', 'ws')}/ws)`);
        resolve({ port: addr.port, url });
      });
    });
  }

  function close() {
    if (timer) clearInterval(timer);
    bridge?.shutdown();
    for (const c of wss.clients) c.terminate();
    wss.close();
    return new Promise((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections?.();
    });
  }

  return { server, wss, state, bridge, listen, close, tick, ingest, set onShutdown(fn) { onShutdown = fn; } };
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
