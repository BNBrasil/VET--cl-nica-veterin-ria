// Motor de render: cada segmento vira um .mkv já no formato final (H.264 + PCM 48 kHz, quadros exatos),
// com enquadramento, transição e a camada ASS (título/legenda/gancho) queimada usando o tempo GLOBAL
// da timeline (setpts desloca o quadro para o tempo final antes do filtro ass). Depois junta tudo com o
// concat demuxer SEM reencodar o vídeo, e só o áudio passa pelo loudnorm de 2 passadas.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, statSync, mkdirSync, rmSync, renameSync } from 'node:fs';
import path from 'node:path';
import {
  FPS, ffmpeg, escolherEncoder, emParalelo, paralelismo, filtroEnquadramento, sondar, ErroVlog,
} from './render-comum.js';

/** Lê dimensões, rotação e presença de áudio direto do arquivo (mais confiável que o analise.json). */
export async function sondarClipe(arquivo) {
  const info = await sondar(arquivo);
  const v = info.streams.find((s) => s.codec_type === 'video');
  const a = info.streams.find((s) => s.codec_type === 'audio');
  if (!v) throw new ErroVlog(`o arquivo não tem vídeo: ${arquivo}`);
  let rot = Number(v.tags?.rotate || 0);
  for (const sd of v.side_data_list || []) if (sd.rotation !== undefined) rot = -Number(sd.rotation);
  const [n, d] = String(v.avg_frame_rate || v.r_frame_rate || '30/1').split('/').map(Number);
  return {
    largura: v.width, altura: v.height, rotacao: ((Math.round(rot) % 360) + 360) % 360,
    fps: d ? n / d : 30, temAudio: !!a, duracao: Number(info.format?.duration) || null,
  };
}

const segura = (s) => String(s).replace(/'/g, "'\\''");

/** Monta o filter_complex de um segmento. Exportado para teste. */
export function filtroSegmento(seg, { alvo, transicao = 'corte', primeiro = false, ultimo = false, ass = null, estabilizar = false, rostoX = null, temAudio = true }) {
  const N = Math.round(seg.dur * FPS);
  const dur = (N / FPS).toFixed(6);
  const partes = [];
  let v;
  if (seg.tipo === 'cartela') {
    v = '[0:v]setsar=1';
  } else {
    // estabilização leve: deshake em até 1280 px de largura (bem mais rápido; trecho tremido já é pouco nítido)
    const pre = estabilizar ? ",scale='min(1280,iw)':-2,deshake=rx=16:ry=16:edge=mirror:search=less" : '';
    const { filtro } = filtroEnquadramento(seg.info || seg.clipe, alvo, seg.foco || 'centro', { rostoX, entrada: 'vin', saida: 'vq' });
    partes.push(`[0:v]fps=${FPS}${pre},setpts=PTS-STARTPTS[vin]`);
    partes.push(filtro);
    v = '[vq]';
  }
  const ef = [];
  ef.push(`tpad=stop_mode=clone:stop_duration=1`, `trim=end_frame=${N}`, 'setpts=PTS-STARTPTS');
  const d = Number(dur);
  if (transicao === 'zoom' && !primeiro && seg.tipo !== 'cartela') {
    ef.push(`scale=w='trunc(${alvo.w}*(1+0.10*pow(max(0,1-t/0.35),2))/2)*2':h=-2:eval=frame:flags=bicubic`, `crop=${alvo.w}:${alvo.h}`);
  }
  const fi = primeiro ? 0.35 : transicao === 'fade' ? 0.25 : seg.tipo === 'cartela' ? 0.25 : 0;
  const fo = ultimo ? 0.6 : transicao === 'fade' ? 0.25 : seg.tipo === 'cartela' ? 0.25 : 0;
  if (fi && d > fi * 2) ef.push(`fade=t=in:st=0:d=${fi}`);
  if (fo && d > fo * 2) ef.push(`fade=t=out:st=${(d - fo).toFixed(3)}:d=${fo}`);
  if (ass) ef.push(`setpts=PTS-STARTPTS+${seg.offset.toFixed(6)}/TB`, `ass=filename='${segura(ass.arquivo)}':fontsdir='${segura(ass.fontes)}'`, 'setpts=PTS-STARTPTS');
  ef.push('format=yuv420p');
  partes.push(seg.tipo === 'cartela' ? `${v},${ef.join(',')}[v]` : `${v}${ef.join(',')}[v]`);
  // áudio: micro-fade em todo corte (sem estalo); fades maiores no início/fim e no "fade"
  const afi = primeiro ? 0.3 : transicao === 'fade' ? 0.15 : 0.012;
  const afo = ultimo ? 0.6 : transicao === 'fade' ? 0.15 : 0.025;
  const fonteA = seg.tipo === 'cartela' || !temAudio ? '[1:a]' : '[0:a]';
  partes.push(`${fonteA}aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad,atrim=end=${dur},asetpts=N/SR/TB,` +
    `afade=t=in:st=0:d=${afi},afade=t=out:st=${Math.max(0, d - afo).toFixed(4)}:d=${afo}[a]`);
  return partes.join(';');
}

function hashArquivo(f) {
  try { const s = statSync(f); return `${f}|${s.size}|${s.mtimeMs}`; } catch { return f; }
}

/**
 * Renderiza todos os segmentos de uma versão e junta em `saida` (mp4 final).
 * opts: { alvo, nome ('longo'|'curto'), pasta (render/), ass (caminho absoluto do .ass), transicao,
 *         estabilizar(seg)→bool, rostoX(seg)→num|null, trilha, titulo, aoProgresso }
 */
export async function renderizarVersao(segmentos, saida, opts) {
  const { alvo, nome, pasta, transicao = 'corte' } = opts;
  mkdirSync(pasta, { recursive: true });
  const enc = await escolherEncoder();
  const assRel = opts.ass ? { arquivo: path.relative(pasta, opts.ass).replace(/\\/g, '/'), fontes: 'fontes' } : null;
  const assHash = opts.ass && existsSync(opts.ass) ? createHash('sha1').update(readFileSync(opts.ass)).digest('hex') : '';
  const arquivos = [];
  const t0 = Date.now();
  let feitos = 0;
  await emParalelo(segmentos, paralelismo(), async (seg, i) => {
    const primeiro = i === 0, ultimo = i === segmentos.length - 1;
    const temAudio = seg.tipo === 'clipe' ? seg.info?.temAudio !== false : false;
    const filtro = filtroSegmento(seg, {
      alvo, transicao, primeiro, ultimo, ass: assRel, temAudio,
      estabilizar: seg.tipo === 'clipe' && !!opts.estabilizar?.(seg), rostoX: opts.rostoX?.(seg) ?? null,
    });
    const arq = `${nome}_${String(i).padStart(3, '0')}.mkv`;
    arquivos[i] = arq;
    const entrada = [];
    if (seg.tipo === 'cartela') {
      entrada.push('-f', 'lavfi', '-i', `color=c=${(opts.corCartela || '#111111').replace('#', '0x')}:s=${alvo.w}x${alvo.h}:r=${FPS}:d=${(seg.dur + 0.5).toFixed(3)}`);
    } else {
      entrada.push('-ss', seg.ini.toFixed(3), '-t', (seg.dur + 0.6).toFixed(3), '-i', seg.arquivo);
    }
    entrada.push('-f', 'lavfi', '-t', (seg.dur + 0.5).toFixed(3), '-i', 'anullsrc=r=48000:cl=stereo');
    const args = ['-loglevel', 'error', ...entrada, '-filter_complex', filtro, '-map', '[v]', '-map', '[a]',
      ...enc.args, '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2', '-t', (Math.round(seg.dur * FPS) / FPS).toFixed(6), arq];
    const chave = createHash('sha1').update(JSON.stringify(args) + assHash + (seg.arquivo ? hashArquivo(seg.arquivo) : '')).digest('hex');
    const marca = path.join(pasta, arq + '.hash');
    if (!(existsSync(path.join(pasta, arq)) && existsSync(marca) && readFileSync(marca, 'utf8') === chave)) {
      await ffmpeg(args, { cwd: pasta });
      writeFileSync(marca, chave);
    }
    feitos++;
    opts.aoProgresso?.(`${nome}: segmento ${feitos}/${segmentos.length}`);
  });
  const tSeg = (Date.now() - t0) / 1000;

  const lista = path.join(pasta, `${nome}_lista.txt`);
  writeFileSync(lista, arquivos.map((a) => `file '${a}'`).join('\n') + '\n');
  const total = segmentos.reduce((s, x) => s + Math.round(x.dur * FPS), 0) / FPS;

  // cadeia de áudio (com trilha opcional por baixo da voz) usada nas duas passadas do loudnorm
  const entradas = ['-f', 'concat', '-safe', '0', '-i', path.basename(lista)];
  let cadeia = '[0:a]anull';
  if (opts.trilha && existsSync(opts.trilha)) {
    entradas.push('-stream_loop', '-1', '-i', opts.trilha);
    cadeia = `[1:a]aresample=48000,aformat=channel_layouts=stereo,volume=0.12,atrim=end=${total.toFixed(3)},afade=t=in:d=1.5,afade=t=out:st=${Math.max(0, total - 2.5).toFixed(3)}:d=2.5[m];` +
      `[0:a][m]amix=inputs=2:duration=first:dropout_transition=0:normalize=0`;
  }
  const medida = await ffmpeg([...entradas, '-filter_complex', `${cadeia},loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json[a]`,
    '-map', '[a]', '-f', 'null', '-'], { cwd: pasta });
  const js = medida.stderr.slice(medida.stderr.lastIndexOf('{'), medida.stderr.lastIndexOf('}') + 1);
  let ln;
  try { ln = JSON.parse(js); } catch { ln = null; }
  const loud = ln && Number.isFinite(Number(ln.input_i)) && Number(ln.input_i) > -70
    ? `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${ln.input_i}:measured_TP=${ln.input_tp}:measured_LRA=${ln.input_lra}:measured_thresh=${ln.input_thresh}:offset=${ln.target_offset}:linear=true`
    : 'anull'; // silêncio total: nada a normalizar
  const tmp = saida.replace(/\.mp4$/i, '.parcial.mp4');
  await ffmpeg(['-loglevel', 'error', ...entradas, '-filter_complex', `${cadeia},${loud},aresample=48000[a]`,
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
    '-t', total.toFixed(3), '-movflags', '+faststart', '-metadata', `title=${opts.titulo || ''}`, tmp], { cwd: pasta });
  rmSync(saida, { force: true });
  renameSync(tmp, saida);
  return { encoder: enc.nome, duracao: total, segundosSegmentos: tSeg, segundosTotal: (Date.now() - t0) / 1000, loudnorm: ln };
}

/** Confere a saída com ffprobe: codec, perfil, resolução, fps, áudio. Retorna lista de problemas. */
export async function conferirSaida(arquivo, alvo) {
  const info = await sondar(arquivo);
  const v = info.streams.find((s) => s.codec_type === 'video');
  const a = info.streams.find((s) => s.codec_type === 'audio');
  const p = [];
  if (!v || v.codec_name !== 'h264') p.push('vídeo não é H.264');
  if (v && !/High/i.test(v.profile || '')) p.push(`perfil ${v?.profile} (esperado High)`);
  if (v && (v.width !== alvo.w || v.height !== alvo.h)) p.push(`resolução ${v.width}x${v.height} (esperado ${alvo.w}x${alvo.h})`);
  if (v && v.r_frame_rate !== '30/1') p.push(`fps ${v.r_frame_rate} (esperado 30/1)`);
  if (v && v.pix_fmt !== 'yuv420p') p.push(`pix_fmt ${v.pix_fmt}`);
  if (!a || a.codec_name !== 'aac' || a.sample_rate !== '48000' || a.channels !== 2) p.push('áudio não é AAC 48 kHz estéreo');
  return { problemas: p, duracao: Number(info.format.duration), video: v, audio: a };
}
