// Aparência do escritório (temas, ajustes por sala e por personagem) — CONTRATO: temas/CONTRATO.md.
// Lê temas/*.json, lê/grava data/aparencia.json (escrita atômica, preserva campos desconhecidos) e aplica
// rodando `node art/generate.js` como processo filho (sem shell, um por vez, com fila e timeout).
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, existsSync, statSync, writeFileSync, renameSync, mkdirSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const OPCOES = {
  pisos: ['madeira', 'carpete', 'azulejo', 'concreto', 'xadrez', 'grama'],
  paredes: ['lisa', 'tijolo', 'painel', 'papel', 'vidro'],
  iluminacao: ['dia', 'tarde', 'noite'],
  formatos: ['duas-fileiras', 'uma-fileira', 'L', 'andares'],
  tamanhos: ['pequena', 'media', 'grande'],
  cabelos: ['curto', 'longo', 'coque', 'careca', 'bone', 'gorro', 'cacheado', 'moicano'],
  acessorios: ['nenhum', 'oculos', 'fone', 'bone', 'chapeu', 'bigode', 'barba', 'lapis'],
};

// Tema de reserva, caso temas/padrao.json ainda não exista (as cores são as do CSS original).
const PADRAO_RESERVA = {
  id: 'padrao', nome: 'Padrão', descricao: 'O escritório clássico, escuro com destaques coloridos.',
  mapa: { formato: 'duas-fileiras', tamanhoSala: 'media' },
  interface: { fundo: '#0f0d16', painel: '#211d30', destaque: '#e0a030' },
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const ID_TEMA = /^[a-z0-9][a-z0-9_-]{0,40}$/;
const SALA_CAMPOS = ['destaque', 'piso', 'parede'];
const PERS_CAMPOS = ['pele', 'cabelo', 'corCabelo', 'roupa', 'calca', 'acessorio'];

// Rampas de cor dos personagens atuais (espelho de art/chars.js) — só para a prévia aproximada no navegador.
const SKINS = { light: ['skin', 'skinMid'], mid: ['skinMid', 'skinDark'], dark: ['skinDark', 'skinDeep'], deep: ['skinDeep', 'woodDark'] };
const HAIRS = {
  black: ['ink', 'outline', 'shadow'], darkBrown: ['woodDark', 'outline', 'wood'], brown: ['wood', 'woodDark', 'woodLight'],
  ginger: ['ginger', 'brownDark', 'orange'], blonde: ['blonde', 'tan', 'lamp'], gray: ['light', 'silver', 'snow'],
  plum: ['purpleDark', 'ink', 'purple'], teal: ['tealDark', 'ink', 'teal'],
};

function readJson(file, fallback) {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return fallback; }
}
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

/** Escrita atômica: grava num temporário ao lado e renomeia por cima. */
export function writeJsonAtomic(file, obj) {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n');
  try { renameSync(tmp, file); } catch (e) { try { unlinkSync(tmp); } catch {} throw e; }
}

/** Gerador real: `node art/generate.js` sem shell, argumentos fixos, com timeout. */
export function gerarComNode({ root = ROOT, timeoutMs = 180000 } = {}) {
  return () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, 'art', 'generate.js')], {
      cwd: root, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    const keep = (c) => { out = (out + c.toString()).slice(-4000); };
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error(`o gerador de arte passou de ${Math.round(timeoutMs / 1000)}s e foi interrompido`)); }, timeoutMs);
    child.on('error', (e) => { clearTimeout(timer); reject(new Error('não consegui rodar o gerador: ' + e.message)); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) return resolve({ saida: out.trim() });
      const linhas = out.trim().split('\n').filter(Boolean);
      const erro = linhas.find((l) => /Error|erro/i.test(l)) || linhas[linhas.length - 1] || `código ${code}`;
      reject(new Error('o gerador de arte falhou: ' + erro.replace(/^\s*(Error:\s*)?/, '').slice(0, 300)));
    });
  });
}

/**
 * @param {object} o { root, temasDir, dataFile, assetsDir, rooms (shared/rooms.json), broadcast, gerar, log, now }
 */
export function createAparencia(o = {}) {
  const root = o.root || ROOT;
  const temasDir = o.temasDir || path.join(root, 'temas');
  const dataFile = o.dataFile || path.join(root, 'data', 'aparencia.json');
  const assetsDir = o.assetsDir || path.join(root, 'public', 'assets');
  const rooms = o.rooms || readJson(path.join(root, 'shared', 'rooms.json'), { rooms: [], common: [], convidados: [] });
  const broadcast = o.broadcast || (() => {});
  const gerar = o.gerar || gerarComNode({ root, timeoutMs: o.timeoutMs });
  const log = o.log || (() => {});
  const now = o.now || (() => Date.now());

  const salas = [...(rooms.rooms || []), ...(rooms.common || [])];
  const personagens = [
    ...(rooms.rooms || []).map((r) => ({ id: r.id, nome: r.nomePadrao, cargo: r.cargo, accent: r.accent, convidado: false })),
    ...(rooms.convidados || []).map((c) => ({ id: c.id, nome: c.nomePadrao, cargo: c.cargo, accent: c.accent, convidado: true })),
  ];
  const salaIds = new Set(salas.map((r) => r.id));
  const persIds = new Set(personagens.map((p) => p.id));

  let estado = 'pronto';
  let erro = null;
  let pendente = false;
  let rodando = null;
  let versao = 0;
  try { versao = Math.round(statSync(path.join(assetsDir, 'manifest.json')).mtimeMs); } catch {}
  let aplicada = null; // escolha usada na última geração bem-sucedida (para a prévia saber de onde parte)

  function temas() {
    const lista = [];
    let nomes = [];
    try { nomes = readdirSync(temasDir).filter((f) => f.endsWith('.json')).sort(); } catch {}
    for (const f of nomes) {
      const t = readJson(path.join(temasDir, f), null);
      const id = path.basename(f, '.json');
      if (!isObj(t) || !ID_TEMA.test(id)) continue;
      lista.push({ ...t, id });
    }
    if (!lista.some((t) => t.id === 'padrao')) lista.unshift(PADRAO_RESERVA);
    lista.sort((a, b) => (a.id === 'padrao' ? -1 : b.id === 'padrao' ? 1 : 0));
    return lista;
  }
  const tema = (id) => temas().find((t) => t.id === id) || null;

  function resumoTema(t) {
    const geral = t.salas?.['*'] || {};
    const cores = [t.interface?.fundo, t.interface?.painel, t.interface?.destaque, geral.corPiso, geral.corParede,
      ...((t.paleta?.base || []).slice(0, 6))].filter((c) => HEX.test(c || ''));
    const mini = existsSync(path.join(assetsDir, 'temas', `${t.id}.png`)) ? `assets/temas/${t.id}.png` : null;
    return {
      id: t.id, nome: t.nome || t.id, descricao: t.descricao || '', miniatura: mini,
      cores: [...new Set(cores.map((c) => c.toLowerCase()))].slice(0, 6),
      interface: isObj(t.interface) ? t.interface : {}, mapa: isObj(t.mapa) ? t.mapa : {},
      peles: Array.isArray(t.paleta?.pele) ? t.paleta.pele.filter((c) => HEX.test(c)) : [],
      salas: isObj(t.salas) ? t.salas : {},
    };
  }

  function ler() {
    const d = readJson(dataFile, {});
    return isObj(d) ? d : {};
  }

  /** Valida um pedido de ajuste (parcial). Valor null/"" apaga o ajuste (volta ao padrão do tema/cargo). */
  function validar(input) {
    const erros = [];
    if (!isObj(input)) return { ok: false, erros: ['envie um objeto JSON'] };
    const v = {};
    if ('tema' in input) {
      if (typeof input.tema !== 'string' || !ID_TEMA.test(input.tema) || !tema(input.tema)) erros.push(`tema desconhecido: ${String(input.tema).slice(0, 40)}`);
      else v.tema = input.tema;
    }
    if ('mapa' in input && input.mapa !== null) {
      if (!isObj(input.mapa)) erros.push('mapa deve ser um objeto');
      else {
        v.mapa = {};
        for (const [k, val] of Object.entries(input.mapa)) {
          const lista = k === 'formato' ? OPCOES.formatos : k === 'tamanhoSala' ? OPCOES.tamanhos : null;
          if (!lista) { erros.push(`campo do mapa desconhecido: ${k}`); continue; }
          if (val === null || val === '') v.mapa[k] = null;
          else if (!lista.includes(val)) erros.push(`mapa.${k} inválido: ${String(val).slice(0, 30)} (use ${lista.join(', ')})`);
          else v.mapa[k] = val;
        }
      }
    } else if ('mapa' in input) v.mapa = null;
    const grupo = (nome, ids, campos, checar) => {
      if (!(nome in input)) return;
      if (!isObj(input[nome])) { erros.push(`${nome} deve ser um objeto`); return; }
      v[nome] = {};
      for (const [id, aj] of Object.entries(input[nome])) {
        if (!ids.has(id)) { erros.push(`${nome === 'salas' ? 'sala' : 'personagem'} desconhecido: ${id.slice(0, 40)}`); continue; }
        if (aj === null) { v[nome][id] = null; continue; }
        if (!isObj(aj)) { erros.push(`${nome}.${id} deve ser um objeto`); continue; }
        const out = {};
        for (const [k, val] of Object.entries(aj)) {
          if (!campos.includes(k)) { erros.push(`campo desconhecido em ${nome}.${id}: ${k}`); continue; }
          if (val === null || val === '') { out[k] = null; continue; }
          const msg = checar(k, val);
          if (msg) erros.push(`${nome}.${id}.${k}: ${msg}`); else out[k] = val;
        }
        v[nome][id] = out;
      }
    };
    grupo('salas', salaIds, SALA_CAMPOS, (k, val) => {
      if (k === 'destaque') return HEX.test(val) ? null : 'use uma cor #rrggbb';
      if (k === 'piso') return OPCOES.pisos.includes(val) ? null : `use ${OPCOES.pisos.join(', ')}`;
      return OPCOES.paredes.includes(val) ? null : `use ${OPCOES.paredes.join(', ')}`;
    });
    grupo('personagens', persIds, PERS_CAMPOS, (k, val) => {
      if (k === 'pele') return Number.isInteger(val) && val >= 0 && val < 16 ? null : 'use um número de 0 a 15';
      if (k === 'cabelo') return OPCOES.cabelos.includes(val) ? null : `use ${OPCOES.cabelos.join(', ')}`;
      if (k === 'acessorio') return OPCOES.acessorios.includes(val) ? null : `use ${OPCOES.acessorios.join(', ')}`;
      return HEX.test(val) ? null : 'use uma cor #rrggbb';
    });
    return erros.length ? { ok: false, erros } : { ok: true, valor: v };
  }

  /** Junta o ajuste validado na escolha atual, preservando campos desconhecidos. */
  function mesclar(atual, v) {
    const out = { ...atual };
    if (v.tema) out.tema = v.tema;
    if ('mapa' in v) {
      if (v.mapa === null) delete out.mapa;
      else {
        const m = { ...(isObj(atual.mapa) ? atual.mapa : {}) };
        for (const [k, val] of Object.entries(v.mapa)) { if (val === null) delete m[k]; else m[k] = val; }
        if (Object.keys(m).length) out.mapa = m; else delete out.mapa;
      }
    }
    for (const g of ['salas', 'personagens']) {
      if (!v[g]) continue;
      const grupo = { ...(isObj(atual[g]) ? atual[g] : {}) };
      for (const [id, aj] of Object.entries(v[g])) {
        if (aj === null) { delete grupo[id]; continue; }
        const item = { ...(isObj(grupo[id]) ? grupo[id] : {}) };
        for (const [k, val] of Object.entries(aj)) { if (val === null) delete item[k]; else item[k] = val; }
        if (Object.keys(item).length) grupo[id] = item; else delete grupo[id];
      }
      if (Object.keys(grupo).length) out[g] = grupo; else delete out[g];
    }
    return out;
  }

  function salvar(input) {
    const r = validar(input);
    if (!r.ok) return { ok: false, erro: r.erros.join('; '), erros: r.erros };
    const escolha = mesclar(ler(), r.valor);
    writeJsonAtomic(dataFile, escolha);
    return { ok: true, escolha };
  }

  function restaurar() {
    const atual = ler();
    const escolha = { ...atual, tema: 'padrao' };
    delete escolha.salas; delete escolha.personagens; delete escolha.mapa;
    writeJsonAtomic(dataFile, escolha);
    return { ok: true, escolha, ...aplicar() };
  }

  function interfaceAplicada(idTema) {
    const tj = readJson(path.join(assetsDir, 'tema.json'), null);
    const doArquivo = isObj(tj) ? (isObj(tj.interface) ? tj.interface : isObj(tj.tema?.interface) ? tj.tema.interface : null) : null;
    const id = (isObj(tj) && (typeof tj.tema === 'string' ? tj.tema : tj.id || tj.tema?.id)) || idTema;
    return { tema: id || idTema || 'padrao', interface: doArquivo || tema(idTema || id)?.interface || PADRAO_RESERVA.interface };
  }

  function status() { return { estado, versao, erro, fila: pendente }; }

  function rodar() {
    estado = 'gerando'; erro = null; pendente = false;
    const escolha = ler();
    broadcast({ type: 'aparencia_estado', ...status() });
    log('[aparencia] gerando a arte…');
    rodando = Promise.resolve().then(() => gerar(escolha)).then(() => {
      versao = Math.max(now(), versao + 1);
      aplicada = escolha;
      estado = 'pronto';
      const ia = interfaceAplicada(escolha.tema || 'padrao');
      log(`[aparencia] arte pronta (tema ${ia.tema})`);
      broadcast({ type: 'aparencia', versao, tema: ia.tema, interface: ia.interface });
    }, (e) => {
      estado = 'erro';
      erro = e?.message || String(e);
      log(`[aparencia] ${erro}`);
      broadcast({ type: 'aparencia_estado', ...status() });
    }).then(() => {
      rodando = null;
      if (pendente) rodar();
    });
    return rodando;
  }

  /** Aplica (gera a arte). Se já está gerando, entra na fila (uma geração extra no fim, não várias). */
  function aplicar() {
    if (rodando) { pendente = true; return { ok: true, ...status(), estado: 'gerando', fila: true }; }
    rodar();
    return { ok: true, ...status() };
  }

  /** Cores do sprite atual por parte (para recolorir a prévia no navegador). Aproximado. */
  async function pecas() {
    const pal = readJson(path.join(assetsDir, 'palette.json'), {});
    const nomes = isObj(pal.names) ? pal.names : {};
    let LOOKS = {};
    try { ({ LOOKS } = await import('../art/chars.js')); } catch {}
    const hex = (n) => (nomes[n] || '').toLowerCase();
    const out = {};
    const base = aplicada || ler();
    for (const p of personagens) {
      const look = LOOKS?.[p.id] || (p.convidado ? LOOKS?.visitante : null);
      if (!look) continue;
      const aj = (base.personagens || {})[p.id] || {};
      const lista = (arr) => arr.map(hex).filter(Boolean);
      const proibidas = new Set(lista(['outline', 'ink', look.shirt, look.shoes, look.tie].filter(Boolean)));
      const limpa = (arr) => arr.filter((c) => !proibidas.has(c));
      out[p.id] = {
        exato: !Object.keys(aj).length && !(base.tema && base.tema !== 'padrao'),
        pele: limpa(lista(SKINS[look.skin] || [])),
        cabelo: limpa(lista(HAIRS[look.hair] || [])),
        roupa: limpa(lista(look.top || [])),
        calca: limpa(lista([look.pants].filter(Boolean))),
      };
    }
    return out;
  }

  async function info() {
    const lista = temas().map(resumoTema);
    const escolha = ler();
    return {
      temas: lista, escolha, ...interfaceAplicada((aplicada || escolha).tema || 'padrao'),
      estado: status(), opcoes: {
        ...OPCOES,
        salas: salas.map((r) => ({ id: r.id, nome: r.nome, accent: r.accent, comum: !(rooms.rooms || []).includes(r) })),
        personagens,
      },
      pecas: await pecas(),
    };
  }

  return { temas, tema, ler, validar, mesclar, salvar, restaurar, aplicar, status, info, get rodando() { return rodando; } };
}
