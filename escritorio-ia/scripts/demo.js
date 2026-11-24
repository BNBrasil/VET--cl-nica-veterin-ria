// Simula uma sessão realista do Claude Code mandando eventos de hook para o servidor.
// Uso: node scripts/demo.js [--loop] [--fast]
import http from 'node:http';

const args = new Set(process.argv.slice(2));
const LOOP = args.has('--loop');
const FAST = args.has('--fast');
const port = Number(process.env.ESCRITORIO_PORT) || 4317;
const host = process.env.ESCRITORIO_HOST || '127.0.0.1';
const SPEED = FAST ? 0.25 : 1;

const sleep = (ms) => new Promise((r) => setTimeout(r, Math.round(ms * SPEED)));

function post(ev) {
  const body = JSON.stringify(ev);
  return new Promise((resolve) => {
    const req = http.request(
      { host, port, path: '/event', method: 'POST', timeout: 2000,
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
      (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); },
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (e) => resolve(e));
    req.end(body);
  });
}

let session = 'demo-' + Date.now().toString(36);
let seq = 0;
const agentIds = {};

async function emit(hook, extra = {}) {
  const ev = { hook_event_name: hook, session_id: session, cwd: process.cwd(), ...extra };
  const r = await post(ev);
  const who = extra.agent_type || 'orquestrador';
  const what = extra.tool_name ? ` ${extra.tool_name}` : '';
  if (r instanceof Error) {
    console.error(`[demo] falha ao enviar ${hook}: ${r.message} — o servidor está rodando em http://${host}:${port}? (npm start)`);
    process.exit(1);
  }
  console.log(`[demo] ${hook.padEnd(18)} ${who}${what}`);
}

// Atalhos
const main = {
  tool: (tool_name, tool_input) => emit('PreToolUse', { tool_name, tool_input }),
  post: (tool_name) => emit('PostToolUse', { tool_name }),
};

function sub(agent_type) {
  const agent_id = agentIds[agent_type] || (agentIds[agent_type] = `agt_${agent_type}_${++seq}`);
  const base = { agent_type, agent_id };
  return {
    start: (message) => emit('SubagentStart', { ...base, message }),
    stop: () => emit('SubagentStop', { ...base, stop_hook_active: false }),
    async tool(tool_name, tool_input, { fail = null, wait = 1500 } = {}) {
      await emit('PreToolUse', { ...base, tool_name, tool_input });
      await sleep(wait);
      if (fail) await emit('PostToolUseFailure', { ...base, tool_name, tool_input, error: fail });
      else await emit('PostToolUse', { ...base, tool_name, tool_input, tool_response: { ok: true } });
      await sleep(400);
    },
    notify: (message) => emit('Notification', { ...base, message }),
  };
}

async function delegate(agent_type, description) {
  await main.tool('Task', { subagent_type: agent_type, description, prompt: description });
  await sleep(500);
  return sub(agent_type);
}

async function runSession() {
  session = 'demo-' + Date.now().toString(36);
  for (const k of Object.keys(agentIds)) delete agentIds[k];

  await emit('SessionStart', { source: 'startup' });
  await sleep(2500);
  await emit('UserPromptSubmit', { prompt: 'Faça um vídeo curto de 30 s explicando vacinação de filhotes para a clínica.' });
  await sleep(2000);

  // Orquestrador lê o briefing antes de delegar.
  await main.tool('Read', { file_path: 'briefing/vacinacao.md' });
  await sleep(1200);
  await main.post('Read');

  // Visitante (agent_type desconhecido) explora o projeto.
  const explore = sub('Explore');
  await explore.start('Mapear assets existentes');
  await explore.tool('Glob', { pattern: 'assets/**/*.png' }, { wait: 1000 });
  await explore.tool('Grep', { pattern: 'vacina', path: 'docs' }, { wait: 1000 });
  await explore.stop();
  await sleep(800);

  // 1) Roteiro
  const rot = await delegate('roteirista', 'Escrever roteiro de 30 s sobre vacinação de filhotes');
  await rot.start('Roteiro: vacinação de filhotes');
  await rot.tool('WebSearch', { query: 'calendário vacinação filhotes V8 V10' }, { wait: 2500 });
  await rot.tool('Read', { file_path: 'briefing/vacinacao.md' });
  await rot.tool('Write', { file_path: 'roteiro/vacinacao.md' }, { wait: 3000 });
  await rot.stop();
  await main.post('Task');
  await sleep(1500);

  // 2) Animação
  const ani = await delegate('animador', 'Animar as 4 cenas do roteiro');
  await ani.start('Animação das cenas');
  await ani.tool('Read', { file_path: 'roteiro/vacinacao.md' });
  await ani.tool('Bash', { command: 'node render/cenas.js --scene 1-4' }, { wait: 3500 });
  await ani.tool('Bash', { command: 'node render/cenas.js --scene 5' }, { wait: 1500, fail: 'Error: cena 5 não existe no roteiro' });
  await sleep(2500);
  await ani.tool('Edit', { file_path: 'render/cenas.js' }, { wait: 2000 });
  await ani.stop();
  await main.post('Task');
  await sleep(1500);

  // 3) Edição
  const ed = await delegate('editor-video', 'Montar o vídeo final com trilha e legendas');
  await ed.start('Edição final');
  await ed.tool('Bash', { command: 'ffmpeg -i cenas/%03d.png -i trilha.mp3 -c:v libx264 final.mp4' }, { wait: 4000 });
  await ed.notify('Claude precisa da sua permissão para usar Bash');
  await sleep(4000);
  await ed.tool('Bash', { command: 'ffmpeg -i final.mp4 -vf subtitles=legendas.srt final_leg.mp4' }, { wait: 2500 });
  await ed.stop();
  await main.post('Task');
  await sleep(1500);

  // 4) Revisão
  const rev = await delegate('revisor', 'Revisar o vídeo final (texto, ritmo, legendas)');
  await rev.start('Revisão / QA');
  await rev.tool('Read', { file_path: 'roteiro/vacinacao.md' });
  await rev.tool('WebFetch', { url: 'https://example.org/guia-vacinacao' }, { wait: 2000 });
  await rev.tool('mcp__qa__checklist', { description: 'checklist de QA do vídeo' }, { wait: 2000 });
  await rev.stop();
  await main.post('Task');
  await sleep(1000);

  // Orquestrador escreve o resumo e termina.
  await main.tool('Write', { file_path: 'entregas/README.md' });
  await sleep(1500);
  await main.post('Write');
  await emit('Stop', { stop_hook_active: false });
  // programador, desenvolvedor e designer ficam ociosos o tempo todo: cochilam (20 s),
  // dormem (60 s) e vão para o sofá do lounge (120 s).
}

async function main_() {
  console.log(`[demo] enviando eventos para http://${host}:${port}/event${FAST ? ' (rápido)' : ''}${LOOP ? ' (loop)' : ''}`);
  do {
    await runSession();
    if (LOOP) {
      console.log('[demo] sessão concluída; nova sessão em instantes…');
      await sleep(15000);
    }
  } while (LOOP);
  console.log('[demo] fim. Deixe a página aberta para ver os ociosos cochilarem e dormirem.');
}

main_();
