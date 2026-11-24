// Efeitos 16x16 (v2): zzz subindo, "?" piscando, fumaça, suor, estrela, lupa, coração, nota musical, brilho.
// Todos com contorno escuro de 1 px (aplicado pela Layer).
import { Canvas } from './draw.js';
import { Layer } from './iso.js';

export const FW = 16, FH = 16;
const make = (n, fn) => Array.from({ length: n }, (_, i) => { const out = new Canvas(FW, FH); const L = new Layer(FW, FH); fn(L, i, out); L.stamp(out); return out; });
const shape = (L, rows, x, y, map) => rows.forEach((r, yy) => [...r].forEach((ch, xx) => { if (ch !== '.') L.px(x + xx, y + yy, map[ch]); }));

const Z_BIG = ['####', '..#.', '.#..', '####'];
const Z_SMALL = ['###', '.#.', '###'];
const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
const STAR = ['...#...', '...#...', '.#####.', '#######', '.#####.', '.##.##.', '#.....#'];
const NOTE = ['...##', '...#.#', '...#..', '...#..', '.###..', '####..', '.##...'];
const QMARK = ['.###.', '#...#', '...#.', '..#..', '.....', '..#..'];

export const FX = {
  fx_zzz: { fps: 3, frames: make(4, (L, i) => {
    const zs = [[2, 11, 0], [6, 6, 1], [10, 1, 2]];
    zs.forEach(([x, y, k]) => {
      if (k > i) return;
      const drift = (i - k) % 2;
      shape(L, k === 0 ? Z_SMALL : Z_BIG, x + drift, y - (i - k), { '#': k === i ? 'snow' : 'blueLight' });
    });
  }) },
  fx_question: { fps: 4, frames: make(4, (L, i) => {
    const bg = i % 2 ? 'lamp' : 'snow', y = i === 1 || i === 2 ? 0 : 1;
    for (let yy = 0; yy < 11; yy++) for (let xx = 0; xx < 12; xx++) { const corner = (xx === 0 || xx === 11) && (yy === 0 || yy === 10); if (!corner) L.px(2 + xx, y + yy, bg); }
    L.px(5, y + 11, bg); L.px(6, y + 11, bg); L.px(5, y + 12, bg);
    shape(L, QMARK, 5, y + 2, { '#': 'orangeDark' });
    L.px(6, y + 2, 'orange'); L.px(7, y + 2, 'orange');
  }) },
  fx_smoke: { fps: 6, frames: make(4, (L, i) => {
    const puffs = [[8, 12, 3], [6, 8, 3], [10, 5, 3], [7, 2, 2]];
    puffs.forEach(([x, y, r], k) => {
      const kk = (k + i) % 4, yy = y - i, rr = r - (kk === 3 ? 1 : 0);
      for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) if (dx * dx + dy * dy <= rr * rr) L.px(x + dx + (i % 2), yy + dy, dx + dy < -1 ? 'light' : kk < 2 ? 'silver' : 'gray');
    });
  }) },
  fx_sweat: { fps: 6, frames: make(4, (L, i) => {
    const y = 3 + i * 2;
    L.px(8, y, 'cyanLight'); L.px(7, y + 1, 'cyanLight'); L.px(8, y + 1, 'snow'); L.px(9, y + 1, 'cyan');
    L.px(7, y + 2, 'cyan'); L.px(8, y + 2, 'cyan'); L.px(9, y + 2, 'cyanDark'); L.px(8, y + 3, 'cyanDark');
    if (i < 2) { L.px(12, 6 + i, 'cyanLight'); L.px(12, 7 + i, 'cyan'); }
  }) },
  fx_star: { fps: 8, frames: make(4, (L, i) => {
    const s = i % 2 ? 1 : 0;
    shape(L, STAR, 4, 4 - s, { '#': i === 2 ? 'snow' : 'lamp' });
    L.px(7, 6 - s, 'snow'); L.px(7, 7 - s, 'yellow');
    const sp = [[1, 2], [13, 3], [2, 12], [13, 12]][i]; L.px(sp[0], sp[1], 'snow');
  }) },
  fx_magnifier: { fps: 6, frames: make(4, (L, i) => {
    const dx = [0, 1, 1, 0][i], dy = [0, 0, 1, 1][i];
    for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
      const d = Math.hypot(x, y);
      if (d <= 3.2) L.px(6 + dx + x, 6 + dy + y, x + y < -2 ? 'snow' : 'cyanLight');
      else if (d <= 4.4) L.px(6 + dx + x, 6 + dy + y, 'silver');
    }
    for (let k = 0; k < 4; k++) { L.px(10 + dx + k, 10 + dy + k, 'wood'); L.px(11 + dx + k, 10 + dy + k, 'woodDark'); }
  }) },
  fx_heart: { fps: 6, frames: make(4, (L, i) => {
    const y = 6 - i, x = 4 + (i % 2);
    shape(L, HEART, x, y, { '#': 'pink' });
    L.px(x + 1, y + 1, 'pinkLight'); L.px(x + 1, y + 2, 'snow');
  }) },
  fx_music: { fps: 6, frames: make(4, (L, i) => {
    shape(L, NOTE, 4 + (i % 2), 6 - i, { '#': i % 2 ? 'neon' : 'purple' });
    if (i >= 2) { L.px(12, 4 - (i - 2), 'cyanLight'); L.px(12, 5 - (i - 2), 'cyanLight'); L.px(11, 6 - (i - 2), 'cyan'); }
  }) },
  fx_sparkle: { fps: 8, frames: make(4, (L, i) => {
    const pts = [[4, 4], [11, 6], [6, 11], [12, 12]];
    pts.forEach(([x, y], k) => {
      const ph = (i + k) % 4;
      if (ph === 0) { L.px(x, y, 'snow'); }
      else if (ph === 1) { L.px(x, y, 'snow'); L.px(x - 1, y, 'lamp'); L.px(x + 1, y, 'lamp'); L.px(x, y - 1, 'lamp'); L.px(x, y + 1, 'lamp'); }
      else if (ph === 2) { L.px(x, y, 'lamp'); L.px(x - 2, y, 'lamp'); L.px(x + 2, y, 'lamp'); L.px(x, y - 2, 'lamp'); L.px(x, y + 2, 'lamp'); L.px(x, y - 1, 'snow'); L.px(x, y + 1, 'snow'); L.px(x - 1, y, 'snow'); L.px(x + 1, y, 'snow'); }
    });
  }) },
};

export function fxAnims() { return Object.entries(FX).map(([tag, { fps, frames }]) => ({ tag, fps, frames })); }
