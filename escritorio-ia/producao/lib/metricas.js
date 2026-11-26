// Mede a largura de textos com as métricas reais da fonte (.ttf/.otf: tabelas head, hhea, hmtx,
// OS/2 e cmap) para que títulos, cards e legendas nunca passem da tela.
import { readFileSync } from 'node:fs';

const cache = new Map();

function tabelas(buf) {
  let base = 0;
  if (buf.toString('latin1', 0, 4) === 'ttcf') base = buf.readUInt32BE(12);
  const n = buf.readUInt16BE(base + 4);
  const t = {};
  for (let i = 0; i < n; i++) {
    const o = base + 12 + i * 16;
    t[buf.toString('latin1', o, o + 4)] = { off: buf.readUInt32BE(o + 8), len: buf.readUInt32BE(o + 12) };
  }
  return t;
}

function lerCmap(buf, off) {
  const n = buf.readUInt16BE(off + 2);
  let escolhido = null;
  for (let i = 0; i < n; i++) {
    const plat = buf.readUInt16BE(off + 4 + i * 8);
    const enc = buf.readUInt16BE(off + 6 + i * 8);
    const sub = off + buf.readUInt32BE(off + 8 + i * 8);
    const fmt = buf.readUInt16BE(sub);
    if (plat === 3 && enc === 10 && fmt === 12) { escolhido = { sub, fmt }; break; }
    if ((plat === 3 && enc === 1) || plat === 0) { if (fmt === 4 || fmt === 12) escolhido = escolhido || { sub, fmt }; }
  }
  if (!escolhido) return () => 0;
  const { sub, fmt } = escolhido;
  if (fmt === 12) {
    const ng = buf.readUInt32BE(sub + 12);
    const grupos = [];
    for (let i = 0; i < ng; i++) {
      const o = sub + 16 + i * 12;
      grupos.push([buf.readUInt32BE(o), buf.readUInt32BE(o + 4), buf.readUInt32BE(o + 8)]);
    }
    return (cp) => { for (const [a, b, g] of grupos) if (cp >= a && cp <= b) return g + cp - a; return 0; };
  }
  const segX2 = buf.readUInt16BE(sub + 6);
  const seg = segX2 / 2;
  const ends = sub + 14;
  const starts = ends + segX2 + 2;
  const deltas = starts + segX2;
  const ranges = deltas + segX2;
  return (cp) => {
    if (cp > 0xffff) return 0;
    for (let i = 0; i < seg; i++) {
      const fim = buf.readUInt16BE(ends + i * 2);
      if (cp > fim) continue;
      const ini = buf.readUInt16BE(starts + i * 2);
      if (cp < ini) return 0;
      const delta = buf.readInt16BE(deltas + i * 2);
      const ro = buf.readUInt16BE(ranges + i * 2);
      if (!ro) return (cp + delta) & 0xffff;
      const gOff = ranges + i * 2 + ro + (cp - ini) * 2;
      const g = buf.readUInt16BE(gOff);
      return g ? (g + delta) & 0xffff : 0;
    }
    return 0;
  };
}

/** Carrega as métricas: { larguraEm(texto), escalaAss } — escalaAss = em / tamanho \fs do libass. */
export function metricas(arquivo) {
  if (cache.has(arquivo)) return cache.get(arquivo);
  const buf = readFileSync(arquivo);
  const t = tabelas(buf);
  const upem = buf.readUInt16BE(t.head.off + 18);
  const nHM = buf.readUInt16BE(t.hhea.off + 34);
  const asc = buf.readInt16BE(t.hhea.off + 4);
  const desc = buf.readInt16BE(t.hhea.off + 6);
  let altura = asc - desc;
  if (t['OS/2']) {
    const o = t['OS/2'].off;
    const winA = buf.readUInt16BE(o + 74);
    const winD = buf.readUInt16BE(o + 76);
    if (winA + winD > 0) altura = winA + winD;
  }
  const glifo = lerCmap(buf, t.cmap.off);
  const avanco = (g) => buf.readUInt16BE(t.hmtx.off + Math.min(g, nHM - 1) * 4);
  const cacheL = new Map();
  const m = {
    upem,
    // libass dimensiona a fonte pela altura (winAscent + winDescent): 1 \fs = altura/upem em
    escalaAss: upem / altura,
    /** largura em pixels de `texto` com \fs = tamanho (sem contorno). */
    largura(texto, tamanho) {
      let w = 0;
      for (const ch of String(texto)) {
        const cp = ch.codePointAt(0);
        let a = cacheL.get(cp);
        if (a === undefined) { a = avanco(glifo(cp)); cacheL.set(cp, a); }
        w += a;
      }
      return (w / upem) * tamanho * m.escalaAss;
    },
  };
  cache.set(arquivo, m);
  return m;
}
