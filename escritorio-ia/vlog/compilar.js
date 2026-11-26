#!/usr/bin/env node
// Uso: node vlog/compilar.js --de AAAA-MM-DD --ate AAAA-MM-DD [--max-minutos 10] [--max-curto 60]
// Junta os melhores trechos de cada dia (cortes com "melhor": true no edl.json; se não houver, os maiores),
// com cartela de data entre os dias, e gera longo + curto + textos em vlog/postar/compilado-<de>_<ate>/.
// Textos podem ser ajustados em vlog/trabalho/compilado-<de>_<ate>.json ({ titulo, gancho, youtube, reels }).
import path from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  pastaTrabalho, pastaPostar, lerJson, lerCanal, caminhoClipe, indiceClipe, dataBR, ErroVlog,
} from './lib/render-comum.js';
import { renderizarPacote } from './lib/render-pacote.js';

const ddmm = (d) => dataBR(d).slice(0, 5);
const durCorte = (c) => c.fim - c.ini;

/** Escolhe os melhores cortes de um dia dentro do orçamento (segundos), na ordem do edl. */
export function melhoresDoDia(edl, orcamento) {
  const longo = edl.longo?.cortes?.filter((c) => c.tipo !== 'cartela') || [];
  const curto = edl.curto?.cortes || [];
  let cands = longo.filter((c) => c.melhor);
  if (!cands.length) cands = curto.filter((c) => c.melhor);
  if (!cands.length) {
    const maiores = new Set([...longo].sort((a, b) => durCorte(b) - durCorte(a)).slice(0, 3));
    cands = longo.filter((c) => maiores.has(c));
  }
  if (!cands.length) cands = curto.slice(0, 2);
  const out = [];
  let t = 0;
  for (const c of cands) {
    if (t >= orcamento - 1) break;
    const d = Math.min(durCorte(c), orcamento - t);
    if (d < 1.5) break;
    out.push({ ...c, fim: c.ini + d });
    t += d;
  }
  return out;
}

/** Monta analise + edl virtuais do compilado. dias: [{ data, analise, edl, dir }]. */
export function montarCompilado(dias, { de, ate, maxMinutos = 10, maxCurto = 60, extra = {} }) {
  const analise = { data: `${de}_${ate}`, clipes: [] };
  const base = [];
  for (const d of dias) {
    base.push(analise.clipes.length);
    for (const c of d.analise.clipes) analise.clipes.push({ ...c, arquivo: caminhoClipe(c, d.dir) });
  }
  const remap = (c, i) => ({ ...c, clipe: base[i] + indiceClipe(c.clipe, dias[i].analise), data: dias[i].data });
  const orcLongo = (maxMinutos * 60 - 2.2 * dias.length - 4) / dias.length;
  const porDia = dias.map((d, i) => melhoresDoDia(d.edl, orcLongo).map((c) => remap(c, i)));

  // abertura: 4 s do trecho "melhor" mais longo de todos (gancho), depois cartela + trechos de cada dia
  const todos = porDia.flat();
  const top = [...todos].sort((a, b) => durCorte(b) - durCorte(a))[0];
  const longo = [];
  if (top) longo.push({ clipe: top.clipe, ini: top.ini, fim: Math.min(top.fim, top.ini + 4), legenda: top.legenda });
  dias.forEach((d, i) => {
    const cap = `${ddmm(d.data)} · ${d.edl.titulo || 'Dia ' + (i + 1)}`;
    longo.push({ tipo: 'cartela', texto: ddmm(d.data), subtexto: d.edl.titulo || '', dur: 2.2, capitulo: cap });
    for (const c of porDia[i]) longo.push({ ...c, capitulo: cap, rotulo: null });
  });

  // curto: o momento de abertura do curto de cada dia (já tem foco escolhido), com a data no canto
  const orcCurto = maxCurto / dias.length;
  const curto = [];
  dias.forEach((d, i) => {
    const fonte = d.edl.curto?.cortes?.length ? d.edl.curto.cortes : porDia[i].map((c) => ({ ...c, clipe: c.clipe - base[i] }));
    let t = 0;
    for (const c of fonte) {
      if (t >= orcCurto - 1) break;
      const dur = Math.min(durCorte(c), orcCurto - t);
      if (dur < 1.5) break;
      curto.push({ ...remap({ ...c, fim: c.ini + dur }, i), rotulo: ddmm(d.data) });
      t += dur;
      if (t >= Math.min(orcCurto, 12)) break; // no máximo ~12 s por dia: ritmo de reels
    }
  });

  const titulos = dias.map((d) => `${ddmm(d.data)} — ${d.edl.titulo || ''}`.trim());
  const n = dias.length;
  const titulo = extra.titulo || `Melhores momentos: ${ddmm(de)} a ${ddmm(ate)}`;
  const edl = {
    data: `${de}_${ate}`, titulo, compilado: true,
    longo: { cortes: longo, transicao: extra.transicao || 'corte', intro: `${n} dias · ${dataBR(de)} a ${dataBR(ate)}` },
    curto: { cortes: curto, gancho: extra.gancho || `${n} dias em ${Math.round(Math.min(maxCurto, curto.reduce((s, c) => s + durCorte(c), 0)))} segundos`, duracaoMax: maxCurto },
    capa: extra.capa || { texto: `${n} dias de vlog` },
    youtube: {
      titulo, tags: [...new Set(dias.flatMap((d) => d.edl.youtube?.tags || []))],
      descricao: `Os melhores momentos de ${n} dias, de ${dataBR(de)} a ${dataBR(ate)}:\n` + titulos.map((t) => `• ${t}`).join('\n'),
      ...(extra.youtube || {}),
    },
    reels: {
      legenda: `${n} dias resumidos em um vídeo 🎬 Qual foi o seu dia favorito?`,
      hashtags: [...new Set(dias.flatMap((d) => d.edl.reels?.hashtags || []))],
      ...(extra.reels || {}),
    },
  };
  return { analise, edl };
}

export function datasNoIntervalo(de, ate, pasta = pastaTrabalho()) {
  if (!existsSync(pasta)) return [];
  return readdirSync(pasta).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= de && d <= ate).sort()
    .filter((d) => existsSync(path.join(pasta, d, 'edl.json')) && existsSync(path.join(pasta, d, 'analise.json')));
}

export async function compilar({ de, ate, maxMinutos = 10, maxCurto = 60, log = console.log }) {
  const datas = datasNoIntervalo(de, ate);
  if (!datas.length) throw new ErroVlog(`nenhuma data entre ${de} e ${ate} com analise.json + edl.json em ${pastaTrabalho()}`);
  const dias = datas.map((data) => {
    const dir = path.join(pastaTrabalho(), data);
    return { data, dir, analise: lerJson(path.join(dir, 'analise.json'), `analise.json de ${data}`), edl: lerJson(path.join(dir, 'edl.json'), `edl.json de ${data}`) };
  });
  const nome = `compilado-${de}_${ate}`;
  const arqExtra = path.join(pastaTrabalho(), `${nome}.json`);
  const extra = existsSync(arqExtra) ? lerJson(arqExtra, `${nome}.json`) : {};
  const canal = lerCanal();
  const { analise, edl } = montarCompilado(dias, { de, ate, maxMinutos, maxCurto, extra });
  log(`Compilado ${de} → ${ate}: ${datas.length} dia(s) (${datas.join(', ')})`);
  return renderizarPacote({
    analise, edl, pastaAnalise: pastaTrabalho(), pastaRender: path.join(pastaTrabalho(), nome, 'render'),
    pastaSaida: path.join(pastaPostar(), nome), canal, log,
  });
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (n, def) => (args.includes(n) ? args[args.indexOf(n) + 1] : def);
  const de = opt('--de'), ate = opt('--ate');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(de || '') || !/^\d{4}-\d{2}-\d{2}$/.test(ate || '')) {
    console.log('uso: node vlog/compilar.js --de AAAA-MM-DD --ate AAAA-MM-DD [--max-minutos 10] [--max-curto 60]');
    process.exit(1);
  }
  const t0 = Date.now();
  await compilar({ de, ate, maxMinutos: Number(opt('--max-minutos', 10)), maxCurto: Number(opt('--max-curto', 60)) });
  console.log(`\nPronto em ${((Date.now() - t0) / 1000).toFixed(1)} s → ${path.join(pastaPostar(), `compilado-${de}_${ate}`)}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((e) => { console.error(e instanceof ErroVlog ? `\nErro: ${e.message}` : e); process.exit(1); });
}
