#!/usr/bin/env node
// Fila de posts do canal gamer: lê e atualiza producao/saida/<id>/post.json (estados e criticidade).
//
// Estados: pronto → revisado → aprovado | aguardando → publicando → publicado | erro | rejeitado
//          (+ "simulado" quando postar.js roda com --simular).
//
// Regra de ouro: um post CRÍTICO só é liberado pelo usuário, pela página (API local ou aparelho pareado).
// A CLI `aprovar` (que os agentes usam) NUNCA libera crítico. A aprovação do usuário é assinada (HMAC com
// uma chave em data/segredos.json) e amarrada ao conteúdo (legenda, hashtags, vídeo): se o conteúdo mudar
// depois, a aprovação deixa de valer. As 6 regras automáticas são reaplicadas na hora de postar.
//
// Uso:
//   node producao/fila.js listar
//   node producao/fila.js ver <id>
//   node producao/fila.js revisar <id> [--critico] [--motivo "..."]...
//   node producao/fila.js aprovar <id>
//   node producao/fila.js rejeitar <id> --motivo "..."
import { readdirSync, existsSync, statSync } from 'node:fs';
import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  dirSaida, lerJson, escreverJsonAtomico, lerSegredos, alterarSegredos, REDES, NOME_REDE,
} from './redes/comum.js';

export { dirSaida };
export const ESTADOS = ['pronto', 'revisado', 'aprovado', 'aguardando', 'publicando', 'publicado', 'erro', 'rejeitado', 'simulado'];
export const ID_RE = /^[a-z0-9][a-z0-9._-]{0,119}$/i;

export function idValido(id) {
  return typeof id === 'string' && ID_RE.test(id) && !id.includes('..');
}

function pastaDo(id, opts) {
  if (!idValido(id)) throw new Error(`id inválido: ${JSON.stringify(String(id).slice(0, 60))}`);
  return path.join(dirSaida(opts), id);
}
export function arquivoPost(id, opts = {}) { return path.join(pastaDo(id, opts), 'post.json'); }

// ------------------------------------------------------------------ leitura / escrita

export function ler(id, opts = {}) {
  const f = arquivoPost(id, opts);
  const p = lerJson(f, null);
  if (!p || typeof p !== 'object') throw new Error(`Post "${id}" não encontrado (${f}).`);
  return normalizar(p, id);
}

function normalizar(p, id) {
  p.id = id;
  if (!ESTADOS.includes(p.estado)) p.estado = 'pronto';
  if (!Array.isArray(p.motivos)) p.motivos = [];
  if (!Array.isArray(p.hashtags)) p.hashtags = [];
  if (!p.redes || typeof p.redes !== 'object') p.redes = {};
  return p;
}

export function salvar(post, opts = {}) {
  post.atualizadoEm = (opts.now || Date.now)();
  escreverJsonAtomico(arquivoPost(post.id, opts), post);
  return post;
}

export function atualizar(id, fn, opts = {}) {
  const p = ler(id, opts);
  const r = fn(p) || p;
  return salvar(r, opts);
}

export function listar(opts = {}) {
  const dir = dirSaida(opts);
  let nomes = [];
  try { nomes = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { return []; }
  const out = [];
  for (const n of nomes) {
    if (!idValido(n) || !existsSync(path.join(dir, n, 'post.json'))) continue;
    try { out.push(ler(n, opts)); } catch {}
  }
  return out.sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0) || a.id.localeCompare(b.id));
}

/** A pauta que originou o post: saida/<id>/pauta.json, post.pauta (objeto ou caminho) ou nada. */
export function pautaDo(post, opts = {}) {
  if (post.pauta && typeof post.pauta === 'object') return post.pauta;
  const cands = [];
  try { cands.push(path.join(pastaDo(post.id, opts), 'pauta.json')); } catch {}
  if (typeof post.pauta === 'string') cands.push(path.resolve(dirSaida(opts), post.id, post.pauta));
  for (const c of cands) {
    const j = lerJson(c, null);
    if (j && typeof j === 'object') return j;
  }
  return null;
}

// ------------------------------------------------------------------ criticidade

const sem = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Rumor / vazamento.
export const PALAVRAS_RUMOR = ['rumor', 'rumores', 'vazou', 'vazamento', 'vazado', 'vazada', 'leak', 'leaks', 'leaked', 'boato',
  'boatos', 'suposto', 'suposta', 'supostamente', 'insider', 'segundo fontes', 'nao confirmado', 'nao oficial', 'especula'];
// Assuntos sensíveis (comparação sem acento e em minúsculas, por prefixo de palavra).
export const PALAVRAS_SENSIVEIS = ['morte', 'morreu', 'morre ', 'mortos', 'falece', 'faleceu', 'obito', 'luto', 'assassin', 'homicid',
  'crime', 'criminos', 'preso', 'presa ', 'prisao', 'policia', 'tiroteio', 'atentado', 'terroris', 'estupro', 'assedio', 'abuso',
  'violencia', 'politic', 'eleica', 'eleicoes', 'presidente', 'governo', 'partido', 'deputad', 'senador', 'ministro', 'guerra',
  'polemica', 'cancelad', 'menor de idade', 'menores', 'crianca', 'pedofil', 'suicid', 'depressao', 'saude', 'doenca', 'cancer',
  'hospital', 'internad', 'drogas', 'overdose', 'racis', 'homofob', 'transfob', 'xenofob', 'nazis', 'religia', 'aborto', 'armas de fogo'];
// Acusações (na legenda).
export const PALAVRAS_ACUSACAO = ['acusa', 'acusou', 'acusad', 'acusacao', 'culpa ', 'culpad', 'fraude', 'golpe', 'golpista', 'mentiu',
  'mentira', 'roubou', 'roubo', 'processa', 'processou', 'processad', 'denuncia', 'escandalo', 'boicote', 'calote', 'enganou', 'picaret'];
// Lojas aceitas como fonte de preço (domínio da própria loja).
export const DOMINIOS_LOJA = ['store.steampowered.com', 'steampowered.com', 'steamcommunity.com', 'store.epicgames.com', 'epicgames.com',
  'store.playstation.com', 'playstation.com', 'xbox.com', 'microsoft.com', 'nintendo.com', 'nintendo.com.br', 'gog.com',
  'humblebundle.com', 'ea.com', 'ubisoft.com', 'store.ubisoft.com', 'battle.net', 'rockstargames.com'];
const SEIS_HORAS = 6 * 3600 * 1000;

function achar(texto, lista) {
  const t = ' ' + sem(texto).replace(/[^a-z0-9@#$%,.\s-]/g, ' ').replace(/\s+/g, ' ') + ' ';
  return [...new Set(lista.filter((w) => t.includes(' ' + w)))];
}
function hostDe(url) {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
}
function ehLoja(f) {
  if (f?.loja === true) return true;
  const h = hostDe(f?.url);
  return !!h && DOMINIOS_LOJA.some((d) => h === d || h.endsWith('.' + d));
}
function quando(v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Date.parse(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Aplica as 6 regras automáticas do contrato. Retorna a lista de motivos (vazia = não crítico).
 * @param {object} post   post.json
 * @param {object} [ctx]  { pauta, publicados: { tiktok: n, instagram: n }, redes: ['tiktok',...], now }
 */
export function regrasAutomaticas(post, ctx = {}) {
  const pauta = ctx.pauta || {};
  const now = (ctx.now || Date.now)();
  const cenas = Array.isArray(pauta.cenas) ? pauta.cenas : [];
  const fontes = [...(Array.isArray(post.fontes) ? post.fontes : []), ...(Array.isArray(pauta.fontes) ? pauta.fontes : [])];
  const tipo = sem(pauta.tipo || post.tipo || 'noticia');
  const legenda = [post.legenda, (post.hashtags || []).join(' '), pauta.post?.legenda].filter(Boolean).join('\n');
  const textoTodo = [post.titulo, pauta.titulo, legenda,
    ...cenas.flatMap((c) => [c.fala, c.texto, ...(Array.isArray(c.itens) ? c.itens.map((i) => i?.nome) : [])])].filter(Boolean).join('\n');
  const motivos = [];

  // 1. rumor / vazamento, ou nenhuma fonte oficial
  const rumor = achar(textoTodo, PALAVRAS_RUMOR);
  if (rumor.length) motivos.push(`Rumor/vazamento no texto ("${rumor.slice(0, 3).join('", "')}")`);
  if (tipo !== 'promocao' && !fontes.some((f) => f && f.oficial === true)) motivos.push('Nenhuma fonte oficial (oficial: true)');

  // 2. preço/promoção sem fonte da loja, ou promoção acabando em menos de 6 h
  const itens = cenas.flatMap((c) => (Array.isArray(c.itens) ? c.itens : []));
  const temPreco = tipo === 'promocao' || itens.some((i) => i && (i.de || i.por || i.desconto))
    || /r\$\s?\d|\d+\s?%\s?(de\s)?(off|desconto)|-\d{1,2}%|\bgratis\b|\bde graca\b|\bpromoca|\bdesconto/.test(sem(textoTodo));
  if (temPreco) {
    if (!fontes.some(ehLoja)) motivos.push('Preço/promoção sem fonte da própria loja');
    const fins = [pauta.terminaEm, post.terminaEm, ...itens.map((i) => i?.terminaEm), ...fontes.map((f) => f?.terminaEm)].map(quando).filter((x) => x != null);
    const menor = fins.length ? Math.min(...fins) : null;
    if (menor != null && menor - now < SEIS_HORAS) motivos.push('Promoção termina em menos de 6 h');
  }

  // 3. assunto sensível
  const sens = achar(textoTodo, PALAVRAS_SENSIVEIS);
  if (sens.length) motivos.push(`Assunto sensível ("${sens.slice(0, 3).map((s) => s.trim()).join('", "')}")`);

  // 4. imagem sem crédito
  const semCredito = cenas.filter((c) => c && c.imagem && !String(c.credito || '').trim()).length
    + (Array.isArray(post.imagens) ? post.imagens.filter((i) => i && !String(i.credito || '').trim()).length : 0);
  if (semCredito) motivos.push(`${semCredito} imagem(ns) sem crédito`);

  // 5. primeira postagem numa rede
  const pub = ctx.publicados || {};
  for (const r of ctx.redes || REDES) if (!pub[r]) motivos.push(`Primeira postagem no ${NOME_REDE[r] || r}`);

  // 6. menção (@) ou acusação a pessoa/empresa na legenda
  const legSemTags = String(post.legenda || '');
  const mencoes = legSemTags.match(/(^|[\s(])@[\w.]{2,}/g) || [];
  if (mencoes.length) motivos.push(`Legenda menciona ${mencoes.map((m) => m.trim()).slice(0, 3).join(', ')}`);
  const acus = achar(legSemTags, PALAVRAS_ACUSACAO);
  if (acus.length) motivos.push(`Legenda com acusação ("${acus.slice(0, 3).map((s) => s.trim()).join('", "')}")`);

  return motivos;
}

/** Quantos posts já foram publicados (de verdade) em cada rede, ignorando um id. */
export function publicadosPorRede(opts = {}, exceto = null) {
  const out = {};
  for (const p of listar(opts)) {
    if (p.id === exceto) continue;
    for (const [r, v] of Object.entries(p.redes || {})) if (v && v.estado === 'publicado') out[r] = (out[r] || 0) + 1;
  }
  return out;
}

export function redesAlvo(post) {
  const r = Array.isArray(post.redesAlvo) ? post.redesAlvo.filter((x) => REDES.includes(x)) : [];
  return r.length ? r : REDES.slice();
}

/** Reavalia as regras para um post (lendo pauta e histórico da fila). */
export function avaliar(post, opts = {}) {
  return regrasAutomaticas(post, {
    pauta: pautaDo(post, opts), publicados: publicadosPorRede(opts, post.id), redes: opts.redes || redesAlvo(post), now: opts.now,
  });
}

// ------------------------------------------------------------------ aprovação do usuário (assinada)

function chaveFila(opts) {
  let k = lerSegredos(opts).fila?.chave;
  if (typeof k === 'string' && k.length >= 32) return k;
  k = randomBytes(32).toString('hex');
  alterarSegredos((s) => { s.fila = { ...(s.fila || {}), chave: k }; return s; }, opts);
  return k;
}

/** Impressão digital do conteúdo que o usuário viu: legenda, hashtags e o arquivo de vídeo. */
export function digitalConteudo(post, opts = {}) {
  let tam = 0;
  try { tam = statSync(path.join(pastaDo(post.id, opts), String(post.video || 'video.mp4'))).size; } catch {}
  return createHash('sha256').update(JSON.stringify([post.id, post.legenda || '', post.hashtags || [], post.video || '', tam])).digest('hex');
}

function assinar(post, em, opts) {
  return createHmac('sha256', chaveFila(opts)).update(`${post.id}|${em}|${digitalConteudo(post, opts)}`).digest('hex');
}

/** A aprovação do usuário é válida para o conteúdo atual? */
export function aprovacaoValida(post, opts = {}) {
  const a = post.aprovacao;
  if (post.aprovadoPor !== 'usuario' || !a || typeof a.assinatura !== 'string' || !a.em) return false;
  const k = lerSegredos(opts).fila?.chave;
  if (typeof k !== 'string' || k.length < 32) return false;
  const esperado = Buffer.from(assinar(post, a.em, opts), 'hex');
  const veio = Buffer.from(a.assinatura, 'hex');
  return veio.length === esperado.length && timingSafeEqual(veio, esperado);
}

// ------------------------------------------------------------------ ações

const NAO_MEXE = new Set(['publicando', 'publicado']);

/**
 * Revisão: o revisor diz se é crítico e por quê; as regras automáticas são somadas SEMPRE.
 * Crítico → aguardando; não crítico → aprovado.
 */
export function revisar(id, { critico = false, motivos = [] } = {}, opts = {}) {
  return atualizar(id, (p) => {
    if (NAO_MEXE.has(p.estado)) throw new Error(`Post "${id}" está ${p.estado}; não dá para revisar agora.`);
    const auto = avaliar(p, opts);
    const doRevisor = motivos.map((m) => String(m).trim()).filter(Boolean);
    const ehCritico = !!critico || auto.length > 0;
    const now = (opts.now || Date.now)();
    p.revisao = { em: now, criticoRevisor: !!critico, motivosRevisor: doRevisor, motivosAuto: auto };
    p.critico = ehCritico;
    p.motivos = [...doRevisor, ...auto];
    // conteúdo revisado de novo: aprovação anterior do usuário não vale mais
    delete p.aprovadoPor; delete p.aprovadoEm; delete p.aprovacao;
    p.estado = ehCritico ? 'aguardando' : 'aprovado';
    return p;
  }, opts);
}

/**
 * Aprovar. `porUsuario: true` só é usado pelo servidor (página local ou aparelho pareado).
 * Sem porUsuario (CLI/agentes), um post crítico é RECUSADO e vai para "aguardando".
 */
export function aprovar(id, { porUsuario = false } = {}, opts = {}) {
  const p = ler(id, opts);
  if (NAO_MEXE.has(p.estado)) throw new Error(`Post "${id}" está ${p.estado}.`);
  if (p.estado === 'rejeitado' && !porUsuario) throw new Error(`Post "${id}" foi rejeitado.`);
  const auto = avaliar(p, opts);
  const critico = p.critico === true || auto.length > 0;
  const now = (opts.now || Date.now)();
  if (!porUsuario) {
    if (critico) {
      p.critico = true;
      p.motivos = [...new Set([...(p.revisao?.motivosRevisor || []), ...auto, ...(p.motivos || [])])];
      if (p.estado !== 'aguardando') { p.estado = 'aguardando'; salvar(p, opts); }
      const e = new Error(`Post crítico: só o usuário pode aprovar, pela página do escritório. Motivos: ${p.motivos.join('; ')}`);
      e.codigo = 'CRITICO';
      throw e;
    }
    p.critico = false;
    p.motivos = p.revisao?.motivosRevisor || [];
    p.estado = 'aprovado';
    return salvar(p, opts);
  }
  p.critico = critico;
  if (critico) p.motivos = [...new Set([...(p.motivos || []), ...auto])];
  p.estado = 'aprovado';
  p.aprovadoPor = 'usuario';
  p.aprovadoEm = now;
  p.aprovacao = { em: now, assinatura: assinar(p, now, opts) };
  delete p.rejeitadoEm; delete p.motivoRejeicao;
  return salvar(p, opts);
}

export function rejeitar(id, motivo, opts = {}) {
  const m = String(motivo ?? '').trim();
  if (!m) throw new Error('Diga o motivo da rejeição (--motivo "...").');
  return atualizar(id, (p) => {
    if (NAO_MEXE.has(p.estado)) throw new Error(`Post "${id}" está ${p.estado}.`);
    p.estado = 'rejeitado';
    p.motivoRejeicao = m.slice(0, 500);
    p.rejeitadoEm = (opts.now || Date.now)();
    delete p.aprovadoPor; delete p.aprovadoEm; delete p.aprovacao;
    return p;
  }, opts);
}

/** Resumo para a página e para `listar`. */
export function resumo(p) {
  return {
    id: p.id, titulo: p.titulo || p.id, estado: p.estado, critico: p.critico ?? null, motivos: p.motivos || [],
    duracao: p.duracao ?? null, criadoEm: p.criadoEm || null, legenda: p.legenda || '', hashtags: p.hashtags || [],
    temVideo: !!p.video, temCapa: !!p.capa, aprovadoPor: p.aprovadoPor || null, aprovadoEm: p.aprovadoEm || null,
    motivoRejeicao: p.motivoRejeicao || null, redes: p.redes || {}, erro: p.erro || null,
  };
}

// ------------------------------------------------------------------ CLI

function parseArgs(argv) {
  const pos = [], flags = { motivo: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--critico') flags.critico = true;
    else if (a === '--motivo') flags.motivo.push(argv[++i] ?? '');
    else if (a.startsWith('--motivo=')) flags.motivo.push(a.slice(9));
    else if (a === '--json') flags.json = true;
    else pos.push(a);
  }
  return { pos, flags };
}

export function cli(argv, out = console.log, opts = {}) {
  const { pos, flags } = parseArgs(argv);
  const [cmd, id] = pos;
  const linha = (p) => `${p.estado.padEnd(10)} ${p.critico ? 'CRÍTICO ' : '        '}${p.id}  ${p.titulo || ''}${p.motivos?.length ? '\n           motivos: ' + p.motivos.join('; ') : ''}`;
  switch (cmd) {
    case 'listar': {
      const l = listar(opts);
      if (flags.json) out(JSON.stringify(l.map(resumo), null, 2));
      else out(l.length ? l.map(linha).join('\n') : `Nenhum post em ${dirSaida(opts)}.`);
      return 0;
    }
    case 'ver': out(JSON.stringify(ler(id, opts), null, 2)); return 0;
    case 'revisar': {
      const p = revisar(id, { critico: !!flags.critico, motivos: flags.motivo }, opts);
      out(p.critico ? `⚠ ${id}: CRÍTICO → aguardando aprovação do usuário na página.\n  motivos: ${p.motivos.join('; ')}` : `✓ ${id}: não crítico → aprovado (pode postar).`);
      return 0;
    }
    case 'aprovar': {
      try {
        aprovar(id, { porUsuario: false }, opts);
        out(`✓ ${id}: aprovado (não crítico).`);
        return 0;
      } catch (e) {
        if (e.codigo === 'CRITICO') { out(`✗ ${e.message}`); return 3; }
        throw e;
      }
    }
    case 'rejeitar': rejeitar(id, flags.motivo.join(' '), opts); out(`✓ ${id}: rejeitado.`); return 0;
    default:
      out('Uso: node producao/fila.js listar | ver <id> | revisar <id> [--critico] [--motivo "..."]... | aprovar <id> | rejeitar <id> --motivo "..."');
      return cmd ? 2 : 0;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try { process.exitCode = cli(process.argv.slice(2)); } catch (e) { console.error('Erro: ' + e.message); process.exitCode = 1; }
}
