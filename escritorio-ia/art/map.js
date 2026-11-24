// O prédio isométrico: 8 salas + copa + lounge ligados por um corredor diagonal.
// Gera map_bg (atrás dos personagens), map_fg (na frente) e os dados do manifest (poly, seat, door, paths...).
//
// Planta (tiles de 16 unidades; i → sudeste, j → sudoeste):
//   fileira de trás  j ∈ [0, 7)   : orquestrador | roteirista | editor-video | animador | copa
//   corredor         j ∈ [7, 13)  : elevador na ponta esquerda, passadeira no meio
//   fileira da frente j ∈ [13, 20): programador | desenvolvedor | designer | revisor | lounge
//   cada sala tem 8 tiles em i (128 unidades) e 7 em j (112 unidades).
// Paredes altas só no fundo de cada fileira (com decoração); divisórias baixas entre salas vizinhas,
// para que nenhuma parede esconda o piso de outra sala. Frente aberta.
import { Canvas } from './draw.js';
import { Iso, Layer, T, wallDecal } from './iso.js';
import { ACCENT } from './palette.js';
import { ROOM_DRAW, SEATS, SOFA, DOOR } from './rooms.js';

export const RI = 8 * T, RJ = 7 * T, CJ = 6 * T; // tamanho da sala e largura do corredor (unidades)
export const SLOTS = 5;
export const WALL_H = 44, WALL_T = 4, PART_H = 14, SLAB = 8;
export const BACK_J0 = 0, CORR_J0 = RJ, FRONT_J0 = RJ + CJ, MAX_I = SLOTS * RI, MAX_J = FRONT_J0 + RJ;
export const SPINE_J = CORR_J0 + 22; // linha de caminhada no corredor (parte visível)

const MARGIN_X = 20, MARGIN_TOP = 18, MARGIN_BOTTOM = 14;
export const MAP_W = MAX_I + MAX_J + WALL_T * 2 + MARGIN_X * 2;
export const MAP_H = (MAX_I + MAX_J) / 2 + WALL_H + WALL_T + SLAB + MARGIN_TOP + MARGIN_BOTTOM;
export const iso = new Iso(MARGIN_X + WALL_T + MAX_J, MARGIN_TOP + WALL_H + WALL_T);

export const LAYOUT = {
  back: ['orquestrador', 'roteirista', 'editor-video', 'animador', 'copa'],
  front: ['programador', 'desenvolvedor', 'designer', 'revisor', 'lounge'],
};
export function roomOrigin(id) {
  let k = LAYOUT.back.indexOf(id);
  if (k >= 0) return { I0: k * RI, J0: BACK_J0, row: 'back', k };
  k = LAYOUT.front.indexOf(id);
  return { I0: k * RI, J0: FRONT_J0, row: 'front', k };
}

/** Contexto de desenho de uma sala: converte coordenadas locais em globais e decide bg/fg. */
export class RoomCtx {
  constructor(id, bg, fg, L) {
    Object.assign(this, roomOrigin(id));
    this.id = id; this.bg = bg; this.fg = fg; this.L = L; this.iso = iso;
    this.ac = ACCENT[id];
    this.meta = { id };
  }
  /** Desenha `fn(L, iso, I0, J0)` numa camada e carimba (com contorno) em bg ou fg. */
  put(fn, { fg = false, outline = 'outline' } = {}) { fn(this.L, iso, this.I0, this.J0); this.L.stamp(fg ? this.fg : this.bg, { outline }); }
  /** Decalque plano na parede do fundo (face +j, plano j=J0) com borda esquerda em i local `at` e topo em z. */
  wallJ(src, at, z) { wallDecal(iso, this.bg, src, { face: 'J', wall: this.J0, at: this.I0 + at, z }); }
  /** Decalque na parede esquerda (face +i, plano i=I0). `at` = j local da borda esquerda na tela (maior j). */
  wallI(src, at, z, target = this.bg) { wallDecal(iso, target, src, { face: 'I', wall: this.I0, at: this.J0 + at, z }); }
  floor(col) { iso.top(this.bg, this.I0, this.J0, this.I0 + RI, this.J0 + RJ, 0, col); }
  pt(i, j, z = 0) { return iso.pt(this.I0 + i, this.J0 + j, z); }
}

// ---------------------------------------------------------------- paredes
function wallFace(ac, { dark = false } = {}) {
  // faixa superior escura, parede clara, lambri no destaque e rodapé
  return (u, v) => {
    if (v < 2) return ac.dark;
    if (v >= WALL_H - 3) return dark ? 'outline' : ac.dark;
    if (v >= WALL_H - 14) return v === WALL_H - 14 ? ac.light : ac.mid;
    return dark ? ac.pale : ac.pale;
  };
}

export function buildMap() {
  const bg = new Canvas(MAP_W, MAP_H), fg = new Canvas(MAP_W, MAP_H), L = new Layer(MAP_W, MAP_H);
  const rooms = {};
  const ctx = (id) => (rooms[id] ||= new RoomCtx(id, bg, fg, L));

  // ---------- laje (espessura do piso nas bordas da frente)
  iso.faceI(bg, MAX_I, 0, MAX_J, -SLAB, 0, (u, v) => (v === 0 ? 'silver' : 'shadow'));
  iso.faceJ(bg, MAX_J, 0, MAX_I, -SLAB, 0, (u, v) => (v === 0 ? 'light' : 'gray'));
  L.stamp(bg); // nada (só zera)

  // ---------- pisos
  for (const id of [...LAYOUT.back, ...LAYOUT.front]) ROOM_DRAW[id].floor(ctx(id));
  corridorFloor(bg);

  // ---------- paredes externas do fundo (fileira de trás) e parede esquerda externa
  for (const id of LAYOUT.back) {
    const r = ctx(id);
    iso.box(L, r.I0, -WALL_T, 0, RI, WALL_T, WALL_H, { top: 'ink', left: wallFace(r.ac) });
    L.stamp(bg);
  }
  // canto
  iso.box(L, -WALL_T, -WALL_T, 0, WALL_T, WALL_T, WALL_H, { top: 'ink' });
  L.stamp(bg);
  // parede esquerda: orquestrador, corredor (elevador), programador
  leftOuterWall(L, bg, ctx);

  // ---------- fileira de trás (móveis), com divisórias baixas entre as salas
  LAYOUT.back.forEach((id, k) => {
    const r = ctx(id);
    if (k > 0) partition(L, bg, r.I0, BACK_J0, RJ, r.ac);
    ROOM_DRAW[id].wall?.(r);
    ROOM_DRAW[id].furniture(r);
  });

  // ---------- corredor: objetos
  corridorProps(L, bg, fg);

  // ---------- fileira da frente: parede alta do lado do corredor (com portas) + móveis
  LAYOUT.front.forEach((id, k) => {
    const r = ctx(id);
    const door = ROOM_DRAW[id].doorSpan || [8, 40];
    frontWall(L, bg, r, door);
    if (k > 0) partition(L, bg, r.I0, FRONT_J0, RJ, r.ac);
    ROOM_DRAW[id].wall?.(r);
    ROOM_DRAW[id].furniture(r);
  });

  return { bg, fg, rooms };
}

function corridorFloor(bg) {
  iso.top(bg, 0, CORR_J0, MAX_I, FRONT_J0, 0, (u, v, wi, wj) => {
    const tu = Math.floor(wi / 16), tv = Math.floor((wj - CORR_J0) / 16);
    // passadeira no meio da parte visível
    const rj = wj - CORR_J0;
    if (rj >= 10 && rj < 32) {
      if (rj === 10 || rj === 31) return 'tealDark';
      if (rj === 12 || rj === 29) return 'tealLight';
      return wi % 32 === 0 ? 'tealDark' : 'teal';
    }
    const edge = (wi % 16 === 0) || ((wj - CORR_J0) % 16 === 0);
    if (edge) return 'silver';
    return (tu + tv) % 2 ? 'light' : 'white';
  });
}

function partition(L, bg, I, J0, len, ac) {
  iso.box(L, I - WALL_T, J0, 0, WALL_T, len, PART_H, { top: ac.light, right: (u, v) => (v < 2 ? ac.mid : v >= PART_H - 2 ? ac.dark : ac.pale), left: ac.dark });
  L.stamp(bg);
}

function frontWall(L, bg, r, [d0, d1]) {
  const J = FRONT_J0;
  const face = wallFace(r.ac);
  // trecho à esquerda da porta, porta (verga), trecho à direita
  if (d0 > 0) { iso.box(L, r.I0, J - WALL_T, 0, d0, WALL_T, WALL_H, { top: 'ink', left: face, right: r.ac.dark }); L.stamp(bg); }
  // verga sobre a porta
  iso.box(L, r.I0 + d0, J - WALL_T, 34, d1 - d0, WALL_T, WALL_H - 34, { top: 'ink', left: (u, v) => (v < 2 ? r.ac.dark : v === WALL_H - 35 ? 'outline' : r.ac.pale) });
  L.stamp(bg);
  iso.box(L, r.I0 + d1, J - WALL_T, 0, RI - d1, WALL_T, WALL_H, { top: 'ink', left: face });
  L.stamp(bg);
  // batentes (moldura da porta)
  iso.box(L, r.I0 + d0, J - WALL_T, 0, 2, WALL_T + 1, 34, { top: 'woodLight', left: 'wood', right: 'woodLight' });
  L.stamp(bg);
  iso.box(L, r.I0 + d1 - 2, J - WALL_T, 0, 2, WALL_T + 1, 34, { top: 'woodLight', left: 'wood', right: 'woodLight' });
  L.stamp(bg);
}

function leftOuterWall(L, bg, ctx) {
  const segs = [
    [BACK_J0, RJ, ACCENT.orquestrador],
    [CORR_J0, CJ, { mid: 'silver', dark: 'gray', light: 'white', pale: 'light' }],
    [FRONT_J0, RJ, ACCENT.programador],
  ];
  for (const [j0, len, ac] of segs) {
    iso.box(L, -WALL_T, j0, 0, WALL_T, len, WALL_H, {
      top: 'ink',
      right: (u, v) => {
        if (v < 2) return ac.dark;
        if (v >= WALL_H - 3) return ac.dark;
        if (v >= WALL_H - 14) return v === WALL_H - 14 ? ac.light : ac.dark;
        return ac.light === 'white' ? 'light' : ac.light;
      },
    });
    L.stamp(bg);
  }
  // fecha a borda da frente (j = MAX_J) da parede esquerda
  iso.box(L, -WALL_T, MAX_J, 0, WALL_T, 0.01, WALL_H, {});
  // elevador no corredor
  const el = new Canvas(44, 36);
  el.rect(0, 0, 44, 36, 'outline');
  el.rect(1, 1, 42, 35, 'gray');
  el.rect(3, 3, 38, 33, 'outline');
  el.rect(4, 4, 17, 32, 'silver'); el.rect(23, 4, 17, 32, 'silver');
  el.vline(21, 4, 35, 'shadow'); el.vline(22, 4, 35, 'light');
  for (let y = 6; y < 34; y += 3) { el.px(6, y, 'light'); el.px(25, y, 'light'); }
  wallDecal(iso, bg, el, { face: 'I', wall: 0, at: CORR_J0 + 46, z: 38 });
  // painel de botões e seta
  const btn = new Canvas(6, 10);
  btn.rect(0, 0, 6, 10, 'outline'); btn.rect(1, 1, 4, 8, 'ink'); btn.px(2, 3, 'lamp'); btn.px(3, 3, 'lamp'); btn.px(2, 6, 'orange'); btn.px(3, 6, 'orange');
  wallDecal(iso, bg, btn, { face: 'I', wall: 0, at: CORR_J0 + 64, z: 26 });
}

function corridorProps(L, bg, fg) {
  // nada por enquanto; plantas e bancos entram em rooms.js (corridor)
  ROOM_DRAW.corridor?.(L, bg, fg);
}

// ---------------------------------------------------------------- dados para o manifest
/** Converte coordenadas de mundo em ponto de tela inteiro. */
const P = (wi, wj, z = 0) => iso.pt(wi, wj, z);

/**
 * Geometria do manifest v2: poly, label, seat, door de cada sala; vagas do lounge; grafo do corredor.
 * Tudo em pixels do mapa.
 */
export function layoutData() {
  const rooms = {};
  const nodes = {};
  const edges = [];
  const spine = []; // [i, nome]
  const addSpine = (i) => {
    const name = `c_${Math.round(i)}`;
    if (!nodes[name]) { nodes[name] = P(i, SPINE_J); spine.push([i, name]); }
    return name;
  };
  for (const id of [...LAYOUT.back, ...LAYOUT.front]) {
    const { I0, J0, row } = roomOrigin(id);
    const s = SEATS[id];
    const poly = [P(I0, J0), P(I0 + RI, J0), P(I0 + RI, J0 + RJ), P(I0, J0 + RJ)].map((p) => [p.x, p.y]);
    const lab = P(I0 + RI / 2, J0 + RJ);
    let doorPt, spineI;
    if (row === 'back') { spineI = I0 + 40; doorPt = P(I0 + 40, J0 + RJ - 6); }
    else { const span = ROOM_DRAW[id].doorSpan || DOOR; spineI = I0 + (span[0] + span[1]) / 2; doorPt = P(spineI, J0 + 8); }
    const door = `n_${id}`;
    nodes[door] = doorPt;
    edges.push([door, addSpine(spineI)]);
    rooms[id] = {
      label: { x: lab.x, y: lab.y - (row === 'back' ? 4 : 10) },
      poly,
      seat: { ...P(I0 + s.i, J0 + s.j), flip: false },
      door,
    };
  }
  // elevador na ponta esquerda do corredor
  nodes.n_elevador = P(6, SPINE_J);
  spine.push([6, 'n_elevador']);
  spine.sort((a, b) => a[0] - b[0]);
  for (let k = 1; k < spine.length; k++) edges.push([spine[k - 1][1], spine[k][1]]);

  const L0 = roomOrigin('lounge');
  const sofa = [0, 1, 2, 3].map((k) => ({ ...P(L0.I0 + SOFA.i + 14, L0.J0 + SOFA.j + 16 + k * 20), flip: false }));
  const visitors = [[88, 24], [112, 74], [62, 98]].map(([i, j]) => ({ ...P(L0.I0 + i, L0.J0 + j), flip: true }));
  rooms.lounge.seat = { ...sofa[0] };
  return { rooms, lounge: { sofa, visitors }, paths: { nodes, edges } };
}
