// Capas, textos de postagem e enquadramento por rosto (vlog/reenquadrar.py).
import { existsSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import {
  VLOG, WIN, ffmpeg, rodar, filtroEnquadramento, maiusc, dataBR, tempoCapitulo,
} from './render-comum.js';
import { assCapa } from './render-ass.js';

// ---------------------------------------------------------------- capa
/**
 * Gera a capa a partir do melhor quadro em torno de `t` (filtro thumbnail evita quadro borrado).
 * fonte: { arquivo, info (dimensões/rotação), t, foco }.
 */
export async function gerarCapa({ fonte, alvo, texto, canal, fontes, pasta, saida, rostoX = null }) {
  const nome = `capa_${alvo.w}x${alvo.h}.ass`;
  writeFileSync(path.join(pasta, nome), assCapa({ alvo, texto, canal, fontes }));
  const ini = Math.max(0, fonte.t - 1);
  const { filtro } = filtroEnquadramento(fonte.info, alvo, fonte.foco || 'centro', { rostoX, entrada: 'vin', saida: 'vq' });
  const grafo = `[0:v]thumbnail=24,setpts=PTS-STARTPTS[vin];${filtro};` +
    `[vq]eq=contrast=1.07:saturation=1.18:brightness=0.01,unsharp=5:5:0.6,ass=filename='${nome}':fontsdir='fontes'[v]`;
  await ffmpeg(['-loglevel', 'error', '-ss', ini.toFixed(3), '-t', '2', '-i', fonte.arquivo, '-filter_complex', grafo,
    '-map', '[v]', '-frames:v', '1', '-q:v', '3', '-update', '1', saida], { cwd: pasta });
}

/** Texto curto da capa: canal pode mandar (edl.capa.texto); senão o título com no máximo 5 palavras. */
export function textoCapa(edl) {
  if (edl.capa?.texto) return edl.capa.texto;
  const t = String(edl.youtube?.titulo || edl.titulo || '').replace(/[|–—:].*$/, '').trim();
  const ws = t.split(/\s+/).filter(Boolean);
  return ws.length > 5 ? ws.slice(0, 5).join(' ') : t || dataBR(edl.data);
}

// ---------------------------------------------------------------- textos
const hashtag = (h) => (String(h).startsWith('#') ? String(h) : `#${String(h).replace(/\s+/g, '')}`);

export function textoDescricaoYoutube({ edl, capitulos, canal }) {
  const yt = edl.youtube || {};
  const titulo = yt.titulo || edl.titulo || `Vlog ${dataBR(edl.data)}`;
  const tags = [...new Set([...(yt.tags || []), ...(canal.tags || [])])];
  const hashtags = [...new Set([...(yt.hashtags || []), ...(canal.hashtags || []).slice(0, 3)].map(hashtag))].slice(0, 3);
  const partes = [`TÍTULO (até 100 caracteres${titulo.length > 100 ? ' — ATENÇÃO: este passou' : ''}):`, titulo, '', 'DESCRIÇÃO:'];
  partes.push(yt.descricao || `${edl.titulo || 'Mais um dia'} — ${dataBR(edl.data)}.`);
  if (capitulos.valido) partes.push('', 'Capítulos:', capitulos.texto);
  if (canal.rodape) partes.push('', canal.rodape);
  if (hashtags.length) partes.push('', hashtags.join(' '));
  partes.push('', 'TAGS (cole no campo "Tags" do YouTube):', tags.join(', '));
  if (!capitulos.valido) partes.push('', '(Capítulos não incluídos: o YouTube exige pelo menos 3 capítulos de 10 s ou mais.)');
  return partes.join('\n') + '\n';
}

export function textoLegendaReels({ edl, canal }) {
  const r = edl.reels || {};
  const legenda = r.legenda || edl.curto?.gancho || edl.titulo || '';
  const tags = [...new Set([...(r.hashtags || []), ...(canal.hashtags || [])].map(hashtag))].slice(0, 12);
  return `${legenda}\n\n${tags.join(' ')}\n`;
}

// ---------------------------------------------------------------- rosto (opcional)
let pythonCache;
function acharPython() {
  if (pythonCache !== undefined) return pythonCache;
  const cands = process.env.VLOG_PYTHON ? [[process.env.VLOG_PYTHON]] : WIN ? [['py', '-3'], ['python']] : [['python3'], ['python']];
  pythonCache = null;
  for (const c of cands) {
    const r = spawnSync(c[0], [...c.slice(1), '-c', 'import cv2'], { encoding: 'utf8', windowsHide: true });
    if (r.status === 0) { pythonCache = c; break; }
  }
  return pythonCache;
}

/**
 * Centro horizontal do rosto (0..1) no trecho, via vlog/reenquadrar.py (MediaPipe ou OpenCV).
 * Retorna { x, motivo }. x = null → caller cai para "centro".
 */
export async function acharRosto(arquivo, ini, fim) {
  const py = acharPython();
  if (!py) return { x: null, motivo: 'Python com OpenCV não encontrado (pip install mediapipe opencv-python)' };
  const script = path.join(VLOG, 'reenquadrar.py');
  if (!existsSync(script)) return { x: null, motivo: 'vlog/reenquadrar.py não existe' };
  try {
    const { stdout } = await rodar(py[0], [...py.slice(1), script, arquivo, String(ini), String(fim)]);
    const r = JSON.parse(stdout.trim().split(/\r?\n/).pop());
    return Number.isFinite(r.x) ? { x: r.x, motivo: r.metodo } : { x: null, motivo: r.motivo || 'nenhum rosto encontrado' };
  } catch (e) {
    return { x: null, motivo: e.message.split('\n').slice(-1)[0] };
  }
}

export { maiusc, tempoCapitulo };
