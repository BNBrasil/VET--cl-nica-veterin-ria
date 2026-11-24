// Kit de desenho: canvas de pixels em memória, sempre preso à paleta fechada.
import { PALETTE, COLORS, hexToRgba } from './palette.js';
import { encodePNG } from './png.js';

const INDEX = new Map(COLORS.map((hex, i) => [hex, i]));
const RGBA = COLORS.map(hexToRgba);

/** Converte nome da paleta ('skin') ou hex ('#f0c8a0') em índice; null/'.' = transparente. Lança se a cor não for da paleta. */
export function colorIndex(c) {
  if (c === null || c === undefined || c === '.' || c === -1) return -1;
  if (typeof c === 'number') { if (c >= 0 && c < COLORS.length) return c; throw new Error(`índice de cor inválido: ${c}`); }
  const hex = PALETTE[c] ?? String(c).toLowerCase();
  const i = INDEX.get(hex);
  if (i === undefined) throw new Error(`cor fora da paleta: ${c}`);
  return i;
}

export class Canvas {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.px_ = new Int16Array(w * h).fill(-1);
  }
  clone() { const c = new Canvas(this.w, this.h); c.px_.set(this.px_); return c; }
  get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? -1 : this.px_[y * this.w + x]; }
  getName(x, y) { const i = this.get(x, y); return i < 0 ? null : Object.keys(PALETTE)[i]; }
  px(x, y, c) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    this.px_[y * this.w + x] = colorIndex(c);
    return this;
  }
  rect(x, y, w, h, c) { const i = colorIndex(c); for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (xx >= 0 && yy >= 0 && xx < this.w && yy < this.h) this.px_[yy * this.w + xx] = i; return this; }
  frame(x, y, w, h, c) { this.hline(x, x + w - 1, y, c); this.hline(x, x + w - 1, y + h - 1, c); this.vline(x, y, y + h - 1, c); this.vline(x + w - 1, y, y + h - 1, c); return this; }
  hline(x0, x1, y, c) { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.px(x, y, c); return this; }
  vline(x, y0, y1, c) { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.px(x, y, c); return this; }
  line(x0, y0, x1, y1, c) {
    let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, err = dx + dy;
    for (;;) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }
  /** Xadrez de duas cores (dither). */
  dither(x, y, w, h, c1, c2) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.px(xx, yy, (xx + yy) & 1 ? c2 : c1); return this; }
  /** Elipse preenchida (bounding box). */
  ellipse(x, y, w, h, c) {
    const rx = w / 2, ry = h / 2, cx = x + rx - 0.5, cy = y + ry - 0.5;
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const nx = (xx - cx) / rx, ny = (yy - cy) / ry;
      if (nx * nx + ny * ny <= 1.0) this.px(xx, yy, c);
    }
    return this;
  }
  /** Copia outro canvas (transparente não sobrescreve). */
  blit(src, dx, dy, { flipX = false, sx = 0, sy = 0, sw = src.w, sh = src.h } = {}) {
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      const i = src.get(sx + (flipX ? sw - 1 - x : x), sy + y);
      if (i >= 0) { const tx = dx + x, ty = dy + y; if (tx >= 0 && ty >= 0 && tx < this.w && ty < this.h) this.px_[ty * this.w + tx] = i; }
    }
    return this;
  }
  flipX() { const c = new Canvas(this.w, this.h); c.blit(this, 0, 0, { flipX: true }); return c; }
  /** Troca cores: map { nomeAntigo: nomeNovo }. */
  recolor(map) {
    const m = new Map(Object.entries(map).map(([a, b]) => [colorIndex(a), colorIndex(b)]));
    for (let i = 0; i < this.px_.length; i++) if (m.has(this.px_[i])) this.px_[i] = m.get(this.px_[i]);
    return this;
  }
  /**
   * Desenha um template ASCII. rows: array de strings; map: { letra: cor }.
   * '.' e ' ' são transparentes. Letras sem mapa lançam erro (pega erro de digitação).
   */
  tpl(rows, map, dx = 0, dy = 0, { flipX = false } = {}) {
    const w = Math.max(...rows.map((r) => r.length));
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        if (!(ch in map)) throw new Error(`template: letra '${ch}' sem cor (linha ${y}: "${row}")`);
        if (map[ch] === null) continue;
        this.px(dx + (flipX ? w - 1 - x : x), dy + y, map[ch]);
      }
    });
    return this;
  }
  /** Texto com fonte 3x5 própria. */
  text(str, x, y, c, { spacing = 1 } = {}) {
    let cx = x;
    for (const ch of String(str).toUpperCase()) {
      const g = FONT[ch];
      if (!g) { cx += 3 + spacing; continue; }
      g.forEach((row, yy) => { for (let xx = 0; xx < row.length; xx++) if (row[xx] === '#') this.px(cx + xx, y + yy, c); });
      cx += g[0].length + spacing;
    }
    return this;
  }
  /** Lista de índices de paleta usados. */
  usedColors() { return [...new Set(this.px_)].filter((i) => i >= 0); }
  toRGBA(scale = 1) {
    const W = this.w * scale, H = this.h * scale, out = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = this.px_[((y / scale) | 0) * this.w + ((x / scale) | 0)];
      if (i >= 0) out.set(RGBA[i], (y * W + x) * 4);
    }
    return out;
  }
  toPNG(scale = 1) { return encodePNG(this.w * scale, this.h * scale, this.toRGBA(scale)); }
}

export function textWidth(str, spacing = 1) {
  let w = 0;
  for (const ch of String(str).toUpperCase()) w += (FONT[ch] ? FONT[ch][0].length : 3) + spacing;
  return w - spacing;
}

// Fonte 3x5 própria (maiúsculas, dígitos e alguns sinais).
const F = (s) => s.split('|');
export const FONT = {
  A: F('.#.|#.#|###|#.#|#.#'), B: F('##.|#.#|##.|#.#|##.'), C: F('.##|#..|#..|#..|.##'), D: F('##.|#.#|#.#|#.#|##.'),
  E: F('###|#..|##.|#..|###'), F: F('###|#..|##.|#..|#..'), G: F('.##|#..|#.#|#.#|.##'), H: F('#.#|#.#|###|#.#|#.#'),
  I: F('###|.#.|.#.|.#.|###'), J: F('..#|..#|..#|#.#|.#.'), K: F('#.#|#.#|##.|#.#|#.#'), L: F('#..|#..|#..|#..|###'),
  M: F('#...#|##.##|#.#.#|#...#|#...#'), N: F('#..#|##.#|#.##|#..#|#..#'), O: F('.#.|#.#|#.#|#.#|.#.'),
  P: F('##.|#.#|##.|#..|#..'), Q: F('.#.|#.#|#.#|##.|.##'), R: F('##.|#.#|##.|#.#|#.#'), S: F('.##|#..|.#.|..#|##.'),
  T: F('###|.#.|.#.|.#.|.#.'), U: F('#.#|#.#|#.#|#.#|###'), V: F('#.#|#.#|#.#|#.#|.#.'), W: F('#...#|#...#|#.#.#|##.##|#...#'),
  X: F('#.#|#.#|.#.|#.#|#.#'), Y: F('#.#|#.#|.#.|.#.|.#.'), Z: F('###|..#|.#.|#..|###'),
  0: F('###|#.#|#.#|#.#|###'), 1: F('.#.|##.|.#.|.#.|###'), 2: F('##.|..#|.#.|#..|###'), 3: F('##.|..#|.#.|..#|##.'),
  4: F('#.#|#.#|###|..#|..#'), 5: F('###|#..|##.|..#|##.'), 6: F('.##|#..|###|#.#|###'), 7: F('###|..#|.#.|.#.|.#.'),
  8: F('###|#.#|###|#.#|###'), 9: F('###|#.#|###|..#|##.'), '?': F('##.|..#|.#.|...|.#.'), '!': F('#|#|#|.|#'),
  '.': F('.|.|.|.|#'), ':': F('.|#|.|#|.'), '-': F('...|...|###|...|...'), '/': F('..#|..#|.#.|#..|#..'),
  '<': F('..#|.#.|#..|.#.|..#'), '>': F('#..|.#.|..#|.#.|#..'), '{': F('.##|.#.|#..|.#.|.##'), '}': F('##.|.#.|..#|.#.|##.'),
  '=': F('...|###|...|###|...'), '+': F('...|.#.|###|.#.|...'), ' ': F('..|..|..|..|..'),
};
