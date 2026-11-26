// Frente RENDER do vlog: utilidades compartilhadas por renderizar.js e compilar.js.
// Funções puras (validação do edl, timeline, capítulos, legendas, enquadramento, ASS) ficam aqui
// para serem testadas sem ffmpeg; a execução de processos também (achar ffmpeg, encoder, fontes).
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

export const VLOG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const WIN = process.platform === 'win32';
export const FPS = 30;
export const LONGO = { w: 1920, h: 1080 };
export const CURTO = { w: 1080, h: 1920 };
export const TRANSICOES = ['corte', 'fade', 'zoom'];
export const FOCOS = ['rosto', 'centro', 'esquerda', 'direita', 'fundo', 'desfocado'];

export const pastaTrabalho = () => process.env.VLOG_TRABALHO || path.join(VLOG, 'trabalho');
export const pastaPostar = () => process.env.VLOG_POSTAR || path.join(VLOG, 'postar');

export class ErroVlog extends Error {}

// ---------------------------------------------------------------- tempo e texto
export const quantizar = (s, fps = FPS) => Math.round(s * fps) / fps;
const dois = (n) => String(n).padStart(2, '0');

/** Segundos → "00:00" (ou "1:02:03" a partir de 1 h), formato aceito pelos capítulos do YouTube. */
export function tempoCapitulo(s) {
  const t = Math.max(0, Math.floor(s + 1e-6));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), seg = t % 60;
  return h ? `${h}:${dois(m)}:${dois(seg)}` : `${dois(m)}:${dois(seg)}`;
}

/** Segundos → "HH:MM:SS,mmm" do .srt */
export function tempoSrt(s) {
  const ms = Math.max(0, Math.round(s * 1000));
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  const seg = Math.floor((ms % 60000) / 1000);
  return `${dois(h)}:${dois(m)}:${dois(seg)},${String(ms % 1000).padStart(3, '0')}`;
}

/** Segundos → "H:MM:SS.cc" do .ass */
export function tempoAss(s) {
  const cs = Math.max(0, Math.round(s * 100));
  const h = Math.floor(cs / 360000), m = Math.floor((cs % 360000) / 6000);
  const seg = Math.floor((cs % 6000) / 100);
  return `${h}:${dois(m)}:${dois(seg)}.${dois(cs % 100)}`;
}

export const maiusc = (s) => String(s ?? '').toLocaleUpperCase('pt-BR');
export const escAss = (s) => String(s ?? '').replace(/\\/g, '/').replace(/\{/g, '(').replace(/\}/g, ')').replace(/\r?\n/g, '\\N');

/** "#RRGGBB" → "&H00BBGGRR" (ASS) */
export function corAss(hex, alfa = 0) {
  const h = String(hex || '#FFFFFF').replace('#', '').padEnd(6, '0');
  const a = Math.round(Math.max(0, Math.min(255, alfa))).toString(16).padStart(2, '0');
  return `&H${a}${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}`.toUpperCase();
}

export function dataBR(data) {
  const m = String(data || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(data || '');
}

export function slug(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ---------------------------------------------------------------- canal.json
const CANAL_PADRAO = {
  nome: 'Meu Vlog',
  arroba: '@meuvlog',
  cores: { destaque: '#FFD400', texto: '#FFFFFF', contorno: '#000000', fundo: '#111111', cartela: '#1B1B1F' },
  fontes: { titulo: null, legenda: null },
  hashtags: ['#vlog', '#diadia', '#rotina'],
  tags: ['vlog', 'vlog do dia', 'rotina'],
  marcaDagua: true,
  estabilizar: true,
  limiteTremido: 0.6,
  rodape: '',
};

export function lerCanal(arquivo = path.join(VLOG, 'canal.json')) {
  let dados = {};
  if (existsSync(arquivo)) {
    try { dados = JSON.parse(readFileSync(arquivo, 'utf8')); } catch (e) {
      throw new ErroVlog(`vlog/canal.json não é um JSON válido: ${e.message}`);
    }
  }
  return {
    ...CANAL_PADRAO, ...dados,
    cores: { ...CANAL_PADRAO.cores, ...(dados.cores || {}) },
    fontes: { ...CANAL_PADRAO.fontes, ...(dados.fontes || {}) },
  };
}

// ---------------------------------------------------------------- fontes
// Cada candidato: arquivo + nome da família (o que o libass procura) + negrito.
const FONTES_WIN = {
  titulo: [['arialbd.ttf', 'Arial', 1], ['segoeuib.ttf', 'Segoe UI', 1], ['impact.ttf', 'Impact', 0]],
  legenda: [['impact.ttf', 'Impact', 0], ['ariblk.ttf', 'Arial Black', 0], ['arialbd.ttf', 'Arial', 1], ['segoeuib.ttf', 'Segoe UI', 1]],
};
const PASTAS_LINUX = ['/usr/share/fonts/truetype/dejavu', '/usr/share/fonts/dejavu', '/usr/share/fonts/TTF',
  '/usr/local/share/fonts', '/Library/Fonts', '/System/Library/Fonts/Supplemental'];
const FONTES_UNIX = [['DejaVuSans-Bold.ttf', 'DejaVu Sans', 1], ['Arial Bold.ttf', 'Arial', 1], ['Impact.ttf', 'Impact', 0]];

/**
 * Escolhe a fonte de um papel ("titulo" ou "legenda"). canal.fontes[papel] pode ser
 * { "arquivo": "C:/Windows/Fonts/impact.ttf", "nome": "Impact", "negrito": 0 }.
 */
export function acharFonte(papel, canal = CANAL_PADRAO) {
  const cfg = canal.fontes?.[papel];
  if (cfg?.arquivo && existsSync(cfg.arquivo)) {
    return { arquivo: cfg.arquivo, nome: cfg.nome || path.parse(cfg.arquivo).name, negrito: cfg.negrito ?? 1 };
  }
  const cands = [];
  if (WIN) {
    const dir = path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts');
    for (const [f, n, b] of FONTES_WIN[papel] || FONTES_WIN.titulo) cands.push([path.join(dir, f), n, b]);
  }
  for (const dir of PASTAS_LINUX) for (const [f, n, b] of FONTES_UNIX) cands.push([path.join(dir, f), n, b]);
  const achada = cands.find(([f]) => existsSync(f));
  if (achada) return { arquivo: achada[0], nome: achada[1], negrito: achada[2] };
  return { arquivo: null, nome: 'Sans', negrito: 1 }; // libass usa a fonte padrão do sistema
}

/** Copia as fontes para <render>/fontes (o filtro ass recebe caminho relativo: sem "C:" para escapar). */
export function prepararFontes(pastaRender, canal) {
  const dir = path.join(pastaRender, 'fontes');
  mkdirSync(dir, { recursive: true });
  const titulo = acharFonte('titulo', canal);
  const legenda = acharFonte('legenda', canal);
  for (const f of [titulo, legenda]) {
    if (f.arquivo) { try { copyFileSync(f.arquivo, path.join(dir, path.basename(f.arquivo))); } catch { /* sem permissão: libass usa o sistema */ } }
  }
  return { titulo, legenda };
}

// ---------------------------------------------------------------- processos
const cacheProg = new Map();
function noPath(nome) {
  const r = spawnSync(WIN ? 'where' : 'which', [nome], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  return r.stdout.split(/\r?\n/).find(Boolean)?.trim() || null;
}

export function acharPrograma(nome) {
  if (cacheProg.has(nome)) return cacheProg.get(nome);
  const env = process.env[`VLOG_${nome.toUpperCase()}`];
  let achado = env && existsSync(env) ? env : noPath(nome);
  if (!achado) {
    const extras = [path.join(VLOG, 'ferramentas', nome + (WIN ? '.exe' : ''))];
    if (WIN && process.env.LOCALAPPDATA) extras.push(path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Links', nome + '.exe'));
    else extras.push(`/usr/bin/${nome}`, `/usr/local/bin/${nome}`, `/opt/homebrew/bin/${nome}`);
    achado = extras.find((c) => existsSync(c)) || null;
  }
  cacheProg.set(nome, achado);
  return achado;
}

export function exigirFfmpeg() {
  const ffmpeg = acharPrograma('ffmpeg');
  const ffprobe = acharPrograma('ffprobe');
  if (!ffmpeg || !ffprobe) {
    throw new ErroVlog('ffmpeg não encontrado. Windows: rode INICIAR.bat (instala pelo winget) ou ' +
      '"winget install Gyan.FFmpeg". Linux: sudo apt install ffmpeg. mac: brew install ffmpeg.');
  }
  return { ffmpeg, ffprobe };
}

/** Roda um processo; resolve { stdout, stderr }; rejeita com as últimas linhas do stderr. */
export function rodar(cmd, args, { cwd, entrada } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, windowsHide: true });
    let out = '', err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; if (err.length > 2e6) err = err.slice(-1e6); });
    p.on('error', (e) => reject(new ErroVlog(`não consegui executar ${cmd}: ${e.message}`)));
    p.on('close', (code) => {
      if (code === 0) resolve({ stdout: out, stderr: err });
      else {
        const fim = err.trim().split(/\r?\n/).slice(-12).join('\n');
        reject(new ErroVlog(`${path.basename(cmd)} falhou (código ${code}):\n${fim}`));
      }
    });
    if (entrada) p.stdin.end(entrada); else p.stdin.end();
  });
}

export const ffmpeg = (args, opts) => rodar(exigirFfmpeg().ffmpeg, ['-hide_banner', '-nostdin', '-y', ...args], opts);

export async function sondar(arquivo) {
  const { stdout } = await rodar(exigirFfmpeg().ffprobe, ['-v', 'error', '-print_format', 'json',
    '-show_format', '-show_streams', arquivo]);
  return JSON.parse(stdout);
}

let encoderCache = null;
/**
 * Encoder de vídeo: h264_nvenc se a placa existir de verdade (testa 1 quadro), senão libx264.
 * VLOG_ENCODER=libx264 força; VLOG_RAPIDO=1 usa preset ultrafast (testes).
 */
export async function escolherEncoder() {
  if (encoderCache) return encoderCache;
  const forcado = process.env.VLOG_ENCODER;
  let nome = 'libx264';
  if (forcado !== 'libx264') {
    try {
      await ffmpeg(['-loglevel', 'error', '-f', 'lavfi', '-i', 'color=s=256x256:d=0.2:r=30',
        '-c:v', 'h264_nvenc', '-f', 'null', '-']);
      nome = 'h264_nvenc';
    } catch { nome = 'libx264'; }
  }
  const rapido = process.env.VLOG_RAPIDO === '1';
  const comum = ['-pix_fmt', 'yuv420p', '-r', String(FPS), '-g', String(FPS * 2)];
  const args = nome === 'h264_nvenc'
    ? ['-c:v', 'h264_nvenc', '-preset', 'p5', '-tune', 'hq', '-rc', 'vbr', '-cq', '21', '-b:v', '0',
      '-maxrate', '16M', '-bufsize', '24M', '-profile:v', 'high', '-bf', '2', ...comum]
    : ['-c:v', 'libx264', '-preset', rapido ? 'ultrafast' : 'medium', '-crf', rapido ? '23' : '19',
      '-profile:v', 'high', ...comum];
  encoderCache = { nome, args };
  return encoderCache;
}

/** Roda tarefas com no máximo `n` simultâneas. */
export async function emParalelo(itens, n, fn) {
  const res = new Array(itens.length);
  let i = 0;
  const trab = async () => { while (i < itens.length) { const k = i++; res[k] = await fn(itens[k], k); } };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, itens.length)) }, trab));
  return res;
}
export const paralelismo = () => Math.max(1, Math.min(4, Math.floor(os.cpus().length / 4)));

// ---------------------------------------------------------------- leitura de arquivos do dia
export function lerJson(arquivo, nome) {
  if (!existsSync(arquivo)) throw new ErroVlog(`não achei ${nome}: ${arquivo}`);
  try { return JSON.parse(readFileSync(arquivo, 'utf8')); } catch (e) {
    throw new ErroVlog(`${nome} não é um JSON válido (${arquivo}): ${e.message}`);
  }
}

/** Resolve o caminho do clipe (absoluto, relativo ao analise.json, ou relativo a vlog/brutos). */
export function caminhoClipe(clipe, pastaAnalise) {
  const a = String(clipe.arquivo || '');
  if (!a) return null;
  const cands = [a, path.resolve(pastaAnalise, a), path.resolve(process.env.VLOG_BRUTOS || path.join(VLOG, 'brutos'), a)];
  return cands.find((c) => existsSync(c)) || cands[0];
}

// ---------------------------------------------------------------- validação do edl
const num = (v) => typeof v === 'number' && Number.isFinite(v);

/** Aceita índice numérico ou nome do arquivo (com ou sem pasta). Retorna o índice ou -1. */
export function indiceClipe(ref, analise) {
  const clipes = analise?.clipes || [];
  if (Number.isInteger(ref)) return ref >= 0 && ref < clipes.length ? ref : -1;
  if (typeof ref === 'string' && ref) {
    const base = path.basename(ref.replace(/\\/g, '/')).toLowerCase();
    return clipes.findIndex((c) => path.basename(String(c.arquivo || '').replace(/\\/g, '/')).toLowerCase() === base);
  }
  return -1;
}

/**
 * Valida o edl contra a análise do dia. Retorna { erros: string[], avisos: string[] }.
 * Mensagens dizem onde está o problema e como corrigir.
 */
export function validarEdl(edl, analise) {
  const erros = [], avisos = [];
  if (!edl || typeof edl !== 'object' || Array.isArray(edl)) return { erros: ['edl.json precisa ser um objeto { data, titulo, longo, curto, ... }'], avisos };
  const n = analise?.clipes?.length || 0;
  if (analise?.data && edl.data && edl.data !== analise.data) avisos.push(`edl.data (${edl.data}) é diferente de analise.data (${analise.data})`);
  if (!edl.titulo) avisos.push('edl.titulo vazio: vou usar a data como título');
  if (!edl.longo && !edl.curto) erros.push('o edl precisa de "longo" e/ou "curto" com uma lista "cortes"');

  const checarCortes = (versao) => {
    const v = edl[versao];
    if (v === undefined || v === null) return;
    if (!Array.isArray(v.cortes) || v.cortes.length === 0) { erros.push(`${versao}.cortes precisa ser uma lista com pelo menos 1 corte`); return; }
    let total = 0;
    v.cortes.forEach((c, i) => {
      const onde = `${versao}.cortes[${i}]`;
      if (!c || typeof c !== 'object') { erros.push(`${onde} precisa ser um objeto { clipe, ini, fim }`); return; }
      if (c.tipo === 'cartela') { if (!c.texto) erros.push(`${onde}: cartela sem "texto"`); total += num(c.dur) ? c.dur : 2; return; }
      const k = indiceClipe(c.clipe, analise);
      if (k < 0) {
        erros.push(`${onde}: clipe ${JSON.stringify(c.clipe)} não existe — o analise.json deste dia tem ${n} clipe(s) (use o índice 0 a ${Math.max(0, n - 1)} ou o nome do arquivo)`);
        return;
      }
      const dur = analise.clipes[k].duracao;
      if (!num(c.ini) || !num(c.fim)) { erros.push(`${onde}: "ini" e "fim" precisam ser números em segundos (ex.: "ini": 3.0, "fim": 12.5)`); return; }
      if (c.ini < 0) erros.push(`${onde}: "ini" (${c.ini}) não pode ser negativo`);
      if (c.fim <= c.ini) erros.push(`${onde}: "fim" (${c.fim}) precisa ser maior que "ini" (${c.ini})`);
      else if (c.fim - c.ini < 0.5) avisos.push(`${onde}: corte de ${(c.fim - c.ini).toFixed(2)} s é muito curto (mínimo recomendado 0,5 s)`);
      if (num(dur)) {
        if (c.ini >= dur) erros.push(`${onde}: "ini" (${c.ini}) passa do fim do clipe ${k} (${dur.toFixed(2)} s)`);
        else if (c.fim > dur + 0.5) erros.push(`${onde}: "fim" (${c.fim}) passa do fim do clipe ${k} (${dur.toFixed(2)} s)`);
        else if (c.fim > dur) avisos.push(`${onde}: "fim" (${c.fim}) passa um pouco do fim do clipe (${dur.toFixed(2)} s): vou cortar em ${dur.toFixed(2)}`);
      }
      if (c.foco !== undefined && !FOCOS.includes(c.foco)) erros.push(`${onde}: foco "${c.foco}" inválido — use ${FOCOS.join(', ')}`);
      if (c.fim > c.ini) total += Math.min(c.fim, num(dur) ? dur : c.fim) - c.ini;
    });
    return total;
  };

  if (edl.longo) {
    checarCortes('longo');
    const t = edl.longo.transicao ?? 'corte';
    if (!TRANSICOES.includes(t)) erros.push(`longo.transicao "${t}" inválida — use ${TRANSICOES.join(', ')}`);
    if (edl.longo.trilha && !existsSync(edl.longo.trilha)) avisos.push(`longo.trilha não encontrada (${edl.longo.trilha}): sigo sem trilha`);
  }
  if (edl.curto) {
    const total = checarCortes('curto');
    const max = edl.curto.duracaoMax ?? 60;
    if (!num(max) || max <= 0) erros.push('curto.duracaoMax precisa ser um número de segundos (ex.: 60)');
    else {
      if (max > 90) avisos.push(`curto.duracaoMax ${max} s passa do limite do Reels (90 s)`);
      if (num(total) && total > max + 0.01) avisos.push(`curto soma ${total.toFixed(1)} s, mais que duracaoMax (${max} s): o final será cortado`);
    }
    if (!edl.curto.gancho) avisos.push('curto.gancho vazio: o Reels fica sem texto de gancho nos 2 primeiros segundos');
    if (edl.curto.transicao && !TRANSICOES.includes(edl.curto.transicao)) erros.push(`curto.transicao "${edl.curto.transicao}" inválida — use ${TRANSICOES.join(', ')}`);
  }
  if (edl.youtube?.tags && !Array.isArray(edl.youtube.tags)) erros.push('youtube.tags precisa ser uma lista de textos');
  if (edl.reels?.hashtags && !Array.isArray(edl.reels.hashtags)) erros.push('reels.hashtags precisa ser uma lista de textos');
  return { erros, avisos };
}

// ---------------------------------------------------------------- timeline
/**
 * Converte os cortes em segmentos com duração quantizada ao quadro e posição na timeline final.
 * `maxDur` corta o fim (curto ≤ 60 s). As transições não sobrepõem trechos (dip/zoom dentro do
 * segmento), então a posição de cada segmento é a soma dos anteriores.
 */
export function calcularTimeline(cortes, analise, { maxDur = Infinity, fps = FPS } = {}) {
  const segmentos = [];
  let t = 0;
  for (const c of cortes) {
    if (t >= maxDur - 0.5 / fps) break;
    let seg;
    if (c.tipo === 'cartela') {
      seg = { tipo: 'cartela', texto: c.texto, subtexto: c.subtexto || '', dur: quantizar(num(c.dur) ? c.dur : 2, fps) };
    } else {
      const k = indiceClipe(c.clipe, analise);
      const clipe = analise.clipes[k];
      const fim = num(clipe.duracao) ? Math.min(c.fim, clipe.duracao) : c.fim;
      seg = { tipo: 'clipe', k, clipe, ini: c.ini, fim, dur: quantizar(fim - c.ini, fps),
        capitulo: c.capitulo || null, legenda: c.legenda, foco: c.foco || null, rotulo: c.rotulo || null,
        melhor: !!c.melhor, data: c.data || analise.data };
    }
    if (t + seg.dur > maxDur) { seg.dur = quantizar(maxDur - t, fps); if (seg.tipo === 'clipe') seg.fim = seg.ini + seg.dur; }
    if (seg.dur < 1 / fps) break;
    seg.offset = +t.toFixed(6);
    if (seg.tipo === 'clipe' && seg.capitulo === null && c.capitulo) seg.capitulo = c.capitulo;
    if (seg.tipo === 'cartela' && c.capitulo) seg.capitulo = c.capitulo;
    segmentos.push(seg);
    t = quantizar(t + seg.dur, fps);
  }
  return { segmentos, duracao: t };
}

/**
 * Capítulos do YouTube: o primeiro sempre em 00:00; trechos seguidos com o mesmo nome se juntam;
 * capítulo com menos de `minimo` s (YouTube exige 10 s) é absorvido pelo anterior.
 * Retorna { lista: [{t, nome}], texto, valido } (valido = ≥ 3 capítulos, regra do YouTube).
 */
export function calcularCapitulos(segmentos, duracao, { minimo = 10 } = {}) {
  let lista = [];
  for (const s of segmentos) {
    if (!s.capitulo) continue;
    if (lista.length && lista[lista.length - 1].nome === s.capitulo) continue;
    lista.push({ t: s.offset, nome: s.capitulo });
  }
  if (!lista.length || lista[0].t > 0.001) {
    if (lista.length && lista[0].t < minimo) lista[0].t = 0;
    else lista.unshift({ t: 0, nome: 'Abertura' });
  }
  const fins = (i) => (i + 1 < lista.length ? lista[i + 1].t : duracao);
  let mudou = true;
  while (mudou && lista.length > 1) {
    mudou = false;
    for (let i = 1; i < lista.length; i++) {
      if (fins(i) - lista[i].t < minimo) { lista.splice(i, 1); mudou = true; break; }
    }
    if (!mudou && lista.length > 1 && lista[1].t - lista[0].t < minimo) { lista.splice(1, 1); mudou = true; }
  }
  // depois de remover, nomes repetidos em sequência viram um só
  lista = lista.filter((c, i) => i === 0 || c.nome !== lista[i - 1].nome);
  const texto = lista.map((c) => `${tempoCapitulo(c.t)} ${c.nome}`).join('\n');
  return { lista, texto, valido: lista.length >= 3 };
}

// ---------------------------------------------------------------- legendas
/** Divide a fala em palavras com tempo proporcional ao tamanho de cada palavra. */
export function palavrasComTempo(fala) {
  const ws = String(fala.texto || '').trim().split(/\s+/).filter(Boolean);
  if (!ws.length) return [];
  const pesos = ws.map((w) => w.replace(/[^\p{L}\p{N}]/gu, '').length + 1);
  const soma = pesos.reduce((a, b) => a + b, 0);
  const d = fala.fim - fala.ini;
  let t = fala.ini;
  return ws.map((w, i) => { const t0 = t; t += (d * pesos[i]) / soma; return { w, t0, t1: t }; });
}

/**
 * Recorta a transcrição pelos cortes e re-mapeia os tempos para a timeline final.
 * Uma palavra entra se o meio dela estiver dentro do corte. Retorna falas [{ini, fim, texto, palavras}].
 */
export function transcricaoRecortada(segmentos) {
  const saida = [];
  for (const s of segmentos) {
    if (s.tipo !== 'clipe') continue;
    for (const f of s.clipe.falas || []) {
      if (!(f.fim > s.ini && f.ini < s.fim)) continue;
      const palavras = palavrasComTempo(f)
        .filter((p) => { const m = (p.t0 + p.t1) / 2; return m >= s.ini && m < s.fim; })
        .map((p) => ({ w: p.w, t0: s.offset + Math.max(0, p.t0 - s.ini), t1: s.offset + Math.min(s.dur, p.t1 - s.ini) }));
      if (!palavras.length) continue;
      saida.push({ ini: palavras[0].t0, fim: palavras[palavras.length - 1].t1, texto: palavras.map((p) => p.w).join(' '), palavras });
    }
  }
  return saida.sort((a, b) => a.ini - b.ini);
}

function quebrarLinhas(texto, maxChars) {
  const ws = texto.split(' ');
  if (texto.length <= maxChars) return [texto];
  // melhor ponto para 2 linhas: equilibra e prefere quebrar depois de pontuação
  let melhor = null;
  for (let i = 1; i < ws.length; i++) {
    const a = ws.slice(0, i).join(' '), b = ws.slice(i).join(' ');
    if (a.length > maxChars || b.length > maxChars) continue;
    let custo = Math.abs(a.length - b.length) + (a.length > b.length ? 3 : 0) - (/[.,!?:;]$/.test(ws[i - 1]) ? 8 : 0);
    if (/^(o|a|os|as|um|uma|de|do|da|no|na)$/i.test(ws[i - 1])) custo += 20;
    if (!melhor || custo < melhor.custo) melhor = { custo, linhas: [a, b] };
  }
  return melhor ? melhor.linhas : [texto];
}

/**
 * Blocos de legenda .srt (≤ maxChars por linha, ≤ 2 linhas, ≤ maxDur s, mínimo minDur s sem invadir o próximo).
 */
export function blocosSrt(falas, { maxChars = 42, maxDur = 7, minDur = 1, gap = 0.08 } = {}) {
  const blocos = [];
  for (const f of falas) {
    let atual = [];
    const fechar = () => {
      if (!atual.length) return;
      blocos.push({ ini: atual[0].t0, fim: atual[atual.length - 1].t1, texto: atual.map((p) => p.w).join(' ') });
      atual = [];
    };
    for (const p of f.palavras) {
      const texto = [...atual, p].map((x) => x.w).join(' ');
      const cabe = quebrarLinhas(texto, maxChars).every((l) => l.length <= maxChars) && quebrarLinhas(texto, maxChars).length <= 2;
      if (atual.length && (!cabe || p.t1 - atual[0].t0 > maxDur)) fechar();
      atual.push(p);
      if (/[.!?]$/.test(p.w) && atual.length >= 3) fechar();
    }
    fechar();
  }
  for (let i = 0; i < blocos.length; i++) {
    const b = blocos[i];
    const limite = i + 1 < blocos.length ? blocos[i + 1].ini - gap : Infinity;
    if (b.fim - b.ini < minDur) b.fim = Math.min(b.ini + minDur, limite);
    if (b.fim > limite) b.fim = limite;
    b.linhas = quebrarLinhas(b.texto, maxChars);
  }
  return blocos.filter((b) => b.fim > b.ini);
}

export function gerarSrt(blocos) {
  return blocos.map((b, i) => `${i + 1}\n${tempoSrt(b.ini)} --> ${tempoSrt(b.fim)}\n${(b.linhas || [b.texto]).join('\n')}\n`).join('\n');
}

/** Blocos de 2–4 palavras para a legenda dinâmica do curto (quebra em pontuação e pausas). */
export function blocosDinamicos(falas, { min = 2, max = 4, maxChars = 22 } = {}) {
  const blocos = [];
  for (const f of falas) {
    let atual = [];
    const fechar = () => { if (atual.length) blocos.push({ ini: atual[0].t0, fim: atual[atual.length - 1].t1, palavras: atual }); atual = []; };
    f.palavras.forEach((p, i) => {
      const prox = f.palavras[i + 1];
      atual.push(p);
      const chars = atual.map((x) => x.w).join(' ').length;
      const pausa = prox && prox.t0 - p.t1 > 0.25;
      if (atual.length >= max || (atual.length >= min && (/[.,!?;:]$/.test(p.w) || pausa || chars >= maxChars))) fechar();
    });
    // bloco final com 1 palavra junta no anterior se couber
    if (atual.length === 1 && blocos.length && blocos[blocos.length - 1].palavras.length < max && blocos[blocos.length - 1].fim > atual[0].t0 - 0.3) {
      const b = blocos[blocos.length - 1]; b.palavras.push(atual[0]); b.fim = atual[0].t1; atual = [];
    }
    fechar();
  }
  return blocos;
}

// ---------------------------------------------------------------- enquadramento
/** Dimensões depois de aplicar a rotação do celular (90/270 trocam largura e altura). */
export function dimensoesEfetivas(clipe) {
  const r = ((Math.round(Number(clipe.rotacao) || 0) % 360) + 360) % 360;
  const w = clipe.largura || 1920, h = clipe.altura || 1080;
  return r === 90 || r === 270 ? { w: h, h: w } : { w, h };
}

/**
 * Filtro de enquadramento para o alvo (16:9 ou 9:16). Entrada [entrada], saída [saida].
 * Retorna { modo, filtro }. modo: escala | recorte | fundo.
 * - alvo 16:9: horizontal → escala+recorte; vertical/quadrado → fundo desfocado.
 * - alvo 9:16: vertical → só escala; horizontal → recorte no foco (centro/esquerda/direita/rosto com
 *   rostoX 0..1); "fundo"/"desfocado" ou panorâmico (> 2:1) → fundo desfocado.
 */
export function filtroEnquadramento(clipe, alvo, foco = 'centro', { rostoX = null, entrada = 'vin', saida = 'vq' } = {}) {
  const { w, h } = dimensoesEfetivas(clipe);
  const asp = w / h, aspAlvo = alvo.w / alvo.h;
  const W = alvo.w, H = alvo.h;
  const cheio = `[${entrada}]scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H},setsar=1[${saida}]`;
  const fundo = () => {
    const bw = Math.round(W / 4 / 2) * 2, bh = Math.round(H / 4 / 2) * 2;
    return `[${entrada}]split=2[${saida}b][${saida}f];` +
      `[${saida}b]scale=${bw}:${bh}:force_original_aspect_ratio=increase,crop=${bw}:${bh},boxblur=10:2,eq=brightness=-0.10:saturation=1.2,scale=${W}:${H}[${saida}bg];` +
      `[${saida}f]scale=${W}:${H}:force_original_aspect_ratio=decrease:flags=lanczos[${saida}fg];` +
      `[${saida}bg][${saida}fg]overlay=(W-w)/2:(H-h)/2,setsar=1[${saida}]`;
  };
  if (Math.abs(asp - aspAlvo) < 0.06) return { modo: 'escala', filtro: `[${entrada}]scale=${W}:${H}:flags=lanczos,setsar=1[${saida}]` };
  if (aspAlvo > 1) {
    // 16:9: horizontal parecido (4:3 até 21:9) preenche; vertical/quadrado → fundo desfocado
    return asp >= 1.3 ? { modo: 'recorte', filtro: cheio } : { modo: 'fundo', filtro: fundo() };
  }
  // 9:16
  if (asp <= aspAlvo + 0.06) return { modo: 'escala', filtro: cheio };
  if (foco === 'fundo' || foco === 'desfocado' || asp > 2.05) return { modo: 'fundo', filtro: fundo() };
  const pos = { esquerda: 0.18, direita: 0.82, centro: 0.5 };
  let fx = foco === 'rosto' && rostoX !== null ? rostoX : (pos[foco] ?? 0.5);
  // fx é o centro desejado (0..1 da largura); converte para x do recorte com limites
  const cw = `ih*${W}/${H}`;
  const x = `max(0,min(iw-${cw},iw*${fx.toFixed(3)}-${cw}/2))`;
  return { modo: 'recorte', filtro: `[${entrada}]crop=${cw}:ih:${x}:0,scale=${W}:${H}:flags=lanczos,setsar=1[${saida}]` };
}

// ---------------------------------------------------------------- ASS
export function cabecalhoAss(W, H, estilos) {
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${estilos.join('\n')}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
}

export function estiloAss(nome, fonte, tam, { cor = '#FFFFFF', contorno = '#000000', borda = 4, sombra = 2, alin = 2, mv = 60, ml = 60, mr = 60, caixa = false, fundo = '#000000', alfaFundo = 96 } = {}) {
  return `Style: ${nome},${fonte.nome},${tam},${corAss(cor)},${corAss(cor)},${corAss(caixa ? fundo : contorno, caixa ? alfaFundo : 0)},${corAss(caixa ? fundo : '#000000', caixa ? alfaFundo : 128)},${fonte.negrito ? -1 : 0},0,0,0,100,100,0,0,${caixa ? 3 : 1},${borda},${sombra},${alin},${ml},${mr},${mv},1`;
}

export const eventoAss = (ini, fim, estilo, texto, camada = 0) =>
  `Dialogue: ${camada},${tempoAss(ini)},${tempoAss(fim)},${estilo},,0,0,0,,${texto}`;
