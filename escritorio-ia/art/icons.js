// Ícones do app (PWA): personagem do orquestrador sobre fundo escuro com borda na cor da recepção.
// Rodado por art/generate.js depois dos sprites (ou sozinho: node art/icons.js).
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePNG, decodePNG } from './png.js';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets');

export function makeIcons() {
  const sheet = decodePNG(readFileSync(path.join(OUT, 'char_orquestrador.png')));
  const data = JSON.parse(readFileSync(path.join(OUT, 'char_orquestrador.json'), 'utf8'));
  const key = Object.keys(data.frames).find((k) => k.startsWith('base_idle')) || Object.keys(data.frames)[0];
  const f = data.frames[key].frame;
  const BG = [0x1a, 0x17, 0x26], RIM = [0xe0, 0xa0, 0x30];
  for (const size of [192, 512]) {
    const rgba = Buffer.alloc(size * size * 4);
    const border = Math.round(size / 24);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const edge = x < border || y < border || x >= size - border || y >= size - border;
      const [r, g, b] = edge ? RIM : BG;
      rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
    }
    // personagem centralizado, escala inteira (nearest neighbor) ocupando ~75% da altura
    const s = Math.floor((size * 0.75) / f.h);
    const ox = Math.floor((size - f.w * s) / 2), oy = Math.floor((size - f.h * s) / 2);
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
      const si = ((f.y + y) * sheet.width + (f.x + x)) * 4;
      if (sheet.data[si + 3] < 128) continue;
      for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) {
        const di = ((oy + y * s + dy) * size + (ox + x * s + dx)) * 4;
        sheet.data.copy(rgba, di, si, si + 3);
        rgba[di + 3] = 255;
      }
    }
    writeFileSync(path.join(OUT, `icon-${size}.png`), encodePNG(size, size, rgba));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) makeIcons();
