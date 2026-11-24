#!/usr/bin/env node
// Converte a paleta do escritório (JSON) para .gpl (GIMP/Aseprite).
// Aceita: ["#rrggbb", ...] | { colors|palette: [...] } | [{ name, hex }] | shared/rooms.json (usa accents).
import { readFileSync } from 'node:fs';
const file = process.argv[2];
if (!file) { console.error('uso: node palette-to-gpl.mjs palette.json > escritorio.gpl'); process.exit(2); }
const j = JSON.parse(readFileSync(file, 'utf8'));
let lista;
if (j.rooms) lista = [...j.rooms, ...(j.common || [])].map((r) => ({ name: r.id, hex: r.accent }));
else lista = (Array.isArray(j) ? j : j.colors || j.palette || Object.values(j))
  .map((c, i) => (typeof c === 'string' ? { name: `c${i}`, hex: c } : { name: c.name || `c${i}`, hex: c.hex || c.color }));
const out = ['GIMP Palette', 'Name: Escritorio IA', 'Columns: 8', '#'];
for (const { name, hex } of lista) {
  const h = String(hex).replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(h)) { console.error(`cor inválida ignorada: ${name} ${hex}`); continue; }
  const [r, g, b] = [0, 2, 4].map((k) => parseInt(h.slice(k, k + 2), 16));
  out.push(`${String(r).padStart(3)} ${String(g).padStart(3)} ${String(b).padStart(3)}\t${name}`);
}
if (lista.length < 32 && !j.rooms) console.error(`aviso: ${lista.length} cores (regra: 32 a 48)`);
if (lista.length > 48) console.error(`aviso: ${lista.length} cores (regra: 32 a 48)`);
process.stdout.write(out.join('\n') + '\n');
