// Empacota quadros (Canvas) em sprite sheet + JSON no formato Aseprite "hash".
import { Canvas } from './draw.js';

/**
 * anims: [{ tag, frames: Canvas[], fps }] — todos os quadros com o mesmo w/h.
 * Layout: uma linha por animação, quadros da esquerda para a direita.
 */
export function packSheet(anims, imageName) {
  const fw = anims[0].frames[0].w, fh = anims[0].frames[0].h;
  const cols = Math.max(...anims.map((a) => a.frames.length));
  const sheet = new Canvas(cols * fw, anims.length * fh);
  const frames = {};
  const frameTags = [];
  let index = 0;
  anims.forEach((a, row) => {
    const duration = Math.round(1000 / a.fps);
    const from = index;
    a.frames.forEach((f, i) => {
      if (f.w !== fw || f.h !== fh) throw new Error(`${a.tag}: quadro ${i} com tamanho ${f.w}x${f.h}, esperado ${fw}x${fh}`);
      sheet.blit(f, i * fw, row * fh);
      frames[`${a.tag}_${i}`] = {
        frame: { x: i * fw, y: row * fh, w: fw, h: fh },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: fw, h: fh },
        sourceSize: { w: fw, h: fh },
        duration,
      };
      index++;
    });
    frameTags.push({ name: a.tag, from, to: index - 1, direction: 'forward' });
  });
  const json = {
    frames,
    meta: {
      app: 'escritorio-ia/art/generate.js',
      version: '1.0',
      image: imageName,
      format: 'RGBA8888',
      size: { w: sheet.w, h: sheet.h },
      scale: '1',
      frameTags,
      layers: [{ name: 'sprite', opacity: 255, blendMode: 'normal' }],
      slices: [],
    },
  };
  return { sheet, json };
}
