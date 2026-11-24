import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';
import { createServer } from '../server/index.js';

let app, port, dir;

before(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'escritorio-test-'));
  mkdirSync(path.join(dir, 'public', 'js'), { recursive: true });
  writeFileSync(path.join(dir, 'public', 'index.html'), '<!doctype html><title>t</title>');
  writeFileSync(path.join(dir, 'public', 'js', 'app.js'), 'export {}');
  writeFileSync(path.join(dir, 'secret.txt'), 'SEGREDO');
  app = createServer({ publicDir: path.join(dir, 'public'), log: null, tickMs: 0 });
  ({ port } = await app.listen(0, '127.0.0.1'));
});

after(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true });
});

function request(method, p, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: p, method, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.end(body);
  });
}

// Envia uma linha de requisição crua (sem normalização do cliente).
function rawGet(p) {
  return new Promise((resolve, reject) => {
    const sock = net.connect(port, '127.0.0.1', () => {
      sock.write(`GET ${p} HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n`);
    });
    let data = '';
    sock.on('data', (c) => (data += c));
    sock.on('end', () => resolve(data));
    sock.on('error', reject);
  });
}

test('GET / serve index.html com content-type html', async () => {
  const r = await request('GET', '/');
  assert.equal(r.status, 200);
  assert.match(r.headers['content-type'], /text\/html/);
  assert.match(r.body, /doctype/);
  const js = await request('GET', '/js/app.js');
  assert.match(js.headers['content-type'], /javascript/);
});

test('GET /shared/rooms.json', async () => {
  const r = await request('GET', '/shared/rooms.json');
  assert.equal(r.status, 200);
  assert.match(r.headers['content-type'], /application\/json/);
  assert.equal(JSON.parse(r.body).rooms.length, 8);
});

test('path traversal bloqueado', async () => {
  for (const p of ['/../secret.txt', '/..%2fsecret.txt', '/%2e%2e/secret.txt', '/js/..%2f..%2fsecret.txt', '/..\\secret.txt']) {
    const raw = await rawGet(p);
    assert.doesNotMatch(raw, /SEGREDO/, p);
    assert.match(raw, /^HTTP\/1\.1 (403|404|400)/, p);
  }
  const miss = await request('GET', '/nao-existe.png');
  assert.equal(miss.status, 404);
});

test('POST /event → 204, WebSocket recebe snapshot/agent/event, GET /state reflete', async () => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const messages = [];
  const waitFor = (pred) => new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('timeout esperando mensagem')), 2000);
    const check = () => {
      const m = messages.find(pred);
      if (m) { clearTimeout(to); resolve(m); return true; }
      return false;
    };
    if (!check()) ws.on('message', () => check());
  });
  ws.on('message', (d) => messages.push(JSON.parse(d.toString())));

  const snap = await waitFor((m) => m.type === 'snapshot');
  assert.equal(snap.agents.length, 8);
  assert.equal(typeof snap.serverTime, 'number');

  const ev = { hook_event_name: 'PreToolUse', session_id: 's', tool_name: 'Bash', agent_type: 'editor-video', agent_id: 'e1', tool_input: { command: 'ffmpeg -i x' } };
  const r = await request('POST', '/event', JSON.stringify(ev), { 'Content-Type': 'application/json' });
  assert.equal(r.status, 204);

  const am = await waitFor((m) => m.type === 'agent' && m.agent.id === 'editor-video');
  assert.equal(am.agent.state, 'working');
  assert.equal(am.agent.activity, 'machine');
  assert.equal(am.agent.lastMessage, 'ffmpeg -i x');
  const em = await waitFor((m) => m.type === 'event');
  assert.equal(em.event.agentId, 'editor-video');
  assert.equal(em.event.hook, 'PreToolUse');
  assert.equal(em.event.tool, 'Bash');
  ws.close();

  const st = await request('GET', '/state');
  assert.equal(st.status, 200);
  const body = JSON.parse(st.body);
  assert.equal(body.rooms.rooms.length, 8);
  assert.equal(typeof body.serverTime, 'number');
  assert.equal(body.agents.find((a) => a.id === 'editor-video').state, 'working');
});

test('POST /event com JSON inválido → 400; corpo grande → 413', async () => {
  const r = await request('POST', '/event', '{nope', { 'Content-Type': 'application/json' });
  assert.equal(r.status, 400);
  const big = await request('POST', '/event', 'x'.repeat(1024 * 1024 + 10)).catch((e) => ({ status: 'reset', e }));
  assert.ok(big.status === 413 || big.status === 'reset');
});

test('WebSocket fora de /ws é recusado', async () => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/outro`);
  await new Promise((resolve) => { ws.on('error', resolve); ws.on('unexpected-response', resolve); });
});
