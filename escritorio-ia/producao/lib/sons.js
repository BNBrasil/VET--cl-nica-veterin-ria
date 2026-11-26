// Efeitos sonoros e trilhas GERADOS POR CÓDIGO com ffmpeg (sem licença de terceiros).
// Ficam em producao/sons/*.wav (gerados uma vez; apague para gerar de novo).
// Trilhas do usuário: producao/sons/minhas/*.mp3|wav|m4a|ogg (precisam ser livres de direitos).
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import { PASTA_SONS, ffmpeg } from './ferramentas.js';
import { normalizarAudio } from '../tts.js';

const SR = 48000;
const PI2 = '2*PI';

// ---------- efeitos ----------
// Cada efeito: lista de camadas [expressão aevalsrc, filtros] + duração + filtro final.
const EFEITOS = {
  whoosh: {
    d: 0.75,
    camadas: [
      // ruído filtrado em faixas que acendem em sequência (grave → agudo) = sensação de varrida
      ['random(0)*2-1', `bandpass=f=350:width_type=o:w=1.4,volume='exp(-pow((t-0.22)/0.10,2))':eval=frame`],
      ['random(1)*2-1', `bandpass=f=900:width_type=o:w=1.4,volume='exp(-pow((t-0.32)/0.10,2))':eval=frame`],
      ['random(2)*2-1', `bandpass=f=2200:width_type=o:w=1.4,volume='0.8*exp(-pow((t-0.40)/0.10,2))':eval=frame`],
      ['random(3)*2-1', `bandpass=f=5000:width_type=o:w=1.2,volume='0.5*exp(-pow((t-0.47)/0.09,2))':eval=frame`],
    ],
    final: 'aecho=0.6:0.4:40:0.25,volume=2.2',
    estereo: 'pan=stereo|c0=c0|c1=0.85*c0,aecho=0.8:0.5:18:0.3',
  },
  pop: {
    d: 0.18,
    camadas: [[`0.9*sin(${PI2}*(950*t-2600*t*t))*exp(-24*t)`, 'lowpass=f=6000']],
    final: 'volume=1.2',
  },
  ding: {
    d: 1.3,
    camadas: [
      // "plim" de caixa registradora: duas notas de sino com parciais
      [`(0.55*sin(${PI2}*1568*t)+0.25*sin(${PI2}*3136*t)*exp(-4*t)+0.12*sin(${PI2}*4704*t)*exp(-7*t))*exp(-7*t)`, ''],
      [`gte(t,0.09)*(0.6*sin(${PI2}*2093*(t-0.09))+0.25*sin(${PI2}*4186*(t-0.09))*exp(-4*(t-0.09)))*exp(-5*(t-0.09))`, ''],
    ],
    final: 'aecho=0.7:0.5:60|120:0.25|0.15,volume=0.9',
  },
  riser: {
    d: 1.6,
    camadas: [
      [`0.35*pow(t/1.6,1.5)*sin(${PI2}*(160*t+520*t*t))`, ''],
      [`0.35*pow(t/1.6,1.5)*sin(${PI2}*(240*t+780*t*t))`, ''],
      ['pow(t/1.6,2.2)*(random(0)*2-1)', 'highpass=f=1500,volume=0.5'],
    ],
    final: 'afade=t=out:st=1.5:d=0.1,aecho=0.6:0.5:70:0.3,volume=1.4',
  },
  impacto: {
    d: 1.4,
    camadas: [
      [`0.95*sin(${PI2}*(48*t+9*(1-exp(-18*t))))*exp(-3.2*t)`, ''],
      ['(random(0)*2-1)*exp(-28*t)', 'lowpass=f=2500,volume=0.7'],
    ],
    final: 'aecho=0.5:0.4:90:0.3,volume=1.2',
  },
  clique: {
    d: 0.08,
    camadas: [[`0.8*sin(${PI2}*2400*t)*exp(-80*t)+0.4*(random(0)*2-1)*exp(-120*t)`, '']],
    final: 'volume=1.0',
  },
};

// ---------- trilhas ----------
// Notas (Hz)
const N = { A1: 55, C2: 65.41, D2: 73.42, E2: 82.41, F1: 43.65, F2: 87.31, G1: 49, G2: 98, Bb1: 58.27,
  A3: 220, C4: 261.63, E4: 329.63, F3: 174.61, G3: 196, B3: 246.94, D4: 293.66, G4: 392, D3: 146.83,
  F4: 349.23, A4: 440, C5: 523.25, E5: 659.25, Bb3: 233.08 };

/** Expressão que escolhe um valor pelo compasso atual (4 acordes, 1 por compasso). */
function porCompasso(vals, compasso) {
  const m = `mod(floor(t/${compasso}),${vals.length})`;
  return vals.reduceRight((acc, v, i) => (i === vals.length - 1 ? `${v}` : `if(lt(${m},${i + 1}),${v},${acc})`), '');
}

function trilhaPulso() {
  // eletrônica animada, 128 bpm, 8 compassos = 15 s exatos (loop perfeito)
  const b = 60 / 128;
  const c = 4 * b;
  const raiz = porCompasso([N.A1, N.F1, N.C2, N.G1], c);
  const acorde = (i) => porCompasso([[N.A3, N.C4, N.E4], [N.F3, N.A3, N.C4], [N.C4, N.E4, N.G4], [N.G3, N.B3, N.D4]].map((a) => a[i]), c);
  const bombeia = `(0.25+0.75*min(1,mod(t,${b})*5))`; // "sidechain" no tempo
  return {
    nome: 'pulso', d: 8 * c,
    camadas: [
      [`0.9*sin(${PI2}*(48*mod(t,${b})+4*(1-exp(-25*mod(t,${b})))))*exp(-7*mod(t,${b}))`, 'lowpass=f=400'],
      [`(random(0)*2-1)*exp(-55*mod(t-${b / 2},${b}))*gte(t,${b / 2})`, 'highpass=f=7000,volume=0.35'],
      [`(random(1)*2-1)*exp(-16*mod(t-${b},${2 * b}))*gte(t,${b})`, 'bandpass=f=1900:width_type=o:w=2,volume=0.55'],
      [`0.33*tanh(3*sin(${PI2}*(${raiz})*t))*${bombeia}*(1-exp(-30*mod(t,${b / 2})))`, 'lowpass=f=600'],
      [`0.13*(sin(${PI2}*(${acorde(0)})*t)+sin(${PI2}*(${acorde(1)})*t)+sin(${PI2}*(${acorde(2)})*t)+0.5*sin(${PI2}*2.003*(${acorde(0)})*t))*${bombeia}`, 'lowpass=f=2200'],
      // arpejo em semicolcheias
      [`0.16*sin(${PI2}*2*(if(eq(mod(floor(t/${b / 4}),4),0),${acorde(0)},if(eq(mod(floor(t/${b / 4}),4),1),${acorde(1)},if(eq(mod(floor(t/${b / 4}),4),2),${acorde(2)},2*${acorde(0)}))))*t)*exp(-14*mod(t,${b / 4}))`, 'lowpass=f=5000,aecho=0.6:0.4:351:0.3'],
    ],
  };
}

function trilhaLofi() {
  // lo-fi tranquilo, 84 bpm com swing, 8 compassos
  const b = 60 / 84;
  const c = 4 * b;
  const raiz = porCompasso([N.D2, N.G1, N.C2, N.A1], c);
  const ac = [[N.F3, N.A3, N.C4, N.E4], [N.F3, N.B3, N.D4, N.F4], [N.E4, N.G3, N.B3, N.D4], [N.G3, N.C4, N.E4, N.A3]];
  const acorde = (i) => porCompasso(ac.map((a) => a[i]), c);
  const tremolo = `(0.8+0.2*sin(${PI2}*4.5*t))`;
  const kickPos = `min(mod(t,${2 * b}),abs(mod(t,${2 * b})-${1.5 * b})+9*lt(mod(t,${2 * b}),${1.5 * b}))`;
  return {
    nome: 'lofi', d: 8 * c,
    camadas: [
      [`0.85*sin(${PI2}*(52*${kickPos}+3*(1-exp(-22*${kickPos}))))*exp(-8*${kickPos})`, 'lowpass=f=300'],
      [`(random(0)*2-1)*exp(-14*mod(t-${b},${2 * b}))*gte(t,${b})`, 'bandpass=f=1500:width_type=o:w=1.5,lowpass=f=3500,volume=0.45'],
      [`(random(1)*2-1)*exp(-70*mod(t-${b * 0.58},${b * 0.5}))`, 'highpass=f=6000,lowpass=f=9000,volume=0.18'],
      [`0.3*sin(${PI2}*(${raiz})*t)*(1-exp(-20*mod(t,${b})))`, 'lowpass=f=300'],
      [`0.11*${tremolo}*(sin(${PI2}*(${acorde(0)})*t)+sin(${PI2}*(${acorde(1)})*t)+sin(${PI2}*(${acorde(2)})*t)+sin(${PI2}*(${acorde(3)})*t))*(0.6+0.4*exp(-1.2*mod(t,${c})))`, 'lowpass=f=1800'],
      // chiado de vinil
      ['0.5*(random(2)*2-1)*gt(random(3),0.9993)+0.012*(random(4)*2-1)', 'highpass=f=1000,lowpass=f=6000,volume=0.9'],
    ],
    final: 'lowpass=f=6500',
  };
}

function trilhaHype() {
  // trap/hype, 140 bpm, 808 + chimbal em colcheias com rufos
  const b = 60 / 140;
  const c = 4 * b;
  const raiz = porCompasso([N.E2, N.E2, N.C2, N.D2], c);
  const lead = porCompasso([N.E5, N.G4, N.C5, N.D4 * 2], c);
  const t808 = `mod(t,${2 * b})`;
  return {
    nome: 'hype', d: 8 * c,
    camadas: [
      [`0.9*tanh(2.2*sin(${PI2}*((${raiz})*${t808}+3*(1-exp(-20*${t808})))))*exp(-1.6*${t808})`, 'lowpass=f=900'],
      [`(random(0)*2-1)*exp(-60*mod(t,if(gte(mod(t,${c}),${c - b}),${b / 4},${b / 2})))`, 'highpass=f=8000,volume=0.3'],
      [`(random(1)*2-1)*(exp(-20*mod(t-${2 * b},${c}))*gte(t,${2 * b})+0.6*exp(-25*mod(t-${2 * b + 0.012},${c}))*gte(t,${2 * b + 0.012}))`, 'bandpass=f=1300:width_type=o:w=1.6,volume=0.7'],
      [`0.12*sin(${PI2}*(${lead})*t+1.5*sin(${PI2}*2*(${lead})*t))*exp(-3*mod(t,${b}))*lt(mod(t,${2 * b}),${1.5 * b})`, 'lowpass=f=4000,aecho=0.6:0.4:321:0.3'],
      [`0.05*(sin(${PI2}*${N.E4}*t)+sin(${PI2}*${N.G4}*t)+sin(${PI2}*${N.B3}*t))`, 'lowpass=f=1500,tremolo=f=0.5:d=0.4'],
    ],
  };
}

export const TRILHAS = { pulso: trilhaPulso, lofi: trilhaLofi, hype: trilhaHype };

async function renderizar(destino, { d, camadas, final = '', estereo = '' }) {
  const args = [];
  const partes = [];
  camadas.forEach(([expr, filtros], i) => {
    args.push('-f', 'lavfi', '-i', `aevalsrc=exprs='${expr}':s=${SR}:d=${d.toFixed(4)}`);
    partes.push(`[${i}:a]${filtros ? filtros + ',' : ''}aformat=channel_layouts=mono[c${i}]`);
  });
  const mix = camadas.length > 1
    ? `${camadas.map((_, i) => `[c${i}]`).join('')}amix=inputs=${camadas.length}:normalize=0:duration=longest`
    : '[c0]anull';
  const cadeia = [mix, final, estereo || 'pan=stereo|c0=c0|c1=c0', 'alimiter=limit=0.89:level=false'].filter(Boolean).join(',');
  const grafo = `${partes.join(';')};${cadeia}[saida]`;
  const tmp = destino.replace(/\.wav$/, '.tmp.wav');
  await ffmpeg([...args, '-filter_complex', grafo, '-map', '[saida]', '-t', d.toFixed(4), '-ar', String(SR), '-c:a', 'pcm_s16le', tmp]);
  renameSync(tmp, destino);
}

async function normalizarPico(entrada, saida, alvo) {
  const { stderr } = await ffmpeg(['-loglevel', 'info', '-i', entrada, '-af', 'volumedetect', '-f', 'null', '-']);
  const pico = Number((stderr.match(/max_volume: (-?[\d.]+) dB/) || [])[1] || 0);
  await ffmpeg(['-i', entrada, '-af', `volume=${(alvo - pico).toFixed(2)}dB`, '-c:a', 'pcm_s16le', saida]);
}

/** Garante que todos os efeitos e trilhas existem em producao/sons/. Retorna os caminhos. */
export async function garantirSons({ pasta = PASTA_SONS, log = () => {} } = {}) {
  mkdirSync(pasta, { recursive: true });
  mkdirSync(path.join(pasta, 'minhas'), { recursive: true });
  const efeitos = {};
  for (const [nome, def] of Object.entries(EFEITOS)) {
    const arq = path.join(pasta, `${nome}.wav`);
    if (!existsSync(arq)) {
      log(`gerando efeito ${nome}...`);
      const tmp = arq.replace(/\.wav$/, '.cru.wav');
      await renderizar(tmp, def);
      await normalizarPico(tmp, arq, -2);
      rmSync(tmp, { force: true });
    }
    efeitos[nome] = arq;
  }
  const trilhas = {};
  for (const [nome, fn] of Object.entries(TRILHAS)) {
    const arq = path.join(pasta, `trilha-${nome}.wav`);
    if (!existsSync(arq)) {
      log(`gerando trilha ${nome}...`);
      const def = fn();
      const tmp = arq.replace(/\.wav$/, '.cru.wav');
      await renderizar(tmp, { ...def, final: [def.final, 'acompressor=threshold=-18dB:ratio=3:attack=10:release=120'].filter(Boolean).join(','),
        estereo: 'pan=stereo|c0=c0|c1=c0,aecho=0.8:0.6:23|37:0.2|0.15' });
      // ganho fixo para a trilha ficar num nível previsível (~-20 LUFS)
      await normalizarAudio(tmp, arq, { alvo: -20, pico: -3, extra: ['-ac', '2', '-c:a', 'pcm_s16le'] });
      rmSync(tmp, { force: true });
    }
    trilhas[nome] = arq;
  }
  return { efeitos, trilhas };
}

const EXT_AUDIO = /\.(mp3|wav|m4a|aac|ogg|flac|opus)$/i;
export function trilhasDoUsuario(pasta = PASTA_SONS) {
  const dir = path.join(pasta, 'minhas');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => EXT_AUDIO.test(f)).sort().map((f) => path.join(dir, f));
}

/**
 * Escolhe a trilha: nome de trilha gerada ("pulso" | "lofi" | "hype"), caminho de arquivo,
 * "minhas" (sorteia uma de sons/minhas/), "nenhuma", ou "auto" (pelo tipo da pauta).
 */
export function escolherTrilha(pedido, tipo, { trilhas, semente = 0 }) {
  const p = (pedido || 'auto').toString();
  if (p === 'nenhuma' || p === 'false') return null;
  if (trilhas[p]) return trilhas[p];
  if (p !== 'auto' && p !== 'minhas' && existsSync(p)) return p;
  const minhas = trilhasDoUsuario();
  if (p === 'minhas' && minhas.length) return minhas[semente % minhas.length];
  const porTipo = { promocao: 'pulso', lancamento: 'hype', noticia: 'hype' };
  return trilhas[porTipo[tipo]] || trilhas.pulso;
}
