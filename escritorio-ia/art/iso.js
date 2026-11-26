// Motor isométrico 2:1 (tile 32x16) desenhando direto em pixels da paleta.
// Coordenadas de mundo em "unidades" (1 tile = 16 unidades em i e em j; z em pixels de tela):
//   tela.x = X0 + wi - wj        tela.y = Y0 + (wi + wj) / 2 - z
// i cresce para baixo-direita (sudeste), j cresce para baixo-esquerda (sudoeste).
// Faces visíveis: topo, face +j (sudoeste, "esquerda") e face +i (sudeste, "direita").
// Cada primitiva aceita cor fixa ou função (u, v) => cor, o que permite texturas e decalques.
import { Canvas, colorIndex } from './draw.js';

export const T = 16; // unidades de mundo por tile

const pick = (col, u, v, wi, wj) => (typeof col === 'function' ? col(u, v, wi, wj) : col);

export class Iso {
  constructor(X0, Y0) { this.X0 = X0; this.Y0 = Y0; }
  x(wi, wj) { return Math.round(this.X0 + wi - wj); }
  y(wi, wj, z = 0) { return Math.round(this.Y0 + (wi + wj) / 2 - z); }
  pt(wi, wj, z = 0) { return { x: this.x(wi, wj), y: this.y(wi, wj, z) }; }
  /** Posição de tela sem arredondar (para desenhos feitos direto em pixels). */
  fx(wi, wj) { return this.X0 + wi - wj; }
  fy(wi, wj, z = 0) { return this.Y0 + (wi + wj) / 2 - z; }

  /** Face de cima (plano z) cobrindo wi∈[i0,i1), wj∈[j0,j1). col(u=wi-i0, v=wj-j0). */
  top(c, i0, j0, i1, j1, z, col) {
    const xa = Math.floor(this.X0 + i0 - j1) - 1, xb = Math.ceil(this.X0 + i1 - j0) + 1;
    const ya = Math.floor(this.Y0 + (i0 + j0) / 2 - z) - 1, yb = Math.ceil(this.Y0 + (i1 + j1) / 2 - z) + 1;
    for (let py = ya; py <= yb; py++) for (let px = xa; px <= xb; px++) {
      const a = px + 0.5 - this.X0, b = 2 * (py + 0.5 + z - this.Y0);
      const wi = (a + b) / 2, wj = (b - a) / 2;
      if (wi < i0 || wi >= i1 || wj < j0 || wj >= j1) continue;
      const k = pick(col, Math.floor(wi - i0), Math.floor(wj - j0), wi, wj);
      if (k != null) c.px(px, py, k);
    }
    return this;
  }
  /** Face vertical no plano wj=J (olha para +j / sudoeste), wi∈[i0,i1), z∈[z0,z1). col(u=wi-i0, v=z1-z (0 no topo)). */
  faceJ(c, J, i0, i1, z0, z1, col) {
    const xa = Math.floor(this.X0 + i0 - J) - 1, xb = Math.ceil(this.X0 + i1 - J) + 1;
    const ya = Math.floor(this.Y0 + (i0 + J) / 2 - z1) - 1, yb = Math.ceil(this.Y0 + (i1 + J) / 2 - z0) + 1;
    for (let py = ya; py <= yb; py++) for (let px = xa; px <= xb; px++) {
      const wi = px + 0.5 - this.X0 + J;
      const z = this.Y0 + (wi + J) / 2 - (py + 0.5);
      if (wi < i0 || wi >= i1 || z < z0 || z >= z1) continue;
      const k = pick(col, Math.floor(wi - i0), Math.floor(z1 - z), wi, J);
      if (k != null) c.px(px, py, k);
    }
    return this;
  }
  /** Face vertical no plano wi=I (olha para +i / sudeste), wj∈[j0,j1), z∈[z0,z1). col(u=j1-wj (cresce para a direita na tela), v). */
  faceI(c, I, j0, j1, z0, z1, col) {
    const xa = Math.floor(this.X0 + I - j1) - 1, xb = Math.ceil(this.X0 + I - j0) + 1;
    const ya = Math.floor(this.Y0 + (I + j0) / 2 - z1) - 1, yb = Math.ceil(this.Y0 + (I + j1) / 2 - z0) + 1;
    for (let py = ya; py <= yb; py++) for (let px = xa; px <= xb; px++) {
      const wj = I - (px + 0.5 - this.X0);
      const z = this.Y0 + (I + wj) / 2 - (py + 0.5);
      if (wj < j0 || wj >= j1 || z < z0 || z >= z1) continue;
      const k = pick(col, Math.floor(j1 - wj), Math.floor(z1 - z), I, wj);
      if (k != null) c.px(px, py, k);
    }
    return this;
  }
  /**
   * Caixa sólida: base em (i0,j0,z0), tamanho (di,dj,dz). cols = { top, left (face +j), right (face +i) }.
   * Desenha as três faces visíveis (sem contorno; use Layer para contornar).
   */
  box(c, i0, j0, z0, di, dj, dz, cols) {
    if (cols.left) this.faceJ(c, j0 + dj, i0, i0 + di, z0, z0 + dz, cols.left);
    if (cols.right) this.faceI(c, i0 + di, j0, j0 + dj, z0, z0 + dz, cols.right);
    if (cols.top) this.top(c, i0, j0, i0 + di, j0 + dj, z0 + dz, cols.top);
    return this;
  }
  /** Elipse no chão (sombra, tapete redondo): centro (wi,wj), raios em unidades de mundo. */
  disc(c, ci, cj, ri, rj, z, col) {
    return this.top(c, ci - ri, cj - rj, ci + ri, cj + rj, z, (u, v, wi, wj) => {
      const a = (wi - ci) / ri, b = (wj - cj) / rj;
      return a * a + b * b <= 1 ? pick(col, u, v, wi, wj) : null;
    });
  }
  /** Cilindro vertical (vaso, base de luminária) centrado em (ci,cj) com raio r (unidades de mundo). */
  cylinder(c, ci, cj, r, z0, z1, { side, sideDark, top }) {
    const cx = this.X0 + ci - cj, cy0 = this.Y0 + (ci + cj) / 2;
    const rx = r * Math.SQRT2, ry = rx / 2;
    for (let py = Math.floor(cy0 - z1 - ry) - 1; py <= Math.ceil(cy0 - z0 + ry) + 1; py++) for (let px = Math.floor(cx - rx) - 1; px <= Math.ceil(cx + rx) + 1; px++) {
      const dx = (px + 0.5 - cx) / rx;
      if (Math.abs(dx) > 1) continue;
      const h = Math.sqrt(1 - dx * dx) * ry;
      const yTop = cy0 - z1, yBot = cy0 - z0;
      const y = py + 0.5;
      if (y >= yTop - h && y <= yTop + h) c.px(px, py, top);
      else if (y > yTop && y <= yBot + h) c.px(px, py, dx > 0.35 ? sideDark : side);
    }
    return this;
  }
}

/**
 * Iso "transposto": troca i ↔ j (espelha a geometria na horizontal) mantendo as texturas legíveis
 * (u continua crescendo para a direita na tela). Uma sala desenhada com a parede decorada em j=0 vira
 * uma sala com a parede decorada em i=0 — usado na ala esquerda do formato L.
 */
export class TransIso {
  constructor(base) { this.base = base; }
  x(wi, wj) { return this.base.x(wj, wi); }
  y(wi, wj, z = 0) { return this.base.y(wj, wi, z); }
  pt(wi, wj, z = 0) { return this.base.pt(wj, wi, z); }
  fx(wi, wj) { return this.base.fx(wj, wi); }
  fy(wi, wj, z = 0) { return this.base.fy(wj, wi, z); }
  top(c, i0, j0, i1, j1, z, col) {
    this.base.top(c, j0, i0, j1, i1, z, typeof col === 'function' ? (u, v, wi, wj) => col(v, u, wj, wi) : col);
    return this;
  }
  faceJ(c, J, i0, i1, z0, z1, col) { this.base.faceI(c, J, i0, i1, z0, z1, col); return this; }
  faceI(c, I, j0, j1, z0, z1, col) { this.base.faceJ(c, I, j0, j1, z0, z1, col); return this; }
  box(c, i0, j0, z0, di, dj, dz, cols) {
    if (cols.left) this.faceJ(c, j0 + dj, i0, i0 + di, z0, z0 + dz, cols.left);
    if (cols.right) this.faceI(c, i0 + di, j0, j0 + dj, z0, z0 + dz, cols.right);
    if (cols.top) this.top(c, i0, j0, i0 + di, j0 + dj, z0 + dz, cols.top);
    return this;
  }
  disc(c, ci, cj, ri, rj, z, col) {
    return this.top(c, ci - ri, cj - rj, ci + ri, cj + rj, z, (u, v, wi, wj) => {
      const a = (wi - ci) / ri, b = (wj - cj) / rj;
      return a * a + b * b <= 1 ? pick(col, u, v, wi, wj) : null;
    });
  }
  cylinder(c, ci, cj, r, z0, z1, cols) { this.base.cylinder(c, cj, ci, r, z0, z1, cols); return this; }
}

/** Iso que só registra a extensão (em unidades de mundo) do que seria desenhado — para ancorar móveis. */
export class RecIso {
  constructor() { this.X0 = 0; this.Y0 = 0; this.i0 = Infinity; this.i1 = -Infinity; this.j0 = Infinity; this.j1 = -Infinity; }
  _r(a0, a1, b0, b1) { if (a0 < this.i0) this.i0 = a0; if (a1 > this.i1) this.i1 = a1; if (b0 < this.j0) this.j0 = b0; if (b1 > this.j1) this.j1 = b1; }
  x(wi, wj) { return Math.round(wi - wj); }
  y(wi, wj, z = 0) { return Math.round((wi + wj) / 2 - z); }
  pt(wi, wj, z = 0) { this._r(wi, wi, wj, wj); return { x: this.x(wi, wj), y: this.y(wi, wj, z) }; }
  fx(wi, wj) { this._r(wi, wi, wj, wj); return wi - wj; }
  fy(wi, wj, z = 0) { return (wi + wj) / 2 - z; }
  top(c, i0, j0, i1, j1) { this._r(i0, i1, j0, j1); return this; }
  faceJ(c, J, i0, i1) { this._r(i0, i1, J, J); return this; }
  faceI(c, I, j0, j1) { this._r(I, I, j0, j1); return this; }
  box(c, i0, j0, z0, di, dj) { this._r(i0, i0 + di, j0, j0 + dj); return this; }
  disc(c, ci, cj, ri, rj) { this._r(ci - ri, ci + ri, cj - rj, cj + rj); return this; }
  cylinder(c, ci, cj, r) { this._r(ci - r, ci + r, cj - r, cj + r); return this; }
}
/** Camada que não guarda nada (par do RecIso). */
export const NULL_LAYER = { px() { return this; }, rect() { return this; }, stamp() {}, get() { return -1; }, w: 0, h: 0, _out: null };

/**
 * Camada temporária do tamanho do alvo: desenha-se nela, depois `stamp()` aplica contorno
 * externo (1 px, 4-vizinhança) e copia para o alvo. Mantém o bbox para ser rápido.
 */
export class Layer extends Canvas {
  constructor(w, h) { super(w, h); this.bx0 = w; this.by0 = h; this.bx1 = -1; this.by1 = -1; }
  px(x, y, c) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    this.px_[y * this.w + x] = colorIndex(c);
    if (x < this.bx0) this.bx0 = x; if (x > this.bx1) this.bx1 = x;
    if (y < this.by0) this.by0 = y; if (y > this.by1) this.by1 = y;
    return this;
  }
  rect(x, y, w, h, c) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.px(xx, yy, c); return this; }
  /** Contorno externo + cópia para `target`. opts.outline=false só copia. opts.skipBottom: não contorna por baixo. */
  stamp(target, { outline = 'outline', mask = null } = {}) {
    if (this.bx1 < 0) return;
    const oi = outline ? colorIndex(outline) : -1;
    const W = this.w;
    if (outline) {
      for (let y = Math.max(0, this.by0 - 1); y <= Math.min(this.h - 1, this.by1 + 1); y++) for (let x = Math.max(0, this.bx0 - 1); x <= Math.min(W - 1, this.bx1 + 1); x++) {
        if (this.px_[y * W + x] >= 0) continue;
        const n = (x > 0 && this.px_[y * W + x - 1] >= 0) || (x < W - 1 && this.px_[y * W + x + 1] >= 0) || (y > 0 && this.px_[(y - 1) * W + x] >= 0) || (y < this.h - 1 && this.px_[(y + 1) * W + x] >= 0);
        if (n) target.px_[y * W + x] = oi;
      }
    }
    for (let y = this.by0; y <= this.by1; y++) for (let x = this.bx0; x <= this.bx1; x++) {
      const k = this.px_[y * W + x];
      if (k >= 0) target.px_[y * W + x] = k;
      if (mask && k >= 0) mask.px_[y * W + x] = -1;
    }
    this.px_.fill(-1);
    this.bx0 = this.w; this.by0 = this.h; this.bx1 = -1; this.by1 = -1;
  }
}

/** Desenha um "sprite" plano (Canvas) cisalhado numa parede: face +j (parede do fundo à direita) ou +i (à esquerda). */
export function wallDecal(iso, c, src, { face, wall, at, z }) {
  // face 'J': parede no plano wj=wall; `at` = wi da borda esquerda do decalque; z = altura do topo do decalque.
  // face 'I': parede no plano wi=wall; `at` = wj da borda esquerda na tela (o maior wj); z = altura do topo.
  if (iso instanceof RecIso) { if (face === 'J') iso.faceJ(c, wall, at, at + src.w); else iso.faceI(c, wall, at - src.w, at); return; }
  if (face === 'J') {
    iso.faceJ(c, wall, at, at + src.w, z - src.h, z, (u, v) => { const k = src.get(u, v); return k >= 0 ? k : null; });
  } else {
    iso.faceI(c, wall, at - src.w, at, z - src.h, z, (u, v) => { const k = src.get(u, v); return k >= 0 ? k : null; });
  }
}
