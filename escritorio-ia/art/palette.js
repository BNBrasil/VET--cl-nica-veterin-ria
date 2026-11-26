// Paleta fechada do Escritório de IA Animado — v2 (pixel art isométrica, cores vivas, contorno escuro).
// Toda a arte é desenhada com NOMES de cor ("slots"). Cada tema decide o hex de cada slot (art/tema.js) e
// pode criar slots próprios (destaque por sala, piso, parede, cabelo e roupa por personagem). No fim, a
// paleta real (cores únicas) é limitada a 64 cores: se passar, as cores menos importantes são fundidas com
// a vizinha mais próxima (finalizarPaleta). O tema `padrao` usa exatamente BASE (63 cores, a arte original).

export const BASE = {
  // neutros (frios, levemente arroxeados)
  outline:   '#1a1420',
  ink:       '#2c2438',
  shadow:    '#4a4058',
  gray:      '#6e6a80',
  silver:    '#9a98a8',
  light:     '#c8c8d0',
  white:     '#f4f0e8',
  snow:      '#ffffff',
  navy:      '#1e2a48',
  slate:     '#3a4a6a',
  steel:     '#5a6a8a',
  // madeira / pisos / tons quentes
  woodDark:  '#3e2a20',
  wood:      '#6a4630',
  woodLight: '#946440',
  tan:       '#c09060',
  sand:      '#dcb888',
  cream:     '#e8dcc0',
  // pele
  skin:      '#f0c8a0',
  skinMid:   '#d09870',
  skinDark:  '#a06a48',
  skinDeep:  '#7a4a30',
  blush:     '#f08080',
  // cabelo
  ginger:    '#c06030',
  blonde:    '#e8c860',
  // destaques das salas (shared/rooms.json)
  orange:    '#e0a030', // orquestrador
  yellow:    '#d8c040', // roteirista
  purple:    '#9a4ad8', // editor-video
  cyan:      '#40b0d0', // animador
  green:     '#40c060', // programador
  blue:      '#4070e0', // desenvolvedor
  pink:      '#e05090', // designer
  red:       '#c04040', // revisor
  brown:     '#a07050', // copa
  teal:      '#70a090', // lounge
  // sombras dos destaques
  orangeDark: '#a06a18',
  yellowDark: '#988420',
  purpleDark: '#5a2a90',
  cyanDark:   '#20708a',
  greenDark:  '#207a38',
  blueDark:   '#2a4498',
  pinkDark:   '#982a60',
  redDark:    '#7a2028',
  brownDark:  '#70482e',
  tealDark:   '#406858',
  // luzes dos destaques (paredes, brilhos)
  orangeLight: '#f8d088',
  lamp:        '#f8e880',
  neon:        '#c890f0',
  cyanLight:   '#a0e8f8',
  greenLight:  '#a0f0a0',
  blueLight:   '#a0c0f8',
  pinkLight:   '#f0a0c0',
  redLight:    '#f0a090',
  brownLight:  '#d8b090',
  tealLight:   '#b0d8c8',
  // tons pastel para paredes (claros e pouco saturados)
  orangePale:  '#fbe8c8',
  yellowPale:  '#f8f0c0',
  purplePale:  '#3a2458',
  cyanPale:    '#d0f0f8',
  greenPale:   '#28384a',
  bluePale:    '#d8e4fc',
  pinkPale:    '#fcdce8',
  redPale:     '#fcf4f0',
  tealPale:    '#d8ece4',
};

/** Família de destaque nativa de cada sala (nomes da BASE). O valor do destaque vem de rooms.json. */
export const BASE_ACCENT = {
  orquestrador: { mid: 'orange', dark: 'orangeDark', light: 'orangeLight', pale: 'orangePale' },
  roteirista: { mid: 'yellow', dark: 'yellowDark', light: 'lamp', pale: 'yellowPale' },
  'editor-video': { mid: 'purple', dark: 'purpleDark', light: 'neon', pale: 'purplePale' },
  animador: { mid: 'cyan', dark: 'cyanDark', light: 'cyanLight', pale: 'cyanPale' },
  programador: { mid: 'green', dark: 'greenDark', light: 'greenLight', pale: 'greenPale' },
  desenvolvedor: { mid: 'blue', dark: 'blueDark', light: 'blueLight', pale: 'bluePale' },
  designer: { mid: 'pink', dark: 'pinkDark', light: 'pinkLight', pale: 'pinkPale' },
  revisor: { mid: 'red', dark: 'redDark', light: 'redLight', pale: 'redPale' },
  copa: { mid: 'brown', dark: 'brownDark', light: 'brownLight', pale: 'cream' },
  lounge: { mid: 'teal', dark: 'tealDark', light: 'tealLight', pale: 'tealPale' },
};

export const MAX_COLORS = 64;

// ---------------------------------------------------------------- estado (uma geração por vez)
/** nome → hex do tema aplicado (objeto vivo). */
export const PALETTE = {};
/** Cores únicas da paleta aplicada (array vivo). */
export const COLORS = [];
/** Família de destaque por sala → nomes de slot (objeto vivo; ver tema). */
export const ACCENT = {};
/** Slots: índice estável por nome (o Canvas guarda índices). */
export const SLOTS = { names: [], hex: [], rgba: [], prio: [], index: new Map(), byHex: new Map() };

export function hexToRgba(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 255];
}

function rebuild() {
  SLOTS.rgba = SLOTS.hex.map(hexToRgba);
  SLOTS.byHex = new Map();
  SLOTS.hex.forEach((h, i) => { if (!SLOTS.byHex.has(h)) SLOTS.byHex.set(h, i); });
  for (const k of Object.keys(PALETTE)) delete PALETTE[k];
  SLOTS.names.forEach((n, i) => { PALETTE[n] = SLOTS.hex[i]; });
  COLORS.length = 0;
  for (const h of SLOTS.hex) if (!COLORS.includes(h)) COLORS.push(h);
}

/** Volta para a paleta BASE (tema padrão) — 63 slots nos índices de sempre. */
export function resetPalette() {
  SLOTS.names = []; SLOTS.hex = []; SLOTS.prio = []; SLOTS.index = new Map();
  for (const [n, h] of Object.entries(BASE)) { SLOTS.index.set(n, SLOTS.names.length); SLOTS.names.push(n); SLOTS.hex.push(h); SLOTS.prio.push(2); }
  for (const k of Object.keys(ACCENT)) delete ACCENT[k];
  Object.assign(ACCENT, JSON.parse(JSON.stringify(BASE_ACCENT)));
  rebuild();
}

/**
 * Define (ou redefine) um slot. prio: 0 = pode ser fundido à vontade, 1 = normal, 2 = base, 3 = protegido
 * (escolha explícita do usuário / destaque das salas: nunca muda para caber em 64 cores, se der).
 */
export function defineColor(name, hex, prio = 1) {
  const h = hex.toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(h)) throw new Error(`cor inválida para ${name}: ${hex}`);
  let i = SLOTS.index.get(name);
  if (i === undefined) { i = SLOTS.names.length; SLOTS.index.set(name, i); SLOTS.names.push(name); SLOTS.hex.push(h); SLOTS.prio.push(prio); }
  else { SLOTS.hex[i] = h; SLOTS.prio[i] = Math.max(SLOTS.prio[i], prio); }
  rebuild();
  return name;
}
/** Muda vários slots de uma vez (sem reconstruir a cada um). fn(name, hex) → novo hex ou undefined. */
export function mapColors(fn) {
  SLOTS.names.forEach((n, i) => { const r = fn(n, SLOTS.hex[i], i); if (r) SLOTS.hex[i] = r.toLowerCase(); });
  rebuild();
}
export function hexOf(name) { const i = SLOTS.index.get(name); return i === undefined ? undefined : SLOTS.hex[i]; }

/** Nome do slot a partir do hex (primeiro com esse hex) ou undefined. */
export function nameOf(hex) { const i = SLOTS.byHex.get(hex.toLowerCase()); return i === undefined ? undefined : SLOTS.names[i]; }

/**
 * Garante ≤ MAX_COLORS cores únicas fundindo pares próximos. Em cada passo junta o par (a, b) de menor
 * distância ponderada; a cor de menor prioridade passa a usar o hex da outra. Retorna a lista de fusões.
 */
export function finalizarPaleta(dist, { max = MAX_COLORS, usados = null } = {}) {
  const merges = [];
  for (;;) {
    // cores únicas e a maior prioridade de cada uma
    const uniq = new Map();
    SLOTS.hex.forEach((h, i) => {
      if (usados && !usados.has(i)) return;
      uniq.set(h, Math.max(uniq.get(h) ?? -1, SLOTS.prio[i]));
    });
    if (uniq.size <= max) break;
    const list = [...uniq.entries()];
    let best = null;
    for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
      const [ha, pa] = list[a], [hb, pb] = list[b];
      const w = Math.min(pa, pb) >= 3 ? 8 : 1 + Math.min(pa, pb) * 0.5;
      const d = dist(ha, hb) * w;
      if (!best || d < best.d) best = { d, keep: pa >= pb ? ha : hb, drop: pa >= pb ? hb : ha };
    }
    merges.push([best.drop, best.keep]);
    SLOTS.hex = SLOTS.hex.map((h) => (h === best.drop ? best.keep : h));
  }
  rebuild();
  return merges;
}

resetPalette();
