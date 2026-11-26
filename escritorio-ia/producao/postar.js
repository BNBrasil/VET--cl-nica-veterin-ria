#!/usr/bin/env node
// Publica um post da fila no TikTok e/ou no Instagram.
//
//   node producao/postar.js <id> [--redes tiktok,instagram] [--simular]
//
// Recusa post crítico sem aprovação do usuário (feita pela página). As regras automáticas de criticidade são
// reaplicadas aqui, então mudar o post.json "na mão" não fura a fila.
// Estados: publicando → publicado | erro (| simulado com --simular). Resultado por rede em post.redes.<rede>.
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fila from './fila.js';
import * as instagram from './redes/instagram.js';
import * as tiktok from './redes/tiktok.js';
import { credenciais, salvarCredenciais, redeConfigurada, dirSaida, REDES, NOME_REDE, semSegredos } from './redes/comum.js';

export const MODULOS = { instagram, tiktok };
const PUBLICANDO_VELHO_MS = 30 * 60 * 1000;

export class Recusado extends Error {
  constructor(msg, codigo) { super(msg); this.codigo = codigo; }
}

/** Confere se o post pode sair. Lança Recusado com a explicação. */
export function conferir(post, opts = {}) {
  const now = (opts.now || Date.now)();
  if (post.estado === 'rejeitado') throw new Recusado(`"${post.id}" foi rejeitado${post.motivoRejeicao ? ': ' + post.motivoRejeicao : ''}.`, 'REJEITADO');
  if (post.estado === 'publicando' && now - (post.publicandoEm || 0) < PUBLICANDO_VELHO_MS) throw new Recusado(`"${post.id}" já está sendo publicado.`, 'OCUPADO');
  if (post.estado === 'pronto' || post.estado === 'revisado') throw new Recusado(`"${post.id}" ainda não passou pela revisão (node producao/fila.js revisar ${post.id}).`, 'SEM_REVISAO');
  const auto = fila.avaliar(post, { ...opts, redes: opts.redes });
  const critico = post.critico === true || auto.length > 0;
  if (critico && !fila.aprovacaoValida(post, opts)) {
    const motivos = [...new Set([...(post.motivos || []), ...auto])];
    throw new Recusado(`"${post.id}" é crítico e precisa da aprovação do usuário na página. Motivos: ${motivos.join('; ')}`, 'CRITICO');
  }
  if (!critico && !['aprovado', 'erro', 'simulado', 'publicado', 'publicando', 'aguardando'].includes(post.estado)) {
    throw new Recusado(`"${post.id}" está "${post.estado}".`, 'ESTADO');
  }
  if (!critico && post.estado === 'aguardando' && !fila.aprovacaoValida(post, opts)) {
    throw new Recusado(`"${post.id}" está aguardando aprovação do usuário.`, 'CRITICO');
  }
  return { critico, auto };
}

/**
 * Publica. Retorna o post atualizado.
 * @param {string} id
 * @param {object} opts { redes?, simular?, dir?, dataDir?, fetch?, sleep?, log?, now?, modulos? }
 */
export async function publicar(id, opts = {}) {
  const log = opts.log || (() => {});
  const now = opts.now || Date.now;
  const post = fila.ler(id, opts);
  const pedidas = (opts.redes && opts.redes.length ? opts.redes : fila.redesAlvo(post)).filter((r) => REDES.includes(r));
  if (!pedidas.length) throw new Recusado('Nenhuma rede válida (use tiktok e/ou instagram).', 'REDES');
  conferir(post, { ...opts, redes: pedidas });

  const pasta = path.join(dirSaida(opts), id);
  const arquivo = path.join(pasta, path.basename(String(post.video || 'video.mp4')));
  if (!existsSync(arquivo) || !statSync(arquivo).isFile()) throw new Recusado(`Vídeo não encontrado: ${arquivo}`, 'SEM_VIDEO');

  // só as redes que ainda não saíram
  const faltam = pedidas.filter((r) => !['publicado', 'rascunho'].includes(post.redes?.[r]?.estado));
  if (!faltam.length) { log(`${id}: já publicado em ${pedidas.map((r) => NOME_REDE[r]).join(' e ')}.`); return post; }

  if (!opts.simular && !opts.modulos) {
    const semToken = faltam.filter((r) => !redeConfigurada(r, opts));
    if (semToken.length === faltam.length) {
      throw new Recusado(`Nenhuma das redes pedidas está configurada (${semToken.map((r) => NOME_REDE[r]).join(', ')}). Configure em ⚙ Configurar → Redes sociais ou use --simular.`, 'SEM_TOKEN');
    }
  }

  post.estado = 'publicando';
  post.publicandoEm = now();
  fila.salvar(post, opts);
  opts.onMudou?.(post);

  const modulos = opts.modulos || MODULOS;
  for (const rede of faltam) {
    const cred = credenciais(rede, opts) || {};
    const args = {
      arquivo, legenda: post.legenda || '', hashtags: post.hashtags || [], duracao: post.duracao, ia: post.ia,
      capaUrl: post.capaUrl, cred, fetch: opts.fetch, sleep: opts.sleep, log,
      salvarCred: (patch) => salvarCredenciais(rede, patch, opts),
    };
    let r;
    if (opts.simular) {
      r = { estado: 'simulado', plano: modulos[rede].planejar(args), em: now() };
      log(`${id}: [simulação] ${NOME_REDE[rede]} pronto para enviar (nenhuma chamada feita).`);
    } else {
      try {
        const out = await modulos[rede].publicar(args);
        r = { ...out, em: now() };
        log(`${id}: ${NOME_REDE[rede]} ${out.estado}${out.url ? ' → ' + out.url : ''}${out.aviso ? ' (' + out.aviso + ')' : ''}`);
      } catch (e) {
        r = { estado: 'erro', erro: semSegredos(e.message, [cred.token, cred.refreshToken, cred.clientSecret]), em: now() };
        log(`${id}: ${NOME_REDE[rede]} ERRO: ${r.erro}`);
      }
    }
    const atual = fila.ler(id, opts);
    atual.redes = { ...(atual.redes || {}), [rede]: r };
    fila.salvar(atual, opts);
    Object.assign(post, atual);
  }

  const estados = pedidas.map((r) => post.redes[r]?.estado);
  post.estado = estados.some((e) => e === 'erro') ? 'erro'
    : estados.every((e) => e === 'simulado') ? 'simulado'
      : estados.every((e) => e === 'publicado' || e === 'rascunho' || e === 'simulado') ? (estados.includes('simulado') ? 'simulado' : 'publicado') : 'erro';
  post.erro = post.estado === 'erro' ? pedidas.filter((r) => post.redes[r]?.estado === 'erro').map((r) => `${NOME_REDE[r]}: ${post.redes[r].erro}`).join(' | ') : null;
  if (post.estado === 'publicado') post.publicadoEm = now();
  delete post.publicandoEm;
  fila.salvar(post, opts);
  opts.onMudou?.(post);
  return post;
}

// ------------------------------------------------------------------ CLI
export async function cli(argv, out = console.log, opts = {}) {
  const pos = [];
  let redes = null, simular = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--simular') simular = true;
    else if (argv[i] === '--redes') redes = String(argv[++i] || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    else if (argv[i].startsWith('--redes=')) redes = argv[i].slice(8).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    else pos.push(argv[i]);
  }
  const id = pos[0];
  if (!id) { out('Uso: node producao/postar.js <id> [--redes tiktok,instagram] [--simular]'); return 2; }
  try {
    const p = await publicar(id, { ...opts, redes, simular, log: out });
    out(`${id}: ${p.estado}`);
    return p.estado === 'erro' ? 1 : 0;
  } catch (e) {
    out(`✗ ${e.message}`);
    return e.codigo === 'CRITICO' ? 3 : 1;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) cli(process.argv.slice(2)).then((c) => { process.exitCode = c; });
