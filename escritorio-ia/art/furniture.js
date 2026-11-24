// Biblioteca de móveis isométricos (arte própria). Cada função desenha numa Layer (contornada depois).
// Convenções: (i, j) em unidades de mundo (1 tile = 16), z em pixels. "facing +j" = olha para sudoeste.
import { Canvas } from './draw.js';

// ---------------------------------------------------------------- texturas utilitárias
export const solid = (c) => () => c;
/** Face com faixa de destaque no topo (borda clara) — dá volume aos tampos. */
export const rim = (main, edge, n = 1) => (u, v) => (v < n ? edge : main);

// ---------------------------------------------------------------- mesas e cadeiras
/** Mesa de escritório: tampo (z=h-3..h) + painel frontal/lateral. cols: {top, edge, side, sideDark, leg}. */
export function desk(L, iso, i, j, di, dj, h, cols) {
  const { top, edge = top, side, sideDark, panel = true } = cols;
  if (panel) {
    // painéis laterais recuados 2 unidades + painel de fundo (pernas "de caixa")
    iso.box(L, i + 2, j + 2, 0, di - 4, 3, h - 3, { left: sideDark, right: sideDark, top: side });
    iso.box(L, i + 2, j + dj - 5, 0, di - 4, 3, h - 3, { left: side, right: sideDark, top: side });
    iso.box(L, i + di - 5, j + 2, 0, 3, dj - 4, h - 7, { left: side, right: sideDark, top: side });
  } else {
    for (const [a, b] of [[i + 1, j + 1], [i + di - 3, j + 1], [i + 1, j + dj - 3], [i + di - 3, j + dj - 3]]) iso.box(L, a, b, 0, 2, 2, h - 3, { left: side, right: sideDark, top: side });
  }
  iso.box(L, i, j, h - 3, di, dj, 3, { top, left: edge, right: sideDark });
}

/** Cadeira de escritório olhando para +i (sudeste). (ci, cj) = centro do assento. */
export function officeChair(L, iso, ci, cj, { seat, seatDark, back, backDark, metal = 'gray', metalDark = 'shadow' }) {
  // pé estrela + coluna
  iso.box(L, ci - 6, cj - 1, 0, 12, 2, 2, { top: metal, left: metalDark, right: metalDark });
  iso.box(L, ci - 1, cj - 6, 0, 2, 12, 2, { top: metal, left: metalDark, right: metalDark });
  iso.box(L, ci - 1, cj - 1, 2, 2, 2, 5, { top: metal, left: metal, right: metalDark });
  // assento
  iso.box(L, ci - 6, cj - 6, 7, 12, 12, 3, { top: seat, left: seatDark, right: seatDark });
  // encosto (atrás, lado -i)
  iso.box(L, ci - 8, cj - 6, 9, 3, 12, 15, { top: back, left: backDark, right: back });
}

/** Banquinho/pufe redondo. */
export function stool(L, iso, ci, cj, r, h, { top, side, sideDark }) {
  iso.cylinder(L, ci, cj, r, 0, h, { side, sideDark, top });
}

// ---------------------------------------------------------------- estantes e armários
/** Estante encostada na parede do fundo direita (olha para +j). Livros coloridos nas prateleiras. */
export function bookshelfJ(L, iso, i, j, di, dj, h, { wood, woodDark, woodLight, books, shelves = 4, seed = 1 }) {
  iso.box(L, i, j, 0, di, dj, h, { top: woodLight, right: woodDark, left: wood });
  const sh = Math.floor((h - 6) / shelves);
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  // cada prateleira: livros de larguras variadas
  const rows = [];
  for (let k = 0; k < shelves; k++) {
    const list = [];
    let u = 2;
    while (u < di - 3) {
      const w = 2 + Math.floor(rnd() * 3), hh = sh - 3 - Math.floor(rnd() * 3);
      const col = books[Math.floor(rnd() * books.length)];
      if (rnd() < 0.1) { u += 2; continue; }
      list.push({ u, w: Math.min(w, di - 2 - u), hh, col });
      u += w;
    }
    rows.push(list);
  }
  iso.faceJ(L, j + dj, i, i + di, 0, h, (u, v) => {
    if (u < 2 || u >= di - 2 || v < 3) return null;
    const k = Math.floor((v - 3) / sh);
    if (k >= shelves) return null;
    const vv = (v - 3) % sh;
    if (vv >= sh - 2) return vv === sh - 2 ? woodLight : woodDark; // tábua da prateleira
    const b = rows[k].find((bk) => u >= bk.u && u < bk.u + bk.w);
    const fromBottom = sh - 2 - vv;
    if (b && fromBottom <= b.hh) return u === b.u ? 'outline' : b.col;
    return 'outline';
  });
}

/** Planta em vaso (folhas arredondadas). size 1..3. */
export function plant(L, iso, ci, cj, { pot = 'brown', potDark = 'brownDark', size = 2, leaf = 'green', leafDark = 'greenDark', leafLight = 'greenLight' } = {}) {
  const pr = 3 + size, ph = 6 + size * 2;
  iso.cylinder(L, ci, cj, pr, 0, ph, { side: pot, sideDark: potDark, top: 'woodDark' });
  const cx = iso.X0 + ci - cj, cy = iso.Y0 + (ci + cj) / 2 - ph;
  const blobs = size === 1
    ? [[0, -5, 4], [-3, -3, 3], [3, -3, 3]]
    : size === 2
      ? [[0, -9, 5], [-5, -5, 4], [5, -5, 4], [-2, -13, 3], [3, -12, 3]]
      : [[0, -14, 6], [-6, -9, 5], [6, -9, 5], [-3, -19, 4], [4, -19, 4], [0, -5, 5], [-8, -15, 3], [8, -15, 3]];
  for (const [dx, dy, r] of blobs) {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r * r + 1) continue;
      const shade = x + y > r * 0.6 ? leafDark : x + y < -r * 0.9 ? leafLight : leaf;
      L.px(Math.round(cx + dx + x), Math.round(cy + dy + y), shade);
    }
  }
  // nervuras escuras soltas
  for (const [dx, dy] of blobs) L.px(Math.round(cx + dx + 1), Math.round(cy + dy + 1), leafDark);
}

// ---------------------------------------------------------------- telas
/** Monitor apoiado (base em z), tela olhando para +j. Retorna a caixa de tela em coordenadas de face. */
export function monitorJ(L, iso, i, j, z, w, h, { frame = 'ink', frameDark = 'outline', screen = null } = {}) {
  // pé
  iso.box(L, i + w / 2 - 3, j - 1, z, 6, 4, 1, { top: 'shadow', left: frameDark, right: frameDark });
  iso.box(L, i + w / 2 - 1, j, z + 1, 2, 2, 4, { top: frame, left: frame, right: frameDark });
  // corpo
  iso.box(L, i, j, z + 4, w, 2, h, { top: frame, right: frameDark, left: frame });
  if (screen) iso.faceJ(L, j + 2, i + 1, i + w - 1, z + 5, z + 4 + h - 1, screen);
}

// ---------------------------------------------------------------- decalques planos (para paredes)
/** Canvas retangular com moldura. */
export function framed(w, h, { frame = 'outline', fill = 'white', inner = null } = {}) {
  const c = new Canvas(w, h);
  c.rect(0, 0, w, h, frame);
  c.rect(1, 1, w - 2, h - 2, inner || fill);
  if (inner) c.rect(2, 2, w - 4, h - 4, fill);
  return c;
}
