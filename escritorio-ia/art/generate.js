// Gera todos os assets de pixel art em public/assets/ (npm run sprites).
// Arte 100% própria, desenhada por código com a paleta fechada de art/palette.js.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PALETTE, COLORS } from './palette.js';
import { Canvas } from './draw.js';
import { packSheet } from './sheet.js';
import { characterAnims, CW, CH } from './chars.js';
import { drawRoom, roomSpec, RW, RH, SOFA } from './rooms.js';
import { objectAnims } from './objects.js';
import { fxAnims } from './fx.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'assets');
const rooms = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'rooms.json'), 'utf8'));
const agentIds = rooms.rooms.map((r) => r.id);
const commonIds = rooms.common.map((r) => r.id);

fs.mkdirSync(OUT, { recursive: true });
const written = [];
const write = (name, data) => { fs.writeFileSync(path.join(OUT, name), data); written.push(name); };
const writeJSON = (name, obj) => write(name, JSON.stringify(obj, null, 2) + '\n');

// confere que os destaques de rooms.json estão na paleta
for (const r of [...rooms.rooms, ...rooms.common]) if (!COLORS.includes(r.accent.toLowerCase())) throw new Error(`destaque ${r.accent} (${r.id}) fora da paleta`);

// ---------------------------------------------------------------- paleta
writeJSON('palette.json', { count: COLORS.length, colors: COLORS, names: PALETTE });

const animations = {};
const addAnims = (list) => { for (const a of list) animations[a.tag] = { fps: a.fps, loop: true, frames: a.frames.length }; };

// ---------------------------------------------------------------- personagens
const characters = {};
const charAnims = {};
for (const id of [...agentIds, 'visitante']) {
  const anims = characterAnims(id);
  charAnims[id] = anims;
  addAnims(anims);
  const { sheet, json } = packSheet(anims, `char_${id}.png`);
  write(`char_${id}.png`, sheet.toPNG());
  writeJSON(`char_${id}.json`, json);
  if (id !== 'visitante') characters[id] = { image: `char_${id}.png`, data: `char_${id}.json` };
}

// ---------------------------------------------------------------- salas + objetos
const roomsOut = {};
const objAnimsById = {};
for (const id of [...agentIds, ...commonIds]) {
  const bg = drawRoom(id);
  write(`room_${id}.png`, bg.toPNG());
  const spec = roomSpec(id);
  const anims = objectAnims(id);
  objAnimsById[id] = anims;
  addAnims(anims);
  const { sheet, json } = packSheet(anims, `obj_${id}.png`);
  write(`obj_${id}.png`, sheet.toPNG());
  writeJSON(`obj_${id}.json`, json);
  const fw = anims[0].frames[0].w, fh = anims[0].frames[0].h;
  roomsOut[id] = {
    background: `room_${id}.png`,
    seat: { ...spec.seat },
    object: { image: `obj_${id}.png`, data: `obj_${id}.json`, x: spec.object.x, y: spec.object.y, w: fw, h: fh },
  };
  if (id === 'lounge') roomsOut[id].sofa = { ...SOFA };
}

// ---------------------------------------------------------------- fx
const fx = fxAnims();
addAnims(fx);
{
  const { sheet, json } = packSheet(fx, 'fx.png');
  write('fx.png', sheet.toPNG());
  writeJSON('fx.json', json);
}

// ---------------------------------------------------------------- manifest
const manifest = {
  tile: 16,
  char: { w: CW, h: CH },
  room: { w: RW, h: RH },
  scale: 3,
  animations,
  characters,
  rooms: roomsOut,
  fx: {
    image: 'fx.png',
    data: 'fx.json',
    // sugestão de posição (canto superior esquerdo do quadro 16x16) relativa ao `seat` do personagem
    anchors: {
      fx_zzz: { dx: 4, dy: -40 }, fx_question: { dx: 2, dy: -44 }, fx_star: { dx: -8, dy: -44 },
      fx_sweat: { dx: 2, dy: -34 }, fx_magnifier: { dx: -18, dy: -24 },
      fx_smoke: { relativeTo: 'object', dx: 0, dy: -12 },
    },
  },
  visitor: { image: 'char_visitante.png', data: 'char_visitante.json' },
  notes: 'seat = pé do personagem (ponto inferior-central). object.x/y = canto superior esquerdo do quadro do objeto. A mesa faz parte do fundo; o sprite sentado já prevê o tampo nas linhas 23..26.',
};
writeJSON('manifest.json', manifest);

// ---------------------------------------------------------------- preview (folha de contato 3x)
function frameOf(anims, tag, i = 0) { const a = anims.find((x) => x.tag === tag); return a.frames[i % a.frames.length]; }
function composeRoom(id, charTag, charId = id, charFrame = 0, objTag = 'obj_work') {
  const c = drawRoom(id).clone();
  const r = roomsOut[id];
  c.blit(frameOf(objAnimsById[id], objTag, 1), r.object.x, r.object.y);
  if (charTag) c.blit(frameOf(charAnims[charId], charTag, charFrame), r.seat.x - CW / 2, r.seat.y - CH);
  return c;
}
{
  const ids = [...agentIds, ...commonIds];
  const cols = 4, gap = 4;
  const roomRows = Math.ceil(ids.length / cols);
  const tags = ['WORK', 'base_idle', 'base_read', 'base_doze', 'base_sleep', 'base_wait', 'base_done', 'base_error', 'base_walk_down', 'base_walk_up', 'base_walk_left', 'base_walk_right'];
  const PER = 3;
  const charsList = [...agentIds, 'visitante'];
  const charBlockW = tags.length * PER * (CW + 2); // cada tag mostra até 3 quadros
  const W = Math.max(cols * (RW + gap) + gap, charBlockW + gap * 2);
  const charsY = roomRows * (RH + gap) + gap + 4;
  const H = charsY + charsList.length * (CH + 4) + gap;
  const sheet = new Canvas(W, H);
  sheet.rect(0, 0, W, H, 'outline');
  ids.forEach((id, k) => {
    const x = gap + (k % cols) * (RW + gap), y = gap + Math.floor(k / cols) * (RH + gap);
    let c;
    if (id === 'copa') c = composeRoom(id, 'base_idle', 'visitante', 0);
    else if (id === 'lounge') {
      c = composeRoom(id, 'visitante_work', 'visitante', 0, 'obj_sleep');
      c.blit(frameOf(charAnims.programador, 'base_sleep', 1), SOFA.x - CW / 2, SOFA.y - CH);
    } else c = composeRoom(id, `${id}_work`, id, 1);
    sheet.blit(c, x, y);
  });
  charsList.forEach((id, r) => {
    const y = charsY + r * (CH + 4);
    sheet.rect(0, y - 1, W, CH + 2, 'cream');
    tags.forEach((tag, t) => {
      const realTag = tag === 'WORK' ? `${id}_work` : tag;
      const n = charAnims[id].find((a) => a.tag === realTag).frames.length;
      for (let f = 0; f < Math.min(PER, n); f++) {
        const x = gap + (t * PER + f) * (CW + 2);
        if (!tag.includes('walk')) { sheet.rect(x - 1, y + 23, CW + 2, 4, 'tan'); sheet.hline(x - 1, x + CW, y + 27, 'wood'); }
        sheet.blit(frameOf(charAnims[id], realTag, f), x, y);
      }
    });
  });
  write('preview.png', sheet.toPNG(3));
}

console.log(`sprites: ${written.length} arquivos em public/assets/ (${COLORS.length} cores na paleta)`);
