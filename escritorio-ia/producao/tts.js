#!/usr/bin/env node
// Narração gratuita e offline com Piper + pós-processamento de locução no ffmpeg.
// Uso como módulo: const { wav, duracao } = await falar('texto', { modelo, velocidade })
// Uso na linha de comando: node producao/tts.js "texto" [saida.wav] [--modelo pt_BR-cadu-medium] [--velocidade 1.1]
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  PASTA_TRABALHO, acharPiper, arquivosVoz, duracaoMidia, exigirFfmpeg, exigirPiper, ffmpeg, rodar,
} from './lib/ferramentas.js';
import { normalizarTexto, pesoFala } from './lib/normalizar.js';

export const MODELO_PADRAO = 'pt_BR-faber-medium';
const VERSAO = 'v3'; // mude para invalidar o cache quando a cadeia de áudio mudar
const PASTA_CACHE = path.join(PASTA_TRABALHO, 'tts-cache');

// Cadeia de "locução": corta grave de ruído, aquece, dá presença, controla sibilância,
// comprime de leve e apara o silêncio das pontas.
const CADEIA = [
  'aresample=48000',
  'highpass=f=85',
  'equalizer=f=180:t=q:w=1.0:g=2',
  'equalizer=f=450:t=q:w=1.2:g=-2',
  'equalizer=f=3200:t=q:w=1.0:g=3',
  'deesser=i=0.35:m=0.5:f=0.5',
  'acompressor=threshold=-21dB:ratio=3:attack=4:release=90:makeup=2.5:knee=4',
  'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.04',
  'areverse',
  'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.08',
  'areverse',
].join(',');

function vozFalsaAtiva(opts) {
  return opts.falsa === true || process.env.PRODUCAO_VOZ_FALSA === '1';
}

/** Duração estimada da fala (s), sem sintetizar: ~6,3 sílabas/s + pausas de frase. */
export function estimarDuracao(texto, velocidade = 1) {
  const frases = (String(texto).match(/[.!?]+/g) || []).length || 1;
  return pesoFala(texto) / (6.3 * velocidade) + 0.3 * (frases - 1) + 0.15;
}

async function medirLoudness(arquivo, filtro) {
  const { stderr } = await ffmpeg(['-loglevel', 'info', '-i', arquivo, '-af',
    `${filtro ? filtro + ',' : ''}loudnorm=I=-16:TP=-2:LRA=7:print_format=json`, '-f', 'null', '-']);
  const json = stderr.slice(stderr.lastIndexOf('{'), stderr.lastIndexOf('}') + 1);
  return JSON.parse(json);
}

/** Normalização em duas passadas (linear) para um nível alvo. */
export async function normalizarAudio(entrada, saida, { filtro = '', alvo = -16, pico = -2, extra = [] } = {}) {
  const m = await medirLoudness(entrada, filtro);
  const ln = `loudnorm=I=${alvo}:TP=${pico}:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}` +
    `:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  await ffmpeg(['-i', entrada, '-af', `${filtro ? filtro + ',' : ''}${ln},aresample=48000`, ...extra, saida]);
}

/** Lê os trechos com fala (sem silêncio) de um wav — usado para sincronizar a legenda. */
export async function segmentosFala(wav, { limiar = -38, minimo = 0.16 } = {}) {
  const { stderr } = await ffmpeg(['-loglevel', 'info', '-i', wav, '-af',
    `silencedetect=noise=${limiar}dB:d=${minimo}`, '-f', 'null', '-']);
  const total = await duracaoMidia(wav);
  const segs = [];
  let ini = 0;
  for (const linha of stderr.split(/\r?\n/)) {
    const a = linha.match(/silence_start: ([\d.]+)/);
    const b = linha.match(/silence_end: ([\d.]+)/);
    if (a) { const s = Number(a[1]); if (s - ini > 0.05) segs.push({ ini, fim: s }); }
    if (b) ini = Number(b[1]);
  }
  if (total - ini > 0.05) segs.push({ ini, fim: total });
  return segs.map((s) => ({ ini: +s.ini.toFixed(3), fim: +s.fim.toFixed(3) }));
}

async function sintetizarPiper(texto, bruto, { modelo, velocidade, pausa }) {
  const piper = exigirPiper();
  const { onnx, config } = arquivosVoz(modelo);
  await rodar(piper.cmd, [...piper.args,
    '--model', onnx, '--config', config, '--output_file', bruto,
    '--length_scale', String(+(1 / velocidade).toFixed(3)),
    '--sentence_silence', String(pausa),
    '--noise_scale', '0.667', '--noise_w', '0.8',
  ], { entrada: Buffer.from(texto + '\n', 'utf8') });
}

async function sintetizarFalsa(texto, bruto, { velocidade }) {
  // Tom suave pulsando ~ sílabas, com a duração estimada: serve para testar sem baixar a voz.
  const d = estimarDuracao(texto, velocidade).toFixed(3);
  await ffmpeg(['-f', 'lavfi', '-i', `sine=f=190:d=${d}:sample_rate=22050`, '-af',
    'volume=0.25*(0.55+0.45*sin(2*PI*6*t)):eval=frame', '-ac', '1', bruto]);
}

/**
 * Sintetiza a fala. Retorna { wav, duracao, texto (normalizado), segmentos, falsa }.
 * @param {string} texto
 * @param {{modelo?: string, velocidade?: number, pausa?: number, falsa?: boolean, saida?: string}} [opts]
 */
export async function falar(texto, opts = {}) {
  exigirFfmpeg();
  const modelo = opts.modelo || MODELO_PADRAO;
  const velocidade = Math.min(1.6, Math.max(0.6, Number(opts.velocidade) || 1));
  const pausa = opts.pausa ?? 0.18;
  const normal = normalizarTexto(texto);
  if (!normal.replace(/[.!?\s]/g, '')) throw new Error('fala vazia');
  let falsa = vozFalsaAtiva(opts);
  if (!falsa && !acharPiper() && opts.permitirFalsa) falsa = true;

  const chave = createHash('sha1').update([VERSAO, normal, modelo, velocidade, pausa, falsa].join('|')).digest('hex').slice(0, 16);
  mkdirSync(PASTA_CACHE, { recursive: true });
  const wav = path.join(PASTA_CACHE, `${chave}.wav`);
  const meta = path.join(PASTA_CACHE, `${chave}.json`);

  if (!(existsSync(wav) && existsSync(meta))) {
    const bruto = path.join(PASTA_CACHE, `${chave}.bruto.wav`);
    const tratado = path.join(PASTA_CACHE, `${chave}.tratado.wav`);
    if (falsa) await sintetizarFalsa(normal, bruto, { velocidade });
    else await sintetizarPiper(normal, bruto, { modelo, velocidade, pausa });
    await ffmpeg(['-i', bruto, '-af', falsa ? 'aresample=48000' : CADEIA, '-ac', '1', tratado]);
    await normalizarAudio(tratado, wav, { alvo: -16, pico: -2, extra: ['-ac', '1', '-c:a', 'pcm_s16le'] });
    rmSync(bruto, { force: true });
    rmSync(tratado, { force: true });
    const duracao = await duracaoMidia(wav);
    const segmentos = await segmentosFala(wav);
    writeFileSync(meta, JSON.stringify({ texto: normal, original: texto, modelo, velocidade, duracao, segmentos, falsa }, null, 2));
  }
  const info = JSON.parse(readFileSync(meta, 'utf8'));
  if (opts.saida) copyFileSync(wav, opts.saida);
  return { wav: opts.saida || wav, duracao: info.duracao, texto: info.texto, segmentos: info.segmentos, falsa: info.falsa };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const args = process.argv.slice(2);
  const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
  const modelo = opt('--modelo');
  const velocidade = opt('--velocidade');
  const [texto, saida] = args;
  if (!texto) {
    console.log('uso: node producao/tts.js "texto" [saida.wav] [--modelo pt_BR-faber-medium] [--velocidade 1.0]');
    process.exit(1);
  }
  falar(texto, { modelo, velocidade, saida: saida && path.resolve(saida) }).then((r) => {
    console.log(`texto falado: ${r.texto}\narquivo: ${r.wav}\nduração: ${r.duracao.toFixed(2)} s`);
  }).catch((e) => { console.error('ERRO: ' + e.message); process.exit(1); });
}
