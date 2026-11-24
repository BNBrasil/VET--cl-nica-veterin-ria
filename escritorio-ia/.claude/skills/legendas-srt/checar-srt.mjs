#!/usr/bin/env node
// Valida um arquivo .srt segundo as regras da skill legendas-srt.
// Uso: node checar-srt.mjs legenda.srt [--max-chars 42] [--max-cps 17]
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? Number(args[i + 1]) : d; };
const MAX_CHARS = opt('--max-chars', 42), MAX_CPS = opt('--max-cps', 17);
if (!file) { console.error('uso: node checar-srt.mjs legenda.srt'); process.exit(2); }

let txt = readFileSync(file, 'utf8');
const erros = [], avisos = [];
if (txt.charCodeAt(0) === 0xfeff) { avisos.push('arquivo com BOM UTF-8'); txt = txt.slice(1); }
if (txt.includes('\r')) avisos.push('fim de linha CRLF (prefira LF)');
const toMs = (t) => { const [h, m, s, ms] = t.split(/[:,]/).map(Number); return ((h * 60 + m) * 60 + s) * 1000 + ms; };
const blocos = txt.replace(/\r/g, '').trim().split(/\n\s*\n/);
let prevFim = -1;
blocos.forEach((b, i) => {
  const l = b.split('\n');
  const n = i + 1, tag = `bloco ${n}`;
  if (l[0].trim() !== String(n)) erros.push(`${tag}: número "${l[0]}" (esperado ${n})`);
  const m = /^(\d\d:\d\d:\d\d,\d{3}) --> (\d\d:\d\d:\d\d,\d{3})$/.exec((l[1] || '').trim());
  if (!m) { erros.push(`${tag}: linha de tempo inválida "${l[1]}"`); return; }
  const ini = toMs(m[1]), fim = toMs(m[2]), dur = fim - ini;
  const linhas = l.slice(2).filter((x) => x.trim() !== '');
  if (!linhas.length) erros.push(`${tag}: sem texto`);
  if (linhas.length > 2) erros.push(`${tag}: ${linhas.length} linhas (máx. 2)`);
  linhas.forEach((x, j) => {
    const c = [...x.replace(/<[^>]+>/g, '')].length;
    if (c > MAX_CHARS) erros.push(`${tag} linha ${j + 1}: ${c} caracteres (máx. ${MAX_CHARS})`);
  });
  if (dur <= 0) erros.push(`${tag}: fim antes do início`);
  else if (dur < 1000) erros.push(`${tag}: ${dur} ms (mín. 1000)`);
  else if (dur > 7000) avisos.push(`${tag}: ${dur} ms (máx. recomendado 7000)`);
  const chars = [...linhas.join(' ').replace(/<[^>]+>/g, '')].length;
  if (dur > 0 && chars / (dur / 1000) > MAX_CPS) avisos.push(`${tag}: ${(chars / (dur / 1000)).toFixed(1)} caracteres/s (máx. ${MAX_CPS})`);
  if (ini < prevFim) erros.push(`${tag}: sobrepõe o bloco anterior`);
  else if (prevFim >= 0 && ini - prevFim < 66) avisos.push(`${tag}: intervalo de ${ini - prevFim} ms (mín. ~80)`);
  prevFim = fim;
});
for (const a of avisos) console.log('AVISO ', a);
for (const e of erros) console.log('ERRO  ', e);
console.log(`${blocos.length} blocos, ${erros.length} erro(s), ${avisos.length} aviso(s)`);
process.exit(erros.length ? 1 : 0);
