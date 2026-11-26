import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import * as fila from '../producao/fila.js';
import * as postar from '../producao/postar.js';
import { planejarPedacos, escolherPrivacidade, publicar as publicarTikTok } from '../producao/redes/tiktok.js';
import { montarLegenda, publicar as publicarInstagram } from '../producao/redes/instagram.js';
import { salvarCredenciais, lerSegredos } from '../producao/redes/comum.js';
import { ClaudeBridge } from '../server/claude.js';
import { createServer } from '../server/index.js';
import { createProducao, MSG_AGENDA } from '../server/producao.js';

const rooms = JSON.parse(readFileSync(new URL('../shared/rooms.json', import.meta.url))).rooms;
const TOKEN_IG = 'IGQVJ-segredo-instagram-123456789';
const TOKEN_TT = 'act.segredo-tiktok-987654321';

function ambiente() {
  const raiz = mkdtempSync(path.join(os.tmpdir(), 'prod-'));
  const dir = path.join(raiz, 'saida');
  const dataDir = path.join(raiz, 'data');
  mkdirSync(dir, { recursive: true });
  mkdirSync(dataDir, { recursive: true });
  return { dir, dataDir };
}

/** Post "limpo": fonte oficial, sem preço, sem imagem, sem menção. */
function criarPost(env, id, extra = {}, pauta = null) {
  const pasta = path.join(env.dir, id);
  mkdirSync(pasta, { recursive: true });
  writeFileSync(path.join(pasta, 'video.mp4'), Buffer.alloc(4096, 7));
  writeFileSync(path.join(pasta, 'capa.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  const post = {
    id, titulo: 'Trailer novo confirmado', criadoEm: Date.now(), video: 'video.mp4', capa: 'capa.jpg',
    legenda: 'A produtora confirmou o trailer para sexta.', hashtags: ['#games', '#gamer'],
    fontes: [{ titulo: 'Blog oficial', url: 'https://exemplo.com/blog', oficial: true }],
    duracao: 30, estado: 'pronto', critico: null, motivos: [], redes: {}, ...extra,
  };
  writeFileSync(path.join(pasta, 'post.json'), JSON.stringify(post));
  if (pauta) writeFileSync(path.join(pasta, 'pauta.json'), JSON.stringify(pauta));
  return post;
}
const jaPublicou = { tiktok: 1, instagram: 1 };
const regras = (post, ctx = {}) => fila.regrasAutomaticas(post, { publicados: jaPublicou, ...ctx });

// ------------------------------------------------------------------ regras de criticidade

test('regra 0: post limpo não é crítico', () => {
  assert.deepEqual(regras(criarPost(ambiente(), 'limpo')), []);
});

test('regra 1: rumor/vazamento ou sem fonte oficial', () => {
  const env = ambiente();
  assert.match(regras(criarPost(env, 'r1', { legenda: 'Vazou o mapa do jogo, segundo um insider.' })).join(), /Rumor/);
  assert.match(regras(criarPost(env, 'r2', { fontes: [{ url: 'https://x.com', oficial: false }] })).join(), /fonte oficial/);
  assert.match(regras(criarPost(env, 'r3'), { pauta: { cenas: [{ fala: 'Esse boato está forte' }] } }).join(), /Rumor/);
});

test('regra 2: preço sem fonte da loja e promoção acabando em < 6 h', () => {
  const env = ambiente();
  const now = () => Date.parse('2026-11-26T12:00:00Z');
  const promo = { tipo: 'promocao', cenas: [{ tipo: 'lista', itens: [{ nome: 'Jogo X', de: 'R$ 100', por: 'R$ 50' }] }], fontes: [{ url: 'https://blogdejogos.com/x' }] };
  assert.match(regras(criarPost(env, 'p1', { fontes: [] }), { pauta: promo }).join(), /sem fonte da própria loja/);
  const daLoja = { ...promo, fontes: [{ url: 'https://store.steampowered.com/app/1', oficial: true }] };
  assert.deepEqual(regras(criarPost(env, 'p2', { fontes: [] }), { pauta: daLoja, now }), []);
  const acabando = { ...daLoja, terminaEm: '2026-11-26T15:00:00Z' };
  assert.match(regras(criarPost(env, 'p3', { fontes: [] }), { pauta: acabando, now }).join(), /menos de 6 h/);
  assert.match(regras(criarPost(env, 'p4', { legenda: 'Corre: R$ 9,90 hoje!' })).join(), /sem fonte da própria loja/);
});

test('regra 3: assunto sensível', () => {
  const env = ambiente();
  assert.match(regras(criarPost(env, 's1', { legenda: 'Desenvolvedor faleceu aos 40 anos.' })).join(), /sensível/);
  assert.match(regras(criarPost(env, 's2', { titulo: 'Jogo vira tema de eleição' })).join(), /sensível/);
  assert.match(regras(criarPost(env, 's3', { legenda: 'Polêmica com a política do estúdio' })).join(), /sensível/);
});

test('regra 4: imagem sem crédito', () => {
  const env = ambiente();
  const pauta = { cenas: [{ tipo: 'imagem', imagem: 'a.jpg', credito: 'Kit de imprensa' }, { tipo: 'imagem', imagem: 'b.jpg' }] };
  assert.match(regras(criarPost(env, 'i1'), { pauta }).join(), /1 imagem\(ns\) sem crédito/);
  assert.deepEqual(regras(criarPost(env, 'i2'), { pauta: { cenas: [{ imagem: 'a.jpg', credito: 'Steam' }] } }), []);
});

test('regra 5: primeira postagem em cada rede (lendo a fila)', () => {
  const env = ambiente();
  const p = criarPost(env, 'novo');
  assert.deepEqual(fila.avaliar(p, env).sort(), ['Primeira postagem no Instagram', 'Primeira postagem no TikTok']);
  criarPost(env, 'antigo', { estado: 'publicado', redes: { tiktok: { estado: 'publicado' }, instagram: { estado: 'simulado' } } });
  assert.deepEqual(fila.avaliar(p, env), ['Primeira postagem no Instagram'], 'simulado não conta');
});

test('regra 6: menção ou acusação na legenda', () => {
  const env = ambiente();
  assert.match(regras(criarPost(env, 'm1', { legenda: 'Olha o que o @fulano.dev disse' })).join(), /menciona @fulano.dev/);
  assert.match(regras(criarPost(env, 'm2', { legenda: 'Estúdio acusado de fraude nas vendas' })).join(), /acusação/);
});

// ------------------------------------------------------------------ fila

test('revisar soma as regras automáticas mesmo se o revisor diz que não é crítico', () => {
  const env = ambiente();
  criarPost(env, 'a', { legenda: 'Rumor: novo jogo' });
  const r = fila.revisar('a', { critico: false }, env);
  assert.equal(r.estado, 'aguardando');
  assert.equal(r.critico, true);
  criarPost(env, 'b');
  assert.equal(fila.revisar('b', { critico: true, motivos: ['Imagem duvidosa'] }, env).motivos[0], 'Imagem duvidosa');
});

test('CLI aprovar NÃO libera crítico; aprovação pela página (porUsuario) libera e é assinada', () => {
  const env = ambiente();
  criarPost(env, 'c1'); // primeira postagem → crítico
  const saida = [];
  assert.equal(fila.cli(['aprovar', 'c1'], (m) => saida.push(m), env), 3);
  assert.match(saida.join(), /só o usuário pode aprovar/);
  let p = fila.ler('c1', env);
  assert.equal(p.estado, 'aguardando');
  assert.equal(p.aprovadoPor, undefined);
  // forjar no arquivo não adianta: falta a assinatura
  writeFileSync(fila.arquivoPost('c1', env), JSON.stringify({ ...p, estado: 'aprovado', aprovadoPor: 'usuario', critico: false }));
  assert.equal(fila.aprovacaoValida(fila.ler('c1', env), env), false);
  assert.throws(() => postar.conferir(fila.ler('c1', env), env), /crítico/);

  p = fila.aprovar('c1', { porUsuario: true }, env);
  assert.equal(p.aprovadoPor, 'usuario');
  assert.ok(p.aprovadoEm);
  assert.equal(fila.aprovacaoValida(p, env), true);
  // mudou a legenda depois da aprovação → não vale mais
  writeFileSync(fila.arquivoPost('c1', env), JSON.stringify({ ...p, legenda: 'outra coisa' }));
  assert.equal(fila.aprovacaoValida(fila.ler('c1', env), env), false);
});

test('CLI: revisar, aprovar não crítico, rejeitar exige motivo, listar', () => {
  const env = ambiente();
  criarPost(env, 'antigo', { estado: 'publicado', redes: { tiktok: { estado: 'publicado' }, instagram: { estado: 'publicado' } } });
  criarPost(env, 'ok1');
  const out = [];
  assert.equal(fila.cli(['revisar', 'ok1'], (m) => out.push(m), env), 0);
  assert.equal(fila.ler('ok1', env).estado, 'aprovado');
  assert.equal(fila.cli(['aprovar', 'ok1'], (m) => out.push(m), env), 0);
  assert.throws(() => fila.cli(['rejeitar', 'ok1'], () => {}, env), /motivo/);
  fila.cli(['rejeitar', 'ok1', '--motivo', 'fora do ar'], () => {}, env);
  assert.equal(fila.ler('ok1', env).estado, 'rejeitado');
  fila.cli(['listar'], (m) => out.push(m), env);
  assert.match(out.at(-1), /rejeitado/);
  assert.throws(() => fila.ler('../etc', env), /id inválido/);
});

// ------------------------------------------------------------------ postar

test('postar recusa crítico sem aprovação do usuário e post não revisado', async () => {
  const env = ambiente();
  criarPost(env, 'x');
  await assert.rejects(postar.publicar('x', { ...env, simular: true }), /revisão/);
  fila.revisar('x', {}, env);
  await assert.rejects(postar.publicar('x', { ...env, simular: true }), (e) => e.codigo === 'CRITICO');
  const out = [];
  assert.equal(await postar.cli(['x', '--simular'], (m) => out.push(m), env), 3);
});

test('postar --simular: não chama a rede e grava "simulado" por rede', async () => {
  const env = ambiente();
  criarPost(env, 's');
  fila.aprovar('s', { porUsuario: true }, env);
  const fetch = () => { throw new Error('não devia chamar a rede'); };
  const p = await postar.publicar('s', { ...env, simular: true, fetch, redes: ['tiktok', 'instagram'] });
  assert.equal(p.estado, 'simulado');
  assert.equal(p.redes.tiktok.estado, 'simulado');
  assert.equal(p.redes.instagram.plano.media_type, 'REELS');
  assert.equal(p.redes.tiktok.plano.total_chunk_count, 1);
});

test('postar real (fetch falso): Instagram e TikTok publicados; erro guarda mensagem sem token', async () => {
  const env = ambiente();
  criarPost(env, 'r');
  fila.aprovar('r', { porUsuario: true }, env);
  salvarCredenciais('instagram', { token: TOKEN_IG, igUserId: '17841400000000000' }, env);
  salvarCredenciais('tiktok', { token: TOKEN_TT, modo: 'direct', privacidade: 'SELF_ONLY' }, env);
  const chamadas = [];
  const resp = (status, obj) => new Response(JSON.stringify(obj), { status });
  const fetch = async (url, init = {}) => {
    chamadas.push({ url, init });
    assert.ok(!String(url).includes(TOKEN_IG) && !String(url).includes(TOKEN_TT), 'token nunca vai na URL');
    if (url.endsWith('/media')) return resp(200, { id: '999', uri: 'https://rupload.facebook.com/ig-api-upload/v27.0/999' });
    if (url.startsWith('https://rupload.facebook.com/')) {
      assert.equal(init.headers.Authorization, `OAuth ${TOKEN_IG}`);
      assert.equal(init.headers.offset, '0');
      assert.equal(init.headers.file_size, '4096');
      return resp(200, { success: true });
    }
    if (url.includes('fields=status_code')) return resp(200, { status_code: 'FINISHED' });
    if (url.endsWith('/media_publish')) return resp(200, { id: '1234' });
    if (url.includes('fields=permalink')) return resp(200, { permalink: 'https://www.instagram.com/reel/abc/' });
    if (url.endsWith('/creator_info/query/')) return resp(200, { data: { creator_username: 'canal', privacy_level_options: ['PUBLIC_TO_EVERYONE', 'SELF_ONLY'], max_video_post_duration_sec: 600 }, error: { code: 'ok' } });
    if (url.endsWith('/v2/post/publish/video/init/')) {
      const b = JSON.parse(init.body);
      assert.equal(b.post_info.privacy_level, 'SELF_ONLY');
      assert.equal(b.source_info.source, 'FILE_UPLOAD');
      return resp(200, { data: { publish_id: 'v_pub_1', upload_url: 'https://open-upload.tiktokapis.com/upload/?id=1' }, error: { code: 'ok' } });
    }
    if (url.startsWith('https://open-upload.tiktokapis.com/')) {
      assert.equal(init.headers['Content-Range'], 'bytes 0-4095/4096');
      return new Response(null, { status: 201 });
    }
    if (url.endsWith('/status/fetch/')) return resp(200, { data: { status: 'PUBLISH_COMPLETE', publicaly_available_post_id: [] }, error: { code: 'ok' } });
    throw new Error('url inesperada ' + url);
  };
  const p = await postar.publicar('r', { ...env, fetch, sleep: async () => {} });
  assert.equal(p.estado, 'publicado');
  assert.equal(p.redes.instagram.url, 'https://www.instagram.com/reel/abc/');
  assert.equal(p.redes.tiktok.privacidade, 'SELF_ONLY');
  assert.match(p.redes.tiktok.aviso, /SELF_ONLY/);

  // erro do Instagram com o token no texto: não aparece no post.json
  criarPost(env, 'e');
  fila.aprovar('e', { porUsuario: true }, env);
  const ruim = async () => resp(400, { error: { code: 190, message: `Invalid OAuth access token ${TOKEN_IG}` } });
  const pe = await postar.publicar('e', { ...env, fetch: ruim, sleep: async () => {}, redes: ['instagram'] });
  assert.equal(pe.estado, 'erro');
  assert.match(pe.redes.instagram.erro, /expirado/);
  assert.ok(!readFileSync(fila.arquivoPost('e', env), 'utf8').includes(TOKEN_IG));
});

test('TikTok: pedaços seguem os limites da API; privacidade respeita creator_info', () => {
  const MB = 1024 * 1024;
  assert.deepEqual(planejarPedacos(3 * MB).total, 1);
  const p = planejarPedacos(50_000_123, 10_000_000);
  assert.equal(p.total, 5);
  assert.equal(p.partes.at(-1).fim - p.partes.at(-1).inicio + 1, 10_000_123);
  const g = planejarPedacos(200 * MB);
  assert.ok(g.chunkSize >= 5 * MB && g.chunkSize <= 64 * MB);
  assert.equal(g.partes.at(-1).fim, 200 * MB - 1);
  assert.equal(escolherPrivacidade(['SELF_ONLY'], 'PUBLIC_TO_EVERYONE'), 'SELF_ONLY');
  assert.equal(escolherPrivacidade(['PUBLIC_TO_EVERYONE', 'SELF_ONLY'], 'SELF_ONLY'), 'SELF_ONLY');
  assert.ok(montarLegenda('oi', Array.from({ length: 40 }, (_, i) => '#t' + i)).match(/#/g).length === 30);
});

test('TikTok: token inválido renova com refresh_token e salva', async () => {
  const env = ambiente();
  criarPost(env, 't');
  const salvo = [];
  let renovou = false;
  const resp = (status, obj) => new Response(JSON.stringify(obj), { status });
  const fetch = async (url, init) => {
    if (url.endsWith('/v2/oauth/token/')) { renovou = true; return resp(200, { access_token: 'novo-token-123456789', refresh_token: 'rt2', expires_in: 86400 }); }
    if (url.endsWith('/inbox/video/init/')) {
      if (!init.headers.Authorization.includes('novo-token')) return resp(401, { error: { code: 'access_token_invalid', message: 'expired' } });
      return resp(200, { data: { publish_id: 'p1', upload_url: 'https://open-upload.tiktokapis.com/u' }, error: { code: 'ok' } });
    }
    if (url.startsWith('https://open-upload')) return new Response(null, { status: 201 });
    if (url.endsWith('/status/fetch/')) return resp(200, { data: { status: 'SEND_TO_USER_INBOX' }, error: { code: 'ok' } });
    throw new Error(url);
  };
  const r = await publicarTikTok({
    arquivo: path.join(env.dir, 't', 'video.mp4'), legenda: 'x', hashtags: [], fetch, sleep: async () => {},
    cred: { token: 'velho-token-000000', modo: 'rascunho', refreshToken: 'rt1', clientKey: 'ck', clientSecret: 'cs' }, salvarCred: (p) => salvo.push(p),
  });
  assert.ok(renovou);
  assert.equal(r.estado, 'rascunho');
  assert.equal(salvo[0].token, 'novo-token-123456789');
});

test('Instagram: container com ERROR vira mensagem em português', async () => {
  const env = ambiente();
  criarPost(env, 'ie');
  const resp = (status, obj) => new Response(JSON.stringify(obj), { status });
  const fetch = async (url) => {
    if (url.endsWith('/media')) return resp(200, { id: '1' });
    if (url.startsWith('https://rupload')) return resp(200, { success: true });
    return resp(200, { status_code: 'ERROR', status: 'Error: video format' });
  };
  await assert.rejects(publicarInstagram({ arquivo: path.join(env.dir, 'ie', 'video.mp4'), cred: { token: TOKEN_IG, igUserId: '123456' }, fetch, sleep: async () => {} }), /recusou o vídeo/);
});

// ------------------------------------------------------------------ servidor

function req(port, { method = 'GET', path: p = '/', host, headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request({ port, host: '127.0.0.1', method, path: p, headers: { Host: host || `127.0.0.1:${port}`, ...headers } }, (res) => {
      const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('latin1') }));
    });
    r.on('error', reject);
    if (body !== undefined) r.end(typeof body === 'string' ? body : JSON.stringify(body)); else r.end();
  });
}
const J = { 'Content-Type': 'application/json' };

async function servidor(env, extra = {}) {
  const bridge = new ClaudeBridge({ rooms, dataDir: env.dataDir, bin: '/nao/existe' });
  bridge.refresh = async () => bridge.status();
  const enviados = [];
  bridge.send = (t) => { enviados.push(t); return { ok: true }; };
  const app = createServer({ chat: true, bridge, log: false, tickMs: 0, producaoDir: env.dir, producaoPollMs: 0, agendaMs: 0, ...extra });
  const { port } = await app.listen(0);
  return { app, port, bridge, enviados };
}

test('API: lista, vídeo com Range, capa, id malicioso, aprovar crítico simula e marca usuário', async () => {
  const env = ambiente();
  criarPost(env, 'crit', { titulo: 'Crítico de teste' });
  fila.revisar('crit', {}, env);
  const { app, port, bridge } = await servidor(env);
  try {
    const l = JSON.parse((await req(port, { path: '/api/producao' })).body);
    assert.equal(l.aguardando, 1);
    assert.equal(l.simulacao, true);
    assert.equal(l.posts[0].id, 'crit');
    assert.ok(l.posts[0].motivos.length);

    const v = await req(port, { path: '/api/producao/crit/video', headers: { Range: 'bytes=0-99' } });
    assert.equal(v.status, 206);
    assert.equal(v.headers['content-range'], 'bytes 0-99/4096');
    assert.equal(v.body.length, 100);
    assert.equal(v.headers['content-type'], 'video/mp4');
    assert.equal((await req(port, { path: '/api/producao/crit/video', headers: { Range: 'bytes=-10' } })).body.length, 10);
    assert.equal((await req(port, { path: '/api/producao/crit/video', headers: { Range: 'bytes=5000-' } })).status, 416);
    assert.equal((await req(port, { path: '/api/producao/crit/video' })).headers['content-length'], '4096');
    assert.equal((await req(port, { path: '/api/producao/crit/capa' })).headers['content-type'], 'image/jpeg');

    for (const mal of ['/api/producao/..%2F..%2Fdata/video', '/api/producao/%2e%2e/video', '/api/producao/..%5Cx/capa', '/api/producao/a%00b/video']) {
      const r = await req(port, { path: mal });
      assert.ok([400, 404].includes(r.status), `${mal} → ${r.status}`);
      assert.ok(!/segredos|apiKey/.test(r.body));
    }
    assert.equal((await req(port, { path: '/api/producao/nao-existe/video' })).status, 404);

    const ap = await req(port, { method: 'POST', path: '/api/producao/crit/aprovar', headers: J, body: {} });
    assert.equal(ap.status, 200);
    assert.equal(JSON.parse(ap.body).postagem.simular, true);
    for (let i = 0; i < 50 && fila.ler('crit', env).estado !== 'simulado'; i++) await new Promise((r) => setTimeout(r, 20));
    const p = fila.ler('crit', env);
    assert.equal(p.estado, 'simulado');
    assert.equal(p.aprovadoPor, 'usuario');
    assert.ok(bridge.history.some((m) => /simulação concluída/.test(m.text)));

    criarPost(env, 'outro');
    assert.equal((await req(port, { method: 'POST', path: '/api/producao/outro/rejeitar', headers: J, body: { motivo: 'não gostei' } })).status, 200);
    assert.equal(fila.ler('outro', env).estado, 'rejeitado');
    assert.equal((await req(port, { method: 'POST', path: '/api/producao/outro/postar-agora', headers: J, body: {} })).status, 409);
  } finally { await app.close(); }
});

test('API: tokens só gravam no computador e nunca voltam nas respostas', async () => {
  const env = ambiente();
  criarPost(env, 'p1');
  const { app, port } = await servidor(env);
  try {
    const r = await req(port, { method: 'POST', path: '/api/redes', headers: J, body: { instagram: { token: TOKEN_IG, igUserId: '17841400000000000' }, tiktok: { token: TOKEN_TT, modo: 'direct', clientSecret: 'cs-segredo-xyz123' } } });
    assert.equal(r.status, 200);
    const j = JSON.parse(r.body);
    assert.equal(j.redes.instagram.configurado, true);
    assert.equal(j.redes.tiktok.modo, 'direct');
    const tudo = [r.body, (await req(port, { path: '/api/redes' })).body, (await req(port, { path: '/api/producao' })).body,
      (await req(port, { path: '/api/claude' })).body, (await req(port, { path: '/api/producao/p1' })).body].join('\n');
    for (const s of [TOKEN_IG, TOKEN_TT, 'cs-segredo-xyz123']) assert.ok(!tudo.includes(s), 'vazou ' + s);
    assert.equal(lerSegredos(env).redes.instagram.token, TOKEN_IG);
    // trocar a chave de API não apaga os tokens das redes
    app.bridge.setApiKey('sk-ant-teste');
    assert.equal(lerSegredos(env).redes.tiktok.token, TOKEN_TT);
    assert.equal(lerSegredos(env).apiKey, 'sk-ant-teste');

    // celular pareado: lê e aprova, mas não grava tokens nem agenda
    await req(port, { method: 'POST', path: '/api/remoto/ativar', headers: J, body: { ativo: true } });
    await new Promise((r) => setTimeout(r, 700));
    const code = JSON.parse((await req(port, { method: 'POST', path: '/api/remoto/codigo', headers: J, body: {} })).body);
    const phone = '192.168.0.50:' + port;
    assert.equal((await req(port, { host: phone, path: '/api/producao' })).status, 401, 'não pareado');
    const paired = await req(port, { method: 'POST', host: phone, path: '/api/parear', headers: J, body: { codigo: code.codigo } });
    const auth = { Cookie: paired.headers['set-cookie'][0].split(';')[0] };
    assert.equal((await req(port, { host: phone, path: '/api/producao', headers: auth })).status, 200);
    assert.equal((await req(port, { host: phone, path: '/api/producao/p1/video', headers: { ...auth, Range: 'bytes=0-1' } })).status, 206);
    assert.equal((await req(port, { method: 'POST', host: phone, path: '/api/redes', headers: { ...J, ...auth }, body: { tiktok: { token: 'x' } } })).status, 403);
    assert.equal((await req(port, { method: 'POST', host: phone, path: '/api/agenda', headers: { ...J, ...auth }, body: { ligada: true } })).status, 403);
    assert.equal((await req(port, { method: 'POST', host: phone, path: '/api/producao/p1/rejeitar', headers: { ...J, ...auth, Origin: 'http://evil.example' }, body: {} })).status, 403);
  } finally { await app.close(); }
});

test('aviso no chat quando um post fica aguardando; broadcast producao', async () => {
  const env = ambiente();
  const msgs = [];
  const pushes = [];
  const prod = createProducao({ dir: env.dir, dataDir: env.dataDir, bridge: { push: (m) => pushes.push(m), status: () => ({}) }, broadcast: (m) => msgs.push(m), pollMs: 0, agendaMs: 0 });
  prod.varrer();
  criarPost(env, 'w', { titulo: 'Boato do GTA' });
  fila.revisar('w', {}, env);
  prod.varrer();
  assert.equal(msgs.at(-1).type, 'producao');
  assert.equal(msgs.at(-1).aguardando, 1);
  assert.match(pushes[0].text, /^⚠ Boato do GTA: precisa da sua aprovação \(/);
  assert.equal(prod.varrer(), false, 'sem mudança, sem broadcast');
  assert.equal(pushes.length, 1);
});

test('agenda: dispara uma vez por minuto marcado (relógio injetado), pula se ocupado, pausa', async () => {
  const env = ambiente();
  const enviados = [];
  let ocupado = false;
  const bridge = { send: (t) => enviados.push(t), push: () => {}, status: () => ({ ocupado }) };
  const prod = createProducao({ dir: env.dir, dataDir: env.dataDir, bridge, pollMs: 0, agendaMs: 0 });
  const local = (h, m, s = 0) => new Date(2026, 10, 26, h, m, s).getTime();
  const fake = { headers: {}, method: 'POST' };
  const res = () => ({ writeHead() {}, end(b) { this.body = b; } });
  const r1 = res();
  await prod.handle(fake, r1, '/api/agenda', { local: true }, async () => ({ horarios: ['09:00', '18:00'], ligada: true }));
  assert.deepEqual(JSON.parse(r1.body).horarios, ['09:00', '18:00']);
  const r2 = res();
  await prod.handle(fake, r2, '/api/agenda', { local: true }, async () => ({ horarios: ['9h'] }));
  assert.match(r2.body, /inválido/);

  assert.equal(prod.agendaTick(local(8, 59, 50)), false);
  assert.equal(prod.agendaTick(local(9, 0, 1)), true);
  assert.equal(prod.agendaTick(local(9, 0, 30)), false, 'mesmo minuto');
  assert.equal(prod.agendaTick(local(9, 0, 59)), false);
  assert.equal(prod.agendaTick(local(9, 1, 0)), false);
  assert.deepEqual(enviados, [MSG_AGENDA]);
  // outro processo (reinício) no mesmo minuto também não repete: fica salvo em data/config.json
  const prod2 = createProducao({ dir: env.dir, dataDir: env.dataDir, bridge, pollMs: 0, agendaMs: 0 });
  assert.equal(prod2.agendaTick(local(9, 0, 40)), false);
  ocupado = true;
  assert.equal(prod.agendaTick(local(18, 0, 5)), false);
  assert.equal(enviados.length, 1);
  ocupado = false;
  await prod.handle(fake, res(), '/api/agenda', { local: true }, async () => ({ ligada: false }));
  assert.equal(prod.agendaTick(local(9, 0, 0) + 86400000), false, 'pausada');
  await prod.handle(fake, res(), '/api/agenda', { local: true }, async () => ({ ligada: true }));
  assert.equal(prod.agendaTick(local(9, 0, 0) + 86400000), true, 'dia seguinte');
});
