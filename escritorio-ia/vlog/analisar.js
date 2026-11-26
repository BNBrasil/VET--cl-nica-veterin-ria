#!/usr/bin/env node
// Análise dos cortes brutos do vlog: separa por data, "vê" e "ouve" cada clipe e grava, por data,
// vlog/trabalho/<data>/analise.json (formato do vlog/CONTRATO.md, seção 2) + folhas/ + quadros/ +
// transcricao.srt + transcricao.txt. Só LÊ a pasta dos brutos; nada lá é alterado.
//
//   node vlog/analisar.js [--brutos <pasta>] [--data AAAA-MM-DD] [--modelo small|medium] [--sem-transcricao]
//                         [--paralelo N] [--refazer] [--cpu] [--rapido]
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, renameSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PASTA_BRUTOS, PASTA_TRABALHO, exigirFfmpeg, ErroFerramenta } from './lib/externos.js';
import { descobrirData, tagsDoProbe, agruparPorData } from './lib/datas.js';
import { ehVideo, pastaIgnorada, probe, resumirProbe, analisarSinais } from './lib/midia.js';
import { gerarFolha } from './lib/folhas.js';
import { transcreverDia, whisperDisponivel, srtDoDia, textoDoDia } from './lib/transcrever.js';

const VERSAO_CACHE = 3;

export function lerArgs(argv) {
  const o = { brutos: null, data: null, modelo: null, semTranscricao: false, paralelo: null, refazer: false, cpu: false, rapido: false, trabalho: null, silencioso: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const prox = () => {
      const v = argv[++i];
      if (v == null) throw new Error(`faltou o valor de ${a}`);
      return v;
    };
    if (a === '--brutos') o.brutos = prox();
    else if (a === '--data') o.data = prox();
    else if (a === '--modelo') o.modelo = prox();
    else if (a === '--sem-transcricao') o.semTranscricao = true;
    else if (a === '--paralelo') o.paralelo = Math.max(1, parseInt(prox(), 10) || 1);
    else if (a === '--refazer') o.refazer = true;
    else if (a === '--cpu') o.cpu = true;
    else if (a === '--rapido') o.rapido = true;
    else if (a === '--trabalho') o.trabalho = prox();
    else if (a === '--silencioso') o.silencioso = true;
    else if (a === '-h' || a === '--help') o.ajuda = true;
    else throw new Error(`opção desconhecida: ${a}`);
  }
  if (o.data && !/^\d{4}-\d{2}-\d{2}$/.test(o.data)) throw new Error('--data deve ser AAAA-MM-DD');
  if (o.modelo && !/^(tiny|base|small|medium|large-v3(-turbo)?)$/.test(o.modelo)) throw new Error('--modelo: small ou medium');
  return o;
}

/** Lista recursiva dos vídeos (ignora arquivos de sistema e as pastas do próprio escritório). */
export function varrer(raiz, { ignorar = [] } = {}) {
  const lista = [];
  const ign = ignorar.map((p) => path.resolve(p));
  const visitar = (dir) => {
    let ents;
    try { ents = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (pastaIgnorada(e.name) || ign.includes(path.resolve(abs))) continue;
        visitar(abs);
      } else if (e.isFile() && ehVideo(e.name)) {
        const st = statSync(abs);
        if (st.size < 1024) continue;
        lista.push({ abs, rel: path.relative(raiz, abs), nome: e.name, tamanho: st.size, mtimeMs: Math.round(st.mtimeMs) });
      }
    }
  };
  visitar(raiz);
  return lista;
}

/** Nome-base único por dia para folhas e quadros (dois "VID_0001.mp4" de pastas diferentes não colidem). */
export function stemsUnicos(clipes) {
  const usados = new Set();
  return clipes.map((c) => {
    const base = path.parse(c.nome).name.replace(/[^\p{L}\p{N}_.-]+/gu, '_').slice(0, 80) || 'clipe';
    let s = base;
    for (let k = 2; usados.has(s.toLowerCase()); k++) s = `${base}-${k}`;
    usados.add(s.toLowerCase());
    return s;
  });
}

async function emParalelo(itens, n, fn) {
  let i = 0;
  const trabalhadores = Array.from({ length: Math.min(n, itens.length) }, async () => {
    while (i < itens.length) {
      const k = i++;
      await fn(itens[k], k);
    }
  });
  await Promise.all(trabalhadores);
}

const mmss = (s) => {
  s = Math.round(s || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}h${String(m).padStart(2, '0')}m${ss}s` : `${m}:${ss}`;
};
const barraW = (p) => p.split(path.sep).join('/');

function lerCache(arq) {
  try {
    const c = JSON.parse(readFileSync(arq, 'utf8'));
    return c.versao === VERSAO_CACHE ? c : null;
  } catch { return null; }
}
function gravarJson(arq, obj) {
  mkdirSync(path.dirname(arq), { recursive: true });
  const tmp = arq + '.tmp';
  writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n');
  renameSync(tmp, arq);
}

export async function analisar(op) {
  const log = op.silencioso ? () => {} : (...a) => console.log(...a);
  const t0 = Date.now();
  const { ffmpeg, ffprobe } = exigirFfmpeg();
  const brutos = path.resolve(op.brutos || process.env.VLOG_BRUTOS || PASTA_BRUTOS);
  const trabalho = path.resolve(op.trabalho || process.env.VLOG_TRABALHO || PASTA_TRABALHO);
  if (!existsSync(brutos)) throw new ErroFerramenta(`pasta dos brutos não existe: ${brutos}\nCrie e jogue os vídeos lá (ou use --brutos <pasta>).`);
  const pastaCache = path.join(trabalho, '.cache');
  mkdirSync(pastaCache, { recursive: true });
  const ncpu = os.cpus().length;
  const paralelo = op.paralelo || Math.max(1, Math.min(4, Math.floor(ncpu / 4)));
  const threadsFfmpeg = Math.max(2, Math.floor(ncpu / paralelo));
  const avisos = [];

  log(`Brutos: ${brutos}`);
  const arquivos = varrer(brutos, { ignorar: [trabalho, path.join(path.dirname(trabalho), 'postar'), path.join(path.dirname(trabalho), 'ferramentas')] });
  if (!arquivos.length) {
    log('Nenhum vídeo encontrado. Jogue os cortes (mp4, mov, mkv...) nessa pasta, soltos ou em subpastas.');
    return { datas: [], avisos };
  }
  log(`${arquivos.length} vídeo(s) encontrado(s). Lendo metadados...`);

  // 1) ffprobe (com cache) + data de cada arquivo
  const clipes = [];
  await emParalelo(arquivos, Math.min(8, ncpu), async (a) => {
    const chave = createHash('sha1').update(path.resolve(a.abs)).digest('hex').slice(0, 16);
    const arqCache = path.join(pastaCache, `${chave}.json`);
    let cache = op.refazer ? null : lerCache(arqCache);
    if (cache && (cache.tamanho !== a.tamanho || cache.mtimeMs !== a.mtimeMs)) cache = null;
    let info; let tags;
    if (cache?.info) ({ info, tags } = cache);
    else {
      try {
        const p = await probe(ffprobe, a.abs);
        info = resumirProbe(p);
        tags = tagsDoProbe(p);
      } catch (e) {
        avisos.push(`${a.rel}: não consegui ler (${e.message.slice(0, 120)}) — arquivo corrompido ou incompleto? Pulei.`);
        return;
      }
      cache = { versao: VERSAO_CACHE, arquivo: a.abs, tamanho: a.tamanho, mtimeMs: a.mtimeMs, info, tags };
    }
    if (!info.temVideo || !(info.duracao > 0)) {
      avisos.push(`${a.rel}: sem vídeo ou duração zero. Pulei.`);
      return;
    }
    const d = descobrirData({ caminhoRelativo: a.rel, tags, mtime: a.mtimeMs });
    clipes.push({ ...a, chave, arqCache, cache, info, data: d.data, hora: d.hora, fonteData: d.fonte, dataIncerta: d.incerta });
  });

  const grupos = agruparPorData(clipes);
  const datas = [...grupos.keys()].filter((d) => !op.data || d === op.data);
  if (op.data && !datas.length) {
    log(`Nenhum vídeo com a data ${op.data}. Datas encontradas: ${[...grupos.keys()].join(', ') || '—'}`);
    return { datas: [], avisos };
  }
  log(`Datas: ${datas.map((d) => `${d} (${grupos.get(d).length})`).join(', ')}`);

  // transcrição disponível?
  let transcrever = !op.semTranscricao;
  let disp = null;
  if (transcrever) {
    disp = whisperDisponivel(op.modelo);
    if (!disp.ok) {
      avisos.push(`Transcrição desligada: ${disp.motivo}.`);
      transcrever = false;
    }
  }
  const chaveTranscricao = disp?.ok ? `${disp.modelo}${disp.cfg.vad ? '+vad' : ''}` : null;

  const tempos = { analiseSeg: 0, transcricaoSeg: 0, videoSeg: 0, audioTranscritoSeg: 0 };
  const resultados = [];

  for (const data of datas) {
    const lista = grupos.get(data);
    const pastaDia = path.join(trabalho, data);
    mkdirSync(pastaDia, { recursive: true });
    const stems = stemsUnicos(lista);
    log(`\n== ${data}: ${lista.length} clipe(s), ${mmss(lista.reduce((s, c) => s + c.info.duracao, 0))}`);

    // 2) sinais + folha de contato, em paralelo moderado
    const tA = Date.now();
    let feitos = 0;
    await emParalelo(lista, paralelo, async (c, k) => {
      const stem = stems[k];
      const tc = Date.now();
      const cache = c.cache;
      const folhaOk = cache.folha && cache.stem === stem && cache.pastaDia === pastaDia && existsSync(path.join(pastaDia, cache.folha))
        && (cache.quadros || []).every((q) => existsSync(path.join(pastaDia, q.img)));
      let novo = false;
      if (!cache.sinais) {
        cache.sinais = await analisarSinais(ffmpeg, c.abs, c.info, { threads: threadsFfmpeg });
        novo = true;
      }
      if (!folhaOk) {
        const f = await gerarFolha(ffmpeg, c.abs, c.info, pastaDia, stem);
        Object.assign(cache, { folha: f.folha, quadros: f.quadros, stem, pastaDia });
        novo = true;
      }
      if (novo) gravarJson(c.arqCache, cache);
      feitos++;
      log(`  [${feitos}/${lista.length}] ${c.rel}  ${mmss(c.info.duracao)}  ${c.info.largura}x${c.info.altura}${c.info.rotacao ? ` rot${c.info.rotacao}` : ''}`
        + `${c.info.temAudio ? '' : '  (sem áudio)'}  ${novo ? `${((Date.now() - tc) / 1000).toFixed(1)} s` : '(cache)'}`);
    });
    tempos.analiseSeg += (Date.now() - tA) / 1000;

    // 3) transcrição (um whisper por dia, só nos clipes que ainda não têm a transcrição deste modelo)
    if (transcrever) {
      const pendentes = lista.filter((c) => c.info.temAudio && c.cache.transcricao !== chaveTranscricao);
      if (pendentes.length) {
        const segVoz = pendentes.reduce((s, c) => s + (c.cache.sinais.voz || []).reduce((a, t) => a + t.fim - t.ini, 0), 0);
        log(`  transcrevendo ${pendentes.length} clipe(s), ${mmss(segVoz)} com voz (modelo ${disp.modelo}${disp.cfg.vad ? ', VAD' : ''}, ${disp.cfg.variante})...`);
        const tT = Date.now();
        try {
          const r = await transcreverDia(ffmpeg, pendentes.map((c) => ({
            chave: c.chave, arquivo: c.abs, voz: c.cache.sinais.voz, ebur: c.cache.sinais.ebur, limiar: c.cache.sinais.voz?.[0]?.limiar,
          })), { modelo: disp.modelo, pastaTmp: path.join(trabalho, '.tmp', data), gpu: !op.cpu, rapido: op.rapido, aoLog: (m) => log(`    ${m}`) });
          for (const c of pendentes) {
            c.cache.falas = r.falas.get(c.chave) || [];
            c.cache.transcricao = chaveTranscricao;
            gravarJson(c.arqCache, c.cache);
          }
          tempos.audioTranscritoSeg += r.segundosAudio;
          log(`    ok em ${((Date.now() - tT) / 1000).toFixed(1)} s`);
        } catch (e) {
          avisos.push(`${data}: transcrição falhou (${e.message.slice(0, 200)})`);
        }
        tempos.transcricaoSeg += (Date.now() - tT) / 1000;
      }
    }

    // 4) analise.json + transcrição do dia
    const analise = {
      data,
      geradoEm: new Date().toISOString(),
      brutos: barraW(brutos),
      transcricao: transcrever ? { modelo: disp.modelo, vad: !!disp.cfg.vad, motor: `whisper.cpp ${disp.cfg.versao} (${disp.cfg.variante})` } : null,
      clipes: lista.map((c) => {
        const s = c.cache.sinais;
        const falas = (c.cache.falas || []).map((f) => ({ ini: f.ini, fim: f.fim, texto: f.texto, ...(f.palavras ? { palavras: f.palavras } : {}) }));
        return {
          arquivo: barraW(c.abs),
          nome: c.nome,
          inicioDoDia: c.hora,
          fonteData: c.fonteData,
          ...(c.dataIncerta ? { dataIncerta: true } : {}),
          duracao: c.info.duracao,
          largura: c.info.largura,
          altura: c.info.altura,
          fps: c.info.fps,
          rotacao: c.info.rotacao,
          orientacao: c.info.orientacao,
          temAudio: c.info.temAudio,
          falas,
          silencios: s.silencios,
          cenas: s.cenas,
          energia: s.energia,
          voz: (s.voz || []).map(({ ini, fim }) => ({ ini, fim })),
          tremido: s.tremido,
          folha: c.cache.folha,
          quadros: c.cache.quadros,
          ...(c.info.temAudio && transcrever && c.cache.transcricao !== chaveTranscricao ? { semTranscricao: true } : {}),
        };
      }),
    };
    const comFala = analise.clipes.reduce((s, c) => s + c.falas.reduce((a, f) => a + (f.fim - f.ini), 0), 0);
    const totalSeg = analise.clipes.reduce((s, c) => s + c.duracao, 0);
    analise.resumo = {
      totalSegundos: Math.round(totalSeg * 10) / 10,
      comFala: Math.round(comFala * 10) / 10,
      clipes: analise.clipes.length,
      falas: analise.clipes.reduce((s, c) => s + c.falas.length, 0),
      primeiro: analise.clipes[0]?.inicioDoDia || null,
      ultimo: analise.clipes.at(-1)?.inicioDoDia || null,
    };
    gravarJson(path.join(pastaDia, 'analise.json'), analise);
    writeFileSync(path.join(pastaDia, 'transcricao.srt'), srtDoDia(analise.clipes));
    writeFileSync(path.join(pastaDia, 'transcricao.txt'), textoDoDia(analise));
    tempos.videoSeg += totalSeg;

    for (const c of lista) {
      if (c.dataIncerta) avisos.push(`${c.rel}: data ${data} veio da data de modificação do arquivo (incerta). Se estiver errada, ponha o vídeo numa subpasta AAAA-MM-DD.`);
    }
    resultados.push({ data, pasta: pastaDia, clipes: lista.length, segundos: totalSeg, comFala, falas: analise.resumo.falas, analise });
  }

  // relatório
  const total = (Date.now() - t0) / 1000;
  log('\n================ RELATÓRIO ================');
  for (const r of resultados) {
    log(`${r.data}  ${String(r.clipes).padStart(3)} clipe(s)  ${mmss(r.segundos).padStart(8)} de vídeo  ${String(r.falas).padStart(3)} fala(s) (${mmss(r.comFala)} com fala)`);
    const rel = path.relative(process.cwd(), path.join(r.pasta, 'analise.json'));
    log(`            ${barraW(rel.startsWith('..') ? path.join(r.pasta, 'analise.json') : rel)}`);
  }
  const minVideo = tempos.videoSeg / 60;
  log(`Tempo: ${total.toFixed(1)} s no total  (análise ${tempos.analiseSeg.toFixed(1)} s, transcrição ${tempos.transcricaoSeg.toFixed(1)} s)`);
  if (minVideo > 0 && tempos.analiseSeg > 1) log(`       ≈ ${(tempos.analiseSeg / minVideo).toFixed(1)} s de análise por minuto de vídeo`);
  if (tempos.audioTranscritoSeg > 0) log(`       ≈ ${(tempos.transcricaoSeg / (tempos.audioTranscritoSeg / 60)).toFixed(1)} s de transcrição por minuto de fala`);
  if (avisos.length) {
    log(`\nAvisos (${avisos.length}):`);
    for (const a of avisos) log(`  - ${a}`);
  }
  log('\nPróximo passo: o editor lê transcricao.txt e olha as folhas/ de cada dia e escreve o edl.json.');
  return { datas: resultados, avisos, tempos, total };
}

const direto = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (direto) {
  let op;
  try {
    op = lerArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`[ERRO] ${e.message}`);
    process.exit(2);
  }
  if (op.ajuda) {
    console.log('uso: node vlog/analisar.js [--brutos <pasta>] [--data AAAA-MM-DD] [--modelo small|medium] [--sem-transcricao] [--paralelo N] [--refazer] [--cpu] [--rapido]');
    process.exit(0);
  }
  analisar(op).catch((e) => {
    console.error(`\n[ERRO] ${e.message}`);
    process.exit(1);
  });
}
