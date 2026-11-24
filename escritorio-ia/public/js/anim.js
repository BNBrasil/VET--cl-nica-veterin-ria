// Player de animação por personagem/objeto. Usa o relógio local (performance.now),
// independente do relógio do servidor. Trocar de tag reinicia a animação.

// Quadros/FPS da tabela do PDF — usados no MODO PLACEHOLDER (e como fallback de tag ausente).
const SYNTH = {
  work: [6, 8], base_read: [4, 6], base_idle: [2, 4], base_doze: [4, 4], base_sleep: [4, 3],
  base_wait: [2, 4], base_done: [4, 8], base_error: [3, 6],
  base_walk_down: [4, 8], base_walk_up: [4, 8], base_walk_left: [4, 8], base_walk_right: [4, 8],
  obj_off: [1, 1], obj_work: [4, 6], obj_sleep: [4, 2],
  fx_zzz: [4, 3], fx_question: [2, 4], fx_smoke: [4, 8], fx_sweat: [3, 6], fx_star: [4, 8], fx_magnifier: [2, 4],
};

function synthDef(tag) {
  const key = SYNTH[tag] ? tag : (tag.endsWith('_work') ? 'work' : 'base_idle');
  const [n, fps] = SYNTH[key];
  return { count: n, durations: new Array(n).fill(1000 / fps), direction: 'forward' };
}

/** Sequência de índices (0..n-1 relativos) para a direção do Aseprite. */
function sequence(n, direction) {
  const fwd = [...Array(n).keys()];
  if (direction === 'reverse') return fwd.reverse();
  if (direction === 'pingpong' && n > 2) return fwd.concat(fwd.slice(1, -1).reverse());
  return fwd;
}

export class AnimPlayer {
  /**
   * @param {object|null} sheet  sheet de assets.js (null = placeholder sintético)
   * @param {object} animMeta    manifest.animations (fps/loop por nome), opcional
   */
  constructor(sheet, animMeta = {}) {
    this.sheet = sheet;
    this.animMeta = animMeta || {};
    this.tag = null;
    this.start = 0;
    this._def = null;
  }

  has(tag) {
    return !this.sheet || !!this.sheet.tags[tag];
  }

  /** Toca `tag`. Se já for a tag atual, não reinicia (a menos que restart=true). */
  play(tag, now = performance.now(), restart = false) {
    if (this.tag === tag && !restart) return;
    this.tag = tag;
    this.start = now;
    this._def = this._build(tag);
  }

  _build(tag) {
    const meta = this.animMeta[tag] || this.animMeta[tag.replace(/^[^_]+_work$/, 'work')] || {};
    const loop = meta.loop !== false;
    if (!this.sheet || !this.sheet.tags[tag]) {
      const s = synthDef(tag);
      const seq = sequence(s.count, s.direction);
      return { seq, durations: seq.map((i) => s.durations[i]), frames: null, loop };
    }
    const t = this.sheet.tags[tag];
    const n = t.to - t.from + 1;
    const seq = sequence(n, t.direction).map((i) => t.from + i);
    const durations = seq.map((i) => {
      const d = this.sheet.frames[i]?.duration;
      return d > 0 ? d : (meta.fps ? 1000 / meta.fps : 100);
    });
    return { seq, durations, frames: this.sheet.frames, loop };
  }

  /** Índice dentro da sequência atual (0..n-1). */
  step(now = performance.now()) {
    const d = this._def;
    if (!d) return 0;
    const total = d.durations.reduce((a, b) => a + b, 0) || 1;
    let t = now - this.start;
    if (d.loop) t %= total;
    else if (t >= total) return d.seq.length - 1;
    for (let i = 0; i < d.durations.length; i++) {
      if (t < d.durations[i]) return i;
      t -= d.durations[i];
    }
    return d.seq.length - 1;
  }

  /** Quadro atual da sheet ({x,y,w,h}) ou null no modo sintético. */
  frame(now = performance.now()) {
    const d = this._def;
    if (!d || !d.frames) return null;
    return d.frames[d.seq[this.step(now)]] || null;
  }

  /** Desenha com o ponto (ax, ay) como âncora: 'foot' = inferior-central, 'top' = superior-esquerdo. */
  draw(ctx, ax, ay, anchor = 'foot', now = performance.now()) {
    const f = this.frame(now);
    if (!f) return null;
    const x = anchor === 'foot' ? Math.round(ax - f.w / 2) : Math.round(ax);
    const y = anchor === 'foot' ? Math.round(ay - f.h) : Math.round(ay);
    ctx.drawImage(this.sheet.img, f.x, f.y, f.w, f.h, x, y, f.w, f.h);
    return f;
  }
}
