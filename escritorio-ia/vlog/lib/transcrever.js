// Transcrição local com whisper.cpp (whisper-cli), em português, só nos trechos com voz.
// - Recorta cada trecho com voz (limiar de volume da análise) em WAV 16 kHz mono.
// - Roda UM whisper-cli por dia com todos os trechos (o modelo carrega uma vez só), com VAD Silero se instalado.
// - Converte os tempos de volta para o clipe e filtra alucinações típicas do Whisper.
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { rodar, lerConfigWhisper, ErroFerramenta } from './externos.js';

// ---------------------------------------------------------------- filtro de alucinação (puro)

export function normalizar(t) {
  return String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

// Sempre lixo: créditos de legenda que o Whisper aprendeu dos vídeos do YouTube.
const LIXO_SEMPRE = [
  /amara\s*\.?\s*org/i, /legendas? (pela|por|da) comunidade/i, /legendas? (por|de|feitas? por)\s+\S+/i,
  /^legendas?\b/i, /legendado por/i, /transcri[cç][aã]o e legendas?/i, /sous[- ]titres/i, /subtitles? by/i,
  /untertitel/i, /www\.\S+/i, /\.com(\.br)?\b/i, /qualidade de legendas/i, /tradu[cç][aã]o e legendas/i,
];
// Lixo só quando o áudio do trecho é fraco ou a confiança é baixa (pode ser fala real no fim de um vlog).
const LIXO_SUSPEITO = [
  /^(muito )?obrigad[oa]s?( por (assistir(em)?|ver|tudo))?( e ate a proxima)?$/,
  /^inscreva se( no canal)?/, /ative o sininho/, /deixe (seu|o seu) like/, /^ate a proxima( pessoal)?$/,
  /^tchau( tchau)*$/, /^valeu( pessoal)?$/, /^e ai$/, /^(musica|risos|aplausos|silencio)$/, /^(hum|hmm|ah|oh|uh)$/,
  /^fim$/, /^ok$/, /^beleza$/, /^sim$/, /^nao$/, /^\.+$/,
];
const SO_MARCACAO = /^[\s\-–—.…]*([[(♪♫*][^\])]*[\])♪♫*]?[\s.…]*)+$/u;

/** Colapsa laços de repetição internos ("vamos vamos vamos vamos" / frase repetida 4x). */
export function colapsarRepeticoes(texto) {
  const ws = String(texto).trim().split(/\s+/);
  if (ws.length < 4) return texto.trim();
  for (let n = 1; n <= 8; n++) {
    let i = 0;
    const saida = [];
    while (i < ws.length) {
      const bloco = ws.slice(i, i + n).join(' ').toLowerCase();
      let rep = 1;
      while (i + (rep + 1) * n <= ws.length && ws.slice(i + rep * n, i + (rep + 1) * n).join(' ').toLowerCase() === bloco) rep++;
      if (rep >= (n === 1 ? 4 : 3)) {
        saida.push(...ws.slice(i, i + n));
        i += rep * n;
      } else {
        saida.push(ws[i]);
        i++;
      }
    }
    if (saida.length < ws.length) return colapsarRepeticoes(saida.join(' '));
  }
  return ws.join(' ');
}

/**
 * Remove alucinações: créditos de legenda, marcações sem fala, frases-clichê em áudio fraco ou com confiança
 * baixa, segmentos repetidos, fala impossível de rápida. `energia(ini, fim)` devolve a sonoridade média (LUFS)
 * do trecho no clipe e `limiar` é o limiar de voz do clipe.
 * Entrada/saída: [{ini, fim, texto, p?}]
 */
export function filtrarAlucinacoes(segs, { energia, limiar = -40 } = {}) {
  const saida = [];
  const contagem = new Map();
  for (const s of segs) contagem.set(normalizar(s.texto), (contagem.get(normalizar(s.texto)) || 0) + 1);
  for (const s0 of segs) {
    const texto = colapsarRepeticoes(String(s0.texto || '').replace(/\s+/g, ' ').trim());
    const s = { ...s0, texto };
    const n = normalizar(texto);
    if (!n || SO_MARCACAO.test(texto)) continue;
    if (LIXO_SEMPRE.some((re) => re.test(texto))) continue;
    const dur = Math.max(0.01, s.fim - s.ini);
    const fraco = energia ? energia(s.ini, s.fim) < limiar + 3 : false;
    const incerto = s.p != null && s.p < 0.45;
    if (LIXO_SUSPEITO.some((re) => re.test(n)) && (fraco || incerto)) continue;
    if (s.p != null && s.p < 0.3 && n.split(' ').length <= 6) continue; // palpite de baixíssima confiança
    if (n.replace(/ /g, '').length / dur > 32) continue; // mais de ~32 letras/s não é fala
    if (fraco && incerto) continue;
    // mesma frase curta 3+ vezes no clipe = laço de alucinação (mantém só a primeira)
    if ((contagem.get(n) || 0) >= 3 && n.split(' ').length <= 8 && saida.some((x) => normalizar(x.texto) === n)) continue;
    const ant = saida[saida.length - 1];
    if (ant && normalizar(ant.texto) === n) { ant.fim = Math.max(ant.fim, s.fim); continue; }
    saida.push(s);
  }
  return saida;
}

// ---------------------------------------------------------------- whisper.cpp JSON (puro)

/** "00:01:02,345" -> 62.345 */
export function tempoWhisper(s) {
  const m = String(s).match(/(\d+):(\d+):(\d+)[,.](\d+)/);
  return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000 : 0;
}

/**
 * Lê o JSON do whisper-cli (-oj ou -ojf) -> [{ini, fim, texto, p?, palavras?}] em segundos, somando `deslocamento`.
 */
export function lerJsonWhisper(json, deslocamento = 0) {
  const lista = [];
  for (const seg of json?.transcription || []) {
    const ini = seg.offsets ? seg.offsets.from / 1000 : tempoWhisper(seg.timestamps?.from);
    const fim = seg.offsets ? seg.offsets.to / 1000 : tempoWhisper(seg.timestamps?.to);
    const texto = String(seg.text || '').replace(/\s+/g, ' ').trim();
    const item = { ini: r2(ini + deslocamento), fim: r2(Math.max(fim, ini + 0.2) + deslocamento), texto };
    const toks = (seg.tokens || []).filter((t) => !/^\[_/.test(t.text || '') && !/^<\|/.test(t.text || ''));
    if (toks.length) {
      item.p = r2(toks.reduce((a, t) => a + (t.p ?? 1), 0) / toks.length);
      const palavras = [];
      for (const t of toks) {
        const txt = t.text || '';
        const t0 = (t.offsets?.from ?? 0) / 1000 + deslocamento;
        const t1 = (t.offsets?.to ?? 0) / 1000 + deslocamento;
        if (!palavras.length || /^\s/.test(txt)) palavras.push({ w: txt.trim(), t0: r2(t0), t1: r2(t1) });
        else { const u = palavras[palavras.length - 1]; u.w += txt; u.t1 = r2(t1); }
      }
      const limpas = palavras.filter((w) => w.w && /[\p{L}\p{N}]/u.test(w.w));
      if (limpas.length) item.palavras = limpas;
    }
    if (texto) lista.push(item);
  }
  return lista;
}

// ---------------------------------------------------------------- SRT do dia

const ts = (s) => {
  const ms = Math.max(0, Math.round(s * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const se = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(se).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
};

/**
 * SRT do dia: os clipes em sequência (como se estivessem um atrás do outro, na ordem do analise.json);
 * cada legenda começa com [clipe N] para o editor achar o trecho.
 */
export function srtDoDia(clipes) {
  const blocos = [];
  let offset = 0;
  clipes.forEach((c, i) => {
    for (const f of c.falas || []) {
      blocos.push(`${blocos.length + 1}\n${ts(offset + f.ini)} --> ${ts(offset + f.fim)}\n[clipe ${i}] ${f.texto}\n`);
    }
    offset += c.duracao || 0;
  });
  return blocos.join('\n');
}

/** Texto corrido do dia para leitura rápida (clipe, horário, tempo de cada fala). */
export function textoDoDia(analise) {
  const mmss = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
  const linhas = [`Transcrição de ${analise.data}`, ''];
  analise.clipes.forEach((c, i) => {
    linhas.push(`== [clipe ${i}] ${path.basename(c.arquivo)}  ${c.inicioDoDia || '--:--:--'}  (${mmss(c.duracao)})`);
    if (!c.falas?.length) linhas.push(c.temAudio ? '   (sem fala detectada)' : '   (sem áudio)');
    for (const f of c.falas || []) linhas.push(`   ${mmss(f.ini)}–${mmss(f.fim)}  ${f.texto}`);
    linhas.push('');
  });
  return linhas.join('\n');
}

// ---------------------------------------------------------------- execução

export function whisperDisponivel(modelo) {
  const cfg = lerConfigWhisper();
  if (!cfg || !cfg.bin || !existsSync(cfg.bin)) return { ok: false, motivo: 'whisper.cpp não instalado (rode: node vlog/instalar-ferramentas.js)' };
  const m = modelo || cfg.modeloPadrao || 'small';
  const arq = cfg.modelos?.[m];
  if (!arq || !existsSync(arq)) return { ok: false, motivo: `modelo ${m} não instalado (rode: node vlog/instalar-ferramentas.js --modelo ${m})` };
  return { ok: true, cfg, modelo: m, arquivoModelo: arq };
}

/** Recorta os trechos com voz de um clipe em WAVs 16 kHz mono (um processo ffmpeg por clipe). */
async function recortarTrechos(ffmpeg, arquivo, trechos, pastaTmp, prefixo) {
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-i', arquivo];
  const saidas = trechos.map((t, j) => {
    const wav = path.join(pastaTmp, `${prefixo}_${j}.wav`);
    args.push('-map', '0:a:0', '-ss', t.ini.toFixed(3), '-to', t.fim.toFixed(3), '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav);
    return { ...t, wav };
  });
  if (saidas.length) await rodar(ffmpeg, args);
  return saidas;
}

/**
 * Transcreve os trechos com voz dos clipes de um dia.
 * itens: [{ chave, arquivo, voz: [{ini,fim}], ebur: [{t,M}], limiar }]
 * Retorna Map(chave -> falas[]) e estatísticas.
 */
export async function transcreverDia(ffmpeg, itens, { modelo, pastaTmp, threads, gpu = true, rapido = false, aoLog = () => {} } = {}) {
  const disp = whisperDisponivel(modelo);
  if (!disp.ok) throw new ErroFerramenta(disp.motivo);
  const { cfg, arquivoModelo } = disp;
  mkdirSync(pastaTmp, { recursive: true });
  const resultado = new Map();
  const todos = [];
  let segundosAudio = 0;
  for (const [k, it] of itens.entries()) {
    resultado.set(it.chave, []);
    if (!it.voz?.length) continue;
    const wavs = await recortarTrechos(ffmpeg, it.arquivo, it.voz, pastaTmp, `c${k}`);
    for (const w of wavs) { todos.push({ ...w, chave: it.chave, item: it }); segundosAudio += w.fim - w.ini; }
  }
  if (!todos.length) return { falas: resultado, segundosAudio: 0, segundos: 0 };

  const nThreads = String(threads || Math.max(1, Math.min(8, os.cpus().length)));
  const usarVad = cfg.vad && existsSync(cfg.vad);
  const t0 = Date.now();
  // lotes (linha de comando do Windows tem limite de ~32 mil caracteres)
  const LOTE = 30;
  for (let i = 0; i < todos.length; i += LOTE) {
    const lote = todos.slice(i, i + LOTE);
    const args = ['-m', arquivoModelo, '-l', 'pt', '-t', nThreads, '-ojf', '-np', '-mc', '0', '-sns'];
    if (usarVad) args.push('--vad', '-vm', cfg.vad, '-vsd', '500', '-vp', '200');
    if (rapido) args.push('-bs', '1', '-bo', '1'); // busca gulosa: ~2-3x mais rápido na CPU, um pouco menos preciso
    if (!gpu || cfg.variante === 'cpu') args.push('-ng');
    for (const w of lote) args.push('-f', w.wav);
    aoLog(`whisper: ${Math.min(i + LOTE, todos.length)}/${todos.length} trechos`);
    let r = await rodar(cfg.bin, args, { ignorarErro: true, timeout: 6 * 3600 * 1000 });
    if (r.code !== 0 && cfg.binCpu && cfg.binCpu !== cfg.bin) {
      aoLog('whisper (GPU) falhou, repetindo na CPU');
      r = await rodar(cfg.binCpu, [...args.filter((a) => a !== '-ng'), '-ng'], { ignorarErro: true, timeout: 6 * 3600 * 1000 });
    }
    if (r.code !== 0) throw new ErroFerramenta(`whisper-cli falhou: ${r.stderr.split(/\r?\n/).filter(Boolean).slice(-3).join(' | ')}`);
    for (const w of lote) {
      const arq = w.wav + '.json';
      if (!existsSync(arq)) continue;
      let json;
      try { json = JSON.parse(readFileSync(arq, 'utf8')); } catch { continue; }
      const segs = lerJsonWhisper(json, w.ini).map((s) => ({ ...s, ini: Math.max(w.ini, s.ini), fim: Math.min(w.fim, s.fim) }));
      resultado.get(w.chave).push(...segs);
    }
  }
  const segundos = (Date.now() - t0) / 1000;
  // filtro por clipe
  for (const it of itens) {
    const segs = (resultado.get(it.chave) || []).sort((a, b) => a.ini - b.ini);
    const energia = (a, b) => {
      const pts = (it.ebur || []).filter((p) => p.t >= a && p.t <= b + 0.4);
      if (!pts.length) return -120;
      return 10 * Math.log10(pts.reduce((s, p) => s + Math.pow(10, p.M / 10), 0) / pts.length);
    };
    const limpos = filtrarAlucinacoes(segs, { energia, limiar: it.limiar ?? -40 })
      .map(({ p, ...resto }) => resto);
    resultado.set(it.chave, limpos);
  }
  rmSync(pastaTmp, { recursive: true, force: true });
  return { falas: resultado, segundosAudio, segundos, vad: !!usarVad, variante: cfg.variante, modelo: disp.modelo };
}

function r2(x) { return Math.round(x * 100) / 100; }
