// Valida public/assets/ contra o CONTRATO.md, seção "Versão 2": manifest, arquivos, tags, quadros/FPS,
// dimensões, paleta, posições dentro do mapa, grafo de caminhos conexo e portas existentes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COLORS, PALETTE, hexToRgba } from './palette.js';
import { decodePNG } from './png.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'public', 'assets');
const rooms = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'rooms.json'), 'utf8'));
const errors = [];
const fail = (m) => errors.push(m);
const check = (cond, m) => { if (!cond) fail(m); return !!cond; };
const isInt = (v) => Number.isInteger(v);

const PAL = new Set(COLORS.map((h) => hexToRgba(h).slice(0, 3).join(',')));
const imgCache = new Map();
function img(name) {
  if (imgCache.has(name)) return imgCache.get(name);
  const p = path.join(DIR, name);
  if (!check(fs.existsSync(p), `arquivo ausente: ${name}`)) return null;
  const im = decodePNG(fs.readFileSync(p));
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

// quadros [min, max] e FPS (CONTRATO v2)
const SPEC = {
  work: [4, 6, 8], base_read: [4, 4, 6], base_idle: [4, 4, 4], base_doze: [4, 4, 4], base_sleep: [4, 4, 3],
  base_wait: [4, 4, 6], base_done: [6, 6, 10], base_error: [4, 4, 6],
  base_walk_se: [4, 4, 8], base_walk_ne: [4, 4, 8], base_stand: [2, 2, 2],
};
const BASE_TAGS = Object.keys(SPEC).filter((k) => k !== 'work');
const OBJ_TAGS = ['obj_off', 'obj_work', 'obj_sleep'];
const FX_TAGS = ['fx_zzz', 'fx_question', 'fx_smoke', 'fx_sweat', 'fx_star', 'fx_magnifier', 'fx_heart', 'fx_music', 'fx_sparkle'];

/** Checa uma sheet Aseprite JSON hash. Retorna mapa tag -> {n, durations}. */
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
    check(f.frame && isInt(f.duration) && f.duration > 0, `${dataName}: quadro ${k} sem frame/duration`);
    const { x, y, w, h } = f.frame;
    check(x >= 0 && y >= 0 && x + w <= im.width && y + h <= im.height, `${dataName}: quadro ${k} fora da imagem`);
    if (fw) check(w === fw && h === fh, `${dataName}: quadro ${k} com ${w}x${h}, esperado ${fw}x${fh}`);
  }
  const tags = {};
  for (const t of j.meta.frameTags) {
    check(t.from >= 0 && t.to < keys.length && t.from <= t.to, `${dataName}: tag ${t.name} com intervalo inválido`);
    check(t.direction === 'forward', `${dataName}: tag ${t.name} direction ${t.direction}`);
    for (let i = t.from; i <= t.to; i++) check(keys[i] === `${t.name}_${i - t.from}`, `${dataName}: quadro ${i} deveria ser ${t.name}_${i - t.from}, é ${keys[i]}`);
    tags[t.name] = { n: t.to - t.from + 1, durations: keys.slice(t.from, t.to + 1).map((k) => j.frames[k].duration) };
    // quadro não pode ser vazio
    const f0 = j.frames[keys[t.from]].frame;
    let any = false;
    for (let yy = f0.y; yy < f0.y + f0.h && !any; yy++) for (let xx = f0.x; xx < f0.x + f0.w; xx++) if (im.data[(yy * im.width + xx) * 4 + 3]) { any = true; break; }
    check(any, `${dataName}: tag ${t.name} com quadro vazio`);
  }
  for (const r of requiredTags) check(tags[r], `${dataName}: tag obrigatória ausente: ${r}`);
  return tags;
}
const checkTiming = (sheetName, tags, tag, [min, max, fps], anim) => {
  const t = tags[tag];
  if (!t) return;
  check(t.n >= min && t.n <= max, `${sheetName}: ${tag} tem ${t.n} quadros (esperado ${min}..${max})`);
  check(t.durations.every((d) => d === Math.round(1000 / fps)), `${sheetName}: ${tag} duração != ${Math.round(1000 / fps)} ms (${fps} fps)`);
  check(anim[tag] && anim[tag].fps === fps && anim[tag].frames === t.n && typeof anim[tag].loop === 'boolean', `manifest.animations.${tag} deveria ser { fps: ${fps}, frames: ${t.n}, loop }`);
};

// ---------------------------------------------------------------- paleta
check(COLORS.length >= 32 && COLORS.length <= 64, `paleta com ${COLORS.length} cores (esperado 32..64)`);
check(new Set(COLORS).size === COLORS.length, 'paleta com cores repetidas');
for (const r of [...rooms.rooms, ...rooms.common]) check(COLORS.includes(r.accent.toLowerCase()), `destaque ${r.accent} de ${r.id} fora da paleta`);
const pj = json('palette.json');
if (pj) check(JSON.stringify(pj.colors) === JSON.stringify(COLORS) && JSON.stringify(pj.names) === JSON.stringify(PALETTE), 'palette.json diferente de art/palette.js');

// ---------------------------------------------------------------- manifest
const m = json('manifest.json');
if (m) {
  check(m.version === 2 && m.projection === 'iso', 'manifest.version deve ser 2 e projection "iso"');
  check(m.tile && m.tile.w === 32 && m.tile.h === 16, 'manifest.tile != 32x16');
  check(m.char && m.char.w === 32 && m.char.h === 48 && m.char.anchor?.x === 16 && m.char.anchor?.y === 46, 'manifest.char != 32x48 com anchor {16,46}');
  const anim = m.animations || {};
  check(Object.keys(anim).length > 0, 'manifest.animations vazio');
  for (const [k, v] of Object.entries(anim)) check(v && v.fps > 0 && isInt(v.frames) && typeof v.loop === 'boolean', `manifest.animations.${k} sem fps/frames/loop`);

  // mapa
  const MW = m.map?.w, MH = m.map?.h;
  check(m.map && m.map.background === 'map_bg.png' && m.map.foreground === 'map_fg.png', 'manifest.map: background/foreground');
  check(MW >= 900 && MW <= 1100, `mapa com ${MW} px de largura (esperado ~900..1100)`);
  const bgI = img('map_bg.png'), fgI = img('map_fg.png');
  if (bgI) check(bgI.width === MW && bgI.height === MH, `map_bg.png ${bgI.width}x${bgI.height} != manifest.map ${MW}x${MH}`);
  if (fgI) {
    check(fgI.width === MW && fgI.height === MH, `map_fg.png ${fgI.width}x${fgI.height} != manifest.map ${MW}x${MH}`);
    let opaque = 0; for (let i = 3; i < fgI.data.length; i += 4) if (fgI.data[i]) opaque++;
    check(opaque > 0 && opaque < fgI.width * fgI.height * 0.25, `map_fg.png deveria ser transparente na maior parte (${opaque} px opacos)`);
  }
  const inMap = (p, mx = 0, my = 0) => p && isInt(p.x) && isInt(p.y) && p.x - mx >= 0 && p.x + mx <= MW && p.y - my >= 0 && p.y <= MH;
  /** O ponto cai em pixel opaco do fundo (dentro do prédio)? */
  const onFloor = (p) => bgI && bgI.data[(p.y * bgI.width + p.x) * 4 + 3] === 255;
  const inPoly = (p, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > p.y) !== (yj > p.y) && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) c = !c; } return c; };

  // personagens
  const agentIds = rooms.rooms.map((r) => r.id);
  const chars = [...agentIds.map((id) => [id, m.characters?.[id]]), ['visitante', m.visitor]];
  for (const [id, entry] of chars) {
    if (!check(entry && entry.image === `char_${id}.png` && entry.data === `char_${id}.json`, `manifest: entrada de personagem ${id} inválida`)) continue;
    const workTag = `${id}_work`;
    const tags = checkSheet(entry.data, entry.image, [...BASE_TAGS, workTag], { fw: 32, fh: 48 });
    for (const t of BASE_TAGS) checkTiming(entry.data, tags, t, SPEC[t], anim);
    checkTiming(entry.data, tags, workTag, SPEC.work, anim);
  }

  // salas
  const nodes = m.paths?.nodes || {};
  const roomIds = [...agentIds, ...rooms.common.map((r) => r.id)];
  for (const id of roomIds) {
    const r = m.rooms?.[id];
    if (!check(r, `manifest.rooms.${id} ausente`)) continue;
    check(inMap(r.label), `manifest.rooms.${id}.label fora do mapa`);
    check(Array.isArray(r.poly) && r.poly.length >= 3 && r.poly.every((q) => Array.isArray(q) && isInt(q[0]) && isInt(q[1]) && inMap({ x: q[0], y: q[1] })), `manifest.rooms.${id}.poly inválido`);
    const s = r.seat;
    if (check(s && typeof s.flip === 'boolean' && inMap(s, 16, 46), `manifest.rooms.${id}.seat inválido ou deixa o personagem fora do mapa`)) {
      check(onFloor(s), `manifest.rooms.${id}.seat não cai no piso`);
      if (Array.isArray(r.poly)) check(inPoly(s, r.poly), `manifest.rooms.${id}.seat fora do poly da sala`);
    }
    check(typeof r.door === 'string' && nodes[r.door], `manifest.rooms.${id}.door (${r.door}) não existe em paths.nodes`);
    const o = r.object;
    if (check(o && o.image === `obj_${id}.png` && o.data === `obj_${id}.json` && [o.x, o.y, o.w, o.h].every(isInt), `manifest.rooms.${id}.object inválido`)) {
      const tags = checkSheet(o.data, o.image, OBJ_TAGS, { fw: o.w, fh: o.h });
      check(o.x >= 0 && o.y >= 0 && o.x + o.w <= MW && o.y + o.h <= MH, `obj_${id} fora do mapa`);
      for (const t of OBJ_TAGS) if (tags[t]) check(anim[t] && tags[t].n === anim[t].frames && tags[t].durations.every((d) => d === Math.round(1000 / anim[t].fps)), `obj_${id}: ${t} não bate com manifest.animations`);
      // objeto não cobre o personagem sentado
      if (s) { const cx0 = s.x - 10, cx1 = s.x + 10, cy0 = s.y - 44, cy1 = s.y - 4; check(!(o.x < cx1 && o.x + o.w > cx0 && o.y < cy1 && o.y + o.h > cy0), `obj_${id} sobrepõe o personagem sentado`); }
    }
  }

  // lounge
  const lg = m.lounge;
  if (check(lg && Array.isArray(lg.sofa) && lg.sofa.length >= 4, 'manifest.lounge.sofa precisa de pelo menos 4 vagas')) {
    lg.sofa.forEach((p, k) => check(inMap(p, 16, 46) && typeof p.flip === 'boolean' && onFloor(p) && inPoly(p, m.rooms.lounge.poly), `lounge.sofa[${k}] inválido/fora do lounge`));
  }
  if (check(lg && Array.isArray(lg.visitors) && lg.visitors.length >= 3, 'manifest.lounge.visitors precisa de pelo menos 3 lugares')) {
    lg.visitors.forEach((p, k) => check(inMap(p, 16, 46) && typeof p.flip === 'boolean' && onFloor(p) && inPoly(p, m.rooms.lounge.poly), `lounge.visitors[${k}] inválido/fora do lounge`));
  }

  // grafo de caminhos: nós dentro do mapa, arestas válidas, conexo, toda door presente
  const names = Object.keys(nodes);
  check(names.length > 0, 'paths.nodes vazio');
  for (const n of names) check(inMap(nodes[n]) && onFloor(nodes[n]), `paths.nodes.${n} fora do mapa/piso`);
  const adj = new Map(names.map((n) => [n, []]));
  for (const e of m.paths?.edges || []) {
    if (!check(Array.isArray(e) && e.length === 2 && nodes[e[0]] && nodes[e[1]] && e[0] !== e[1], `aresta inválida: ${JSON.stringify(e)}`)) continue;
    adj.get(e[0]).push(e[1]); adj.get(e[1]).push(e[0]);
  }
  if (names.length) {
    const seen = new Set([names[0]]), stack = [names[0]];
    while (stack.length) for (const nb of adj.get(stack.pop())) if (!seen.has(nb)) { seen.add(nb); stack.push(nb); }
    check(seen.size === names.length, `grafo desconexo: alcança ${seen.size} de ${names.length} nós (${names.filter((n) => !seen.has(n)).join(', ')})`);
  }

  // fx
  if (check(m.fx && m.fx.image === 'fx.png' && m.fx.data === 'fx.json', 'manifest.fx inválido')) {
    const tags = checkSheet('fx.json', 'fx.png', FX_TAGS);
    for (const t of FX_TAGS) if (tags[t]) check(anim[t] && anim[t].frames === tags[t].n && tags[t].durations.every((d) => d === Math.round(1000 / anim[t].fps)), `fx: ${t} não bate com manifest.animations`);
    check(m.fx.anchors && m.fx.anchors.head && isInt(m.fx.anchors.head.x) && isInt(m.fx.anchors.head.y), 'manifest.fx.anchors.head ausente');
  }
}

// nenhum arquivo v1 sobrando; todos os PNGs passam na paleta (inclui preview)
for (const f of fs.readdirSync(DIR)) {
  check(!/^room_/.test(f), `arquivo v1 órfão: ${f}`);
  if (f.endsWith('.png') && !/^icon-/.test(f)) img(f); // ícones do app usam o fundo da interface
}

if (errors.length) {
  console.error(`validate: ${errors.length} erro(s)`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`validate: OK — ${fs.readdirSync(DIR).length} arquivos, ${COLORS.length} cores, manifest v2 e sheets conforme o contrato`);
