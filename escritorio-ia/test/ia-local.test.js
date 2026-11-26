import { test } from 'node:test';
import assert from 'node:assert/strict';
import { triagem, limparResposta, IaLocal } from '../server/ia-local.js';

const local = [
  'O que significa efêmero?',
  'significado de resiliência',
  'sinônimo de rápido',
  'antônimo de alegre',
  'como se escreve excessão ou exceção?',
  'plural de cidadão',
  'traduza "good morning" para português',
  'como se diz obrigado em inglês',
  'converta 10 polegadas em cm',
  'quanto é 15% de 240',
  'conjugação do verbo fazer no passado',
];
const claude = [
  'Faça um vídeo sobre GTA 6',
  'quais as promoções da Steam hoje?',
  'Rita, escreve um roteiro de 30s',
  'o que significa o novo trailer do GTA?',           // notícia/atual
  'Crie hashtags para um post de jogos',
  'quais os últimos lançamentos?',
  'me explica como funciona o servidor do escritório', // tarefa sobre o projeto
  'oi, tudo bem?',                                     // na dúvida, Claude
  'x'.repeat(300),
];

test('triagem: perguntas simples vão para a IA local', () => {
  for (const t of local) assert.equal(triagem(t).destino, 'local', t);
});
test('triagem: tarefas, coisas atuais e agentes vão para o Claude', () => {
  for (const t of claude) assert.equal(triagem(t).destino, 'claude', t.slice(0, 60));
});
test('triagem: prefixos manuais e nomes personalizados', () => {
  assert.deepEqual(triagem('/local me conta uma piada'), { destino: 'local', texto: 'me conta uma piada', motivo: 'pedido manual (/local)' });
  assert.equal(triagem('/claude sinônimo de belo').destino, 'claude');
  assert.equal(triagem('Zeca, sinônimo de belo', { nomesAgentes: ['Zeca'] }).destino, 'claude');
});
test('limparResposta tira o bloco de pensamento', () => {
  assert.equal(limparResposta('<think>hmm\nok</think>\n\nEfêmero: passageiro.'), 'Efêmero: passageiro.');
});

test('IaLocal: status e pergunta com Ollama falso; desligado não lança erro', async () => {
  const chamadas = [];
  const fake = async (url, init = {}) => {
    chamadas.push({ url, body: init.body ? JSON.parse(init.body) : null });
    if (url.endsWith('/api/tags')) return { ok: true, json: async () => ({ models: [{ name: 'qwen3:4b-instruct' }] }) };
    return { ok: true, json: async () => ({ message: { content: '<think></think>Passageiro, breve.' }, eval_count: 5 }) };
  };
  const ia = new IaLocal({ fetch: fake });
  assert.deepEqual(await ia.status(), { ligado: true, modelos: ['qwen3:4b-instruct'], modelo: 'qwen3:4b-instruct', modeloPronto: true });
  const r = await ia.perguntar('o que significa efêmero?');
  assert.equal(r.texto, 'Passageiro, breve.');
  const body = chamadas.at(-1).body;
  assert.equal(body.think, false);
  assert.equal(body.stream, false);
  assert.equal(body.model, 'qwen3:4b-instruct');

  const off = new IaLocal({ fetch: async () => { throw new Error('ECONNREFUSED'); } });
  assert.equal((await off.status()).ligado, false);
  await assert.rejects(off.perguntar('oi'));
});

test('chat: pergunta simples vai para a IA local; tarefa e falha da IA local vão para o Claude', async () => {
  const { mkdtempSync, readFileSync } = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { ClaudeBridge } = await import('../server/claude.js');
  const rooms = JSON.parse(readFileSync(new URL('../shared/rooms.json', import.meta.url)));
  let falhar = false;
  const iaLocal = {
    modelo: 'qwen3:4b-instruct',
    status: async () => ({ ligado: true, modeloPronto: true, modelos: ['qwen3:4b-instruct'] }),
    perguntar: async () => { if (falhar) throw new Error('caiu'); return { texto: 'veloz', ms: 900 }; },
  };
  const b = new ClaudeBridge({ rooms: rooms.rooms, convidados: rooms.convidados, dataDir: mkdtempSync(path.join(os.tmpdir(), 'ial-')), bin: '/nao/existe', iaLocal });
  const paraClaude = [];
  b.next = () => { paraClaude.push(b.queue.shift()); };
  const msgs = [];
  b.on('chat', (m) => msgs.push(m));

  assert.equal(b.send('sinônimo de rápido').destino, 'local');
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(msgs.at(-1).agent, 'local');
  assert.equal(msgs.at(-1).text, 'veloz');
  assert.deepEqual(paraClaude, []);

  assert.equal(b.send('Faça um vídeo sobre GTA 6').destino, 'claude');
  assert.deepEqual(paraClaude, ['Faça um vídeo sobre GTA 6']);

  falhar = true;
  b.send('plural de cidadão');
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(paraClaude.at(-1), 'plural de cidadão', 'se a IA local falhar, vai para o Claude');

  b.setIaLocal({ usar: false });
  falhar = false;
  assert.equal(b.send('sinônimo de belo').destino, 'claude');
  assert.equal(b.send('/local sinônimo de belo').destino, 'local', '/local força mesmo desligada');
  assert.equal(b.nomes.pesquisador, 'Nico');
});
