// Fundo das cenas (gradiente animado com grade, ou imagem com Ken Burns), concatenação,
// render final com a camada ASS e a capa.
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { exigirFfmpeg, ffmpeg, rodar } from './ferramentas.js';
import { W, H, FPS } from './ass.js';

/** Mistura uma cor com preto (0..1 = quanto escurece). */
function escurecer(hex, k) {
  const n = parseInt(hex.replace('#', ''), 16);
  const f = (v) => Math.round(v * (1 - k));
  const r = f((n >> 16) & 255); const g = f((n >> 8) & 255); const b = f(n & 255);
  return '0x' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export async function dimensoesImagem(arquivo) {
  const { ffprobe } = exigirFfmpeg();
  const { stdout } = await rodar(ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-show_entries',
    'stream=width,height', '-of', 'csv=p=0:s=x', arquivo]);
  const [w, h] = stdout.trim().split('\n')[0].split('x').map(Number);
  if (!w || !h) throw new Error(`não consegui ler a imagem ${arquivo}`);
  return { w, h };
}

const CODEC_INTERMEDIARIO = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '15', '-pix_fmt', 'yuv420p', '-g', '30'];

/** Textura da grade + linhas de varredura (gerada uma vez; drawgrid por quadro é lento). */
export async function texturaGrade(pasta) {
  const arq = path.join(pasta, 'grade.png');
  if (!existsSync(arq)) {
    await ffmpeg(['-f', 'lavfi', '-i', `color=c=black@0:s=${W}x${H + 90},format=rgba,` +
      'drawgrid=w=0:h=6:t=1:c=black@0.12,drawgrid=w=90:h=90:t=2:c=white@0.08', '-frames:v', '1', arq]);
  }
  return arq;
}

/** Fundo gerado: gradiente girando + vinheta + grade rolando. */
export async function fundoGerado({ saida, quadros, cores, semente = 1, paleta = 'normal' }) {
  const d = (quadros / FPS + 0.5).toFixed(3);
  const [a, b, c3] = paleta === 'alerta'
    ? [escurecer(cores.alerta, 0.55), escurecer(cores.fundo2, 0.35), escurecer(cores.fundo1, 0.1)]
    : [escurecer(cores.fundo1, 0.05), escurecer(cores.fundo2, 0.3), escurecer(cores.fundo3, 0.35)];
  const grade = await texturaGrade(path.dirname(saida));
  const grafo = [
    `gradients=s=270x480:c0=${a}:c1=${b}:c2=${c3}:nb_colors=3:speed=0.018:rate=${FPS}:d=${d}:seed=${semente},` +
      `vignette=angle=PI/4.2,format=yuv420p,scale=${W}:${H}:flags=bicubic[g]`,
    `[g][0:v]overlay=0:'-mod(n*1.5,90)':shortest=1:format=yuv420,format=yuv420p[v]`,
  ].join(';');
  await ffmpeg(['-loop', '1', '-framerate', String(FPS), '-i', grade, '-filter_complex', grafo, '-map', '[v]',
    '-frames:v', String(quadros), '-r', String(FPS), ...CODEC_INTERMEDIARIO, '-an', saida]);
}

/**
 * Fundo com imagem: fundo desfocado da própria imagem + imagem inteira com zoom lento (Ken Burns)
 * e borda na cor de destaque. Retorna a caixa da imagem {x, y, w, h}.
 */
export async function fundoImagem({ saida, quadros, imagem, cores, topo = 350, alturaMax = 720 }) {
  const { w: iw, h: ih } = await dimensoesImagem(imagem);
  const fw = 1000;
  const fh = Math.min(alturaMax, Math.round((fw * ih) / iw / 2) * 2);
  const borda = 6;
  const x = (W - fw) / 2;
  const zoomFinal = 1.12;
  const n = Math.max(1, quadros);
  const destaque = cores.destaque.replace('#', '0x');
  const grafo = [
    '[0:v]split=2[a][b]',
    `[a]scale=270:480:force_original_aspect_ratio=increase,crop=270:480,boxblur=10:2,eq=brightness=-0.22:saturation=1.25,scale=${W}:${H}:flags=bicubic,vignette=angle=PI/4,setsar=1[fundo]`,
    // escala 2x antes do zoompan para o movimento ficar suave (sem "tremer" de arredondamento)
    `[b]scale=${fw * 2}:${fh * 2}:force_original_aspect_ratio=increase,crop=${fw * 2}:${fh * 2},` +
      `zoompan=z='1+${(zoomFinal - 1).toFixed(3)}*on/${n}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=1:s=${fw}x${fh}:fps=${FPS},` +
      `pad=${fw + borda * 2}:${fh + borda * 2}:${borda}:${borda}:color=${destaque},setsar=1[frente]`,
    `[fundo][frente]overlay=${x - borda}:${topo - borda}:shortest=1,format=yuv420p[v]`,
  ].join(';');
  await ffmpeg(['-loop', '1', '-framerate', String(FPS), '-i', imagem, '-filter_complex', grafo, '-map', '[v]',
    '-frames:v', String(quadros), '-r', String(FPS), ...CODEC_INTERMEDIARIO, '-an', saida]);
  return { x, y: topo, w: fw, h: fh };
}

/** Junta os fundos das cenas sem reencodar. */
export async function concatenar(clipes, saida, pasta) {
  const lista = path.join(pasta, 'fundos.txt');
  writeFileSync(lista, clipes.map((c) => `file '${path.basename(c)}'`).join('\n') + '\n');
  await ffmpeg(['-f', 'concat', '-safe', '0', '-i', 'fundos.txt', '-c', 'copy', path.basename(saida)], { cwd: pasta });
}

/** Render final: fundo + ASS + áudio, nas specs do contrato. Roda com cwd = pasta de trabalho. */
export async function renderFinal({ pasta, fundo, ass, audio, saida, duracao, preset = 'medium' }) {
  // caminhos relativos ao cwd evitam o escape de "C:\..." dentro do filtro no Windows
  const vf = `ass=${path.basename(ass)}:fontsdir=fontes,format=yuv420p`;
  await ffmpeg([
    '-i', path.basename(fundo), '-i', path.basename(audio),
    '-filter_complex', `[0:v]${vf}[v]`, '-map', '[v]', '-map', '1:a',
    '-c:v', 'libx264', '-profile:v', 'high', '-preset', preset, '-crf', '19', '-g', '60', '-r', String(FPS),
    '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
    '-t', duracao.toFixed(3), '-movflags', '+faststart', saida,
  ], { cwd: pasta });
}

/** Capa: um quadro do fundo + a camada ASS da capa. */
export async function renderCapa({ pasta, fundo, tempo, ass, saida }) {
  await ffmpeg(['-ss', tempo.toFixed(3), '-i', path.basename(fundo), '-vf',
    `ass=${path.basename(ass)}:fontsdir=fontes`, '-frames:v', '1', '-q:v', '2', saida], { cwd: pasta });
}
