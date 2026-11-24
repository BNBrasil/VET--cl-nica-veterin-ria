// Objetos animados por sala (tags obj_off, obj_work, obj_sleep), desenhados em coordenadas do mapa
// com o mesmo motor isométrico e depois recortados no menor retângulo comum a todos os quadros.
import { Canvas } from './draw.js';
import { Layer, wallDecal } from './iso.js';
import * as Fu from './furniture.js';
import { SEATS, DESK } from './rooms.js';

export const OBJ_TAGS = [
  { tag: 'obj_off', frames: 2, fps: 2 },
  { tag: 'obj_work', frames: 6, fps: 8 },
  { tag: 'obj_sleep', frames: 4, fps: 3 },
];

// ---------------------------------------------------------------- telas (conteúdo por quadro)
// Cada função recebe (u, v, w, h) já dentro da tela e devolve uma cor.
const SCR = {
  off: (f) => (u, v) => (u === 1 && v === 1 ? 'shadow' : (u + v === 3 && f) ? 'ink' : 'outline'),
  saver: (f, bg = 'navy', dot = 'cyanLight') => (u, v, w, h) => {
    const px = [1, 3, 5, 3][f % 4], py = [1, 2, 4, 5][f % 4] % Math.max(1, h - 1);
    if (u === px && v === py) return dot;
    if ((u * 5 + v * 3 + f) % 13 === 0) return 'slate';
    return bg;
  },
  code: (f) => (u, v) => {
    const line = (v + f) % 8;
    if (v === 0) return 'navy';
    const len = [5, 3, 7, 4, 6, 2, 5, 6][line];
    if (u >= 1 && u < 1 + len) return line % 3 === 0 ? 'greenLight' : line % 3 === 1 ? 'green' : 'cyan';
    return 'navy';
  },
  timeline: (f) => (u, v, w, h) => {
    if (v >= h - 4) { // trilhas
      const tr = v - (h - 4);
      if (u === (f * 2) % w) return 'snow';
      return tr === 0 ? ((u >> 1) % 3 ? 'purple' : 'neon') : tr === 1 ? ((u + 1) % 4 ? 'cyan' : 'cyanDark') : tr === 2 ? ((u >> 2) % 2 ? 'green' : 'greenDark') : 'ink';
    }
    return v < 1 ? 'ink' : 'slate';
  },
  scene: (f) => (u, v, w, h) => { // vídeo: céu, sol que se mexe, morro
    const sx = 2 + (f % 3);
    if (Math.hypot(u - sx, v - 2) < 1.6) return 'lamp';
    if (v > h - 3 - ((u + f) % 4 === 0 ? 1 : 0)) return 'green';
    return f % 2 ? 'blueLight' : 'cyanLight';
  },
  ball: (f) => (u, v, w, h) => { // bolinha quicando (animação)
    const bx = 1 + f, by = [1, 3, h - 2, h - 2, 3, 1][f];
    if (Math.abs(u - bx) <= 0 && Math.abs(v - by) <= 0) return 'red';
    if (u === bx + 1 && v === by) return 'orange';
    if (v === h - 1) return 'tan';
    if (u === bx - 1 && v === by && f % 2) return 'pinkLight';
    return 'snow';
  },
  app: (f) => (u, v, w, h) => { // telas de app deslizando
    const off = (f * 2) % (w + 2);
    const x = (u + off) % (w + 2);
    const page = Math.floor((u + off) / (w + 2)) % 3;
    const col = ['blue', 'pink', 'green'][page];
    if (x >= w) return 'outline';
    if (v === 0) return col;
    if (v === 2 && x > 0 && x < w - 1) return 'light';
    if (v >= 4 && v <= 5 && x > 0 && x < 4) return col;
    return 'snow';
  },
  check: (f) => (u, v, w, h) => { // checklist marcando itens
    const row = Math.floor((v - 1) / 2), vv = (v - 1) % 2;
    if (v === 0) return 'red';
    if (vv === 1) return 'snow';
    if (u === 1) return row < Math.floor(f / 2) + 1 ? 'green' : 'light';
    if (u >= 3 && u < w - 1) return 'silver';
    return 'snow';
  },
};

function monitor(I, J, w, h, screenFn) {
  return (L, iso) => Fu.monitorJ(L, iso, I, J, DESK.h, w, h, { screen: (u, v) => screenFn(u, v, w - 2, h - 1) });
}

function deskOf(id, I0, J0) { const s = SEATS[id]; return { i: I0 + s.i + DESK.off, j: J0 + s.j - DESK.dj / 2 }; }

// ---------------------------------------------------------------- definição por sala
export const OBJECTS = {
  orquestrador: (I0, J0) => (L, iso, tag, f) => { // kanban na parede
    const c = new Canvas(52, 26);
    c.rect(0, 0, 52, 26, 'outline'); c.rect(1, 1, 50, 24, 'silver'); c.rect(2, 2, 48, 22, 'snow');
    const heads = ['orange', 'lamp', 'green'];
    for (let k = 0; k < 3; k++) { c.rect(3 + k * 16, 3, 14, 3, heads[k]); if (k) c.vline(2 + k * 16, 3, 23, 'light'); }
    const cards = [[0, 0, 'orangeLight'], [0, 1, 'pinkLight'], [0, 2, 'cyanLight'], [1, 0, 'lamp'], [2, 0, 'greenLight'], [2, 1, 'greenLight']];
    let moving = null;
    if (tag === 'obj_work') { // um cartão viaja de "a fazer" para "feito"
      const path = [[0, 3], [0.5, 2], [1, 1], [1.5, 1], [2, 2], [2, 2]];
      moving = path[f];
    }
    for (const [col, row, cc] of cards) { const x = 4 + col * 16, y = 7 + row * 5; c.rect(x, y, 11, 4, cc); c.hline(x + 1, x + 6, y + 1, 'silver'); c.px(x + 9, y + 2, 'outline'); }
    if (moving) { const x = Math.round(4 + moving[0] * 16), y = 7 + moving[1] * 5 - (moving[0] % 1 ? 2 : 0); c.rect(x - 1, y - 1, 13, 6, 'outline'); c.rect(x, y, 11, 4, 'blueLight'); c.hline(x + 1, x + 6, y + 1, 'blue'); }
    // LED de status
    const led = tag === 'obj_work' ? (f % 2 ? 'greenLight' : 'green') : tag === 'obj_sleep' ? (f < 2 ? 'blue' : 'navy') : 'gray';
    c.rect(46, 20, 3, 3, 'outline'); c.px(47, 21, led);
    wallDecal(iso, L, c, { face: 'J', wall: J0, at: I0 + 16, z: 41 });
  },
  roteirista: (I0, J0) => (L, iso, tag, f) => { // abajur amarelo
    const ci = I0 + 92, cj = J0 + 30;
    const on = tag === 'obj_work' || (tag === 'obj_sleep' && f % 2 === 0);
    if (tag === 'obj_work' || tag === 'obj_sleep') {
      const r = tag === 'obj_work' ? 16 + (f % 3 === 0 ? 1 : 0) : 12;
      iso.disc(L, ci, cj, r, r, 0, (u, v, wi, wj) => (Math.hypot(wi - ci, wj - cj) > r - 3 ? 'yellowPale' : 'lamp'));
      L.stamp(L._out, { outline: false });
    }
    Fu.floorLamp(L, iso, ci, cj, { shade: on ? 'lamp' : 'yellow', shadeDark: on ? 'yellow' : 'yellowDark', on });
    if (tag === 'obj_work') { const p = iso.pt(ci, cj, 44); if (f % 2) { L._sp = [[p.x - 8, p.y - 2], [p.x + 8, p.y - 2], [p.x, p.y - 6]]; } }
  },
  'editor-video': (I0, J0) => {
    const d = deskOf('editor-video', I0, J0);
    return (L, iso, tag, f) => {
      const a = tag === 'obj_work' ? SCR.scene(f) : tag === 'obj_sleep' ? SCR.saver(f, 'purpleDark', 'neon') : SCR.off(f);
      const b = tag === 'obj_work' ? SCR.timeline(f) : tag === 'obj_sleep' ? SCR.saver(f + 2, 'purpleDark', 'neon') : SCR.off(f);
      monitor(d.i + 1, d.j, 9, 9, a)(L, iso);
      monitor(d.i + 10, d.j, 9, 9, b)(L, iso);
    };
  },
  animador: (I0, J0) => {
    const d = deskOf('animador', I0, J0);
    return (L, iso, tag, f) => monitor(d.i + 2, d.j, 11, 10, tag === 'obj_work' ? SCR.ball(f) : tag === 'obj_sleep' ? SCR.saver(f, 'cyanDark', 'snow') : SCR.off(f))(L, iso);
  },
  copa: (I0, J0) => (L, iso, tag, f) => { // cafeteira no balcão
    const i = I0 + 72, j = J0 + 2, z = 16;
    iso.box(L, i, j, z, 12, 12, 16, { top: 'shadow', left: (u, v) => (v >= 6 && v <= 12 && u >= 3 && u <= 8 ? 'outline' : 'ink'), right: 'shadow' });
    iso.box(L, i + 2, j + 2, z + 16, 8, 8, 3, { top: 'gray', left: 'shadow', right: 'ink' });
    const p = iso.pt(i + 6, j + 12, z + 13);
    L.px(p.x + 4, p.y - 6, tag === 'obj_work' ? 'greenLight' : tag === 'obj_sleep' ? (f % 2 ? 'blue' : 'navy') : 'red');
    if (tag === 'obj_work') {
      iso.cylinder(L, i + 6, j + 14, 2.4, z, z + 5, { side: 'snow', sideDark: 'light', top: f < 3 ? 'snow' : 'woodDark' });
      if (f % 2 === 0) { const q = iso.pt(i + 6, j + 14, z + 9); L.px(q.x, q.y, 'woodDark'); L.px(q.x, q.y + 1, 'woodDark'); }
      L._steam = { ...iso.pt(i + 6, j + 14, z + 20), f };
    }
  },
  programador: (I0, J0) => (L, iso, tag, f) => { // rack com LEDs
    const leds = (u, row, vv) => {
      if (vv !== 1 || u < 3 || u > 4) return null;
      const h = (row * 7 + u * 3 + f * 5) % 11;
      if (tag === 'obj_work') return h < 4 ? 'greenLight' : h < 6 ? 'orange' : h < 8 ? 'green' : 'greenDark';
      if (tag === 'obj_sleep') return h % 3 === 0 && f % 2 ? 'blueLight' : 'blue';
      return (row + f) % 3 === 0 ? 'green' : 'greenDark';
    };
    Fu.rackI(L, iso, I0, J0 + 36, 22, 42, leds);
  },
  desenvolvedor: (I0, J0) => {
    const d = deskOf('desenvolvedor', I0, J0);
    return (L, iso, tag, f) => monitor(d.i + 2, d.j, 11, 10, tag === 'obj_work' ? SCR.app(f) : tag === 'obj_sleep' ? SCR.saver(f, 'blueDark', 'blueLight') : SCR.off(f))(L, iso);
  },
  designer: (I0, J0) => (L, iso, tag, f) => { // pôster que muda de cor
    const c = new Canvas(18, 24);
    const bgs = ['pink', 'orange', 'cyan', 'purple', 'green', 'blue'];
    const fgc = ['lamp', 'blue', 'pink', 'lamp', 'snow', 'orange'];
    const k = tag === 'obj_work' ? f : 0;
    c.rect(0, 0, 18, 24, 'outline'); c.rect(1, 1, 16, 22, 'snow');
    const B = tag === 'obj_sleep' ? 'navy' : tag === 'obj_off' ? 'pinkPale' : bgs[k];
    const Fg = tag === 'obj_sleep' ? (f % 2 ? 'lamp' : 'yellowDark') : tag === 'obj_off' ? 'pinkLight' : fgc[k];
    c.rect(2, 2, 14, 16, B);
    for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) if (x * x + y * y <= 17) c.px(9 + x, 9 + y, Fg);
    if (tag === 'obj_sleep') { c.rect(9, 6, 4, 6, 'navy'); c.px(4, 4, 'snow'); c.px(13, 15, 'snow'); }
    c.rect(2, 19, 14, 1, 'outline'); c.rect(3, 20, 8, 1, 'silver');
    wallDecal(iso, L, c, { face: 'J', wall: J0, at: I0 + 86, z: 41 });
  },
  revisor: (I0, J0) => {
    const d = deskOf('revisor', I0, J0);
    return (L, iso, tag, f) => monitor(d.i + 2, d.j, 11, 10, tag === 'obj_work' ? SCR.check(f) : tag === 'obj_sleep' ? SCR.saver(f, 'redDark', 'redLight') : SCR.off(f))(L, iso);
  },
  lounge: (I0, J0) => (L, iso, tag, f) => { // TV na parede com rack embaixo
    const c = new Canvas(34, 21);
    c.rect(0, 0, 34, 21, 'outline'); c.rect(1, 1, 32, 19, 'ink');
    for (let y = 0; y < 17; y++) for (let x = 0; x < 30; x++) {
      let col = 'outline';
      if (tag === 'obj_work') {
        const band = Math.floor((x + f * 3) / 6) % 5;
        col = y < 10 ? ['blueLight', 'cyanLight', 'blueLight', 'cyanLight', 'blueLight'][band] : y < 13 ? 'green' : 'greenDark';
        if (Math.hypot(x - (6 + f * 3), y - 9) < 3) col = 'red';
        if (Math.hypot(x - 22, y - 4) < 2.5) col = 'lamp';
      } else if (tag === 'obj_sleep') {
        col = 'navy';
        const px = [4, 12, 20, 26][f], py = [3, 8, 5, 11][f];
        if (Math.abs(x - px) < 3 && Math.abs(y - py) < 2) col = 'teal';
        if ((x * 7 + y * 3) % 23 === 0) col = 'slate';
      } else if (x + y === 6 || x + y === 7) col = 'shadow';
      c.px(2 + x, 2 + y, col);
    }
    c.px(30, 19, tag === 'obj_off' ? 'red' : 'greenLight');
    wallDecal(iso, L, c, { face: 'J', wall: J0, at: I0 + 58, z: 40 });
  },
};

/**
 * Renderiza as tags de um objeto. Retorna { anims:[{tag,fps,frames}], x, y, w, h, mask }.
 * mapW/mapH = tamanho do mapa; o recorte é a união dos pixels de todos os quadros.
 */
export function renderObject(id, I0, J0, iso, mapW, mapH) {
  const draw = OBJECTS[id](I0, J0);
  const full = [];
  for (const t of OBJ_TAGS) {
    for (let f = 0; f < t.frames; f++) {
      const out = new Canvas(mapW, mapH);
      const L = new Layer(mapW, mapH);
      L._out = out;
      draw(L, iso, t.tag, f);
      L.stamp(out);
      if (L._sp) for (const [x, y] of L._sp) { out.px(x, y, 'lamp'); }
      if (L._steam) { const { x, y, f: ff } = L._steam; for (let k = 0; k < 3; k++) { const yy = y - k * 3 - (ff % 3); out.px(x + ((k + ff) % 2 ? 1 : -1), yy, 'snow'); out.px(x + ((k + ff) % 2 ? 1 : -1) + ((k + ff) % 2 ? -1 : 1), yy - 1, 'light'); } }
      full.push({ tag: t.tag, fps: t.fps, c: out });
    }
  }
  let x0 = mapW, y0 = mapH, x1 = -1, y1 = -1;
  for (const { c } of full) for (let y = 0; y < mapH; y++) for (let x = 0; x < mapW; x++) if (c.get(x, y) >= 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const mask = new Canvas(mapW, mapH);
  const anims = OBJ_TAGS.map((t) => ({ tag: t.tag, fps: t.fps, frames: [] }));
  for (const { tag, c } of full) {
    const fr = new Canvas(w, h); fr.blit(c, -x0, -y0);
    anims.find((a) => a.tag === tag).frames.push(fr);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (c.get(x, y) >= 0) mask.px_[y * mapW + x] = 0;
  }
  return { anims, x: x0, y: y0, w, h, mask };
}
