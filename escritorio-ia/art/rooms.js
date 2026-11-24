// Conteúdo de cada sala (piso, decoração de parede, móveis) — arte própria, versão isométrica do PDF.
// Coordenadas locais da sala: i ∈ [0,128), j ∈ [0,112) unidades; z em pixels.
import { Canvas } from './draw.js';
import { desk, officeChair, bookshelfJ, plant, monitorJ, framed, stool } from './furniture.js';

// ---------------------------------------------------------------- pisos
const planks = (a, b, seam, w = 8) => (u, v) => {
  const row = Math.floor(v / w);
  if (v % w === 0) return seam;
  if ((u + row * 23) % 48 === 0) return seam;
  return row % 2 ? a : b;
};
const checker = (a, b, s = 16, line = null) => (u, v) => {
  if (line && (u % s === 0 || v % s === 0)) return line;
  return (Math.floor(u / s) + Math.floor(v / s)) % 2 ? a : b;
};
/** Tapete retangular com borda. */
function rug(r, i, j, di, dj, { fill, border, inner = null, pattern = null }) {
  r.iso.top(r.bg, r.I0 + i, r.J0 + j, r.I0 + i + di, r.J0 + j + dj, 0, (u, v) => {
    if (u < 2 || v < 2 || u >= di - 2 || v >= dj - 2) return border;
    if (inner && (u === 4 || v === 4 || u === di - 5 || v === dj - 5)) return inner;
    if (pattern) return pattern(u, v) ?? fill;
    return fill;
  });
}

/** Estação de trabalho: cadeira atrás dos pés, mesa na frente (camada fg). Registra seat. */
function workstation(r, fi, fj, { desk: dc, chair, deskDi = 18, deskDj = 30, deskH = 18, panel = true, items = null }) {
  r.meta.seat = { i: fi, j: fj };
  r.put((L, iso, I, J) => officeChair(L, iso, I + fi - 7, J + fj, chair));
  r.put((L, iso, I, J) => {
    desk(L, iso, I + fi + 2, J + fj - deskDj / 2, deskDi, deskDj, deskH, { ...dc, panel });
    if (items) items(L, iso, I + fi + 2, J + fj - deskDj / 2, deskH);
  }, { fg: true });
  r.meta.desk = { i: fi + 2, j: fj - deskDj / 2, di: deskDi, dj: deskDj, h: deskH };
}
const chairOf = (ac) => ({ seat: ac.mid, seatDark: ac.dark, back: ac.mid, backDark: ac.dark });

// teclado + papéis no tampo
function keyboard(L, iso, i, j, z) {
  iso.box(L, i + 3, j + 10, z, 5, 10, 1, { top: (u, v) => ((u + v) % 2 ? 'light' : 'silver'), left: 'gray', right: 'gray' });
}

export const ROOM_DRAW = {};

// ================================================================ RECEPÇÃO (orquestrador)
ROOM_DRAW.orquestrador = {
  floor(r) {
    r.floor(planks('woodLight', 'tan', 'wood'));
    rug(r, 28, 26, 64, 60, { fill: 'orange', border: 'orangeDark', inner: 'orangeLight' });
  },
  furniture(r) {
    workstation(r, 52, 56, { desk: { top: 'orangeLight', edge: 'orange', side: 'orange', sideDark: 'orangeDark' }, chair: chairOf(r.ac), items: keyboard });
    r.put((L, iso, I, J) => plant(L, iso, I + 112, J + 14, { size: 3 }));
  },
};

ROOM_DRAW.roteirista = {
  floor(r) {
    r.floor(planks('wood', 'woodLight', 'woodDark'));
    rug(r, 28, 26, 64, 60, { fill: 'yellow', border: 'yellowDark', inner: 'lamp' });
  },
  furniture(r) {
    r.put((L, iso, I, J) => bookshelfJ(L, iso, I + 6, J + 0, 30, 12, 44, { wood: 'wood', woodDark: 'woodDark', woodLight: 'woodLight', books: ['red', 'blue', 'green', 'yellow', 'cream', 'purple', 'orange'], seed: 3 }));
    workstation(r, 52, 56, { desk: { top: 'woodLight', edge: 'wood', side: 'wood', sideDark: 'woodDark' }, chair: chairOf(r.ac) });
  },
};

ROOM_DRAW['editor-video'] = {
  floor(r) { r.floor((u, v) => ((u * 7 + v * 13) % 23 === 0 ? 'purpleDark' : 'ink')); },
  furniture(r) {
    workstation(r, 52, 56, { desk: { top: 'shadow', edge: 'ink', side: 'ink', sideDark: 'outline' }, chair: chairOf(r.ac), items: keyboard });
  },
};

ROOM_DRAW.animador = {
  floor(r) { r.floor(planks('sand', 'cream', 'tan')); rug(r, 28, 26, 64, 60, { fill: 'cyan', border: 'cyanDark', inner: 'cyanLight' }); },
  furniture(r) { workstation(r, 52, 56, { desk: { top: 'white', edge: 'light', side: 'cyan', sideDark: 'cyanDark' }, chair: chairOf(r.ac) }); },
};

ROOM_DRAW.copa = {
  floor(r) { r.floor(checker('cream', 'brownLight', 8)); },
  furniture(r) { r.meta.seat = { i: 60, j: 60 }; },
};

ROOM_DRAW.programador = {
  floor(r) { r.floor(checker('slate', 'steel', 16, 'navy')); },
  furniture(r) { workstation(r, 60, 60, { desk: { top: 'silver', edge: 'gray', side: 'gray', sideDark: 'shadow' }, chair: chairOf(r.ac), items: keyboard }); },
};
ROOM_DRAW.desenvolvedor = {
  floor(r) { r.floor(checker('bluePale', 'white', 16, 'light')); },
  furniture(r) { workstation(r, 60, 60, { desk: { top: 'white', edge: 'light', side: 'blue', sideDark: 'blueDark' }, chair: chairOf(r.ac), items: keyboard }); },
};
ROOM_DRAW.designer = {
  floor(r) { r.floor(planks('sand', 'tan', 'woodLight')); rug(r, 36, 30, 60, 60, { fill: 'pink', border: 'pinkDark', inner: 'pinkLight' }); },
  furniture(r) { workstation(r, 60, 60, { desk: { top: 'white', edge: 'light', side: 'pink', sideDark: 'pinkDark' }, chair: chairOf(r.ac) }); },
};
ROOM_DRAW.revisor = {
  floor(r) { r.floor(checker('redPale', 'white', 16, 'light')); },
  furniture(r) { workstation(r, 60, 60, { desk: { top: 'white', edge: 'light', side: 'red', sideDark: 'redDark' }, chair: chairOf(r.ac), items: keyboard }); },
};
ROOM_DRAW.lounge = {
  floor(r) { r.floor((u, v) => ((u + v * 3) % 11 === 0 ? 'teal' : 'tealLight')); },
  furniture(r) { r.meta.seat = { i: 60, j: 60 }; },
};
