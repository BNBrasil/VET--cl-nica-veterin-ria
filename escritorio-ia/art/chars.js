// Personagens 16x32 (vista 3/4), sentados em cadeira atrás da mesa.
// Camadas separadas: cadeira -> corpo (pernas, tronco, braços) -> cabeça (cabelo + rosto + acessório) -> objeto da função.
// A mesa NÃO faz parte do sprite: ela está no fundo da sala, com o tampo nas linhas 23..26 do sprite
// (seat.y-9 .. seat.y-6) e a borda na linha 27; por baixo dela aparecem as canelas e os sapatos.
import { Canvas } from './draw.js';

export const CW = 16, CH = 32;
const HX = 3;            // x da cabeça (10 px de largura)
const SEAT_HEAD_Y = 6;   // cabeça sentada: linhas 6..15
const STAND_HEAD_Y = 3;  // cabeça em pé: linhas 3..12

// ---------------------------------------------------------------- visuais por cargo
const SKINS = {
  light: { s: 'skin', S: 'skinMid', m: 'skinDark' },
  mid: { s: 'skinMid', S: 'skinDark', m: 'wood' },
  dark: { s: 'skinDark', S: 'wood', m: 'woodDark' },
};
const HAIRS = {
  black: { h: 'ink', H: 'outline' },
  darkBrown: { h: 'woodDark', H: 'outline' },
  brown: { h: 'wood', H: 'woodDark' },
  ginger: { h: 'ginger', H: 'wood' },
  blonde: { h: 'blonde', H: 'tan' },
  gray: { h: 'light', H: 'silver' },
};

export const LOOKS = {
  orquestrador: { skin: 'light', hair: 'darkBrown', style: 'short', cloth: ['slate', 'navy'], a: 'white', t: 'orange', pants: 'navy', shoes: 'woodDark', chair: ['orangeDark', 'orange'], acc: null },
  roteirista: { skin: 'light', hair: 'ginger', style: 'long', cloth: ['yellow', 'yellowDark'], a: 'cream', t: 'yellowDark', pants: 'wood', shoes: 'woodDark', chair: ['yellowDark', 'yellow'], acc: null },
  'editor-video': { skin: 'mid', hair: 'black', style: 'short', cloth: ['purple', 'purpleDark'], a: 'neon', t: 'purpleDark', pants: 'ink', shoes: 'shadow', chair: ['purpleDark', 'purple'], acc: 'headphones', accColors: ['ink', 'neon'] },
  animador: { skin: 'light', hair: 'blonde', style: 'bun', cloth: ['cyan', 'cyanDark'], a: 'white', t: 'cyan', pants: 'slate', shoes: 'woodDark', chair: ['cyanDark', 'cyan'], acc: null },
  programador: { skin: 'dark', hair: 'black', style: 'short', cloth: ['green', 'greenDark'], a: 'greenLight', t: 'greenDark', pants: 'navy', shoes: 'shadow', chair: ['greenDark', 'green'], acc: 'beanie', accColors: ['gray', 'shadow'] },
  desenvolvedor: { skin: 'mid', hair: 'brown', style: 'short', cloth: ['blue', 'blueDark'], a: 'white', t: 'blueDark', pants: 'slate', shoes: 'white', chair: ['blueDark', 'blue'], acc: 'cap', accColors: ['orange', 'orangeDark'] },
  designer: { skin: 'dark', hair: 'black', style: 'bob', cloth: ['pink', 'pinkDark'], a: 'pinkLight', t: 'pinkDark', pants: 'ink', shoes: 'pinkDark', chair: ['pinkDark', 'pink'], acc: 'beret', accColors: ['yellow', 'yellowDark'] },
  revisor: { skin: 'light', hair: 'gray', style: 'bald', cloth: ['red', 'redDark'], a: 'white', t: 'redDark', pants: 'shadow', shoes: 'woodDark', chair: ['redDark', 'red'], acc: 'glasses', accColors: ['outline', 'cyanLight'] },
  visitante: { skin: 'mid', hair: 'brown', style: 'short', cloth: ['silver', 'gray'], a: 'white', t: 'teal', pants: 'slate', shoes: 'woodDark', chair: ['shadow', 'gray'], acc: 'badge' },
};

function colorMap(look) {
  const sk = SKINS[look.skin], hr = HAIRS[look.hair];
  const [ac1, ac2] = look.accColors || ['ink', 'gray'];
  return {
    o: 'outline', e: 'outline', w: 'white', g: 'gray', G: 'silver', d: 'shadow', r: 'red', R: 'redDark', y: 'lamp',
    s: sk.s, S: sk.S, m: sk.m, h: hr.h, H: hr.H,
    c: look.cloth[0], C: look.cloth[1], a: look.a, t: look.t,
    p: look.pants, P: 'outline', k: look.shoes,
    x: look.chair[0], X: look.chair[1],
    q: ac1, A: ac1, B: ac2,
  };
}

// ---------------------------------------------------------------- cabeças (10 px de largura)
const HEAD_FRONT = {
  short: [
    '..oooooo..',
    '.ohhhhhho.',
    'ohhhhhhhHo',
    'ohhhhhhhHo',
    'ohhssssshо'.replace('о', 'o'),
    'ossessesso',
    'ossessesso',
    'oSssssssSo',
    '.oSsmmsSo.',
    '..oooooo..',
  ],
  long: [
    '..oooooo..',
    '.ohhhhhho.',
    'ohhhhhhhho',
    'ohhhhhhhHo',
    'ohhsssshHo',
    'ohsessesHo',
    'ohsessesHo',
    'ohSssssSHo',
    'ohoSmmSoHo',
    'ohhoooohHo',
    'ohho..ohHo',
    'ohho..ohHo',
    '.oo....oo.',
  ],
  bob: [
    '..oooooo..',
    '.ohhhhhho.',
    'ohhhhhhhho',
    'ohhhhhhhHo',
    'ohhhhhhhHo',
    'ohsessesHo',
    'ohsessesHo',
    'ohSssssSHo',
    'ohoSmmSoHo',
    'ohhoooohHo',
    '.oo....oo.',
  ],
  bun: [
    '..oooooo..',
    '.ohhhhhho.',
    'ohhhhhhhHo',
    'ohhhhhhhHo',
    'ohssssshHo',
    'ossessesso',
    'ossessesso',
    'oSssssssSo',
    '.oSsmmsSo.',
    '..oooooo..',
  ],
  bald: [
    '..oooooo..',
    '.osssssso.',
    'osssssssSo',
    'ohssssssHo',
    'ohssssssHo',
    'ohsessesHo',
    'ohsessesHo',
    'oSssssssSo',
    '.oSsmmsSo.',
    '..oooooo..',
  ],
};
const BUN_TOP = { rows: ['...oooo...', '..ohhhHo..', '..ohhhHo..'], ox: 0, oy: -3 };

const HEAD_BACK = {
  short: ['..oooooo..', '.ohhhhhho.', 'ohhhhhhhHo', 'ohhhhhhhHo', 'ohhhhhhhHo', 'ohhhhhhhHo', 'ohhhhhhhHo', 'oShhhhhHSo', '.oShhhHSo.', '..oooooo..'],
  long: ['..oooooo..', '.ohhhhhho.', 'ohhhhhhhHo', 'ohhhhhhhHo', 'ohhhhhhhHo', 'ohhhhhhhHo', 'ohhhhhhhHo', 'ohhhhhhhHo', 'ohhhhhhhHo', 'ohhhhhhhHo', 'ohhhhhhhHo', '.ohhhhhHo.', '..oooooo..'],
  bob: ['..oooooo..', '.ohhhhhho.', 'ohhhhhhhHo', 'ohhhhhhhHo', 'ohhhhhhhHo', 'ohhhhhhhHo', 'ohhhhhhhHo', 'ohhhhhhhHo', 'ohhhhhhhHo', 'ohHHHHHHHo', '.oooooooo.'],
  bun: ['..oooooo..', '.ohhhhhho.', 'ohhhhhhhHo', 'ohhhhhhhHo', 'ohhhhhhhHo', 'ohhhhhhhHo', 'ohhhhhhhHo', 'oShhhhhHSo', '.oShhhHSo.', '..oooooo..'],
  bald: ['..oooooo..', '.osssssso.', 'osssssssSo', 'osssssssSo', 'ohhhhhhhHo', 'ohhhhhhhHo', 'ohhhhhhhHo', 'oShhhhhHSo', '.oSSSSSSo.', '..oooooo..'],
};

// perfil olhando para a esquerda (direita = espelho)
const HEAD_SIDE = {
  short: ['..oooooo..', '.ohhhhhho.', 'ohhhhhhhHo', 'ohhhhhhhHo', 'osshhhhhHo', 'oessShhhHo', 'oessSShhHo', 'osssssshHo', '.omssssHo.', '..ooooo...'],
  long: ['..oooooo..', '.ohhhhhho.', 'ohhhhhhhHo', 'ohhhhhhhHo', 'osshhhhhHo', 'oessShhhHo', 'oessShhhHo', 'osssshhhHo', '.omsshhhHo', '..oohhhhHo', '...ohhhhHo', '...ohhhHo.', '....oooo..'],
  bob: ['..oooooo..', '.ohhhhhho.', 'ohhhhhhhHo', 'ohhhhhhhHo', 'osshhhhhHo', 'oessShhhHo', 'oessShhhHo', 'osssshhhHo', '.omsshhhHo', '..oohhhHo.', '....oooo..'],
  bun: ['..oooooo..', '.ohhhhhho.', 'ohhhhhhhHo', 'ohhhhhhhHo', 'osshhhhhHo', 'oessShhhHo', 'oessSShhHo', 'osssssshHo', '.omssssHo.', '..ooooo...'],
  bald: ['..oooooo..', '.osssssso.', 'osssssssSo', 'osssssssSo', 'ossshhhhHo', 'oessShhhHo', 'oessSShhHo', 'osssssshHo', '.omssssHo.', '..ooooo...'],
};
const BUN_SIDE = { rows: ['......ooo.', '.....ohhHo', '.....ohhHo', '......ooo.'], ox: 1, oy: -1 };

// acessórios por vista: { rows, ox, oy } relativos à origem da cabeça
const ACC = {
  headphones: {
    front: { ox: -1, oy: -1, rows: ['...oooooo...', '..oqqqqqqo..', '.oqo....oqo.', 'oqo......oqo', 'oBBo....oBBo', 'oBBo....oBBo', 'oBBo....oBBo', '.oo......oo.'] },
    back: { ox: -1, oy: -1, rows: ['...oooooo...', '..oqqqqqqo..', '.oqo....oqo.', 'oqo......oqo', 'oBBo....oBBo', 'oBBo....oBBo', 'oBBo....oBBo', '.oo......oo.'] },
    side: { ox: 0, oy: -1, rows: ['...oooooo.', '..oqqqqqqo', '...o..oqo.', '......oqo.', '.....oBBo.', '.....oBBo.', '.....oBBo.', '......oo..'] },
  },
  beanie: {
    front: { ox: 0, oy: -3, rows: ['....oo....', '...oAAo...', '.ooooooo o'.replace(' ', 'o'), 'oAAAAAAAAo', 'oBABABABAo', 'oooooooooo'] },
    back: { ox: 0, oy: -3, rows: ['....oo....', '...oAAo...', '.oooooooo.', 'oAAAAAAAAo', 'oBABABABAo', 'oooooooooo'] },
    side: { ox: 0, oy: -3, rows: ['.....oo...', '....oAAo..', '.oooooooo.', 'oAAAAAAAAo', 'oBABABABAo', 'oooooooooo'] },
  },
  cap: {
    front: { ox: 0, oy: -1, rows: ['..oooooo..', '.oAAAAAAo.', 'oAAAAAAAAo', 'oBBBBBBBBo', 'oooooooooo'] },
    back: { ox: 0, oy: -1, rows: ['..oooooo..', '.oAAAAAAo.', 'oAAAAAAAAo', 'oBBBBBBBBo', 'oooBBBBooo', '...oooo...'] },
    side: { ox: 0, oy: -1, rows: ['..oooooo...', '.oAAAAAAo..', 'oAAAAAAAAo.', 'oBBBBBBBBBo', 'ooooooooBBo', '........oo.'] },
  },
  beret: {
    front: { ox: -1, oy: -3, rows: ['......o.....', '..ooooAoo...', '.oAAAAAAAAo.', 'oAAAAAAAAAAo', '.oBBBBBBBBo.', '..oooooooo..'] },
    back: { ox: -1, oy: -3, rows: ['......o.....', '..ooooAoo...', '.oAAAAAAAAo.', 'oAAAAAAAAAAo', '.oBBBBBBBBo.', '..oooooooo..'] },
    side: { ox: -1, oy: -3, rows: ['.....o......', '..ooooAoo...', '.oAAAAAAAAo.', 'oAAAAAAAAAAo', '.oBBBBBBBBo.', '..oooooooo..'] },
  },
  glasses: {
    front: { ox: 0, oy: 5, rows: ['.oooooooo.', '..oBooBo..'] },
    back: null,
    side: { ox: 0, oy: 5, rows: ['oooo......', '.Bo.......'] },
  },
  badge: null,
};

// rostos (sobre a cabeça de frente): limpa olhos (linhas 5-6, col 2..7) e boca (linha 8, col 3..6)
const FACES = {
  open: { eyes: [[3, 5], [3, 6], [6, 5], [6, 6]], mouth: [[4, 8], [5, 8]], mouthColor: 'm' },
  blink: { eyes: [[2, 6], [3, 6], [6, 6], [7, 6]], mouth: [[4, 8], [5, 8]], mouthColor: 'm' },
  down: { eyes: [[3, 6], [6, 6]], mouth: [[4, 8], [5, 8]], mouthColor: 'm' },
  right: { eyes: [[4, 5], [4, 6], [7, 5], [7, 6]], mouth: [[5, 8]], mouthColor: 'm' },
  up: { eyes: [[3, 5], [6, 5]], mouth: [[4, 8], [5, 8]], mouthColor: 'm' },
  closed: { eyes: [[2, 6], [3, 6], [6, 6], [7, 6]], mouth: [[4, 8], [5, 8]], mouthColor: 'm' },
  snore: { eyes: [[2, 6], [3, 6], [6, 6], [7, 6]], mouth: [[4, 8], [5, 8]], mouthColor: 'o' },
  happy: { eyes: [[2, 6], [3, 5], [4, 6], [5, 6], [6, 5], [7, 6]], mouth: [[3, 8], [4, 8], [5, 8], [6, 8]], mouthColor: 'o' },
  worried: { eyes: [[3, 5], [3, 6], [6, 5], [6, 6], [2, 4], [7, 4]], mouth: [[4, 8]], mouthColor: 'o' },
  focus: { eyes: [[3, 6], [6, 6], [2, 5], [3, 5], [6, 5], [7, 5]], mouth: [[4, 8], [5, 8]], mouthColor: 'm' },
};

function drawHead(c, look, M, x, y, view = 'front', face = 'open') {
  const st = look.style;
  if (view === 'front') {
    if (st === 'bun') c.tpl(BUN_TOP.rows, M, x + BUN_TOP.ox, y + BUN_TOP.oy);
    c.tpl(HEAD_FRONT[st], M, x, y);
    const f = FACES[face];
    // limpa a zona do rosto e desenha olhos/boca
    for (let yy = 5; yy <= 6; yy++) for (let xx = 2; xx <= 7; xx++) c.px(x + xx, y + yy, M.s);
    for (let xx = 3; xx <= 6; xx++) c.px(x + xx, y + 8, M.s);
    if (st === 'short' || st === 'bun') { c.px(x + 3, y + 8, M.S); c.px(x + 6, y + 8, M.S); }
    for (const [ex, ey] of f.eyes) c.px(x + ex, y + ey, ey === 4 ? M.H : M.e);
    for (const [mx, my] of f.mouth) c.px(x + mx, y + my, M[f.mouthColor]);
  } else if (view === 'back') {
    if (st === 'bun') c.tpl(BUN_TOP.rows, M, x + BUN_TOP.ox, y + BUN_TOP.oy);
    c.tpl(HEAD_BACK[st], M, x, y);
  } else {
    if (st === 'bun') c.tpl(BUN_SIDE.rows, M, x + BUN_SIDE.ox, y + BUN_SIDE.oy);
    c.tpl(HEAD_SIDE[st], M, x, y);
  }
  const acc = look.acc && ACC[look.acc] && ACC[look.acc][view];
  if (acc) c.tpl(acc.rows, M, x + acc.ox, y + acc.oy);
}

// ---------------------------------------------------------------- tronco / braços
const TORSO_SEATED = [
  '....occaacco....',
  '...occcaaccco...',
  '..occccttcccco..',
  '..oCcCcttcCcCo..',
  '..oCcCcttcCcCo..',
  '..oCcCcttcCcCo..',
  '..oCcCCCCCCcCo..',
]; // linhas 16..22
const TORSO_NOARMS = [
  '....occaacco....',
  '...occcaaccco...',
  '...occcttccco...',
  '...oCccttccCo...',
  '...oCccttccCo...',
  '...oCccttccCo...',
  '...oCCCCCCCCo...',
];

function hand(c, M, x, y) {
  c.px(x, y, M.s); c.px(x + 1, y, M.s);
  c.px(x - 1, y, M.o); c.px(x + 2, y, M.o); c.px(x, y + 1, M.o); c.px(x + 1, y + 1, M.o);
}
/** antebraço curto (manga) ligando o ombro à mão na mesa */
function forearm(c, M, x, y) { c.px(x, y, M.c); c.px(x + 1, y, M.C); }

function badge(c, look, M, y0) {
  if (look.acc !== 'badge') return;
  c.px(7, y0 + 2, M.t); c.px(8, y0 + 2, M.t); c.rect(7, y0 + 3, 2, 2, 'white'); c.px(8, y0 + 4, 'teal');
}

// ---------------------------------------------------------------- camadas: cadeira e pernas
function chairBack(c, M, top = 11) {
  c.rect(2, top, 12, 23 - top, M.x);
  c.hline(2, 13, top, M.o); c.vline(2, top, 22, M.o); c.vline(13, top, 22, M.o);
  c.hline(3, 12, top + 1, M.X);
}
function chairBase(c, M) {
  c.px(3, 30, M.x); c.px(12, 30, M.x);
  c.hline(2, 3, 31, M.o); c.hline(12, 13, 31, M.o);
}
function seatedLegs(c, M, { tapRight = 0, tapLeft = 0 } = {}) {
  const leg = (x, lift) => {
    c.vline(x - 1, 28, 29 - lift, M.o); c.vline(x + 2, 28, 29 - lift, M.o);
    c.rect(x, 28, 2, 2 - lift, M.p);
    c.rect(x - 1, 30 - lift, 4, 1, M.k);
    c.hline(x - 1, x + 2, 31 - lift, M.o);
    c.px(x - 2, 30 - lift, M.o);
  };
  leg(5, tapLeft);
  leg(9, tapRight);
}

// ---------------------------------------------------------------- pose sentada genérica
/**
 * opts: headDy, headDx, face, arms ('rest'|'type'|'none'|'up'|'mid'|'lap'), handsL/handsR override [x,y],
 *       tapRight, bodyDy, view
 */
function seated(look, opts = {}) {
  const M = colorMap(look);
  const c = new Canvas(CW, CH);
  const bodyDy = opts.bodyDy || 0;
  chairBack(c, M);
  chairBase(c, M);
  seatedLegs(c, M, opts);
  const arms = opts.arms || 'rest';
  c.tpl(arms === 'up' || arms === 'mid' ? TORSO_NOARMS : TORSO_SEATED, M, 0, 16 + bodyDy);
  badge(c, look, M, 16 + bodyDy);
  // cabeça
  drawHead(c, look, M, HX + (opts.headDx || 0), SEAT_HEAD_Y + bodyDy + (opts.headDy || 0), opts.view || 'front', opts.face || 'open');
  // braços / mãos
  const L = opts.handsL, R = opts.handsR;
  if (arms === 'rest') { hand(c, M, L ? L[0] : 3, L ? L[1] : 23); hand(c, M, R ? R[0] : 11, R ? R[1] : 23); }
  if (arms === 'type') {
    const ly = L ? L[1] : 23, ry = R ? R[1] : 23, lx = L ? L[0] : 5, rx = R ? R[0] : 9;
    forearm(c, M, 4, 22); forearm(c, M, 10, 22);
    hand(c, M, lx, ly); hand(c, M, rx, ry);
  }
  if (arms === 'up' || arms === 'mid') {
    const top = arms === 'up' ? 3 : 9;
    const by = 17 + bodyDy;
    for (const side of [0, 1]) {
      const ax = side ? 12 : 2;
      for (let y = top + 2; y <= by; y++) { c.px(ax, y, M.c); c.px(ax + (side ? 1 : -1) * 0, y, M.c); c.px(ax + (side ? -1 : 1), y, M.C); c.px(ax + (side ? 1 : -1), y, M.o); }
      c.px(ax, top + 1, M.o);
      hand(c, M, side ? 12 : 1, top);
    }
  }
  return { c, M };
}

// ---------------------------------------------------------------- animações base (sentado)
export function baseIdle(look) {
  return [
    seated(look, { face: 'open' }).c,
    seated(look, { face: 'blink', headDy: 1 }).c,
  ];
}

function paper(c, x, y, w = 6, h = 5, fold = false) {
  c.rect(x, y, w, h, 'white');
  c.frame(x - 1, y - 1, w + 2, h + 2, 'outline');
  for (let yy = y + 1; yy < y + h - 1; yy += 2) c.hline(x + 1, x + w - 2, yy, 'light');
  if (fold) { c.px(x + w - 1, y, 'light'); c.px(x + w - 1, y - 1, null); c.px(x + w, y, 'outline'); }
}

export function baseRead(look) {
  const frames = [];
  for (let i = 0; i < 4; i++) {
    const { c, M } = seated(look, { face: i === 2 ? 'blink' : 'down', arms: 'none', headDy: i === 1 ? 1 : 0 });
    const py = 19 + (i === 3 ? -1 : 0);
    paper(c, 5, py, 6, 6, i === 2);
    if (i === 1) c.hline(6, 9, py + 3, 'gray');
    hand(c, M, 3, py + 4); hand(c, M, 11, py + 4);
    frames.push(c);
  }
  return frames;
}

export function baseDoze(look) {
  return [
    seated(look, { face: 'down' }).c,
    seated(look, { face: 'closed', headDy: 1 }).c,
    seated(look, { face: 'closed', headDy: 3 }).c,
    seated(look, { face: 'open', headDy: -1 }).c,
  ];
}

export function baseSleep(look) {
  // cabeça para trás, encostada na cadeira; boca abre e fecha
  const frames = [];
  const seq = [['closed', 0], ['snore', 0], ['snore', 1], ['closed', 1]];
  for (const [face, dy] of seq) {
    const { c, M } = seated(look, { face, headDy: -2 + dy, headDx: 0, arms: 'rest', handsL: [4, 24], handsR: [10, 24] });
    // pescoço aparente (cabeça inclinada para trás)
    c.px(7, 14 + dy, M.S); c.px(8, 14 + dy, M.S);
    frames.push(c);
  }
  return frames;
}

export function baseWait(look) {
  return [
    seated(look, { face: 'up', arms: 'rest' }).c,
    seated(look, { face: 'up', arms: 'rest', tapRight: 1, handsR: [11, 22] }).c,
  ];
}

export function baseDone(look) {
  return [
    seated(look, { face: 'happy', arms: 'up', bodyDy: -1 }).c,
    seated(look, { face: 'happy', arms: 'mid' }).c,
    seated(look, { face: 'happy', arms: 'up', bodyDy: -1 }).c,
    seated(look, { face: 'open', arms: 'mid' }).c,
  ];
}

function sweat(c, x, y) {
  c.px(x, y, 'cyanLight'); c.px(x, y + 1, 'cyan'); c.px(x - 1, y + 1, 'cyanLight'); c.px(x, y + 2, 'cyanDark');
  c.px(x + 1, y + 1, 'cyanDark');
}
export function baseError(look) {
  const frames = [];
  for (let i = 0; i < 3; i++) {
    const { c, M } = seated(look, { face: 'worried', arms: 'none', headDx: i === 1 ? 1 : 0 });
    // mãos na cabeça
    hand(c, M, 1, 14); hand(c, M, 13, 14);
    c.px(2, 16, M.c); c.px(13, 16, M.c); c.px(2, 17, M.c); c.px(13, 17, M.c);
    sweat(c, 13, 5 + i * 2);
    frames.push(c);
  }
  return frames;
}

// ---------------------------------------------------------------- em pé / andando
const TORSO_STAND_FRONT = [
  '....occaacco....',
  '...occcaaccco...',
  '..occccttcccco..',
  '..oCcCcttcCcCo..',
  '..oCcCcttcCcCo..',
  '..oCcCcttcCcCo..',
  '..oCcoCCCCocCo..',
  '..osso....osso..',
  '...oo......oo...',
]; // linhas 13..21
const TORSO_STAND_BACK = TORSO_STAND_FRONT.map((r) => r.replace(/a/g, 'c').replace(/t/g, 'c'));
const TORSO_STAND_SIDE = [
  '.....occco......',
  '....occccco.....',
  '....occccCo.....',
  '....oCcccCo.....',
  '....oCcccCo.....',
  '....oCcccCo.....',
  '....oCCCCCo.....',
]; // linhas 13..19

function standLegsFront(c, M, liftL, liftR) {
  // quadril
  c.rect(5, 20, 6, 2, M.p); c.vline(4, 20, 21, M.o); c.vline(11, 20, 21, M.o);
  const leg = (x, lift) => {
    const bottom = 31 - lift;
    c.vline(x - 1, 22, bottom - 3, M.o); c.vline(x + 2, 22, bottom - 3, M.o);
    c.rect(x, 22, 2, bottom - 3 - 22 + 1, M.p);
    c.px(x + 1, bottom - 3, M.P);
    c.rect(x - 1, bottom - 2, 4, 2, M.k); c.px(x - 2, bottom - 1, M.o); c.px(x - 2, bottom - 2, M.o); c.px(x + 3, bottom - 2, M.o); c.px(x + 3, bottom - 1, M.o);
    c.hline(x - 1, x + 2, bottom, M.o);
  };
  leg(5, liftL); leg(9, liftR);
}

function walkFront(look, view) {
  const M = colorMap(look);
  const seq = [[0, 0, 0], [1, 0, -1], [0, 0, 0], [0, 1, -1]];
  return seq.map(([lL, lR, bob], i) => {
    const c = new Canvas(CW, CH);
    standLegsFront(c, M, lL * 2, lR * 2);
    const tor = view === 'front' ? TORSO_STAND_FRONT : TORSO_STAND_BACK;
    c.tpl(tor, M, 0, 13 + bob);
    if (view === 'front') badge(c, look, M, 13 + bob);
    // braços balançando
    if (i === 1) { c.px(3, 20 + bob, M.c); c.px(12, 19 + bob, M.c); }
    if (i === 3) { c.px(12, 20 + bob, M.c); c.px(3, 19 + bob, M.c); }
    drawHead(c, look, M, HX, STAND_HEAD_Y + bob, view, 'open');
    return c;
  });
}

function walkSide(look) {
  // olhando para a esquerda
  const M = colorMap(look);
  const poses = [
    { back: [9, 0], front: [6, 0], bob: 0, arm: 0 },
    { back: [10, 0], front: [5, 0], bob: -1, arm: 1 },
    { back: [8, 0], front: [7, 0], bob: 0, arm: 0 },
    { back: [5, 0], front: [10, 0], bob: -1, arm: -1 },
  ];
  return poses.map((p) => {
    const c = new Canvas(CW, CH);
    const legSide = (lx, color) => {
      // perna de 2px do quadril (y20) até o pé (y29..31)
      for (let y = 20; y <= 28; y++) {
        const t = (y - 20) / 8;
        const x = Math.round(7 + (lx - 7) * t);
        c.px(x - 1, y, M.o); c.px(x, y, color); c.px(x + 1, y, color); c.px(x + 2, y, M.o);
      }
      const fx = lx;
      c.rect(fx - 2, 29, 4, 2, M.k); c.px(fx - 3, 30, M.o); c.px(fx - 3, 29, M.o); c.hline(fx - 2, fx + 1, 28, M.o); c.px(fx + 2, 29, M.o); c.px(fx + 2, 30, M.o);
      c.hline(fx - 2, fx + 1, 31, M.o);
    };
    legSide(p.back[0], M.P === 'outline' ? 'shadow' : M.P);
    legSide(p.front[0], M.p);
    c.rect(6, 19 + p.bob, 5, 2, M.p);
    c.tpl(TORSO_STAND_SIDE, M, 0, 13 + p.bob);
    // braço (frente do corpo)
    const ax = 7 + p.arm;
    for (let y = 15 + p.bob; y <= 18 + p.bob; y++) { c.px(ax, y, M.C); c.px(ax + 1, y, M.c); }
    c.px(ax + p.arm, 19 + p.bob, M.s); c.px(ax + 1 + p.arm, 19 + p.bob, M.s); c.hline(ax + p.arm, ax + 1 + p.arm, 20 + p.bob, M.o);
    drawHead(c, look, M, HX, STAND_HEAD_Y + p.bob, 'side', 'open');
    return c;
  });
}

// ---------------------------------------------------------------- objetos de trabalho (camada "função")
const WORK = {
  // carimba papéis
  orquestrador(look) {
    const frames = [];
    const stampY = [16, 18, 21, 17];
    for (let i = 0; i < 4; i++) {
      const { c, M } = seated(look, { face: i === 2 ? 'blink' : 'down', arms: 'none' });
      paper(c, 4, 24, 7, 2);
      if (i === 3 || i === 0) { c.px(8, 24, 'red'); c.px(9, 24, 'red'); c.px(8, 25, 'red'); }
      hand(c, M, 2, 23); // mão esquerda segura o papel
      const sy = stampY[i];
      // carimbo: cabo de madeira + base laranja
      c.rect(9, sy - 2, 2, 2, 'woodLight'); c.frame(8, sy - 3, 4, 4, 'outline'); c.rect(9, sy - 2, 2, 2, 'woodLight');
      c.rect(8, sy + 1, 4, 1, 'orange'); c.hline(7, 12, sy + 2, 'outline'); c.px(7, sy + 1, 'outline'); c.px(12, sy + 1, 'outline');
      hand(c, M, 11, sy - 1);
      for (let y = sy + 1; y <= 22; y++) { c.px(12, y, M.c); c.px(13, y, M.o); }
      if (i === 2) { c.px(6, 21, 'white'); c.px(13, 22, 'white'); c.px(5, 23, 'lamp'); }
      frames.push(c);
    }
    return frames;
  },
  // máquina de escrever + papel amassado voando
  roteirista(look) {
    const frames = [];
    const ballPath = [null, null, null, [12, 14], [14, 11], [15, 15]];
    for (let i = 0; i < 6; i++) {
      const { c, M } = seated(look, { face: 'down', arms: 'none' });
      // papel saindo da máquina
      c.rect(5, 18 - (i % 3 === 2 ? 1 : 0), 6, 4, 'white'); c.frame(4, 17 - (i % 3 === 2 ? 1 : 0), 8, 5, 'outline');
      c.hline(6, 9, 19, 'gray');
      // máquina
      c.rect(3, 21, 10, 5, 'ink'); c.frame(2, 20, 12, 7, 'outline');
      c.hline(3, 12, 21, 'shadow'); c.hline(4, 11, 23, 'gray'); c.hline(4, 11, 24, 'silver');
      for (let k = 4; k <= 11; k += 2) c.px(k, 24, 'white');
      c.px(i % 2 ? 12 : 3, 22, 'yellow');
      // mãos alternando
      const up = i % 2;
      hand(c, M, 4, 22 + up); hand(c, M, 10, 23 - up);
      const b = ballPath[i];
      if (b) { c.rect(b[0] - 1, b[1] - 1, 3, 3, 'white'); c.px(b[0], b[1], 'light'); c.px(b[0] - 1, b[1] - 1, 'light'); c.frame(b[0] - 2, b[1] - 2, 5, 5, null); }
      frames.push(c);
    }
    // contorno das bolinhas de papel
    frames.forEach((c, i) => { const b = ballPath[i]; if (b) { for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -1], [2, 1], [-1, 2], [1, -2]]) if (c.get(b[0] + dx, b[1] + dy) < 0) c.px(b[0] + dx, b[1] + dy, 'outline'); } });
    return frames;
  },
  // fone no ouvido, mão no mouse
  'editor-video'(look) {
    const frames = [];
    for (let i = 0; i < 4; i++) {
      const { c, M } = seated(look, { face: 'right', arms: 'none', headDy: i % 2 });
      // teclado
      c.rect(3, 24, 6, 2, 'gray'); c.frame(2, 23, 8, 4, 'outline'); c.hline(3, 8, 24, 'silver');
      hand(c, M, 4, 23);
      // mouse
      const mx = 11 + (i === 1 ? 1 : i === 3 ? -1 : 0);
      c.rect(mx, 24, 2, 2, 'light'); c.frame(mx - 1, 23, 4, 4, 'outline'); c.px(mx, 24, 'neon');
      hand(c, M, mx, 23 - (i === 2 ? 1 : 0));
      c.px(12, 22, M.c);
      // notas musicais saindo do fone
      if (i === 1 || i === 2) { c.px(1, 6 - i, 'neon'); c.px(1, 7 - i, 'neon'); c.px(0, 8 - i, 'neon'); }
      frames.push(c);
    }
    return frames;
  },
  // desenha na mesa digitalizadora
  animador(look) {
    const frames = [];
    const strokes = [[5, 25], [6, 24], [7, 25], [8, 24], [9, 25]];
    for (let i = 0; i < 5; i++) {
      const { c, M } = seated(look, { face: 'down', arms: 'none' });
      c.rect(3, 23, 9, 3, 'slate'); c.frame(2, 22, 11, 5, 'outline'); c.hline(3, 11, 23, 'navy');
      for (let k = 0; k <= i; k++) c.px(strokes[k][0], strokes[k][1], 'cyanLight');
      hand(c, M, 3, 23);
      const [sx, sy] = strokes[i];
      // caneta
      c.px(sx, sy - 1, 'outline'); c.px(sx + 1, sy - 2, 'white'); c.px(sx + 2, sy - 3, 'white');
      hand(c, M, sx + 2, sy - 2);
      c.px(sx + 3, sy - 3, M.c); c.px(12, 21, M.c);
      if (i % 2) c.px(1, 12, 'cyan');
      frames.push(c);
    }
    return frames;
  },
  // digita rápido
  programador(look) {
    const frames = [];
    const seq = [[22, 23], [23, 22], [22, 22], [23, 23]];
    for (let i = 0; i < 4; i++) {
      const { c, M } = seated(look, { face: 'focus', arms: 'none' });
      c.rect(3, 24, 10, 2, 'shadow'); c.frame(2, 23, 12, 4, 'outline');
      for (let k = 3; k <= 12; k++) c.px(k, 24, (k + i) % 3 ? 'gray' : 'greenLight');
      hand(c, M, 4, seq[i][0] + 1); hand(c, M, 10, seq[i][1] + 1);
      // reflexo verde do monitor no rosto
      c.px(4, 12, 'green');
      frames.push(c);
    }
    return frames;
  },
  // testa app no celular
  desenvolvedor(look) {
    const frames = [];
    const screens = [['blueLight', 'blue'], ['white', 'blueLight'], ['blueLight', 'orange'], ['white', 'blue']];
    for (let i = 0; i < 4; i++) {
      const { c, M } = seated(look, { face: 'down', arms: 'none' });
      // celular segurado à frente do peito
      c.frame(5, 17, 6, 8, 'outline'); c.rect(6, 18, 4, 6, 'ink');
      const [a, b] = screens[i];
      c.rect(6, 18, 4, 2, a); c.rect(6, 20, 4, 3, b); c.hline(6, 9, 23, 'shadow');
      if (i % 2) c.px(7, 21, 'white');
      hand(c, M, 3, 21); hand(c, M, 11, 21);
      c.px(5, 21, M.s); c.px(10, 21, M.s);
      // polegar toca a tela
      c.px(i % 2 ? 8 : 7, 22, M.s);
      frames.push(c);
    }
    return frames;
  },
  // gira a roda de cores
  designer(look) {
    const frames = [];
    const ring = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink'];
    const pos = [[1, 0], [2, 0], [3, 1], [3, 2], [2, 3], [1, 3], [0, 2], [0, 1]];
    for (let i = 0; i < 4; i++) {
      const { c, M } = seated(look, { face: 'right', arms: 'none' });
      hand(c, M, 3, 23);
      // roda 6x6 na mão direita, acima da mesa
      const wx = 9, wy = 16;
      c.ellipse(wx, wy, 6, 6, 'outline');
      pos.forEach(([px, py], k) => c.px(wx + 1 + px, wy + 1 + py, ring[(k + i * 2) % 8]));
      c.px(wx + 2, wy + 2, 'white'); c.px(wx + 3, wy + 3, 'white'); c.px(wx + 2, wy + 3, 'light'); c.px(wx + 3, wy + 2, 'light');
      hand(c, M, 11, 22);
      c.px(12, 21, M.c);
      frames.push(c);
    }
    return frames;
  },
  // olha com lupa e bate o carimbo
  revisor(look) {
    const frames = [];
    const lupaX = [4, 6, 8, null, null, null];
    for (let i = 0; i < 6; i++) {
      const { c, M } = seated(look, { face: 'down', arms: 'none' });
      paper(c, 4, 24, 8, 2);
      if (i >= 4) { c.hline(6, 9, 24, 'red'); c.hline(6, 9, 25, 'red'); c.px(5, 24, 'red'); c.px(10, 25, 'red'); }
      hand(c, M, 2, 23);
      const lx = lupaX[i];
      if (lx !== null) {
        // lupa
        c.ellipse(lx, 19, 5, 5, 'outline'); c.rect(lx + 1, 20, 3, 3, 'cyanLight'); c.px(lx + 1, 20, 'white');
        c.px(lx + 4, 23, 'woodDark'); c.px(lx + 5, 24, 'woodDark');
        hand(c, M, lx + 5, 23);
      } else {
        const sy = i === 3 ? 16 : i === 4 ? 21 : 17;
        c.frame(8, sy - 3, 4, 4, 'outline'); c.rect(9, sy - 2, 2, 2, 'woodLight');
        c.rect(8, sy + 1, 4, 1, 'red'); c.hline(7, 12, sy + 2, 'outline'); c.px(7, sy + 1, 'outline'); c.px(12, sy + 1, 'outline');
        hand(c, M, 11, sy - 1);
        for (let y = sy + 1; y <= 22; y++) { c.px(12, y, M.c); c.px(13, y, M.o); }
        if (i === 4) { c.px(6, 21, 'white'); c.px(13, 22, 'white'); }
      }
      frames.push(c);
    }
    return frames;
  },
  // visitante: notebook
  visitante(look) {
    const frames = [];
    for (let i = 0; i < 4; i++) {
      const { c, M } = seated(look, { face: i === 3 ? 'blink' : 'down', arms: 'none' });
      c.frame(3, 18, 10, 7, 'outline'); c.rect(4, 19, 8, 5, 'silver'); c.rect(7, 20, 2, 2, 'teal');
      c.rect(2, 25, 12, 1, 'gray'); c.hline(2, 13, 26, 'outline'); c.px(1, 25, 'outline'); c.px(14, 25, 'outline');
      hand(c, M, 3, 24 - (i % 2)); hand(c, M, 11, 23 + (i % 2));
      frames.push(c);
    }
    return frames;
  },
};

// ---------------------------------------------------------------- folha completa
export const FPS = { work: 8, read: 6, idle: 4, doze: 4, sleep: 3, wait: 4, done: 8, error: 6, walk: 8 };

export function characterAnims(id) {
  const look = LOOKS[id];
  if (!look) throw new Error(`sem visual para ${id}`);
  const side = walkSide(look);
  return [
    { tag: 'base_idle', frames: baseIdle(look), fps: FPS.idle },
    { tag: 'base_read', frames: baseRead(look), fps: FPS.read },
    { tag: 'base_doze', frames: baseDoze(look), fps: FPS.doze },
    { tag: 'base_sleep', frames: baseSleep(look), fps: FPS.sleep },
    { tag: 'base_wait', frames: baseWait(look), fps: FPS.wait },
    { tag: 'base_done', frames: baseDone(look), fps: FPS.done },
    { tag: 'base_error', frames: baseError(look), fps: FPS.error },
    { tag: 'base_walk_down', frames: walkFront(look, 'front'), fps: FPS.walk },
    { tag: 'base_walk_up', frames: walkFront(look, 'back'), fps: FPS.walk },
    { tag: 'base_walk_left', frames: side, fps: FPS.walk },
    { tag: 'base_walk_right', frames: side.map((f) => f.flipX()), fps: FPS.walk },
    { tag: `${id}_work`, frames: WORK[id](look), fps: FPS.work },
  ];
}
