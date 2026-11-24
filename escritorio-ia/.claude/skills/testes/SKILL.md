---
name: testes
description: Use ao escrever ou rodar testes automatizados em Node - node:test + node:assert (sem dependências), estrutura da pasta test/, testes de servidor HTTP e WebSocket em porta aleatória, timers falsos para regras de tempo (cochilar/dormir), e como reportar o resultado.
---

# Testes (node:test)

Runner nativo, sem dependência: `npm test` → `node --test test/`.
```bash
node --test test/                          # tudo
node --test test/estado.test.js            # um arquivo
node --test --test-name-pattern="cochila"  # por nome
node --test --test-reporter=spec test/     # saída legível
node --test --experimental-test-coverage test/   # cobertura (Node ≥ 20)
```

## Estrutura
- `test/<modulo>.test.js`, um arquivo por módulo; nomes de teste em português descrevendo o comportamento:
  `test('SubagentStart do editor-video põe a sala em working/thinking', ...)`.
- Separe lógica pura (máquina de estados) de I/O (http/ws) para testar sem rede.

## Unitário
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarEvento, estadoInicial } from '../server/state.js';

test('PreToolUse Bash vira working/machine', () => {
  const s = estadoInicial();
  aplicarEvento(s, { hook_event_name: 'PreToolUse', tool_name: 'Bash', agent_type: 'editor-video' }, 1000);
  const a = s.agents.get('editor-video');
  assert.equal(a.state, 'working');
  assert.equal(a.activity, 'machine');
});
```
(Ajuste os nomes de import ao que existir em `server/`; leia o código antes.)

## Tempo (cochilar 20 s / dormir 60 s / lounge 120 s)
Prefira funções que recebem `agora` como parâmetro (`tick(estado, agora)`). Se usar timers reais:
```js
import { mock, test } from 'node:test';
test('cochila após dozeAfterMs', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  // ... dispara evento ...
  t.mock.timers.tick(20_000);
  // assert dozing
});
```
Os tempos vêm de `shared/rooms.json` → `timers`; leia de lá no teste também (não fixe 20000 no código).

## Integração HTTP + WebSocket
```js
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { criarServidor } from '../server/index.js';

const srv = await criarServidor({ port: 0 });           // porta livre
const base = `http://127.0.0.1:${srv.address().port}`;
after(() => srv.close());

test('POST /event responde 204 e WS recebe agent', async () => {
  const ws = new WebSocket(base.replace('http', 'ws') + '/ws');
  const msgs = [];
  ws.on('message', (m) => msgs.push(JSON.parse(m)));
  await new Promise((r) => ws.once('open', r));
  const r = await fetch(base + '/event', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ hook_event_name: 'SubagentStart', session_id: 's', agent_type: 'roteirista' }) });
  assert.equal(r.status, 204);
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(msgs.some((m) => m.type === 'agent' && m.agent.id === 'roteirista' && m.agent.state === 'working'));
  ws.close();
});
```

## Hook (send-event.js) nunca quebra
```js
import { spawnSync } from 'node:child_process';
test('hook sai 0 e não imprime nada com servidor desligado', () => {
  const r = spawnSync('node', ['hooks/send-event.js'], { input: '{"hook_event_name":"Stop"}', env: { ...process.env, ESCRITORIO_PORT: '1' }, timeout: 3000 });
  assert.equal(r.status, 0);
  assert.equal(r.stdout.toString(), '');
});
```

## O que testar sempre
- Cada linha da tabela de eventos do `CONTRATO.md` (seção 3).
- `agent_type` desconhecido → visitante `visitante:<tipo>` no lounge.
- JSON inválido → 400; servidor não cai.
- Regressão: todo bug corrigido ganha um teste.

## Reportar
`node --test test/ 2>&1 | tail -8` → copie as linhas `# pass`, `# fail` para o resumo.
