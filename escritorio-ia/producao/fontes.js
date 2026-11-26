#!/usr/bin/env node
// Coleta de pautas do canal gamer: promoções (Steam, Epic) e notícias (RSS/Atom).
// Uso: node producao/fontes.js [--tema gta|promocoes|lancamentos|tudo] [--saida <arquivo.json>]
// Grava producao/trabalho/fontes-<aaaa-mm-dd>.json e imprime um resumo.
// Node >= 18 puro (fetch global), sem dependências. Lista de fontes em producao/fontes.json.
// Atrás de proxy corporativo (HTTPS_PROXY), rode com NODE_USE_ENV_PROXY=1 (Node >= 22.21).

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const TEMAS = ['gta', 'promocoes', 'lancamentos', 'tudo'];
export const USER_AGENT = 'Mozilla/5.0 (compatible; leitor-noticias-gamer/1.0)';

export const PALAVRAS_RUMOR = [
  'rumor', 'rumores', 'vazou', 'vazam', 'vazaram', 'vazamento', 'vazamentos', 'leak', 'leaks',
  'leaked', 'insider', 'suposto', 'suposta', 'supostamente', 'boato', 'boatos', 'segundo fontes',
  'teria sido', 'pode ter vazado',
];

// ---------------------------------------------------------------- texto / entidades

const ENTIDADES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
  hellip: '…', laquo: '«', raquo: '»', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  bull: '•', middot: '·', copy: '©', reg: '®', trade: '™', deg: '°', ordm: 'º', ordf: 'ª',
  euro: '€', iexcl: '¡', iquest: '¿',
  aacute: 'á', agrave: 'à', acirc: 'â', atilde: 'ã', auml: 'ä', eacute: 'é', egrave: 'è',
  ecirc: 'ê', euml: 'ë', iacute: 'í', igrave: 'ì', icirc: 'î', iuml: 'ï', oacute: 'ó',
  ograve: 'ò', ocirc: 'ô', otilde: 'õ', ouml: 'ö', uacute: 'ú', ugrave: 'ù', ucirc: 'û',
  uuml: 'ü', ccedil: 'ç', ntilde: 'ñ',
  Aacute: 'Á', Agrave: 'À', Acirc: 'Â', Atilde: 'Ã', Auml: 'Ä', Eacute: 'É', Egrave: 'È',
  Ecirc: 'Ê', Iacute: 'Í', Icirc: 'Î', Oacute: 'Ó', Ocirc: 'Ô', Otilde: 'Õ', Ouml: 'Ö',
  Uacute: 'Ú', Uuml: 'Ü', Ccedil: 'Ç', Ntilde: 'Ñ',
};

export function decodificarEntidades(s) {
  if (!s) return '';
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, e) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try { return Number.isFinite(cp) ? String.fromCodePoint(cp) : m; } catch { return m; }
    }
    return Object.prototype.hasOwnProperty.call(ENTIDADES, e) ? ENTIDADES[e] : m;
  });
}

export function semTags(html) {
  return String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

/** HTML/entidades → texto limpo de uma linha. */
export function textoLimpo(s) {
  return decodificarEntidades(semTags(s)).replace(/\s+/g, ' ').trim();
}

function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/** Conteúdo bruto de um campo: junta CDATA (sem decodificar) ou decodifica entidades. Devolve HTML. */
function conteudoCampo(bruto) {
  if (bruto == null) return null;
  if (bruto.includes('<![CDATA[')) {
    let out = '';
    const re = /<!\[CDATA\[([\s\S]*?)\]\]>|([^<]+|<(?!!\[CDATA\[))/g;
    let m;
    while ((m = re.exec(bruto))) out += m[1] != null ? m[1] : decodificarEntidades(m[2]);
    return out;
  }
  return decodificarEntidades(bruto);
}

function campo(bloco, nomes) {
  for (const nome of nomes) {
    const re = new RegExp(`<${escRe(nome)}(\\s[^>]*)?>([\\s\\S]*?)</${escRe(nome)}>`, 'i');
    const m = bloco.match(re);
    if (m) return { atributos: m[1] || '', html: conteudoCampo(m[2]) };
  }
  return null;
}

function atributo(attrs, nome) {
  const m = String(attrs || '').match(new RegExp(`(?:^|\\s)${escRe(nome)}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return m ? decodificarEntidades(m[2] ?? m[3]) : null;
}

function tagsVazias(bloco, nome) {
  const re = new RegExp(`<${escRe(nome)}(\\s[^>]*?)?/?>`, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(bloco))) out.push(m[1] || '');
  return out;
}

function dataISO(s) {
  if (!s) return null;
  const t = Date.parse(String(s).trim());
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

// ---------------------------------------------------------------- RSS / Atom

/**
 * Parser simples de RSS 2.0 e Atom. Devolve { titulo, itens: [{ titulo, url, descricao,
 * publicadoEm, imagem, origem: { nome, url } | null, id }] }.
 */
export function analisarFeed(xml) {
  const doc = String(xml || '').replace(/^﻿/, '');
  const atom = !/<item[\s>]/i.test(doc) && /<entry[\s>]/i.test(doc);
  const tagItem = atom ? 'entry' : 'item';
  const cabecalho = doc.split(new RegExp(`<${tagItem}[\\s>]`, 'i'))[0];
  const tituloFeed = campo(cabecalho, ['title']);
  const itens = [];
  const re = new RegExp(`<${tagItem}(?:\\s[^>]*)?>([\\s\\S]*?)</${tagItem}>`, 'gi');
  let m;
  while ((m = re.exec(doc))) {
    const b = m[1];
    const titulo = textoLimpo(campo(b, ['title'])?.html);

    let url = null;
    const linkTexto = campo(b, ['link']);
    if (linkTexto && linkTexto.html.trim()) url = textoLimpo(linkTexto.html);
    if (!url) {
      const links = tagsVazias(b, 'link');
      const alt = links.find((a) => !atributo(a, 'rel') || atributo(a, 'rel') === 'alternate') || links[0];
      if (alt) url = atributo(alt, 'href');
    }
    const guid = campo(b, ['guid', 'id']);
    if (!url && guid && /^https?:/i.test(guid.html.trim())) url = guid.html.trim();

    const descHtml = (campo(b, ['description', 'summary', 'content:encoded', 'content']) || {}).html || '';
    const data = campo(b, ['pubDate', 'published', 'updated', 'dc:date']);

    let imagem = null;
    for (const nome of ['enclosure', 'media:content', 'media:thumbnail']) {
      for (const a of tagsVazias(b, nome)) {
        const tipo = atributo(a, 'type') || atributo(a, 'medium') || 'image';
        const u = atributo(a, 'url');
        if (u && /image/i.test(tipo)) { imagem = u; break; }
      }
      if (imagem) break;
    }
    if (!imagem) {
      const img = descHtml.match(/<img[^>]+src\s*=\s*["']([^"']+)["']/i);
      if (img) imagem = decodificarEntidades(img[1]);
    }

    const src = campo(b, ['source']);
    const origem = src ? { nome: textoLimpo(src.html), url: atributo(src.atributos, 'url') } : null;

    let tituloFinal = titulo;
    if (origem?.nome && tituloFinal.endsWith(` - ${origem.nome}`)) {
      tituloFinal = tituloFinal.slice(0, -(origem.nome.length + 3)).trim();
    }
    let descricao = textoLimpo(descHtml);
    if (origem?.nome && tituloFinal && descricao.startsWith(tituloFinal)) descricao = ''; // Google Notícias repete o título

    if (!tituloFinal && !url) continue;
    itens.push({
      titulo: tituloFinal,
      url: url || null,
      descricao: descricao.slice(0, 600),
      publicadoEm: dataISO(data && textoLimpo(data.html)),
      imagem: imagem || null,
      origem,
      id: guid ? textoLimpo(guid.html) : url,
    });
  }
  return { titulo: textoLimpo(tituloFeed?.html), formato: atom ? 'atom' : 'rss', itens };
}

// ---------------------------------------------------------------- rumor / temas / dedupe

function normalizar(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function contemPalavra(textoNorm, palavra) {
  const p = normalizar(palavra);
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escRe(p)}($|[^\\p{L}\\p{N}])`, 'u').test(textoNorm);
}

/** { rumor: boolean, palavras: [...] } — palavras de rumor achadas no texto. */
export function detectarRumor(texto, palavras = PALAVRAS_RUMOR) {
  const t = normalizar(texto);
  const achadas = palavras.filter((p) => contemPalavra(t, p));
  return { rumor: achadas.length > 0, palavras: achadas };
}

export function temasDoTexto(texto, palavrasTema = {}) {
  const t = normalizar(texto);
  return Object.entries(palavrasTema)
    .filter(([, lista]) => lista.some((p) => contemPalavra(t, p)))
    .map(([tema]) => tema);
}

export function chaveTitulo(titulo) {
  return normalizar(titulo).replace(/[^a-z0-9]+/g, ' ').trim();
}

const PALAVRAS_VAZIAS = new Set(['para', 'com', 'que', 'dos', 'das', 'uma', 'por', 'como', 'mais', 'the', 'and', 'nos', 'nas', 'sobre', 'seu', 'sua']);

function tokensTitulo(titulo) {
  return new Set(chaveTitulo(titulo).split(' ').filter((w) => w.length >= 3 && !PALAVRAS_VAZIAS.has(w)));
}

/** Semelhança de Jaccard entre as palavras significativas de dois títulos (0..1). */
export function semelhancaTitulos(a, b) {
  const ta = tokensTitulo(a);
  const tb = tokensTitulo(b);
  if (ta.size < 4 || tb.size < 4) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  return inter / (ta.size + tb.size - inter);
}

function chaveUrl(u) {
  if (!u) return null;
  try {
    const x = new URL(u);
    return (x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/+$/, '')).toLowerCase();
  } catch { return String(u).toLowerCase(); }
}

/**
 * Remove repetidos (mesma URL, mesmo título normalizado ou títulos quase iguais, Jaccard >= limiar). O primeiro fica; as outras fontes
 * que deram a mesma notícia vão para `tambemEm` (ajuda a conferir "em 2 fontes").
 */
export function deduplicar(itens, { limiar = 0.75 } = {}) {
  const porChave = new Map();
  const out = [];
  for (const it of itens) {
    const chaves = [chaveUrl(it.url), it.titulo ? 't:' + chaveTitulo(it.titulo) : null].filter(Boolean);
    const existente = chaves.map((k) => porChave.get(k)).find(Boolean)
      || (it.titulo ? out.find((o) => o.titulo && semelhancaTitulos(o.titulo, it.titulo) >= limiar) : null);
    if (existente) {
      const nome = it.fonte || it.origem?.nome;
      if (nome && nome !== existente.fonte && !existente.tambemEm.includes(nome)) existente.tambemEm.push(nome);
      if (!existente.imagem && it.imagem) existente.imagem = it.imagem;
      existente.oficial = existente.oficial || !!it.oficial;
      for (const k of chaves) porChave.set(k, existente);
      continue;
    }
    const novo = { ...it, tambemEm: [...(it.tambemEm || [])] };
    out.push(novo);
    for (const k of chaves) porChave.set(k, novo);
  }
  return out;
}

export function ordenarPorData(itens) {
  return [...itens].sort((a, b) => (Date.parse(b.publicadoEm) || 0) - (Date.parse(a.publicadoEm) || 0));
}

export function dominioOficial(url, dominios = []) {
  if (!url) return false;
  let host;
  try { host = new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return false; }
  return dominios.some((d) => host === d || host.endsWith('.' + d));
}

// ---------------------------------------------------------------- lojas

export function formatarBRL(centavos) {
  if (!Number.isFinite(centavos)) return null;
  const v = (centavos / 100).toFixed(2).split('.');
  return `R$ ${v[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${v[1]}`;
}

function horasAte(iso, agora) {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.round(((t - agora) / 36e5) * 10) / 10 : null;
}

function urlSteam(item) {
  return item.type === 1 ? `https://store.steampowered.com/sub/${item.id}/` : `https://store.steampowered.com/app/${item.id}/`;
}

/**
 * featuredcategories da Steam → { promocoes, lancamentos }.
 * Promoções: itens com desconto de specials e top_sellers. Lançamentos: new_releases/coming_soon.
 */
export function analisarSteam(json, { agora = Date.now(), fonte = 'Steam' } = {}) {
  const promocoes = new Map();
  for (const lista of ['specials', 'top_sellers']) {
    for (const it of json?.[lista]?.items || []) {
      if (!it || !it.discounted || !(it.discount_percent > 0)) continue;
      const ex = promocoes.get(it.id);
      if (ex) { if (!ex.listas.includes(lista)) ex.listas.push(lista); continue; }
      const terminaEm = it.discount_expiration ? new Date(it.discount_expiration * 1000).toISOString() : null;
      promocoes.set(it.id, {
        loja: 'steam', tipo: 'desconto', id: it.id, nome: it.name,
        de: formatarBRL(it.original_price), por: formatarBRL(it.final_price),
        deCentavos: it.original_price ?? null, porCentavos: it.final_price ?? null,
        moeda: it.currency || 'BRL', desconto: it.discount_percent,
        terminaEm, horasRestantes: horasAte(terminaEm, agora),
        url: urlSteam(it), imagem: it.header_image || it.large_capsule_image || null,
        imagemUsoLivre: true, credito: 'Steam (capa da loja)', fonte, oficial: true, listas: [lista],
      });
    }
  }
  const lancamentos = [];
  const vistos = new Set();
  for (const lista of ['new_releases', 'coming_soon']) {
    for (const it of json?.[lista]?.items || []) {
      if (!it || vistos.has(it.id)) continue;
      vistos.add(it.id);
      lancamentos.push({
        loja: 'steam', estado: lista === 'coming_soon' ? 'em-breve' : 'novo', id: it.id, nome: it.name,
        preco: Number.isFinite(it.final_price) ? formatarBRL(it.final_price) : null,
        desconto: it.discount_percent || 0, url: urlSteam(it),
        imagem: it.header_image || it.large_capsule_image || null, imagemUsoLivre: true,
        credito: 'Steam (capa da loja)', fonte, oficial: true, lista,
      });
    }
  }
  return {
    promocoes: [...promocoes.values()].sort((a, b) => b.desconto - a.desconto),
    lancamentos,
  };
}

function urlEpic(el) {
  const slug = el.catalogNs?.mappings?.find((m) => m.pageType === 'productHome')?.pageSlug
    || el.offerMappings?.find((m) => m.pageSlug)?.pageSlug
    || (el.productSlug ? el.productSlug.replace(/\/home$/, '') : null);
  return slug ? `https://store.epicgames.com/pt-BR/p/${slug}` : 'https://store.epicgames.com/pt-BR/free-games';
}

function imagemEpic(el) {
  const prefer = ['OfferImageWide', 'DieselStoreFrontWide', 'featuredMedia', 'Thumbnail', 'OfferImageTall'];
  for (const tipo of prefer) {
    const k = (el.keyImages || []).find((i) => i.type === tipo && i.url);
    if (k) return k.url;
  }
  return null;
}

/**
 * freeGamesPromotions da Epic → jogos grátis promocionais ativos e próximos.
 * Na Epic, discountPercentage é o percentual do preço que se PAGA: 0 = grátis.
 */
export function analisarEpic(json, { agora = Date.now(), fonte = 'Epic Games Store' } = {}) {
  const out = [];
  for (const el of json?.data?.Catalog?.searchStore?.elements || []) {
    const grupos = [
      ['ativo', el.promotions?.promotionalOffers || []],
      ['proximo', el.promotions?.upcomingPromotionalOffers || []],
    ];
    for (const [estado, lista] of grupos) {
      for (const g of lista) {
        for (const o of g.promotionalOffers || []) {
          if (o.discountSetting?.discountPercentage !== 0) continue;
          const ini = Date.parse(o.startDate);
          const fim = Date.parse(o.endDate);
          if (Number.isFinite(fim) && fim <= agora) continue;
          const est = estado === 'ativo' && Number.isFinite(ini) && ini > agora ? 'proximo' : estado;
          if (est === 'ativo' && el.price?.totalPrice && el.price.totalPrice.discountPrice !== 0) continue;
          out.push({
            loja: 'epic', tipo: 'gratis', estado: est, id: el.id, nome: el.title,
            misterioso: /myster|mist[eé]rio/i.test(el.title || ''),
            precoOriginal: formatarBRL(el.price?.totalPrice?.originalPrice),
            freeToPlay: el.price?.totalPrice?.originalPrice === 0,
            inicio: Number.isFinite(ini) ? new Date(ini).toISOString() : null,
            terminaEm: Number.isFinite(fim) ? new Date(fim).toISOString() : null,
            horasRestantes: est === 'ativo' && Number.isFinite(fim) ? horasAte(new Date(fim).toISOString(), agora) : null,
            url: urlEpic(el), imagem: imagemEpic(el), imagemUsoLivre: true,
            credito: 'Epic Games Store (capa da loja)', fonte, oficial: true,
          });
        }
      }
    }
  }
  const visto = new Set();
  return out
    .filter((g) => { const k = g.id + g.estado + g.inicio; if (visto.has(k)) return false; visto.add(k); return true; })
    .sort((a, b) => (a.estado === b.estado ? 0 : a.estado === 'ativo' ? -1 : 1) || (Date.parse(a.inicio) || 0) - (Date.parse(b.inicio) || 0));
}

// ---------------------------------------------------------------- rede

export async function buscarTexto(url, { timeoutMs = 15000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json, application/rss+xml, application/xml, text/xml, */*' },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`tempo esgotado (${timeoutMs} ms)`);
    throw new Error(e.cause?.code ? `${e.message} (${e.cause.code})` : e.message);
  } finally {
    clearTimeout(t);
  }
}

function urlDaFonte(f) {
  return f.busca ? f.url.replace('{termo}', encodeURIComponent(f.busca)) : f.url;
}

/** Coleta tudo de acordo com o tema. `buscar` pode ser trocado em testes. */
export async function coletar({ tema = 'tudo', config, agora = Date.now(), buscar = buscarTexto } = {}) {
  const fontes = (config.fontes || []).filter((f) => f.ativo !== false && (tema === 'tudo' || (f.temas || []).includes(tema)));
  const palavrasRumor = config.palavrasRumor || PALAVRAS_RUMOR;
  const resultado = { promocoes: [], gratis: [], lancamentos: [], noticias: [], erros: [], fontesConsultadas: [] };
  const limiteData = agora - (config.maxDiasNoticia ?? 7) * 864e5;

  await Promise.all(fontes.map(async (f) => {
    const url = urlDaFonte(f);
    const inicio = Date.now();
    try {
      const texto = await buscar(url, { timeoutMs: config.timeoutMs ?? 15000 });
      let n = 0;
      if (f.tipo === 'steam') {
        const s = analisarSteam(JSON.parse(texto), { agora, fonte: f.nome });
        if (tema === 'tudo' || tema === 'promocoes') { resultado.promocoes.push(...s.promocoes); n += s.promocoes.length; }
        if (tema === 'tudo' || tema === 'lancamentos') { resultado.lancamentos.push(...s.lancamentos); n += s.lancamentos.length; }
      } else if (f.tipo === 'epic') {
        const g = analisarEpic(JSON.parse(texto), { agora, fonte: f.nome });
        resultado.gratis.push(...g); n = g.length;
      } else {
        const feed = analisarFeed(texto);
        if (!feed.itens.length && !/<(rss|feed|rdf)/i.test(texto)) throw new Error('resposta não parece RSS/Atom');
        for (const it of feed.itens.slice(0, config.maxItensPorFeed ?? 40)) {
          const pub = Date.parse(it.publicadoEm);
          if (Number.isFinite(pub) && pub < limiteData) continue;
          const texto2 = `${it.titulo} ${it.descricao}`;
          const temas = temasDoTexto(texto2, config.palavrasTema);
          if (f.busca) for (const t of f.temas || []) if (!temas.includes(t)) temas.push(t);
          if (tema !== 'tudo' && !temas.includes(tema)) continue;
          const r = detectarRumor(texto2, palavrasRumor);
          const origemUrl = it.origem?.url || it.url;
          resultado.noticias.push({
            titulo: it.titulo, descricao: it.descricao, url: it.url,
            fonte: it.origem?.nome || f.nome, viaFeed: f.nome,
            oficial: !!f.oficial || dominioOficial(origemUrl, config.dominiosOficiais),
            publicadoEm: it.publicadoEm, imagem: it.imagem, imagemUsoLivre: false,
            rumor: r.rumor, palavrasRumor: r.palavras, temas,
          });
          n++;
        }
      }
      resultado.fontesConsultadas.push({ id: f.id, nome: f.nome, url, itens: n, ms: Date.now() - inicio });
    } catch (e) {
      resultado.erros.push({ id: f.id, fonte: f.nome, url, erro: e.message });
      resultado.fontesConsultadas.push({ id: f.id, nome: f.nome, url, itens: 0, erro: e.message, ms: Date.now() - inicio });
    }
  }));

  resultado.noticias = ordenarPorData(deduplicar(resultado.noticias));
  resultado.promocoes.sort((a, b) => b.desconto - a.desconto);
  return resultado;
}

// ---------------------------------------------------------------- CLI

function dataLocal(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function lerArgs(argv) {
  const a = { tema: 'tudo', saida: null };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === '--tema') a.tema = argv[++i];
    else if (x.startsWith('--tema=')) a.tema = x.slice(7);
    else if (x === '--saida') a.saida = argv[++i];
    else if (x === '-h' || x === '--help') a.ajuda = true;
  }
  return a;
}

function resumoTexto(dados, arquivo) {
  const l = [];
  const n = dados.noticias;
  l.push(`Fontes gamer (${dados.tema}) — ${dados.geradoEm}`);
  l.push(`Promoções Steam: ${dados.promocoes.length} | Grátis Epic: ${dados.gratis.length} | Lançamentos Steam: ${dados.lancamentos.length} | Notícias: ${n.length} (${n.filter((x) => x.rumor).length} rumor, ${n.filter((x) => x.oficial).length} oficial)`);
  for (const p of dados.promocoes.slice(0, 5)) {
    l.push(`  $ ${p.nome}: ${p.de} → ${p.por} (-${p.desconto}%) até ${p.terminaEm ? p.terminaEm.slice(0, 16).replace('T', ' ') + ' UTC' : '?'}`);
  }
  for (const g of dados.gratis) {
    l.push(`  ★ ${g.estado === 'ativo' ? 'GRÁTIS AGORA' : 'EM BREVE'}: ${g.nome} (${g.inicio?.slice(0, 10)} → ${g.terminaEm?.slice(0, 10)})`);
  }
  for (const x of n.slice(0, 8)) {
    l.push(`  • ${x.rumor ? '[RUMOR] ' : ''}${x.oficial ? '[OFICIAL] ' : ''}${x.titulo} — ${x.fonte}${x.tambemEm.length ? ` (+${x.tambemEm.join(', ')})` : ''}`);
  }
  for (const e of dados.erros) l.push(`  ! ${e.fonte}: ${e.erro}`);
  l.push(`Gravado em ${arquivo}`);
  return l.join('\n');
}

async function principal() {
  const args = lerArgs(process.argv.slice(2));
  if (args.ajuda || !TEMAS.includes(args.tema)) {
    console.log('Uso: node producao/fontes.js [--tema gta|promocoes|lancamentos|tudo] [--saida arquivo.json]');
    process.exit(args.ajuda ? 0 : 2);
  }
  const config = JSON.parse(await readFile(path.join(AQUI, 'fontes.json'), 'utf8'));
  const agora = Date.now();
  const r = await coletar({ tema: args.tema, config, agora });
  const dados = { geradoEm: new Date(agora).toISOString(), data: dataLocal(new Date(agora)), tema: args.tema, ...r };
  const arquivo = args.saida ? path.resolve(args.saida) : path.join(AQUI, 'trabalho', `fontes-${dados.data}.json`);
  await mkdir(path.dirname(arquivo), { recursive: true });
  await writeFile(arquivo, JSON.stringify(dados, null, 2) + '\n');
  console.log(resumoTexto(dados, path.relative(process.cwd(), arquivo) || arquivo));
  if (r.erros.length && process.env.HTTPS_PROXY && !process.env.NODE_USE_ENV_PROXY) {
    console.log('Dica: há HTTPS_PROXY definido; rode com NODE_USE_ENV_PROXY=1 para o fetch do Node usar o proxy.');
  }
  const total = r.promocoes.length + r.gratis.length + r.lancamentos.length + r.noticias.length;
  process.exit(total === 0 ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal().catch((e) => { console.error('Erro:', e.message); process.exit(1); });
}
