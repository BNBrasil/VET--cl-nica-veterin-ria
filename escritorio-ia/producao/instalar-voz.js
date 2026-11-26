#!/usr/bin/env node
// Baixa o Piper (TTS offline e gratuito) e as vozes pt_BR para producao/voz/.
// Uso: node producao/instalar-voz.js [--forcar] [--pip]
// Idempotente: o que já está baixado e verificado não é baixado de novo.
import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync, chmodSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PASTA_VOZ, WIN, acharPiper, arquivosVoz } from './lib/ferramentas.js';

const RELEASE = 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/';
const VOZES_URL = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/';
// faber = padrão (masculina, clara); as outras para variar.
export const VOZES = ['pt_BR-faber-medium', 'pt_BR-cadu-medium', 'pt_BR-jeff-medium'];

function pacotePiper() {
  const { platform, arch } = process;
  if (platform === 'win32') return 'piper_windows_amd64.zip';
  if (platform === 'linux') {
    if (arch === 'x64') return 'piper_linux_x86_64.tar.gz';
    if (arch === 'arm64') return 'piper_linux_aarch64.tar.gz';
    if (arch === 'arm') return 'piper_linux_armv7l.tar.gz';
  }
  if (platform === 'darwin') return arch === 'arm64' ? 'piper_macos_aarch64.tar.gz' : 'piper_macos_x64.tar.gz';
  return null;
}

function mb(n) { return (n / 1048576).toFixed(1) + ' MB'; }

async function baixar(url, destino, { tamanho, md5 } = {}) {
  if (existsSync(destino) && verificar(destino, { tamanho, md5 })) {
    console.log(`  ok (já baixado): ${path.basename(destino)}`);
    return;
  }
  mkdirSync(path.dirname(destino), { recursive: true });
  const tmp = destino + '.parcial';
  console.log(`  baixando ${path.basename(destino)}...`);
  try {
    await baixarFetch(url, tmp);
  } catch (e) {
    console.log(`  (fetch falhou: ${e.message}; tentando com curl)`);
    const r = spawnSync('curl', ['-fL', '--retry', '3', '-o', tmp, url], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error(`não consegui baixar ${url}. Confira a internet e rode de novo.`);
  }
  if (!verificar(tmp, { tamanho, md5 })) {
    rmSync(tmp, { force: true });
    throw new Error(`download corrompido (${path.basename(destino)}). Rode de novo.`);
  }
  renameSync(tmp, destino);
}

async function baixarFetch(url, destino) {
  const r = await fetch(url, { redirect: 'follow' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const total = Number(r.headers.get('content-length')) || 0;
  const out = createWriteStream(destino);
  let feito = 0;
  let ultimo = 0;
  for await (const pedaco of r.body) {
    if (!out.write(pedaco)) await new Promise((ok) => out.once('drain', ok));
    feito += pedaco.length;
    const agora = Date.now();
    if (process.stdout.isTTY && agora - ultimo > 200) {
      ultimo = agora;
      const pct = total ? ` ${((feito / total) * 100).toFixed(0)}%` : '';
      process.stdout.write(`\r    ${mb(feito)}${total ? ' de ' + mb(total) : ''}${pct}   `);
    }
  }
  await new Promise((ok, erro) => out.end((e) => (e ? erro(e) : ok())));
  if (process.stdout.isTTY) process.stdout.write('\n');
  console.log(`    ${mb(feito)} baixados`);
  if (total && feito !== total) throw new Error(`download incompleto (${feito} de ${total} bytes)`);
}

function verificar(arquivo, { tamanho, md5 } = {}) {
  if (!existsSync(arquivo)) return false;
  const st = statSync(arquivo);
  if (st.size === 0) return false;
  if (tamanho && st.size !== tamanho) return false;
  if (md5) {
    const h = createHash('md5').update(readFileSync(arquivo)).digest('hex');
    if (h !== md5) return false;
  }
  return true;
}

function binarioPiper() {
  return path.join(PASTA_VOZ, 'piper', WIN ? 'piper.exe' : 'piper');
}

function piperFunciona(cmd) {
  const r = spawnSync(cmd, ['--help'], { encoding: 'utf8', windowsHide: true });
  return r.status === 0 || /usage/i.test((r.stdout || '') + (r.stderr || ''));
}

async function instalarBinario() {
  const pacote = pacotePiper();
  if (!pacote) return false;
  const arq = path.join(PASTA_VOZ, pacote);
  await baixar(RELEASE + pacote, arq);
  if (!existsSync(binarioPiper())) {
    console.log('  extraindo...');
    // tar vem no Windows 10+ (bsdtar) e abre .zip também.
    const r = spawnSync('tar', ['-xf', arq, '-C', PASTA_VOZ], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error('não consegui extrair o Piper com tar.');
  }
  if (!WIN) { try { chmodSync(binarioPiper(), 0o755); } catch { /* ignora */ } }
  if (!piperFunciona(binarioPiper())) {
    console.log('  o binário do Piper não rodou neste sistema.');
    return false;
  }
  return true;
}

function instalarPip() {
  const python = ['python3', 'python'].find((p) => spawnSync(p, ['--version']).status === 0);
  if (!python) throw new Error('sem binário do Piper para este sistema e sem Python para "pip install piper-tts".');
  const venv = path.join(PASTA_VOZ, 'venv');
  console.log('  instalando piper-tts com pip (num venv em producao/voz/venv)...');
  if (!existsSync(venv)) {
    const r = spawnSync(python, ['-m', 'venv', venv], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error('não consegui criar o venv do Python.');
  }
  const pip = path.join(venv, WIN ? 'Scripts' : 'bin', 'pip');
  const r = spawnSync(pip, ['install', '--upgrade', 'piper-tts'], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('pip install piper-tts falhou.');
  return true;
}

async function catalogoVozes() {
  try {
    const r = await fetch(VOZES_URL + 'voices.json');
    if (r.ok) return await r.json();
  } catch { /* segue sem verificação md5 */ }
  return null;
}

async function instalarVozes(catalogo) {
  const instaladas = [];
  for (const voz of VOZES) {
    const info = catalogo?.[voz];
    if (catalogo && !info) { console.log(`  voz ${voz} não existe mais no catálogo; pulando.`); continue; }
    const [, nome, qual] = voz.split('-'); // pt_BR-faber-medium
    const base = `pt/pt_BR/${nome}/${qual}/${voz}`;
    try {
      for (const ext of ['.onnx', '.onnx.json']) {
        const meta = info?.files?.[base + ext];
        await baixar(VOZES_URL + base + ext, path.join(PASTA_VOZ, voz + ext), {
          tamanho: meta?.size_bytes, md5: meta?.md5_digest,
        });
      }
      instaladas.push(voz);
    } catch (e) {
      if (voz === VOZES[0]) throw e;
      console.log(`  aviso: ${voz} falhou (${e.message}); seguindo sem ela.`);
    }
  }
  return instaladas;
}

function testarSintese(voz) {
  const p = acharPiper();
  if (!p) return false;
  const saida = path.join(PASTA_VOZ, 'teste.wav');
  const { onnx, config } = arquivosVoz(voz);
  const r = spawnSync(p.cmd, [...p.args, '--model', onnx, '--config', config, '--output_file', saida],
    { input: 'Voz instalada.', windowsHide: true });
  const ok = r.status === 0 && existsSync(saida) && statSync(saida).size > 1000;
  rmSync(saida, { force: true });
  return ok;
}

export async function instalar({ forcar = false, pip = false } = {}) {
  mkdirSync(PASTA_VOZ, { recursive: true });
  const marcador = path.join(PASTA_VOZ, '.pronto');
  if (forcar) rmSync(marcador, { force: true });
  console.log('Voz gratuita (Piper, pt-BR) → producao/voz/');

  console.log('[1/3] programa Piper');
  let temPiper = !pip && acharPiper() && piperFunciona(acharPiper().cmd);
  if (temPiper) console.log('  ok (já instalado)');
  if (!temPiper && !pip) temPiper = await instalarBinario().catch((e) => { console.log('  ' + e.message); return false; });
  if (!temPiper) temPiper = instalarPip();

  console.log('[2/3] vozes');
  const vozes = await instalarVozes(await catalogoVozes());

  console.log('[3/3] teste de síntese');
  if (!testarSintese(vozes[0])) throw new Error('o Piper não conseguiu sintetizar o teste. Rode de novo com --forcar ou --pip.');
  console.log('  ok');
  writeFileSync(marcador, JSON.stringify({ em: new Date().toISOString(), vozes }, null, 2));
  console.log(`Pronto! Vozes: ${vozes.join(', ')} (padrão: ${VOZES[0]}).`);
  return vozes;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const args = process.argv.slice(2);
  instalar({ forcar: args.includes('--forcar'), pip: args.includes('--pip') }).catch((e) => {
    console.error('\nERRO: ' + e.message);
    process.exit(1);
  });
}
