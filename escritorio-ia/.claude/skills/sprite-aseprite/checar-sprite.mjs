#!/usr/bin/env node
// Valida um sprite sheet JSON (Aseprite json-hash) do escritório contra o CONTRATO.md.
// Uso: node checar-sprite.mjs <char_<id>.json> <roomId|visitante> [--sem-walk]
import { readFileSync } from 'node:fs';

const [file, id] = process.argv.slice(2);
if (!file || !id) { console.error('uso: node checar-sprite.mjs char_<id>.json <roomId>'); process.exit(2); }
const semWalk = process.argv.includes('--sem-walk');
const data = JSON.parse(readFileSync(file, 'utf8'));
const tabela = {
  [`${id}_work`]: [4, 6, 8], base_read: [4, 4, 6], base_idle: [2, 2, 4], base_doze: [4, 4, 4],
  base_sleep: [4, 4, 3], base_wait: [2, 2, 4], base_done: [4, 4, 8], base_error: [3, 3, 6],
};
if (!semWalk) for (const d of ['down', 'up', 'left', 'right']) tabela[`base_walk_${d}`] = [4, 4, 8];

const erros = [], avisos = [];
const frames = data.frames || {};
if (Array.isArray(frames)) erros.push('frames é array: exporte com --format json-hash');
const nomes = Object.keys(frames);
const tags = new Map((data.meta?.frameTags || []).map((t) => [t.name, t]));
for (const [tag, [min, max, fps]] of Object.entries(tabela)) {
  const t = tags.get(tag);
  if (!t) { erros.push(`tag ausente: ${tag}`); continue; }
  const n = t.to - t.from + 1;
  if (n < min || n > max) erros.push(`${tag}: ${n} quadros (esperado ${min === max ? min : `${min}–${max}`})`);
  const esperado = 1000 / fps;
  for (let i = 0; i < n; i++) {
    const f = frames[`${tag}_${i}`] || frames[nomes[t.from + i]];
    if (!frames[`${tag}_${i}`]) avisos.push(`${tag}: chave "${tag}_${i}" não encontrada (use --filename-format '{tag}_{tagframe}')`);
    if (!f) continue;
    if (Math.abs(f.duration - esperado) > 2) erros.push(`${tag}_${i}: duração ${f.duration} ms (esperado ~${Math.round(esperado)} = ${fps} fps)`);
    const { w, h } = f.frame || {};
    if (w !== 16 || h !== 32) erros.push(`${tag}_${i}: ${w}x${h} (esperado 16x32)`);
  }
}
for (const a of [...new Set(avisos)]) console.log('AVISO ', a);
for (const e of erros) console.log('ERRO  ', e);
console.log(`${tags.size} tags, ${nomes.length} quadros, ${erros.length} erro(s)`);
process.exit(erros.length ? 1 : 0);
