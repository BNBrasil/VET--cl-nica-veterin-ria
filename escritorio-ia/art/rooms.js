// Conteúdo de cada sala (piso, decoração de parede, móveis) — arte própria, versão isométrica do PDF.
// Coordenadas locais da sala (tamanho médio): i ∈ [0,128), j ∈ [0,112) unidades (1 tile = 16); z em pixels.
// Em salas menores/maiores, cada móvel é ancorado (perto/centro/longe) pelo RoomCtx (art/map.js).
// Parede decorada = plano j=0 (fundo à direita). Divisória baixa em i=0 (fundo à esquerda).
// Fileira da frente: porta na parede j=0 em i ∈ DOOR.
// Cores do destaque da sala SEMPRE via r.ac (mid/dark/light/pale) — o tema pode trocar o destaque.
import * as Fu from './furniture.js';
import * as D from './decals.js';

export const DOOR = [8, 40];
/** Ponto do personagem sentado (centro da cadeira) por sala, em coordenadas locais (sala média). */
export const SEATS = {
  orquestrador: { i: 44, j: 60 }, roteirista: { i: 44, j: 60 }, 'editor-video': { i: 40, j: 58 }, animador: { i: 44, j: 60 },
  programador: { i: 54, j: 58 }, desenvolvedor: { i: 58, j: 56 }, designer: { i: 56, j: 58 }, revisor: { i: 56, j: 58 },
  copa: { i: 56, j: 66 }, lounge: { i: 20, j: 26 },
};
export const DESK = { di: 14, dj: 28, h: 16, off: 9 }; // mesa: começa `off` à frente da cadeira
export const SOFA = { i: 6, j: 10, len: 92 }; // sofá do lounge (olha para +i)
export const LOUNGE_VISITORS = [[88, 24], [112, 74], [62, 98]];

// ---------------------------------------------------------------- pisos
export const planks = (a, b, seam, w = 8) => (u, v) => {
  const row = Math.floor(v / w);
  if (v % w === 0) return seam;
  if ((u + row * 23) % 48 === 0) return seam;
  return row % 2 ? a : b;
};
export const checker = (a, b, s = 16, line = null) => (u, v) => {
  if (line && (u % s === 0 || v % s === 0)) return line;
  return (Math.floor(u / s) + Math.floor(v / s)) % 2 ? a : b;
};
export const speckle = (a, b, [p, q, m] = [3, 5, 17]) => (u, v) => ((u * p + v * q) % m === 0 ? b : a);
const concrete = (a, b, c) => (u, v) => {
  if (u % 32 === 0 || v % 32 === 0) return b;
  const h = (u * 73 + v * 151 + ((u * v) % 7)) % 23;
  return h === 0 ? b : h === 7 ? c : a;
};
const grass = (a, b, c) => (u, v) => {
  const h = (u * 37 + v * 61 + ((u >> 2) * 11)) % 19;
  if (h === 0 || h === 9) return b;
  if (h === 4) return c;
  return ((u >> 3) + (v >> 3)) % 2 && h === 13 ? b : a;
};
/** Textura de piso por tipo (cols = [a, b, c]). */
export function floorPattern(tipo, [a, b, c], k) {
  switch (tipo) {
    case 'madeira': return planks(a, b, c);
    case 'carpete': return speckle(a, b, k);
    case 'azulejo': return checker(a, b, 16, c);
    case 'concreto': return concrete(a, b, c);
    case 'xadrez': return checker(a, b, 16);
    case 'grama': return grass(a, b, c);
    default: throw new Error(`piso desconhecido: ${tipo}`);
  }
}

function rug(r, i, j, di, dj, { fill, border, inner = null, pattern = null }) {
  // em salas de outro tamanho o tapete estica: começo e fim ancorados separadamente
  const [a0, a1] = [r.si(i), r.si(i + di)], [b0, b1] = [r.sj(j), r.sj(j + dj)];
  di = a1 - a0; dj = b1 - b0;
  r.iso.top(r.bg, r.I0 + a0, r.J0 + b0, r.I0 + a0 + di, r.J0 + b0 + dj, 0, (u, v) => {
    if (u < 2 || v < 2 || u >= di - 2 || v >= dj - 2) return border;
    if (inner && (u === 4 || v === 4 || u === di - 5 || v === dj - 5)) return inner;
    if (pattern) return pattern(u, v, di, dj) ?? fill;
    return fill;
  });
}
function roundRug(r, ci, cj, ri, rj, a, b) {
  ci = r.si(ci); cj = r.sj(cj); ri += r.dI / 4; rj += r.dJ / 4;
  r.iso.disc(r.bg, r.I0 + ci, r.J0 + cj, ri, rj, 0, (u, v, wi, wj) => {
    const d = Math.hypot((wi - r.I0 - ci) / ri, (wj - r.J0 - cj) / rj);
    return d > 0.86 ? b : d > 0.55 && d < 0.65 ? b : a;
  });
}

// ---------------------------------------------------------------- estação de trabalho
/**
 * Cadeira (bg) no ponto do personagem + mesa à frente (fg) com itens. Sempre ancorada no centro da sala.
 * deskCols: { top, edge, side, sideDark }, items(L, iso, i, j, z) com (i,j) = canto de trás da mesa.
 */
function workstation(r, { desk, chair, items = null, di = DESK.di, dj = DESK.dj, h = DESK.h, panel = true }) {
  const { i: fi, j: fj } = SEATS[r.id];
  r.meta.seat = { i: fi, j: fj };
  r.put((L, iso, I, J) => Fu.officeChair(L, iso, I + fi, J + fj, chair), { anchor: 'c' });
  const di0 = fi + DESK.off, dj0 = fj - dj / 2;
  r.put((L, iso, I, J) => {
    Fu.desk(L, iso, I + di0, J + dj0, di, dj, h, { ...desk, panel });
  }, { fg: true, anchor: 'c' });
  if (items) r.put((L, iso, I, J) => items(L, iso, I + di0, J + dj0, h), { fg: true, anchor: 'c' });
  r.meta.desk = { i: di0, j: dj0, di, dj, h };
}
const chairOf = (ac) => ({ seat: ac.mid, seatDark: ac.dark, back: ac.mid, backDark: ac.dark });
const keyboard = (L, iso, i, j, z, dx = 1, dy = 9) => iso.box(L, i + dx, j + dy, z, 5, 10, 1, { top: (u, v) => ((u + v) % 2 ? 'light' : 'silver'), left: 'gray', right: 'gray' });
const cushion = (ac) => ({ c: ac.mid, cD: ac.dark, cL: ac.light });

/** Pisos nativos (identidade de cada sala): tipo + cores + função exata. Usados quando o tema não muda o piso. */
export const NATIVE_FLOOR = {
  orquestrador: () => ({ tipo: 'madeira', cols: ['woodLight', 'tan', 'wood'] }),
  roteirista: () => ({ tipo: 'madeira', cols: ['wood', 'woodLight', 'woodDark'] }),
  'editor-video': (ac) => ({ tipo: 'carpete', cols: ['ink', ac.dark, ac.mid], k: [7, 13, 29] }),
  animador: () => ({ tipo: 'madeira', cols: ['sand', 'cream', 'tan'] }),
  copa: (ac) => ({ tipo: 'xadrez', cols: [ac.pale, ac.light, ac.dark], fn: checker(ac.pale, ac.light, 8) }),
  programador: () => ({ tipo: 'azulejo', cols: ['slate', 'steel', 'navy'] }),
  desenvolvedor: (ac) => ({ tipo: 'azulejo', cols: [ac.pale, 'snow', 'light'] }),
  designer: () => ({ tipo: 'madeira', cols: ['sand', 'tan', 'woodLight'] }),
  revisor: (ac) => ({ tipo: 'azulejo', cols: [ac.pale, 'snow', 'light'] }),
  lounge: (ac) => ({ tipo: 'carpete', cols: [ac.light, ac.mid, ac.dark], k: [3, 5, 17] }),
};

export const ROOM_DRAW = {};

// ================================================================ RECEPÇÃO (orquestrador)
// balcão, kanban (objeto animado) na parede, telefone, relógio grande
ROOM_DRAW.orquestrador = {
  floor(r) {
    r.paintFloor();
    rug(r, 26, 30, 62, 62, { fill: r.ac.mid, border: r.ac.dark, inner: r.ac.light });
  },
  wall(r) {
    r.wallJ(D.clock(20), 98, 40);
    r.wallI(D.sign('IA', { fill: r.ac.mid, ink: 'snow' }), 92, 36);
    r.wallI(D.poster(16, 20, 'sun'), 58, 38);
  },
  furniture(r) {
    const ac = r.ac;
    // sofazinho de espera encostado na parede esquerda
    r.put((L, iso, I, J) => Fu.armchairI(L, iso, I + 2, J + 74, cushion(ac)));
    r.put((L, iso, I, J) => Fu.plant(L, iso, I + 116, J + 12, { size: 3 }));
    r.put((L, iso, I, J) => Fu.plant(L, iso, I + 10, J + 10, { size: 2, pot: ac.mid, potDark: ac.dark }));
    workstation(r, {
      desk: { top: ac.light, edge: ac.mid, side: ac.mid, sideDark: ac.dark }, chair: chairOf(ac),
      items: (L, iso, i, j, z) => { keyboard(L, iso, i, j, z); Fu.deskPhone(L, iso, i + 3, j + 20, z); Fu.papers(L, iso, i + 4, j + 2, z, 2); Fu.monitorJ(L, iso, i + 2, j - 0, z, 10, 9, { screen: (u, v) => (v < 2 ? ac.mid : v % 3 === 0 && u < 6 ? 'silver' : 'snow') }); },
    });
    // lixeira e banquinho na frente
    r.put((L, iso, I, J) => Fu.plant(L, iso, I + 112, J + 96, { size: 1, pot: ac.mid, potDark: ac.dark }), { fg: true });
  },
};

// ================================================================ SALA DE ROTEIRO
// estantes de livros, cortiça com post-its, máquina de escrever, abajur amarelo (objeto)
ROOM_DRAW.roteirista = {
  floor(r) {
    r.paintFloor();
    rug(r, 24, 30, 64, 62, { fill: r.ac.mid, border: r.ac.dark, inner: r.ac.light, pattern: (u, v, di, dj) => ((u + v) % 8 === 0 && u > 6 && v > 6 && u < di - 7 && v < dj - 7 ? r.ac.dark : null) });
  },
  wall(r) { r.wallJ(D.corkBoard(46, 24), 40, 40); },
  furniture(r) {
    const books = ['red', 'blue', 'green', 'yellow', 'cream', 'purple', 'orange', 'cyan'];
    r.put((L, iso, I, J) => Fu.bookshelfJ(L, iso, I + 4, J, 32, 12, 42, { wood: 'wood', woodDark: 'woodDark', woodLight: 'woodLight', books, seed: 3 }));
    r.put((L, iso, I, J) => Fu.bookshelfJ(L, iso, I + 92, J, 32, 12, 42, { wood: 'wood', woodDark: 'woodDark', woodLight: 'woodLight', books, seed: 11 }));
    r.put((L, iso, I, J) => Fu.trashBin(L, iso, I + 52, J + 38));
    workstation(r, {
      desk: { top: 'woodLight', edge: 'wood', side: 'wood', sideDark: 'woodDark' }, chair: chairOf(r.ac),
      items: (L, iso, i, j, z) => { Fu.typewriter(L, iso, i + 1, j + 7, z); Fu.papers(L, iso, i + 4, j + 20, z, 3); Fu.mug(L, iso, i + 10, j + 3, z, r.ac.mid); },
    });
    r.put((L, iso, I, J) => Fu.plant(L, iso, I + 112, J + 92, { size: 2 }), { fg: true });
  },
};

// ================================================================ SALA DE EDIÇÃO
// escura, neon roxo, 2 monitores (objeto), claquete, fones, caixas de som
ROOM_DRAW['editor-video'] = {
  floor(r) {
    r.paintFloor();
    rug(r, 20, 28, 70, 62, { fill: r.ac.pale, border: r.ac.mid, inner: r.ac.dark });
  },
  wall(r) {
    const ac = r.ac;
    r.wallJ(D.foamPanel(20, 22, ac), 6, 40);
    r.wallJ(D.neonSign(ac), 44, 40);
    r.wallJ(D.poster(18, 24, 'film'), 82, 40);
    r.wallJ(D.foamPanel(20, 22, ac), 104, 40);
    // faixa de neon ao longo do rodapé
    r.iso.faceJ(r.bg, r.J0, r.I0, r.I0 + r.RI, 13, 14, r.glow(ac.light));
  },
  furniture(r) {
    const ac = r.ac;
    r.put((L, iso, I, J) => Fu.speaker(L, iso, I + 6, J + 18, 30));
    r.put((L, iso, I, J) => Fu.speaker(L, iso, I + 108, J + 4, 30));
    // claquete numa prateleira
    r.put((L, iso, I, J) => {
      iso.box(L, I + 74, J, 22, 22, 6, 2, { top: 'shadow', left: 'ink', right: 'ink' });
      iso.box(L, I + 77, J + 1, 24, 10, 2, 7, { top: 'ink', left: (u, v) => (v < 2 ? ((u >> 1) % 2 ? 'snow' : 'outline') : 'outline'), right: 'ink' });
      iso.box(L, I + 89, J + 1, 24, 4, 4, 6, { top: ac.light, left: ac.mid, right: ac.dark }); // fone pendurado
    });
    workstation(r, {
      desk: { top: 'shadow', edge: 'ink', side: 'ink', sideDark: 'outline' }, chair: chairOf(ac), di: 18,
      items: (L, iso, i, j, z) => { keyboard(L, iso, i, j, z, 2, 11); Fu.mug(L, iso, i + 12, j + 24, z, ac.light); },
    });
    r.put((L, iso, I, J) => Fu.plant(L, iso, I + 112, J + 94, { size: 2, pot: 'ink', potDark: 'outline', leaf: ac.mid, leafDark: ac.dark, leafLight: ac.light }), { fg: true });
  },
};

// ================================================================ ESTÚDIO DE ANIMAÇÃO
// mesa de luz, mesa digitalizadora, sprites e storyboards na parede
ROOM_DRAW.animador = {
  floor(r) {
    r.paintFloor();
    rug(r, 24, 30, 64, 62, { fill: r.ac.mid, border: r.ac.dark, inner: r.ac.light });
  },
  wall(r) {
    r.wallJ(D.storyboard(5), 6, 40);
    r.wallJ(D.spriteSheet(), 80, 38);
    r.wallJ(D.storyboard(1), 110, 34);
  },
  furniture(r) {
    const ac = r.ac;
    // mesa de luz (caixa com tampo luminoso) encostada no fundo
    r.put((L, iso, I, J) => {
      iso.box(L, I + 76, J + 2, 0, 40, 18, 14, { top: 'woodLight', left: ac.mid, right: ac.dark });
      iso.box(L, I + 78, J + 4, 14, 36, 14, 2, { top: (u, v) => ((u % 9 === 0 || v % 7 === 0) ? ac.light : 'snow'), left: 'light', right: 'light' });
      iso.top(L, I + 84, J + 6, I + 96, J + 15, 16.5, (u, v) => (u === 0 || v === 0 || u === 11 || v === 8 ? 'silver' : (u - 5) ** 2 + (v - 4) ** 2 < 6 ? 'pink' : 'snow'));
    });
    r.put((L, iso, I, J) => Fu.plant(L, iso, I + 10, J + 12, { size: 2, pot: ac.mid, potDark: ac.dark }));
    workstation(r, {
      desk: { top: 'snow', edge: 'light', side: ac.mid, sideDark: ac.dark }, chair: chairOf(ac),
      items: (L, iso, i, j, z) => {
        iso.box(L, i + 1, j + 9, z, 7, 12, 1, { top: (u, v) => (u === 0 || v === 0 || u === 6 || v === 11 ? 'outline' : 'ink'), left: 'outline', right: 'outline' });
        Fu.pencilCup(L, iso, i + 10, j + 24, z);
        Fu.papers(L, iso, i + 6, j + 21, z, 1);
      },
    });
    r.put((L, iso, I, J) => Fu.plant(L, iso, I + 114, J + 96, { size: 1, pot: ac.mid, potDark: ac.dark }), { fg: true });
  },
};

// ================================================================ COPA
// geladeira, balcão com café (objeto), azulejos, mesa com cadeiras
ROOM_DRAW.copa = {
  floor(r) { r.paintFloor(); },
  wall(r) {
    r.wallJ(D.tiles(64, 14), 26, 30);
    r.wallJ(D.upperCabinets(62, r.ac), 26, 42);
    r.wallJ(D.windowPane(18, 14, r.sky, r.noite), 6, 38);
  },
  furniture(r) {
    const ac = r.ac;
    r.put((L, iso, I, J) => Fu.cabinetJ(L, iso, I + 24, J, 70, 16, 16, { body: ac.mid, bodyDark: ac.dark, top: 'light', doors: 4 }));
    r.put((L, iso, I, J) => {
      // pia
      iso.top(L, I + 30, J + 3, I + 44, J + 12, 16.5, (u, v) => (u === 0 || v === 0 ? 'gray' : 'silver'));
      iso.box(L, I + 36, J + 1, 16, 2, 2, 7, { top: 'silver', left: 'light', right: 'gray' });
    }, { anchor: ['n', 'n'] });
    r.put((L, iso, I, J) => Fu.fridge(L, iso, I + 104, J));
    r.put((L, iso, I, J) => Fu.plant(L, iso, I + 10, J + 12, { size: 2, pot: ac.mid, potDark: ac.dark }));
    // mesa da copa com cadeira (o "seat" da copa) e banquinhos
    const { i: fi, j: fj } = SEATS.copa;
    r.meta.seat = { i: fi, j: fj };
    r.put((L, iso, I, J) => Fu.officeChair(L, iso, I + fi, J + fj, { seat: ac.mid, seatDark: ac.dark, back: ac.mid, backDark: ac.dark, metal: 'woodLight', metalDark: 'wood' }), { anchor: 'c' });
    r.put((L, iso, I, J) => {
      Fu.table(L, iso, I + fi + 9, J + fj - 14, 24, 28, 16, { top: 'snow', edge: ac.light });
      Fu.mug(L, iso, I + fi + 13, J + fj - 2, 16, 'red');
      Fu.mug(L, iso, I + fi + 24, J + fj + 6, 16, 'blue');
      iso.box(L, I + fi + 20, J + fj - 10, 16, 6, 8, 2, { top: 'sand', left: 'tan', right: 'tan' }); // pão de queijo
    }, { fg: true, anchor: 'c' });
    r.put((L, iso, I, J) => Fu.stool(L, iso, I + fi + 44, J + fj + 2, 6, 12, { top: ac.mid, side: ac.dark, sideDark: 'woodDark' }), { fg: true, anchor: 'c' });
  },
};

// ================================================================ SALA DE SERVIDORES (programador)
// racks com LEDs (um deles é o objeto animado), cabos no chão, caneca de café
ROOM_DRAW.programador = {
  floor(r) {
    r.paintFloor();
    // cabos coloridos no chão saindo dos racks até a mesa
    const c = r.cshift();
    const cable = (j0, j1, i1, col) => {
      j0 = r.sj(j0); j1 += c.j; i1 += c.i;
      for (let i = 18; i < i1; i++) r.iso.top(r.bg, r.I0 + i, r.J0 + j0, r.I0 + i + 1, r.J0 + j0 + 1.6, 0.2, col);
      for (let j = Math.min(j0, j1); j < Math.max(j0, j1); j++) r.iso.top(r.bg, r.I0 + i1, r.J0 + j, r.I0 + i1 + 1.6, r.J0 + j + 1, 0.2, col);
    };
    cable(70, 62, 58, 'green'); cable(76, 66, 62, 'blue'); cable(92, 70, 66, 'red'); cable(98, 74, 70, 'lamp');
  },
  wall(r) {
    r.wallJ(D.serverStatus(), 72, 40);
    r.wallJ(D.poster(16, 20, 'chart'), 104, 38);
  },
  furniture(r) {
    r.put((L, iso, I, J) => Fu.rackI(L, iso, I, J + 4, 22, 42));
    r.put((L, iso, I, J) => Fu.rackI(L, iso, I, J + 84, 22, 42));
    workstation(r, {
      desk: { top: 'silver', edge: 'gray', side: 'gray', sideDark: 'shadow' }, chair: chairOf(r.ac),
      items: (L, iso, i, j, z) => {
        keyboard(L, iso, i, j, z);
        Fu.monitorJ(L, iso, i + 2, j, z, 11, 10, { screen: (u, v) => (v === 0 ? 'navy' : (u * 3 + v * 5) % 7 < 3 ? 'green' : (u + v) % 5 === 0 ? 'greenLight' : 'navy') });
        Fu.mug(L, iso, i + 9, j + 24, z, r.ac.mid);
      },
    });
    r.put((L, iso, I, J) => Fu.plant(L, iso, I + 114, J + 96, { size: 1, pot: 'gray', potDark: 'shadow' }), { fg: true });
  },
};

// ================================================================ APP-MOBILE (desenvolvedor)
// celulares e tablets na parede, wireframes no quadro, pufes
ROOM_DRAW.desenvolvedor = {
  floor(r) { r.paintFloor(); },
  wall(r) {
    r.wallJ(D.devices(), 46, 38);
    r.wallJ(D.wireframes(30, 22), 96, 40);
  },
  furniture(r) {
    const ac = r.ac;
    r.put((L, iso, I, J) => Fu.plant(L, iso, I + 116, J + 12, { size: 2, pot: ac.mid, potDark: ac.dark }));
    workstation(r, {
      desk: { top: 'snow', edge: 'light', side: ac.mid, sideDark: ac.dark }, chair: chairOf(ac),
      items: (L, iso, i, j, z) => { keyboard(L, iso, i, j, z); iso.box(L, i + 3, j + 22, z, 6, 4, 1, { top: 'ink', left: 'outline', right: 'outline' }); },
    });
    // pufes coloridos
    r.put((L, iso, I, J) => Fu.beanbag(L, iso, I + 18, J + 70, { c: 'orange', cD: 'orangeDark', cL: 'orangeLight' }));
    r.put((L, iso, I, J) => Fu.beanbag(L, iso, I + 22, J + 96, { c: 'pink', cD: 'pinkDark', cL: 'pinkLight' }), { fg: true });
    r.put((L, iso, I, J) => Fu.beanbag(L, iso, I + 104, J + 90, { c: 'green', cD: 'greenDark', cL: 'greenLight' }), { fg: true });
  },
};

// ================================================================ ESTÚDIO DE DESIGN
// paleta de cores na parede, pôsteres (um muda de cor: objeto), prancheta, plantas
ROOM_DRAW.designer = {
  floor(r) {
    r.paintFloor();
    roundRug(r, 64, 64, 40, 38, r.ac.mid, r.ac.dark);
  },
  wall(r) {
    r.wallJ(D.palette(38, 22), 46, 40);
    r.wallJ(D.poster(16, 22, 'triangle'), 108, 40);
  },
  furniture(r) {
    const ac = r.ac;
    r.put((L, iso, I, J) => Fu.plant(L, iso, I + 116, J + 30, { size: 3, pot: ac.mid, potDark: ac.dark }));
    r.put((L, iso, I, J) => Fu.draftingTable(L, iso, I + 10, J + 62));
    workstation(r, {
      desk: { top: 'snow', edge: 'light', side: ac.mid, sideDark: ac.dark }, chair: chairOf(ac),
      items: (L, iso, i, j, z) => { Fu.pencilCup(L, iso, i + 10, j + 24, z); Fu.papers(L, iso, i + 2, j + 10, z, 2); iso.box(L, i + 3, j + 2, z, 6, 5, 2, { top: ac.light, left: ac.mid, right: ac.dark }); },
    });
    r.put((L, iso, I, J) => Fu.plant(L, iso, I + 112, J + 98, { size: 2, pot: ac.mid, potDark: ac.dark }), { fg: true });
  },
};

// ================================================================ SALA DE REVISÃO
// limpa, lupa gigante, carimbo APROVADO
ROOM_DRAW.revisor = {
  floor(r) { r.paintFloor(); },
  wall(r) {
    r.wallJ(D.aprovado(), 48, 38);
    r.wallJ(D.poster(18, 22, 'check'), 100, 40);
  },
  furniture(r) {
    const ac = r.ac;
    r.put((L, iso, I, J) => Fu.filingCabinet(L, iso, I + 106, J + 2));
    workstation(r, {
      desk: { top: 'snow', edge: 'light', side: ac.mid, sideDark: ac.dark }, chair: chairOf(ac),
      items: (L, iso, i, j, z) => { keyboard(L, iso, i, j, z); Fu.papers(L, iso, i + 3, j + 21, z, 2); iso.cylinder(L, i + 10, j + 25, 2, z, z + 2, { side: ac.mid, sideDark: ac.dark, top: ac.light }); },
    });
    r.put((L, iso, I, J) => Fu.giantMagnifier(L, iso, I + 22, J + 92), { fg: true });
  },
};

// ================================================================ LOUNGE
// sofá grande (4 vagas), poltronas, TV (objeto), plantas, luminária
ROOM_DRAW.lounge = {
  doorSpan: [8, 56],
  floor(r) {
    r.paintFloor();
    rug(r, 30, 24, 60, 70, { fill: 'cream', border: r.ac.dark, inner: r.ac.mid });
  },
  wall(r) {
    r.wallJ(D.windowPane(24, 20, r.sky, r.noite), 98, 40);
  },
  furniture(r) {
    const ac = r.ac, col = cushion(ac);
    r.put((L, iso, I, J) => Fu.floorLamp(L, iso, I + 40, J + 12));
    r.light(40, 12, 46);
    r.put((L, iso, I, J) => Fu.sofaI(L, iso, I + SOFA.i, J + SOFA.j, SOFA.len, { c: 'orange', cD: 'orangeDark', cL: 'orangeLight' }, 'body'), { anchor: ['n', 'c'] });
    r.put((L, iso, I, J) => Fu.sofaI(L, iso, I + SOFA.i, J + SOFA.j, SOFA.len, { c: 'orange', cD: 'orangeDark', cL: 'orangeLight' }, 'arm'), { fg: true, anchor: ['n', 'c'] });
    r.put((L, iso, I, J) => Fu.table(L, iso, I + 44, J + 42, 20, 34, 9, { top: 'woodLight', edge: 'wood' }), { anchor: 'c' });
    r.put((L, iso, I, J) => { Fu.mug(L, iso, I + 50, J + 50, 9, 'pink'); iso.box(L, I + 52, J + 62, 9, 8, 8, 2, { top: 'lamp', left: 'yellow', right: 'yellowDark' }); }, { anchor: 'c' });
    r.put((L, iso, I, J) => Fu.armchairBack(L, iso, I + 76, J + 76, col));
    r.put((L, iso, I, J) => Fu.plant(L, iso, I + 118, J + 12, { size: 3, pot: ac.mid, potDark: ac.dark }));
    r.put((L, iso, I, J) => Fu.plant(L, iso, I + 116, J + 100, { size: 2, pot: ac.mid, potDark: ac.dark }), { fg: true });
    r.meta.seat = { i: SOFA.i + 14, j: SOFA.j + 16 };
  },
};

