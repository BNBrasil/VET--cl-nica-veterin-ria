// Efeitos 16x16: zzz subindo, balão "?", fumaça, gota de suor, estrelinha, lupa.
import { Canvas } from './draw.js';

export const FX_FPS = { fx_zzz: 3, fx_question: 4, fx_smoke: 6, fx_sweat: 6, fx_star: 8, fx_magnifier: 6 };
const make = (n, fn) => Array.from({ length: n }, (_, i) => { const c = new Canvas(16, 16); fn(c, i); return c; });

function z(c, x, y, size, col) {
  if (size === 1) { c.hline(x, x + 2, y, col); c.px(x + 1, y + 1, col); c.hline(x, x + 2, y + 2, col); return; }
  c.hline(x, x + 3, y, col); c.px(x + 2, y + 1, col); c.px(x + 1, y + 2, col); c.hline(x, x + 3, y + 3, col);
}
function outlined(c, fn) {
  const t = new Canvas(16, 16); fn(t);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (t.get(x, y) >= 0) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (t.get(x + dx, y + dy) < 0) c.px(x + dx, y + dy, 'outline');
  c.blit(t, 0, 0);
}

export const FX = {
  fx_zzz: () => make(4, (c, i) => outlined(c, (t) => {
    // três "z" subindo em espiral
    const ph = [[2, 12, 1], [6, 7, 2], [10, 2, 2]];
    ph.forEach(([x, y, s], k) => { if (k <= i) z(t, x + (i - k) % 2, y - (i > k ? 1 : 0), s, k === i ? 'white' : 'blueLight'); });
  })),
  fx_question: () => make(2, (c, i) => {
    c.rect(2, 1, 12, 11, 'outline'); c.rect(3, 0, 10, 13, 'outline'); c.rect(3, 1, 10, 11, i ? 'lamp' : 'white'); c.rect(2, 2, 12, 9, i ? 'lamp' : 'white');
    c.frame(2, 1, 12, 11, 'outline'); c.px(2, 1, null); c.px(13, 1, null); c.px(2, 11, null); c.px(13, 11, null); c.px(3, 1, 'outline'); c.px(12, 1, 'outline'); c.px(3, 11, 'outline'); c.px(12, 11, 'outline');
    c.hline(3, 12, 0, 'outline'); c.hline(3, 12, 12, 'outline');
    c.px(6, 13, 'outline'); c.px(7, 13, i ? 'lamp' : 'white'); c.px(8, 13, 'outline'); c.px(7, 14, 'outline'); c.px(7, 12, i ? 'lamp' : 'white');
    // "?"
    c.hline(6, 9, 3, 'orangeDark'); c.px(10, 4, 'orangeDark'); c.px(10, 5, 'orangeDark'); c.px(9, 6, 'orangeDark'); c.px(8, 7, 'orangeDark'); c.px(5, 4, 'orangeDark'); c.px(8, 9, 'orangeDark');
  }),
  fx_smoke: () => make(4, (c, i) => outlined(c, (t) => {
    const puffs = [[6, 11, 5], [4, 7, 6], [7, 3, 6], [5, 0, 4]];
    puffs.forEach(([x, y, r], k) => { const yy = y - i + (k === 0 ? 0 : 0); if (k <= i + 1 && yy >= 0) { t.ellipse(x + (i % 2), yy, r, r, k > 1 ? 'silver' : 'gray'); t.px(x + 1 + (i % 2), yy + 1, 'light'); } });
  })),
  fx_sweat: () => make(3, (c, i) => outlined(c, (t) => {
    const y = 3 + i * 3;
    t.px(7, y, 'cyanLight'); t.hline(6, 8, y + 1, 'cyan'); t.rect(5, y + 2, 5, 2, 'cyan'); t.hline(6, 8, y + 4, 'cyanDark'); t.px(6, y + 2, 'white');
  })),
  fx_star: () => make(4, (c, i) => outlined(c, (t) => {
    const r = [2, 4, 5, 3][i];
    t.vline(7, 7 - r, 8 + r, 'lamp'); t.hline(7 - r, 8 + r, 7, 'lamp'); t.vline(8, 7 - r + 1, 8 + r - 1, 'yellow'); t.hline(7 - r + 1, 8 + r - 1, 8, 'yellow');
    t.rect(6, 6, 4, 4, 'lamp'); t.px(7, 7, 'white');
    if (i >= 2) { t.px(2, 2, 'lamp'); t.px(13, 3, 'yellow'); t.px(12, 13, 'lamp'); }
  })),
  fx_magnifier: () => make(4, (c, i) => {
    const dx = [0, 1, 2, 1][i];
    c.ellipse(1 + dx, 1, 10, 10, 'outline'); c.ellipse(2 + dx, 2, 8, 8, 'silver'); c.ellipse(3 + dx, 3, 6, 6, 'cyanLight');
    c.px(4 + dx, 4, 'white'); c.px(5 + dx, 4, i === 2 ? 'white' : 'cyanLight'); c.px(4 + dx, 5, 'white');
    for (let k = 0; k < 4; k++) { c.px(10 + dx + k, 10 + k, 'woodDark'); c.px(11 + dx + k, 10 + k, 'wood'); c.px(10 + dx + k, 11 + k, 'outline'); }
  }),
};

export function fxAnims() {
  return Object.keys(FX).map((tag) => ({ tag, frames: FX[tag](), fps: FX_FPS[tag] }));
}
