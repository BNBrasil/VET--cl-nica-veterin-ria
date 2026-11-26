// O prédio isométrico: 8 salas + copa + lounge ligados por corredores. Gera map_bg (atrás dos personagens),
// map_fg (na frente) e os dados do manifest (poly, seat, door, paths...).
//
// O prédio é montado em "alas". Uma ala tem coordenadas locais (i → sudeste ao longo do corredor,
// j → sudoeste em profundidade): fileira de trás j ∈ [0, RJ), corredor j ∈ [RJ, RJ+CJ) e, opcionalmente,
// fileira da frente depois do corredor. Cada ala tem seu próprio Iso (deslocamento, andar e, na ala
// esquerda do L, transposição i↔j). Formatos (temas/CONTRATO.md):
//   duas-fileiras  1 ala, 5 salas atrás + 5 na frente (o desenho original, idêntico)
//   uma-fileira    1 ala, as 10 salas lado a lado e o corredor na frente
//   L              2 alas: a de trás (como a fileira de trás original) e a esquerda, transposta, descendo
//   andares        2 alas: térreo na frente e 1º andar atrás e acima, ligados por uma escada no fim do corredor
// Paredes altas só no fundo de cada fileira (com decoração); divisórias baixas entre salas vizinhas.
import { Canvas } from './draw.js';
import { Iso, TransIso, RecIso, Layer, T, wallDecal } from './iso.js';
import { ACCENT } from './palette.js';
import { ROOM_DRAW, SEATS, SOFA, DOOR, NATIVE_FLOOR, floorPattern, LOUNGE_VISITORS } from './rooms.js';
import * as Fu from './furniture.js';
import * as D from './decals.js';

export const WALL_H = 44, WALL_T = 4, PART_H = 14, SLAB = 8;
export const BASE_RI = 8 * T, BASE_RJ = 7 * T;
export const TAMANHOS = { pequena: [7, 6], media: [8, 7], grande: [10, 8] };
const MARGIN_X = 20, MARGIN_TOP = 18, MARGIN_BOTTOM = 14;
const STAIR_W = 48;

const BACK_ORIG = ['orquestrador', 'roteirista', 'editor-video', 'animador', 'copa'];
const FRONT_ORIG = ['programador', 'desenvolvedor', 'designer', 'revisor', 'lounge'];

/** Zona de ancoragem: perto (0), centro (d/2) ou longe (d) conforme a posição c na sala de tamanho base. */
export function zone(c, base, d) {
  if (!d) return 0;
  if (c < base * 0.36) return 0;
  if (c > base * 0.64) return d;
  return d / 2;
}

// ---------------------------------------------------------------- plano (formato + tamanho)
/**
 * Plano do prédio a partir de cfg.mapa. Retorna { W, H, RI, RJ, wings, world, formato, tamanho }.
 * Cada ala: { name, iso, trans, back, front, CJ, start, cStart, spineJ, backWallH, leftWall, elevator, end }.
 */
export function criarPlano(mapa = { formato: 'duas-fileiras', tamanhoSala: 'media' }) {
  const formato = mapa.formato || 'duas-fileiras', tamanho = mapa.tamanhoSala || 'media';
  const [ti, tj] = TAMANHOS[tamanho] || TAMANHOS.media;
  let RI = ti * T;
  const RJ = tj * T;
  const wings = [];
  const W = (o) => wings.push({ front: [], start: 0, cStart: 0, leftWall: true, elevator: true, backWallH: WALL_H, oi: 0, oj: 0, e: 0, trans: false, end: null, ...o });
  if (formato === 'uma-fileira') {
    RI = Math.min(RI, 7 * T);
    W({ name: 'a', back: ['orquestrador', 'roteirista', 'editor-video', 'animador', 'programador', 'desenvolvedor', 'designer', 'revisor', 'copa', 'lounge'], CJ: 64 });
  } else if (formato === 'L') {
    RI = Math.min(RI, 7 * T);
    const CJ = 64;
    W({ name: 'a', back: BACK_ORIG, CJ });
    W({ name: 'b', back: FRONT_ORIG, CJ, trans: true, start: RJ + CJ, cStart: RJ + CJ, leftWall: false, elevator: false, firstPartition: true });
  } else if (formato === 'andares') {
    const CJ = 64, e = WALL_H + SLAB;
    W({ name: 'sup', back: BACK_ORIG, CJ, oj: -(RJ + CJ), e, end: { kind: 'nicho', w: STAIR_W } });
    W({ name: 'a', back: FRONT_ORIG, CJ, backWallH: e, end: { kind: 'escada', w: STAIR_W, h: e } });
  } else {
    W({ name: 'a', back: BACK_ORIG, front: FRONT_ORIG, CJ: 6 * T });
  }
  for (const w of wings) {
    w.RI = RI; w.RJ = RJ;
    w.CORR_J0 = RJ; w.FRONT_J0 = RJ + w.CJ;
    w.len = w.start + w.back.length * RI + (w.end ? w.end.w : 0);
    w.corrLen = Math.max(w.len, w.start + w.front.length * RI);
    w.depth = w.front.length ? RJ + w.CJ + RJ : RJ + w.CJ;
    w.spineJ = w.CORR_J0 + (w.front.length ? 22 : w.CJ / 2);
  }

  // ---------- caixa envolvente em pixels (com tudo em X0=Y0=0) → tamanho do mapa e origem
  const pts = [];
  const add = (w, i, j, z) => {
    const wi = w.oi + (w.trans ? j : i), wj = w.oj + (w.trans ? i : j);
    pts.push([wi - wj, (wi + wj) / 2 - z - w.e]);
  };
  for (const w of wings) {
    const top = Math.max(w.backWallH, WALL_H);
    for (const [i, j] of [[-WALL_T, -WALL_T], [w.len, -WALL_T], [-WALL_T, w.depth], [w.corrLen, w.depth], [w.len, w.RJ]]) { add(w, i, j, top); add(w, i, j, -SLAB); }
  }
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const MAP_W = maxX - minX + MARGIN_X * 2, MAP_H = maxY - minY + MARGIN_TOP + MARGIN_BOTTOM;
  const X0 = MARGIN_X - minX, Y0 = MARGIN_TOP - minY;
  const world = new Iso(X0, Y0);
  for (const w of wings) {
    const base = new Iso(X0 + w.oi - w.oj, Y0 + (w.oi + w.oj) / 2 - w.e);
    w.base = base;
    w.iso = w.trans ? new TransIso(base) : base;
  }
  return { formato, tamanho, RI, RJ, W: MAP_W, H: MAP_H, X0, Y0, world, wings };
}

/** Lista de salas com a ala e a origem local de cada uma. */
export function placements(plan) {
  const out = {};
  for (const w of plan.wings) {
    w.back.forEach((id, k) => { out[id] = { wing: w, row: 'back', k, I0: w.start + k * w.RI, J0: 0 }; });
    w.front.forEach((id, k) => { out[id] = { wing: w, row: 'front', k, I0: w.start + k * w.RI, J0: w.FRONT_J0 }; });
  }
  return out;
}

// ---------------------------------------------------------------- contexto de uma sala
/** Contexto de desenho de uma sala: converte coordenadas locais em globais e decide bg/fg. */
export class RoomCtx {
  constructor(id, pl, bg, fg, L, style, plan) {
    this.id = id; this.bg = bg; this.fg = fg; this.L = L; this.plan = plan;
    this.wing = pl.wing; this.row = pl.row; this.k = pl.k; this.I0 = pl.I0; this.J0 = pl.J0;
    this.iso = pl.wing.iso;
    this.RI = pl.wing.RI; this.RJ = pl.wing.RJ;
    this.dI = this.RI - BASE_RI; this.dJ = this.RJ - BASE_RJ;
    this.ac = ACCENT[id];
    this.style = style?.salas?.[id] || {};
    this.noite = style?.iluminacao === 'noite';
    this.sky = style?.iluminacao === 'noite' ? 'navy' : style?.iluminacao === 'tarde' ? 'orangeLight' : 'blueLight';
    this.meta = { id };
    this.lights = style?.lights || null;
  }
  si(i) { return i + zone(i, BASE_RI, this.dI); }
  sj(j) { return j + zone(j, BASE_RJ, this.dJ); }
  cshift() { return { i: this.dI / 2, j: this.dJ / 2 }; }
  /** Deslocamento de ancoragem de um desenho (perto/centro/longe em cada eixo). */
  anchorShift(fn, anchor) {
    if (!this.dI && !this.dJ) return [0, 0];
    const z = (a, c, base, d) => (a === 'n' ? 0 : a === 'f' ? d : a === 'c' ? d / 2 : zone(c, base, d));
    if (anchor === 'c') return [this.dI / 2, this.dJ / 2];
    let ci = 0, cj = 0;
    if (!Array.isArray(anchor) || anchor.some((a) => !a)) {
      const rec = new RecIso();
      fn(nullLayer(), rec, 0, 0);
      ci = (rec.i0 + rec.i1) / 2; cj = (rec.j0 + rec.j1) / 2;
    }
    const [ai, aj] = Array.isArray(anchor) ? anchor : [null, null];
    return [z(ai, ci, BASE_RI, this.dI), z(aj, cj, BASE_RJ, this.dJ)];
  }
  /** Desenha `fn(L, iso, I0, J0)` numa camada e carimba (com contorno) em bg ou fg. */
  put(fn, { fg = false, outline = 'outline', anchor = null } = {}) {
    const [sI, sJ] = this.anchorShift(fn, anchor);
    fn(this.L, this.iso, this.I0 + sI, this.J0 + sJ);
    this.L.stamp(fg ? this.fg : this.bg, { outline });
  }
  /** Decalque plano na parede do fundo (face +j, plano j=J0) com borda esquerda em i local `at` e topo em z. */
  wallJ(src, at, z) {
    let a = at + zone(at + src.w, BASE_RI, this.dI);
    if (this.dI) a = Math.max(2, Math.min(this.RI - src.w - 2, a));
    wallDecal(this.iso, this.bg, src, { face: 'J', wall: this.J0, at: this.I0 + a, z });
  }
  /** Decalque na parede esquerda (face +i, plano i=I0). `at` = j local da borda esquerda na tela (maior j). */
  wallI(src, at, z, target = this.bg) { wallDecal(this.iso, target, src, { face: 'I', wall: this.I0, at: this.J0 + at + zone(at, BASE_RJ, this.dJ), z }); }
  floor(col) { this.iso.top(this.bg, this.I0, this.J0, this.I0 + this.RI, this.J0 + this.RJ, 0, col); }
  /** Piso da sala: o nativo (identidade) ou o do tema. */
  paintFloor() {
    const nat = NATIVE_FLOOR[this.id](this.ac);
    const f = this.style.floor;
    if (!f) return this.floor(nat.fn || floorPattern(nat.tipo, nat.cols, nat.k));
    const tipo = f.tipo || nat.tipo;
    const cols = f.cols || (tipo === nat.tipo ? nat.cols : defaultFloorCols(tipo, this.ac));
    this.floor(floorPattern(tipo, cols, f.k || (tipo === nat.tipo ? nat.k : undefined)));
  }
  /** Cor de brilho (neon): o próprio nome — à noite o slot é mantido aceso pela paleta. */
  glow(name) { return name; }
  /** Registra uma luz (luminária) no ponto local (i, j) com raio r (unidades de mundo). */
  light(i, j, r) { if (this.lights) { const p = this.iso.pt(this.I0 + this.si(i), this.J0 + this.sj(j)); this.lights.push({ x: p.x, y: p.y, r }); } }
  pt(i, j, z = 0) { return this.iso.pt(this.I0 + i, this.J0 + j, z); }
}
function nullLayer() { return { px() { return this; }, rect() { return this; }, stamp() {}, get() { return -1; }, w: 0, h: 0 }; }

export function defaultFloorCols(tipo, ac) {
  switch (tipo) {
    case 'madeira': return ['woodLight', 'tan', 'wood'];
    case 'carpete': return [ac.dark, ac.mid, ac.mid];
    case 'azulejo': return ['white', 'light', 'silver'];
    case 'concreto': return ['silver', 'gray', 'light'];
    case 'xadrez': return ['white', 'ink', 'ink'];
    case 'grama': return ['green', 'greenDark', 'greenLight'];
    default: return ['light', 'silver', 'gray'];
  }
}

// ---------------------------------------------------------------- paredes
/**
 * Textura de parede (u, v) para uma parede de altura H. w = estilo { tipo, main, dark, light, lambri }.
 * O "lisa" nativo é o desenho original (faixa escura no topo, parede clara, lambri no destaque, rodapé).
 */
export function wallTex(w, H) {
  const { main, dark, light, lambri } = w;
  const band = (u, v) => (v < 2 ? dark : v >= H - 3 ? dark : null);
  switch (w.tipo || 'lisa') {
    case 'tijolo': {
      const mortar = w.mortar || light;
      return (u, v) => {
        const b = band(u, v); if (b) return b;
        const vv = v - 2, row = Math.floor(vv / 6);
        if (vv % 6 === 5) return mortar;
        if ((u + (row % 2) * 7) % 14 === 0) return mortar;
        return (u + row * 3) % 23 === 0 ? dark : main;
      };
    }
    case 'painel':
      return (u, v) => {
        const b = band(u, v); if (b) return b;
        if (v === H - 16 || v === H - 15) return v === H - 16 ? light : lambri;
        if (u % 12 === 0) return dark;
        if (u % 12 === 1) return light;
        return main;
      };
    case 'papel':
      return (u, v) => {
        const b = band(u, v); if (b) return b;
        if (v >= H - 14) return v === H - 14 ? light : lambri;
        const a = (u + (Math.floor(v / 7) % 2) * 5) % 10, c = (v - 2) % 7;
        if ((a === 4 && c === 3) || (a === 5 && (c === 2 || c === 4)) || (a === 6 && c === 3)) return w.motif || light;
        return main;
      };
    case 'vidro':
      return (u, v) => {
        if (v < 2 || v >= H - 3) return w.frame || 'steel';
        if (u % 24 === 0 || v === H - 12) return w.frame || 'steel';
        if (v > H - 12) return w.frame2 || 'gray';
        const d = (u + v) % 24;
        if (d === 3 || d === 4 || d === 9) return w.shine || 'snow';
        return main;
      };
    default:
      return (u, v) => {
        if (v < 2) return dark;
        if (v >= H - 3) return dark;
        if (v >= H - 14) return v === H - 14 ? light : lambri;
        return main;
      };
  }
}
/** Estilo de parede de uma sala (o tema pode trocar tipo e cores). outer = parede esquerda externa. */
function wallStyle(r, { outer = false } = {}) {
  const ac = r.ac, s = r.style.wall;
  if (!s) return outer ? { tipo: 'lisa', main: ac.light, dark: ac.dark, light: ac.light, lambri: ac.dark } : { tipo: 'lisa', main: ac.pale, dark: ac.dark, light: ac.light, lambri: ac.mid };
  return { lambri: ac.mid, ...s, dark: s.dark || ac.dark, light: s.light || ac.light };
}

// ---------------------------------------------------------------- montagem do mapa
export function buildMap(plan, style = {}) {
  const bg = new Canvas(plan.W, plan.H), fg = new Canvas(plan.W, plan.H), L = new Layer(plan.W, plan.H);
  const pls = placements(plan);
  const rooms = {};
  const ctx = (id) => (rooms[id] ||= new RoomCtx(id, pls[id], bg, fg, L, style, plan));

  slabs(plan, bg, L);
  for (const w of plan.wings) drawWing(w, plan, bg, fg, L, ctx, style);
  return { bg, fg, rooms };
}

/** Lajes (espessura do piso nas bordas que ficam de frente). */
function slabs(plan, bg, L) {
  const { world: iso, wings } = plan;
  const fI = (u, v) => (v === 0 ? 'silver' : 'shadow'), fJ = (u, v) => (v === 0 ? 'light' : 'gray');
  if (plan.formato === 'L') {
    const [a, b] = wings, D = a.RJ, CJ = a.CJ;
    iso.faceI(bg, a.len, 0, D + CJ, -SLAB, 0, fI);
    iso.faceJ(bg, D + CJ, D + CJ, a.len, -SLAB, 0, fJ);
    iso.faceI(bg, D + CJ, D + CJ, b.len, -SLAB, 0, fI);
    iso.faceJ(bg, b.len, 0, D + CJ, -SLAB, 0, fJ);
  } else if (plan.formato === 'andares') {
    // laje de cada andar; a frente do andar de cima é a parede do fundo do térreo
    for (const w of wings) {
      w.base.faceI(bg, w.len, 0, w.depth, -SLAB, 0, fI);
      w.base.faceJ(bg, w.depth, 0, w.len, -SLAB, 0, fJ);
    }
    // lateral direita do bloco do andar de cima (do chão até o piso dele)
    const sup = wings[0], a = wings[1];
    a.base.faceI(bg, sup.len, sup.oj, 0, 0, sup.e, (u, v) => ((v % 8 === 0) || (u + Math.floor(v / 8) * 8) % 16 === 0 ? 'gray' : 'silver'));
  } else {
    const w = wings[0];
    iso.faceI(bg, w.len, 0, w.depth, -SLAB, 0, fI);
    iso.faceJ(bg, w.depth, 0, w.corrLen, -SLAB, 0, fJ);
  }
  L.stamp(bg); // nada (só zera)
}

function drawWing(w, plan, bg, fg, L, ctx, style) {
  const iso = w.iso;
  // ---------- pisos
  for (const id of [...w.back, ...w.front]) ROOM_DRAW[id].floor(ctx(id));
  if (w.end) endFloor(w, bg, style);
  corridorFloor(w, bg, style);

  // ---------- paredes externas do fundo (fileira de trás)
  for (const id of w.back) {
    const r = ctx(id);
    iso.box(L, r.I0, -WALL_T, 0, w.RI, WALL_T, w.backWallH, { top: 'ink', left: wallTex(wallStyle(r), w.backWallH) });
    L.stamp(bg);
  }
  if (w.end) {
    const I = w.start + w.back.length * w.RI;
    if (w.end.kind === 'nicho') { iso.box(L, I, -WALL_T, 0, w.end.w, WALL_T, w.backWallH, { top: 'ink', left: wallTex({ tipo: 'lisa', main: 'light', dark: 'gray', light: 'white', lambri: 'silver' }, w.backWallH) }); L.stamp(bg); }
  }
  // canto
  if (w.leftWall) { iso.box(L, -WALL_T, -WALL_T, 0, WALL_T, WALL_T, Math.max(w.backWallH, WALL_H), { top: 'ink' }); L.stamp(bg); }
  if (w.leftWall) leftOuterWall(w, L, bg, ctx, style);

  // ---------- fileira de trás (móveis), com divisórias baixas entre as salas
  w.back.forEach((id, k) => {
    const r = ctx(id);
    if (k > 0 || w.firstPartition) partition(L, bg, iso, r.I0, 0, w.RJ, r);
    neonStrip(r, w.backWallH);
    ROOM_DRAW[id].wall?.(r);
    ROOM_DRAW[id].furniture(r);
  });
  if (w.end) drawEnd(w, L, bg, fg, ctx, style);

  // ---------- corredor: objetos
  corridorProps(w, L, bg, fg, style);

  // ---------- fileira da frente: parede alta do lado do corredor (com portas) + móveis
  w.front.forEach((id, k) => {
    const r = ctx(id);
    const door = ROOM_DRAW[id].doorSpan || DOOR;
    frontWall(L, bg, r, door);
    if (k > 0) partition(L, bg, iso, r.I0, w.FRONT_J0, w.RJ, r);
    ROOM_DRAW[id].wall?.(r);
    ROOM_DRAW[id].furniture(r);
  });
}

function corridorFloor(w, bg, style) {
  const s = style.salas?.corredor || {}, ac = ACCENT.lounge;
  const J0 = w.CORR_J0, i0 = w.cStart && w.trans ? w.cStart : 0;
  const run0 = w.spineJ - J0 - 12, run1 = w.spineJ - J0 + 10; // passadeira centrada na linha de caminhada
  const f = s.floor;
  const tiles = f ? floorPattern(f.tipo || 'azulejo', f.cols || defaultFloorCols(f.tipo || 'azulejo', ac), f.k) : null;
  w.iso.top(bg, i0, J0, w.corrLen, w.FRONT_J0, 0, (u, v, wi, wj) => {
    const rj = wj - J0;
    if (rj >= run0 && rj < run1) {
      if (rj === run0 || rj === run1 - 1) return ac.dark;
      if (rj === run0 + 2 || rj === run1 - 3) return ac.light;
      return wi % 32 === 0 ? ac.dark : ac.mid;
    }
    if (tiles) return tiles(Math.floor(wi), Math.floor(rj));
    const tu = Math.floor(wi / 16), tv = Math.floor(rj / 16);
    const edge = (wi % 16 === 0) || (rj % 16 === 0);
    if (edge) return 'silver';
    return (tu + tv) % 2 ? 'light' : 'white';
  });
}

function partition(L, bg, iso, I, J0, len, r) {
  const ac = r.ac, pale = r.style.wall?.main || ac.pale;
  iso.box(L, I - WALL_T, J0, 0, WALL_T, len, PART_H, { top: ac.light, right: (u, v) => (v < 2 ? ac.mid : v >= PART_H - 2 ? ac.dark : pale), left: ac.dark });
  L.stamp(bg);
}

function frontWall(L, bg, r, [d0, d1]) {
  const J = r.J0, iso = r.iso, RI = r.RI;
  const ws = wallStyle(r);
  const face = wallTex(ws, WALL_H);
  // trecho à esquerda da porta, porta (verga), trecho à direita
  if (d0 > 0) { iso.box(L, r.I0, J - WALL_T, 0, d0, WALL_T, WALL_H, { top: 'ink', left: face, right: r.ac.dark }); L.stamp(bg); }
  // verga sobre a porta
  iso.box(L, r.I0 + d0, J - WALL_T, 34, d1 - d0, WALL_T, WALL_H - 34, { top: 'ink', left: (u, v) => (v < 2 ? ws.dark : v === WALL_H - 35 ? 'outline' : ws.main) });
  L.stamp(bg);
  iso.box(L, r.I0 + d1, J - WALL_T, 0, RI - d1, WALL_T, WALL_H, { top: 'ink', left: face });
  L.stamp(bg);
  // batentes (moldura da porta)
  iso.box(L, r.I0 + d0, J - WALL_T, 0, 2, WALL_T + 1, 34, { top: 'woodLight', left: 'wood', right: 'woodLight' });
  L.stamp(bg);
  iso.box(L, r.I0 + d1 - 2, J - WALL_T, 0, 2, WALL_T + 1, 34, { top: 'woodLight', left: 'wood', right: 'woodLight' });
  L.stamp(bg);
}

function neonStrip(r, H) {
  if (!r.style.neon) return;
  const col = r.ac.light;
  r.iso.faceJ(r.bg, r.J0, r.I0 + 2, r.I0 + r.RI - 2, H - 6, H - 5, col);
  r.iso.faceJ(r.bg, r.J0, r.I0 + 2, r.I0 + r.RI - 2, 4, 5, col);
}

function leftOuterWall(w, L, bg, ctx, style) {
  const iso = w.iso;
  const corrAc = { mid: 'silver', dark: 'gray', light: 'white', pale: 'light' };
  const segs = [];
  if (w.back.length) segs.push([0, w.RJ, ctx(w.back[0])]);
  segs.push([w.CORR_J0, w.CJ, null]);
  if (w.front.length) segs.push([w.FRONT_J0, w.RJ, ctx(w.front[0])]);
  for (const [j0, len, r] of segs) {
    const ws = r ? wallStyle(r, { outer: true }) : { tipo: 'lisa', main: 'light', dark: 'gray', light: 'white', lambri: 'gray' };
    const H = j0 === 0 ? Math.max(w.backWallH, WALL_H) : WALL_H;
    let tex;
    if (ws.tipo === 'lisa' && !(r && r.style.wall)) {
      const ac = r ? r.ac : corrAc;
      tex = (u, v) => {
        if (v < 2) return ac.dark;
        if (v >= H - 3) return ac.dark;
        if (v >= H - 14) return v === H - 14 ? ac.light : ac.dark;
        return ac.light === 'white' ? 'light' : ac.light;
      };
    } else tex = wallTex(ws, H);
    iso.box(L, -WALL_T, j0, 0, WALL_T, len, H, { top: 'ink', right: tex });
    L.stamp(bg);
  }
  // fecha a borda da frente da parede esquerda
  iso.box(L, -WALL_T, w.depth, 0, WALL_T, 0.01, WALL_H, {});
  if (!w.elevator) return;
  // elevador no corredor
  const el = new Canvas(44, 36);
  el.rect(0, 0, 44, 36, 'outline');
  el.rect(1, 1, 42, 35, 'gray');
  el.rect(3, 3, 38, 33, 'outline');
  el.rect(4, 4, 17, 32, 'silver'); el.rect(23, 4, 17, 32, 'silver');
  el.vline(21, 4, 35, 'shadow'); el.vline(22, 4, 35, 'light');
  for (let y = 6; y < 34; y += 3) { el.px(6, y, 'light'); el.px(25, y, 'light'); }
  wallDecal(iso, bg, el, { face: 'I', wall: 0, at: w.CORR_J0 + Math.min(46, w.CJ - 4), z: 38 });
  // painel de botões e seta
  const btn = new Canvas(6, 10);
  btn.rect(0, 0, 6, 10, 'outline'); btn.rect(1, 1, 4, 8, 'ink'); btn.px(2, 3, 'lamp'); btn.px(3, 3, 'lamp'); btn.px(2, 6, 'orange'); btn.px(3, 6, 'orange');
  wallDecal(iso, bg, btn, { face: 'I', wall: 0, at: w.CORR_J0 + Math.min(64, w.CJ), z: 26 });
  if (style.iluminacao === 'noite') { const s = D.sconce(true); wallDecal(iso, bg, s, { face: 'I', wall: 0, at: w.CORR_J0 + Math.min(58, w.CJ - 2) - (w.CJ < 96 ? 0 : 0), z: 46 }); }
}

// ---------------------------------------------------------------- pontas (escada / nicho) no formato andares
function endFloor(w, bg) {
  const I = w.start + w.back.length * w.RI;
  w.iso.top(bg, I, 0, I + w.end.w, w.RJ, 0, (u, v) => ((Math.floor(u / 16) + Math.floor(v / 16)) % 2 ? 'light' : 'white'));
}
function drawEnd(w, L, bg, fg, ctx) {
  const iso = w.iso, I = w.start + w.back.length * w.RI, SW = w.end.w;
  const last = ctx(w.back[w.back.length - 1]);
  partition(L, bg, iso, I, 0, w.RJ, { ac: { light: 'white', mid: 'silver', dark: 'gray', pale: 'light' }, style: {} });
  if (w.end.kind === 'nicho') {
    // nicho no fim do andar de cima: planta e banco
    iso.box(L, I + 6, 8, 0, 14, 30, 10, { top: 'woodLight', left: 'wood', right: 'woodDark' }); L.stamp(bg);
    Fu.plant(L, iso, I + 30, 14, { size: 3 }); L.stamp(bg);
    Fu.plant(L, iso, I + 14, 60, { size: 2, pot: last.ac.mid, potDark: last.ac.dark }); L.stamp(bg);
    return;
  }
  // escada: degraus subindo para o fundo (−j) até a altura do andar de cima
  const n = w.RJ / 8, h = w.end.h / n, d = 8;
  for (let k = n - 1; k >= 0; k--) {
    const j0 = w.RJ - (k + 1) * d;
    iso.box(L, I, j0, 0, SW, d, (k + 1) * h, {
      top: (u, v) => (v === 0 ? 'snow' : u % 16 === 0 ? 'silver' : 'light'),
      left: (u, v) => (v === 0 ? 'gray' : 'silver'),
      right: (u, v) => (v === 0 ? 'light' : (Math.floor(v / 8) + Math.floor(u / 8)) % 2 ? 'gray' : 'shadow'),
    });
    L.stamp(bg);
  }
  // corrimão do lado de fora (na frente dos personagens que sobem)
  for (let k = 0; k <= n; k += 2) {
    const j = w.RJ - k * d - 2, z = Math.min(n, k) * h;
    iso.box(L, I + SW - 3, j, z, 2, 2, 12, { top: 'woodLight', left: 'wood', right: 'woodDark' });
  }
  L.stamp(fg);
  for (let k = 0; k < n; k++) {
    const j = w.RJ - k * d - 2;
    iso.box(L, I + SW - 3, j - d, (k + 1) * h + 11, 2, d, 2, { top: 'woodLight', left: 'wood', right: 'woodDark' });
  }
  L.stamp(fg);
}

function corridorProps(w, L, bg, fg, style) {
  if (!style.plantas) return;
  // plantas ao longo do corredor (natureza): junto da parede da frente, entre as portas
  const J = w.FRONT_J0 - 8;
  for (let k = 0; k < Math.max(w.back.length, w.front.length); k++) {
    const i = w.start + k * w.RI + w.RI - 24;
    if (i > w.corrLen - 10) continue;
    if (w.front.length) { Fu.plant(L, w.iso, i, J, { size: 2 }); L.stamp(fg); }
    else if (k % 2 === 1) { Fu.plant(L, w.iso, i, J + 2, { size: 1 }); L.stamp(fg); }
  }
}

// ---------------------------------------------------------------- dados para o manifest
/**
 * Geometria do manifest v2: poly, label, seat, door de cada sala; vagas do lounge; grafo dos corredores.
 * Tudo em pixels do mapa.
 */
export function layoutData(plan) {
  const pls = placements(plan);
  const rooms = {};
  const nodes = {};
  const edges = [];
  const multi = plan.wings.length > 1;
  const spines = new Map(plan.wings.map((w) => [w, []]));
  const addSpine = (w, i, name = null) => {
    const P = (a, b, z = 0) => w.iso.pt(a, b, z);
    name ||= multi ? `${w.name}_${Math.round(i)}` : `c_${Math.round(i)}`;
    if (!nodes[name]) nodes[name] = P(i, w.spineJ);
    const list = spines.get(w);
    if (!list.some((s) => s[1] === name)) list.push([i, name]);
    return name;
  };
  for (const [id, pl] of Object.entries(pls)) {
    const w = pl.wing, { I0, J0, row } = pl;
    const P = (a, b, z = 0) => w.iso.pt(a, b, z);
    const dI = w.RI - BASE_RI, dJ = w.RJ - BASE_RJ;
    const s = SEATS[id];
    const RI = w.RI, RJ = w.RJ;
    const poly = [P(I0, J0), P(I0 + RI, J0), P(I0 + RI, J0 + RJ), P(I0, J0 + RJ)].map((p) => [p.x, p.y]);
    const lab = P(I0 + RI / 2, J0 + RJ);
    let doorPt, spineI;
    if (row === 'back') { spineI = I0 + 40 + dI / 2; doorPt = P(spineI, J0 + RJ - 6); }
    else { const span = ROOM_DRAW[id].doorSpan || DOOR; spineI = I0 + (span[0] + span[1]) / 2; doorPt = P(spineI, J0 + 8); }
    const door = `n_${id}`;
    nodes[door] = doorPt;
    edges.push([door, addSpine(w, spineI)]);
    rooms[id] = {
      label: { x: lab.x, y: lab.y - (row === 'back' ? 4 : 10) },
      poly,
      seat: { ...P(I0 + s.i + dI / 2, J0 + s.j + dJ / 2), flip: !!w.trans },
      door,
    };
  }
  // elevador na ponta esquerda do corredor
  for (const w of plan.wings) if (w.elevator) addSpine(w, 6, multi && w.name !== 'a' ? `n_elevador_${w.name}` : 'n_elevador');
  // ligações entre alas
  if (plan.formato === 'L') {
    const [a, b] = plan.wings;
    const x = b.spineJ; // i da linha de caminhada da ala b no sistema da ala a
    nodes.x_cruz = a.iso.pt(x, a.spineJ);
    spines.get(a).push([x, 'x_cruz']);
    spines.get(b).push([a.spineJ, 'x_cruz']);
  } else if (plan.formato === 'andares') {
    const [sup, a] = plan.wings;
    const ic = a.start + a.back.length * a.RI + a.end.w / 2;
    addSpine(a, ic, 'e_base');
    nodes.e_pe = a.iso.pt(ic, a.RJ + 4);
    nodes.e_alto = a.iso.pt(ic, 4, a.end.h);
    addSpine(sup, ic, 'e_topo');
    edges.push(['e_base', 'e_pe'], ['e_pe', 'e_alto'], ['e_alto', 'e_topo']);
  }
  for (const list of spines.values()) {
    list.sort((p, q) => p[0] - q[0]);
    for (let k = 1; k < list.length; k++) edges.push([list[k - 1][1], list[k][1]]);
  }

  const L0 = pls.lounge, lw = L0.wing, LP = (a, b) => lw.iso.pt(a, b);
  const dI = lw.RI - BASE_RI, dJ = lw.RJ - BASE_RJ;
  const sofa = [0, 1, 2, 3].map((k) => ({ ...LP(L0.I0 + SOFA.i + 14, L0.J0 + SOFA.j + dJ / 2 + 16 + k * 20), flip: !!lw.trans }));
  const visitors = LOUNGE_VISITORS.map(([i, j]) => ({ ...LP(L0.I0 + i + zone(i, BASE_RI, dI), L0.J0 + j + zone(j, BASE_RJ, dJ)), flip: !lw.trans }));
  rooms.lounge.seat = { ...sofa[0] };
  return { rooms, lounge: { sofa, visitors }, paths: { nodes, edges } };
}
