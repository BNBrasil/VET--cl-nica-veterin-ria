// Valida public/assets/ contra o CONTRATO.md (seção 5): manifest, arquivos, tags, quadros/FPS, dimensões e paleta.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COLORS, PALETTE, hexToRgba } from './palette.js';
import { decodePNG } from './png.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'public', 'assets');
const rooms = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'rooms.json'), 'utf8'));
const errors = [];
const warn = [];
const fail = (m) => errors.push(m);
const check = (cond, m) => { if (!cond) fail(m); return cond; };

const PAL = new Set(COLORS.map((h) => hexToRgba(h).slice(0, 3).join(',')));
const imgCache = new Map();
function img(name) {
  if (imgCache.has(name)) return imgCache.get(name);
  const p = path.join(DIR, name);
  if (!check(fs.existsSync(p), `arquivo ausente: ${name}`)) return null;
  const im = decodePNG(fs.readFileSync(p));
  // paleta: todo pixel é transparente ou opaco com cor da paleta
  let bad = 0, semi = 0;
  for (let i = 0; i < im.data.length; i += 4) {
    const a = im.data[i + 3];
    if (a === 0) continue;
    if (a !== 255) { semi++; continue; }
    if (!PAL.has(`${im.data[i]},${im.data[i + 1]},${im.data[i + 2]}`)) bad++;
  }
  check(bad === 0, `${name}: ${bad} pixels fora da paleta`);
  check(semi === 0, `${name}: ${semi} pixels semitransparentes`);
  imgCache.set(name, im);
  return im;
}
function json(name) {
  const p = path.join(DIR, name);
  if (!check(fs.existsSync(p), `arquivo ausente: ${name}`)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { fail(`${name}: JSON inválido (${e.message})`); return null; }
}

// quadros e FPS pela tabela do PDF
const SPEC = {
  work: [4, 6, 8], base_read: [4, 4, 6], base_idle: [2, 2, 4], base_doze: [4, 4, 4], base_sleep: [4, 4, 3],
  base_wait: [2, 2, 4], base_done: [4, 4, 8], base_error: [3, 3, 6],
  base_walk_down: [4, 4, 8], base_walk_up: [4, 4, 8], base_walk_left: [4, 4, 8], base_walk_right: [4, 4, 8],
};
const BASE_TAGS = Object.keys(SPEC).filter((k) => k !== 'work');

/** Checa uma sheet Aseprite JSON hash. Retorna mapa tag -> {from,to}. */
function checkSheet(dataName, imageName, requiredTags, { fw, fh } = {}) {
  const j = json(dataName), im = img(imageName);
  if (!j || !im) return {};
  check(j.frames && typeof j.frames === 'object' && !Array.isArray(j.frames), `${dataName}: frames deve ser hash (objeto)`);
  check(j.meta && Array.isArray(j.meta.frameTags), `${dataName}: meta.frameTags ausente`);
  check(j.meta.image === imageName, `${dataName}: meta.image = ${j.meta.image}, esperado ${imageName}`);
  check(j.meta.size && j.meta.size.w === im.width && j.meta.size.h === im.height, `${dataName}: meta.size não bate com o PNG (${im.width}x${im.height})`);
  const keys = Object.keys(j.frames);
  for (const k of keys) {
    const f = j.frames[k];
    check(f.frame && Number.isInteger(f.duration) && f.duration > 0, `${dataName}: quadro ${k} sem frame/duration`);
    const { x, y, w, h } = f.frame;
    check(x >= 0 && y >= 0 && x + w <= im.width && y + h <= im.height, `${dataName}: quadro ${k} fora da imagem`);
    if (fw) check(w === fw && h === fh, `${dataName}: quadro ${k} com ${w}x${h}, esperado ${fw}x${fh}`);
  }
  const tags = {};
  for (const t of j.meta.frameTags) {
    check(t.from >= 0 && t.to < keys.length && t.from <= t.to, `${dataName}: tag ${t.name} com intervalo inválido`);
    check(t.direction === 'forward', `${dataName}: tag ${t.name} direction ${t.direction}`);
    for (let i = t.from; i <= t.to; i++) check(keys[i] === `${t.name}_${i - t.from}`, `${dataName}: quadro ${i} deveria ser ${t.name}_${i - t.from}, é ${keys[i]}`);
    tags[t.name] = { ...t, n: t.to - t.from + 1, durations: keys.slice(t.from, t.to + 1).map((k) => j.frames[k].duration) };
  }
  for (const r of requiredTags) check(tags[r], `${dataName}: tag obrigatória ausente: ${r}`);
  return tags;
}

// ---------------------------------------------------------------- paleta
check(COLORS.length >= 32 && COLORS.length <= 48, `paleta com ${COLORS.length} cores (esperado 32..48)`);
check(new Set(COLORS).size === COLORS.length, 'paleta com cores repetidas');
for (const r of [...rooms.rooms, ...rooms.common]) check(COLORS.includes(r.accent.toLowerCase()), `destaque ${r.accent} de ${r.id} fora da paleta`);
const pj = json('palette.json');
if (pj) check(JSON.stringify(pj.colors) === JSON.stringify(COLORS) && JSON.stringify(pj.names) === JSON.stringify(PALETTE), 'palette.json diferente de art/palette.js');

// ---------------------------------------------------------------- manifest
const m = json('manifest.json');
if (m) {
  check(m.tile === 16, 'manifest.tile != 16');
  check(m.char && m.char.w === 16 && m.char.h === 32, 'manifest.char != 16x32');
  check(m.room && m.room.w === 160 && m.room.h === 112, 'manifest.room != 160x112');
  check(m.animations && typeof m.animations === 'object', 'manifest.animations ausente');
  const anim = m.animations || {};
  const agentIds = rooms.rooms.map((r) => r.id);

  // personagens
  const chars = [...agentIds.map((id) => [id, m.characters?.[id]]), ['visitante', m.visitor]];
  for (const [id, entry] of chars) {
    if (!check(entry && entry.image === `char_${id}.png` && entry.data === `char_${id}.json`, `manifest: entrada de personagem ${id} inválida`)) continue;
    const workTag = `${id}_work`;
    const tags = checkSheet(entry.data, entry.image, [...BASE_TAGS, workTag], { fw: 16, fh: 32 });
    for (const [tag, [min, max, fps]] of Object.entries({ ...Object.fromEntries(BASE_TAGS.map((t) => [t, SPEC[t]])), [workTag]: SPEC.work })) {
      const t = tags[tag];
      if (!t) continue;
      check(t.n >= min && t.n <= max, `${entry.data}: ${tag} tem ${t.n} quadros (esperado ${min}..${max})`);
      check(t.durations.every((d) => d === Math.round(1000 / fps)), `${entry.data}: ${tag} duração != ${Math.round(1000 / fps)} ms (${fps} fps)`);
      check(anim[tag] && anim[tag].fps === fps, `manifest.animations.${tag}.fps deveria ser ${fps}`);
    }
  }

  // salas
  const roomIds = [...agentIds, ...rooms.common.map((r) => r.id)];
  for (const id of roomIds) {
    const r = m.rooms?.[id];
    if (!check(r, `manifest.rooms.${id} ausente`)) continue;
    check(r.background === `room_${id}.png`, `manifest.rooms.${id}.background`);
    const bg = img(r.background);
    if (bg) check(bg.width === 160 && bg.height === 112, `${r.background}: ${bg.width}x${bg.height}, esperado 160x112`);
    if (bg) { let transp = 0; for (let i = 3; i < bg.data.length; i += 4) if (bg.data[i] === 0) transp++; check(transp === 0, `${r.background}: fundo com ${transp} pixels transparentes`); }
    check(r.seat && Number.isInteger(r.seat.x) && Number.isInteger(r.seat.y), `manifest.rooms.${id}.seat inválido`);
    check(r.seat.x - 8 >= 0 && r.seat.x + 8 <= 160 && r.seat.y - 32 >= 0 && r.seat.y <= 112, `manifest.rooms.${id}.seat deixa o personagem fora da sala`);
    const o = r.object;
    if (check(o && o.image === `obj_${id}.png` && o.data === `obj_${id}.json` && Number.isInteger(o.x) && Number.isInteger(o.y), `manifest.rooms.${id}.object inválido`)) {
      const tags = checkSheet(o.data, o.image, ['obj_off', 'obj_work', 'obj_sleep']);
      const objJ = json(o.data);
      const f0 = objJ && Object.values(objJ.frames)[0].frame;
      if (f0) {
        check(o.x >= 0 && o.y >= 0 && o.x + f0.w <= 160 && o.y + f0.h <= 112, `obj_${id} fora da sala`);
        const cx0 = r.seat.x - 8, cx1 = r.seat.x + 8, cy0 = r.seat.y - 32, cy1 = r.seat.y;
        const overlap = o.x < cx1 && o.x + f0.w > cx0 && o.y < cy1 && o.y + f0.h > cy0;
        check(!overlap, `obj_${id} sobrepõe o personagem no seat`);
        if (r.sofa) { const sx0 = r.sofa.x - 8, sy0 = r.sofa.y - 32; check(!(o.x < sx0 + 16 && o.x + f0.w > sx0 && o.y < r.sofa.y && o.y + f0.h > sy0), `obj_${id} sobrepõe o sofá`); }
      }
      for (const t of ['obj_off', 'obj_work', 'obj_sleep']) if (tags[t]) check(anim[t] && tags[t].durations.every((d) => d === Math.round(1000 / anim[t].fps)), `obj_${id}: ${t} duração não bate com manifest.animations`);
    }
  }
  check(m.rooms?.lounge?.sofa && Number.isInteger(m.rooms.lounge.sofa.x) && Number.isInteger(m.rooms.lounge.sofa.y), 'manifest.rooms.lounge.sofa ausente');

  // fx
  if (check(m.fx && m.fx.image === 'fx.png' && m.fx.data === 'fx.json', 'manifest.fx inválido')) {
    const tags = checkSheet('fx.json', 'fx.png', ['fx_zzz', 'fx_question', 'fx_smoke', 'fx_sweat', 'fx_star', 'fx_magnifier']);
    if (tags.fx_question) check(tags.fx_question.n === 2, 'fx_question deve ter 2 quadros (piscar)');
  }

  // toda tag referenciada existe em animations
  for (const [k, v] of Object.entries(anim)) check(v && v.fps > 0 && typeof v.loop === 'boolean', `manifest.animations.${k} sem fps/loop`);
}

// todos os PNGs da pasta passam na paleta (inclui preview)
for (const f of fs.readdirSync(DIR)) if (f.endsWith('.png')) img(f);

if (errors.length) {
  console.error(`validate: ${errors.length} erro(s)`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`validate: OK — ${fs.readdirSync(DIR).length} arquivos, ${COLORS.length} cores, manifest e sheets conforme o contrato${warn.length ? ` (${warn.length} avisos)` : ''}`);
