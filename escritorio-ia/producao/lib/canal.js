// Configuração do canal (producao/canal.json) + escolha e leitura das fontes.
import { existsSync, readFileSync, openSync, readSync, closeSync } from 'node:fs';
import path from 'node:path';
import { PRODUCAO } from './ferramentas.js';

export const ARQUIVO_CANAL = path.join(PRODUCAO, 'canal.json');

const PADRAO = {
  nome: 'PLANTÃO GAMER',
  arroba: '@plantaogamer',
  chamadaFim: 'SEGUE PRA NÃO PERDER NADA',
  cores: {
    fundo1: '#0B1026', fundo2: '#3B0A8C', fundo3: '#0A5C7A', destaque: '#FFD60A', destaque2: '#00F5D4',
    alerta: '#FF2E63', texto: '#FFFFFF', card: '#141A3A',
  },
  fonte: null,
  fonteTitulo: null,
  voz: { modelo: 'pt_BR-faber-medium', velocidade: 1.08 },
  trilha: 'auto',
  volumeTrilha: 0.5,
  efeitos: true,
};

export function carregarCanal(arquivo = ARQUIVO_CANAL) {
  let c = {};
  if (existsSync(arquivo)) {
    try { c = JSON.parse(readFileSync(arquivo, 'utf8')); } catch (e) { throw new Error(`canal.json inválido: ${e.message}`); }
  }
  const canal = { ...PADRAO, ...c, cores: { ...PADRAO.cores, ...(c.cores || {}) }, voz: { ...PADRAO.voz, ...(c.voz || {}) } };
  for (const [k, v] of Object.entries(canal.cores)) {
    if (!/^#?[0-9a-f]{6}$/i.test(v)) throw new Error(`canal.json: cor "${k}" inválida (${v}); use #RRGGBB`);
    canal.cores[k] = v.startsWith('#') ? v.toUpperCase() : '#' + v.toUpperCase();
  }
  return canal;
}

// ---------- fontes ----------
const WINFONTS = path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts');
const CANDIDATAS = {
  titulo: [
    path.join(WINFONTS, 'impact.ttf'), path.join(WINFONTS, 'ariblk.ttf'), path.join(WINFONTS, 'segoeuib.ttf'),
    path.join(WINFONTS, 'arialbd.ttf'),
    '/System/Library/Fonts/Supplemental/Impact.ttf', '/System/Library/Fonts/Supplemental/Arial Black.ttf',
    '/usr/share/fonts/truetype/msttcorefonts/Impact.ttf', '/usr/share/fonts/truetype/anton/Anton-Regular.ttf',
    '/usr/share/fonts/opentype/inter/Inter-Black.otf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf', '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
  ],
  texto: [
    path.join(WINFONTS, 'ariblk.ttf'), path.join(WINFONTS, 'segoeuib.ttf'), path.join(WINFONTS, 'arialbd.ttf'),
    '/System/Library/Fonts/Supplemental/Arial Black.ttf', '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
    '/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf', '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
  ],
};

/** Lê o nome da família e o estilo de um .ttf/.otf (tabela "name"). */
export function lerNomeFonte(arquivo) {
  const fd = openSync(arquivo, 'r');
  try {
    const ler = (pos, n) => { const b = Buffer.alloc(n); readSync(fd, b, 0, n, pos); return b; };
    let base = 0;
    let cab = ler(0, 12);
    if (cab.toString('latin1', 0, 4) === 'ttcf') { base = ler(12, 4).readUInt32BE(0); cab = ler(base, 12); }
    const nTabelas = cab.readUInt16BE(4);
    const dir = ler(base + 12, nTabelas * 16);
    let off = -1;
    for (let i = 0; i < nTabelas; i++) {
      if (dir.toString('latin1', i * 16, i * 16 + 4) === 'name') off = dir.readUInt32BE(i * 16 + 8);
    }
    if (off < 0) return null;
    const h = ler(off, 6);
    const n = h.readUInt16BE(2);
    const strOff = off + h.readUInt16BE(4);
    const recs = ler(off + 6, n * 12);
    const nomes = {};
    for (let i = 0; i < n; i++) {
      const plat = recs.readUInt16BE(i * 12);
      const lang = recs.readUInt16BE(i * 12 + 4);
      const id = recs.readUInt16BE(i * 12 + 6);
      const len = recs.readUInt16BE(i * 12 + 8);
      const o = recs.readUInt16BE(i * 12 + 10);
      if (![1, 2, 4, 16, 17].includes(id)) continue;
      const b = ler(strOff + o, len);
      let s;
      if (plat === 3 || plat === 0) {
        if (plat === 3 && lang !== 0x409 && nomes[id]) continue;
        s = ''; for (let j = 0; j + 1 < b.length; j += 2) s += String.fromCharCode(b.readUInt16BE(j));
      } else if (plat === 1 && !nomes[id]) s = b.toString('latin1');
      if (s) nomes[id] = s;
    }
    return { familia: nomes[1], estilo: nomes[2] || 'Regular', completo: nomes[4] };
  } finally { closeSync(fd); }
}

function escolher(preferida, lista) {
  const tentar = preferida ? [path.isAbsolute(preferida) ? preferida : path.resolve(PRODUCAO, preferida), path.join(WINFONTS, preferida)] : [];
  for (const arq of [...tentar, ...lista]) {
    if (arq && existsSync(arq)) {
      try {
        const n = lerNomeFonte(arq);
        if (n?.familia) return { arquivo: arq, familia: n.familia, negrito: /bold/i.test(n.estilo) };
      } catch { /* tenta a próxima */ }
    }
  }
  if (preferida) throw new Error(`fonte "${preferida}" (canal.json) não encontrada`);
  return null;
}

/** Fontes de título e de texto. Retorna { titulo, texto } com { arquivo, familia, negrito }. */
export function escolherFontes(canal) {
  const titulo = escolher(canal.fonteTitulo, CANDIDATAS.titulo);
  const texto = escolher(canal.fonte, CANDIDATAS.texto) || titulo;
  if (!titulo && !texto) {
    throw new Error('nenhuma fonte grossa encontrada. Indique uma em producao/canal.json → "fonte": "C:\\\\Windows\\\\Fonts\\\\arialbd.ttf"');
  }
  return { titulo: titulo || texto, texto: texto || titulo };
}
