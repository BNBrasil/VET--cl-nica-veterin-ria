import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { WebSocket } from 'ws';
import { createAparencia } from '../server/aparencia.js';
import { RemoteAccess } from '../server/remote.js';
import { ClaudeBridge } from '../server/claude.js';
import { createServer } from '../server/index.js';

const roomsCfg = JSON.parse(readFileSync(new URL('../shared/rooms.json', import.meta.url)));

function sandbox() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'aparencia-'));
  mkdirSync(path.join(dir, 'temas'));
  mkdirSync(path.join(dir, 'assets', 'temas'), { recursive: true });
  mkdirSync(path.join(dir, 'data'));
  writeFileSync(path.join(dir, 'temas', 'padrao.json'), JSON.stringify({ id: 'padrao', nome: 'Padrão', interface: { fundo: '#0f0d16', painel: '#211d30', destaque: '#e0a030' } }));
  writeFileSync(path.join(dir, 'temas', 'neon.json'), JSON.stringify({ id: 'neon', nome: 'Neon', descricao: 'luzes', paleta: { pele: ['#f0c8a0', '#a06a48'] }, interface: { fundo: '#05040a', painel: '#140f24', destaque: '#ff40c0' } }));
  writeFileSync(path.join(dir, 'temas', 'quebrado.json'), '{ isso não é json');
  writeFileSync(path.join(dir, 'assets', 'temas', 'neon.png'), 'x');
  return dir;
}

/** Gerador falso: cada chamada fica pendente até o teste liberar. */
function fakeGen() {
  const calls = [];
  const gerar = (escolha) => new Promise((resolve, reject) => calls.push({ escolha, resolve, reject }));
  return { calls, gerar };
}
const tick = () => new Promise((r) => setTimeout(r, 5));

function mk(dir, extra = {}) {
  const sent = [];
  const fg = fakeGen();
  const ap = createAparencia({ root: dir, temasDir: path.join(dir, 'temas'), assetsDir: path.join(dir, 'assets'), dataFile: path.join(dir, 'data', 'aparencia.json'), rooms: roomsCfg, broadcast: (m) => sent.push(m), gerar: fg.gerar, ...extra });
  return { ap, sent, fg };
}

test('temas: lista os válidos (ignora JSON quebrado), miniatura só quando existe', async () => {
  const dir = sandbox();
  const { ap } = mk(dir);
  const info = await ap.info();
  assert.deepEqual(info.temas.map((t) => t.id), ['padrao', 'neon']);
  assert.equal(info.temas[1].miniatura, 'assets/temas/neon.png');
  assert.equal(info.temas[0].miniatura, null);
  assert.deepEqual(info.temas[1].peles, ['#f0c8a0', '#a06a48']);
  assert.ok(info.opcoes.personagens.some((p) => p.id === 'pesquisador' && p.convidado), 'inclui convidados');
  assert.ok(info.opcoes.salas.some((s) => s.id === 'lounge'), 'inclui salas comuns');
});

test('validação: enumerações do contrato, cores #rrggbb, ids existentes', () => {
  const { ap } = mk(sandbox());
  assert.equal(ap.validar({ tema: 'neon' }).ok, true);
  assert.equal(ap.validar({ tema: 'inexistente' }).ok, false);
  assert.equal(ap.validar({ tema: '../segredo' }).ok, false);
  assert.equal(ap.validar({ mapa: { formato: 'L', tamanhoSala: 'grande' } }).ok, true);
  assert.equal(ap.validar({ mapa: { formato: 'circulo' } }).ok, false);
  assert.equal(ap.validar({ mapa: { outro: 1 } }).ok, false);
  assert.equal(ap.validar({ salas: { roteirista: { destaque: '#ffcc00', piso: 'madeira', parede: 'tijolo' } } }).ok, true);
  assert.equal(ap.validar({ salas: { lounge: { piso: 'grama' } } }).ok, true);
  assert.equal(ap.validar({ salas: { roteirista: { destaque: 'red' } } }).ok, false);
  assert.equal(ap.validar({ salas: { roteirista: { destaque: '#fff' } } }).ok, false);
  assert.equal(ap.validar({ salas: { roteirista: { piso: 'lava' } } }).ok, false);
  assert.equal(ap.validar({ salas: { cozinha: { piso: 'madeira' } } }).ok, false);
  assert.equal(ap.validar({ salas: { roteirista: { janela: 'sim' } } }).ok, false);
  const p = { pele: 2, cabelo: 'longo', corCabelo: '#c0402a', roupa: '#3060c0', calca: '#202020', acessorio: 'oculos' };
  assert.equal(ap.validar({ personagens: { roteirista: p, 'social-media': p } }).ok, true, 'convidado aceito');
  assert.equal(ap.validar({ personagens: { roteirista: { pele: -1 } } }).ok, false);
  assert.equal(ap.validar({ personagens: { roteirista: { pele: 1.5 } } }).ok, false);
  assert.equal(ap.validar({ personagens: { roteirista: { cabelo: 'rastafari' } } }).ok, false);
  assert.equal(ap.validar({ personagens: { roteirista: { acessorio: 'espada' } } }).ok, false);
  assert.equal(ap.validar({ personagens: { roteirista: { roupa: '#12345g' } } }).ok, false);
  assert.equal(ap.validar({ personagens: { ninguem: { pele: 1 } } }).ok, false);
  assert.equal(ap.validar([]).ok, false);
});

test('gravação: escrita atômica, mescla e preserva campos desconhecidos; null apaga ajuste', () => {
  const dir = sandbox();
  const file = path.join(dir, 'data', 'aparencia.json');
  writeFileSync(file, JSON.stringify({ tema: 'padrao', futuro: { x: 1 }, salas: { roteirista: { piso: 'madeira', extra: 'ok' } } }));
  const { ap } = mk(dir);
  const r = ap.salvar({ tema: 'neon', salas: { roteirista: { destaque: '#ffcc00' } }, personagens: { locutor: { cabelo: 'moicano' } } });
  assert.equal(r.ok, true);
  const d = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(d.tema, 'neon');
  assert.deepEqual(d.futuro, { x: 1 });
  assert.deepEqual(d.salas.roteirista, { piso: 'madeira', extra: 'ok', destaque: '#ffcc00' });
  assert.deepEqual(d.personagens.locutor, { cabelo: 'moicano' });
  assert.ok(!readdirSync(path.join(dir, 'data')).some((f) => f.endsWith('.tmp')), 'sem temporários');
  ap.salvar({ salas: { roteirista: { piso: null } }, personagens: { locutor: null } });
  const d2 = JSON.parse(readFileSync(file, 'utf8'));
  assert.deepEqual(d2.salas.roteirista, { extra: 'ok', destaque: '#ffcc00' });
  assert.equal(d2.personagens, undefined);
  const bad = ap.salvar({ tema: 'nada' });
  assert.equal(bad.ok, false);
  assert.match(bad.erro, /tema desconhecido/);
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).tema, 'neon', 'pedido inválido não grava nada');
  // restaurar: volta ao padrão, mantém campos desconhecidos
  ap.restaurar();
  const d3 = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(d3.tema, 'padrao');
  assert.equal(d3.salas, undefined);
  assert.deepEqual(d3.futuro, { x: 1 });
});

test('fila de geração: um por vez, pedidos durante a geração viram UMA geração extra; erro vira mensagem', async () => {
  const dir = sandbox();
  const { ap, sent, fg } = mk(dir);
  assert.equal(ap.aplicar().estado, 'gerando');
  await tick();
  assert.equal(fg.calls.length, 1);
  const r2 = ap.aplicar();
  ap.aplicar();
  assert.equal(r2.fila, true);
  assert.equal(ap.status().estado, 'gerando');
  await tick();
  assert.equal(fg.calls.length, 1, 'não roda dois ao mesmo tempo');
  fg.calls[0].resolve();
  await tick();
  assert.equal(fg.calls.length, 2, 'a fila roda depois');
  assert.equal(sent.filter((m) => m.type === 'aparencia').length, 1);
  fg.calls[1].reject(new Error('o gerador de arte falhou: cor fora da paleta'));
  await tick();
  assert.equal(fg.calls.length, 2, 'fila não se repete');
  assert.equal(ap.status().estado, 'erro');
  assert.match(ap.status().erro, /cor fora da paleta/);
  const last = sent[sent.length - 1];
  assert.equal(last.type, 'aparencia_estado');
  assert.equal(last.estado, 'erro');
  // depois do erro dá para aplicar de novo
  ap.aplicar();
  await tick();
  fg.calls[2].resolve();
  await tick();
  assert.equal(ap.status().estado, 'pronto');
  assert.equal(ap.status().erro, null);
});

function req(port, { method = 'GET', path: p = '/', host, headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request({ port, host: '127.0.0.1', method, path: p, headers: { Host: host || `127.0.0.1:${port}`, ...headers } }, (res) => {
      let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => resolve({ status: res.statusCode, body: d, json: () => JSON.parse(d) }));
    });
    r.on('error', reject);
    if (body) r.end(typeof body === 'string' ? body : JSON.stringify(body)); else r.end();
  });
}

test('rotas: aparelho não pareado barrado; computador e pareado aceitos; broadcast após aplicar', async () => {
  const dir = sandbox();
  const bridge = new ClaudeBridge({ rooms: roomsCfg.rooms, dataDir: path.join(dir, 'data'), bin: '/nao/existe' });
  bridge.refresh = async () => bridge.status();
  const remote = new RemoteAccess({ dataDir: path.join(dir, 'data') });
  remote.setEnabled(true);
  const fg = fakeGen();
  const app = createServer({ chat: true, bridge, remote, log: false, tickMs: 0, root: dir, temasDir: path.join(dir, 'temas'), assetsDir: path.join(dir, 'assets'), gerarArte: fg.gerar });
  const { port } = await app.listen(0);
  const json = { 'Content-Type': 'application/json' };
  const phone = '192.168.0.50:' + port;
  try {
    // não pareado
    assert.equal((await req(port, { host: phone, path: '/api/aparencia' })).status, 401);
    assert.equal((await req(port, { method: 'POST', host: phone, path: '/api/aparencia/aplicar', headers: json, body: {} })).status, 401);
    // outro site
    assert.equal((await req(port, { method: 'POST', path: '/api/aparencia', headers: { ...json, Origin: 'http://mal.example' }, body: { tema: 'neon' } })).status, 403);
    // computador
    const g = await req(port, { path: '/api/aparencia' });
    assert.equal(g.status, 200);
    assert.ok(g.json().temas.length >= 2);
    assert.equal((await req(port, { method: 'POST', path: '/api/aparencia', headers: json, body: { tema: 'xx' } })).status, 400);
    assert.equal((await req(port, { method: 'POST', path: '/api/aparencia', body: '{}' })).status, 415);
    const s = await req(port, { method: 'POST', path: '/api/aparencia', headers: json, body: { tema: 'neon' } });
    assert.equal(s.status, 200, s.body);
    assert.equal(JSON.parse(readFileSync(path.join(dir, 'data', 'aparencia.json'), 'utf8')).tema, 'neon');
    // pareado
    const { codigo } = remote.newCode();
    const { token } = remote.pair(codigo, 'iPhone');
    const cookie = { Cookie: 'esc_token=' + encodeURIComponent(token) };
    assert.equal((await req(port, { host: phone, path: '/api/aparencia', headers: cookie })).status, 200);
    const p = await req(port, { method: 'POST', host: phone, path: '/api/aparencia', headers: { ...json, ...cookie }, body: { personagens: { pesquisador: { cabelo: 'gorro' } } } });
    assert.equal(p.status, 200);

    // broadcast pelo WebSocket após aplicar
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const msgs = [];
    ws.on('message', (d) => msgs.push(JSON.parse(d)));
    await new Promise((r) => ws.on('open', r));
    const a = await req(port, { method: 'POST', host: phone, path: '/api/aparencia/aplicar', headers: { ...json, ...cookie }, body: {} });
    assert.equal(a.status, 200);
    assert.equal(a.json().estado, 'gerando');
    assert.equal((await req(port, { path: '/api/aparencia' })).json().estado.estado, 'gerando');
    await tick();
    fg.calls[0].resolve();
    for (let i = 0; i < 50 && !msgs.some((m) => m.type === 'aparencia'); i++) await tick();
    const m = msgs.find((x) => x.type === 'aparencia');
    assert.ok(m, 'recebeu {type:"aparencia"}');
    assert.equal(m.tema, 'neon');
    assert.ok(m.versao > 0);
    assert.equal(m.interface.destaque, '#ff40c0');
    assert.ok(msgs.some((x) => x.type === 'aparencia_estado' && x.estado === 'gerando'));
    ws.close();
    // restaurar
    const rs = await req(port, { method: 'POST', path: '/api/aparencia/restaurar', headers: json, body: {} });
    assert.equal(rs.status, 200);
    assert.equal(JSON.parse(readFileSync(path.join(dir, 'data', 'aparencia.json'), 'utf8')).tema, 'padrao');
    await tick();
    fg.calls[1]?.resolve();
    await tick();
  } finally {
    await app.close();
  }
});
