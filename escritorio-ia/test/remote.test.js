import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { RemoteAccess } from '../server/remote.js';
import { ClaudeBridge } from '../server/claude.js';
import { createServer } from '../server/index.js';

const rooms = JSON.parse(readFileSync(new URL('../shared/rooms.json', import.meta.url))).rooms;

// fetch não deixa trocar o Host; com http.request dá para simular um celular (Host = IP da rede).
function req(port, { method = 'GET', path: p = '/', host, headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request({ port, host: '127.0.0.1', method, path: p, headers: { Host: host || `127.0.0.1:${port}`, ...headers } }, (res) => {
      let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: d }));
    });
    r.on('error', reject);
    if (body) r.end(typeof body === 'string' ? body : JSON.stringify(body)); else r.end();
  });
}

test('pareamento: código de uso único, expira e limita tentativas', () => {
  let t = 1000;
  const r = new RemoteAccess({ dataDir: mkdtempSync(path.join(os.tmpdir(), 'rm-')), now: () => t });
  const { codigo } = r.newCode();
  assert.equal(r.pair('000000' === codigo ? '111111' : '000000').ok, false);
  const ok = r.pair(codigo, 'Mozilla/5.0 (Linux; Android 14) Chrome/120');
  assert.equal(ok.ok, true);
  assert.match(ok.aparelho.nome, /Android/);
  assert.equal(r.pair(codigo).ok, false, 'uso único');
  const c2 = r.newCode().codigo;
  t += 6 * 60 * 1000;
  assert.equal(r.pair(c2).ok, false, 'expirou');
  const c3 = r.newCode().codigo;
  for (let i = 0; i < 8; i++) r.pair('x');
  assert.equal(r.pair(c3).ok, false, 'bloqueado por tentativas');
  assert.ok(!JSON.stringify(r.devices).includes(ok.token), 'token não fica salvo em claro');
});

test('servidor: celular sem pareamento é barrado; pareado entra; ações de admin só no computador', async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'rm-'));
  const bridge = new ClaudeBridge({ rooms, dataDir: dir, bin: '/nao/existe' });
  bridge.refresh = async () => bridge.status();
  const app = createServer({ chat: true, bridge, log: false, tickMs: 0 });
  const { port } = await app.listen(0);
  const phone = '192.168.0.50:' + port;
  const json = { 'Content-Type': 'application/json' };

  assert.equal((await req(port, { host: phone, path: '/' })).status, 200, 'página estática abre');
  assert.equal((await req(port, { host: phone, path: '/api/claude' })).status, 401);
  assert.equal((await req(port, { host: phone, path: '/state' })).status, 401);
  assert.equal((await req(port, { method: 'POST', host: phone, path: '/event', headers: json, body: {} })).status, 403);
  // acesso remoto desligado: nem pareia
  assert.equal((await req(port, { method: 'POST', host: phone, path: '/api/parear', headers: json, body: { codigo: '123456' } })).status, 403);

  // o computador liga o acesso e gera o código (o servidor reabre a porta)
  assert.equal((await req(port, { method: 'POST', path: '/api/remoto/ativar', headers: json, body: { ativo: true } })).status, 200);
  await new Promise((r) => setTimeout(r, 700));
  assert.equal((await req(port, { method: 'POST', host: phone, path: '/api/remoto/codigo', headers: json, body: {} })).status, 401, 'celular não gera código');
  const code = JSON.parse((await req(port, { method: 'POST', path: '/api/remoto/codigo', headers: json, body: {} })).body);
  assert.match(code.codigo, /^\d{6}$/);
  const qr = await req(port, { path: '/api/remoto/qr.svg?url=' + encodeURIComponent('http://192.168.0.5:4317/?parear=' + code.codigo) });
  assert.equal(qr.status, 200);
  assert.match(qr.body, /<svg/);

  const paired = await req(port, { method: 'POST', host: phone, path: '/api/parear', headers: { ...json, 'User-Agent': 'iPhone Safari/1' }, body: { codigo: code.codigo } });
  assert.equal(paired.status, 200);
  const cookie = paired.headers['set-cookie'][0].split(';')[0];
  assert.match(paired.headers['set-cookie'][0], /HttpOnly; SameSite=Strict/);

  const auth = { Cookie: cookie };
  assert.equal((await req(port, { host: phone, path: '/api/claude', headers: auth })).status, 200);
  assert.equal((await req(port, { host: phone, path: '/state', headers: auth })).status, 200);
  assert.equal((await req(port, { method: 'POST', host: phone, path: '/api/chave', headers: { ...json, ...auth }, body: { chave: 'x' } })).status, 403, 'chave só no computador');
  assert.equal((await req(port, { method: 'POST', host: phone, path: '/api/desligar', headers: { ...json, ...auth }, body: {} })).status, 403);
  assert.equal((await req(port, { method: 'POST', host: phone, path: '/api/nomes', headers: { ...json, ...auth, Origin: 'http://evil.example' }, body: { nomes: {} } })).status, 403, 'outro site');
  const nomes = await req(port, { method: 'POST', host: phone, path: '/api/nomes', headers: { ...json, ...auth, Origin: 'http://' + phone }, body: { nomes: { revisor: 'Bia' } } });
  assert.equal(nomes.status, 200);

  // revogado pelo computador → perde o acesso
  const list = JSON.parse((await req(port, { path: '/api/remoto' })).body);
  assert.equal(list.aparelhos.length, 1);
  await req(port, { method: 'POST', path: '/api/remoto/revogar', headers: json, body: { id: list.aparelhos[0].id } });
  assert.equal((await req(port, { host: phone, path: '/api/claude', headers: auth })).status, 401);
  await app.close();
});
