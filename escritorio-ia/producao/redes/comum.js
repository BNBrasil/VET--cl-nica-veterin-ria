// Utilidades compartilhadas da postagem: caminhos, segredos (data/segredos.json), escrita atômica e HTTP com timeout.
//
// Segredos: data/segredos.json → { apiKey?, redes: { instagram: {...}, tiktok: {...} }, fila: { chave } }.
// NUNCA registre tokens em log nem os devolva em respostas da API.
import { readFileSync, writeFileSync, renameSync, mkdirSync, unlinkSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_DIR = path.join(__dirname, '..', '..');

/** Pasta dos posts prontos (configurável: opção dir ou variável PRODUCAO_SAIDA). */
export function dirSaida(opts = {}) {
  return path.resolve(opts.dir || process.env.PRODUCAO_SAIDA || path.join(PROJECT_DIR, 'producao', 'saida'));
}
/** Pasta data/ do escritório (configurável: opção dataDir ou variável ESCRITORIO_DATA). */
export function dirData(opts = {}) {
  return path.resolve(opts.dataDir || process.env.ESCRITORIO_DATA || path.join(PROJECT_DIR, 'data'));
}

/** Escreve JSON de forma atômica: arquivo temporário na mesma pasta + rename. */
export function escreverJsonAtomico(file, obj, mode) {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  try {
    writeFileSync(tmp, JSON.stringify(obj, null, 2), mode ? { mode } : undefined);
    renameSync(tmp, file);
  } catch (e) {
    try { unlinkSync(tmp); } catch {}
    throw e;
  }
}

export function lerJson(file, fallback) {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return fallback; }
}

export function arquivoSegredos(opts = {}) { return path.join(dirData(opts), 'segredos.json'); }
export function lerSegredos(opts = {}) {
  const s = lerJson(arquivoSegredos(opts), {});
  return s && typeof s === 'object' && !Array.isArray(s) ? s : {};
}
/** Altera segredos.json preservando o que já existe (apiKey, outras redes...). */
export function alterarSegredos(fn, opts = {}) {
  const s = lerSegredos(opts);
  const novo = fn(s) || s;
  escreverJsonAtomico(arquivoSegredos(opts), novo, 0o600);
  return novo;
}
export function credenciais(rede, opts = {}) {
  const r = lerSegredos(opts).redes || {};
  return r[rede] && typeof r[rede] === 'object' ? r[rede] : null;
}
export function salvarCredenciais(rede, patch, opts = {}) {
  alterarSegredos((s) => {
    s.redes = s.redes && typeof s.redes === 'object' ? s.redes : {};
    if (patch === null) delete s.redes[rede];
    else s.redes[rede] = { ...(s.redes[rede] || {}), ...patch };
    return s;
  }, opts);
}
/** Uma rede está pronta para postar de verdade? */
export function redeConfigurada(rede, opts = {}) {
  const c = credenciais(rede, opts);
  if (!c || !c.token) return false;
  if (rede === 'instagram') return !!c.igUserId;
  return true;
}

export const REDES = ['tiktok', 'instagram'];
export const NOME_REDE = { tiktok: 'TikTok', instagram: 'Instagram' };

/** Esconde qualquer coisa com cara de token antes de mostrar uma mensagem de erro. */
export function semSegredos(texto, segredos = []) {
  let t = String(texto ?? '');
  for (const s of segredos) if (s && String(s).length >= 6) t = t.split(String(s)).join('***');
  return t.replace(/(access_token|token|Bearer|OAuth)([=:\s]+)[A-Za-z0-9._\-|%]{12,}/gi, '$1$2***');
}

export class ErroRede extends Error {
  constructor(msg, extra = {}) { super(msg); Object.assign(this, extra); }
}

/**
 * fetch com timeout e mensagem de erro em português.
 * @param {Function} fetchFn fetch injetável (testes)
 */
export async function pedir(fetchFn, url, init = {}, { timeoutMs = 60000, oQue = 'a rede' } = {}) {
  let res;
  try {
    res = await fetchFn(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    if (e?.name === 'TimeoutError' || e?.name === 'AbortError') throw new ErroRede(`Tempo esgotado falando com ${oQue} (${Math.round(timeoutMs / 1000)} s).`, { temporario: true });
    throw new ErroRede(`Sem conexão com ${oQue}: ${e?.cause?.code || e?.message || e}.`, { temporario: true });
  }
  return res;
}

export async function jsonDe(res) {
  const txt = await res.text();
  try { return JSON.parse(txt); } catch { return { _texto: txt.slice(0, 300) }; }
}

export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
