// Gera o pacote completo de postagem de um edl (um dia ou o compilado): vídeos, capas, textos e legendas.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  LONGO, CURTO, ErroVlog, validarEdl, calcularTimeline, calcularCapitulos, transcricaoRecortada,
  blocosSrt, gerarSrt, prepararFontes, caminhoClipe, dimensoesEfetivas, escolherEncoder,
} from './render-comum.js';
import { renderizarVersao, sondarClipe, conferirSaida } from './render-motor.js';
import { assLongo, assCurto } from './render-ass.js';
import { gerarCapa, textoCapa, textoDescricaoYoutube, textoLegendaReels, acharRosto } from './render-extras.js';

const fmt = (s) => `${Math.floor(s / 60)}min${String(Math.round(s % 60)).padStart(2, '0')}s`;

/**
 * @param {object} p
 * @param {object} p.analise   analise.json (clipes)
 * @param {object} p.edl       edl.json
 * @param {string} p.pastaAnalise  pasta do analise.json (resolve caminhos relativos)
 * @param {string} p.pastaRender   intermediários
 * @param {string} p.pastaSaida    vlog/postar/<data>
 * @param {object} p.canal
 * @param {(msg:string)=>void} [p.log]
 * @param {string[]} [p.versoes]  ['longo','curto'] (padrão: as que existirem no edl)
 */
export async function renderizarPacote({ analise, edl, pastaAnalise, pastaRender, pastaSaida, canal, log = console.log, versoes }) {
  const { erros, avisos } = validarEdl(edl, analise);
  for (const a of avisos) log(`  aviso: ${a}`);
  if (erros.length) throw new ErroVlog(`o edl.json tem ${erros.length} problema(s):\n` + erros.map((e) => `  - ${e}`).join('\n'));
  mkdirSync(pastaRender, { recursive: true });
  mkdirSync(pastaSaida, { recursive: true });
  const fontes = prepararFontes(pastaRender, canal);
  const enc = await escolherEncoder();
  log(`  encoder de vídeo: ${enc.nome}${enc.nome === 'libx264' ? ' (sem NVENC disponível)' : ' (placa NVIDIA)'}; fontes: ${fontes.titulo.nome} / ${fontes.legenda.nome}`);

  // sonda cada clipe usado (dimensões reais, rotação, se tem áudio)
  const infos = new Map();
  const prepararSeg = async (seg) => {
    if (seg.tipo !== 'clipe') return;
    if (!infos.has(seg.k)) {
      const arquivo = caminhoClipe(seg.clipe, pastaAnalise);
      if (!arquivo || !existsSync(arquivo)) throw new ErroVlog(`o clipe ${seg.k} não foi encontrado: ${seg.clipe.arquivo}`);
      const s = await sondarClipe(arquivo);
      infos.set(seg.k, { arquivo, info: { ...seg.clipe, ...s } });
    }
    Object.assign(seg, infos.get(seg.k));
  };
  const estabilizar = (seg) => canal.estabilizar !== false && edl.estabilizar !== false &&
    Number(seg.clipe?.tremido) >= (canal.limiteTremido ?? 0.6);

  const quer = versoes || ['longo', 'curto'];
  const rel = { arquivos: [], avisos: [...avisos], tempos: {} };
  const t0 = Date.now();

  // ------------------------------------------------ LONGO 16:9
  let capitulos = { lista: [], texto: '', valido: false };
  let segLongo = null;
  if (edl.longo && quer.includes('longo')) {
    const { segmentos, duracao } = calcularTimeline(edl.longo.cortes, analise);
    segLongo = segmentos;
    for (const s of segmentos) await prepararSeg(s);
    capitulos = calcularCapitulos(segmentos, duracao);
    const falas = transcricaoRecortada(segmentos);
    const blocos = blocosSrt(falas, { maxChars: 42 });
    writeFileSync(path.join(pastaSaida, 'youtube.srt'), gerarSrt(blocos));
    writeFileSync(path.join(pastaSaida, 'capitulos.txt'), capitulos.texto + '\n');
    const clipes = segmentos.filter((s) => s.tipo === 'clipe');
    const queimar = clipes.length > 0 && clipes.every((s) => s.legenda === true);
    const assArq = path.join(pastaRender, 'longo.ass');
    writeFileSync(assArq, assLongo({
      segmentos, duracao, canal, fontes, capitulos: capitulos.lista,
      titulo: edl.titulo, intro: edl.longo.intro || '', falas: queimar ? falas : null,
    }));
    log(`  longo: ${segmentos.length} trechos, ${fmt(duracao)}, transição "${edl.longo.transicao || 'corte'}"${queimar ? ', legenda queimada' : ''}`);
    if (duracao < 8 * 60 && !edl.compilado) log('  (dica: o longo ficou com menos de 8 min — ok se o dia teve pouco material)');
    const saida = path.join(pastaSaida, 'youtube-16x9.mp4');
    const r = await renderizarVersao(segmentos, saida, {
      alvo: LONGO, nome: 'longo', pasta: pastaRender, ass: assArq, transicao: edl.longo.transicao || 'corte',
      estabilizar, trilha: edl.longo.trilha, titulo: edl.youtube?.titulo || edl.titulo, corCartela: canal.cores.cartela,
      aoProgresso: (m) => process.stdout.isTTY && process.stdout.write(`\r  ${m}   `),
    });
    if (process.stdout.isTTY) process.stdout.write('\n');
    rel.tempos.longo = r.segundosTotal;
    const c = await conferirSaida(saida, LONGO);
    rel.arquivos.push({ arquivo: saida, duracao: c.duracao, problemas: c.problemas });
    log(`  ✓ youtube-16x9.mp4 (${fmt(c.duracao)}) em ${r.segundosTotal.toFixed(1)} s${c.problemas.length ? ' — PROBLEMAS: ' + c.problemas.join('; ') : ''}`);
  }

  // ------------------------------------------------ CURTO 9:16
  let segCurto = null;
  if (edl.curto && quer.includes('curto')) {
    const max = edl.curto.duracaoMax ?? 60;
    const { segmentos, duracao } = calcularTimeline(edl.curto.cortes, analise, { maxDur: max });
    segCurto = segmentos;
    for (const s of segmentos) await prepararSeg(s);
    // enquadramento por rosto: só faz sentido em vídeo horizontal
    const rostos = new Map();
    for (const s of segmentos) {
      if (s.tipo !== 'clipe' || s.foco !== 'rosto') continue;
      const { w, h } = dimensoesEfetivas(s.info);
      if (w <= h) continue;
      const r = await acharRosto(s.arquivo, s.ini, s.fim);
      if (r.x === null) { const m = `curto: foco "rosto" no clipe ${s.k} caiu para "centro" (${r.motivo})`; rel.avisos.push(m); log(`  aviso: ${m}`); }
      rostos.set(s, r.x);
    }
    const falas = transcricaoRecortada(segmentos);
    writeFileSync(path.join(pastaSaida, 'reels.srt'), gerarSrt(blocosSrt(falas, { maxChars: 32 })));
    const assArq = path.join(pastaRender, 'curto.ass');
    writeFileSync(assArq, assCurto({ segmentos, duracao, gancho: edl.curto.gancho, canal, fontes, falas }));
    log(`  curto: ${segmentos.length} trechos, ${duracao.toFixed(1)} s (máx. ${max} s)`);
    const saida = path.join(pastaSaida, 'reels-9x16.mp4');
    const r = await renderizarVersao(segmentos, saida, {
      alvo: CURTO, nome: 'curto', pasta: pastaRender, ass: assArq, transicao: edl.curto.transicao || 'corte',
      estabilizar, rostoX: (s) => rostos.get(s) ?? null, trilha: edl.curto.trilha, titulo: edl.curto.gancho,
      corCartela: canal.cores.cartela,
      aoProgresso: (m) => process.stdout.isTTY && process.stdout.write(`\r  ${m}   `),
    });
    if (process.stdout.isTTY) process.stdout.write('\n');
    rel.tempos.curto = r.segundosTotal;
    const c = await conferirSaida(saida, CURTO);
    if (c.duracao > max + 0.1) c.problemas.push(`duração ${c.duracao.toFixed(1)} s passa de ${max} s`);
    rel.arquivos.push({ arquivo: saida, duracao: c.duracao, problemas: c.problemas });
    log(`  ✓ reels-9x16.mp4 (${c.duracao.toFixed(1)} s) em ${r.segundosTotal.toFixed(1)} s${c.problemas.length ? ' — PROBLEMAS: ' + c.problemas.join('; ') : ''}`);
  }

  // ------------------------------------------------ capas
  const texto = textoCapa(edl);
  const fonteCapa = async (segs, campo) => {
    const pref = edl.capa?.[campo] || edl.capa;
    if (pref && pref.clipe !== undefined && Number.isFinite(pref.t)) {
      const { segmentos } = calcularTimeline([{ clipe: pref.clipe, ini: Math.max(0, pref.t - 1), fim: pref.t + 1 }], analise);
      if (segmentos[0]) { await prepararSeg(segmentos[0]); return { arquivo: segmentos[0].arquivo, info: segmentos[0].info, t: pref.t, foco: pref.foco }; }
    }
    const s = (segs || []).find((x) => x.tipo === 'clipe');
    if (!s) return null;
    return { arquivo: s.arquivo, info: s.info, t: s.ini + Math.min(s.dur / 2, 3), foco: s.foco };
  };
  const capaYT = await fonteCapa(segLongo || segCurto, 'youtube');
  if (capaYT) {
    await gerarCapa({ fonte: capaYT, alvo: { w: 1280, h: 720 }, texto, canal, fontes, pasta: pastaRender, saida: path.join(pastaSaida, 'capa-youtube.jpg') });
    rel.arquivos.push({ arquivo: path.join(pastaSaida, 'capa-youtube.jpg') });
  }
  const capaR = await fonteCapa(segCurto || segLongo, 'reels');
  if (capaR) {
    await gerarCapa({ fonte: capaR, alvo: CURTO, texto: edl.capa?.textoReels || edl.curto?.gancho || texto, canal, fontes, pasta: pastaRender, saida: path.join(pastaSaida, 'capa-reels.jpg') });
    rel.arquivos.push({ arquivo: path.join(pastaSaida, 'capa-reels.jpg') });
  }

  // ------------------------------------------------ textos
  writeFileSync(path.join(pastaSaida, 'descricao-youtube.txt'), textoDescricaoYoutube({ edl, capitulos, canal }));
  writeFileSync(path.join(pastaSaida, 'legenda-reels.txt'), textoLegendaReels({ edl, canal }));
  if (!capitulos.valido && edl.longo) log('  aviso: menos de 3 capítulos de 10 s — o YouTube não mostra capítulos (capitulos.txt foi gerado mesmo assim)');
  rel.segundos = (Date.now() - t0) / 1000;
  rel.encoder = enc.nome;
  return rel;
}
