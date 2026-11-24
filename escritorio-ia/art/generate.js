// Gera todos os assets de pixel art v2 (isométrico) em public/assets/ (npm run sprites).
// Arte 100% própria, desenhada por código com a paleta fechada de art/palette.js. Contrato: CONTRATO.md, "Versão 2".
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PALETTE, COLORS } from './palette.js';
import { Canvas, textWidth } from './draw.js';
import { packSheet } from './sheet.js';
import { characterAnims, CW, CH, ANCHOR } from './chars.js';
import { buildMap, layoutData, roomOrigin, iso, MAP_W, MAP_H } from './map.js';
import { T } from './iso.js';
import { renderObject } from './objects.js';
import { fxAnims, FW, FH } from './fx.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'assets');
const rooms = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'rooms.json'), 'utf8'));
const agentIds = rooms.rooms.map((r) => r.id);
const commonIds = rooms.common.map((r) => r.id);
const allRoomIds = [...agentIds, ...commonIds];

fs.mkdirSync(OUT, { recursive: true });
const written = new Set();
const write = (name, data) => { fs.writeFileSync(path.join(OUT, name), data); written.add(name); };
const writeJSON = (name, obj) => write(name, JSON.stringify(obj, null, 2) + '\n');

for (const r of [...rooms.rooms, ...rooms.common]) if (!COLORS.includes(r.accent.toLowerCase())) throw new Error(`destaque ${r.accent} (${r.id}) fora da paleta`);
writeJSON('palette.json', { count: COLORS.length, colors: COLORS, names: PALETTE });

const animations = {};
const addAnims = (list) => {
  for (const a of list) {
    const prev = animations[a.tag];
    if (prev && (prev.fps !== a.fps || prev.frames !== a.frames.length)) throw new Error(`tag ${a.tag} com fps/quadros diferentes entre sheets`);
    animations[a.tag] = { fps: a.fps, loop: true, frames: a.frames.length };
  }
};

// ---------------------------------------------------------------- mapa
const { bg, fg } = buildMap();
const layout = layoutData();

// ---------------------------------------------------------------- objetos (e "furo" no fg onde o objeto aparece)
const roomsOut = {};
const objById = {};
for (const id of allRoomIds) {
  const { I0, J0 } = roomOrigin(id);
  const o = renderObject(id, I0, J0, iso, MAP_W, MAP_H);
  objById[id] = o;
  for (let k = 0; k < o.mask.px_.length; k++) if (o.mask.px_[k] >= 0) fg.px_[k] = -1;
  addAnims(o.anims);
  const { sheet, json } = packSheet(o.anims, `obj_${id}.png`);
  write(`obj_${id}.png`, sheet.toPNG());
  writeJSON(`obj_${id}.json`, json);
  const L = layout.rooms[id];
  roomsOut[id] = {
    label: L.label,
    poly: L.poly,
    seat: L.seat,
    object: { image: `obj_${id}.png`, data: `obj_${id}.json`, x: o.x, y: o.y, w: o.w, h: o.h },
    door: L.door,
  };
}
write('map_bg.png', bg.toPNG());
write('map_fg.png', fg.toPNG());

// ---------------------------------------------------------------- personagens
const characters = {};
const charAnims = {};
for (const id of [...agentIds, 'visitante']) {
  const anims = characterAnims(id);
  charAnims[id] = anims;
  addAnims(anims);
  const { sheet, json } = packSheet(anims, `char_${id}.png`);
  json.meta.anchor = { ...ANCHOR };
  write(`char_${id}.png`, sheet.toPNG());
  writeJSON(`char_${id}.json`, json);
  if (id !== 'visitante') characters[id] = { image: `char_${id}.png`, data: `char_${id}.json` };
}

// ---------------------------------------------------------------- fx
const fx = fxAnims();
addAnims(fx);
{
  const { sheet, json } = packSheet(fx, 'fx.png');
  write('fx.png', sheet.toPNG());
  writeJSON('fx.json', json);
}

// ---------------------------------------------------------------- manifest v2
const manifest = {
  version: 2,
  projection: 'iso',
  tile: { w: 2 * T, h: T },
  char: { w: CW, h: CH, anchor: { ...ANCHOR } },
  map: { w: MAP_W, h: MAP_H, background: 'map_bg.png', foreground: 'map_fg.png' },
  animations,
  characters,
  visitor: { image: 'char_visitante.png', data: 'char_visitante.json' },
  fx: {
    image: 'fx.png', data: 'fx.json', w: FW, h: FH,
    // centro do quadro do efeito relativo ao ponto do personagem (seat/sofa/visitors), sem espelhar
    anchors: {
      head: { x: 0, y: -50 },
      fx_zzz: { x: 10, y: -50 }, fx_question: { x: 9, y: -52 }, fx_star: { x: -9, y: -50 }, fx_sweat: { x: 11, y: -38 },
      fx_magnifier: { x: 14, y: -24 }, fx_smoke: { x: 22, y: -36 }, fx_heart: { x: 0, y: -52 }, fx_music: { x: 11, y: -48 },
      fx_sparkle: { x: 0, y: -26 },
    },
  },
  rooms: roomsOut,
  lounge: layout.lounge,
  paths: layout.paths,
  notes: 'Coordenadas em pixels do mapa. seat/sofa/visitors = ponto do personagem (anchor do quadro 32x48 = {16,46}); '
    + 'sentado, é o centro da cadeira. object.x/y = canto superior esquerdo do quadro do objeto (já no lugar certo no mapa). '
    + 'map_fg já tem um furo onde cada objeto aparece. fx.anchors = centro do quadro do efeito relativo ao ponto do personagem '
    + '(espelhe o x quando flip). obj_* e fx_* são loops; base_done/base_error também podem tocar em loop pela duração do estado.',
};
writeJSON('manifest.json', manifest);

// ---------------------------------------------------------------- preview (escala 2x)
function frameOf(id, tag, i = 0) { const a = charAnims[id].find((x) => x.tag === tag); return a.frames[i % a.frames.length]; }
function objFrame(id, tag, i) { const a = objById[id].anims.find((x) => x.tag === tag); return a.frames[i % a.frames.length]; }
function putChar(c, f, p, flip = false) { c.blit(f, p.x - ANCHOR.x, p.y - ANCHOR.y, { flipX: flip }); }
{
  // mapa com todo mundo sentado trabalhando
  const scene = new Canvas(MAP_W, MAP_H);
  scene.rect(0, 0, MAP_W, MAP_H, 'navy');
  scene.blit(bg, 0, 0);
  const sprites = [];
  for (const id of allRoomIds) sprites.push({ y: roomsOut[id].object.y + roomsOut[id].object.h, draw: (c) => c.blit(objFrame(id, id === 'copa' || id === 'lounge' ? 'obj_work' : 'obj_work', 2), roomsOut[id].object.x, roomsOut[id].object.y) });
  agentIds.forEach((id) => { const s = roomsOut[id].seat; sprites.push({ y: s.y, draw: (c) => putChar(c, frameOf(id, `${id}_work`, 1), s, s.flip) }); });
  const lg = layout.lounge;
  sprites.push({ y: lg.sofa[1].y, draw: (c) => putChar(c, frameOf('visitante', 'base_sleep', 1), lg.sofa[1]) });
  sprites.push({ y: lg.sofa[2].y, draw: (c) => putChar(c, frameOf('programador', 'base_idle', 0), lg.sofa[2]) });
  lg.visitors.forEach((v, k) => sprites.push({ y: v.y, draw: (c) => putChar(c, frameOf('visitante', k === 0 ? 'visitante_work' : k === 1 ? 'base_stand' : 'base_walk_se', k), v, v.flip) }));
  // alguém andando no corredor
  const n = layout.paths.nodes;
  sprites.push({ y: n.c_296.y, draw: (c) => putChar(c, frameOf('desenvolvedor', 'base_walk_se', 0), { x: n.c_296.x + 24, y: n.c_296.y + 12 }) });
  sprites.sort((a, b) => a.y - b.y).forEach((s) => s.draw(scene));
  scene.blit(fg, 0, 0);
  // fx de exemplo
  const fxF = (tag, i = 0) => fx.find((a) => a.tag === tag).frames[i];
  const putFx = (tag, p, i = 0) => { const a = manifest.fx.anchors[tag]; scene.blit(fxF(tag, i), p.x + a.x - FW / 2, p.y + a.y - FH / 2); };
  putFx('fx_zzz', lg.sofa[1], 2);
  putFx('fx_heart', lg.sofa[2], 1);
  putFx('fx_music', roomsOut['editor-video'].seat, 1);

  // folha de animações
  const order = (id) => [`${id}_work`, 'base_idle', 'base_read', 'base_doze', 'base_sleep', 'base_wait', 'base_done', 'base_error', 'base_walk_se', 'base_walk_ne', 'base_stand'];
  const labels = { base_idle: 'IDLE', base_read: 'READ', base_doze: 'DOZE', base_sleep: 'SLEEP', base_wait: 'WAIT', base_done: 'DONE', base_error: 'ERROR', base_walk_se: 'WALK SE', base_walk_ne: 'WALK NE', base_stand: 'STAND' };
  const W = MAP_W, pad = 6, cell = CW + 2;
  const blocks = [];
  let y = MAP_H + pad;
  for (const id of [...agentIds, 'visitante']) {
    let x = pad;
    const rowH = CH + 10;
    const items = [];
    for (const tag of order(id)) {
      const a = charAnims[id].find((q) => q.tag === tag);
      const wNeed = a.frames.length * cell + 6;
      if (x + wNeed > W - pad) { x = pad; y += rowH; }
      items.push({ x, y, a, label: labels[tag] || 'WORK' });
      x += wNeed;
    }
    blocks.push({ id, items });
    y += rowH + 4;
  }
  // fx e objetos
  const fxY = y;
  y += FH + 14;
  let ox = pad, objRowH = 0;
  const objItems = [];
  for (const id of allRoomIds) {
    const o = objById[id];
    const wNeed = 3 * (o.w + 2) + 8;
    if (ox + wNeed > W - pad) { ox = pad; y += objRowH + 10; objRowH = 0; }
    objItems.push({ x: ox, y: y + 8, id, o });
    ox += wNeed; objRowH = Math.max(objRowH, o.h + 8);
  }
  y += objRowH + 14;
  const H = y;
  const sheet = new Canvas(W, H);
  sheet.rect(0, 0, W, H, 'navy');
  sheet.blit(scene, 0, 0);
  sheet.rect(0, MAP_H, W, H - MAP_H, 'cream');
  for (const { id, items } of blocks) {
    for (const { x, y: yy, a, label } of items) {
      sheet.text(label === 'WORK' ? `${id.split('-')[0]} WORK` : label, x, yy, 'wood');
      a.frames.forEach((f, k) => { sheet.rect(x + k * cell, yy + 7, CW, CH, k % 2 ? 'sand' : 'brownLight'); sheet.blit(f, x + k * cell, yy + 7); });
    }
  }
  let fx0 = pad;
  sheet.text('FX', fx0, fxY, 'wood'); fx0 += 12;
  for (const a of fx) { a.frames.forEach((f, k) => { sheet.rect(fx0, fxY, FW, FH, 'slate'); sheet.blit(f, fx0, fxY); fx0 += FW + 1; }); fx0 += 5; }
  for (const { x, y: yy, id, o } of objItems) {
    sheet.text(id.split('-')[0], x, yy - 7, 'wood');
    ['obj_off', 'obj_work', 'obj_sleep'].forEach((t, k) => { sheet.rect(x + k * (o.w + 2), yy, o.w, o.h, 'light'); sheet.blit(objFrame(id, t, 1), x + k * (o.w + 2), yy); });
  }
  write('preview.png', sheet.toPNG(2));
}

// ---------------------------------------------------------------- limpa arquivos órfãos (v1) em public/assets
for (const f of fs.readdirSync(OUT)) if (/\.(png|json)$/.test(f) && !written.has(f)) fs.unlinkSync(path.join(OUT, f));

console.log(`sprites v2: ${written.size} arquivos em public/assets/ (mapa ${MAP_W}x${MAP_H}, ${COLORS.length} cores na paleta)`);
