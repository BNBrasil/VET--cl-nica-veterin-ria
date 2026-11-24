// Carrega public/assets/manifest.json e as sprite sheets (Aseprite JSON hash).
// Se o manifest não existir ou algo essencial falhar → MODO PLACEHOLDER.

const BASE = 'assets/';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('imagem não carregou: ' + src));
    img.src = src;
  });
}

async function loadJSON(src) {
  const r = await fetch(src, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${src}: HTTP ${r.status}`);
  return r.json();
}

/**
 * Sheet = { img, frames: [{x,y,w,h,duration}], tags: { name: { from, to, direction } } }
 * A ordem dos quadros segue a ordem das chaves do JSON hash (como o Aseprite exporta).
 */
export function parseAseprite(json, img) {
  const raw = Array.isArray(json.frames) ? json.frames : Object.values(json.frames || {});
  const frames = raw.map((f) => ({
    x: f.frame.x, y: f.frame.y, w: f.frame.w, h: f.frame.h,
    duration: f.duration || 100,
  }));
  const tags = {};
  for (const t of json.meta?.frameTags || []) {
    tags[t.name] = { from: t.from, to: t.to, direction: t.direction || 'forward' };
  }
  return { img, frames, tags };
}

async function loadSheet(imageFile, dataFile) {
  const [json, img] = await Promise.all([loadJSON(BASE + dataFile), loadImage(BASE + imageFile)]);
  return parseAseprite(json, img);
}

async function optional(p, what, warnings) {
  try { return await p; } catch (e) { warnings.push(`${what}: ${e.message}`); return null; }
}

/**
 * Retorna { placeholder, manifest, chars, visitor, fx, rooms: {id: {bg, object, seat, sofa}}, warnings }
 */
export async function loadAssets() {
  const warnings = [];
  let manifest;
  try {
    manifest = await loadJSON(BASE + 'manifest.json');
  } catch (e) {
    return { placeholder: true, reason: 'manifest ausente (' + e.message + ')', warnings, rooms: {}, chars: {} };
  }

  try {
    const chars = {};
    const rooms = {};
    const jobs = [];

    for (const [id, c] of Object.entries(manifest.characters || {})) {
      jobs.push(optional(loadSheet(c.image, c.data), 'personagem ' + id, warnings).then((s) => { if (s) chars[id] = s; }));
    }
    for (const [id, r] of Object.entries(manifest.rooms || {})) {
      const entry = { seat: r.seat || null, sofa: r.sofa || null, bg: null, object: null };
      rooms[id] = entry;
      if (r.background) {
        jobs.push(optional(loadImage(BASE + r.background), 'fundo ' + id, warnings).then((img) => { entry.bg = img; }));
      }
      if (r.object && r.object.image && r.object.data) {
        jobs.push(optional(loadSheet(r.object.image, r.object.data), 'objeto ' + id, warnings)
          .then((s) => { if (s) entry.object = { sheet: s, x: r.object.x || 0, y: r.object.y || 0 }; }));
      }
    }
    let fx = null, visitor = null;
    if (manifest.fx) jobs.push(optional(loadSheet(manifest.fx.image, manifest.fx.data), 'fx', warnings).then((s) => { fx = s; }));
    if (manifest.visitor) jobs.push(optional(loadSheet(manifest.visitor.image, manifest.visitor.data), 'visitante', warnings).then((s) => { visitor = s; }));

    await Promise.all(jobs);

    if (Object.keys(chars).length === 0) {
      return { placeholder: true, reason: 'nenhum personagem carregou', warnings, rooms: {}, chars: {} };
    }
    if (warnings.length) console.warn('[assets] avisos:', warnings);
    return { placeholder: false, manifest, chars, visitor, fx, rooms, warnings };
  } catch (e) {
    return { placeholder: true, reason: e.message, warnings, rooms: {}, chars: {} };
  }
}
