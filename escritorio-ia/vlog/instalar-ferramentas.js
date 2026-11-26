#!/usr/bin/env node
// Instala a transcrição local do vlog: whisper.cpp + modelo ggml (+ modelo VAD Silero) em vlog/ferramentas/.
//
//   node vlog/instalar-ferramentas.js                 (modelo small, padrão)
//   node vlog/instalar-ferramentas.js --modelo medium (melhor em português; 1,5 GB)
//   opções: --cpu (não usar a versão CUDA)  --forcar (baixa/compila de novo)  --sem-vad
//
// Windows: binário oficial do GitHub (ggml-org/whisper.cpp). Com placa NVIDIA (GTX 16xx em diante) baixa a
// variante CUDA (cuBLAS 12.4; 11.8 se o driver for antigo) e também a de CPU como reserva; testa a CUDA e,
// se falhar, usa a CPU. Linux/mac: usa whisper-cli do sistema, binário de release se houver, ou compila com cmake.
// Idempotente: o que já está baixado e conferido não é baixado de novo. No fim cria vlog/ferramentas/.pronto.
import { createHash } from 'node:crypto';
import {
  createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync,
  statSync, writeFileSync, copyFileSync, chmodSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PASTA_FERRAMENTAS as F, WIN, EXE, noPath, acharPrograma, rodar, barra } from './lib/externos.js';

const REPO = 'ggml-org/whisper.cpp';
// Última versão conferida com binários Windows publicados (usada se a API do GitHub não responder).
const VERSAO_RESERVA = 'v1.9.2';
const ASSETS_CUDA_12 = ['whisper-cublas-12.4.0-bin-x64.zip', 'whisper-bin-win-cuda-12.4.0-x64.zip'];
const ASSETS_CUDA_11 = ['whisper-cublas-11.8.0-bin-x64.zip', 'whisper-bin-win-cuda-11.8.0-x64.zip'];
const ASSETS_CPU_WIN = ['whisper-bin-x64.zip', 'whisper-bin-win-cpu-x64.zip'];
const HF_MODELO = (m) => `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${m}.bin`;
const HF_VAD = 'https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v5.1.2.bin';
const MODELOS = ['tiny', 'base', 'small', 'medium', 'large-v3-turbo', 'large-v3'];

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const tem = (n) => args.includes(n);
const MODELO = opt('--modelo') || 'small';
const FORCAR = tem('--forcar');
const SO_CPU = tem('--cpu') || tem('--sem-gpu');
const SEM_VAD = tem('--sem-vad');

const log = (...a) => console.log(...a);
const passo = (s) => log(`\n== ${s}`);

function sair(msg, code = 1) {
  console.error(`\n[ERRO] ${msg}`);
  process.exit(code);
}

// ---------------------------------------------------------------- download

const CURL = noPath('curl');

async function baixarJson(url) {
  const h = ['-H', 'Accept: application/vnd.github+json', '-H', 'User-Agent: escritorio-ia-vlog'];
  if (process.env.GITHUB_TOKEN) h.push('-H', `Authorization: Bearer ${process.env.GITHUB_TOKEN}`);
  if (CURL) {
    const r = spawnSync(CURL, ['-sS', '-L', '--fail', '--max-time', '30', ...h, url], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error((r.stderr || '').trim() || `curl ${r.status}`);
    return JSON.parse(r.stdout);
  }
  const res = await fetch(url, { headers: { 'User-Agent': 'escritorio-ia-vlog', Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Cabeçalhos do Hugging Face: tamanho e sha256 do arquivo LFS (x-linked-size / x-linked-etag). */
function infoHf(url) {
  try {
    if (CURL) {
      const r = spawnSync(CURL, ['-sS', '-I', '--max-time', '30', url], { encoding: 'utf8' });
      const h = r.stdout || '';
      const size = h.match(/^x-linked-size:\s*(\d+)/im)?.[1];
      const sha = h.match(/^x-linked-etag:\s*"?([0-9a-f]{64})"?/im)?.[1];
      return { tamanho: size ? +size : null, sha256: sha || null };
    }
  } catch { /* sem verificação remota */ }
  return { tamanho: null, sha256: null };
}

async function infoHfFetch(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'manual' });
    const size = res.headers.get('x-linked-size');
    const sha = (res.headers.get('x-linked-etag') || '').replace(/"/g, '');
    return { tamanho: size ? +size : null, sha256: /^[0-9a-f]{64}$/.test(sha) ? sha : null };
  } catch {
    return { tamanho: null, sha256: null };
  }
}

/** Baixa `url` para `destino` (com .part e retomada). Mostra progresso. */
async function baixar(url, destino, rotulo) {
  mkdirSync(path.dirname(destino), { recursive: true });
  const parte = destino + '.part';
  log(`   baixando ${rotulo || path.basename(destino)}`);
  log(`   de ${url}`);
  if (CURL) {
    const r = spawnSync(CURL, ['-L', '--fail', '--retry', '3', '--retry-delay', '2', '-C', '-', '-#', '-o', parte, url],
      { stdio: ['ignore', 'inherit', 'inherit'] });
    if (r.status !== 0) {
      // 416 = já estava completo / servidor não aceita retomada: tenta do zero
      rmSync(parte, { force: true });
      const r2 = spawnSync(CURL, ['-L', '--fail', '--retry', '3', '-#', '-o', parte, url], { stdio: ['ignore', 'inherit', 'inherit'] });
      if (r2.status !== 0) throw new Error(`falha ao baixar ${url} (curl ${r2.status})`);
    }
  } else {
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`falha ao baixar ${url} (HTTP ${res.status})`);
    const total = +res.headers.get('content-length') || 0;
    const out = createWriteStream(parte);
    let feito = 0;
    let ultimo = 0;
    for await (const chunk of res.body) {
      out.write(chunk);
      feito += chunk.length;
      if (Date.now() - ultimo > 300) {
        ultimo = Date.now();
        process.stdout.write(`\r   ${barra(total ? feito / total : 0)} ${(feito / 1048576).toFixed(0)} MB`);
      }
    }
    await new Promise((ok) => out.end(ok));
    process.stdout.write(`\r   ${barra(1)} ${(feito / 1048576).toFixed(0)} MB\n`);
  }
  renameSync(parte, destino);
}

function sha256(arquivo) {
  return new Promise((ok, falha) => {
    const h = createHash('sha256');
    const total = statSync(arquivo).size;
    let lido = 0;
    let ultimo = 0;
    createReadStream(arquivo)
      .on('data', (b) => {
        h.update(b);
        lido += b.length;
        if (total > 50e6 && Date.now() - ultimo > 400) {
          ultimo = Date.now();
          process.stdout.write(`\r   conferindo ${barra(lido / total)}`);
        }
      })
      .on('end', () => {
        if (total > 50e6) process.stdout.write(`\r   conferindo ${barra(1)}\n`);
        ok(h.digest('hex'));
      })
      .on('error', falha);
  });
}

/** Baixa um arquivo do Hugging Face e confere tamanho + sha256. Idempotente (marca .ok ao lado). */
async function baixarConferido(url, destino, rotulo) {
  let info = infoHf(url);
  if (!info.sha256 && !CURL) info = await infoHfFetch(url);
  const marca = destino + '.ok';
  if (!FORCAR && existsSync(destino) && existsSync(marca)) {
    const m = readFileSync(marca, 'utf8').trim();
    const tam = statSync(destino).size;
    if ((!info.sha256 || m === info.sha256) && (!info.tamanho || tam === info.tamanho)) {
      log(`   ${rotulo}: já baixado e conferido (${(tam / 1048576).toFixed(0)} MB)`);
      return;
    }
  }
  if (!existsSync(destino) || FORCAR || (info.tamanho && statSync(destino).size !== info.tamanho)) {
    if (FORCAR) rmSync(destino, { force: true });
    await baixar(url, destino, rotulo);
  }
  const tam = statSync(destino).size;
  if (info.tamanho && tam !== info.tamanho) {
    rmSync(destino, { force: true });
    throw new Error(`${rotulo}: tamanho errado (${tam} != ${info.tamanho}); apaguei, rode de novo`);
  }
  const h = await sha256(destino);
  if (info.sha256 && h !== info.sha256) {
    rmSync(destino, { force: true });
    throw new Error(`${rotulo}: sha256 não confere; apaguei, rode de novo`);
  }
  writeFileSync(marca, h + '\n');
  log(`   ${rotulo}: ok (${(tam / 1048576).toFixed(0)} MB, sha256 ${info.sha256 ? 'conferido' : h.slice(0, 12) + '…'})`);
}

// ---------------------------------------------------------------- GitHub releases

async function listarReleases() {
  try {
    const lista = await baixarJson(`https://api.github.com/repos/${REPO}/releases?per_page=25`);
    if (Array.isArray(lista) && lista.length) {
      return lista
        .filter((r) => !r.draft)
        .map((r) => ({ tag: r.tag_name, pre: r.prerelease, assets: (r.assets || []).map((a) => ({ nome: a.name, url: a.browser_download_url, tamanho: a.size })) }));
    }
  } catch (e) {
    log(`   (API do GitHub não respondeu: ${String(e.message).slice(0, 120)}; uso a versão conferida ${VERSAO_RESERVA})`);
  }
  const url = (n) => `https://github.com/${REPO}/releases/download/${VERSAO_RESERVA}/${n}`;
  return [{
    tag: VERSAO_RESERVA, pre: false, reserva: true,
    assets: ['whisper-cublas-12.4.0-bin-x64.zip', 'whisper-cublas-11.8.0-bin-x64.zip', 'whisper-bin-x64.zip']
      .map((n) => ({ nome: n, url: url(n) })),
  }];
}

/** Primeiro asset (da release mais nova, estáveis antes de pré-releases) cujo nome esteja em `nomes`. */
export function escolherAsset(releases, nomes) {
  const ordem = [...releases.filter((r) => !r.pre), ...releases.filter((r) => r.pre)];
  for (const r of ordem) {
    for (const n of nomes) {
      const a = r.assets.find((x) => x.nome.toLowerCase() === n.toLowerCase());
      if (a) return { ...a, tag: r.tag };
    }
  }
  return null;
}

// ---------------------------------------------------------------- GPU / extração / busca

function placaNvidia() {
  const smi = noPath('nvidia-smi') || (WIN ? 'C:\\Windows\\System32\\nvidia-smi.exe' : null);
  if (!smi) return null;
  const r = spawnSync(smi, ['--query-gpu=name,driver_version,memory.total', '--format=csv,noheader'], { encoding: 'utf8' });
  if (r.status !== 0 || !r.stdout) return null;
  const [nome, driver, mem] = r.stdout.split(/\r?\n/)[0].split(',').map((s) => s.trim());
  return { nome, driver, mem };
}

function extrair(arquivo, destino) {
  rmSync(destino, { recursive: true, force: true });
  mkdirSync(destino, { recursive: true });
  const zip = arquivo.toLowerCase().endsWith('.zip');
  // Windows 10+ traz o bsdtar (tar.exe) que abre .zip; senão, PowerShell; Linux: unzip/tar.
  let r = spawnSync('tar', ['-xf', arquivo, '-C', destino], { stdio: 'inherit' });
  if (r.status !== 0 && zip && WIN) {
    r = spawnSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${arquivo}' -DestinationPath '${destino}' -Force`], { stdio: 'inherit' });
  }
  if (r.status !== 0 && zip && noPath('unzip')) r = spawnSync('unzip', ['-q', '-o', arquivo, '-d', destino], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`não consegui extrair ${path.basename(arquivo)}`);
}

function acharArquivo(pasta, nomes) {
  if (!existsSync(pasta)) return null;
  for (const e of readdirSync(pasta, { withFileTypes: true })) {
    const p = path.join(pasta, e.name);
    if (e.isFile() && nomes.includes(e.name)) return p;
  }
  for (const e of readdirSync(pasta, { withFileTypes: true })) {
    if (e.isDirectory()) {
      const achado = acharArquivo(path.join(pasta, e.name), nomes);
      if (achado) return achado;
    }
  }
  return null;
}

const NOMES_CLI = WIN ? ['whisper-cli.exe', 'main.exe'] : ['whisper-cli', 'main'];

function versaoDe(bin) {
  const r = spawnSync(bin, ['--help'], { encoding: 'utf8' });
  const txt = (r.stdout || '') + (r.stderr || '');
  return { ok: r.status === 0 || /usage:/i.test(txt), vad: /--vad\b/.test(txt), ajuda: txt };
}

async function instalarZipWindows(asset, subpasta) {
  const dest = path.join(F, subpasta);
  const marca = path.join(dest, '.asset');
  if (!FORCAR && existsSync(marca) && readFileSync(marca, 'utf8').trim() === `${asset.tag}/${asset.nome}`) {
    const cli = acharArquivo(dest, NOMES_CLI);
    if (cli) {
      log(`   ${asset.nome} (${asset.tag}): já instalado`);
      return cli;
    }
  }
  const zip = path.join(F, 'downloads', `${asset.tag}-${asset.nome}`);
  if (!existsSync(zip) || FORCAR || (asset.tamanho && statSync(zip).size !== asset.tamanho)) {
    rmSync(zip, { force: true });
    await baixar(asset.url, zip, `${asset.nome} (${asset.tag}${asset.tamanho ? `, ${(asset.tamanho / 1048576).toFixed(0)} MB` : ''})`);
  }
  if (asset.tamanho && statSync(zip).size !== asset.tamanho) throw new Error(`${asset.nome}: download incompleto`);
  log(`   extraindo ${asset.nome}...`);
  extrair(zip, dest);
  const cli = acharArquivo(dest, NOMES_CLI);
  if (!cli) throw new Error(`${asset.nome} não tem whisper-cli.exe`);
  writeFileSync(marca, `${asset.tag}/${asset.nome}\n`);
  rmSync(zip, { force: true }); // libera espaço (o zip CUDA tem ~450 MB)
  return cli;
}

async function instalarWindows(releases) {
  const gpu = SO_CPU ? null : placaNvidia();
  const r = { bin: null, binCpu: null, variante: 'cpu', versao: null, gpu };
  const cpu = escolherAsset(releases, ASSETS_CPU_WIN);
  if (!cpu) throw new Error('não achei o binário Windows do whisper.cpp nas releases');
  r.binCpu = await instalarZipWindows(cpu, 'whisper-cpu');
  r.bin = r.binCpu;
  r.versao = cpu.tag;
  if (gpu) {
    log(`   placa NVIDIA: ${gpu.nome} (driver ${gpu.driver}, ${gpu.mem})`);
    // CUDA 12 precisa de driver >= 528 no Windows; driver mais antigo => CUDA 11.8.
    const drv = parseFloat(gpu.driver) || 0;
    const nomes = drv >= 528 ? [...ASSETS_CUDA_12, ...ASSETS_CUDA_11] : ASSETS_CUDA_11;
    const cuda = escolherAsset(releases, nomes);
    if (cuda) {
      try {
        r.bin = await instalarZipWindows(cuda, 'whisper-cuda');
        r.variante = /11\.8/.test(cuda.nome) ? 'cuda-11.8' : 'cuda-12.4';
        r.versao = cuda.tag;
      } catch (e) {
        log(`   [aviso] versão CUDA falhou (${e.message}); fico com a de CPU`);
      }
    }
  } else if (!SO_CPU) {
    log('   nenhuma placa NVIDIA detectada (nvidia-smi): versão de CPU');
  }
  return r;
}

// ---------------------------------------------------------------- Linux / mac

function tagMaisNova(releases) {
  const est = releases.find((x) => !x.pre && !x.reserva);
  if (est) return est.tag;
  if (noPath('git')) {
    const r = spawnSync('git', ['ls-remote', '--tags', `https://github.com/${REPO}`], { encoding: 'utf8' });
    const tags = (r.stdout || '').split('\n').map((l) => l.split('refs/tags/')[1]).filter((t) => t && /^v\d+\.\d+\.\d+$/.test(t));
    tags.sort((a, b) => {
      const pa = a.slice(1).split('.').map(Number); const pb = b.slice(1).split('.').map(Number);
      return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2];
    });
    if (tags.length) return tags.at(-1);
  }
  return VERSAO_RESERVA;
}

async function compilar(releases) {
  const tag = tagMaisNova(releases);
  const dest = path.join(F, 'whisper');
  const binDest = path.join(dest, 'whisper-cli' + EXE);
  const marca = path.join(dest, '.versao');
  if (!FORCAR && existsSync(binDest) && existsSync(marca) && readFileSync(marca, 'utf8').trim().startsWith(tag)) {
    log(`   whisper-cli ${tag}: já compilado`);
    return { bin: binDest, versao: tag, variante: readFileSync(marca, 'utf8').trim().split(' ')[1] || 'cpu' };
  }
  if (!noPath('cmake') || !(noPath('c++') || noPath('g++') || noPath('clang++'))) {
    throw new Error('para compilar o whisper.cpp instale cmake e um compilador C++ (Linux: sudo apt install build-essential cmake; mac: xcode-select --install && brew install cmake) ou instale pelo gerenciador (mac: brew install whisper-cpp)');
  }
  const src = path.join(F, 'src', `whisper.cpp-${tag.replace(/^v/, '')}`);
  if (!existsSync(path.join(src, 'CMakeLists.txt'))) {
    mkdirSync(path.join(F, 'src'), { recursive: true });
    const tgz = path.join(F, 'downloads', `whisper.cpp-${tag}.tar.gz`);
    let ok = false;
    try {
      await baixar(`https://github.com/${REPO}/archive/refs/tags/${tag}.tar.gz`, tgz, `código-fonte ${tag}`);
      const r = spawnSync('tar', ['-xzf', tgz, '-C', path.join(F, 'src')], { stdio: 'inherit' });
      ok = r.status === 0 && existsSync(path.join(src, 'CMakeLists.txt'));
      rmSync(tgz, { force: true });
    } catch (e) {
      log(`   (tarball indisponível: ${e.message}; tento git clone)`);
    }
    if (!ok) {
      if (!noPath('git')) throw new Error('não consegui baixar o código do whisper.cpp (sem git)');
      rmSync(src, { recursive: true, force: true });
      const r = spawnSync('git', ['-c', 'advice.detachedHead=false', 'clone', '-q', '--depth', '1', '--branch', tag, `https://github.com/${REPO}`, src], { stdio: 'inherit' });
      if (r.status !== 0) throw new Error('git clone do whisper.cpp falhou');
    }
  }
  const gpu = SO_CPU ? null : placaNvidia();
  const cuda = gpu && noPath('nvcc');
  const build = path.join(src, 'build');
  const cfg = ['-S', src, '-B', build, '-DCMAKE_BUILD_TYPE=Release', '-DBUILD_SHARED_LIBS=OFF',
    '-DWHISPER_BUILD_TESTS=OFF', '-DWHISPER_SDL2=OFF', '-DWHISPER_BUILD_SERVER=OFF'];
  if (cuda) cfg.push('-DGGML_CUDA=ON');
  log(`   compilando whisper.cpp ${tag} (${cuda ? 'CUDA' : process.platform === 'darwin' ? 'Metal' : 'CPU'})... alguns minutos`);
  let r = spawnSync('cmake', cfg, { stdio: ['ignore', 'ignore', 'inherit'] });
  if (r.status !== 0) throw new Error('cmake (configurar) falhou');
  const jobs = String(Math.max(1, os.cpus().length));
  r = spawnSync('cmake', ['--build', build, '--config', 'Release', '-j', jobs, '--target', 'whisper-cli'], { stdio: ['ignore', 'ignore', 'inherit'] });
  if (r.status !== 0) throw new Error('compilação do whisper.cpp falhou');
  const bin = acharArquivo(path.join(build, 'bin'), NOMES_CLI);
  if (!bin) throw new Error('compilou mas não achei build/bin/whisper-cli');
  mkdirSync(dest, { recursive: true });
  copyFileSync(bin, binDest);
  chmodSync(binDest, 0o755);
  const variante = cuda ? 'cuda' : process.platform === 'darwin' ? 'metal' : 'cpu';
  writeFileSync(marca, `${tag} ${variante}\n`);
  return { bin: binDest, versao: tag, variante };
}

async function instalarUnix(releases) {
  // 1. binário de release (Linux x64), se a versão publicar
  if (process.platform === 'linux' && process.arch === 'x64') {
    const a = escolherAsset(releases, ['whisper-bin-ubuntu-x64.tar.gz', 'whisper-bin-linux-x64.tar.gz']);
    if (a) {
      const dest = path.join(F, 'whisper-bin');
      const marca = path.join(dest, '.asset');
      let cli = existsSync(marca) && readFileSync(marca, 'utf8').trim() === `${a.tag}/${a.nome}` ? acharArquivo(dest, NOMES_CLI) : null;
      if (!cli || FORCAR) {
        const tgz = path.join(F, 'downloads', a.nome);
        await baixar(a.url, tgz, `${a.nome} (${a.tag})`);
        extrair(tgz, dest);
        rmSync(tgz, { force: true });
        cli = acharArquivo(dest, NOMES_CLI);
        if (cli) writeFileSync(marca, `${a.tag}/${a.nome}\n`);
      }
      if (cli && versaoDe(cli).ok) return { bin: cli, versao: a.tag, variante: 'cpu' };
      log('   (binário de release não rodou aqui; vou compilar)');
    }
  }
  // 2. compila
  try {
    return await compilar(releases);
  } catch (e) {
    // 3. whisper-cli já instalado no sistema (brew install whisper-cpp, pacote da distro)
    const sis = noPath('whisper-cli');
    if (sis && versaoDe(sis).ok) {
      log(`   [aviso] ${e.message}\n   usando o whisper-cli do sistema: ${sis}`);
      return { bin: sis, versao: 'sistema', variante: 'sistema' };
    }
    throw e;
  }
}

// ---------------------------------------------------------------- teste rápido

async function testar(bin, modelo, { gpu }) {
  const ffmpeg = acharPrograma('ffmpeg');
  if (!ffmpeg) return { ok: versaoDe(bin).ok, gpuUsada: null, obs: 'sem ffmpeg: só conferi que o programa abre' };
  const wav = path.join(F, 'teste.wav');
  await rodar(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
    '-ar', '16000', '-ac', '1', wav]);
  const a = ['-m', modelo, '-f', wav, '-l', 'pt', '-np', '-nt', '-nf', '-bs', '1', '-bo', '1', '-t', String(Math.min(4, os.cpus().length))];
  if (!gpu) a.push('-ng');
  const t0 = Date.now();
  const r = await rodar(bin, a, { ignorarErro: true, timeout: 180000 });
  rmSync(wav, { force: true });
  const txt = r.stderr + r.stdout;
  const gpuUsada = /CUDA0|ggml_cuda_init: found [1-9]|using CUDA|Metal|MTL0/i.test(txt) && !/no CUDA devices|failed to initialize CUDA/i.test(txt);
  return { ok: r.code === 0, gpuUsada, segundos: (Date.now() - t0) / 1000, saida: txt.split(/\r?\n/).filter(Boolean).slice(-3).join(' | ') };
}

// ---------------------------------------------------------------- principal

async function main() {
  if (!MODELOS.includes(MODELO)) sair(`modelo desconhecido: ${MODELO} (use ${MODELOS.join(', ')})`);
  mkdirSync(F, { recursive: true });
  log(`Instalando a transcrição do vlog em ${F}`);
  const cfgArq = path.join(F, 'whisper.json');
  const antigo = existsSync(cfgArq) ? JSON.parse(readFileSync(cfgArq, 'utf8')) : {};
  const rel = (p) => (p && p.startsWith(F) ? path.relative(F, p).split(path.sep).join('/') : p);
  const abs = (p) => (p && !path.isAbsolute(p) ? path.join(F, p) : p);

  passo('1/4 whisper.cpp');
  let w;
  const binAntigo = abs(antigo.bin);
  if (!FORCAR && binAntigo && existsSync(binAntigo) && versaoDe(binAntigo).ok && (!SO_CPU || !/cuda/.test(antigo.variante || ''))) {
    log(`   já instalado: ${antigo.versao} (${antigo.variante}) ${binAntigo}`);
    w = { bin: binAntigo, binCpu: abs(antigo.binCpu), versao: antigo.versao, variante: antigo.variante, gpu: antigo.gpu };
  } else {
    const releases = await listarReleases();
    w = WIN ? await instalarWindows(releases) : await instalarUnix(releases);
  }
  const v = versaoDe(w.bin);
  if (!v.ok) sair(`o whisper-cli não abre: ${w.bin}\n${v.ajuda.slice(0, 400)}`);
  log(`   whisper-cli: ${w.bin} (${w.versao}, ${w.variante})`);

  passo(`2/4 modelo ${MODELO}`);
  const modelos = { ...(antigo.modelos || {}) };
  const arqModelo = path.join(F, 'modelos', `ggml-${MODELO}.bin`);
  await baixarConferido(HF_MODELO(MODELO), arqModelo, `ggml-${MODELO}.bin`);
  modelos[MODELO] = rel(arqModelo);
  for (const [k, p] of Object.entries(modelos)) if (!existsSync(abs(p))) delete modelos[k];

  passo('3/4 detector de voz (VAD Silero)');
  let vad = null;
  if (SEM_VAD) log('   pulado (--sem-vad)');
  else if (!v.vad) log('   esta versão do whisper-cli não tem --vad; a análise usa só o limiar de volume');
  else {
    const arq = path.join(F, 'modelos', 'ggml-silero-v5.1.2.bin');
    try {
      await baixarConferido(HF_VAD, arq, 'ggml-silero-v5.1.2.bin');
      vad = rel(arq);
    } catch (e) {
      log(`   [aviso] VAD não instalado (${e.message}); segue sem`);
    }
  }

  passo('4/4 teste rápido');
  let usarGpu = /cuda|metal/.test(w.variante || '');
  let t = await testar(w.bin, arqModelo, { gpu: usarGpu });
  if (!t.ok && w.binCpu && w.binCpu !== w.bin) {
    log(`   [aviso] a versão ${w.variante} falhou aqui (${t.saida}); passo a usar a de CPU`);
    w.bin = w.binCpu;
    w.variante = 'cpu';
    usarGpu = false;
    t = await testar(w.bin, arqModelo, { gpu: false });
  }
  if (!t.ok) sair(`o teste do whisper falhou: ${t.saida}`);
  if (usarGpu && t.gpuUsada === false) log('   [aviso] a placa de vídeo não foi usada no teste; vai rodar na CPU (mais lento, mas funciona)');
  log(`   ok${t.segundos ? ` em ${t.segundos.toFixed(1)} s` : ''}${t.gpuUsada ? ' (usando a placa de vídeo)' : ''}${t.obs ? ` (${t.obs})` : ''}`);

  const cfg = {
    versao: w.versao, variante: w.variante, gpu: w.gpu || null, gpuUsada: !!t.gpuUsada,
    bin: rel(w.bin), binCpu: rel(w.binCpu || null), vad, modelos,
    // --modelo explícito vira o padrão da análise; sem ele, mantém o que já estava escolhido
    modeloPadrao: opt('--modelo') || (antigo.modeloPadrao && modelos[antigo.modeloPadrao] ? antigo.modeloPadrao : MODELO),
    instaladoEm: new Date().toISOString(),
  };
  writeFileSync(cfgArq, JSON.stringify(cfg, null, 2) + '\n');
  writeFileSync(path.join(F, '.pronto'), `${cfg.versao} ${cfg.variante} ${Object.keys(modelos).join(',')}\n`);
  log(`\nPronto. Transcrição local instalada (${cfg.versao}, ${cfg.variante}, modelos: ${Object.keys(modelos).join(', ')}).`);
  log('Agora: node vlog/analisar.js');
}

const direto = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (direto) main().catch((e) => sair(e.message));
