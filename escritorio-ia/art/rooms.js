// Fundos das salas 160x112 (vista superior 3/4): parede ao fundo, piso, móveis do ambiente.
// O espaço do personagem (retângulo 16x32 acima de `seat`) e do objeto animado fica livre;
// a mesa à frente do personagem tem o tampo em seat.y-9..seat.y-6 e a borda em seat.y-5.
import { Canvas, textWidth } from './draw.js';

export const RW = 160, RH = 112;
const WALL_BOTTOM = 40; // piso começa aqui
export const SEAT = { x: 72, y: 80 };

// ---------------------------------------------------------------- helpers
function shell(c, { wall, wallDark, trim, floor }) {
  c.rect(0, 0, RW, RH, wall);
  c.rect(0, 0, RW, 4, trim);           // topo da parede
  c.hline(0, RW - 1, 4, wallDark);
  c.rect(0, WALL_BOTTOM - 3, RW, 3, wallDark); // rodapé
  c.hline(0, RW - 1, WALL_BOTTOM - 1, 'outline');
  floor(c, WALL_BOTTOM, RH - 4);
  for (let x = 0; x < RW; x += 2) c.px(x, WALL_BOTTOM, wallDark); // sombra da parede no piso
  // paredes laterais e frente (moldura da sala)
  c.rect(0, 0, 4, RH, trim); c.vline(4, 5, RH - 5, 'outline');
  c.rect(RW - 4, 0, 4, RH, trim); c.vline(RW - 5, 5, RH - 5, 'outline');
  c.rect(0, RH - 4, RW, 4, trim); c.hline(4, RW - 5, RH - 5, 'outline');
}
function planks(a, b, gap) {
  return (c, y0, y1) => {
    for (let y = y0; y <= y1; y++) {
      const row = Math.floor((y - y0) / 6);
      c.hline(0, RW - 1, y, (y - y0) % 6 === 5 ? gap : a);
      if ((y - y0) % 6 !== 5) for (let x = (row * 23) % 40; x < RW; x += 40) c.px(x, y, gap);
      if ((y - y0) % 6 === 2) for (let x = (row * 17) % 31 + 8; x < RW; x += 47) c.px(x, y, b);
    }
  };
}
function tiles(a, b, size = 8, grout = null) {
  return (c, y0, y1) => {
    for (let y = y0; y <= y1; y++) for (let x = 0; x < RW; x++) {
      const tx = Math.floor(x / size), ty = Math.floor((y - y0) / size);
      let col = (tx + ty) & 1 ? b : a;
      if (grout && ((x % size) === 0 || ((y - y0) % size) === 0)) col = grout;
      c.px(x, y, col);
    }
  };
}
function carpet(a, b) {
  return (c, y0, y1) => { for (let y = y0; y <= y1; y++) for (let x = 0; x < RW; x++) c.px(x, y, (x * 7 + y * 13) % 11 === 0 ? b : a); };
}
function rug(c, x, y, w, h, col, border, dark = 'outline') {
  c.rect(x, y, w, h, border); c.rect(x + 2, y + 1, w - 4, h - 2, col);
  c.hline(x, x + w - 1, y + h, dark);
  for (let xx = x + 4; xx < x + w - 4; xx += 4) c.px(xx, y + 2, border), c.px(xx + 2, y + h - 3, border);
}
/** Mesa à frente do assento: tampo seat.y-9..-6, borda seat.y-5, pernas até seat.y+3. */
function desk(c, x0, x1, { top = 'woodLight', edge = 'tan', lip = 'wood', leg = 'woodDark', under = null, seat = SEAT } = {}) {
  const ty = seat.y - 9;
  if (under) c.rect(x0 + 2, seat.y - 4, x1 - x0 - 3, 6, under);
  c.rect(x0, ty, x1 - x0 + 1, 4, top);
  c.hline(x0, x1, ty, edge);
  c.hline(x0, x1, ty - 1, 'outline');
  c.vline(x0 - 1, ty, seat.y - 5, 'outline'); c.vline(x1 + 1, ty, seat.y - 5, 'outline');
  c.hline(x0, x1, seat.y - 5, lip);
  c.hline(x0, x1, seat.y - 4, 'outline');
  for (const lx of [x0, x1 - 2]) { c.rect(lx, seat.y - 3, 3, 7, leg); c.vline(lx - 1, seat.y - 3, seat.y + 3, 'outline'); c.vline(lx + 3, seat.y - 3, seat.y + 3, 'outline'); c.hline(lx, lx + 2, seat.y + 4, 'outline'); }
}
function shadowUnder(c, x, y, w, col = 'outline') { for (let xx = x; xx < x + w; xx++) if ((xx & 1) === 0) c.px(xx, y, col); }
function plant(c, x, y, { pot = 'woodLight', potDark = 'wood', big = false } = {}) {
  // (x,y) = canto superior esquerdo de uma área 12x(18|26)
  const h = big ? 26 : 18;
  const leafTop = y, potY = y + h - 7;
  const leaves = big
    ? [[5, 0, 3, 6], [1, 3, 4, 6], [7, 2, 4, 7], [2, 8, 4, 6], [6, 8, 5, 6], [4, 12, 4, 6]]
    : [[4, 0, 3, 5], [1, 3, 4, 5], [7, 2, 4, 6], [3, 6, 6, 5]];
  for (const [lx, ly, lw, lh] of leaves) { c.ellipse(x + lx - 1, leafTop + ly - 1, lw + 2, lh + 2, 'outline'); }
  for (const [lx, ly, lw, lh] of leaves) { c.ellipse(x + lx, leafTop + ly, lw, lh, 'green'); c.px(x + lx + 1, leafTop + ly + 1, 'greenLight'); c.px(x + lx + lw - 1, leafTop + ly + lh - 2, 'greenDark'); }
  c.rect(x + 2, potY, 8, 7, pot); c.frame(x + 1, potY - 1, 10, 8, 'outline'); c.vline(x + 8, potY, potY + 5, potDark); c.hline(x + 2, x + 9, potY, potDark);
  shadowUnder(c, x + 1, potY + 7, 10);
}
function frameBox(c, x, y, w, h, fill, border = 'outline') { c.rect(x, y, w, h, fill); c.frame(x - 1, y - 1, w + 2, h + 2, border); }
function clock(c, cx, cy, r = 7) {
  c.ellipse(cx - r - 1, cy - r - 1, 2 * r + 3, 2 * r + 3, 'outline');
  c.ellipse(cx - r, cy - r, 2 * r + 1, 2 * r + 1, 'white');
  for (const [dx, dy] of [[0, -r + 1], [r - 1, 0], [0, r - 1], [-r + 1, 0]]) c.px(cx + dx, cy + dy, 'gray');
  c.vline(cx, cy - r + 3, cy, 'outline'); c.hline(cx, cx + r - 3, cy, 'outline'); c.px(cx, cy, 'red');
}
function bookshelf(c, x, y, w, h, colors) {
  frameBox(c, x, y, w, h, 'wood');
  c.vline(x, y, y + h - 1, 'woodLight');
  const shelfH = 9;
  let k = 0;
  for (let sy = y + 1; sy + shelfH <= y + h; sy += shelfH) {
    c.rect(x + 1, sy, w - 2, shelfH - 2, 'woodDark');
    let bx = x + 2;
    while (bx < x + w - 3) {
      const bw = 1 + ((k * 7) % 3 === 0 ? 2 : 1), bh = shelfH - 3 - ((k * 5) % 3 === 0 ? 1 : 0);
      const col = colors[k % colors.length];
      c.rect(bx, sy + shelfH - 2 - bh, bw, bh, col);
      if (bw > 1) c.px(bx, sy + shelfH - 2 - bh + 1, 'cream');
      bx += bw + ((k * 3) % 4 === 0 ? 1 : 0); k++;
    }
    c.hline(x, x + w - 1, sy + shelfH - 2, 'woodLight');
    c.hline(x, x + w - 1, sy + shelfH - 1, 'outline');
  }
  shadowUnder(c, x - 1, y + h + 1, w + 2);
}
function postit(c, x, y, col) { c.rect(x, y, 4, 4, col); c.px(x + 3, y + 3, 'outline'); c.hline(x + 1, x + 2, y + 1, 'shadow'); }
function chairSide(c, x, y, col, colDark) {
  // cadeira de espera vista de frente (12x14)
  c.rect(x + 1, y, 10, 6, col); c.frame(x, y - 1, 12, 8, 'outline'); c.hline(x + 1, x + 10, y + 5, colDark);
  c.rect(x + 1, y + 7, 10, 3, col); c.frame(x, y + 7, 12, 4, 'outline'); c.hline(x + 1, x + 10, y + 9, colDark);
  c.vline(x + 1, y + 11, y + 14, 'outline'); c.vline(x + 10, y + 11, y + 14, 'outline');
}
function pufe(c, x, y, col, dark) {
  c.ellipse(x - 1, y - 1, 18, 14, 'outline'); c.ellipse(x, y, 16, 12, col);
  c.ellipse(x + 2, y + 6, 12, 6, dark); c.ellipse(x + 3, y + 5, 10, 4, col);
  c.px(x + 4, y + 2, 'white'); c.px(x + 5, y + 2, 'white');
  shadowUnder(c, x + 1, y + 13, 14);
}
function sign(c, x, y, text, bg, fg) {
  const w = textWidth(text) + 4;
  frameBox(c, x, y, w, 9, bg);
  c.text(text, x + 2, y + 2, fg);
  return w;
}
function windowPane(c, x, y, w, h) {
  frameBox(c, x, y, w, h, 'blueLight');
  c.rect(x + 1, y + 1, w - 2, h - 2, 'blueLight');
  c.line(x + 2, y + h - 3, x + 6, y + 2, 'white'); c.line(x + 5, y + h - 3, x + 9, y + 2, 'white');
  c.vline(x + (w >> 1), y, y + h - 1, 'white'); c.hline(x, x + w - 1, y + (h >> 1), 'white');
  c.hline(x - 1, x + w, y + h + 1, 'light');
}
function cable(c, pts, col) { for (let i = 1; i < pts.length; i++) c.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], col); }
function mug(c, x, y, col = 'white') { c.rect(x, y, 3, 3, col); c.frame(x - 1, y - 1, 5, 5, 'outline'); c.px(x + 4, y + 1, 'outline'); c.px(x + 1, y, 'woodDark'); }
function monitorBack(c, x, y) { c.rect(x, y, 12, 8, 'shadow'); c.frame(x - 1, y - 1, 14, 10, 'outline'); c.rect(x + 5, y + 9, 2, 2, 'outline'); }

// ---------------------------------------------------------------- salas
const ROOMS = {};

// RECEPÇÃO: balcão, kanban na parede (objeto), telefone, relógio grande
ROOMS.orquestrador = {
  object: { x: 100, y: 7 },
  draw(c) {
    shell(c, { wall: 'cream', wallDark: 'tan', trim: 'orangeDark', floor: planks('woodLight', 'tan', 'wood') });
    c.rect(5, 26, RW - 10, 2, 'orange'); c.hline(5, RW - 6, 28, 'orangeDark');
    clock(c, 26, 16, 9);
    // placa com o nome fica na plaquinha desenhada pelo front (evita texto duplicado)
    // cadeiras de espera
    chairSide(c, 12, 46, 'orange', 'orangeDark'); chairSide(c, 26, 46, 'orange', 'orangeDark');
    plant(c, 140, 30, { big: true });
    rug(c, 40, 88, 80, 14, 'orange', 'orangeDark');
    // balcão (mesa) com tampo laranja
    desk(c, 42, 110, { top: 'orange', edge: 'lamp', lip: 'orangeDark', leg: 'wood', under: 'wood' });
    // telefone
    c.rect(46, 67, 8, 4, 'ink'); c.frame(45, 66, 10, 6, 'outline'); c.rect(46, 65, 8, 2, 'shadow'); c.frame(45, 64, 10, 3, 'outline'); c.px(48, 68, 'red'); c.px(50, 68, 'gray'); c.px(52, 68, 'gray');
    // pilha de papéis e caneca
    c.rect(90, 66, 8, 4, 'white'); c.frame(89, 65, 10, 6, 'outline'); c.hline(90, 97, 67, 'light');
    mug(c, 102, 66, 'orange');
  },
};

// SALA DE ROTEIRO: estantes, cortiça com post-its, máquina de escrever, abajur amarelo (objeto)
ROOMS.roteirista = {
  object: { x: 84, y: 54 },
  draw(c) {
    shell(c, { wall: 'yellowDark', wallDark: 'wood', trim: 'woodDark', floor: planks('wood', 'woodLight', 'woodDark') });
    for (let x = 8; x < RW - 4; x += 8) c.vline(x, 6, 35, 'wood');
    bookshelf(c, 8, 6, 30, 46, ['red', 'blue', 'yellow', 'green', 'cream', 'purple', 'orange', 'teal']);
    bookshelf(c, 40, 6, 18, 46, ['cyan', 'pink', 'cream', 'red', 'yellow', 'blueDark']);
    // quadro de cortiça
    frameBox(c, 96, 8, 52, 26, 'tan', 'woodDark');
    c.frame(96, 8, 52, 26, 'wood');
    for (let i = 0; i < 40; i++) c.px(97 + ((i * 37) % 50), 9 + ((i * 11) % 24), 'woodLight');
    const notes = [[100, 12, 'lamp'], [108, 14, 'pinkLight'], [118, 11, 'cyanLight'], [128, 13, 'lamp'], [138, 12, 'greenLight'], [102, 22, 'greenLight'], [113, 24, 'lamp'], [124, 21, 'pinkLight'], [134, 25, 'cyanLight']];
    for (const [x, y, col] of notes) { postit(c, x, y, col); c.px(x + 1, y, 'red'); }
    cable(c, [[104, 14], [111, 16], [121, 13]], 'red');
    rug(c, 36, 86, 88, 16, 'yellow', 'yellowDark');
    desk(c, 42, 106, { under: 'woodDark' });
    // pilha de folhas e lixeira com papel amassado
    c.rect(48, 66, 9, 4, 'white'); c.frame(47, 65, 11, 6, 'outline'); c.hline(48, 56, 67, 'light');
    c.rect(122, 72, 10, 10, 'gray'); c.frame(121, 71, 12, 12, 'outline'); c.hline(122, 131, 72, 'silver'); c.vline(125, 73, 81, 'shadow'); c.vline(128, 73, 81, 'shadow');
    c.ellipse(123, 68, 4, 4, 'white'); c.ellipse(127, 69, 4, 4, 'light'); c.px(124, 69, 'light');
    c.ellipse(136, 84, 4, 4, 'white'); c.px(137, 85, 'light');
    plant(c, 142, 36);
  },
};

// SALA DE EDIÇÃO: escura, neon roxo, 2 monitores (objeto), claquete, fones
ROOMS['editor-video'] = {
  object: { x: 82, y: 56 },
  draw(c) {
    shell(c, { wall: 'ink', wallDark: 'outline', trim: 'outline', floor: carpet('shadow', 'ink') });
    // neon roxo
    c.hline(6, RW - 7, 8, 'neon'); c.hline(6, RW - 7, 9, 'purple'); c.hline(6, RW - 7, 7, 'purpleDark');
    c.hline(6, RW - 7, 33, 'purple'); c.hline(6, RW - 7, 34, 'purpleDark');
    // letreiro neon "EDIT" e símbolo play
    c.text('EDIT', 16, 16, 'neon'); c.text('EDIT', 17, 17, 'purple'); c.text('EDIT', 16, 16, 'neon');
    c.px(40, 16, 'neon'); c.vline(40, 16, 20, 'neon'); c.line(41, 17, 42, 18, 'neon'); c.line(41, 19, 42, 18, 'neon');
    // claquete
    frameBox(c, 120, 14, 16, 12, 'outline', 'shadow'); c.rect(120, 18, 16, 8, 'ink');
    for (let x = 120; x < 136; x += 4) { c.rect(x, 14, 2, 3, 'white'); }
    c.hline(122, 133, 21, 'silver'); c.hline(122, 130, 23, 'gray');
    // fones pendurados
    c.ellipse(142, 12, 10, 10, 'gray'); c.ellipse(143, 13, 8, 8, 'ink'); c.rect(141, 17, 3, 5, 'purple'); c.rect(150, 17, 3, 5, 'purple'); c.px(147, 10, 'silver');
    // poltrona/sofá roxo ao fundo e caixa de som
    frameBox(c, 10, 40, 10, 22, 'outline', 'shadow'); c.ellipse(12, 44, 6, 6, 'shadow'); c.ellipse(11, 52, 8, 8, 'shadow'); c.px(14, 46, 'gray'); c.px(14, 55, 'neon');
    frameBox(c, 136, 40, 10, 22, 'outline', 'shadow'); c.ellipse(138, 44, 6, 6, 'shadow'); c.ellipse(137, 52, 8, 8, 'shadow'); c.px(140, 46, 'gray'); c.px(140, 55, 'neon');
    // brilho roxo no piso
    for (let y = 84; y < 106; y++) for (let x = 30; x < 130; x++) if (((x + y) & 3) === 0 && Math.abs(x - 80) + Math.abs(y - 94) * 3 < 52) c.px(x, y, 'purpleDark');
    desk(c, 40, 118, { top: 'shadow', edge: 'gray', lip: 'ink', leg: 'outline', under: 'outline' });
    c.hline(40, 118, 75, 'purple');
  },
};

// ESTÚDIO DE ANIMAÇÃO: mesa de luz, storyboards na parede, sprites colados, caixa de luz (objeto)
ROOMS.animador = {
  object: { x: 104, y: 6 },
  draw(c) {
    shell(c, { wall: 'light', wallDark: 'silver', trim: 'cyanDark', floor: planks('tan', 'cream', 'woodLight') });
    c.rect(5, 30, RW - 10, 2, 'cyan');
    // storyboard: 2 linhas de quadrinhos
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
      const x = 10 + i * 20, y = 7 + j * 14;
      frameBox(c, x, y, 16, 10, 'white');
      c.px(x + 2 + i * 3, y + 6 - j * 2, 'outline'); c.ellipse(x + 3 + i * 2, y + 2 + j, 4, 4, i % 2 ? 'cyan' : 'pink');
      c.hline(x + 1, x + 14, y + 8, 'silver');
      c.px(x + 7, y - 1, 'red');
    }
    // sprites colados (pixel figures)
    // mesa de luz no canto inferior esquerdo
    c.rect(10, 84, 30, 14, 'cyanLight'); c.frame(9, 83, 32, 16, 'outline'); c.rect(11, 85, 28, 12, 'white');
    c.rect(14, 87, 9, 7, 'cyanLight'); c.rect(26, 88, 9, 7, 'cyanLight'); c.frame(14, 87, 9, 7, 'silver'); c.frame(26, 88, 9, 7, 'silver');
    c.ellipse(16, 89, 4, 4, 'gray'); c.ellipse(29, 90, 4, 4, 'gray');
    c.rect(9, 99, 32, 2, 'cyanDark'); c.vline(11, 101, 104, 'outline'); c.vline(38, 101, 104, 'outline');
    // prateleira com bonecos de massinha
    c.rect(124, 46, 26, 3, 'woodLight'); c.hline(124, 149, 49, 'outline');
    c.ellipse(127, 40, 5, 6, 'pink'); c.ellipse(134, 41, 5, 5, 'yellow'); c.ellipse(141, 39, 5, 7, 'cyan');
    c.px(128, 42, 'outline'); c.px(135, 42, 'outline'); c.px(142, 41, 'outline');
    plant(c, 140, 76);
    rug(c, 44, 88, 72, 14, 'cyan', 'cyanDark');
    desk(c, 42, 106, { top: 'white', edge: 'white', lip: 'silver', leg: 'gray', under: 'woodLight' });
    // papéis de animação na mesa
    c.rect(86, 66, 10, 4, 'white'); c.frame(85, 65, 12, 6, 'outline'); c.rect(88, 66, 8, 4, 'cyanLight'); c.frame(87, 65, 10, 6, 'outline');
    c.rect(48, 67, 2, 3, 'red'); c.rect(51, 67, 2, 3, 'blue'); c.rect(54, 67, 2, 3, 'yellow'); c.frame(47, 66, 10, 5, 'outline');
  },
};

// SALA DE SERVIDORES: racks com LEDs, cabos no chão, caneca de café; rack ativo é o objeto
ROOMS.programador = {
  object: { x: 112, y: 30 },
  draw(c) {
    shell(c, { wall: 'slate', wallDark: 'navy', trim: 'navy', floor: tiles('gray', 'gray', 10, 'shadow') });
    for (let y = 46; y < RH - 4; y += 10) for (let x = 5; x < RW - 4; x += 10) c.px(x + 5, y + 5, 'silver');
    // racks de fundo
    for (const rx of [8, 28, 48, 132]) {
      frameBox(c, rx, 6, 16, 44, 'ink');
      for (let y = 8; y < 48; y += 5) { c.rect(rx + 1, y, 14, 4, 'shadow'); c.hline(rx + 1, rx + 14, y + 3, 'outline'); c.px(rx + 2, y + 1, (y + rx) % 3 ? 'green' : 'greenLight'); c.px(rx + 4, y + 1, (y * rx) % 4 ? 'greenDark' : 'orange'); c.hline(rx + 7, rx + 13, y + 1, 'gray'); }
      shadowUnder(c, rx, 51, 16);
    }
    // cabos no chão
    cable(c, [[16, 51], [16, 60], [30, 66], [44, 66]], 'green');
    cable(c, [[36, 51], [36, 56], [22, 62], [12, 70], [12, 92]], 'blue');
    cable(c, [[56, 51], [56, 58], [40, 64], [38, 70]], 'yellow');
    cable(c, [[140, 51], [140, 90], [120, 100]], 'red');
    c.text('<>', 80, 14, 'greenLight'); c.text('{}', 90, 14, 'green');
    rug(c, 44, 90, 60, 12, 'greenDark', 'navy');
    desk(c, 42, 102, { top: 'silver', edge: 'light', lip: 'gray', leg: 'shadow', under: 'shadow' });
    // monitor (costas) e caneca de café
    monitorBack(c, 84, 57); c.px(90, 60, 'green');
    mug(c, 48, 66, 'green'); c.px(49, 63, 'light'); c.px(50, 62, 'light');
  },
};

// APP-MOBILE: celulares e tablets na parede, wireframes no quadro, pufes; monitor é o objeto
ROOMS.desenvolvedor = {
  object: { x: 84, y: 56 },
  draw(c) {
    shell(c, { wall: 'blueLight', wallDark: 'blue', trim: 'blueDark', floor: carpet('light', 'silver') });
    // celulares e tablets na parede
    const devs = [[10, 9, 8, 14], [22, 11, 8, 14], [34, 8, 14, 18], [52, 10, 8, 14]];
    devs.forEach(([x, y, w, h], i) => {
      frameBox(c, x, y, w, h, 'ink'); c.rect(x + 1, y + 1, w - 2, h - 3, ['blue', 'white', 'cyanLight', 'orange'][i]);
      c.hline(x + 2, x + w - 3, y + 3, 'white'); c.rect(x + 2, y + 5, w - 4, 2, 'blueDark'); c.px(x + (w >> 1), y + h - 2, 'gray');
    });
    // quadro branco com wireframes
    frameBox(c, 92, 6, 56, 28, 'white', 'gray');
    c.frame(96, 9, 12, 20, 'blue'); c.hline(97, 106, 12, 'blue'); c.frame(98, 15, 8, 5, 'silver'); c.hline(98, 105, 23, 'silver'); c.hline(98, 103, 25, 'silver');
    c.frame(112, 9, 12, 20, 'blue'); c.frame(114, 12, 8, 3, 'silver'); c.frame(114, 17, 8, 3, 'silver'); c.frame(114, 22, 8, 3, 'silver');
    c.line(108, 18, 111, 18, 'red'); c.px(110, 17, 'red'); c.px(110, 19, 'red');
    c.frame(128, 9, 16, 12, 'blue'); c.line(129, 10, 142, 19, 'silver'); c.line(142, 10, 129, 19, 'silver');
    c.hline(128, 140, 24, 'gray'); c.hline(128, 136, 27, 'gray');
    c.rect(130, 34, 10, 2, 'gray'); c.px(131, 33, 'red'); c.px(134, 33, 'blue');
    // pufes
    pufe(c, 12, 84, 'orange', 'orangeDark'); pufe(c, 30, 92, 'blue', 'blueDark'); pufe(c, 128, 88, 'pink', 'pinkDark');
    desk(c, 42, 104, { top: 'white', edge: 'white', lip: 'light', leg: 'blueDark', under: 'silver' });
    // tablet na mesa e cabo
    c.rect(48, 66, 10, 5, 'ink'); c.frame(47, 65, 12, 7, 'outline'); c.rect(49, 67, 8, 3, 'cyanLight'); c.px(50, 68, 'blue');
    plant(c, 140, 40);
  },
};

// ESTÚDIO DE DESIGN: paleta de cores na parede, pôsteres (um é o objeto), prancheta, plantas
ROOMS.designer = {
  object: { x: 112, y: 6 },
  draw(c) {
    shell(c, { wall: 'white', wallDark: 'light', trim: 'pinkDark', floor: planks('tan', 'cream', 'woodLight') });
    c.rect(5, 30, RW - 10, 2, 'pink');
    // paleta de cores na parede (amostras)
    const sw = ['red', 'orange', 'yellow', 'green', 'teal', 'cyan', 'blue', 'purple', 'pink', 'pinkLight'];
    sw.forEach((col, i) => { const x = 10 + (i % 5) * 9, y = 8 + Math.floor(i / 5) * 10; frameBox(c, x, y, 7, 7, col); c.px(x, y, 'white'); });
    // pôster estático
    frameBox(c, 62, 7, 20, 24, 'navy'); c.ellipse(66, 11, 12, 12, 'yellow'); c.rect(63, 24, 18, 6, 'pink'); c.text('A', 70, 25, 'white');
    // prancheta inclinada
    c.rect(10, 82, 26, 14, 'white'); c.frame(9, 81, 28, 16, 'outline'); c.line(12, 92, 30, 85, 'pink'); c.ellipse(20, 85, 8, 6, 'cyanLight');
    c.rect(9, 97, 28, 2, 'woodLight'); c.vline(12, 99, 104, 'outline'); c.vline(34, 99, 104, 'outline');
    plant(c, 140, 30, { big: true }); plant(c, 124, 84, { pot: 'pink', potDark: 'pinkDark' }); plant(c, 6, 42, { pot: 'white', potDark: 'light' });
    rug(c, 44, 88, 72, 14, 'pinkLight', 'pink');
    desk(c, 42, 106, { top: 'white', edge: 'white', lip: 'light', leg: 'pinkDark', under: 'woodLight' });
    // pincéis no pote e amostras
    c.rect(48, 66, 5, 5, 'pink'); c.frame(47, 65, 7, 7, 'outline'); c.vline(49, 62, 65, 'yellow'); c.vline(51, 61, 65, 'cyan'); c.px(49, 61, 'outline'); c.px(51, 60, 'outline');
    c.rect(88, 67, 4, 3, 'yellow'); c.rect(92, 67, 4, 3, 'cyan'); c.rect(96, 67, 4, 3, 'pink'); c.frame(87, 66, 14, 5, 'outline');
  },
};

// SALA DE REVISÃO: limpa, lupa gigante, carimbo "APROVADO"; monitor é o objeto
ROOMS.revisor = {
  object: { x: 84, y: 56 },
  draw(c) {
    shell(c, { wall: 'white', wallDark: 'light', trim: 'redDark', floor: tiles('white', 'light', 10, null) });
    c.rect(5, 30, RW - 10, 2, 'red');
    // placa APROVADO (carimbo)
    c.frame(10, 9, 44, 15, 'red'); c.frame(11, 10, 42, 13, 'red'); c.text('APROVADO', 14, 14, 'red');
    c.px(12, 11, 'white'); c.px(51, 21, 'white');
    // lupa gigante na parede
    c.ellipse(112, 6, 22, 22, 'outline'); c.ellipse(114, 8, 18, 18, 'silver'); c.ellipse(116, 10, 14, 14, 'cyanLight');
    c.px(119, 13, 'white'); c.px(120, 12, 'white'); c.px(118, 14, 'white');
    c.line(131, 26, 140, 35, 'outline'); c.line(132, 26, 141, 35, 'wood'); c.line(131, 27, 140, 36, 'woodDark'); c.line(132, 27, 141, 36, 'woodDark');
    // checklist na parede
    frameBox(c, 62, 8, 18, 22, 'cream');
    for (let i = 0; i < 4; i++) { c.frame(64, 10 + i * 5, 3, 3, 'gray'); c.hline(69, 77, 11 + i * 5, 'silver'); if (i < 3) { c.px(65, 11 + i * 5, 'green'); c.px(64, 10 + i * 5, 'green'); } }
    // arquivo
    frameBox(c, 10, 36, 18, 26, 'light'); for (let y = 38; y < 60; y += 8) { c.hline(11, 26, y + 6, 'silver'); c.rect(16, y + 2, 6, 2, 'gray'); }
    shadowUnder(c, 9, 63, 20);
    plant(c, 140, 76, { pot: 'red', potDark: 'redDark' });
    rug(c, 44, 88, 72, 14, 'light', 'red');
    desk(c, 42, 104, { top: 'white', edge: 'white', lip: 'light', leg: 'silver', under: 'light' });
    // carimbo grande e almofada
    c.rect(48, 68, 8, 3, 'red'); c.frame(47, 67, 10, 5, 'outline'); c.rect(50, 63, 4, 4, 'woodLight'); c.frame(49, 62, 6, 6, 'outline');
  },
};

// COPA: café (objeto), geladeira, mesa
ROOMS.copa = {
  object: { x: 112, y: 18 },
  draw(c) {
    shell(c, { wall: 'cream', wallDark: 'tan', trim: 'wood', floor: tiles('white', 'brown', 8, null) });
    // azulejos da parede
    for (let y = 18; y < 36; y += 4) for (let x = 40; x < 150; x += 6) c.frame(x, y, 6, 4, 'light');
    // armários superiores
    frameBox(c, 40, 6, 60, 10, 'brown'); for (let x = 40; x < 100; x += 15) { c.vline(x, 6, 15, 'wood'); c.px(x + 7, 12, 'tan'); }
    // bancada
    c.rect(40, 34, 110, 4, 'light'); c.hline(40, 149, 34, 'white'); c.rect(40, 38, 110, 12, 'brown'); c.hline(39, 150, 33, 'outline'); c.hline(40, 149, 50, 'outline');
    for (let x = 40; x < 150; x += 22) { c.vline(x, 38, 49, 'wood'); c.px(x + 11, 43, 'tan'); }
    // pia e torneira
    c.rect(56, 34, 16, 2, 'silver'); c.vline(64, 29, 33, 'gray'); c.hline(64, 67, 29, 'gray');
    // xícaras
    mug(c, 82, 30, 'white'); mug(c, 88, 30, 'red');
    // geladeira
    frameBox(c, 10, 6, 24, 46, 'white'); c.hline(10, 33, 20, 'light'); c.hline(10, 33, 21, 'silver'); c.vline(30, 10, 17, 'silver'); c.vline(30, 25, 33, 'silver');
    c.rect(14, 26, 4, 4, 'yellow'); c.rect(19, 27, 4, 4, 'pink'); shadowUnder(c, 9, 53, 26);
    // mesa (mesmo padrão de mesa, para quem senta)
    desk(c, 46, 98, { top: 'woodLight', edge: 'tan', lip: 'wood', leg: 'woodDark', under: 'light' });
    mug(c, 86, 66, 'white'); c.px(87, 63, 'light'); c.px(88, 62, 'light');
    c.ellipse(52, 66, 8, 4, 'white'); c.ellipse(53, 66, 6, 3, 'tan'); c.px(55, 66, 'woodLight');
    // banquetas extras
    for (const bx of [116, 134]) { c.ellipse(bx - 1, 81, 14, 8, 'outline'); c.ellipse(bx, 82, 12, 6, 'brown'); c.hline(bx + 2, bx + 9, 85, 'wood'); c.vline(bx + 2, 86, 94, 'outline'); c.vline(bx + 9, 86, 94, 'outline'); }
    plant(c, 142, 54);
  },
};

// LOUNGE: sofá (onde dormem os ociosos), poltrona do visitante, TV (objeto)
export const SOFA = { x: 40, y: 82 };
export const LOUNGE_SEAT = { x: 116, y: 82 };
function sofa(c, x0, x1, seat, col, dark, light) {
  const top = seat.y - 22, cy = seat.y - 9;
  // encosto
  c.rect(x0 + 4, top, x1 - x0 - 7, cy - top, col); c.frame(x0 + 3, top - 1, x1 - x0 - 5, cy - top + 2, 'outline');
  c.hline(x0 + 4, x1 - 4, top, light);
  for (let x = x0 + 4 + 16; x < x1 - 6; x += 16) c.vline(x, top + 2, cy - 1, dark);
  // assento
  c.rect(x0 + 4, cy, x1 - x0 - 7, 4, light); c.hline(x0 + 4, x1 - 4, cy + 3, col);
  c.rect(x0 + 4, seat.y - 5, x1 - x0 - 7, 8, col); c.hline(x0 + 4, x1 - 4, seat.y - 5, dark); c.hline(x0 + 4, x1 - 4, seat.y + 2, dark);
  c.hline(x0 + 3, x1 - 3, seat.y + 3, 'outline');
  // braços
  for (const ax of [x0, x1 - 6]) { c.rect(ax + 1, top + 6, 5, seat.y - top - 3, col); c.frame(ax, top + 5, 7, seat.y - top - 1, 'outline'); c.hline(ax + 1, ax + 5, top + 6, light); c.vline(ax + 5, top + 7, seat.y + 1, dark); }
  // pés
  c.rect(x0 + 2, seat.y + 4, 2, 2, 'outline'); c.rect(x1 - 4, seat.y + 4, 2, 2, 'outline');
}
ROOMS.lounge = {
  object: { x: 64, y: 8 },
  seat: LOUNGE_SEAT,
  draw(c) {
    shell(c, { wall: 'teal', wallDark: 'tealDark', trim: 'tealDark', floor: planks('woodLight', 'tan', 'wood') });
    c.rect(5, 24, RW - 10, 13, 'tealDark'); c.hline(5, RW - 6, 24, 'cream');
    for (let x = 10; x < RW - 6; x += 10) c.vline(x, 25, 36, 'teal');
    windowPane(c, 12, 7, 26, 14);
    windowPane(c, 122, 7, 26, 14);
    // tapete grande
    rug(c, 12, 84, 136, 18, 'cream', 'teal');
    // mesinha de centro
    c.rect(68, 88, 26, 4, 'woodLight'); c.frame(67, 87, 28, 6, 'outline'); c.rect(69, 93, 2, 4, 'outline'); c.rect(91, 93, 2, 4, 'outline');
    c.rect(72, 86, 6, 2, 'pink'); c.frame(71, 85, 8, 4, 'outline'); mug(c, 84, 87, 'white');
    sofa(c, 10, 70, SOFA, 'teal', 'tealDark', 'cyanLight');
    // poltrona do visitante
    sofa(c, 100, 132, LOUNGE_SEAT, 'brown', 'wood', 'tan');
    // abajur de pé e planta
    c.vline(141, 46, 80, 'outline'); c.vline(142, 46, 80, 'gray'); c.ellipse(136, 36, 12, 10, 'outline'); c.ellipse(137, 37, 10, 8, 'lamp'); c.hline(137, 146, 44, 'yellowDark'); c.hline(138, 146, 81, 'outline');
    plant(c, 144, 76, { pot: 'teal', potDark: 'tealDark' });
  },
};

export const ROOM_IDS = Object.keys(ROOMS);

export function roomSpec(id) {
  const r = ROOMS[id];
  if (!r) throw new Error(`sala sem desenho: ${id}`);
  return { seat: r.seat || SEAT, object: r.object };
}

export function drawRoom(id) {
  const c = new Canvas(RW, RH);
  ROOMS[id].draw(c);
  return c;
}
