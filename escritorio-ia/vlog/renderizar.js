#!/usr/bin/env node
// Uso: node vlog/renderizar.js <AAAA-MM-DD> [--so longo|curto] [--validar]
// Lê vlog/trabalho/<data>/analise.json + edl.json e gera vlog/postar/<data>/ (vídeos, capas, textos, legendas).
// Nunca altera vlog/brutos/: só lê os clipes.
import path from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { pastaTrabalho, pastaPostar, lerJson, lerCanal, validarEdl, ErroVlog } from './lib/render-comum.js';
import { renderizarPacote } from './lib/render-pacote.js';

export async function renderizarData(data, { versoes, log = console.log } = {}) {
  const dir = path.join(pastaTrabalho(), data);
  if (!existsSync(dir)) {
    const tem = existsSync(pastaTrabalho()) ? readdirSync(pastaTrabalho()).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)) : [];
    throw new ErroVlog(`não existe ${dir}. ${tem.length ? 'Datas disponíveis: ' + tem.join(', ') : 'Rode antes: node vlog/analisar.js'}`);
  }
  const analise = lerJson(path.join(dir, 'analise.json'), 'analise.json');
  const edl = lerJson(path.join(dir, 'edl.json'), 'edl.json (escrito pelo agente editor-vlog)');
  const canal = lerCanal();
  log(`Renderizando ${data} — "${edl.titulo || data}"`);
  return renderizarPacote({
    analise, edl, pastaAnalise: dir, pastaRender: path.join(dir, 'render'),
    pastaSaida: path.join(pastaPostar(), data), canal, log, versoes,
  });
}

async function main() {
  const args = process.argv.slice(2);
  const so = args.includes('--so') ? args[args.indexOf('--so') + 1] : null;
  const data = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
  if (!data) {
    console.log('uso: node vlog/renderizar.js AAAA-MM-DD [--so longo|curto] [--validar]');
    process.exit(1);
  }
  if (args.includes('--validar')) {
    const dir = path.join(pastaTrabalho(), data);
    const { erros, avisos } = validarEdl(lerJson(path.join(dir, 'edl.json'), 'edl.json'), lerJson(path.join(dir, 'analise.json'), 'analise.json'));
    avisos.forEach((a) => console.log(`aviso: ${a}`));
    erros.forEach((e) => console.log(`ERRO: ${e}`));
    console.log(erros.length ? `edl inválido (${erros.length} erro(s))` : 'edl ok');
    process.exit(erros.length ? 1 : 0);
  }
  const t0 = Date.now();
  const rel = await renderizarData(data, { versoes: so ? [so] : undefined });
  console.log(`\nPronto em ${((Date.now() - t0) / 1000).toFixed(1)} s → ${path.join(pastaPostar(), data)}`);
  const probl = rel.arquivos.filter((a) => a.problemas?.length);
  if (probl.length) { console.log('Atenção: há arquivos fora do padrão (veja acima).'); process.exit(2); }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((e) => { console.error(e instanceof ErroVlog ? `\nErro: ${e.message}` : e); process.exit(1); });
}
