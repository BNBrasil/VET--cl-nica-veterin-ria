// Fonte bitmap 3x5 (largura variável) para textos pixelados no canvas.
// Desenha em pixels nativos do mundo; acentos ocupam até 2 linhas acima da letra.

const G = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '##.', '.##'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'],
  z: ['...', '###', '.#.', '#..', '###'],
  0: ['###', '#.#', '#.#', '#.#', '###'],
  1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['##.', '..#', '.#.', '#..', '###'],
  3: ['##.', '..#', '.#.', '..#', '##.'],
  4: ['#.#', '#.#', '###', '..#', '..#'],
  5: ['###', '#..', '##.', '..#', '##.'],
  6: ['.##', '#..', '###', '#.#', '###'],
  7: ['###', '..#', '.#.', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '##.'],
  '?': ['##.', '..#', '.#.', '...', '.#.'],
  '!': ['#', '#', '#', '.', '#'],
  '.': ['.', '.', '.', '.', '#'],
  ',': ['.', '.', '.', '#', '#'],
  ':': ['.', '#', '.', '#', '.'],
  '-': ['...', '...', '###', '...', '...'],
  '/': ['..#', '..#', '.#.', '#..', '#..'],
  '+': ['...', '.#.', '###', '.#.', '...'],
  '#': ['#.#', '###', '#.#', '###', '#.#'],
  'x': ['...', '#.#', '.#.', '#.#', '...'],
  '✓': ['....', '...#', '..#.', '#.#.', '.#..'],
  ' ': ['..', '..', '..', '..', '..'],
};

// Diacríticos: [letra base, tipo]
const ACC = {
  'Á': ['A', 'acute'], 'À': ['A', 'grave'], 'Â': ['A', 'circ'], 'Ã': ['A', 'tilde'],
  'É': ['E', 'acute'], 'Ê': ['E', 'circ'], 'Í': ['I', 'acute'],
  'Ó': ['O', 'acute'], 'Ô': ['O', 'circ'], 'Õ': ['O', 'tilde'], 'Ú': ['U', 'acute'],
  'Ç': ['C', 'cedil'],
};

const MARKS = {
  acute: [[2, -2], [1, -1]],
  grave: [[0, -2], [1, -1]],
  circ: [[1, -2], [0, -1], [2, -1]],
  tilde: [[1, -2], [2, -2], [0, -1], [1, -1]],
  cedil: [[1, 5], [0, 6]],
};

function norm(ch) {
  if (G[ch] || ACC[ch]) return ch;
  const up = ch.toUpperCase();
  if (G[up] || ACC[up]) return up;
  return ' ';
}

function glyphOf(ch) {
  const c = norm(ch);
  if (ACC[c]) return { rows: G[ACC[c][0]], mark: MARKS[ACC[c][1]] };
  return { rows: G[c], mark: null };
}

export function textWidth(str) {
  let w = 0;
  for (const ch of str) w += glyphOf(ch).rows[0].length + 1;
  return Math.max(0, w - 1);
}

/** Desenha `str` com o topo da linha base em (x, y). Altura útil: 5px (+2 acima p/ acento). */
export function drawText(ctx, str, x, y, color) {
  ctx.fillStyle = color;
  let cx = Math.round(x);
  const cy = Math.round(y);
  for (const ch of str) {
    const { rows, mark } = glyphOf(ch);
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < row.length; c++) if (row[c] === '#') ctx.fillRect(cx + c, cy + r, 1, 1);
    }
    if (mark) for (const [mx, my] of mark) ctx.fillRect(cx + mx, cy + my, 1, 1);
    cx += rows[0].length + 1;
  }
  return cx - 1;
}

/** Texto com contorno de 1px (para legibilidade sobre o cenário). */
export function drawTextOutlined(ctx, str, x, y, color, outline = '#000') {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) drawText(ctx, str, x + dx, y + dy, outline);
  drawText(ctx, str, x, y, color);
}

// ---------- Modo "caixa mista" (minúsculas de verdade), usado nos balões e placas do mapa isométrico ----------
// Grade: maiúsculas ocupam as linhas 0–4; minúsculas têm altura-x nas linhas 1–4, descendentes em 5–6.
// Acentos ficam em -2..-1 (maiúsculas) ou -1..0 (minúsculas). Altura de linha recomendada: 9 px (+2 acima).

const L = {
  a: ['...', '.##', '#.#', '#.#', '.##'],
  b: ['#..', '##.', '#.#', '#.#', '##.'],
  c: ['...', '.##', '#..', '#..', '.##'],
  d: ['..#', '.##', '#.#', '#.#', '.##'],
  e: ['...', '.#.', '###', '#..', '.##'],
  f: ['.##', '#..', '##.', '#..', '#..'],
  g: ['...', '.##', '#.#', '#.#', '.##', '..#', '##.'],
  h: ['#..', '##.', '#.#', '#.#', '#.#'],
  i: ['#', '.', '#', '#', '#'],
  j: ['.#', '..', '.#', '.#', '.#', '.#', '#.'],
  k: ['#..', '#.#', '##.', '#.#', '#.#'],
  l: ['#.', '#.', '#.', '#.', '.#'],
  m: ['.....', '####.', '#.#.#', '#.#.#', '#.#.#'],
  n: ['...', '##.', '#.#', '#.#', '#.#'],
  o: ['...', '.#.', '#.#', '#.#', '.#.'],
  p: ['...', '##.', '#.#', '#.#', '##.', '#..', '#..'],
  q: ['...', '.##', '#.#', '#.#', '.##', '..#', '..#'],
  r: ['...', '#.#', '##.', '#..', '#..'],
  s: ['...', '.##', '#..', '..#', '##.'],
  t: ['.#.', '###', '.#.', '.#.', '..#'],
  u: ['...', '#.#', '#.#', '#.#', '.##'],
  v: ['...', '#.#', '#.#', '#.#', '.#.'],
  w: ['.....', '#...#', '#.#.#', '#.#.#', '.#.#.'],
  x: ['...', '#.#', '.#.', '.#.', '#.#'],
  y: ['...', '#.#', '#.#', '#.#', '.##', '..#', '##.'],
  z: ['...', '###', '.#.', '#..', '###'],
  'í': ['.#', '#.', '.#', '.#', '.#'],
  '(': ['.#', '#.', '#.', '#.', '.#'],
  ')': ['#.', '.#', '.#', '.#', '#.'],
  "'": ['#', '#', '.', '.', '.'],
  '"': ['#.#', '#.#', '...', '...', '...'],
  ';': ['.', '#', '.', '#', '#'],
  '=': ['...', '###', '...', '###', '...'],
  '_': ['...', '...', '...', '...', '###'],
  '*': ['...', '#.#', '.#.', '#.#', '...'],
  '%': ['#.#', '..#', '.#.', '#..', '#.#'],
  '<': ['..#', '.#.', '#..', '.#.', '..#'],
  '>': ['#..', '.#.', '..#', '.#.', '#..'],
  '…': ['.....', '.....', '.....', '.....', '#.#.#'],
  '@': ['.##.', '#..#', '#.##', '#...', '.###'],
  '&': ['.#.', '#.#', '.#.', '#.#', '.##'],
};
const L_ACC = {
  'á': ['a', 'acute'], 'à': ['a', 'grave'], 'â': ['a', 'circ'], 'ã': ['a', 'tilde'],
  'é': ['e', 'acute'], 'ê': ['e', 'circ'], 'ó': ['o', 'acute'], 'ô': ['o', 'circ'], 'õ': ['o', 'tilde'],
  'ú': ['u', 'acute'], 'ü': ['u', 'uml'], 'ç': ['c', 'cedil'],
};
const L_MARKS = {
  acute: [[2, -1], [1, 0]], grave: [[0, -1], [1, 0]], circ: [[1, -1], [0, 0], [2, 0]],
  tilde: [[1, -1], [2, -1], [0, 0], [1, 0]], uml: [[0, 0], [2, 0]], cedil: [[1, 5], [0, 6]],
};

function glyphCase(ch) {
  if (L[ch]) return { rows: L[ch], mark: null };
  if (L_ACC[ch]) return { rows: L[L_ACC[ch][0]], mark: L_MARKS[L_ACC[ch][1]] };
  return glyphOf(ch);
}

export function textWidthCase(str) {
  let w = 0;
  for (const ch of str) w += glyphCase(ch).rows[0].length + 1;
  return Math.max(0, w - 1);
}

/**
 * Como drawText, mas respeita minúsculas. `px` = tamanho do pixel da fonte (1, 2…).
 * (x, y) = topo das maiúsculas. Retorna o x final.
 */
export function drawTextCase(ctx, str, x, y, color, px = 1) {
  ctx.fillStyle = color;
  let cx = Math.round(x);
  const cy = Math.round(y);
  for (const ch of str) {
    const { rows, mark } = glyphCase(ch);
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < row.length; c++) if (row[c] === '#') ctx.fillRect(cx + c * px, cy + r * px, px, px);
    }
    if (mark) for (const [mx, my] of mark) ctx.fillRect(cx + mx * px, cy + my * px, px, px);
    cx += (rows[0].length + 1) * px;
  }
  return cx - px;
}
