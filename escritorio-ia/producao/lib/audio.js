// Mixagem: narração + trilha com ducking (sidechaincompress) + efeitos nos momentos certos,
// normalizada para -14 LUFS / -1,5 dBTP (padrão TikTok/Reels).
import path from 'node:path';
import { ffmpeg } from './ferramentas.js';
import { normalizarAudio } from '../tts.js';

/**
 * @param {object} o
 * @param {Array<{wav:string, inicio:number}>} o.falas
 * @param {Array<{arquivo:string, t:number, volume?:number}>} o.efeitos
 * @param {string|null} o.trilha
 * @param {number} o.duracao
 * @param {number} [o.volumeTrilha]
 * @param {string} o.saida  wav final normalizado
 */
export async function mixar({ falas, efeitos = [], trilha, duracao, volumeTrilha = 0.5, saida, pasta }) {
  const args = [];
  const filtros = [];
  let idx = 0;
  const D = duracao.toFixed(3);

  const rotFalas = falas.map((f) => {
    args.push('-i', f.wav);
    const r = `f${idx}`;
    const ms = Math.max(0, Math.round(f.inicio * 1000));
    filtros.push(`[${idx}:a]aresample=48000,aformat=channel_layouts=mono,adelay=${ms}:all=1[${r}]`);
    idx++;
    return `[${r}]`;
  });
  filtros.push(`${rotFalas.join('')}amix=inputs=${rotFalas.length}:normalize=0:duration=longest,` +
    `apad=whole_dur=${D},atrim=0:${D},pan=stereo|c0=c0|c1=c0,asplit=2[voz][vozsc]`);

  const rotEf = efeitos.filter((e) => e.t > -0.5 && e.t < duracao).map((e) => {
    args.push('-i', e.arquivo);
    const r = `e${idx}`;
    let corte = '';
    let ms = Math.round(e.t * 1000);
    if (ms < 0) { corte = `atrim=start=${(-e.t).toFixed(3)},asetpts=PTS-STARTPTS,`; ms = 0; }
    filtros.push(`[${idx}:a]aresample=48000,aformat=channel_layouts=stereo,${corte}volume=${(e.volume ?? 0.5).toFixed(3)},adelay=${ms}:all=1[${r}]`);
    idx++;
    return `[${r}]`;
  });

  const partes = ['[voz]'];
  if (trilha) {
    args.push('-stream_loop', '-1', '-i', trilha);
    const fimFade = Math.max(0, duracao - 1.4).toFixed(3);
    filtros.push(`[${idx}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${D},asetpts=PTS-STARTPTS,` +
      `volume=${volumeTrilha.toFixed(3)},afade=t=in:d=0.4,afade=t=out:st=${fimFade}:d=1.4[mus]`);
    // ducking: a trilha abaixa ~9 dB enquanto a voz fala e volta nas pausas
    filtros.push('[mus][vozsc]sidechaincompress=threshold=0.015:ratio=7:attack=25:release=420:knee=4:makeup=1[musd]');
    partes.push('[musd]');
    idx++;
  } else {
    filtros.push('[vozsc]anullsink');
  }
  if (rotEf.length) {
    filtros.push(`${rotEf.join('')}amix=inputs=${rotEf.length}:normalize=0:duration=longest[sfx]`);
    partes.push('[sfx]');
  }
  filtros.push(`${partes.join('')}amix=inputs=${partes.length}:normalize=0:duration=first,` +
    `atrim=0:${D},alimiter=limit=0.95:attack=3:release=60:level=false[saida]`);

  const bruto = path.join(pasta, 'mix-bruto.wav');
  await ffmpeg([...args, '-filter_complex', filtros.join(';'), '-map', '[saida]', '-ar', '48000', '-ac', '2',
    '-c:a', 'pcm_s16le', bruto]);
  await normalizarAudio(bruto, saida, { alvo: -14, pico: -1.5, extra: ['-ac', '2', '-c:a', 'pcm_s16le'] });
  return saida;
}
