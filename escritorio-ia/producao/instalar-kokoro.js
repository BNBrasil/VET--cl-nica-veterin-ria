#!/usr/bin/env node
// Instala as vozes Kokoro (grátis, offline, licença Apache 2.0) em producao/voz/kokoro/:
// um ambiente Python próprio (venv) com kokoro-onnx + o modelo (~325 MB) e as vozes (~28 MB).
// Vozes pt-BR escolhidas pelo usuário: pm_alex (padrão), pm_santa, pf_dora.
// Idempotente. Uso: node producao/instalar-kokoro.js
import { spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';
import { PASTA_VOZ, WIN } from './lib/ferramentas.js';

export const PASTA_KOKORO = path.join(PASTA_VOZ, 'kokoro');
const RELEASE = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/';
const ARQUIVOS = [
  { nome: 'kokoro-v1.0.onnx', minimo: 300_000_000 },
  { nome: 'voices-v1.0.bin', minimo: 25_000_000 },
];
const PACOTES = ['kokoro-onnx==0.6.1', 'soundfile'];

export function pythonDoVenv() {
  return path.join(PASTA_KOKORO, 'venv', WIN ? 'Scripts' : 'bin', WIN ? 'python.exe' : 'python');
}

function rodar(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: opts.quieto ? 'pipe' : 'inherit', windowsHide: true, ...opts });
  return r.status === 0;
}

function acharPythonDoSistema() {
  const candidatos = WIN ? [['py', ['-3']], ['python', []], ['python3', []]] : [['python3', []], ['python', []]];
  for (const [cmd, pre] of candidatos) {
    const r = spawnSync(cmd, [...pre, '-c', 'import sys; print(sys.version_info[:2] >= (3, 9))'], { encoding: 'utf8', windowsHide: true });
    if (r.status === 0 && r.stdout.trim() === 'True') return { cmd, pre };
  }
  return null;
}

async function baixar(url, destino, minimo) {
  if (existsSync(destino) && statSync(destino).size >= minimo) { console.log(`  ✓ ${path.basename(destino)} (já baixado)`); return; }
  const tmp = destino + '.parcial';
  const r = await fetch(url, { redirect: 'follow' });
  if (!r.ok || !r.body) throw new Error(`download falhou (${r.status}): ${url}`);
  const total = Number(r.headers.get('content-length')) || 0;
  let feito = 0, ultimo = -1;
  const corpo = Readable.fromWeb(r.body);
  corpo.on('data', (c) => {
    feito += c.length;
    const pct = total ? Math.floor((feito / total) * 10) * 10 : 0;
    if (pct !== ultimo) { ultimo = pct; process.stdout.write(`\r  ${path.basename(destino)}: ${pct}% `); }
  });
  await pipeline(corpo, createWriteStream(tmp));
  process.stdout.write('\n');
  if (statSync(tmp).size < minimo) throw new Error(`arquivo incompleto: ${path.basename(destino)}`);
  renameSync(tmp, destino);
}

export async function instalarKokoro() {
  mkdirSync(PASTA_KOKORO, { recursive: true });
  console.log('Vozes Kokoro (grátis, offline):');
  const py = pythonDoVenv();
  if (!existsSync(py)) {
    const sis = acharPythonDoSistema();
    if (!sis) throw new Error('Python 3.9+ não encontrado. No Windows o INICIAR.bat instala; ou baixe em https://www.python.org/downloads/');
    console.log('  criando ambiente Python próprio…');
    if (!rodar(sis.cmd, [...sis.pre, '-m', 'venv', path.join(PASTA_KOKORO, 'venv')])) throw new Error('não consegui criar o venv');
  }
  console.log('  instalando kokoro-onnx…');
  if (!rodar(py, ['-m', 'pip', 'install', '--disable-pip-version-check', '-q', ...PACOTES])) throw new Error('pip install falhou (internet?)');
  for (const a of ARQUIVOS) await baixar(RELEASE + a.nome, path.join(PASTA_KOKORO, a.nome), a.minimo);

  console.log('  testando a voz pm_alex…');
  const teste = path.join(PASTA_KOKORO, 'teste.wav');
  rmSync(teste, { force: true });
  const r = spawnSync(py, ['-I', path.join(path.dirname(PASTA_VOZ), 'kokoro_tts.py'),
    path.join(PASTA_KOKORO, ARQUIVOS[0].nome), path.join(PASTA_KOKORO, ARQUIVOS[1].nome), 'pm_alex', '1.0', teste],
  { input: 'Teste da voz do canal.', windowsHide: true, encoding: 'utf8' });
  if (r.status !== 0 || !existsSync(teste)) throw new Error('teste da voz falhou: ' + (r.stderr || '').slice(-400));
  rmSync(teste, { force: true });
  writeFileSync(path.join(PASTA_KOKORO, '.pronto'), new Date().toISOString());
  console.log('  ✓ Kokoro pronto (vozes: pm_alex, pm_santa, pf_dora)');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  instalarKokoro().catch((e) => { console.error('ERRO: ' + e.message); process.exit(1); });
}
