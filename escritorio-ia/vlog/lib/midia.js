// Análise técnica de um clipe com ffmpeg: ffprobe, silêncios, cortes de cena, energia do áudio e tremido.
// Uma única leitura do arquivo (um processo ffmpeg) produz tudo, menos o ffprobe e a folha de contato.
// Os parsers são funções puras (testadas com saídas de amostra em test/vlog-analise.test.js).
import { rodar } from './externos.js';

export const EXTENSOES_VIDEO = new Set([
  '.mp4', '.mov', '.m4v', '.mkv', '.avi', '.mts', '.m2ts', '.ts', '.3gp', '.3g2', '.webm', '.wmv', '.mpg', '.mpeg',
  '.lrv', '.insv', '.dv', '.flv', '.mxf',
]);

/** Arquivos de sistema/lixo que nunca são clipes. */
export function arquivoIgnorado(nome) {
  return /^\./.test(nome) // .DS_Store, ._arquivo (mac), .trashed-..., .pending-... (Android)
    || /^(thumbs\.db|desktop\.ini|icon\r?)$/i.test(nome)
    || /\.(part|crdownload|tmp|download)$/i.test(nome)
    || /^~\$/.test(nome);
}

export function ehVideo(nome) {
  if (arquivoIgnorado(nome)) return false;
  const i = nome.lastIndexOf('.');
  return i > 0 && EXTENSOES_VIDEO.has(nome.slice(i).toLowerCase());
}

/** Pastas que não são varridas (lixeira, miniaturas, a própria saída do escritório). */
export function pastaIgnorada(nome) {
  return /^\./.test(nome) || /^(\$recycle\.bin|system volume information|thumbnails|\.thumbnails|__macosx|lixeira)$/i.test(nome);
}

const fracao = (s) => {
  if (!s || s === '0/0') return 0;
  const [a, b] = String(s).split('/').map(Number);
  return b ? a / b : a || 0;
};

/** Resume a saída JSON do ffprobe nos campos do analise.json. */
export function resumirProbe(probe) {
  const streams = probe?.streams || [];
  const v = streams.find((s) => s.codec_type === 'video' && !(s.disposition?.attached_pic));
  const a = streams.find((s) => s.codec_type === 'audio');
  let rotacao = 0;
  if (v) {
    const sd = (v.side_data_list || []).find((d) => d.rotation != null);
    if (sd) rotacao = -Number(sd.rotation);
    else if (v.tags?.rotate != null) rotacao = Number(v.tags.rotate);
    rotacao = ((Math.round(rotacao / 90) * 90) % 360 + 360) % 360;
  }
  const duracao = Number(probe?.format?.duration) || Number(v?.duration) || Number(a?.duration) || 0;
  let fps = fracao(v?.avg_frame_rate) || fracao(v?.r_frame_rate);
  if (fps > 240) fps = fracao(v?.r_frame_rate); // alguns celulares gravam avg absurdo
  const largura = v?.width || 0;
  const altura = v?.height || 0;
  const [lx, ax] = rotacao === 90 || rotacao === 270 ? [altura, largura] : [largura, altura];
  return {
    duracao: Math.round(duracao * 1000) / 1000,
    largura, altura,
    fps: Math.round(fps * 100) / 100,
    rotacao,
    temAudio: !!a,
    temVideo: !!v,
    orientacao: lx > ax ? 'horizontal' : lx < ax ? 'vertical' : 'quadrado',
    codec: v?.codec_name || null,
    audioCodec: a?.codec_name || null,
  };
}

export async function probe(ffprobe, arquivo) {
  const r = await rodar(ffprobe, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', arquivo], { timeout: 60000 });
  return JSON.parse(r.stdout || '{}');
}

// ---------------------------------------------------------------- parsers (puros)

/** silencedetect -> [{ini, fim}] (silêncio aberto no fim do arquivo é fechado em `duracao`). */
export function parseSilencedetect(stderr, duracao) {
  const lista = [];
  let ini = null;
  for (const linha of String(stderr).split(/\r?\n/)) {
    if (!linha.includes('silencedetect')) continue;
    const s = linha.match(/silence_start:\s*(-?[\d.]+)/);
    if (s) { ini = Math.max(0, +s[1]); continue; }
    const e = linha.match(/silence_end:\s*([\d.]+)/);
    if (e) {
      lista.push({ ini: r2(ini ?? 0), fim: r2(+e[1]) });
      ini = null;
    }
  }
  if (ini != null && duracao) lista.push({ ini: r2(ini), fim: r2(duracao) });
  return lista.filter((x) => x.fim > x.ini);
}

/** showinfo após select=gt(scene,…) -> tempos dos cortes de cena, começando em 0 e sem cortes muito próximos. */
export function parseCenas(stderr, { minIntervalo = 1.0 } = {}) {
  const tempos = [0];
  for (const linha of String(stderr).split(/\r?\n/)) {
    if (!linha.includes('Parsed_showinfo')) continue;
    const m = linha.match(/pts_time:\s*([\d.]+)/);
    if (!m) continue;
    const t = r1(+m[1]);
    if (t - tempos[tempos.length - 1] >= minIntervalo) tempos.push(t);
  }
  return tempos;
}

/** ebur128 (uma linha a cada 0,1 s) -> [{t, M}] com a sonoridade momentânea (LUFS). */
export function parseEbur128(stderr) {
  const pts = [];
  for (const linha of String(stderr).split(/\r?\n/)) {
    if (!linha.includes('Parsed_ebur128')) continue;
    const m = linha.match(/\bt:\s*([\d.]+)\s+.*?\bM:\s*(-?[\d.]+|-inf|nan)/i);
    if (!m) continue;
    const M = Number(m[2]);
    pts.push({ t: +m[1], M: Number.isFinite(M) ? Math.max(-120, M) : -120 });
  }
  return pts;
}

/** Energia por segundo: média (em potência) da sonoridade momentânea de cada segundo -> [{t, rms}]. */
export function energiaPorSegundo(pontos, duracao) {
  const n = Math.max(1, Math.ceil(duracao || (pontos.length ? pontos[pontos.length - 1].t : 0)));
  const soma = new Array(n).fill(0);
  const cont = new Array(n).fill(0);
  for (const p of pontos) {
    // o ponto em t descreve a janela que termina em t; atribui ao segundo de (t - 0,05)
    const i = Math.min(n - 1, Math.max(0, Math.floor(p.t - 0.05)));
    soma[i] += Math.pow(10, p.M / 10);
    cont[i]++;
  }
  return soma.map((s, i) => ({ t: i, rms: cont[i] ? r1(Math.max(-120, 10 * Math.log10(s / cont[i] || 1e-12))) : -120 }));
}

/**
 * Trechos com voz provável a partir da sonoridade momentânea (10 por segundo):
 * acima de um limiar adaptativo (piso de ruído + 8 dB, entre -48 e -32 LUFS), unindo buracos curtos e com folga.
 */
export function trechosComVoz(pontos, duracao, { folga = 0.35, uniao = 1.2, minimo = 0.6 } = {}) {
  if (!pontos.length) return [];
  const ord = pontos.map((p) => p.M).sort((a, b) => a - b);
  const piso = ord[Math.floor(ord.length * 0.15)];
  const limiar = Math.min(-32, Math.max(-48, piso + 8));
  const trechos = [];
  let ini = null;
  let ultimo = null;
  for (const p of pontos) {
    // M cobre a janela de 0,4 s que termina em t
    if (p.M >= limiar) {
      if (ini == null) ini = Math.max(0, p.t - 0.4);
      ultimo = p.t;
    } else if (ini != null && p.t - ultimo > uniao) {
      trechos.push([ini, ultimo]);
      ini = null;
    }
  }
  if (ini != null) trechos.push([ini, ultimo]);
  return trechos
    .map(([a, b]) => ({ ini: r2(Math.max(0, a - folga)), fim: r2(Math.min(duracao || b + folga, b + folga)) }))
    .filter((t) => t.fim - t.ini >= minimo)
    .reduce((acc, t) => {
      const u = acc[acc.length - 1];
      if (u && t.ini <= u.fim) u.fim = Math.max(u.fim, t.fim);
      else acc.push({ ...t });
      return acc;
    }, [])
    .map((t) => ({ ...t, limiar: r1(limiar) }));
}

// ---------------------------------------------------------------- tremido (estimativa barata)

/**
 * Estima o tremido a partir de quadros cinza pequenos (L x A, 10 por segundo): calcula o deslocamento global
 * entre quadros vizinhos (busca de ±R px minimizando a diferença) e mede a parte "nervosa" dele
 * (deslocamento menos a média móvel = tremor, não panorâmica). Retorna 0 (firme) .. 1 (muito tremido).
 */
export function estimarTremido(raw, L, A, { R = 3 } = {}) {
  const tam = L * A;
  const n = Math.floor(raw.length / tam);
  if (n < 4) return 0;
  const dx = [];
  const dy = [];
  const m = R + 2;
  let amostras = 0;
  for (let y = m; y < A - m; y += 2) for (let x = m; x < L - m; x += 2) amostras++;
  for (let k = 1; k < n; k++) {
    const a = k * tam - tam;
    const b = k * tam;
    let melhor = Infinity;
    let bx = 0;
    let by = 0;
    for (let oy = -R; oy <= R; oy++) {
      for (let ox = -R; ox <= R; ox++) {
        let sad = 0;
        for (let y = m; y < A - m; y += 2) {
          const la = a + y * L;
          const lb = b + (y + oy) * L + ox;
          for (let x = m; x < L - m; x += 2) sad += Math.abs(raw[la + x] - raw[lb + x]);
        }
        // preferência por deslocamento zero: em imagem lisa (céu, parede) todos empatam e fica 0
        sad += amostras * 0.4 * (Math.abs(ox) + Math.abs(oy));
        if (sad < melhor) { melhor = sad; bx = ox; by = oy; }
      }
    }
    // diferença média alta mesmo no melhor encaixe = corte de cena ou movimento grande: não é tremido
    if (melhor / amostras > 30) { bx = 0; by = 0; }
    dx.push(bx);
    dy.push(by);
  }
  const jit = (arr) => {
    let s = 0;
    for (let i = 0; i < arr.length; i++) {
      let soma = 0; let c = 0;
      for (let j = Math.max(0, i - 3); j <= Math.min(arr.length - 1, i + 3); j++) { soma += arr[j]; c++; }
      const d = arr[i] - soma / c;
      s += d * d;
    }
    return s / arr.length;
  };
  const rms = Math.sqrt(jit(dx) + jit(dy)); // em px de um quadro com L px de largura
  return r2(Math.min(1, rms / (L / 96) / 1.5));
}

// ---------------------------------------------------------------- passada única

export const TREMIDO_L = 96;
export const TREMIDO_A = 54;

/**
 * Lê o clipe uma vez: silencedetect + ebur128 no áudio; detecção de cena e quadros cinza (tremido) no vídeo.
 * aoProgresso(segundosLidos) é chamado durante a leitura.
 */
export async function analisarSinais(ffmpeg, arquivo, info, { limiarCena = 0.3, silencio = '-35dB', silencioMin = 0.6, threads = 2, aoProgresso } = {}) {
  const args = ['-hide_banner', '-nostats', '-threads', String(threads), '-i', arquivo];
  const fc = [];
  const maps = [];
  if (info.temVideo) {
    // vídeo pequeno a 10 qps: um ramo para cortes de cena, outro para o tremido (cinza 96x54 no stdout)
    fc.push(`[0:v:0]fps=10,scale=${TREMIDO_L}:${TREMIDO_A}:flags=area,split=2[vc][vt]`);
    fc.push(`[vc]select='gt(scene\\,${limiarCena})',showinfo[cena]`);
    fc.push('[vt]format=gray[cinza]');
    maps.push('-map', '[cena]', '-f', 'null', '-');
    maps.push('-map', '[cinza]', '-f', 'rawvideo', '-pix_fmt', 'gray', 'pipe:1');
  }
  if (info.temAudio) {
    fc.push(`[0:a:0]aresample=48000,silencedetect=n=${silencio}:d=${silencioMin},ebur128=peak=none[au]`);
    maps.push('-map', '[au]', '-f', 'null', '-');
  }
  if (!fc.length) return { silencios: [], cenas: [0], energia: [], voz: [], tremido: 0, ebur: [] };
  args.push('-filter_complex', fc.join(';'), ...maps);

  const cinza = [];
  let ultimo = 0;
  const r = await rodar(ffmpeg, args, {
    aoStdout: (b) => cinza.push(b),
    aoStderr: aoProgresso
      ? (l) => {
        const m = l.match(/Parsed_ebur128.*?\bt:\s*([\d.]+)/) || l.match(/pts_time:([\d.]+)/);
        if (m && +m[1] - ultimo >= 2) { ultimo = +m[1]; aoProgresso(+m[1]); }
      }
      : undefined,
    timeout: Math.max(120000, info.duracao * 4000),
  });
  const ebur = info.temAudio ? parseEbur128(r.stderr) : [];
  return {
    silencios: info.temAudio ? parseSilencedetect(r.stderr, info.duracao) : [],
    cenas: info.temVideo ? parseCenas(r.stderr) : [0],
    energia: info.temAudio ? energiaPorSegundo(ebur, info.duracao) : [],
    voz: info.temAudio ? trechosComVoz(ebur, info.duracao) : [],
    tremido: info.temVideo ? estimarTremido(Buffer.concat(cinza), TREMIDO_L, TREMIDO_A) : 0,
    ebur,
  };
}

function r1(x) { return Math.round(x * 10) / 10; }
function r2(x) { return Math.round(x * 100) / 100; }
