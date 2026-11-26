// Gera todos os assets de pixel art v2 (isométrico) em public/assets/ (npm run sprites).
// Arte 100% própria, desenhada por código com a paleta fechada do tema aplicado. Contrato: CONTRATO.md
// ("Versão 2") e temas/CONTRATO.md (temas, formatos de mapa, personagens).
//
//   node art/generate.js                       tema de data/aparencia.json (ou padrao) + ajustes do usuário
//   node art/generate.js --tema neon           força um tema (os ajustes do usuário continuam valendo)
//   node art/generate.js --formato L --tamanho grande
//   node art/generate.js --data <pasta> | --sem-aparencia | --out <pasta> | --sem-preview | --miniaturas
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COLORS, PALETTE, ACCENT } from './palette.js';
import { Canvas } from './draw.js';
import { packSheet } from './sheet.js';
import { characterAnims, CW, CH, ANCHOR, STANDING } from './chars.js';
import { buildMap, layoutData, criarPlano } from './map.js';
import { T } from './iso.js';
import { renderObject } from './objects.js';
import { fxAnims, FW, FH } from './fx.js';
import { makeIcons } from './icons.js';
import { aplicarConfig, aparenciaResolvida, acender, pocasDeLuz } from './aplicar.js';
import { configDoDisco, resolverConfig, listarTemas, carregarTema, OPCOES, ROOT } from './tema.js';
import { encodePNG } from './png.js';

export const OUT = path.join(ROOT, 'public', 'assets');

function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }

/**
 * Gera os assets para uma configuração resolvida (art/tema.js → resolverConfig).
 * opts: { out, preview = true, escrever = true, limpar = true, icones = true }.
 * Retorna { manifest, tema, scene, plan, ms, arquivos }.
 */
export function gerar(cfg, { out = OUT, preview = true, escrever = true, limpar = true, icones = true } = {}) {
  const t0 = Date.now();
  const rooms = cfg.rooms;
  const agentIds = rooms.rooms.map((r) => r.id);
  const commonIds = rooms.common.map((r) => r.id);
  const allRoomIds = [...agentIds, ...commonIds];
  const convidados = (rooms.convidados || []).map((c) => c.id).filter((id) => STANDING.includes(id));

  const ap = aplicarConfig(cfg);
  const plan = criarPlano(cfg.mapa);
  const noite = ap.style.iluminacao === 'noite';

  if (escrever) fs.mkdirSync(out, { recursive: true });
  const written = new Set();
  const write = (name, data) => { if (escrever) { fs.mkdirSync(path.dirname(path.join(out, name)), { recursive: true }); fs.writeFileSync(path.join(out, name), data); } written.add(name); };
  const writeJSON = (name, obj) => write(name, JSON.stringify(obj, null, 2) + '\n');

  const animations = {};
  const addAnims = (list) => {
    for (const a of list) {
      const prev = animations[a.tag];
      if (prev && (prev.fps !== a.fps || prev.frames !== a.frames.length)) throw new Error(`tag ${a.tag} com fps/quadros diferentes entre sheets`);
      animations[a.tag] = { fps: a.fps, loop: true, frames: a.frames.length };
    }
  };

  // ---------------------------------------------------------------- mapa
  const { bg, fg, rooms: ctxs } = buildMap(plan, ap.style);
  const layout = layoutData(plan);
  const MAP_W = plan.W, MAP_H = plan.H;

  // ---------------------------------------------------------------- objetos (e "furo" no fg onde o objeto aparece)
  const roomsOut = {};
  const objById = {};
  for (const id of allRoomIds) {
    const r = ctxs[id];
    const o = renderObject(id, r, MAP_W, MAP_H);
    objById[id] = o;
    for (let k = 0; k < o.mask.px_.length; k++) if (o.mask.px_[k] >= 0) fg.px_[k] = -1;
    if (noite) for (const a of o.anims) a.frames.forEach((f) => acender(f, ap.litMap));
    addAnims(o.anims);
    const { sheet, json } = packSheet(o.anims, `obj_${id}.png`);
    if (escrever) { write(`obj_${id}.png`, sheet.toPNG()); writeJSON(`obj_${id}.json`, json); }
    const L = layout.rooms[id];
    roomsOut[id] = {
      label: L.label,
      poly: L.poly,
      seat: L.seat,
      object: { image: `obj_${id}.png`, data: `obj_${id}.json`, x: o.x, y: o.y, w: o.w, h: o.h },
      door: L.door,
    };
  }

  // ---------------------------------------------------------------- noite: poças de luz (mesas, luminárias, corredor)
  if (noite) {
    const lights = [...ap.style.lights];
    for (const id of allRoomIds) {
      const s = roomsOut[id].seat;
      if (id !== 'lounge') lights.push({ x: s.x + 6, y: s.y - 2, r: 30 });
    }
    { // abajur da sala de roteiro (objeto)
      const r = ctxs.roteirista, sh = r.objShift || { i: 0, j: 0 };
      const p = r.iso.pt(r.I0 + 92 + sh.i, r.J0 + 30 + sh.j);
      lights.push({ x: p.x, y: p.y, r: 34 });
    }
    for (const w of plan.wings) for (let i = 48; i < w.corrLen; i += 112) { const p = w.iso.pt(i, w.spineJ); lights.push({ x: p.x, y: p.y, r: 30 }); }
    pocasDeLuz(bg, lights, ap.litMap);
  }
  if (escrever) { write('map_bg.png', bg.toPNG()); write('map_fg.png', fg.toPNG()); }

  // ---------------------------------------------------------------- personagens
  const characters = {};
  const convOut = {};
  const charAnims = {};
  for (const id of [...agentIds, 'visitante', ...convidados]) {
    const anims = characterAnims(id, ap.looks[id]);
    if (noite) { const seen = new Set(); for (const a of anims) for (const f of a.frames) if (!seen.has(f)) { seen.add(f); acender(f, ap.litMap); } }
    charAnims[id] = anims;
    addAnims(anims);
    const { sheet, json } = packSheet(anims, `char_${id}.png`);
    json.meta.anchor = { ...ANCHOR };
    if (escrever) { write(`char_${id}.png`, sheet.toPNG()); writeJSON(`char_${id}.json`, json); }
    if (agentIds.includes(id)) characters[id] = { image: `char_${id}.png`, data: `char_${id}.json` };
    else if (id !== 'visitante') convOut[id] = { image: `char_${id}.png`, data: `char_${id}.json`, work: `${id}_work` };
  }

  // ---------------------------------------------------------------- fx
  const fx = fxAnims().map((a) => ({ ...a, frames: a.frames.map((f) => f.clone()) })); // cópia: a noite remapeia os pixels
  if (noite) for (const a of fx) a.frames.forEach((f) => acender(f, ap.litMap));
  addAnims(fx);
  {
    const { sheet, json } = packSheet(fx, 'fx.png');
    if (escrever) { write('fx.png', sheet.toPNG()); writeJSON('fx.json', json); }
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
    convidados: convOut,
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
      + '(espelhe o x quando flip). obj_* e fx_* são loops; base_done/base_error também podem tocar em loop pela duração do estado. '
      + 'convidados = visitantes com sprite próprio (tag de trabalho <id>_work, e também visitante_work).',
  };

  // ---------------------------------------------------------------- tema aplicado (para a interface)
  const temaOut = {
    id: cfg.tema.id, nome: cfg.tema.nome, descricao: cfg.tema.descricao,
    interface: cfg.tema.interface || {},
    iluminacao: ap.style.iluminacao,
    mapa: { ...cfg.mapa, w: MAP_W, h: MAP_H },
    salas: Object.fromEntries(Object.entries(cfg.salas).map(([id, s]) => [id, { ...s, ...(ACCENT[id] ? { destaqueFinal: PALETTE[ACCENT[id].mid] } : {}) }])),
    personagens: aparenciaResolvida(ap.looks, cfg),
    paleta: { pele: cfg.paleta.pele, cabelo: cfg.paleta.cabelo, cores: COLORS.length },
    opcoes: OPCOES,
    avisos: cfg.avisos,
  };
  temaOut.versao = hash(JSON.stringify({ t: temaOut, c: COLORS }));
  manifest.tema = { id: temaOut.id, versao: temaOut.versao };
  if (escrever) {
    writeJSON('palette.json', { count: COLORS.length, colors: COLORS, names: PALETTE });
    writeJSON('manifest.json', manifest);
    temaOut.temas = listarTemas().map((id) => { try { const t = carregarTema(id); return { id, nome: t.nome || id, descricao: t.descricao || '', miniatura: `temas/${id}.png`, interface: t.interface || {} }; } catch { return null; } }).filter(Boolean);
    writeJSON('tema.json', temaOut);
  }

  // ---------------------------------------------------------------- cena (mapa com todo mundo) + preview
  const frameOf = (id, tag, i = 0) => { const a = charAnims[id].find((x) => x.tag === tag); return a.frames[i % a.frames.length]; };
  const objFrame = (id, tag, i) => { const a = objById[id].anims.find((x) => x.tag === tag); return a.frames[i % a.frames.length]; };
  const putChar = (c, f, p, flip = false) => c.blit(f, p.x - ANCHOR.x, p.y - ANCHOR.y, { flipX: flip });
  const scene = new Canvas(MAP_W, MAP_H);
  {
    scene.rect(0, 0, MAP_W, MAP_H, 'navy');
    scene.blit(bg, 0, 0);
    const sprites = [];
    for (const id of allRoomIds) sprites.push({ y: roomsOut[id].object.y + roomsOut[id].object.h, draw: (c) => c.blit(objFrame(id, 'obj_work', 2), roomsOut[id].object.x, roomsOut[id].object.y) });
    agentIds.forEach((id) => { const s = roomsOut[id].seat; sprites.push({ y: s.y, draw: (c) => putChar(c, frameOf(id, `${id}_work`, 1), s, s.flip) }); });
    const lg = layout.lounge;
    sprites.push({ y: lg.sofa[1].y, draw: (c) => putChar(c, frameOf('visitante', 'base_sleep', 1), lg.sofa[1], lg.sofa[1].flip) });
    sprites.push({ y: lg.sofa[2].y, draw: (c) => putChar(c, frameOf('programador', 'base_idle', 0), lg.sofa[2], lg.sofa[2].flip) });
    const vis = convidados.length ? convidados : ['visitante', 'visitante', 'visitante'];
    lg.visitors.forEach((v, k) => { const id = vis[k % vis.length]; sprites.push({ y: v.y, draw: (c) => putChar(c, frameOf(id, `${id}_work`, k), v, v.flip) }); });
    // alguém andando no corredor
    const n = layout.paths.nodes;
    const walkNode = n.c_296 || n[Object.keys(n).find((k) => /^(c_|a_)/.test(k))];
    if (walkNode) sprites.push({ y: walkNode.y + 12, draw: (c) => putChar(c, frameOf('desenvolvedor', 'base_walk_se', 0), { x: walkNode.x + 24, y: walkNode.y + 12 }) });
    if (n.e_pe && n.e_alto) { const m = { x: Math.round((n.e_pe.x + n.e_alto.x) / 2), y: Math.round((n.e_pe.y + n.e_alto.y) / 2) }; sprites.push({ y: m.y, draw: (c) => putChar(c, frameOf('roteirista', 'base_walk_ne', 1), m) }); }
    sprites.sort((a, b) => a.y - b.y).forEach((s) => s.draw(scene));
    scene.blit(fg, 0, 0);
    const fxF = (tag, i = 0) => fx.find((a) => a.tag === tag).frames[i];
    const putFx = (tag, p, i = 0) => { const a = manifest.fx.anchors[tag]; scene.blit(fxF(tag, i), p.x + a.x - FW / 2, p.y + a.y - FH / 2); };
    putFx('fx_zzz', lg.sofa[1], 2);
    putFx('fx_heart', lg.sofa[2], 1);
    putFx('fx_music', roomsOut['editor-video'].seat, 1);
  }
  if (preview) write('preview.png', previewSheet(scene, { charAnims, objById, fx, agentIds, allRoomIds, convidados, MAP_W, MAP_H }).toPNG(2));

  // ---------------------------------------------------------------- limpa arquivos órfãos em public/assets
  if (escrever && limpar) {
    for (const f of fs.readdirSync(out)) if (/\.(png|json)$/.test(f) && !written.has(f) && !/^icon-/.test(f)) fs.unlinkSync(path.join(out, f));
    if (!preview && fs.existsSync(path.join(out, 'preview.png'))) fs.unlinkSync(path.join(out, 'preview.png'));
  }
  if (escrever && icones) makeIcons(out); // ícones do app (gerados depois da limpeza)
  return { manifest, tema: temaOut, scene, plan, ms: Date.now() - t0, arquivos: written.size, merges: ap.merges };
}

/** Folha de conferência: mapa com todos + todas as animações, efeitos e objetos. */
function previewSheet(scene, { charAnims, objById, fx, agentIds, allRoomIds, convidados, MAP_W, MAP_H }) {
  const objFrame = (id, tag, i) => { const a = objById[id].anims.find((x) => x.tag === tag); return a.frames[i % a.frames.length]; };
  const order = (id) => [`${id}_work`, 'base_idle', 'base_read', 'base_doze', 'base_sleep', 'base_wait', 'base_done', 'base_error', 'base_walk_se', 'base_walk_ne', 'base_stand'];
  const labels = { base_idle: 'IDLE', base_read: 'READ', base_doze: 'DOZE', base_sleep: 'SLEEP', base_wait: 'WAIT', base_done: 'DONE', base_error: 'ERROR', base_walk_se: 'WALK SE', base_walk_ne: 'WALK NE', base_stand: 'STAND' };
  const W = MAP_W, pad = 6, cell = CW + 2;
  const blocks = [];
  let y = MAP_H + pad;
  for (const id of [...agentIds, 'visitante', ...convidados]) {
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
  for (const a of fx) { a.frames.forEach((f) => { sheet.rect(fx0, fxY, FW, FH, 'slate'); sheet.blit(f, fx0, fxY); fx0 += FW + 1; }); fx0 += 5; }
  for (const { x, y: yy, id, o } of objItems) {
    sheet.text(id.split('-')[0], x, yy - 7, 'wood');
    ['obj_off', 'obj_work', 'obj_sleep'].forEach((t, k) => { sheet.rect(x + k * (o.w + 2), yy, o.w, o.h, 'light'); sheet.blit(objFrame(id, t, 1), x + k * (o.w + 2), yy); });
  }
  return sheet;
}

/** Miniatura (~320 px) de um tema: recorte do mapa com personagens, na escala 1:1 (pixels nítidos). */
export function miniatura(scene, manifest) {
  const W = 320, H = 200;
  const r = manifest.rooms.roteirista.seat, e = manifest.rooms['editor-video'].seat;
  const cx = Math.round((r.x + e.x) / 2), cy = Math.round((r.y + e.y) / 2) - 10;
  const x0 = Math.max(0, Math.min(scene.w - W, cx - W / 2)), y0 = Math.max(0, Math.min(scene.h - H, cy - H / 2));
  const c = new Canvas(W, H);
  c.blit(scene, -x0, -y0);
  c.frame(0, 0, W, H, 'outline');
  return c;
}

/** Gera as miniaturas de todos os temas prontos em <out>/temas/<id>.png. */
export function gerarMiniaturas({ out = OUT } = {}) {
  const dir = path.join(out, 'temas');
  fs.mkdirSync(dir, { recursive: true });
  const feitos = [];
  for (const id of listarTemas()) {
    const cfg = resolverConfig({ tema: id });
    cfg.mapa = { formato: 'duas-fileiras', tamanhoSala: 'media' };
    const r = gerar(cfg, { escrever: false, preview: false });
    fs.writeFileSync(path.join(dir, `${id}.png`), encodePNG(320, 200, miniatura(r.scene, r.manifest).toRGBA()));
    feitos.push(id);
  }
  return feitos;
}

// ---------------------------------------------------------------- linha de comando
function args(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const v = () => argv[++i];
    if (a === '--tema') o.tema = v();
    else if (a === '--formato') o.formato = v();
    else if (a === '--tamanho') o.tamanho = v();
    else if (a === '--data') o.data = v();
    else if (a === '--out') o.out = v();
    else if (a === '--sem-aparencia') o.semAparencia = true;
    else if (a === '--sem-preview') o.semPreview = true;
    else if (a === '--miniaturas') o.miniaturas = true;
    else if (a === '--sem-miniaturas') o.semMiniaturas = true;
    else if (a === '-h' || a === '--help') o.help = true;
  }
  return o;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const o = args(process.argv.slice(2));
  if (o.help) {
    console.log('uso: node art/generate.js [--tema <id>] [--formato duas-fileiras|uma-fileira|L|andares] [--tamanho pequena|media|grande]\n'
      + '                        [--data <pasta com aparencia.json>] [--sem-aparencia] [--out <pasta>] [--sem-preview] [--miniaturas]');
    process.exit(0);
  }
  const t0 = Date.now();
  const out = o.out ? path.resolve(o.out) : OUT;
  const mapa = {};
  if (o.formato) mapa.formato = o.formato;
  if (o.tamanho) mapa.tamanhoSala = o.tamanho;
  let cfg;
  try { cfg = configDoDisco({ tema: o.tema, dataDir: o.data, semAparencia: o.semAparencia, mapa: Object.keys(mapa).length ? mapa : null }); } catch (e) { console.error('erro: ' + e.message); process.exit(1); }
  for (const a of cfg.avisos) console.warn('aviso: ' + a);
  let minis = [];
  if (o.miniaturas || (!o.semMiniaturas && !o.out && listarTemas().some((id) => !fs.existsSync(path.join(out, 'temas', `${id}.png`))))) minis = gerarMiniaturas({ out });
  const r = gerar(cfg, { out, preview: !o.semPreview });
  console.log(`sprites v2: ${r.arquivos} arquivos em ${path.relative(ROOT, out) || out} — tema ${cfg.tema.id}, ${cfg.mapa.formato}/${cfg.mapa.tamanhoSala}, `
    + `mapa ${r.plan.W}x${r.plan.H}, ${COLORS.length} cores${r.merges.length ? ` (${r.merges.length} fundidas para caber em 64)` : ''}`
    + `${minis.length ? `, ${minis.length} miniaturas` : ''} em ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
