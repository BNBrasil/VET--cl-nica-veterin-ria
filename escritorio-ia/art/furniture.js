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
  const cx = iso.fx(ci, cj), cy = iso.fy(ci, cj, ph);
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

// ---------------------------------------------------------------- mais móveis
/** Sofá olhando para +i (sudeste): comprido em j. (i,j) = canto de trás. Retorna nada; braço da frente separado (fg). */
export function sofaI(L, iso, i, j, len, { c, cD, cL }, part = 'all') {
  const depth = 20;
  if (part === 'all' || part === 'body') {
    iso.box(L, i, j, 0, depth, len, 4, { top: cD, left: 'woodDark', right: 'woodDark' }); // base
    iso.box(L, i, j, 4, 7, len, 20, { top: cL, left: cD, right: c }); // encosto
    iso.box(L, i + 7, j + 6, 4, depth - 7, len - 12, 6, { top: (u, v) => ((v % 16) === 0 ? cD : cL), left: cD, right: c }); // assento
    iso.box(L, i, j, 4, depth, 6, 12, { top: cL, left: cD, right: c }); // braço de trás
  }
  if (part === 'all' || part === 'arm') iso.box(L, i, j + len - 6, 4, depth, 6, 12, { top: cL, left: cD, right: c }); // braço da frente
}

/** Poltrona olhando para -j (de costas para quem vê, virada para a parede/TV). */
export function armchairBack(L, iso, i, j, { c, cD, cL }) {
  iso.box(L, i, j, 0, 18, 18, 4, { top: cD, left: 'woodDark', right: 'woodDark' });
  iso.box(L, i + 3, j + 2, 4, 12, 12, 5, { top: cL, left: cD, right: c });
  iso.box(L, i, j, 4, 3, 18, 12, { top: cL, left: cD, right: c });
  iso.box(L, i + 15, j, 4, 3, 18, 12, { top: cL, left: cD, right: c });
  iso.box(L, i, j + 14, 4, 18, 4, 18, { top: cL, left: c, right: cD });
}

/** Poltrona olhando para +i. */
export function armchairI(L, iso, i, j, { c, cD, cL }) {
  iso.box(L, i, j, 0, 18, 20, 4, { top: cD, left: 'woodDark', right: 'woodDark' });
  iso.box(L, i, j, 4, 6, 20, 18, { top: cL, left: cD, right: c });
  iso.box(L, i + 6, j + 4, 4, 12, 12, 5, { top: cL, left: cD, right: c });
  iso.box(L, i, j, 4, 18, 4, 11, { top: cL, left: cD, right: c });
  iso.box(L, i, j + 16, 4, 18, 4, 11, { top: cL, left: cD, right: c });
}

/** Rack de servidores encostado na parede esquerda (face +i com gavetas e LEDs). leds(u,v) opcional. */
export function rackI(L, iso, i, j, dj, h, leds = null) {
  iso.box(L, i, j, 0, 18, dj, h, {
    top: 'shadow', left: 'ink',
    right: (u, v) => {
      if (u < 2 || u >= dj - 2 || v < 2 || v >= h - 3) return 'ink';
      const row = Math.floor((v - 2) / 5), vv = (v - 2) % 5;
      if (vv === 4) return 'outline';
      if (leds) { const k = leds(u, row, vv); if (k) return k; }
      if (vv === 1 && u >= 3 && u <= 4) return (row + u) % 3 === 0 ? 'greenLight' : (row % 4 === 1 ? 'orange' : 'green');
      if (vv === 2 && u > 6 && u < dj - 3) return u % 2 ? 'slate' : 'navy';
      return 'slate';
    },
  });
}

/** Caixa genérica com tampo claro (armário, balcão). */
export function cabinetJ(L, iso, i, j, di, dj, h, { body, bodyDark, top, doors = 2, handle = 'silver' }) {
  iso.box(L, i, j, 0, di, dj, h, {
    top, right: bodyDark,
    left: (u, v) => {
      if (v < 2) return top;
      if (v >= h - 2) return 'woodDark';
      const dw = di / doors;
      const k = Math.floor(u / dw), uu = u - k * dw;
      if (uu < 1) return bodyDark;
      if (v === 4 && Math.abs(uu - dw / 2) < 2) return handle;
      return body;
    },
  });
}

export function fridge(L, iso, i, j) {
  iso.box(L, i, j, 0, 18, 16, 44, {
    top: 'light', right: 'silver',
    left: (u, v) => {
      if (v === 16) return 'silver';
      if (u === 2 && ((v > 4 && v < 13) || (v > 19 && v < 30))) return 'gray';
      if (v === 8 && u > 8 && u < 12) return 'pink';
      if (v === 9 && u > 9 && u < 13) return 'lamp';
      if (v === 22 && u > 10 && u < 13) return 'cyan';
      return 'snow';
    },
  });
}

export function beanbag(L, iso, ci, cj, { c, cD, cL }) {
  const cx = iso.fx(ci, cj), cy = iso.fy(ci, cj);
  for (let y = -10; y <= 2; y++) for (let x = -10; x <= 10; x++) {
    const nx = x / 10.5, ny = (y + 3) / (y < -3 ? 8 : 5.5);
    if (nx * nx + ny * ny > 1) continue;
    const col = y < -6 && x < 2 ? cL : x + y > 6 ? cD : c;
    L.px(Math.round(cx + x), Math.round(cy + y), col);
  }
  L.px(Math.round(cx - 2), Math.round(cy - 4), cD); L.px(Math.round(cx - 1), Math.round(cy - 3), cD); L.px(Math.round(cx), Math.round(cy - 3), cD);
}

export function floorLamp(L, iso, ci, cj, { shade = 'lamp', shadeDark = 'yellow', on = true } = {}) {
  iso.cylinder(L, ci, cj, 4, 0, 2, { side: 'shadow', sideDark: 'ink', top: 'gray' });
  iso.box(L, ci - 1, cj - 1, 2, 2, 2, 30, { top: 'gray', left: 'silver', right: 'gray' });
  iso.cylinder(L, ci, cj, 7, 30, 40, { side: on ? shade : shadeDark, sideDark: shadeDark, top: on ? 'snow' : shadeDark });
}

export function trashBin(L, iso, ci, cj) {
  iso.cylinder(L, ci, cj, 5, 0, 10, { side: 'silver', sideDark: 'gray', top: 'shadow' });
  const p = iso.pt(ci, cj, 11);
  L.px(p.x - 1, p.y, 'snow'); L.px(p.x, p.y - 1, 'snow'); L.px(p.x + 1, p.y, 'light'); L.px(p.x + 2, p.y + 1, 'snow');
}

export function speaker(L, iso, i, j, h = 26) {
  iso.box(L, i, j, 0, 10, 10, h, {
    top: 'shadow', right: 'ink',
    left: (u, v) => { const a = Math.hypot(u - 5, v - h * 0.65), b = Math.hypot(u - 5, v - h * 0.25); if (a < 3.5) return a < 1.5 ? 'gray' : 'outline'; if (b < 2) return 'outline'; return 'ink'; },
  });
}

/** Mesa simples com pés (mesa de centro/copa). */
export function table(L, iso, i, j, di, dj, h, { top, edge, leg = 'woodDark' }) {
  for (const [a, b] of [[i + 1, j + 1], [i + di - 3, j + 1], [i + 1, j + dj - 3], [i + di - 3, j + dj - 3]]) iso.box(L, a, b, 0, 2, 2, h - 2, { left: leg, right: leg, top: leg });
  iso.box(L, i, j, h - 2, di, dj, 2, { top, left: edge, right: edge });
}

/** Prancheta inclinada (mesa de desenho). */
export function draftingTable(L, iso, i, j) {
  for (const [a, b] of [[i + 2, j + 2], [i + 14, j + 2], [i + 2, j + 18], [i + 14, j + 18]]) iso.box(L, a, b, 0, 2, 2, 18, { left: 'woodDark', right: 'woodDark', top: 'wood' });
  // tampo inclinado: série de faixas subindo para trás (-i)
  for (let k = 0; k < 8; k++) iso.box(L, i + 16 - k * 2, j, 18 + k * 1.5, 2, 22, 2, { top: k === 7 ? 'woodLight' : 'snow', left: 'woodLight', right: 'woodLight' });
  iso.top(L, i + 6, j + 4, i + 12, j + 14, 25, (u, v) => ((u + v) % 4 ? 'pinkLight' : 'pink'));
}

/** Lupa gigante num pedestal (para a sala de revisão). */
export function giantMagnifier(L, iso, ci, cj) {
  iso.cylinder(L, ci, cj, 6, 0, 3, { side: 'gray', sideDark: 'shadow', top: 'silver' });
  iso.box(L, ci - 1, cj - 1, 3, 2, 2, 22, { top: 'woodDark', left: 'wood', right: 'woodDark' });
  const c = iso.pt(ci, cj, 36);
  for (let y = -11; y <= 11; y++) for (let x = -11; x <= 11; x++) {
    const d = Math.hypot(x, y);
    if (d > 11) continue;
    L.px(c.x + x, c.y + y, d > 8.6 ? (x + y < 0 ? 'light' : 'silver') : d > 7.8 ? 'gray' : (x + y < -6 && x + y > -10) ? 'snow' : (x - y > 6 && x - y < 8) ? 'snow' : 'cyanLight');
  }
}

export function filingCabinet(L, iso, i, j) {
  iso.box(L, i, j, 0, 16, 14, 30, {
    top: 'light', right: 'gray',
    left: (u, v) => (v % 10 === 0 ? 'gray' : v % 10 === 3 && u > 5 && u < 10 ? 'shadow' : 'silver'),
  });
}

export function mug(L, iso, ci, cj, z, col = 'snow') {
  iso.cylinder(L, ci, cj, 2, z, z + 4, { side: col, sideDark: 'light', top: 'woodDark' });
  const p = iso.pt(ci + 2, cj + 2, z + 3); L.px(p.x - 1, p.y, col);
}

export function typewriter(L, iso, i, j, z) {
  iso.box(L, i, j, z, 10, 14, 4, { top: 'redDark', left: 'red', right: 'redDark' });
  iso.top(L, i + 1, j + 2, i + 5, j + 12, z + 4, (u, v) => (u % 2 && v % 2 ? 'snow' : 'ink'));
  iso.box(L, i + 6, j + 1, z + 4, 3, 12, 3, { top: 'ink', left: 'shadow', right: 'ink' });
  iso.faceJ(L, j + 10, i + 7, i + 8, z + 7, z + 15, 'snow');
  iso.box(L, i + 7, j + 3, z + 7, 1, 8, 8, { left: 'snow', right: 'light', top: 'snow' });
}

export function deskPhone(L, iso, i, j, z) {
  iso.box(L, i, j, z, 7, 8, 3, { top: 'ink', left: 'shadow', right: 'ink' });
  iso.box(L, i + 1, j, z + 3, 2, 8, 2, { top: 'shadow', left: 'ink', right: 'ink' });
  const p = iso.pt(i + 5, j + 4, z + 3); L.px(p.x, p.y, 'red');
}

export function papers(L, iso, i, j, z, n = 3) {
  for (let k = 0; k < n; k++) iso.box(L, i + (k % 2), j + (k % 2), z + k, 8, 10, 1, { top: 'snow', left: 'light', right: 'light' });
}

export function pencilCup(L, iso, ci, cj, z) {
  iso.cylinder(L, ci, cj, 2, z, z + 5, { side: 'blue', sideDark: 'blueDark', top: 'ink' });
  const p = iso.pt(ci, cj, z + 5);
  L.px(p.x - 1, p.y - 2, 'yellow'); L.px(p.x - 1, p.y - 1, 'yellow'); L.px(p.x + 1, p.y - 3, 'pink'); L.px(p.x + 1, p.y - 2, 'pink'); L.px(p.x, p.y - 2, 'green');
}
