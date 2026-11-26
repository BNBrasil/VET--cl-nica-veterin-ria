// Camadas gráficas em ASS (libass do ffmpeg): título de abertura, nome do capítulo, marca do canal e
// legenda no longo; gancho e legenda dinâmica (palavra destacada) no curto; cartelas de data; capas.
import {
  LONGO, CURTO, cabecalhoAss, estiloAss, eventoAss, escAss, maiusc, corAss, blocosSrt, blocosDinamicos,
} from './render-comum.js';

const PALAVRAS_FRACAS = new Set(['O', 'A', 'OS', 'AS', 'E', 'DE', 'DO', 'DA', 'DOS', 'DAS', 'EM', 'NO', 'NA', 'UM', 'UMA', 'PRA', 'PARA', 'COM', 'POR', 'QUE', 'SE', 'AO', 'MEU', 'MINHA', 'EU', 'É']);

/** Palavra de destaque de um título: a mais longa entre as não-fracas (empate: a última). */
export function palavraDestaque(texto) {
  const ws = maiusc(texto).split(/\s+/).filter(Boolean);
  let melhor = -1, tam = -1;
  ws.forEach((w, i) => { const l = w.replace(/[^\p{L}\p{N}]/gu, '').length; if (!PALAVRAS_FRACAS.has(w) && l >= tam) { tam = l; melhor = i; } });
  return melhor;
}

function realce(texto, idx, cor, maxChars = 0) {
  const ws = maiusc(texto).split(/\s+/).filter(Boolean);
  const quebras = maxChars ? quebrasEquilibradas(ws, maxChars) : new Set();
  return ws.map((w, i) => (i === idx ? `{\\c${corAss(cor)}}${escAss(w)}{\\r}` : escAss(w)) + (i < ws.length - 1 ? (quebras.has(i) ? '\\N' : ' ') : '')).join('');
}

/** Índices das palavras depois das quais quebra a linha: menor número de linhas, linhas parecidas. */
export function quebrasEquilibradas(ws, maxChars) {
  const total = ws.join(' ').length;
  const nLinhas = Math.max(1, Math.ceil(total / maxChars));
  const alvo = total / nLinhas;
  const q = new Set();
  let atual = 0;
  ws.forEach((w, i) => {
    atual += (atual ? 1 : 0) + w.length;
    const prox = ws[i + 1];
    if (prox === undefined || q.size >= nLinhas - 1) return;
    const fraca = PALAVRAS_FRACAS.has(w) && w.length <= 3;
    if (!fraca && (atual >= alvo - 1 || atual + 1 + prox.length > maxChars)) { q.add(i); atual = 0; }
  });
  return q;
}

/**
 * ASS do longo 16:9. segmentos/duracao da timeline; falas recortadas (para legenda queimada, opcional).
 */
export function assLongo({ segmentos, duracao, titulo, intro, canal, fontes, falas = null, capitulos = [] }) {
  const { w: W, h: H } = LONGO;
  const c = canal.cores;
  const est = [
    estiloAss('Titulo', fontes.titulo, 112, { cor: c.texto, borda: 6, sombra: 3, alin: 5, ml: 140, mr: 140 }),
    estiloAss('Sub', fontes.titulo, 50, { cor: c.destaque, borda: 4, sombra: 2, alin: 5 }),
    estiloAss('Leg', fontes.titulo, 54, { cor: '#FFFFFF', borda: 3.5, sombra: 1.5, alin: 2, mv: 70, ml: 200, mr: 200 }),
    estiloAss('Marca', fontes.titulo, 32, { cor: '#FFFFFF', borda: 2, sombra: 0, alin: 9, mv: 40, mr: 50 }),
    estiloAss('Cap', fontes.titulo, 44, { cor: '#111111', caixa: true, fundo: c.destaque, alfaFundo: 0, borda: 14, sombra: 0, alin: 7, ml: 70, mv: 60 }),
    estiloAss('Cartela', fontes.titulo, 140, { cor: c.texto, borda: 0, sombra: 0, alin: 5 }),
    estiloAss('CartelaSub', fontes.titulo, 56, { cor: c.destaque, borda: 0, sombra: 0, alin: 5 }),
  ];
  const ev = [];
  const tituloTxt = titulo || intro || '';
  if (tituloTxt && segmentos.length && segmentos[0].tipo !== 'cartela') {
    const fim = Math.min(4.2, Math.max(2, duracao - 0.5));
    const anim = `{\\fad(350,450)\\move(${W / 2},${H / 2 + 18},${W / 2},${H / 2 - 30},0,600)\\blur0.6}`;
    ev.push(eventoAss(0.3, fim, 'Titulo', anim + realce(tituloTxt, palavraDestaque(tituloTxt), c.destaque), 2));
    if (intro && intro !== tituloTxt) ev.push(eventoAss(0.6, fim, 'Sub', `{\\fad(350,450)\\pos(${W / 2},${H / 2 + 70})}${escAss(intro)}`, 2));
    // faixa escura suave atrás do título (legibilidade sobre qualquer imagem)
    ev.push(eventoAss(0.3, fim, 'Cartela', `{\\an7\\pos(0,${H / 2 - 170})\\bord0\\shad0\\1c&H000000&\\1a&H90&\\fad(350,450)\\blur40\\p1}m 0 0 l ${W} 0 ${W} 300 0 300{\\p0}`, 1));
  }
  // nome do capítulo (lower third) quando muda, exceto o primeiro
  for (const cap of capitulos.slice(1)) {
    ev.push(eventoAss(cap.t + 0.3, Math.min(duracao, cap.t + 3.3), 'Cap', `{\\fad(200,300)}${escAss(maiusc(cap.nome))}`, 3));
  }
  // cartelas de data (compilado)
  for (const s of segmentos.filter((x) => x.tipo === 'cartela')) {
    ev.push(eventoAss(s.offset + 0.15, s.offset + s.dur - 0.1, 'Cartela', `{\\fad(250,250)\\pos(${W / 2},${H / 2 - 30})}${escAss(maiusc(s.texto))}`, 2));
    if (s.subtexto) ev.push(eventoAss(s.offset + 0.3, s.offset + s.dur - 0.1, 'CartelaSub', `{\\fad(250,250)\\pos(${W / 2},${H / 2 + 80})}${escAss(s.subtexto)}`, 2));
  }
  if (canal.marcaDagua && canal.arroba && duracao > 6) {
    ev.push(eventoAss(4.5, duracao, 'Marca', `{\\alpha&H60&}${escAss(canal.arroba)}`, 0));
  }
  if (falas) {
    for (const b of blocosSrt(falas, { maxChars: 42 })) ev.push(eventoAss(b.ini, b.fim, 'Leg', b.linhas.map(escAss).join('\\N'), 1));
  }
  return cabecalhoAss(W, H, est) + ev.join('\n') + '\n';
}

/**
 * ASS do curto 9:16: gancho nos 2 primeiros segundos + legenda dinâmica (2–4 palavras, palavra
 * falada em destaque) + rótulos opcionais por segmento (data no compilado).
 */
export function assCurto({ segmentos, duracao, gancho, canal, fontes, falas = [], durGancho = 2.2 }) {
  const { w: W, h: H } = CURTO;
  const c = canal.cores;
  const est = [
    estiloAss('Gancho', fontes.legenda, 98, { cor: '#111111', caixa: true, fundo: c.destaque, alfaFundo: 0, borda: 18, sombra: 0, alin: 8, ml: 90, mr: 90 }),
    estiloAss('Din', fontes.legenda, 96, { cor: c.texto, contorno: c.contorno, borda: 7, sombra: 3, alin: 5, ml: 70, mr: 70 }),
    estiloAss('Rotulo', fontes.titulo, 46, { cor: '#FFFFFF', caixa: true, fundo: '#000000', alfaFundo: 80, borda: 12, sombra: 0, alin: 7, ml: 70 }),
    estiloAss('Marca', fontes.titulo, 34, { cor: '#FFFFFF', borda: 2, sombra: 0, alin: 2, mv: 360 }),
    estiloAss('Cartela', fontes.titulo, 120, { cor: c.texto, borda: 0, sombra: 0, alin: 5 }),
  ];
  const ev = [];
  const fimG = Math.min(durGancho, duracao);
  if (gancho) {
    const pop = `{\\pos(${W / 2},300)\\fscx70\\fscy70\\t(0,160,\\fscx106\\fscy106)\\t(160,260,\\fscx100\\fscy100)\\fad(0,180)}`;
    ev.push(eventoAss(0, fimG, 'Gancho', pop + escAss(maiusc(gancho)), 3));
  }
  for (const s of segmentos) {
    if (s.rotulo) ev.push(eventoAss(s.offset + (s.offset < fimG ? fimG : 0.1), s.offset + s.dur, 'Rotulo', `{\\pos(70,${s.offset < fimG ? 300 : 270})\\fad(150,150)}${escAss(s.rotulo)}`, 2));
    if (s.tipo === 'cartela') ev.push(eventoAss(s.offset, s.offset + s.dur, 'Cartela', `{\\pos(${W / 2},${H / 2})\\fad(200,200)}${escAss(maiusc(s.texto))}`, 2));
  }
  const blocos = blocosDinamicos(falas, { min: 2, max: 4 });
  blocos.forEach((b, bi) => {
    const fimBloco = Math.min(bi + 1 < blocos.length ? blocos[bi + 1].ini : b.fim + 0.4, b.fim + 0.4);
    b.palavras.forEach((p, i) => {
      const ini = i === 0 ? b.ini : p.t0;
      const fim = i + 1 < b.palavras.length ? b.palavras[i + 1].t0 : fimBloco;
      if (fim - ini < 0.01) return;
      const txt = b.palavras.map((q, j) => (j === i
        ? `{\\c${corAss(c.destaque)}\\fscx112\\fscy112}${escAss(maiusc(q.w))}{\\r}`
        : escAss(maiusc(q.w)))).join(' ');
      const entra = i === 0 ? '{\\fscx85\\fscy85\\t(0,90,\\fscx100\\fscy100)}' : '';
      ev.push(eventoAss(ini, fim, 'Din', `{\\pos(${W / 2},1330)}${entra}${txt}`, 1));
    });
  });
  if (canal.marcaDagua && canal.arroba) ev.push(eventoAss(fimG, duracao, 'Marca', `{\\alpha&H70&}${escAss(canal.arroba)}`, 0));
  return cabecalhoAss(W, H, est) + ev.join('\n') + '\n';
}

/** ASS de uma capa (imagem única): título grande com palavra destacada + nome do canal. */
export function assCapa({ alvo, texto, canal, fontes }) {
  const { w: W, h: H } = alvo;
  const c = canal.cores;
  const vertical = H > W;
  // tamanho que cabe: a linha mais longa ocupa a largura útil (largura média do caractere ≈ 0,7 em)
  const maxChars = vertical ? 12 : 11;
  const ws = maiusc(texto).split(/\s+/).filter(Boolean);
  const qb = quebrasEquilibradas(ws, maxChars);
  let linha = 0, maior = 0;
  ws.forEach((w, i) => { linha += (linha ? 1 : 0) + w.length; if (qb.has(i) || i === ws.length - 1) { maior = Math.max(maior, linha); linha = 0; } });
  const util = vertical ? W - 160 : W * 0.6;
  const tam = Math.round(Math.min(vertical ? 140 : 124, util / (Math.max(4, maior) * 0.72)));
  const est = [
    estiloAss('Capa', fontes.legenda, tam, { cor: c.texto, contorno: '#000000', borda: vertical ? 10 : 8, sombra: 6, alin: vertical ? 5 : 4, ml: vertical ? 80 : 70, mr: vertical ? 80 : Math.round(W * 0.38) }),
    estiloAss('Canal', fontes.titulo, vertical ? 52 : 36, { cor: '#111111', caixa: true, fundo: c.destaque, alfaFundo: 0, borda: 12, sombra: 0, alin: vertical ? 2 : 1, ml: 70, mv: vertical ? 420 : 50 }),
    estiloAss('Sombra', fontes.titulo, 20, { borda: 0, sombra: 0, alin: 7 }),
  ];
  const ev = [];
  const grad = vertical
    ? `{\\an7\\pos(0,${Math.round(H * 0.28)})\\1c&H000000&\\1a&H70&\\blur60\\p1}m 0 0 l ${W} 0 ${W} ${Math.round(H * 0.34)} 0 ${Math.round(H * 0.34)}{\\p0}`
    : `{\\an7\\pos(-80,-80)\\1c&H000000&\\1a&H50&\\blur70\\p1}m 0 0 l ${Math.round(W * 0.66)} 0 ${Math.round(W * 0.56)} ${H + 160} 0 ${H + 160}{\\p0}`;
  ev.push(eventoAss(0, 10, 'Sombra', grad, 0));
  const pos = vertical ? `{\\pos(${W / 2},${Math.round(H * 0.45)})}` : `{\\pos(70,${H / 2 - 10})}`;
  ev.push(eventoAss(0, 10, 'Capa', pos + realce(texto, palavraDestaque(texto), c.destaque, maxChars), 1));
  if (canal.nome) ev.push(eventoAss(0, 10, 'Canal', escAss(maiusc(canal.nome)), 2));
  return cabecalhoAss(W, H, est) + ev.join('\n') + '\n';
}
