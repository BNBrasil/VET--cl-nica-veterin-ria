// Temas do escritório: lê temas/<id>.json + data/aparencia.json (ajustes do usuário) e resolve a configuração
// final que o gerador usa. Ordem (o de baixo vence): padrões → tema "*" → tema <sala> → usuário "*" → usuário <sala>.
// Contrato: temas/CONTRATO.md. Valores inválidos são ignorados com aviso (ou lançam, com { estrito: true }).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isHex, norm } from './cor.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TEMAS_DIR = path.join(ROOT, 'temas');

export const PISOS = ['madeira', 'carpete', 'azulejo', 'concreto', 'xadrez', 'grama'];
export const PAREDES = ['lisa', 'tijolo', 'painel', 'papel', 'vidro'];
export const ILUMINACOES = ['dia', 'tarde', 'noite'];
export const FORMATOS = ['duas-fileiras', 'uma-fileira', 'L', 'andares'];
export const TAMANHOS = ['pequena', 'media', 'grande'];
export const CABELOS = ['curto', 'longo', 'coque', 'careca', 'bone', 'gorro', 'cacheado', 'moicano'];
export const ACESSORIOS = ['nenhum', 'oculos', 'fone', 'bone', 'chapeu', 'bigode', 'barba', 'lapis'];
export const OPCOES = { piso: PISOS, parede: PAREDES, iluminacao: ILUMINACOES, formato: FORMATOS, tamanhoSala: TAMANHOS, cabelo: CABELOS, acessorio: ACESSORIOS };

/** Tons de pele padrão (índice 0..3), iguais à arte original. */
export const PELE_PADRAO = ['#f0c8a0', '#d09870', '#a06a48', '#7a4a30'];
/** Cores de cabelo sugeridas para a interface (a pessoa pode escolher qualquer #rrggbb). */
export const CABELO_PADRAO = ['#2c2438', '#3e2a20', '#6a4630', '#c06030', '#e8c860', '#c8c8d0', '#5a2a90', '#406858'];

const ID_RE = /^[a-z0-9][a-z0-9-]{0,40}$/;

export function lerRooms(root = ROOT) { return JSON.parse(fs.readFileSync(path.join(root, 'shared', 'rooms.json'), 'utf8')); }

export function listarTemas(dir = TEMAS_DIR) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).filter((id) => ID_RE.test(id))
    .sort((a, b) => (a === 'padrao' ? -1 : b === 'padrao' ? 1 : a.localeCompare(b)));
}

export function carregarTema(id = 'padrao', dir = TEMAS_DIR) {
  if (!ID_RE.test(String(id))) throw new Error(`id de tema inválido: ${id}`);
  const p = path.join(dir, `${id}.json`);
  if (!fs.existsSync(p)) {
    if (id === 'padrao') return { id: 'padrao', nome: 'Padrão', descricao: 'O escritório original.' };
    throw new Error(`tema não encontrado: ${id} (${p})`);
  }
  const t = JSON.parse(fs.readFileSync(p, 'utf8'));
  t.id = id;
  return t;
}

/** Pasta de dados: argumento > ESCRITORIO_DATA > <raiz>/data. */
export function pastaDados(arg) { return path.resolve(arg || process.env.ESCRITORIO_DATA || path.join(ROOT, 'data')); }

export function carregarAparencia(dataDir) {
  const p = path.join(pastaDados(dataDir), 'aparencia.json');
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { throw new Error(`aparencia.json inválido: ${e.message}`); }
}

// ---------------------------------------------------------------- validação
/**
 * Valida um bloco de ajustes (tema ou aparencia.json). Retorna a lista de erros (strings); vazia = ok.
 * Campos desconhecidos são ignorados (não são erro).
 */
export function validarAjustes(obj, { peleMax = PELE_PADRAO.length, onde = 'aparencia' } = {}) {
  const erros = [];
  if (obj == null) return erros;
  if (typeof obj !== 'object' || Array.isArray(obj)) return [`${onde}: deve ser um objeto`];
  const cor = (v, campo) => { if (v !== undefined && v !== null && !isHex(v)) erros.push(`${campo}: cor inválida "${v}" (use #rrggbb)`); };
  const enumr = (v, lista, campo) => { if (v !== undefined && v !== null && !lista.includes(v)) erros.push(`${campo}: "${v}" não é um de ${lista.join(', ')}`); };
  if (obj.tema !== undefined && !ID_RE.test(String(obj.tema))) erros.push(`tema: id inválido "${obj.tema}"`);
  for (const [id, s] of Object.entries(obj.salas || {})) {
    const c = `salas.${id}`;
    if (!s || typeof s !== 'object') { erros.push(`${c}: deve ser um objeto`); continue; }
    cor(s.destaque, `${c}.destaque`); cor(s.corPiso, `${c}.corPiso`); cor(s.corParede, `${c}.corParede`);
    enumr(s.piso, PISOS, `${c}.piso`); enumr(s.parede, PAREDES, `${c}.parede`); enumr(s.iluminacao, ILUMINACOES, `${c}.iluminacao`);
  }
  for (const [id, p] of Object.entries(obj.personagens || {})) {
    const c = `personagens.${id}`;
    if (!p || typeof p !== 'object') { erros.push(`${c}: deve ser um objeto`); continue; }
    if (p.pele !== undefined && p.pele !== null && !(Number.isInteger(p.pele) && p.pele >= 0 && p.pele < peleMax)) erros.push(`${c}.pele: índice ${p.pele} fora de 0..${peleMax - 1}`);
    enumr(p.cabelo, CABELOS, `${c}.cabelo`); enumr(p.acessorio, ACESSORIOS, `${c}.acessorio`);
    cor(p.corCabelo, `${c}.corCabelo`); cor(p.roupa, `${c}.roupa`); cor(p.calca, `${c}.calca`);
  }
  if (obj.mapa) { enumr(obj.mapa.formato, FORMATOS, 'mapa.formato'); enumr(obj.mapa.tamanhoSala, TAMANHOS, 'mapa.tamanhoSala'); }
  if (obj.iluminacao !== undefined) enumr(obj.iluminacao, ILUMINACOES, 'iluminacao');
  const pal = obj.paleta;
  if (pal) {
    for (const [k, v] of Object.entries(pal.base || {})) cor(v, `paleta.base.${k}`);
    (pal.pele || []).forEach((v, i) => cor(v, `paleta.pele[${i}]`));
    (pal.cabelo || []).forEach((v, i) => cor(v, `paleta.cabelo[${i}]`));
    (pal.restrita || []).forEach((v, i) => cor(v, `paleta.restrita[${i}]`));
    if (pal.restrita && pal.restrita.length > 64) erros.push('paleta.restrita: no máximo 64 cores');
  }
  for (const [k, v] of Object.entries(obj.interface || {})) cor(v, `interface.${k}`);
  return erros;
}

// ---------------------------------------------------------------- resolução
const SALA_CAMPOS = ['destaque', 'piso', 'parede', 'corPiso', 'corParede', 'neon', 'plantas'];
const PERS_CAMPOS = ['pele', 'cabelo', 'corCabelo', 'roupa', 'calca', 'acessorio'];

function pickValid(src, campos, check) {
  const out = {};
  for (const k of campos) if (src && src[k] !== undefined && src[k] !== null && check(k, src[k])) out[k] = typeof src[k] === 'string' && src[k].startsWith('#') ? norm(src[k]) : src[k];
  return out;
}

/**
 * Configuração final. { tema, aparencia } já carregados (objetos) ou ids; rooms = shared/rooms.json.
 * Retorna { tema:{id,nome,descricao,interface}, iluminacao, mapa, salas, personagens, paleta, avisos }.
 */
export function resolverConfig({ tema = null, aparencia = null, rooms = lerRooms(), estrito = false, temasDir = TEMAS_DIR } = {}) {
  const avisos = [];
  const ap = aparencia || {};
  const temaObj = typeof tema === 'object' && tema ? tema : carregarTema(tema || ap.tema || 'padrao', temasDir);
  const pele = (temaObj.paleta?.pele?.length ? temaObj.paleta.pele : PELE_PADRAO).map(norm);
  const e1 = validarAjustes(temaObj, { peleMax: pele.length, onde: `tema ${temaObj.id}` }).map((e) => `tema ${temaObj.id}: ${e}`);
  const e2 = validarAjustes(ap, { peleMax: pele.length }).map((e) => `aparencia: ${e}`);
  if (estrito && (e1.length || e2.length)) throw new Error([...e1, ...e2].join('; '));
  avisos.push(...e1, ...e2);

  const salaOk = (k, v) => {
    if (k === 'destaque' || k === 'corPiso' || k === 'corParede') return isHex(v);
    if (k === 'piso') return PISOS.includes(v);
    if (k === 'parede') return PAREDES.includes(v);
    return typeof v === 'boolean';
  };
  const persOk = (k, v) => {
    if (k === 'pele') return Number.isInteger(v) && v >= 0 && v < pele.length;
    if (k === 'cabelo') return CABELOS.includes(v);
    if (k === 'acessorio') return ACESSORIOS.includes(v);
    return isHex(v);
  };

  const roomIds = [...rooms.rooms, ...rooms.common].map((r) => r.id);
  const accentOf = Object.fromEntries([...rooms.rooms, ...rooms.common, ...(rooms.convidados || [])].map((r) => [r.id, norm(r.accent)]));
  const ts = temaObj.salas || {}, us = ap.salas || {};
  const salas = {};
  for (const id of [...roomIds, 'corredor']) {
    salas[id] = {
      destaque: accentOf[id] || null,
      ...pickValid(ts['*'], SALA_CAMPOS, salaOk), ...pickValid(ts[id], SALA_CAMPOS, salaOk),
      ...pickValid(us['*'], SALA_CAMPOS, salaOk), ...pickValid(us[id], SALA_CAMPOS, salaOk),
    };
    if (id === 'corredor') delete salas[id].destaque;
    if (id !== 'corredor' && !roomIds.includes(id)) delete salas[id];
  }
  // "*" com destaque não faz sentido (todas as salas iguais) — só por sala
  const ilum = [ap.salas?.['*']?.iluminacao, ap.iluminacao, ts['*']?.iluminacao, temaObj.iluminacao].find((v) => ILUMINACOES.includes(v)) || 'dia';

  const tp = temaObj.personagens || {}, up = ap.personagens || {};
  const personagens = {};
  const charIds = [...rooms.rooms.map((r) => r.id), 'visitante', ...(rooms.convidados || []).map((c) => c.id)];
  for (const id of charIds) {
    personagens[id] = { ...pickValid(tp['*'], PERS_CAMPOS, persOk), ...pickValid(tp[id], PERS_CAMPOS, persOk), ...pickValid(up['*'], PERS_CAMPOS, persOk), ...pickValid(up[id], PERS_CAMPOS, persOk) };
  }

  const mapa = { formato: 'duas-fileiras', tamanhoSala: 'media' };
  for (const src of [temaObj.mapa, ap.mapa]) {
    if (FORMATOS.includes(src?.formato)) mapa.formato = src.formato;
    if (TAMANHOS.includes(src?.tamanhoSala)) mapa.tamanhoSala = src.tamanhoSala;
  }

  const tpal = temaObj.paleta || {};
  const paleta = {
    base: Object.fromEntries(Object.entries(tpal.base || {}).filter(([, v]) => isHex(v)).map(([k, v]) => [k, norm(v)])),
    pele,
    cabelo: (tpal.cabelo?.length ? tpal.cabelo : CABELO_PADRAO).filter(isHex).map(norm),
    ajuste: tpal.ajuste || null,
    restrita: tpal.restrita?.length ? tpal.restrita.filter(isHex).map(norm) : null,
  };

  const origem = { destaqueUsuario: Object.keys(us).filter((id) => isHex(us[id]?.destaque)) };
  return {
    origem,
    tema: { id: temaObj.id, nome: temaObj.nome || temaObj.id, descricao: temaObj.descricao || '', interface: temaObj.interface || {} },
    iluminacao: ilum, mapa, salas, personagens, paleta, avisos,
    rooms,
  };
}

/** Carrega tudo a partir do disco: tema (argumento > aparencia.tema > padrao) + aparencia.json. */
export function configDoDisco({ tema = null, dataDir = null, semAparencia = false, mapa = null } = {}) {
  const aparencia = semAparencia ? null : carregarAparencia(dataDir);
  const ap = aparencia ? { ...aparencia } : {};
  if (mapa) ap.mapa = { ...(ap.mapa || {}), ...mapa };
  return resolverConfig({ tema: tema || ap.tema || 'padrao', aparencia: ap });
}
