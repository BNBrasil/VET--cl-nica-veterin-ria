// Personagens chibi 32x48 (v2, isométrico). Âncora = ponto do chão sob o corpo: (16, 46).
// Sentado: o ponto é o centro da cadeira; a mesa (camada fg do mapa) começa 8 unidades à frente
// (sudeste) com tampo a 20 px, então o tampo esconde a barriga e as pernas e as mãos ficam logo acima
// da borda de trás (linha y ≈ 32 + (x-24)·(-1/2) no quadro).
// Cada quadro é montado em partes (braço de trás, pernas, tronco, cabeça, braço da frente, adereços),
// cada parte com contorno escuro próprio de 1 px.
import { Canvas } from './draw.js';
import { Layer } from './iso.js';

export const CW = 32, CH = 48, ANCHOR = { x: 16, y: 46 };

// ---------------------------------------------------------------- aparência por cargo
/** Tons de pele por índice: [cor, sombra] (nomes de slot). O tema pode trocar (art/aplicar.js). */
export const PELES = [['skin', 'skinMid'], ['skinMid', 'skinDark'], ['skinDark', 'skinDeep'], ['skinDeep', 'woodDark']];
const SKIN_IDX = { light: 0, mid: 1, dark: 2, deep: 3 };
const skinOf = (look) => PELES[typeof look.skin === 'number' ? look.skin : SKIN_IDX[look.skin]] || PELES[0];
export const HAIRS = {
  black: ['ink', 'outline', 'shadow'], darkBrown: ['woodDark', 'outline', 'wood'], brown: ['wood', 'woodDark', 'woodLight'],
  ginger: ['ginger', 'brownDark', 'orange'], blonde: ['blonde', 'tan', 'lamp'], gray: ['light', 'silver', 'snow'],
  plum: ['purpleDark', 'ink', 'purple'], teal: ['tealDark', 'ink', 'teal'],
};
const hairOf = (look) => (Array.isArray(look.hair) ? look.hair : HAIRS[look.hair]);

// acc = acessório principal (como no desenho original); accs = lista completa (cabelo "boné/gorro" + acessório)
export const LOOKS = {
  orquestrador: { skin: 'light', hair: 'darkBrown', style: 'neat', top: ['navy', 'ink'], kind: 'blazer', shirt: 'white', tie: 'orange', tieDark: 'orangeDark', pants: 'slate', shoes: 'woodDark' },
  roteirista: { skin: 'light', hair: 'ginger', style: 'long', top: ['yellow', 'yellowDark'], kind: 'cardigan', shirt: 'cream', pants: 'wood', shoes: 'woodDark', acc: 'pencil' },
  'editor-video': { skin: 'mid', hair: 'black', style: 'messy', top: ['purple', 'purpleDark'], kind: 'hoodie', shirt: 'neon', pants: 'ink', shoes: 'snow', acc: 'headphones' },
  animador: { skin: 'light', hair: 'blonde', style: 'bun', top: ['cyan', 'cyanDark'], kind: 'apron', shirt: 'white', pants: 'slate', shoes: 'red' },
  programador: { skin: 'dark', hair: 'black', style: 'short', top: ['green', 'greenDark'], kind: 'hoodie', shirt: 'greenLight', pants: 'navy', shoes: 'shadow', acc: 'beanie', beard: true },
  desenvolvedor: { skin: 'mid', hair: 'brown', style: 'short', top: ['blue', 'blueDark'], kind: 'jacket', shirt: 'white', pants: 'slate', shoes: 'snow', acc: 'cap' },
  designer: { skin: 'deep', hair: 'plum', style: 'bob', top: ['pink', 'pinkDark'], kind: 'tee', shirt: 'pinkLight', pants: 'ink', shoes: 'lamp', acc: 'beret', earring: true },
  revisor: { skin: 'light', hair: 'gray', style: 'bald', top: ['red', 'redDark'], kind: 'vest', shirt: 'white', tie: 'redDark', pants: 'shadow', shoes: 'woodDark', acc: 'glasses', mustache: true },
  visitante: { skin: 'dark', hair: 'black', style: 'curly', top: ['teal', 'tealDark'], kind: 'jacket', shirt: 'cream', pants: 'steel', shoes: 'woodDark', acc: 'badge' },
  // convidados (shared/rooms.json → convidados): visitam o lounge com visual próprio
  pesquisador: { skin: 'mid', hair: 'darkBrown', style: 'messy', top: ['orange', 'orangeDark'], kind: 'cardigan', shirt: 'white', pants: 'wood', shoes: 'woodDark', acc: 'glasses' },
  locutor: { skin: 'deep', hair: 'black', style: 'short', top: ['purple', 'purpleDark'], kind: 'vest', shirt: 'white', tie: 'purpleDark', pants: 'ink', shoes: 'snow', beard: true },
  'social-media': { skin: 'light', hair: 'blonde', style: 'long', top: ['pink', 'pinkDark'], kind: 'jacket', shirt: 'white', pants: 'slate', shoes: 'snow', acc: 'cap', earring: true },
};
/** Ids com animação de trabalho em pé (visitantes do lounge). */
export const STANDING = ['visitante', 'pesquisador', 'locutor', 'social-media'];
const accsOf = (look) => look.accs || (look.acc ? [look.acc] : []);

// ---------------------------------------------------------------- utilitários
function thick(L, x0, y0, x1, y1, w, col) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let s = 0; s <= n; s++) {
    const x = Math.round(x0 + ((x1 - x0) * s) / n), y = Math.round(y0 + ((y1 - y0) * s) / n);
    const a = -Math.floor((w - 1) / 2), b = Math.ceil((w - 1) / 2);
    for (let dy = a; dy <= b; dy++) for (let dx = a; dx <= b; dx++) L.px(x + dx, y + dy, col);
  }
}
function disc(L, cx, cy, r, col) { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) L.px(cx + x, cy + y, col); }
function rows(L, list, col) { for (const [y, x0, x1] of list) for (let x = x0; x <= x1; x++) L.px(x, y, col); }

// ---------------------------------------------------------------- cabeça (20x19, 3/4 virada para a direita)
const SKULL = [
  '......########......',
  '....############....',
  '...##############...',
  '..################..',
  '.##################.',
  '.##################.',
  '####################',
  '####################',
  '####################',
  '####################',
  '####################',
  '####################',
  '.##################.',
  '.##################.',
  '..################..',
  '...##############...',
  '....#############...',
  '......#########.....',
];
const inSkull = (x, y) => y >= 0 && y < SKULL.length && x >= 0 && x < 20 && SKULL[y][x] === '#';

/** Região de cabelo por estilo (coordenadas locais da cabeça; pode sair do crânio). Retorna 0 (nada), 1 (cabelo), 2 (sombra). */
function hairAt(style, x, y, back) {
  const skull = inSkull(x, y);
  // volume: 1 px acima do crânio
  const above = !skull && inSkull(x, y + 1) && y < 8;
  if (back) {
    // vista de costas: cabelo cobre quase tudo
    if (style === 'bald') return (skull && y >= 6 && y < 14) ? 1 : 0;
    if (style === 'long') { if (skull || above) return 1; if (y >= 12 && y < 22 && x >= 1 && x <= 18) return y > 19 || (x + y) % 7 === 0 ? 2 : 1; return 0; }
    if (style === 'bob') { if (skull || above) return 1; if (y >= 12 && y < 19 && x >= 0 && x <= 19) return 1; return 0; }
    if (style === 'curly') { if (skull || above || (y >= -2 && y < 15 && Math.hypot(x - 9.5, y - 7) < 11.5)) return 1; return 0; }
    if (style === 'mohawk') { if ((skull || above) && x >= 8 && x <= 11 && y < 14) return 1; if (y >= -4 && y < 0 && x >= 8 && x <= 11) return 1; if (skull && y >= 6 && y < 14) return 2; return 0; }
    if (skull) return y < 15 ? 1 : 0;
    return above ? 1 : 0;
  }
  switch (style) {
    case 'neat': // risca do lado, franja caída para a direita
      if (above) return 1;
      if (!skull) return 0;
      if (x <= 4 && y <= 12) return 1;
      if (y <= 3) return 1;
      if (y === 4 && x <= 15) return 1;
      if (y === 5 && x <= 10) return 1;
      if (y === 6 && x <= 7) return 1;
      if (y <= 8 && x <= 5) return 1;
      if (y === 4 && x >= 18) return 1;
      if (y >= 4 && y <= 7 && x === 19) return 1;
      return 0;
    case 'short':
      if (above) return 1;
      if (!skull) return 0;
      if (y <= 4) return 1;
      if (y === 5 && (x <= 6 || x % 3 !== 1)) return 1;
      if (x <= 4 && y <= 11) return 1;
      if (x >= 18 && y <= 7) return 1;
      return 0;
    case 'messy': { // espetado
      const spikes = [[3, -2], [6, -3], [9, -2], [12, -3], [15, -2], [1, 0], [18, 1]];
      for (const [sx, sy] of spikes) if (y >= sy && y < sy + 3 && Math.abs(x - sx) <= (y - sy)) return 1;
      if (above) return 1;
      if (!skull) return 0;
      if (y <= 4) return 1;
      if (y === 5 && x % 4 !== 2) return 1;
      if (y === 6 && x % 4 === 0) return 1;
      if (x <= 4 && y <= 12) return 1;
      if (x >= 18 && y <= 8) return 1;
      return 0;
    }
    case 'long': // ondulado até os ombros, franja aberta
      if (above) return 1;
      if (skull) {
        if (y <= 4) return 1;
        if (y === 5 && (x <= 9 || x >= 15)) return 1;
        if (y >= 6 && (x <= 5 || x >= 18)) return 1;
        return 0;
      }
      if (y >= 9 && y <= 25) {
        if (x >= -1 && x <= 5) return y >= 23 && (x + y) % 3 === 0 ? 0 : (x <= 0 ? 2 : 1);
        if (x >= 18 && x <= 20 && y <= 20) return 1;
      }
      if (y >= 6 && y < 9 && (x === -1 || x === 20)) return 1;
      return 0;
    case 'bun':
      if (y >= -5 && y <= -1 && Math.hypot(x - 7, y + 3) <= 3.2) return y <= -4 ? 1 : 1;
      if (above) return 1;
      if (!skull) return 0;
      if (y <= 4) return 1;
      if (y === 5 && (x <= 11 || x >= 17)) return 1;
      if (x <= 4 && y <= 11) return 1;
      if (x >= 18 && y <= 10) return 1;
      return 0;
    case 'bob': // chanel, franja reta
      if (above) return 1;
      if (skull) {
        if (y <= 6) return 1;
        if (x <= 5 || x >= 18) return 1;
        return 0;
      }
      if (y >= 6 && y <= 18 && x >= -1 && x <= 20 && (x <= 1 || x >= 18)) return y === 18 ? 2 : 1;
      return 0;
    case 'curly': // black power/cachos volumosos
      if (!skull && y < 15 && Math.hypot(x - 9.5, y - 6) < 11.5 && !(x > 15 && y > 8)) return (x + y) % 5 === 0 ? 2 : 1;
      if (!skull) return 0;
      if (y <= 5) return 1;
      if (y === 6 && x % 3 !== 0) return 1;
      if (x <= 4 && y <= 12) return 1;
      return 0;
    case 'mohawk': // moicano: crista no meio, laterais raspadas
      if (y >= -4 && y < 1 && x >= 8 && x <= 12 && Math.abs(x - 10) <= 1 + (y + 4) / 2) return 1;
      if (above && x >= 7 && x <= 13) return 1;
      if (!skull) return 0;
      if (y <= 3 && x >= 7 && x <= 13) return 1;
      if (x <= 3 && y >= 5 && y <= 11) return 2;
      return 0;
    case 'bald': // careca em cima, cabelo nos lados
      if (!skull) return 0;
      if (x <= 4 && y >= 5 && y <= 12) return 1;
      if (x >= 18 && y >= 6 && y <= 9) return 1;
      return 0;
    default: return 0;
  }
}

/**
 * Desenha a cabeça em (ox, oy). face: { eyes, mouth, look } ; back = vista de costas.
 */
function drawHead(L, look, ox, oy, face, back = false) {
  const [sk, skS] = skinOf(look);
  const [h, hS, hL] = hairOf(look);
  // crânio
  for (let y = 0; y < SKULL.length; y++) for (let x = 0; x < 20; x++) if (inSkull(x, y)) {
    let c = sk;
    if (!back && (x <= 1 || y >= 16 || (x <= 2 && y >= 12))) c = skS;
    L.px(ox + x, oy + y, c);
  }
  if (!back) {
    // orelha (lado esquerdo da tela)
    L.px(ox + 3, oy + 10, sk); L.px(ox + 4, oy + 10, skS); L.px(ox + 3, oy + 11, skS); L.px(ox + 3, oy + 9, sk);
    if (look.earring) L.px(ox + 3, oy + 13, 'lamp');
  }
  // cabelo
  for (let y = -6; y < 27; y++) for (let x = -2; x < 22; x++) {
    const k = hairAt(look.style, x, y, back);
    if (!k) continue;
    let c = k === 2 ? hS : h;
    // sombra na base e nas laterais, brilho em arco em cima à direita
    if (k === 1) {
      if (!back && y >= 2 && y <= 3 && x >= 11 && x <= 15 && look.style !== 'bald') c = hL;
      if (back && y >= 1 && y <= 2 && x >= 6 && x <= 12) c = hL;
      if (x <= 0 || (back ? y >= 15 : false)) c = hS;
    }
    L.px(ox + x, oy + y, c);
  }
  if (look.style === 'bald' && !back && !accsOf(look).some((a) => a === 'cap' || a === 'beanie' || a === 'beret')) { L.px(ox + 12, oy + 2, 'snow'); L.px(ox + 13, oy + 2, 'snow'); L.px(ox + 11, oy + 3, 'snow'); }
  if (!back) drawFace(L, look, ox, oy, face);
  drawHeadAcc(L, look, ox, oy, back);
}

function drawFace(L, look, ox, oy, { eyes = 'open', mouth = 'smile', look: lk = 0, blush = true }) {
  const [sk, skS] = skinOf(look);
  const E = [[8, 9], [14, 9]]; // canto superior esquerdo de cada olho (2x3)
  const P = (x, y, c) => L.px(ox + x, oy + y, c);
  for (const [ex0, ey] of E) {
    const ex = ex0 + lk;
    switch (eyes) {
      case 'open':
        P(ex, ey, 'outline'); P(ex + 1, ey, 'snow'); P(ex, ey + 1, 'outline'); P(ex + 1, ey + 1, 'outline'); P(ex, ey + 2, 'outline'); P(ex + 1, ey + 2, 'outline');
        break;
      case 'wide':
        P(ex, ey - 1, 'outline'); P(ex + 1, ey - 1, 'outline');
        P(ex, ey, 'snow'); P(ex + 1, ey, 'outline'); P(ex, ey + 1, 'outline'); P(ex + 1, ey + 1, 'outline'); P(ex, ey + 2, 'outline'); P(ex + 1, ey + 2, 'outline');
        break;
      case 'down': // olhando para baixo (lendo)
        P(ex, ey + 1, 'outline'); P(ex + 1, ey + 1, 'outline'); P(ex, ey + 2, 'outline'); P(ex + 1, ey + 2, 'outline');
        break;
      case 'half':
        P(ex - 1, ey + 1, 'outline'); P(ex, ey + 1, 'outline'); P(ex + 1, ey + 1, 'outline'); P(ex, ey + 2, 'outline'); P(ex + 1, ey + 2, 'outline');
        break;
      case 'closed':
        P(ex, ey + 2, 'outline'); P(ex + 1, ey + 2, 'outline'); P(ex - 1, ey + 1, skS);
        break;
      case 'sleep': // arquinhos para baixo
        P(ex - 1, ey + 1, 'outline'); P(ex, ey + 2, 'outline'); P(ex + 1, ey + 2, 'outline'); P(ex + 2, ey + 1, 'outline');
        break;
      case 'happy': // ^ ^
        P(ex - 1, ey + 2, 'outline'); P(ex, ey + 1, 'outline'); P(ex + 1, ey + 1, 'outline'); P(ex + 2, ey + 2, 'outline');
        break;
      case 'dizzy':
        P(ex, ey, 'outline'); P(ex + 1, ey + 1, 'outline'); P(ex, ey + 2, 'outline'); P(ex + 1, ey, 'outline'); P(ex, ey + 1, 'outline'); P(ex + 1, ey + 2, 'outline');
        break;
    }
  }
  // sobrancelhas de preocupação
  if (mouth === 'frown' || eyes === 'wide') { P(8 + lk, 7, 'outline'); P(9 + lk, 6, 'outline'); P(15 + lk, 6, 'outline'); P(16 + lk, 7, 'outline'); }
  if (blush) { P(6, 13, 'blush'); P(7, 13, 'blush'); P(17, 13, 'blush'); }
  const mx = 11 + lk, my = 14;
  switch (mouth) {
    case 'smile': P(mx - 1, my - 1, 'outline'); P(mx, my, 'outline'); P(mx + 1, my, 'outline'); P(mx + 2, my - 1, 'outline'); break;
    case 'flat': P(mx, my, 'outline'); P(mx + 1, my, 'outline'); break;
    case 'open': P(mx, my - 1, 'outline'); P(mx + 1, my - 1, 'outline'); P(mx - 1, my, 'outline'); P(mx, my, 'redDark'); P(mx + 1, my, 'redDark'); P(mx + 2, my, 'outline'); P(mx, my + 1, 'outline'); P(mx + 1, my + 1, 'outline'); break;
    case 'big': P(mx - 1, my - 1, 'outline'); P(mx, my - 1, 'outline'); P(mx + 1, my - 1, 'outline'); P(mx + 2, my - 1, 'outline'); P(mx - 1, my, 'outline'); P(mx, my, 'red'); P(mx + 1, my, 'red'); P(mx + 2, my, 'outline'); P(mx, my + 1, 'outline'); P(mx + 1, my + 1, 'outline'); break;
    case 'o': P(mx, my - 1, 'outline'); P(mx + 1, my - 1, 'outline'); P(mx, my, 'outline'); P(mx + 1, my, 'outline'); break;
    case 'frown': P(mx - 1, my + 1, 'outline'); P(mx, my, 'outline'); P(mx + 1, my, 'outline'); P(mx + 2, my + 1, 'outline'); break;
    case 'wavy': P(mx - 1, my, 'outline'); P(mx, my - 1, 'outline'); P(mx + 1, my, 'outline'); P(mx + 2, my - 1, 'outline'); break;
    case 'drool': P(mx, my, 'outline'); P(mx + 1, my, 'outline'); P(mx + 1, my + 1, 'cyanLight'); break;
    case 'tongue': P(mx - 1, my - 1, 'outline'); P(mx, my, 'outline'); P(mx + 1, my, 'pinkLight'); P(mx + 2, my - 1, 'outline'); break;
  }
  if (look.mustache) { const [m1, m2] = hairOf(look); P(mx - 1, my - 2, m1); P(mx, my - 2, m2); P(mx + 1, my - 2, m2); P(mx + 2, my - 2, m1); P(mx - 2, my - 1, m1); P(mx + 3, my - 1, m1); }
  if (look.beard) { for (let x = 4; x <= 17; x++) { const y = x < 7 || x > 15 ? 15 : 16; P(x, y, 'outline'); if (x > 6 && x < 15) P(x, 17, 'ink'); } P(mx, my + 2, 'ink'); P(mx + 1, my + 2, 'ink'); }
}

function drawHeadAcc(L, look, ox, oy, back) {
  for (const acc of accsOf(look)) drawOneAcc(L, acc, ox, oy, back);
}
function drawOneAcc(L, acc, ox, oy, back) {
  const P = (x, y, c) => L.px(ox + x, oy + y, c);
  switch (acc) {
    case 'headphones':
      // arco por cima e concha na orelha (esquerda) + concha direita aparecendo
      for (let x = 2; x <= 18; x++) { const y = x < 5 || x > 15 ? 1 : x < 8 || x > 12 ? -1 : -2; P(x, y, 'ink'); P(x, y - 1, 'shadow'); }
      for (const [x0, w] of back ? [[0, 4], [16, 4]] : [[1, 5], [18, 3]]) for (let y = 7; y <= 13; y++) for (let x = x0; x < x0 + w; x++) P(x, y, y === 7 || y === 13 ? 'ink' : x === x0 + 1 ? 'neon' : 'purple');
      break;
    case 'beanie':
      for (let y = -3; y <= 6; y++) for (let x = -1; x <= 20; x++) {
        const inCap = (y >= 4 && y <= 6 && inSkull(x, Math.min(y, 6)) ) || (y < 4 && (inSkull(x, y) || inSkull(x, y + 2)) && Math.hypot(x - 9.5, y - 4) < 11.5);
        if (!inCap) continue;
        P(x, y, y >= 4 ? (x % 2 ? 'shadow' : 'gray') : (x + y) % 4 === 0 ? 'shadow' : 'gray');
      }
      P(9, -4, 'greenLight'); P(10, -4, 'greenLight'); P(9, -5, 'green'); P(10, -5, 'green'); P(8, -4, 'green'); P(11, -4, 'green');
      break;
    case 'cap': // boné virado para trás (aba atrás, à esquerda)
      for (let y = -2; y <= 5; y++) for (let x = -1; x <= 20; x++) {
        if (!(inSkull(x, y) || inSkull(x, y + 1) || inSkull(x, y + 2)) || y > 5) continue;
        if (Math.hypot(x - 10, y - 5) > 11) continue;
        P(x, y, y === 5 ? 'orangeDark' : (x > 12 && y < 2) ? 'orangeLight' : 'orange');
      }
      if (!back) for (let x = -4; x <= 2; x++) { P(x, 4, 'orangeDark'); P(x, 5, 'orangeDark'); }
      else for (let x = 7; x <= 13; x++) { P(x, 6, 'orangeDark'); P(x, 7, 'orangeDark'); }
      P(10, -2, 'orangeDark');
      break;
    case 'beret':
      for (let y = -4; y <= 3; y++) for (let x = -1; x <= 19; x++) {
        if (((x - 8) / 11) ** 2 + ((y + 0.5) / 3.6) ** 2 > 1) continue;
        P(x, y, y >= 2 ? 'yellowDark' : (x > 9 && y < 0) ? 'lamp' : 'yellow');
      }
      P(8, -5, 'yellowDark'); P(8, -6, 'yellowDark');
      break;
    case 'glasses':
      if (back) { P(0, 9, 'outline'); P(19, 9, 'outline'); break; }
      for (const [x0] of [[7], [13]]) {
        for (let x = x0; x < x0 + 5; x++) { P(x, 8, 'outline'); P(x, 12, 'outline'); }
        for (let y = 8; y <= 12; y++) { P(x0, y, 'outline'); P(x0 + 4, y, 'outline'); }
        P(x0 + 1, 9, 'cyanLight');
      }
      P(12, 9, 'outline'); for (let x = 2; x < 7; x++) P(x, 9, 'outline');
      break;
    case 'pencil':
      if (back) break;
      P(2, 6, 'lamp'); P(3, 7, 'lamp'); P(4, 8, 'yellow'); P(5, 9, 'sand'); P(1, 5, 'pink');
      break;
  }
}

// ---------------------------------------------------------------- corpo
/** Tronco sentado/em pé (frente 3/4). ty = linha do topo do tronco. */
function drawTorso(L, look, ty, { back = false, h = 12 } = {}) {
  const [c, C] = look.top;
  const list = [];
  for (let y = 0; y < h; y++) {
    const x0 = y === 0 ? 11 : y >= h - 2 ? 11 : 10, x1 = y === 0 ? 21 : y >= h - 2 ? 21 : 22;
    list.push([ty + y, x0, x1]);
  }
  for (const [y, x0, x1] of list) for (let x = x0; x <= x1; x++) {
    let col = x <= x0 + 2 ? C : c;
    if (y >= ty + h - 2) col = C;
    L.px(x, y, col);
  }
  if (back) {
    if (look.kind === 'hoodie') rows(L, [[ty, 12, 20], [ty + 1, 12, 20], [ty + 2, 13, 19]], C);
    return;
  }
  const P = (x, y, col) => L.px(x, y, col);
  switch (look.kind) {
    case 'blazer':
      // camisa em V, gravata, lapelas
      for (let y = 0; y < 6; y++) for (let x = 15 - Math.max(0, 3 - y); x <= 17 + Math.max(0, 3 - y); x++) if (y < 4 || x === 16) P(x, ty + y, look.shirt);
      for (let y = 1; y < 8; y++) P(16, ty + y, y < 2 ? look.tie : y < 7 ? look.tie : look.tieDark || look.tie);
      P(15, ty + 1, look.tieDark || look.tie);
      for (let y = 1; y < 7; y++) { P(14 - (y > 4 ? 0 : 0), ty + y, C); P(18, ty + y, C); }
      P(19, ty + 6, 'lamp');
      break;
    case 'cardigan':
      for (let y = 0; y < h; y++) for (let x = 15; x <= 17; x++) P(x, ty + y, look.shirt);
      for (let y = 0; y < h; y++) { P(14, ty + y, C); P(18, ty + y, C); }
      P(18, ty + 4, 'cream'); P(18, ty + 7, 'cream'); P(18, ty + 10, 'cream');
      break;
    case 'hoodie':
      rows(L, [[ty, 12, 20]], C);
      P(14, ty + 1, 'white'); P(14, ty + 2, 'white'); P(14, ty + 3, 'white'); P(18, ty + 1, 'white'); P(18, ty + 2, 'white'); P(18, ty + 3, 'white');
      rows(L, [[ty + 7, 13, 20], [ty + 8, 13, 20]], C);
      P(16, ty + 4, look.shirt); P(17, ty + 4, look.shirt); P(16, ty + 5, look.shirt);
      break;
    case 'apron':
      for (let y = 2; y < h; y++) for (let x = 13; x <= 20; x++) P(x, ty + y, y === 2 ? 'light' : 'white');
      P(13, ty, 'white'); P(13, ty + 1, 'white'); P(20, ty, 'white'); P(20, ty + 1, 'white');
      P(15, ty + 5, 'cyan'); P(16, ty + 5, 'pink'); P(17, ty + 5, 'yellow'); // canetinhas no bolso
      rows(L, [[ty + 6, 14, 19]], 'light');
      break;
    case 'jacket':
      for (let y = 0; y < h; y++) P(16, ty + y, y === 0 ? look.shirt : C);
      for (let x = 14; x <= 18; x++) P(x, ty, look.shirt);
      P(15, ty + 1, look.shirt); P(17, ty + 1, look.shirt);
      rows(L, [[ty + 7, 12, 14], [ty + 7, 18, 21]], C);
      break;
    case 'tee':
      rows(L, [[ty, 14, 18]], skinOf(look)[0]);
      P(14, ty + 1, skinOf(look)[0]); P(18, ty + 1, skinOf(look)[0]); P(15, ty + 1, skinOf(look)[0]); P(16, ty + 1, skinOf(look)[0]); P(17, ty + 1, skinOf(look)[0]);
      // estampa: coração/estrela
      P(16, ty + 5, 'snow'); P(15, ty + 4, 'snow'); P(17, ty + 4, 'snow'); P(16, ty + 4, 'pinkLight');
      break;
    case 'vest':
      for (let y = 0; y < h; y++) for (let x = 14; x <= 18; x++) if (y < 6 - Math.abs(x - 16) * 0 || x === 16) P(x, ty + y, y < 6 ? look.shirt : c);
      for (let y = 0; y < 7; y++) P(16, ty + y, y < 1 ? look.shirt : look.tie);
      P(17, ty + 7, 'lamp'); P(17, ty + 9, 'lamp');
      rows(L, [[ty, 11, 13], [ty, 19, 21]], look.shirt);
      break;
  }
  if (accsOf(look).includes('badge')) { for (let y = 0; y < 5; y++) { P(14 + Math.floor(y / 2), ty + y, 'orange'); P(18 - Math.floor(y / 2), ty + y, 'orange'); } rows(L, [[ty + 5, 15, 17], [ty + 6, 15, 17], [ty + 7, 15, 17]], 'snow'); P(16, ty + 6, 'teal'); }
}

/** Braço: ombro → cotovelo → mão. sleeve = cor da manga. hand: 'open'|'fist'|'up'. */
function drawArm(L, look, sh, el, hd, { sleeve, handOnly = false } = {}) {
  const [sk, skS] = skinOf(look);
  const sl = sleeve || look.top[0];
  if (!handOnly) { thick(L, sh[0], sh[1], el[0], el[1], 3, sl); thick(L, el[0], el[1], hd[0], hd[1], 3, sl); }
  // punho
  L.px(hd[0] - 1, hd[1] - 1, sk); L.px(hd[0], hd[1] - 1, sk); L.px(hd[0] + 1, hd[1] - 1, sk);
  L.px(hd[0] - 1, hd[1], sk); L.px(hd[0], hd[1], sk); L.px(hd[0] + 1, hd[1], skS);
  L.px(hd[0] - 1, hd[1] + 1, skS); L.px(hd[0], hd[1] + 1, skS); L.px(hd[0] + 1, hd[1] + 1, skS);
}

function drawSeatedLegs(L, look) {
  const p = look.pants, P2 = 'outline';
  rows(L, [[35, 11, 21], [36, 11, 23], [37, 12, 24], [38, 15, 25], [39, 18, 25], [40, 19, 25]], p);
  // canelas (duas pernas)
  rows(L, [[41, 19, 21], [42, 19, 21], [43, 19, 21], [41, 23, 25], [42, 23, 25], [43, 23, 25]], p);
  L.px(22, 41, P2);
  // sapatos
  rows(L, [[44, 18, 22], [45, 18, 22], [44, 23, 27], [45, 23, 27]], look.shoes);
  rows(L, [[46, 19, 22], [46, 24, 27]], 'outline');
}

/** Pernas em pé / andando. nf, ff = deslocamento [dx,dy] do pé de perto e do pé de longe. */
function drawStandLegs(L, look, nf = [0, 0], ff = [0, 0], { back = false } = {}) {
  const p = look.pants;
  rows(L, [[36, 11, 21], [37, 11, 21]], p);
  // perna de longe primeiro
  thick(L, 18, 37, 18 + ff[0], 42 + ff[1], 3, p);
  rows(L, [[43 + ff[1], 16 + ff[0], 20 + ff[0] + (back ? 0 : 1)], [44 + ff[1], 16 + ff[0], 20 + ff[0] + (back ? 0 : 1)]], look.shoes);
  thick(L, 14, 37, 14 + nf[0], 43 + nf[1], 3, p);
  rows(L, [[44 + nf[1], 12 + nf[0], 16 + nf[0] + (back ? 0 : 1)], [45 + nf[1], 12 + nf[0], 16 + nf[0] + (back ? 0 : 1)]], look.shoes);
}

// ---------------------------------------------------------------- montagem de um quadro
/**
 * pose: {
 *   mode: 'sit' | 'stand' | 'walk_se' | 'walk_ne',
 *   by: deslocamento do corpo, hx/hy: da cabeça em relação ao corpo,
 *   face: { eyes, mouth, look }, arms: { near: [sh, el, hd] | null, far: [...] | null },
 *   nf/ff: pés (andando), pre/post: funções extras (adereços atrás/na frente)
 * }
 */
function frame(look, pose) {
  const out = new Canvas(CW, CH);
  const L = new Layer(CW, CH);
  const by = pose.by || 0, hx = pose.hx || 0, hy = pose.hy || 0;
  const back = pose.mode === 'walk_ne';
  const sit = pose.mode === 'sit';
  const ty = (sit ? 25 : 25) + by;
  const stamp = () => L.stamp(out);
  const shift = (fn) => (Lx) => fn(Lx);

  // braços padrão
  const cp = (a) => a && a.map((p) => [...p]);
  const near0 = pose.arms?.near ?? (sit ? [[11, 27], [13, 33], [22, 35]] : [[10, ty + 2], [9, ty + 6], [9, ty + 10]]);
  const near = cp(near0);
  const far0 = pose.arms?.far ?? (sit ? [[21, 27], [25, 30], [27, 32]] : [[22, ty + 2], [23, ty + 6], [23, ty + 10]]);
  const far = cp(far0);

  if (sit) { near && (near[0] = [11, 27 + by]); far && (far[0] = [21, 27 + by]); }
  pose.pre?.(L, out); stamp();
  if (back) {
    // de costas: braço "de perto" (direita da tela) fica atrás do tronco
    if (near) { drawArm(L, look, [near[0][0], near[0][1]], near[1], near[2]); stamp(); }
    drawStandLegs(L, look, pose.nf, pose.ff, { back: true }); stamp();
    drawTorso(L, look, ty, { back: true }); stamp();
    if (far) { drawArm(L, look, far[0], far[1], far[2]); stamp(); }
    drawHead(L, look, 6 + hx, 6 + by + hy, {}, true); stamp();
    pose.post?.(L, out); stamp();
    return out;
  }
  if (far) { drawArm(L, look, far[0], far[1], far[2]); stamp(); }
  if (sit) drawSeatedLegs(L, look); else drawStandLegs(L, look, pose.nf, pose.ff);
  stamp();
  drawTorso(L, look, ty); stamp();
  pose.mid?.(L, out); stamp();
  drawHead(L, look, 6 + hx, 6 + by + hy, pose.face || {}); stamp();
  if (near) { drawArm(L, look, near[0], near[1], near[2]); stamp(); }
  pose.post?.(L, out); stamp();
  return out;
}

// ---------------------------------------------------------------- adereços
const prop = {
  paper(L, x, y, { w = 7, h = 5, lines = true } = {}) {
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) L.px(x + xx, y + yy, 'snow');
    if (lines) for (let yy = 1; yy < h - 1; yy += 2) for (let xx = 1; xx < w - 2; xx++) L.px(x + xx, y + yy, 'light');
  },
  stamp(L, x, y, col = 'orange') { // cabo + base (x,y = centro do cabo em cima)
    L.px(x, y, 'woodLight'); L.px(x + 1, y, 'wood'); L.px(x, y + 1, 'woodLight'); L.px(x + 1, y + 1, 'wood'); L.px(x, y + 2, 'wood'); L.px(x + 1, y + 2, 'woodDark');
    for (let xx = -1; xx <= 2; xx++) { L.px(x + xx, y + 3, 'shadow'); L.px(x + xx, y + 4, col); }
  },
  ball(L, x, y) { L.px(x, y, 'snow'); L.px(x + 1, y, 'light'); L.px(x, y + 1, 'light'); L.px(x + 1, y + 1, 'snow'); L.px(x - 1, y, 'snow'); L.px(x, y - 1, 'snow'); },
  phone(L, x, y, scr) { for (let yy = 0; yy < 7; yy++) for (let xx = 0; xx < 5; xx++) L.px(x + xx, y + yy, yy === 0 || yy === 6 || xx === 0 || xx === 4 ? 'ink' : scr[(yy + xx) % scr.length]); },
  lens(L, cx, cy, r = 3) {
    for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 1; x <= r + 1; x++) {
      const d = Math.hypot(x, y);
      if (d <= r - 0.3) L.px(cx + x, cy + y, x + y < -1 ? 'snow' : 'cyanLight');
      else if (d <= r + 0.8) L.px(cx + x, cy + y, 'silver');
    }
  },
  wheel(L, cx, cy, rot) {
    const cols = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink'];
    for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
      const d = Math.hypot(x, y);
      if (d > 4.4) continue;
      if (d < 1.2) { L.px(cx + x, cy + y, 'snow'); continue; }
      const a = (Math.atan2(y, x) / (Math.PI * 2) + 1 + rot / 8) % 1;
      L.px(cx + x, cy + y, cols[Math.floor(a * 8)]);
    }
  },
  stylus(L, x, y) { L.px(x, y, 'ink'); L.px(x + 1, y - 1, 'shadow'); L.px(x + 2, y - 2, 'shadow'); L.px(x + 3, y - 3, 'cyan'); },
  mouse(L, x, y) { L.px(x, y, 'light'); L.px(x + 1, y, 'silver'); L.px(x, y + 1, 'silver'); L.px(x + 1, y + 1, 'gray'); },
};

// ---------------------------------------------------------------- animações
const SIT = (o = {}) => ({ mode: 'sit', ...o });
const STAND = (o = {}) => ({ mode: 'stand', ...o });

function baseAnims(look) {
  const F = (p) => frame(look, p);
  const anims = [];
  const A = (tag, fps, poses) => anims.push({ tag, fps, frames: poses.map(F) });

  // idle: respira (corpo desce 1 px) e pisca no último quadro
  A('base_idle', 4, [
    SIT({ face: { eyes: 'open', mouth: 'smile' } }),
    SIT({ face: { eyes: 'open', mouth: 'smile' }, hy: 0 }),
    SIT({ by: 1, face: { eyes: 'open', mouth: 'smile' } }),
    SIT({ by: 1, face: { eyes: 'closed', mouth: 'smile' } }),
  ]);
  // read: folha nas mãos, olhar para baixo, vira a página
  const paperArms = (ty, d) => ({ near: [[11, 27], [14, 33], [20, 31 + d]], far: [[21, 27], [25, 31], [27, 29 + d]] });
  A('base_read', 6, [0, 1, 2, 3].map((f) => SIT({
    hy: 1, face: { eyes: 'down', mouth: f === 2 ? 'o' : 'flat', look: 1 }, arms: paperArms(25, f === 1 ? 1 : 0),
    post: (L) => { prop.paper(L, 19, 26 + (f === 1 ? 1 : 0), { w: 9, h: 6 }); if (f === 2) prop.paper(L, 24, 22, { w: 4, h: 5, lines: false }); if (f === 3) prop.paper(L, 15, 25, { w: 4, h: 5, lines: false }); },
  })));
  // doze: cabeça cai e levanta
  A('base_doze', 4, [
    SIT({ face: { eyes: 'half', mouth: 'flat' } }),
    SIT({ hy: 1, face: { eyes: 'closed', mouth: 'flat' } }),
    SIT({ hy: 3, hx: 1, face: { eyes: 'sleep', mouth: 'o' } }),
    SIT({ hy: 0, face: { eyes: 'wide', mouth: 'flat' } }),
  ]);
  // sleep: cabeça tombada, respiração lenta, baba
  A('base_sleep', 3, [
    SIT({ hy: 3, hx: -1, face: { eyes: 'sleep', mouth: 'flat' }, arms: { near: [[11, 28], [12, 32], [17, 33]], far: [[21, 27], [22, 31], [21, 33]] } }),
    SIT({ by: 1, hy: 3, hx: -1, face: { eyes: 'sleep', mouth: 'o' }, arms: { near: [[11, 29], [12, 33], [17, 34]], far: [[21, 28], [22, 32], [21, 34]] } }),
    SIT({ by: 1, hy: 4, hx: -1, face: { eyes: 'sleep', mouth: 'o' }, arms: { near: [[11, 29], [12, 33], [17, 34]], far: [[21, 28], [22, 32], [21, 34]] } }),
    SIT({ hy: 3, hx: -1, face: { eyes: 'sleep', mouth: 'drool' }, arms: { near: [[11, 28], [12, 32], [17, 33]], far: [[21, 27], [22, 31], [21, 33]] } }),
  ]);
  // wait: olha para fora (para quem assiste), tamborila os dedos, inclina a cabeça
  A('base_wait', 6, [
    SIT({ hx: 0, face: { eyes: 'open', mouth: 'flat', look: -1 }, arms: { far: [[21, 27], [25, 30], [27, 32]] } }),
    SIT({ hx: -1, face: { eyes: 'open', mouth: 'flat', look: -1 }, arms: { far: [[21, 27], [25, 30], [27, 30]] } }),
    SIT({ hx: -1, face: { eyes: 'closed', mouth: 'wavy', look: -1 }, arms: { far: [[21, 27], [25, 30], [27, 32]] } }),
    SIT({ hx: 0, face: { eyes: 'open', mouth: 'flat', look: -1 }, arms: { far: [[21, 27], [25, 30], [27, 30]] } }),
  ]);
  // done: braços para cima e pulo na cadeira (6 quadros)
  const up = (by, wave) => ({ near: [[11, 27 + by], [8, 22 + by], [7 + wave, 17 + by]], far: [[21, 27 + by], [25, 22 + by], [26 - wave, 17 + by]] });
  A('base_done', 10, [
    SIT({ face: { eyes: 'happy', mouth: 'smile' } }),
    SIT({ by: -1, face: { eyes: 'happy', mouth: 'big' }, arms: up(-1, 0) }),
    SIT({ by: -3, face: { eyes: 'happy', mouth: 'big' }, arms: up(-3, 1) }),
    SIT({ by: -4, face: { eyes: 'happy', mouth: 'big' }, arms: up(-4, 0) }),
    SIT({ by: -2, face: { eyes: 'happy', mouth: 'big' }, arms: up(-2, 1) }),
    SIT({ by: 0, face: { eyes: 'happy', mouth: 'open' }, arms: up(0, 0) }),
  ]);
  // error: mãos na cabeça, tremendo, suor
  const head = (by) => ({ near: [[11, 27 + by], [7, 22 + by], [8, 15 + by]], far: [[21, 27 + by], [25, 22 + by], [25, 14 + by]] });
  const sweat = (d) => (L) => { L.px(27, 9 + d, 'cyanLight'); L.px(27, 10 + d, 'cyan'); L.px(26, 10 + d, 'cyanLight'); L.px(28, 10 + d, 'cyan'); L.px(27, 11 + d, 'cyanDark'); };
  A('base_error', 6, [
    SIT({ hx: -1, face: { eyes: 'wide', mouth: 'frown' }, arms: head(0), post: sweat(0) }),
    SIT({ hx: 1, face: { eyes: 'wide', mouth: 'frown' }, arms: head(0), post: sweat(1) }),
    SIT({ hx: -1, by: 1, face: { eyes: 'dizzy', mouth: 'wavy' }, arms: head(1), post: sweat(2) }),
    SIT({ hx: 1, face: { eyes: 'wide', mouth: 'frown' }, arms: head(0), post: sweat(3) }),
  ]);
  // walk SE: pernas alternando, braços opostos, corpo sobe no passo
  const swingSE = (s) => ({ near: [[10, 27 + (s ? 0 : 0)], [9 + s, 31], [9 + 2 * s, 35]], far: [[22, 27], [23 - s, 31], [23 - 2 * s, 35]] });
  A('base_walk_se', 8, [
    STAND({ face: { eyes: 'open', mouth: 'smile' }, nf: [2, 1], ff: [-2, -1], arms: swingSE(-1) }),
    STAND({ by: -1, face: { eyes: 'open', mouth: 'smile' }, nf: [0, -1], ff: [0, 0], arms: swingSE(0) }),
    STAND({ face: { eyes: 'open', mouth: 'smile' }, nf: [-2, -1], ff: [2, 1], arms: swingSE(1) }),
    STAND({ by: -1, face: { eyes: 'closed', mouth: 'smile' }, nf: [0, 0], ff: [0, -1], arms: swingSE(0) }),
  ]);
  // walk NE (de costas)
  const swingNE = (s) => ({ near: [[22, 27], [23 + s, 31], [23 + 2 * s, 35]], far: [[10, 27], [9 - s, 31], [9 - 2 * s, 35]] });
  A('base_walk_ne', 8, [
    { mode: 'walk_ne', nf: [2, -1], ff: [-2, 1], arms: swingNE(-1) },
    { mode: 'walk_ne', by: -1, nf: [0, -1], ff: [0, 0], arms: swingNE(0) },
    { mode: 'walk_ne', nf: [-2, 1], ff: [2, -1], arms: swingNE(1) },
    { mode: 'walk_ne', by: -1, nf: [0, 0], ff: [0, -1], arms: swingNE(0) },
  ]);
  // stand: em pé respirando
  A('base_stand', 2, [
    STAND({ face: { eyes: 'open', mouth: 'smile' } }),
    STAND({ by: 1, face: { eyes: 'closed', mouth: 'smile' } }),
  ]);
  return anims;
}

// ---------------------------------------------------------------- trabalho por cargo
function workAnim(id, look) {
  const F = (p) => frame(look, p);
  // Mesa: borda de trás do tampo na linha y = 47 - x/2 (x=22 → 36, x=27 → 33,5). Mãos logo acima dela.
  const N = (x, y) => [[11, 27], [13, 33], [x, y]];       // braço de perto (mão em x,y)
  const R = (x, y, ex = 25, ey = 30) => [[21, 27], [ex, ey], [x, y]]; // braço de longe
  const rest = { near: N(22, 35), far: R(27, 32) };
  switch (id) {
    case 'orquestrador': { // carimba papéis e move cartões do kanban
      const paper = (L, mark) => { prop.paper(L, 22, 32, { w: 7, h: 2, lines: false }); if (mark) { L.px(24, 32, 'orange'); L.px(25, 32, 'orange'); } };
      const card = (L, x, y, a, b) => { for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 5; xx++) L.px(x + xx, y + yy, yy === 0 ? a : b); };
      return [
        SIT({ face: { eyes: 'down', mouth: 'flat', look: 1 }, arms: { near: N(22, 25), far: R(27, 32) }, pre: (L) => paper(L, false), post: (L) => prop.stamp(L, 21, 22) }),
        SIT({ by: 1, face: { eyes: 'closed', mouth: 'open', look: 1 }, arms: { near: N(22, 30), far: R(27, 32) }, pre: (L) => paper(L, false), post: (L) => { prop.stamp(L, 21, 27); L.px(19, 30, 'lamp'); L.px(18, 29, 'lamp'); L.px(26, 29, 'lamp'); L.px(27, 28, 'lamp'); } }),
        SIT({ face: { eyes: 'happy', mouth: 'smile', look: 1 }, arms: { near: N(22, 26), far: R(27, 32) }, pre: (L) => paper(L, true), post: (L) => prop.stamp(L, 21, 23) }),
        SIT({ hx: 1, face: { eyes: 'open', mouth: 'smile', look: 1 }, arms: { near: N(22, 35), far: R(28, 20, 26, 26) }, pre: (L) => paper(L, true), post: (L) => card(L, 27, 15, 'orange', 'orangeLight') }),
        SIT({ hx: 1, by: -1, face: { eyes: 'open', mouth: 'open', look: 1 }, arms: { near: N(22, 35), far: R(29, 16, 27, 23) }, pre: (L) => paper(L, true), post: (L) => card(L, 27, 11, 'green', 'greenLight') }),
        SIT({ face: { eyes: 'happy', mouth: 'smile', look: 1 }, arms: rest, pre: (L) => paper(L, true) }),
      ].map(F);
    }
    case 'roteirista': { // bate na máquina de escrever; papel amassado voa para o lixo
      const ball = [null, null, null, [25, 27], [29, 18], [31, 26]];
      return [0, 1, 2, 3, 4, 5].map((f) => F(SIT({
        hy: f < 3 ? f % 2 : 0, face: { eyes: f === 3 ? 'closed' : f >= 4 ? 'open' : 'down', mouth: f === 3 ? 'frown' : f >= 4 ? 'smile' : 'flat', look: 1 },
        arms: f === 3 ? { near: N(23, 28), far: R(26, 27) } : f >= 4 ? { near: N(22, 35), far: R(28, 26 - (f - 4) * 2) } : { near: N(22, 35 - (f % 2)), far: R(27, 31 + (f % 2)) },
        post: (L) => { if (ball[f]) prop.ball(L, ...ball[f]); },
      })));
    }
    case 'editor-video': { // fone, mão no mouse, cabeça no ritmo
      return [0, 1, 2, 3, 4, 5].map((f) => F(SIT({
        hy: f % 2, face: { eyes: f === 4 ? 'closed' : 'open', mouth: f % 2 ? 'smile' : 'flat', look: 1 },
        arms: { near: N(22, 35), far: R(27 + (f % 3 === 1 ? 1 : 0), 32) },
        post: (L) => prop.mouse(L, 27 + (f % 3 === 1 ? 1 : 0), 33),
      })));
    }
    case 'animador': { // desenha na mesa digitalizadora
      const path = [[25, 31], [27, 30], [28, 32], [26, 33], [24, 32], [26, 31]];
      return path.map(([x, y], f) => F(SIT({
        hy: 1, face: { eyes: 'down', mouth: f === 2 || f === 3 ? 'tongue' : 'flat', look: 1 },
        arms: { near: N(21, 35), far: R(x, y) },
        post: (L) => prop.stylus(L, x - 2, y + 1),
      })));
    }
    case 'programador': { // digita rápido
      return [0, 1, 2, 3].map((f) => F(SIT({
        hy: f === 2 ? 1 : 0, face: { eyes: 'open', mouth: f === 2 ? 'o' : 'flat', look: 1 },
        arms: { near: N(22 + (f % 2), 35 - (f % 2)), far: R(27 - (f % 2), 31 + (f % 2)) },
        post: (L) => { L.px(f % 2 ? 24 : 29, f % 2 ? 31 : 29, 'greenLight'); },
      })));
    }
    case 'desenvolvedor': { // testa o app no celular
      const scr = [['blue', 'blueLight'], ['pink', 'pinkLight'], ['green', 'greenLight'], ['orange', 'orangeLight']];
      return [0, 1, 2, 3, 4, 5].map((f) => F(SIT({
        hy: 1, face: { eyes: 'down', mouth: f === 3 ? 'smile' : f === 5 ? 'o' : 'flat', look: 1 },
        arms: { near: N(21, 30), far: R(26, 29, 25, 31) },
        post: (L) => { prop.phone(L, 21, 23, scr[Math.floor(f / 2) % 4]); L.px(23 + (f % 2), 26 + (f % 3), 'skin'); },
      })));
    }
    case 'designer': { // gira a roda de cores
      return [0, 1, 2, 3, 4, 5].map((f) => F(SIT({
        hx: f >= 3 ? 1 : 0, face: { eyes: f === 5 ? 'happy' : 'open', mouth: f % 2 ? 'smile' : 'open', look: 1 },
        arms: { near: N(23, 27 + (f % 2)), far: R(28, 24, 26, 28) },
        post: (L) => prop.wheel(L, 26, 20, f),
      })));
    }
    case 'revisor': { // olha com lupa e bate o carimbo
      const paper = (L, mark) => { prop.paper(L, 22, 32, { w: 7, h: 2, lines: false }); if (mark) { L.px(24, 32, 'red'); L.px(25, 32, 'red'); L.px(26, 32, 'red'); } };
      const lensPos = [[24, 28], [26, 29], [28, 28]];
      return [0, 1, 2, 3, 4, 5].map((f) => {
        if (f < 3) {
          const [lx, ly] = lensPos[f];
          return F(SIT({
            hy: 1, hx: f === 2 ? 1 : 0, face: { eyes: 'down', mouth: f === 1 ? 'o' : 'flat', look: 1 },
            arms: { near: N(22, 35), far: R(lx + 2, ly + 4) }, pre: (L) => paper(L, false),
            post: (L) => { prop.lens(L, lx, ly, 3); L.px(lx + 3, ly + 3, 'woodDark'); L.px(lx + 4, ly + 4, 'wood'); },
          }));
        }
        const sy = [22, 27, 23][f - 3];
        return F(SIT({
          by: f === 4 ? 1 : 0, face: { eyes: f === 4 ? 'closed' : 'happy', mouth: f === 4 ? 'open' : 'smile', look: 1 },
          arms: { near: N(22, sy + 3), far: R(27, 32) }, pre: (L) => paper(L, f === 5),
          post: (L) => { prop.stamp(L, 21, sy, 'red'); if (f === 4) { L.px(19, 30, 'lamp'); L.px(18, 29, 'lamp'); L.px(26, 29, 'lamp'); L.px(27, 28, 'lamp'); } },
        }));
      });
    }
    case 'visitante': { // em pé, consultando a prancheta e olhando em volta
      return [0, 1, 2, 3].map((f) => F(STAND({
        hx: f === 2 ? -1 : f === 3 ? 1 : 0, by: f % 2, face: { eyes: f === 1 ? 'closed' : 'open', mouth: f === 3 ? 'o' : 'smile', look: f === 2 ? -1 : 1 },
        arms: { near: [[10, 27], [12, 31], [17, 31]], far: [[22, 27], [24, 30], [22, 30]] },
        post: (L) => { for (let y = 0; y < 7; y++) for (let x = 0; x < 6; x++) L.px(17 + x, 27 + y + (f % 2), y === 0 ? 'woodDark' : x === 0 || x === 5 || y === 6 ? 'wood' : (y % 2 ? 'snow' : 'cyanLight')); },
      })));
    }
    case 'pesquisador': { // em pé, lendo um livro aberto e virando a página
      return [0, 1, 2, 3].map((f) => F(STAND({
        hy: 1, by: f === 2 ? 1 : 0, face: { eyes: 'down', mouth: f === 3 ? 'o' : 'flat', look: 1 },
        arms: { near: [[10, 27], [12, 32], [15, 33]], far: [[22, 27], [24, 31], [23, 33]] },
        post: (L) => {
          const y = 30 + (f === 2 ? 1 : 0);
          for (let x = 0; x < 11; x++) for (let yy = 0; yy < 6; yy++) L.px(13 + x, y + yy, yy === 5 || x === 0 || x === 10 ? 'woodDark' : x === 5 ? 'light' : 'snow');
          for (let x = 2; x < 9; x += 1) if (x !== 5) for (const yy of [1, 3]) L.px(13 + x, y + yy, 'silver');
          if (f === 1) for (let yy = 0; yy < 5; yy++) L.px(19 + Math.min(yy, 2), y - 1 + yy, 'snow');
        },
      })));
    }
    case 'locutor': { // em pé com o microfone, falando e gesticulando
      return [0, 1, 2, 3].map((f) => F(STAND({
        by: f % 2, face: { eyes: f === 2 ? 'closed' : 'open', mouth: f % 2 ? 'big' : 'open', look: 1 },
        arms: { near: [[10, 27], [13, 28], [18, 23]], far: f < 2 ? [[22, 27], [26, 24], [27, 19 + f]] : [[22, 27], [24, 31], [23, 34]] },
        post: (L) => { // microfone
          L.px(19, 19 + (f % 2), 'gray'); L.px(20, 19 + (f % 2), 'silver'); L.px(19, 20 + (f % 2), 'silver'); L.px(20, 20 + (f % 2), 'light');
          L.px(19, 21 + (f % 2), 'ink'); L.px(19, 22 + (f % 2), 'ink');
        },
      })));
    }
    case 'social-media': { // em pé tirando selfie com o celular (flash num quadro)
      const scr = [['pink', 'pinkLight'], ['cyan', 'cyanLight'], ['snow', 'snow'], ['orange', 'orangeLight']];
      return [0, 1, 2, 3].map((f) => F(STAND({
        hx: f === 1 ? 1 : 0, by: f === 3 ? 1 : 0, face: { eyes: f === 2 ? 'closed' : 'happy', mouth: f === 2 ? 'big' : 'smile', look: 1 },
        arms: { near: [[10, 27], [12, 32], [16, 33]], far: [[22, 27], [26, 22], [26, 17]] },
        post: (L) => { prop.phone(L, 24, 13, scr[f]); if (f === 2) { L.px(29, 12, 'lamp'); L.px(30, 11, 'snow'); L.px(29, 14, 'lamp'); } },
      })));
    }
  }
  throw new Error(`sem animação de trabalho para ${id}`);
}

export const WORK_FPS = 8;

/** Todas as animações de um personagem: [{ tag, fps, frames: Canvas[] }]. look = aparência (padrão: LOOKS[id]). */
export function characterAnims(id, look = LOOKS[id]) {
  if (!look) throw new Error(`sem visual para ${id}`);
  const work = { tag: `${id}_work`, fps: WORK_FPS, frames: workAnim(id, look) };
  const extra = STANDING.includes(id) && id !== 'visitante' ? [{ tag: 'visitante_work', fps: WORK_FPS, frames: work.frames }] : [];
  return [work, ...baseAnims(look), ...extra];
}
