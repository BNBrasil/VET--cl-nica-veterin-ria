// Utilitários de cor (hex, HSL, misturas, distância perceptual) usados pela paleta por tema.
export const HEX_RE = /^#[0-9a-f]{6}$/i;

export function isHex(s) { return typeof s === 'string' && HEX_RE.test(s); }
export function norm(hex) { return String(hex).toLowerCase(); }

export function toRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
export function toHex([r, g, b]) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
export function hslToRgb([h, s, l]) {
  h = ((h % 1) + 1) % 1; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => {
    t = ((t % 1) + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
export const hsl = (hex) => rgbToHsl(toRgb(hex));
export const fromHsl = (h, s, l) => toHex(hslToRgb([h, s, l]));

export function mix(a, b, t) {
  const A = toRgb(a), B = toRgb(b);
  return toHex(A.map((v, i) => v + (B[i] - v) * t));
}
/** Multiplica canal a canal (tinta de iluminação). */
export function multiply(hex, [mr, mg, mb], add = [0, 0, 0]) {
  const [r, g, b] = toRgb(hex);
  return toHex([r * mr + add[0], g * mg + add[1], b * mb + add[2]]);
}

/** Variações de um destaque: escuro (sombra), claro (luz) e pálido (parede). Mantém o matiz. */
export function variacoes(hex) {
  const [h, s, l] = hsl(hex);
  // matiz levemente puxado para o roxo na sombra e para o amarelo na luz (cara de pixel art)
  const shift = (target, amt) => { let d = target - h; if (d > 0.5) d -= 1; if (d < -0.5) d += 1; return h + d * amt; };
  return {
    mid: norm(hex),
    dark: fromHsl(shift(0.75, 0.06), Math.min(1, s * 1.05 + 0.05), Math.max(0.1, l * 0.62)),
    light: fromHsl(shift(0.14, 0.06), Math.min(1, s * 0.95), Math.min(0.9, l + (1 - l) * 0.5)),
    pale: fromHsl(h, Math.min(0.8, s * 0.7), Math.min(0.94, l + (1 - l) * 0.82)),
  };
}
export function escurecer(hex, f = 0.7) { const [h, s, l] = hsl(hex); return fromHsl(h, s, l * f); }
export function clarear(hex, f = 0.4) { const [h, s, l] = hsl(hex); return fromHsl(h, s, l + (1 - l) * f); }

/** Distância perceptual aproximada ("redmean"). */
export function dist(a, b) {
  const [r1, g1, b1] = toRgb(a), [r2, g2, b2] = toRgb(b);
  const rm = (r1 + r2) / 2, dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}
export function luminance(hex) { const [r, g, b] = toRgb(hex); return 0.299 * r + 0.587 * g + 0.114 * b; }

/** Ajuste global (temas): saturação (fator), claridade (soma -1..1), matiz (giro 0..1), contraste (fator em torno de 0,5). */
export function ajustar(hex, { saturacao = 1, claridade = 0, matiz = 0, contraste = 1 } = {}) {
  const [h, s, l] = hsl(hex);
  let L = 0.5 + (l - 0.5) * contraste + claridade * (claridade > 0 ? (1 - l) : l);
  return fromHsl(h + matiz, s * saturacao, L);
}
