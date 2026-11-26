// Pastas do vlog, localização de programas externos (ffmpeg, ffprobe, whisper.cpp) e execução de processos.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const VLOG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PASTA_BRUTOS = path.join(VLOG, 'brutos');
export const PASTA_TRABALHO = path.join(VLOG, 'trabalho');
export const PASTA_FERRAMENTAS = path.join(VLOG, 'ferramentas');
export const WIN = process.platform === 'win32';
export const EXE = WIN ? '.exe' : '';

const cache = new Map();

export function noPath(nome) {
  const r = spawnSync(WIN ? 'where' : 'which', [nome], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  const linha = (r.stdout || '').split(/\r?\n/).find(Boolean);
  return linha ? linha.trim() : null;
}

/** ffmpeg/ffprobe: variável VLOG_FFMPEG/VLOG_FFPROBE, vlog/ferramentas/, PATH, WinGet\Links. */
export function acharPrograma(nome) {
  if (cache.has(nome)) return cache.get(nome);
  const env = process.env[`VLOG_${nome.toUpperCase()}`];
  const candidatos = [
    env,
    path.join(PASTA_FERRAMENTAS, nome + EXE),
    path.join(PASTA_FERRAMENTAS, 'ffmpeg', 'bin', nome + EXE),
  ];
  let achado = candidatos.find((c) => c && existsSync(c)) || noPath(nome);
  if (!achado) {
    const extras = [];
    if (WIN && process.env.LOCALAPPDATA) extras.push(path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Links', nome + EXE));
    if (!WIN) extras.push(`/usr/bin/${nome}`, `/usr/local/bin/${nome}`, `/opt/homebrew/bin/${nome}`);
    achado = extras.find((c) => existsSync(c)) || null;
  }
  cache.set(nome, achado);
  return achado;
}

export class ErroFerramenta extends Error {}

export function exigirFfmpeg() {
  const ffmpeg = acharPrograma('ffmpeg');
  const ffprobe = acharPrograma('ffprobe');
  if (!ffmpeg || !ffprobe) {
    throw new ErroFerramenta(
      'ffmpeg não encontrado. No Windows rode INICIAR.bat (instala pelo winget) ou: winget install Gyan.FFmpeg. ' +
      'Linux: sudo apt install ffmpeg. mac: brew install ffmpeg.'
    );
  }
  return { ffmpeg, ffprobe };
}

/** Configuração gravada pelo instalar-ferramentas.js (binário do whisper escolhido, modelos, VAD). */
export function lerConfigWhisper() {
  const arq = path.join(PASTA_FERRAMENTAS, 'whisper.json');
  if (!existsSync(arq)) return null;
  try {
    const c = JSON.parse(readFileSync(arq, 'utf8'));
    const abs = (p) => (p ? (path.isAbsolute(p) ? p : path.join(PASTA_FERRAMENTAS, p)) : null);
    return {
      ...c,
      bin: abs(c.bin),
      binCpu: abs(c.binCpu),
      vad: abs(c.vad),
      modelos: Object.fromEntries(Object.entries(c.modelos || {}).map(([k, v]) => [k, abs(v)])),
    };
  } catch {
    return null;
  }
}

/**
 * Roda um programa e coleta stdout/stderr. Não usa shell (caminhos com espaço funcionam no Windows).
 * opções: { cwd, stdin (Buffer), binario (stdout como Buffer), timeout (ms), aoStderr (fn por linha), aoStdout (fn chunk) }
 */
export function rodar(cmd, args, op = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: op.cwd, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const out = [];
    let err = '';
    let resto = '';
    let timer = null;
    if (op.timeout) timer = setTimeout(() => p.kill('SIGKILL'), op.timeout);
    p.stdout.on('data', (b) => (op.aoStdout ? op.aoStdout(b) : out.push(b)));
    p.stderr.on('data', (b) => {
      const s = b.toString('utf8');
      err += s;
      if (err.length > 64 * 1024 * 1024) err = err.slice(-32 * 1024 * 1024);
      if (op.aoStderr) {
        const linhas = (resto + s).split(/\r?\n|\r/);
        resto = linhas.pop();
        linhas.forEach(op.aoStderr);
      }
    });
    p.on('error', (e) => {
      clearTimeout(timer);
      reject(new ErroFerramenta(`não consegui rodar ${path.basename(cmd)}: ${e.message}`));
    });
    p.on('close', (code) => {
      clearTimeout(timer);
      const stdout = Buffer.concat(out);
      const r = { code, stdout: op.binario ? stdout : stdout.toString('utf8'), stderr: err };
      if (code !== 0 && !op.ignorarErro) {
        const e = new ErroFerramenta(`${path.basename(cmd)} terminou com código ${code}: ${err.split(/\r?\n/).filter(Boolean).slice(-4).join(' | ')}`);
        e.resultado = r;
        reject(e);
      } else resolve(r);
    });
    p.stdin.on('error', () => {});
    if (op.stdin) p.stdin.end(op.stdin);
    else p.stdin.end();
  });
}

/** Barra de progresso simples numa linha só. */
export function barra(frac, largura = 28) {
  const f = Math.max(0, Math.min(1, frac || 0));
  const n = Math.round(f * largura);
  return '[' + '#'.repeat(n) + '-'.repeat(largura - n) + '] ' + String(Math.round(f * 100)).padStart(3) + '%';
}
