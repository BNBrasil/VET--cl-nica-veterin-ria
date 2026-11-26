// Produção (canal gamer) no servidor: fila de posts para a página, vídeo/capa com Range, aprovar/rejeitar/postar,
// Configurar → Redes sociais (tokens) e → Agenda (horários automáticos).
//
// Segurança:
//  - Tudo aqui exige computador local ou aparelho pareado (o index.js já barra quem não é).
//  - Gravar tokens e mexer na agenda: SÓ no computador (LOCAL_ONLY).
//  - Tokens nunca voltam nas respostas: só "configurado: true/false".
//  - Aprovar um post crítico só acontece aqui (porUsuario), e já dispara a postagem.
import { createReadStream, statSync, readdirSync } from 'node:fs';
import path from 'node:path';
import * as fila from '../producao/fila.js';
import * as postar from '../producao/postar.js';
import { dirSaida, credenciais, salvarCredenciais, redeConfigurada, lerJson, escreverJsonAtomico, REDES, NOME_REDE } from '../producao/redes/comum.js';

export const MSG_AGENDA = 'Produza e publique o boletim gamer de agora seguindo a skill canal-gamer.';
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const TIPOS = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const PRIVACIDADES = ['SELF_ONLY', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR', 'PUBLIC_TO_EVERYONE'];

function json(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}
const limpa = (s, max = 600) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);

/** Horário local "HH:MM" e data "AAAA-MM-DD" de um instante. */
export function relogio(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return { hora: `${p(d.getHours())}:${p(d.getMinutes())}`, dia: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` };
}

/**
 * @param {object} o { bridge, broadcast, ingest?, dir?, dataDir, now?, log?, pollMs?, agendaMs?, publicar?, rooms? }
 */
export function createProducao(o) {
  const bridge = o.bridge;
  const now = o.now || (() => Date.now());
  const log = o.log || (() => {});
  const opts = { dir: o.dir, dataDir: o.dataDir };
  const cfgFile = path.join(o.dataDir, 'config.json');
  const publicarFn = o.publicar || postar.publicar;
  const emAndamento = new Set();
  let ultimaAgenda = null;
  let assinatura = '';
  let vistos = new Map(); // id -> estado (para avisar quando entra em "aguardando")
  let primeiraVarredura = true;
  const timers = [];

  // ---------------- configuração (data/config.json: agenda, simular) ----------------
  function cfg() { const c = lerJson(cfgFile, {}); return c && typeof c === 'object' ? c : {}; }
  function salvarCfg(patch) {
    const c = { ...cfg(), ...patch };
    escreverJsonAtomico(cfgFile, c);
    return c;
  }
  function agenda() {
    const a = cfg().agenda || {};
    return { ligada: !!a.ligada, horarios: Array.isArray(a.horarios) ? a.horarios.filter((h) => HORA_RE.test(h)) : [], ultimo: a.ultimo || null };
  }
  function forcarSimulacao() { return !!cfg().producao?.simular; }

  function redesStatus() {
    const r = {};
    for (const rede of REDES) {
      const c = credenciais(rede, opts) || {};
      r[rede] = { configurado: redeConfigurada(rede, opts), nome: NOME_REDE[rede] };
      if (rede === 'tiktok') {
        r[rede].modo = c.modo === 'direct' ? 'direct' : 'rascunho';
        r[rede].privacidade = PRIVACIDADES.includes(c.privacidade) ? c.privacidade : 'SELF_ONLY';
        r[rede].renovacao = !!(c.refreshToken && c.clientKey && c.clientSecret);
      }
      if (rede === 'instagram') r[rede].temIgUserId = !!c.igUserId;
    }
    return r;
  }
  /** Para onde e como postar agora: redes com token; se nenhuma (ou modo teste ligado), simula. */
  function planoPostagem(post) {
    const alvo = fila.redesAlvo(post);
    const prontas = alvo.filter((r) => redeConfigurada(r, opts));
    if (forcarSimulacao() || !prontas.length) return { redes: alvo, simular: true };
    return { redes: prontas, simular: false };
  }

  // ---------------- fila → página ----------------
  function estado() {
    const posts = fila.listar(opts).map(fila.resumo);
    const semToken = REDES.every((r) => !redeConfigurada(r, opts));
    return {
      posts, aguardando: posts.filter((p) => p.estado === 'aguardando').length,
      simulacao: semToken || forcarSimulacao(), motivoSimulacao: forcarSimulacao() ? 'modo de teste ligado' : semToken ? 'nenhuma rede configurada' : null,
      redes: redesStatus(), emAndamento: [...emAndamento],
    };
  }

  /** Varre a pasta de saída; se algo mudou, avisa a página (e o chat quando um post fica aguardando). */
  function varrer() {
    const dir = dirSaida(opts);
    let sig = '';
    try {
      for (const d of readdirSync(dir, { withFileTypes: true })) {
        if (!d.isDirectory()) continue;
        try { const st = statSync(path.join(dir, d.name, 'post.json')); sig += `${d.name}:${st.mtimeMs}:${st.size};`; } catch {}
      }
    } catch {}
    if (sig === assinatura && !primeiraVarredura) return false;
    assinatura = sig;
    const e = estado();
    const novos = new Map();
    for (const p of e.posts) {
      novos.set(p.id, p.estado);
      if (!primeiraVarredura && p.estado === 'aguardando' && vistos.get(p.id) !== 'aguardando') avisarAguardando(p);
    }
    vistos = novos;
    const primeira = primeiraVarredura;
    primeiraVarredura = false;
    if (!primeira) o.broadcast?.({ type: 'producao', ...e });
    return true;
  }

  function avisarAguardando(p) {
    const motivos = p.motivos?.length ? ` (${p.motivos.join('; ')})` : '';
    bridge?.push?.({ kind: 'system', agent: 'sistema', aviso: 'producao', postId: p.id, text: `⚠ ${p.titulo}: precisa da sua aprovação${motivos}. Abra a aba Produção.` });
    // balão "?" no social-media, se essa sala existir
    if (o.ingest && (o.rooms || []).some((r) => r.id === 'social-media')) {
      o.ingest({ hook_event_name: 'Notification', agent_type: 'social-media', message: `aprovação: ${p.titulo}`.slice(0, 120) });
    }
  }

  function mudou() { assinatura = ''; varrer(); }

  // ---------------- postagem ----------------
  function dispararPostagem(id) {
    if (emAndamento.has(id)) return { ok: false, erro: 'Esse post já está sendo publicado.' };
    const post = fila.ler(id, opts);
    try { postar.conferir(post, opts); } catch (e) { return { ok: false, erro: e.message, codigo: e.codigo }; }
    const plano = planoPostagem(post);
    emAndamento.add(id);
    mudou();
    Promise.resolve()
      .then(() => publicarFn(id, { ...opts, ...plano, log: (m) => log('[producao] ' + m), onMudou: () => mudou() }))
      .then((p) => {
        const links = Object.entries(p.redes || {}).filter(([, v]) => v?.url).map(([r, v]) => `${NOME_REDE[r]}: ${v.url}`);
        const txt = p.estado === 'simulado' ? `🎬 ${p.titulo || id}: simulação concluída (nenhuma rede configurada ou modo de teste).`
          : p.estado === 'publicado' ? `✅ ${p.titulo || id}: publicado${links.length ? ' — ' + links.join(' · ') : ''}.`
            : `✗ ${p.titulo || id}: erro ao publicar. ${p.erro || ''}`;
        bridge?.push?.({ kind: p.estado === 'erro' ? 'error' : 'system', agent: 'sistema', text: txt });
      })
      .catch((e) => {
        log('[producao] erro: ' + e.message);
        bridge?.push?.({ kind: 'error', agent: 'sistema', text: `✗ ${id}: ${e.message}` });
      })
      .finally(() => { emAndamento.delete(id); mudou(); });
    return { ok: true, simular: plano.simular, redes: plano.redes };
  }

  // ---------------- arquivos (Range) ----------------
  function servirArquivo(req, res, id, qual) {
    let post;
    try { post = fila.ler(id, opts); } catch { return json(res, 404, { erro: 'Post não encontrado.' }); }
    const nome = path.basename(String(qual === 'video' ? post.video || 'video.mp4' : post.capa || 'capa.jpg'));
    const pasta = path.join(dirSaida(opts), id);
    const file = path.join(pasta, nome);
    if (path.dirname(file) !== pasta) return json(res, 400, { erro: 'Arquivo inválido.' });
    let st;
    try { st = statSync(file); if (!st.isFile()) throw new Error(); } catch { return json(res, 404, { erro: 'Arquivo não encontrado.' }); }
    const tipo = TIPOS[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const base = { 'Content-Type': tipo, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' };
    const range = req.headers.range;
    if (range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(String(range).trim());
      let ini, fim;
      if (m && (m[1] || m[2])) {
        if (m[1]) { ini = Number(m[1]); fim = m[2] ? Math.min(Number(m[2]), st.size - 1) : st.size - 1; }
        else { const n = Number(m[2]); ini = Math.max(0, st.size - n); fim = st.size - 1; }
      }
      if (ini === undefined || ini > fim || ini >= st.size) {
        res.writeHead(416, { ...base, 'Content-Range': `bytes */${st.size}` });
        return res.end();
      }
      res.writeHead(206, { ...base, 'Content-Range': `bytes ${ini}-${fim}/${st.size}`, 'Content-Length': fim - ini + 1 });
      if (req.method === 'HEAD') return res.end();
      return createReadStream(file, { start: ini, end: fim }).on('error', () => res.destroy()).pipe(res);
    }
    res.writeHead(200, { ...base, 'Content-Length': st.size });
    if (req.method === 'HEAD') return res.end();
    createReadStream(file).on('error', () => res.destroy()).pipe(res);
  }

  // ---------------- agenda ----------------
  /** Chamado a cada ~15 s (ou pelos testes com relógio injetado). Dispara no máximo uma vez por minuto marcado. */
  function agendaTick(t = now()) {
    const a = agenda();
    if (!a.ligada || !a.horarios.length) return false;
    const { hora, dia } = relogio(t);
    if (!a.horarios.includes(hora)) return false;
    const chave = `${dia} ${hora}`;
    if (ultimaAgenda === chave || a.ultimo === chave) return false;
    ultimaAgenda = chave;
    salvarCfg({ agenda: { ...cfg().agenda, ultimo: chave } });
    if (bridge?.status?.().ocupado) {
      log(`[agenda] ${hora}: agentes ocupados, boletim pulado.`);
      bridge?.push?.({ kind: 'system', agent: 'sistema', text: `⏰ Agenda ${hora}: os agentes estavam ocupados; o boletim deste horário foi pulado.` });
      return false;
    }
    log(`[agenda] ${hora}: pedindo o boletim gamer.`);
    bridge?.send?.(MSG_AGENDA);
    return true;
  }

  // ---------------- rotas ----------------
  async function handle(req, res, p, a, readJsonBody) {
    const m = /^\/api\/producao(?:\/([^/]+)(?:\/([a-z-]+))?)?$/.exec(p);
    if (m) {
      const [, idRaw, acao] = m;
      if (!idRaw) {
        if (req.method !== 'GET') return json(res, 405, { erro: 'Use GET.' });
        return json(res, 200, estado());
      }
      let id;
      try { id = decodeURIComponent(idRaw); } catch { return json(res, 400, { erro: 'id inválido' }); }
      if (!fila.idValido(id)) return json(res, 400, { erro: 'id inválido' });
      if (acao === 'video' || acao === 'capa') {
        if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { erro: 'Use GET.' });
        return servirArquivo(req, res, id, acao);
      }
      if (!acao) {
        if (req.method !== 'GET') return json(res, 405, { erro: 'Use GET.' });
        try { return json(res, 200, fila.resumo(fila.ler(id, opts))); } catch { return json(res, 404, { erro: 'Post não encontrado.' }); }
      }
      if (req.method !== 'POST') return json(res, 405, { erro: 'Use POST.' });
      const body = await readJsonBody();
      if (body === null) return;
      try {
        if (acao === 'aprovar') {
          fila.aprovar(id, { porUsuario: true }, opts);
          log(`[producao] ${id} aprovado pelo usuário (${a.local ? 'computador' : 'aparelho pareado'})`);
          const r = dispararPostagem(id);
          mudou();
          return json(res, 200, { ok: true, postagem: r });
        }
        if (acao === 'rejeitar') {
          fila.rejeitar(id, limpa(body.motivo) || 'Rejeitado pelo usuário na página', opts);
          mudou();
          return json(res, 200, { ok: true });
        }
        if (acao === 'postar-agora') {
          const r = dispararPostagem(id);
          return json(res, r.ok ? 200 : 409, r);
        }
      } catch (e) {
        return json(res, /não encontrado/.test(e.message) ? 404 : 409, { ok: false, erro: e.message });
      }
      return json(res, 404, { erro: 'Ação desconhecida.' });
    }

    if (p === '/api/redes') {
      if (req.method === 'GET') return json(res, 200, { redes: redesStatus(), simular: forcarSimulacao() });
      if (req.method !== 'POST') return json(res, 405, { erro: 'Use GET ou POST.' });
      if (!a.local) return json(res, 403, { erro: 'Tokens só podem ser gravados no computador.' });
      const body = await readJsonBody();
      if (body === null) return;
      const ig = body.instagram, tt = body.tiktok;
      if (ig && typeof ig === 'object') {
        if (ig.remover) salvarCredenciais('instagram', null, opts);
        else {
          const patch = {};
          if (limpa(ig.token, 1000)) patch.token = limpa(ig.token, 1000);
          if (ig.igUserId !== undefined && limpa(ig.igUserId, 30)) {
            if (!/^\d{5,25}$/.test(limpa(ig.igUserId, 30))) return json(res, 400, { erro: 'IG user id deve ter só números.' });
            patch.igUserId = limpa(ig.igUserId, 30);
          }
          if (ig.versao && /^v\d{2}\.\d$/.test(ig.versao)) patch.versao = ig.versao;
          if (Object.keys(patch).length) salvarCredenciais('instagram', patch, opts);
        }
      }
      if (tt && typeof tt === 'object') {
        if (tt.remover) salvarCredenciais('tiktok', null, opts);
        else {
          const patch = {};
          for (const k of ['token', 'refreshToken', 'clientKey', 'clientSecret']) if (limpa(tt[k], 1000)) patch[k] = limpa(tt[k], 1000);
          if (tt.modo === 'direct' || tt.modo === 'rascunho') patch.modo = tt.modo;
          if (PRIVACIDADES.includes(tt.privacidade)) patch.privacidade = tt.privacidade;
          if (patch.token) delete (patch.expiraEm);
          if (Object.keys(patch).length) salvarCredenciais('tiktok', patch, opts);
        }
      }
      if (typeof body.simular === 'boolean') salvarCfg({ producao: { ...(cfg().producao || {}), simular: body.simular } });
      mudou();
      return json(res, 200, { ok: true, redes: redesStatus(), simular: forcarSimulacao() });
    }

    if (p === '/api/agenda') {
      if (req.method === 'GET') return json(res, 200, { ...agenda(), ocupado: !!bridge?.status?.().ocupado });
      if (req.method !== 'POST') return json(res, 405, { erro: 'Use GET ou POST.' });
      if (!a.local) return json(res, 403, { erro: 'A agenda só pode ser mudada no computador.' });
      const body = await readJsonBody();
      if (body === null) return;
      const atual = agenda();
      let horarios = atual.horarios;
      if (body.horarios !== undefined) {
        if (!Array.isArray(body.horarios) || body.horarios.length > 24) return json(res, 400, { erro: 'Mande até 24 horários.' });
        const ruins = body.horarios.filter((h) => !HORA_RE.test(String(h)));
        if (ruins.length) return json(res, 400, { erro: `Horário inválido: ${ruins.slice(0, 3).join(', ')} (use HH:MM, ex.: 09:00).` });
        horarios = [...new Set(body.horarios.map(String))].sort();
      }
      const ligada = typeof body.ligada === 'boolean' ? body.ligada : atual.ligada;
      salvarCfg({ agenda: { ligada, horarios, ultimo: atual.ultimo } });
      return json(res, 200, { ok: true, ...agenda() });
    }
    return null;
  }

  function iniciar() {
    varrer();
    const pollMs = o.pollMs ?? 2000;
    const agendaMs = o.agendaMs ?? 15000;
    if (pollMs > 0) { const t = setInterval(() => { try { varrer(); } catch {} }, pollMs); t.unref?.(); timers.push(t); }
    if (agendaMs > 0) { const t = setInterval(() => { try { agendaTick(); } catch (e) { log('[agenda] ' + e.message); } }, agendaMs); t.unref?.(); timers.push(t); }
  }
  function parar() { for (const t of timers) clearInterval(t); timers.length = 0; }

  return { handle, estado, varrer, agendaTick, dispararPostagem, iniciar, parar, redesStatus, planoPostagem, get emAndamento() { return emAndamento; } };
}
