// Localiza ffmpeg/ffprobe/Piper e roda processos externos com mensagens de erro claras.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PRODUCAO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PASTA_VOZ = path.join(PRODUCAO, 'voz');
export const PASTA_TRABALHO = path.join(PRODUCAO, 'trabalho');
export const PASTA_SAIDA = path.join(PRODUCAO, 'saida');
export const PASTA_SONS = path.join(PRODUCAO, 'sons');
export const WIN = process.platform === 'win32';

const EXE = WIN ? '.exe' : '';
const cache = new Map();

function existeNoPath(nome) {
  const r = spawnSync(WIN ? 'where' : 'which', [nome], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  const linha = r.stdout.split(/\r?\n/).find(Boolean);
  return linha ? linha.trim() : null;
}

function candidatosExtras(nome) {
  const lista = [];
  if (WIN && process.env.LOCALAPPDATA) {
    lista.push(path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Links', nome + EXE));
  }
  if (!WIN) lista.push(`/usr/bin/${nome}`, `/usr/local/bin/${nome}`, `/opt/homebrew/bin/${nome}`);
  return lista;
}

/** Caminho do ffmpeg/ffprobe (PATH, depois WinGet\Links no Windows). Retorna null se não achar. */
export function acharPrograma(nome) {
  if (cache.has(nome)) return cache.get(nome);
  const env = process.env[`PRODUCAO_${nome.toUpperCase()}`];
  let achado = env && existsSync(env) ? env : existeNoPath(nome);
  if (!achado) achado = candidatosExtras(nome).find((c) => existsSync(c)) || null;
  cache.set(nome, achado);
  return achado;
}

export class ErroFerramenta extends Error {}

export function exigirFfmpeg() {
  const ffmpeg = acharPrograma('ffmpeg');
  const ffprobe = acharPrograma('ffprobe');
  if (!ffmpeg || !ffprobe) {
    throw new ErroFerramenta(
      'ffmpeg não encontrado. No Windows rode INICIAR.bat (ele instala o ffmpeg pelo winget) ' +
      'ou instale em https://www.gyan.dev/ffmpeg/builds/. No Linux: sudo apt install ffmpeg; no mac: brew install ffmpeg.'
    );
  }
  return { ffmpeg, ffprobe };
}

/** Piper: binário em producao/voz/piper/ ou pacote pip (python -m piper). */
export function acharPiper() {
  const bin = [
    path.join(PASTA_VOZ, 'piper', 'piper' + EXE),
    path.join(PASTA_VOZ, 'piper' + EXE),
  ].find((c) => existsSync(c));
  if (bin) return { cmd: bin, args: [] };
  const venv = path.join(PASTA_VOZ, 'venv', WIN ? 'Scripts' : 'bin', 'piper' + EXE);
  if (existsSync(venv)) return { cmd: venv, args: [] };
  const noPath = existeNoPath('piper');
  if (noPath) return { cmd: noPath, args: [] };
  return null;
}

export function exigirPiper() {
  const p = acharPiper();
  if (!p) {
    throw new ErroFerramenta(
      'Piper (voz gratuita) não instalado. Rode: node producao/instalar-voz.js ' +
      '(no Windows o INICIAR.bat já faz isso).'
    );
  }
  return p;
}

/** Roda um processo; resolve {stdout, stderr}; rejeita com o fim do stderr se falhar. */
export function rodar(cmd, args, { cwd, entrada, env } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, env: env ? { ...process.env, ...env } : process.env, windowsHide: true });
    const out = [];
    const err = [];
    p.stdout.on('data', (d) => out.push(d));
    p.stderr.on('data', (d) => err.push(d));
    p.on('error', (e) => reject(new ErroFerramenta(`não consegui executar ${path.basename(cmd)}: ${e.message}`)));
    p.on('close', (code) => {
      const stdout = Buffer.concat(out).toString('utf8');
      const stderr = Buffer.concat(err).toString('utf8');
      if (code === 0) resolve({ stdout, stderr });
      else {
        const fim = stderr.trim().split(/\r?\n/).slice(-12).join('\n');
        reject(new ErroFerramenta(`${path.basename(cmd)} saiu com código ${code}:\n${fim}`));
      }
    });
    if (entrada != null) p.stdin.end(entrada);
    else p.stdin.end();
  });
}

export async function ffmpeg(args, opts) {
  const { ffmpeg: bin } = exigirFfmpeg();
  return rodar(bin, ['-hide_banner', '-loglevel', 'error', '-y', ...args], opts);
}

/** Duração em segundos de um arquivo de mídia. */
export async function duracaoMidia(arquivo) {
  const { ffprobe } = exigirFfmpeg();
  const { stdout } = await rodar(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', arquivo]);
  return Number.parseFloat(stdout.trim());
}

let filtrosCache = null;
/** Confere se o ffmpeg tem os filtros que usamos (libass, drawtext, sidechain). */
export async function conferirFiltros() {
  if (filtrosCache) return filtrosCache;
  const { stdout } = await ffmpeg(['-filters'], {}).catch(() => ({ stdout: '' }));
  const faltando = ['ass', 'sidechaincompress', 'loudnorm', 'zoompan', 'gradients', 'acompressor']
    .filter((f) => !new RegExp(`\\s${f}\\s`).test(stdout));
  if (faltando.length) {
    throw new ErroFerramenta(
      `seu ffmpeg não tem os filtros: ${faltando.join(', ')}. Instale uma versão completa ` +
      '(Windows: winget install Gyan.FFmpeg ou rode INICIAR.bat; Linux: apt install ffmpeg >= 6).'
    );
  }
  filtrosCache = true;
  return true;
}

/**
 * Caminhos do modelo de voz. As vozes atuais do Hugging Face trazem no .onnx.json fonemas de
 * vários caracteres (formato do Piper 1.5) que o binário 2023.11 recusa; geramos um
 * <voz>.piper.json só com os fonemas de um caractere (os únicos que esse binário produz).
 */
export function arquivosVoz(modelo) {
  const onnx = path.isAbsolute(modelo) || modelo.endsWith('.onnx') ? modelo : path.join(PASTA_VOZ, modelo + '.onnx');
  const original = onnx + '.json';
  if (!existsSync(onnx) || !existsSync(original)) {
    throw new ErroFerramenta(`voz "${path.basename(onnx, '.onnx')}" não encontrada em producao/voz/. Rode: node producao/instalar-voz.js`);
  }
  const config = onnx.replace(/\.onnx$/, '.piper.json');
  if (!existsSync(config) || statSync(config).mtimeMs < statSync(original).mtimeMs) {
    const d = JSON.parse(readFileSync(original, 'utf8'));
    if (d.phoneme_id_map) {
      d.phoneme_id_map = Object.fromEntries(Object.entries(d.phoneme_id_map).filter(([k]) => [...k].length === 1));
    }
    writeFileSync(config, JSON.stringify(d));
  }
  return { onnx, config };
}
