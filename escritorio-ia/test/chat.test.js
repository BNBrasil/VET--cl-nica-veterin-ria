import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { StreamParser, toolSummary, ClaudeBridge } from '../server/claude.js';
import { createServer } from '../server/index.js';

const rooms = JSON.parse(readFileSync(new URL('../shared/rooms.json', import.meta.url))).rooms;

test('parser: texto da sessão principal é do orquestrador', () => {
  const p = new StreamParser(rooms);
  const r = p.parse({ type: 'assistant', message: { content: [{ type: 'text', text: 'Oi' }] } });
  assert.deepEqual(r.msgs, [{ kind: 'text', agent: 'orquestrador', text: 'Oi' }]);
});

test('parser: delegação e texto do subagente com o agente certo', () => {
  const p = new StreamParser(rooms);
  const d = p.parse({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'tu1', name: 'Agent', input: { subagent_type: 'revisor', description: 'Revisar' } }] } });
  assert.equal(d.msgs[0].kind, 'delegate');
  assert.equal(d.msgs[0].alvo, 'revisor');
  const t = p.parse({ type: 'assistant', parent_tool_use_id: 'tu1', message: { content: [{ type: 'text', text: 'OK' }, { type: 'tool_use', id: 'x', name: 'Read', input: { file_path: 'a.md' } }] } });
  assert.deepEqual(t.msgs[0], { kind: 'text', agent: 'revisor', text: 'OK' });
  assert.deepEqual(t.msgs[1], { kind: 'tool', agent: 'revisor', tool: 'Read', text: 'a.md' });
});

test('parser: agente desconhecido vira visitante; init dá a sessão; result com erro e bloqueios', () => {
  const p = new StreamParser(rooms);
  p.parse({ type: 'system', subtype: 'task_started', tool_use_id: 'z', subagent_type: 'Explore' });
  assert.equal(p.parse({ type: 'assistant', parent_tool_use_id: 'z', message: { content: [{ type: 'text', text: 'a' }] } }).msgs[0].agent, 'visitante:Explore');
  assert.equal(p.parse({ type: 'system', subtype: 'init', session_id: 's1' }).sessionId, 's1');
  const r = p.parse({ type: 'result', is_error: true, result: 'Not logged in', permission_denials: [{ tool_name: 'Bash' }] });
  assert.equal(r.msgs.length, 2);
  assert.match(r.msgs[0].text, /Bash/);
  assert.equal(r.msgs[1].kind, 'error');
});

test('toolSummary encurta', () => {
  assert.equal(toolSummary('Bash', { command: 'ls' }), 'ls');
  assert.ok(toolSummary('Bash', { command: 'x'.repeat(500) }).length <= 140);
});

test('bridge: nomes validados e persistidos', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'esc-'));
  const b = new ClaudeBridge({ rooms, dataDir: dir, bin: '/nao/existe' });
  assert.equal(b.nomes.revisor, 'Vera');
  b.setNames({ revisor: '  Bia\u0007 ', hacker: 'x', roteirista: '' });
  assert.equal(b.nomes.revisor, 'Bia');
  assert.equal(b.nomes.roteirista, 'Rita');
  assert.equal(b.nomes.hacker, undefined);
  const b2 = new ClaudeBridge({ rooms, dataDir: dir, bin: '/nao/existe' });
  assert.equal(b2.nomes.revisor, 'Bia');
  assert.equal(b2.setPermissionMode('qualquer'), false);
});

test('api: bloqueia outros sites e exige JSON', async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'esc-'));
  const bridge = new ClaudeBridge({ rooms, dataDir: dir, bin: '/nao/existe' });
  bridge.refresh = async () => bridge.status();
  const app = createServer({ chat: true, bridge, log: false, tickMs: 0 });
  const { port } = await app.listen(0);
  const u = `http://127.0.0.1:${port}/api/nomes`;
  const body = JSON.stringify({ nomes: { revisor: 'Bia' } });
  let r = await fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://evil.example' }, body });
  assert.equal(r.status, 403);
  r = await fetch(u, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body });
  assert.equal(r.status, 415);
  r = await fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: `http://127.0.0.1:${port}` }, body });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).revisor, 'Bia');
  await app.close();
});
