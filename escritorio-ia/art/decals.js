// Decalques planos para paredes (desenhados retos e depois cisalhados em 2:1 por wallDecal).
import { Canvas } from './draw.js';

const box = (c, x, y, w, h, col) => c.rect(x, y, w, h, col);

/** Quadro com moldura de 1 px escura e borda interna clara. */
export function board(w, h, { frame = 'outline', rim = 'silver', fill = 'white' } = {}) {
  const c = new Canvas(w, h);
  box(c, 0, 0, w, h, frame); box(c, 1, 1, w - 2, h - 2, rim); box(c, 2, 2, w - 4, h - 4, fill);
  return c;
}

export function clock(d = 18) {
  const c = new Canvas(d, d), r = d / 2;
  for (let y = 0; y < d; y++) for (let x = 0; x < d; x++) {
    const k = Math.hypot(x + 0.5 - r, y + 0.5 - r);
    if (k <= r) c.px(x, y, k > r - 1.2 ? 'outline' : k > r - 2.4 ? 'orange' : 'snow');
  }
  for (let a = 0; a < 12; a++) { const t = (a / 12) * Math.PI * 2; c.px(Math.round(r - 0.5 + Math.cos(t) * (r - 3.5)), Math.round(r - 0.5 + Math.sin(t) * (r - 3.5)), a % 3 ? 'silver' : 'ink'); }
  c.line(Math.floor(r), Math.floor(r), Math.floor(r), Math.floor(r) - 5, 'outline');
  c.line(Math.floor(r), Math.floor(r), Math.floor(r) + 3, Math.floor(r) + 2, 'outline');
  c.px(Math.floor(r), Math.floor(r), 'red');
  return c;
}

export function corkBoard(w = 46, h = 24) {
  const c = board(w, h, { frame: 'outline', rim: 'woodLight', fill: 'tan' });
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) if ((x * 7 + y * 11) % 9 === 0) c.px(x, y, 'sand');
  const notes = [[4, 4, 'lamp'], [13, 3, 'pinkLight'], [22, 5, 'cyanLight'], [32, 3, 'greenLight'], [6, 13, 'orangeLight'], [16, 14, 'lamp'], [26, 13, 'pinkLight'], [36, 13, 'snow']];
  for (const [x, y, col] of notes) {
    if (x + 7 > w - 2) continue;
    box(c, x, y, 7, 7, col); c.hline(x + 1, x + 5, y + 3, 'silver'); c.hline(x + 1, x + 4, y + 5, 'silver');
    c.px(x + 3, y, 'red');
  }
  c.line(10, 7, 26, 9, 'red'); c.line(26, 9, 35, 16, 'red'); // barbante ligando ideias
  return c;
}

export function poster(w, h, kind) {
  const c = board(w, h, { frame: 'outline', rim: 'ink', fill: 'navy' });
  const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
  switch (kind) {
    case 'sun': box(c, 2, 2, w - 4, h - 4, 'orangeLight'); for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) if (x * x + y * y <= 16) c.px(cx + x, cy - 2 + y, 'orange'); box(c, 2, h - 6, w - 4, 4, 'pink'); break;
    case 'circle': box(c, 2, 2, w - 4, h - 4, 'purpleDark'); for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) if (x * x + y * y <= 25) c.px(cx - 2 + x, cy - 1 + y, 'cyan'); for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x * x + y * y <= 9) c.px(cx + 3 + x, cy + 2 + y, 'pink'); break;
    case 'film': box(c, 2, 2, w - 4, h - 4, 'ink'); for (let y = 3; y < h - 3; y += 3) { c.px(3, y, 'light'); c.px(w - 4, y, 'light'); } box(c, 6, 5, w - 12, h - 10, 'purple'); for (let k = 0; k < 3; k++) c.px(cx - 1 + k, cy, 'snow'); c.px(cx - 1, cy - 1, 'snow'); c.px(cx - 1, cy + 1, 'snow'); break;
    case 'triangle': box(c, 2, 2, w - 4, h - 4, 'lamp'); for (let y = 0; y < 9; y++) for (let x = -y; x <= y; x++) c.px(cx + Math.round(x / 1.4), 5 + y, 'blue'); box(c, 4, h - 6, w - 8, 2, 'red'); break;
    case 'chart': box(c, 2, 2, w - 4, h - 4, 'navy'); for (let k = 0; k < 5; k++) { const hh = [4, 7, 5, 9, 11][k]; box(c, 4 + k * 3, h - 4 - hh, 2, hh, 'green'); } c.line(4, h - 8, w - 5, 5, 'greenLight'); break;
    case 'check': box(c, 2, 2, w - 4, h - 4, 'snow'); for (let k = 0; k < 4; k++) { box(c, 4, 4 + k * 5, 3, 3, 'outline'); c.px(5, 5 + k * 5, k < 3 ? 'green' : 'snow'); c.hline(9, w - 5, 5 + k * 5, 'silver'); } break;
  }
  return c;
}

export function storyboard(n = 5) {
  const w = n * 13 + 1, h = 14;
  const c = new Canvas(w, h);
  for (let k = 0; k < n; k++) {
    const x = k * 13;
    box(c, x, 0, 13, 12, 'outline'); box(c, x + 1, 1, 11, 10, 'snow');
    // bonequinho/bolinha em poses diferentes
    const bx = x + 3 + k, by = 7 - [0, 3, 4, 3, 0][k % 5];
    box(c, bx, by, 3, 3, ['cyan', 'pink', 'orange', 'green', 'blue'][k % 5]);
    c.hline(x + 2, x + 10, 9, 'silver');
    c.px(x + 6, 12, 'red'); // alfinete
  }
  return c;
}

export function spriteSheet() {
  const c = board(26, 18, { frame: 'outline', rim: 'cyanDark', fill: 'cyanPale' });
  for (let k = 0; k < 4; k++) for (let r = 0; r < 2; r++) {
    const x = 3 + k * 5, y = 3 + r * 7;
    box(c, x + 1, y, 3, 3, r ? 'orange' : 'lamp'); box(c, x + 1, y + 3, 3, 2, r ? 'blue' : 'pink');
    c.px(x + (k % 2 ? 0 : 4), y + 4, 'outline');
  }
  return c;
}

export function palette(w = 38, h = 22) {
  const c = board(w, h, { frame: 'outline', rim: 'snow', fill: 'snow' });
  const cols = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink', 'redLight', 'orangeLight', 'lamp', 'greenLight', 'cyanLight', 'blueLight', 'neon', 'pinkLight'];
  cols.forEach((col, k) => { const x = 3 + (k % 8) * 4, y = 3 + Math.floor(k / 8) * 9; box(c, x, y, 3, 7, col); c.hline(x, x + 2, y + 7, 'outline'); });
  return c;
}

export function devices() {
  const c = new Canvas(52, 22);
  const dev = (x, y, w, h, scr) => { box(c, x, y, w, h, 'outline'); box(c, x + 1, y + 1, w - 2, h - 2, 'ink'); box(c, x + 2, y + 2, w - 4, h - 4, scr); c.hline(x + 2, x + w - 3, y + 3, 'snow'); };
  dev(0, 4, 8, 14, 'blueLight'); dev(10, 2, 8, 14, 'pinkLight'); dev(20, 0, 16, 12, 'greenLight'); dev(38, 3, 8, 14, 'orangeLight');
  box(c, 23, 3, 10, 2, 'blue'); box(c, 23, 6, 6, 4, 'snow'); box(c, 30, 6, 3, 4, 'pink');
  return c;
}

export function wireframes(w = 46, h = 24) {
  const c = board(w, h, { frame: 'outline', rim: 'silver', fill: 'snow' });
  for (let k = 0; k < 3; k++) {
    const x = 4 + k * 14;
    c.frame(x, 4, 9, 16, 'blue'); c.hline(x + 1, x + 7, 6, 'blueLight'); c.rect(x + 2, 8, 5, 4, 'bluePale'); c.hline(x + 2, x + 6, 14, 'silver'); c.hline(x + 2, x + 5, 16, 'silver');
    if (k < 2) { c.hline(x + 10, x + 12, 11, 'red'); c.px(x + 12, 10, 'red'); c.px(x + 12, 12, 'red'); }
  }
  return c;
}

export function aprovado() {
  const c = new Canvas(44, 14);
  box(c, 0, 0, 44, 14, 'outline'); box(c, 1, 1, 42, 12, 'red'); box(c, 2, 2, 40, 10, 'redPale'); c.frame(3, 3, 38, 8, 'red');
  c.text('APROVADO', 6, 5, 'red');
  return c;
}

export function foamPanel(w = 20, h = 20) {
  const c = new Canvas(w, h);
  box(c, 0, 0, w, h, 'outline');
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) c.px(x, y, ((Math.floor(x / 3) + Math.floor(y / 3)) % 2) ? 'purpleDark' : ((x + y) % 3 === 0 ? 'purple' : 'ink'));
  return c;
}

export function neonSign() {
  const c = new Canvas(30, 16);
  const g = 'neon', G = 'purple';
  // triângulo de "play" + moldura arredondada em neon
  c.frame(1, 1, 28, 14, G); c.frame(2, 2, 26, 12, g);
  for (let y = 0; y < 7; y++) for (let x = 0; x <= Math.floor(y < 4 ? y : 6 - y) * 1.5; x++) c.px(12 + x, 5 + y - 1 + 1, g);
  c.px(0, 7, G); c.px(29, 7, G);
  return c;
}

export function windowPane(w = 30, h = 22, sky = 'blueLight') {
  const c = new Canvas(w, h);
  box(c, 0, 0, w, h, 'outline'); box(c, 1, 1, w - 2, h - 2, 'snow'); box(c, 3, 3, w - 6, h - 6, sky);
  c.vline(Math.floor(w / 2), 3, h - 4, 'snow'); c.hline(3, w - 4, Math.floor(h / 2), 'snow');
  c.line(5, h - 6, 9, h - 10, 'snow'); c.line(w / 2 + 3, h - 6, w / 2 + 6, h - 9, 'snow');
  box(c, 4, 4, 5, 2, 'snow');
  box(c, -1 + 1, h - 2, w, 2, 'light');
  return c;
}

export function upperCabinets(w = 60) {
  const c = new Canvas(w, 14);
  box(c, 0, 0, w, 14, 'outline');
  for (let k = 0; k * 15 < w - 1; k++) { const x = 1 + k * 15; box(c, x, 1, 14, 12, 'cream'); c.frame(x + 1, 2, 12, 10, 'brownLight'); c.px(x + (k % 2 ? 2 : 11), 7, 'brownDark'); }
  return c;
}

export function tiles(w, h) { // azulejo da copa
  const c = new Canvas(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) c.px(x, y, x % 6 === 0 || y % 6 === 0 ? 'light' : 'snow');
  return c;
}

export function serverStatus() {
  const c = board(30, 18, { frame: 'outline', rim: 'shadow', fill: 'navy' });
  c.text('OK', 4, 4, 'greenLight');
  for (let k = 0; k < 5; k++) c.rect(16 + k * 2, 12 - k * 2, 1, 2 + k * 2, 'green');
  c.hline(4, 12, 12, 'green'); c.hline(4, 9, 14, 'cyan');
  return c;
}

export function sign(text, { fill = 'snow', ink = 'ink', frame = 'outline' } = {}) {
  const w = text.length * 4 + 5;
  const c = new Canvas(w, 9);
  box(c, 0, 0, w, 9, frame); box(c, 1, 1, w - 2, 7, fill);
  c.text(text, 3, 2, ink);
  return c;
}
