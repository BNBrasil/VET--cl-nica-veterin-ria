// Normaliza texto em português do Brasil para a voz soar natural:
// preços, porcentagens, datas, horas, números, siglas e nomes de jogos (pronuncia.json).
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PRODUCAO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ARQUIVO_PRONUNCIA = path.join(PRODUCAO, 'pronuncia.json');

// ---------- números por extenso ----------
const UNIDADES = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
  'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos',
  'setecentos', 'oitocentos', 'novecentos'];

function feminino(txt) {
  return txt.replace(/\bum\b/g, 'uma').replace(/\bdois\b/g, 'duas').replace(/entos\b/g, 'entas');
}

function ate999(n) {
  if (n < 20) return UNIDADES[n];
  if (n < 100) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    return DEZENAS[d] + (u ? ' e ' + UNIDADES[u] : '');
  }
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100);
  const r = n % 100;
  return CENTENAS[c] + (r ? ' e ' + ate999(r) : '');
}

const ESCALAS = [
  [1e12, 'trilhão', 'trilhões'],
  [1e9, 'bilhão', 'bilhões'],
  [1e6, 'milhão', 'milhões'],
];

/** 1234 → "mil duzentos e trinta e quatro". `fem` = concordância feminina (uma, duas, duzentas). */
export function numeroPorExtenso(n, { fem = false } = {}) {
  n = Math.floor(Math.abs(Number(n)));
  if (!Number.isFinite(n)) return '';
  if (n === 0) return 'zero';
  const partes = [];
  let resto = n;
  for (const [valor, sing, plur] of ESCALAS) {
    if (resto >= valor) {
      const q = Math.floor(resto / valor);
      partes.push(ate999Grande(q) + ' ' + (q === 1 ? sing : plur));
      resto %= valor;
    }
  }
  if (resto >= 1000) {
    const q = Math.floor(resto / 1000);
    let t = q === 1 ? 'mil' : ate999(q) + ' mil';
    if (fem && q > 1) t = feminino(ate999(q)) + ' mil';
    partes.push(t);
    resto %= 1000;
  }
  if (resto > 0) {
    let t = ate999(resto);
    if (fem) t = feminino(t);
    partes.push(t);
  }
  // "e" antes do último grupo quando ele é < 100 ou centena redonda (mil e cem, mil e vinte)
  if (partes.length > 1 && (resto < 100 || resto % 100 === 0) && resto > 0) {
    const ult = partes.pop();
    return partes.join(' ') + ' e ' + ult;
  }
  return partes.join(partes.length > 1 && resto === 0 ? ' e ' : ' ');
}

function ate999Grande(q) { return q < 1000 ? ate999(q) : numeroPorExtenso(q); }

/** "4,5" → "quatro vírgula cinco"; "1.299" → "mil duzentos e noventa e nove". */
export function numeroTextoPorExtenso(txt, opts) {
  const limpo = String(txt).replace(/\.(?=\d{3}(\D|$))/g, '');
  const [inteiro, dec] = limpo.split(',');
  let r = numeroPorExtenso(Number(inteiro), opts);
  if (dec) {
    const decFala = /^0/.test(dec) ? [...dec].map((d) => UNIDADES[d]).join(' ') : numeroPorExtenso(Number(dec));
    r += ' vírgula ' + decFala;
  }
  return r;
}

const ORDINAIS_U = ['', 'primeir', 'segund', 'terceir', 'quart', 'quint', 'sext', 'sétim', 'oitav', 'non'];
const ORDINAIS_D = ['', 'décim', 'vigésim', 'trigésim', 'quadragésim', 'quinquagésim'];
export function ordinal(n, genero = 'o') {
  if (n < 1 || n > 59) return numeroPorExtenso(n);
  const d = Math.floor(n / 10);
  const u = n % 10;
  return [ORDINAIS_D[d] && ORDINAIS_D[d] + genero, ORDINAIS_U[u] && ORDINAIS_U[u] + genero].filter(Boolean).join(' ');
}

// ---------- dinheiro ----------
const MOEDAS = {
  'R$': ['real', 'reais'],
  'US$': ['dólar', 'dólares'],
  'U$': ['dólar', 'dólares'],
  '$': ['dólar', 'dólares'],
  '€': ['euro', 'euros'],
};

/** "R$ 79,96" → "setenta e nove reais e noventa e seis centavos" */
export function precoPorExtenso(simbolo, valor) {
  const [sing, plur] = MOEDAS[simbolo] || MOEDAS['R$'];
  const limpo = valor.replace(/\.(?=\d{3})/g, '').replace(/\s/g, '');
  const [intStr, centStr = ''] = limpo.split(',');
  const inteiro = Number(intStr || 0);
  const centavos = centStr ? Number((centStr + '0').slice(0, 2)) : 0;
  const partes = [];
  if (inteiro > 0) {
    let t = numeroPorExtenso(inteiro);
    // "um milhão de reais"
    if (inteiro >= 1e6 && inteiro % 1e6 === 0) t += ' de';
    partes.push(`${t} ${inteiro === 1 ? sing : plur}`);
  }
  if (centavos > 0) partes.push(`${numeroPorExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`);
  if (!partes.length) return `zero ${plur}`;
  return partes.join(' e ');
}

// ---------- datas ----------
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto',
  'setembro', 'outubro', 'novembro', 'dezembro'];

export function dataPorExtenso(dia, mes, ano) {
  const d = Number(dia) === 1 ? 'primeiro' : numeroPorExtenso(Number(dia));
  let r = `${d} de ${MESES[Number(mes) - 1]}`;
  if (ano) {
    let a = Number(ano);
    if (String(ano).length === 2) a += 2000;
    r += ` de ${numeroPorExtenso(a)}`;
  }
  return r;
}

// ---------- siglas ----------
const LETRAS = {
  a: 'á', b: 'bê', c: 'cê', d: 'dê', e: 'é', f: 'éfe', g: 'gê', h: 'agá', i: 'í', j: 'jóta', k: 'cá',
  l: 'éle', m: 'ême', n: 'êne', o: 'ó', p: 'pê', q: 'quê', r: 'érre', s: 'ésse', t: 'tê', u: 'ú',
  v: 'vê', w: 'dáblio', x: 'xis', y: 'ípsilon', z: 'zê',
};
export function soletrar(sigla) {
  return [...sigla.toLowerCase()].map((c) => LETRAS[c] || c).join(' ');
}

// Palavras curtas em maiúsculas que NÃO são siglas (narração às vezes vem em caixa alta).
const NAO_SIGLAS = new Set(['É', 'NÃO', 'SIM', 'JÁ', 'SÓ', 'MAS', 'COM', 'SEM', 'QUE', 'POR', 'PRA', 'PARA',
  'UM', 'UMA', 'OS', 'AS', 'DE', 'DO', 'DA', 'EM', 'NO', 'NA', 'AO', 'E', 'O', 'A', 'OU', 'SEU', 'SUA',
  'MAIS', 'TEM', 'VAI', 'AGORA', 'HOJE', 'NOVO', 'NOVA', 'ELE', 'ELA', 'ATÉ', 'BOM', 'TOP', 'OFF', 'FIM',
  'VEM', 'AÍ', 'ISSO', 'ESSE', 'ESSA', 'GRÁTIS', 'SAIU', 'ANO', 'DIA', 'MÊS', 'VER', 'LOL', 'ZERO']);

const ROMANOS = { II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, XI: 11, XII: 12, XIII: 13,
  XIV: 14, XV: 15, XVI: 16 };

// ---------- dicionário de pronúncia ----------
let dicCache = null;
export function carregarPronuncia(arquivo = ARQUIVO_PRONUNCIA) {
  if (dicCache && dicCache.arquivo === arquivo) return dicCache.lista;
  let obj = {};
  if (existsSync(arquivo)) {
    try { obj = JSON.parse(readFileSync(arquivo, 'utf8')); } catch (e) {
      throw new Error(`pronuncia.json inválido: ${e.message}`);
    }
  }
  const lista = Object.entries(obj)
    .filter(([k, v]) => !k.startsWith('_') && typeof v === 'string')
    .sort((a, b) => b[0].length - a[0].length);
  dicCache = { arquivo, lista };
  return lista;
}

function escaparRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Limites de palavra que entendem acentos.
const L = '[\\p{L}\\p{N}]';
function regexTermo(termo) {
  return new RegExp(`(?<!${L})${escaparRegex(termo)}(?!${L})`, 'giu');
}

const FEMININOS = 'horas?|semanas?|vezes|edições|edição|unidades?|missões|missão|fases?|temporadas?|' +
  'pessoas?|vagas?|cópias?|páginas?|partidas?|armas?|cidades?|placas?|versões|versão|notas?|estrelas?|' +
  'mil|centenas?';

/**
 * Texto da pauta → texto para a voz falar.
 * @param {string} texto
 * @param {{pronuncia?: Array<[string,string]>}} [opts]
 */
export function normalizarTexto(texto, opts = {}) {
  const dic = opts.pronuncia || carregarPronuncia();
  let t = String(texto ?? '');

  // marcações de destaque da legenda (*palavra*), URLs, hashtags, emojis
  t = t.replace(/\*/g, '');
  t = t.replace(/https?:\/\/\S+/g, '');
  t = t.replace(/(^|\s)[#@](\p{L}[\p{L}\p{N}_]*)/gu, '$1$2');
  t = t.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '');
  t = t.replace(/[“”«»]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, ', ');

  // preços: "R$ 79,96", "R$79", "US$ 69,99", "€ 10"
  t = t.replace(/(US\$|U\$|R\$|€|\$)\s?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/g,
    (_, s, v) => precoPorExtenso(s, v));
  // "79,90 reais"
  t = t.replace(/(\d+),(\d{2})\s+reais/g, (_, i, c) => precoPorExtenso('R$', `${i},${c}`));

  // porcentagens: "-60%" → "sessenta por cento de desconto"; "60% off" idem; "até 90%"
  t = t.replace(/(^|[\s(])[-−](\d+(?:,\d+)?)\s?%(\s*(?:off|OFF|de desconto))?/g,
    (_, a, n) => `${a}${numeroTextoPorExtenso(n)} por cento de desconto`);
  t = t.replace(/(\d+(?:,\d+)?)\s?%\s*(?:off|OFF)\b/g, (_, n) => `${numeroTextoPorExtenso(n)} por cento de desconto`);
  t = t.replace(/(\d+(?:,\d+)?)\s?%/g, (_, n) => `${numeroTextoPorExtenso(n)} por cento`);

  // datas dd/mm/aaaa e dd/mm
  t = t.replace(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?\b/g, (m, d, mes, a) => {
    if (Number(mes) < 1 || Number(mes) > 12 || Number(d) < 1 || Number(d) > 31) return m;
    return dataPorExtenso(d, mes, a);
  });
  // "1º de dezembro", "dia 1º"
  t = t.replace(/\b1º(?=\s+de\s+\p{L})/gu, 'primeiro');
  // horas: 18h, 18h30, 18:30
  t = t.replace(/\b(\d{1,2})(?:h|:)(\d{2})\b/g, (_, h, m) =>
    `${numeroPorExtenso(Number(h), { fem: true })} e ${numeroPorExtenso(Number(m))}`);
  t = t.replace(/\b(\d{1,2})h\b/g, (_, h) => `${numeroPorExtenso(Number(h), { fem: true })} ${Number(h) === 1 ? 'hora' : 'horas'}`);
  // dicionário (nomes de jogos com número: "GTA VI", "Cyberpunk 2077") antes de números e siglas
  const marcas = [];
  for (const [termo, fala] of dic) {
    t = t.replace(regexTermo(termo), () => {
      marcas.push(fala);
      return String.fromCharCode(0xe000 + marcas.length - 1);
    });
  }

  // ordinais 3º, 2ª
  t = t.replace(/\b(\d{1,2})([ºª])/g, (_, n, g) => ordinal(Number(n), g === 'ª' ? 'a' : 'o'));

  // símbolos
  t = t.replace(/\s&\s/g, ' e ').replace(/\s\+\s/g, ' mais ').replace(/\bvs\.?\s/gi, 'versus ');
  t = t.replace(/(\p{L})\/(\p{L})/gu, '$1 e $2');

  // sigla+número colados: RTX5090, PS6
  t = t.replace(/\b([A-Z]{1,4})(\d{1,4})\b/g, (_, s, n) => `${soletrar(s)} ${numeroPorExtenso(Number(n))}`);

  // algarismos romanos depois de nome próprio: "Final Fantasy VII" → sete (X sozinho fica, ex. "Series X")
  t = t.replace(/(\p{Lu}[\p{L}']*\s)(II|III|IV|V|VI|VII|VIII|IX|XI|XII|XIII|XIV|XV|XVI)(?![\p{L}\p{N}])/gu,
    (_, ant, r) => ant + numeroPorExtenso(ROMANOS[r]));

  // siglas em caixa alta (2–4 letras) que não são palavras comuns
  t = t.replace(/(?<![\p{L}\p{N}])(\p{Lu}{2,4})(?![\p{L}\p{N}])/gu, (m) => (NAO_SIGLAS.has(m) ? m : soletrar(m)));

  // números: com concordância feminina antes de substantivos femininos
  t = t.replace(new RegExp(`\\b(\\d{1,3}(?:\\.\\d{3})+|\\d+)(?=\\s+(?:${FEMININOS})\\b)`, 'giu'),
    (n) => numeroTextoPorExtenso(n, { fem: true }));
  t = t.replace(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/g, (n) => numeroTextoPorExtenso(n));

  // devolve o dicionário
  t = t.replace(/[\ue000-\uf8ff]/g, (c) => marcas[c.charCodeAt(0) - 0xe000]);

  // pontuação e espaços
  t = t.replace(/\s*([,.!?;:])(?=\S)/g, '$1 ').replace(/\s+([,.!?;:])/g, '$1');
  t = t.replace(/[ \t]+/g, ' ').replace(/\s*\n+\s*/g, '. ').trim();
  if (t && !/[.!?]$/.test(t)) t += '.';
  return t;
}

// ---------- sílabas (para distribuir o tempo da legenda) ----------
/** Estimativa de sílabas de uma palavra em português (grupos de vogais). */
export function contarSilabas(palavra) {
  const p = String(palavra).toLowerCase().replace(/[^a-záàâãéêíóôõúüç]/g, '');
  if (!p) return 0;
  // ditongos/tritongos contam como 1 grupo; hiatos com acento separam
  const grupos = p.match(/[aeiouáàâãéêíóôõúü]+/g) || [];
  let n = 0;
  for (const g of grupos) {
    // vogal acentuada aguda isolada em hiato (ex.: "saída") separa
    const acentos = (g.match(/[íú]/g) || []).length;
    n += 1 + (g.length > 1 ? Math.min(acentos, g.length - 1) : 0);
  }
  return Math.max(1, n);
}

/** Peso de fala de um trecho de texto (sílabas do texto já normalizado). */
export function pesoFala(trecho, opts) {
  const falado = normalizarTexto(trecho, opts).replace(/[.!?]$/, '');
  const silabas = falado.split(/\s+/).reduce((s, w) => s + contarSilabas(w), 0);
  return Math.max(1, silabas);
}
