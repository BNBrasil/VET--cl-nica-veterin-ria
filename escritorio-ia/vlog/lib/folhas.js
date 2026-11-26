// Folha de contato (grade 4x4 com o tempo escrito em cada quadro) + quadros separados em JPEG pequenos.
// Um único processo ffmpeg: 16 entradas com busca rápida (-ss antes de -i) + 16 etiquetas de tempo.
// As etiquetas são desenhadas aqui mesmo (fonte bitmap 5x7) em PPM, para não depender de fontes do sistema
// nem do filtro drawtext (que nem todo ffmpeg tem e que no Windows exige escapar o caminho da fonte).
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { rodar } from './externos.js';

const FONTE = {
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ':': ['00000', '00100', '00100', '00000', '00100', '00100', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  '#': ['01010', '11111', '01010', '01010', '01010', '11111', '01010'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

/** 75.4 -> "1:15"; 3725 -> "1:02:05". */
export function rotuloTempo(seg) {
  const s = Math.max(0, Math.floor(seg));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Imagem PPM (P6) com o texto branco sobre fundo escuro, escala inteira. */
export function etiquetaPpm(texto, escala = 2) {
  const chars = [...texto].map((c) => FONTE[c] || FONTE[' ']);
  const pad = 2;
  const w = (chars.length * 6 - 1 + pad * 2) * escala;
  const h = (7 + pad * 2) * escala;
  const px = Buffer.alloc(w * h * 3, 20);
  chars.forEach((g, ci) => {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 5; x++) {
        if (g[y][x] !== '1') continue;
        for (let sy = 0; sy < escala; sy++) {
          for (let sx = 0; sx < escala; sx++) {
            const X = (pad + ci * 6 + x) * escala + sx;
            const Y = (pad + y) * escala + sy;
            const o = (Y * w + X) * 3;
            px[o] = 255; px[o + 1] = 230; px[o + 2] = 80;
          }
        }
      }
    }
  });
  return Buffer.concat([Buffer.from(`P6\n${w} ${h}\n255\n`), px]);
}

/** Tempos de 16 quadros espaçados (meio de cada fatia), sem encostar no fim. */
export function temposDosQuadros(duracao, n = 16) {
  const d = Math.max(0.1, duracao || 0.1);
  return Array.from({ length: n }, (_, i) => Math.round(Math.min(Math.max(0, d - 0.15), ((i + 0.5) * d) / n) * 10) / 10);
}

/** Tamanho do quadro na grade conforme a orientação do vídeo (já considerando a rotação). */
export function tamanhoQuadro(orientacao) {
  if (orientacao === 'vertical') return { w: 180, h: 320 };
  if (orientacao === 'quadrado') return { w: 240, h: 240 };
  return { w: 320, h: 180 };
}

/**
 * Gera folhas/<stem>.jpg (4x4) e quadros/<stem>_NNNN.jpg (NNNN = décimos de segundo... na verdade o índice 00–15).
 * Retorna { folha, quadros: [{t, img}] } com caminhos relativos à pasta do dia.
 */
export async function gerarFolha(ffmpeg, arquivo, info, pastaDia, stem, { colunas = 4, linhas = 4, ladoQuadro = 480 } = {}) {
  const n = colunas * linhas;
  const tempos = temposDosQuadros(info.duracao, n);
  const { w, h } = tamanhoQuadro(info.orientacao);
  mkdirSync(path.join(pastaDia, 'folhas'), { recursive: true });
  mkdirSync(path.join(pastaDia, 'quadros'), { recursive: true });
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'vlog-etq-'));
  try {
    const args = ['-hide_banner', '-loglevel', 'error', '-y'];
    tempos.forEach((t) => args.push('-ss', t.toFixed(2), '-i', arquivo));
    tempos.forEach((t, i) => {
      const arq = path.join(tmp, `e${i}.ppm`);
      writeFileSync(arq, etiquetaPpm(rotuloTempo(t)));
      args.push('-i', arq);
    });
    // quadro grande (para olhar de perto) e pequeno (para a grade), mantendo a proporção com barras pretas
    const escalaQ = info.orientacao === 'vertical' ? `-2:${ladoQuadro}` : `${ladoQuadro}:-2`;
    const fc = [];
    const quadros = [];
    tempos.forEach((t, i) => {
      fc.push(`[${i}:v:0]trim=end_frame=1,setpts=PTS-STARTPTS,format=yuv420p,split=2[g${i}][q${i}]`);
      fc.push(`[g${i}]scale=${w}:${h}:force_original_aspect_ratio=decrease:flags=bicubic,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1[gs${i}]`);
      fc.push(`[gs${i}][${n + i}:v]overlay=4:4[gl${i}]`);
      fc.push(`[q${i}]scale=${escalaQ}:flags=bicubic,setsar=1[qs${i}]`);
    });
    const layout = tempos.map((_, i) => `${(i % colunas) * w}_${Math.floor(i / colunas) * h}`).join('|');
    fc.push(`${tempos.map((_, i) => `[gl${i}]`).join('')}xstack=inputs=${n}:layout=${layout}:fill=black[folha]`);
    const folhaRel = `folhas/${stem}.jpg`;
    args.push('-filter_complex', fc.join(';'));
    args.push('-map', '[folha]', '-frames:v', '1', '-q:v', '4', path.join(pastaDia, folhaRel));
    tempos.forEach((t, i) => {
      const rel = `quadros/${stem}_${String(i).padStart(2, '0')}.jpg`;
      quadros.push({ t, img: rel });
      args.push('-map', `[qs${i}]`, '-frames:v', '1', '-q:v', '5', path.join(pastaDia, rel));
    });
    await rodar(ffmpeg, args, { timeout: Math.max(120000, info.duracao * 1000) });
    return { folha: folhaRel, quadros };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
