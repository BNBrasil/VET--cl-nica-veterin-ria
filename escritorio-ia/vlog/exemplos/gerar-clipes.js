#!/usr/bin/env node
// Gera clipes sintéticos de 2 dias (testsrc2/mandelbrot/life + fala do Piper, ou tom se não houver Piper)
// para testar o render sem depender da frente ANÁLISE. Cobre os casos difíceis: celular com rotação
// (metadado 90°), vertical nativo, quadrado, 24/30/60 fps, clipe sem áudio e clipe tremido.
//
//   node vlog/exemplos/gerar-clipes.js            → vlog/exemplos/clipes/ + vlog/trabalho/<data>/{analise,edl}.json
//   node vlog/exemplos/gerar-clipes.js --saida X  → clipes e jsons em X (usado pelos testes)
//   --curto  clipes de poucos segundos e resolução menor (teste rápido)
import { existsSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ffmpeg, rodar, acharFonte, lerCanal, exigirFfmpeg, VLOG, WIN } from '../lib/render-comum.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const VOZ = path.resolve(VLOG, '..', 'producao', 'voz');

// ------------------------------------------------------------ roteiro dos clipes
const DIAS = [
  {
    data: '2025-11-24',
    clipes: [
      { nome: 'VID_20251124_093012.mp4', hora: '09:30:12', dur: 22, w: 1920, h: 1080, fps: 30, fonte: 'testsrc2', cena: 'CHEGADA',
        falas: [[1.5, 'Bom dia, gente! Acabei de chegar em Ouro Preto.'], [8, 'Olha o tamanho dessa ladeira, meu Deus.'], [14.5, 'Bora tomar um café antes de subir tudo isso.']] },
      { nome: 'VID_20251124_121530.mp4', hora: '12:15:30', dur: 16, w: 1080, h: 1920, fps: 30, fonte: 'mandelbrot', cena: 'IGREJA', rotacao: 90,
        falas: [[1, 'Essa igreja é toda decorada com ouro.'], [7, 'É o lugar mais bonito que eu já vi na vida.']] },
      { nome: 'VID_20251124_153300.mp4', hora: '15:33:00', dur: 12, w: 1280, h: 720, fps: 24, fonte: 'life', cena: 'MIRANTE', semAudio: true, falas: [] },
      { nome: 'VID_20251124_182045.mp4', hora: '18:20:45', dur: 16, w: 1920, h: 1080, fps: 60, fonte: 'testsrc2', cena: 'PÔR DO SOL', tremido: true,
        falas: [[1.2, 'O pôr do sol daqui de cima é surreal.'], [8.5, 'Valeu por me acompanharem hoje, até amanhã!']] },
    ],
  },
  {
    data: '2025-11-25',
    clipes: [
      { nome: 'VID_20251125_101000.mp4', hora: '10:10:00', dur: 18, w: 1920, h: 1080, fps: 30, fonte: 'mandelbrot', cena: 'TRILHA',
        falas: [[1, 'Segundo dia! Hoje a gente vai fazer a trilha da cachoeira.'], [9, 'Já estou cansado e nem começou.']] },
      { nome: 'PXL_20251125_133000.mp4', hora: '13:30:00', dur: 14, w: 1080, h: 1920, fps: 30, fonte: 'testsrc2', cena: 'CACHOEIRA',
        falas: [[1.5, 'Chegamos! Olha essa água, que coisa linda.'], [8, 'A água está gelada demais.']] },
      { nome: 'VID_20251125_170000.mp4', hora: '17:00:00', dur: 12, w: 1080, h: 1080, fps: 30, fonte: 'life', cena: 'JANTAR',
        falas: [[1, 'Para fechar o dia, pão de queijo e doce de leite.']] },
    ],
  },
];

function piper() {
  const bin = [path.join(VOZ, 'piper', 'piper' + (WIN ? '.exe' : '')), path.join(VOZ, 'piper' + (WIN ? '.exe' : ''))].find(existsSync);
  const modelo = ['pt_BR-faber-medium', 'pt_BR-cadu-medium', 'pt_BR-jeff-medium'].find((m) => existsSync(path.join(VOZ, m + '.onnx')));
  if (!bin || !modelo) return null;
  const cfg = [path.join(VOZ, modelo + '.piper.json'), path.join(VOZ, modelo + '.onnx.json')].filter(existsSync);
  return { bin, onnx: path.join(VOZ, modelo + '.onnx'), configs: cfg };
}

async function duracao(arq) {
  const { stdout } = await rodar(exigirFfmpeg().ffprobe,
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', arq]);
  return Number(stdout.trim());
}

/** Gera a fala em wav (Piper) ou um tom pulsando com a duração estimada. Retorna a duração. */
async function fala(texto, wav, voz) {
  if (voz) {
    for (const cfg of voz.configs) {
      try {
        await rodar(voz.bin, ['--model', voz.onnx, '--config', cfg, '--output_file', wav, '--sentence_silence', '0.1'], { entrada: Buffer.from(texto + '\n', 'utf8') });
        if (existsSync(wav)) return duracao(wav);
      } catch { /* tenta a próxima config */ }
    }
  }
  const d = Math.max(1, texto.length / 14);
  await ffmpeg(['-loglevel', 'error', '-f', 'lavfi', '-i', `sine=f=210:d=${d.toFixed(2)}:sample_rate=48000`,
    '-af', 'volume=0.35*(0.5+0.5*sin(2*PI*5*t)):eval=frame', '-ac', '1', wav]);
  return d;
}

const esc = (s) => String(s).replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");

async function gerarClipe(c, pasta, voz, rapido) {
  const escala = rapido ? 0.5 : 1;
  const w = Math.round((c.w * escala) / 2) * 2, h = Math.round((c.h * escala) / 2) * 2;
  const dur = rapido ? Math.min(c.dur, 8) : c.dur;
  const fonte = acharFonte('titulo', lerCanal());
  const ff = fonte.arquivo ? `fontfile='${esc(fonte.arquivo)}':` : '';
  const src = {
    testsrc2: `testsrc2=s=${w}x${h}:r=${c.fps}:d=${dur}`,
    mandelbrot: `mandelbrot=s=${w}x${h}:r=${c.fps}:end_scale=0.02:maxiter=200,trim=duration=${dur}`,
    life: `life=s=${Math.round(w / 8)}x${Math.round(h / 8)}:r=${c.fps}:mold=10:ratio=0.2:death_color=#1a3a5a:life_color=#ffcc66,scale=${w}:${h}:flags=neighbor,trim=duration=${dur}`,
  }[c.fonte];
  const tam = Math.round(Math.min(w, h) / 9);
  let vf = `drawtext=${ff}text='${esc(c.cena)}':fontcolor=white:fontsize=${tam}:borderw=${Math.round(tam / 12)}:x=(w-tw)/2:y=h*0.42,` +
    `drawtext=${ff}text='${esc(c.hora)} · %{pts\\:hms}':fontcolor=white:fontsize=${Math.round(tam / 2.6)}:box=1:boxcolor=black@0.5:boxborderw=12:x=(w-tw)/2:y=h*0.42+${tam * 1.4}`;
  if (c.tremido) vf += `,pad=iw+40:ih+40:20:20,crop=iw-40:ih-40:20+18*sin(n*1.7)+8*sin(n*4.1):20+16*cos(n*1.3)+7*sin(n*3.3)`;
  if (c.rotacao === 90) vf += ',transpose=1'; // celular: imagem gravada deitada, com metadado de rotação

  // áudio: ambiente baixo + falas posicionadas
  const falas = [];
  const entradas = ['-f', 'lavfi', '-i', src];
  const filtrosA = [];
  if (!c.semAudio) {
    entradas.push('-f', 'lavfi', '-i', `anoisesrc=color=brown:amplitude=0.02:sample_rate=48000:d=${dur}`);
    let k = 2;
    const mix = ['[1:a]'];
    for (const [ini, texto] of c.falas) {
      if (ini >= dur - 1) continue;
      const wav = path.join(pasta, `_fala_${path.parse(c.nome).name}_${k}.wav`);
      const d = await fala(texto, wav, voz);
      const fim = Math.min(dur - 0.2, ini + d);
      falas.push({ ini: +ini.toFixed(2), fim: +fim.toFixed(2), texto });
      entradas.push('-i', wav);
      filtrosA.push(`[${k}:a]aresample=48000,volume=1.6,adelay=${Math.round(ini * 1000)}:all=1[f${k}]`);
      mix.push(`[f${k}]`);
      k++;
    }
    filtrosA.push(`${mix.join('')}amix=inputs=${mix.length}:duration=first:normalize=0,atrim=end=${dur}[a]`);
  }
  const saida = path.join(pasta, c.nome);
  const tmp = saida + '.tmp.mp4';
  const grafo = [`[0:v]${vf},format=yuv420p[v]`, ...filtrosA].join(';');
  await ffmpeg(['-loglevel', 'error', ...entradas, '-filter_complex', grafo, '-map', '[v]', ...(c.semAudio ? [] : ['-map', '[a]']),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-t', String(dur), ...(c.semAudio ? [] : ['-c:a', 'aac', '-b:a', '128k']), tmp]);
  if (c.rotacao) await ffmpeg(['-loglevel', 'error', '-display_rotation', String(c.rotacao), '-i', tmp, '-c', 'copy', saida]);
  else copyFileSync(tmp, saida);
  rmSync(tmp, { force: true });
  return {
    arquivo: saida, inicioDoDia: c.hora, duracao: dur,
    largura: c.rotacao ? h : w, altura: c.rotacao ? w : h, fps: c.fps, rotacao: c.rotacao || 0, temAudio: !c.semAudio,
    falas, silencios: [], cenas: [0], energia: [], tremido: c.tremido ? 0.85 : 0.1,
    folha: `folhas/${path.parse(c.nome).name}.jpg`, quadros: [],
  };
}

async function folha(clipe, pastaDia) {
  const arq = path.join(pastaDia, clipe.folha);
  mkdirSync(path.dirname(arq), { recursive: true });
  const n = 16;
  await ffmpeg(['-loglevel', 'error', '-i', clipe.arquivo, '-vf', `fps=${n}/${clipe.duracao},scale=320:320:force_original_aspect_ratio=decrease,pad=320:320:(ow-iw)/2:(oh-ih)/2,tile=4x4`, '-frames:v', '1', '-q:v', '4', arq]);
}

export async function gerarExemplos({ saida = null, rapido = false, log = console.log } = {}) {
  const voz = piper();
  log(voz ? `Fala sintética: Piper (${path.basename(voz.onnx)})` : 'Piper não encontrado em producao/voz/: as falas viram um tom pulsando');
  const pastaClipes = saida ? path.join(saida, 'clipes') : path.join(AQUI, 'clipes');
  const pastaTrab = saida ? path.join(saida, 'trabalho') : path.join(VLOG, 'trabalho');
  mkdirSync(pastaClipes, { recursive: true });
  const datas = [];
  for (const dia of DIAS) {
    const clipes = [];
    for (const c of dia.clipes) { log(`  gerando ${c.nome}…`); clipes.push(await gerarClipe(c, pastaClipes, voz, rapido)); }
    const pastaDia = path.join(pastaTrab, dia.data);
    mkdirSync(pastaDia, { recursive: true });
    for (const cl of clipes) await folha(cl, pastaDia);
    const analise = {
      data: dia.data, clipes,
      resumo: { totalSegundos: clipes.reduce((s, c) => s + c.duracao, 0), comFala: clipes.reduce((s, c) => s + c.falas.reduce((a, f) => a + f.fim - f.ini, 0), 0) },
    };
    writeFileSync(path.join(pastaDia, 'analise.json'), JSON.stringify(analise, null, 2));
    // edl de exemplo (o que o agente editor-vlog escreveria); no modo rápido os cortes encolhem
    let edl = JSON.parse(readFileSync(path.join(AQUI, dia.data, 'edl.json'), 'utf8'));
    if (rapido) edl = encolherEdl(edl, analise);
    writeFileSync(path.join(pastaDia, 'edl.json'), JSON.stringify(edl, null, 2));
    if (!saida) {
      // cópia de referência com caminhos relativos, versionada em vlog/exemplos/<data>/
      const ref = { ...analise, clipes: clipes.map((c) => ({ ...c, arquivo: `../clipes/${path.basename(c.arquivo)}` })) };
      writeFileSync(path.join(AQUI, dia.data, 'analise.json'), JSON.stringify(ref, null, 2));
    }
    datas.push(dia.data);
  }
  for (const arq of readdirSync(pastaClipes)) if (arq.startsWith('_fala_')) rmSync(path.join(pastaClipes, arq), { force: true });
  return { datas, pastaTrabalho: pastaTrab, pastaClipes };
}

/** Ajusta os cortes do edl para clipes encurtados (modo --curto dos testes). */
function encolherEdl(edl, analise) {
  const fix = (cortes) => cortes.map((c) => {
    const d = analise.clipes[c.clipe]?.duracao ?? 8;
    const ini = Math.min(c.ini, Math.max(0, d - 2.5));
    return { ...c, ini, fim: Math.min(c.fim, d, ini + 2.5) };
  });
  const out = JSON.parse(JSON.stringify(edl));
  if (out.longo) out.longo.cortes = fix(out.longo.cortes);
  if (out.curto) out.curto.cortes = fix(out.curto.cortes);
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const args = process.argv.slice(2);
  const saida = args.includes('--saida') ? path.resolve(args[args.indexOf('--saida') + 1]) : null;
  const t0 = Date.now();
  gerarExemplos({ saida, rapido: args.includes('--curto') }).then((r) => {
    console.log(`\nClipes em ${r.pastaClipes}`);
    console.log(`analise.json + edl.json em ${r.datas.map((d) => path.join(r.pastaTrabalho, d)).join(' e ')}`);
    console.log(`(${((Date.now() - t0) / 1000).toFixed(1)} s) Agora: node vlog/renderizar.js ${r.datas[0]}`);
  }).catch((e) => { console.error(e.message || e); process.exit(1); });
}
