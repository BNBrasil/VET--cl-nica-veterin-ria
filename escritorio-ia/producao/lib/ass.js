// Camada gráfica do vídeo em ASS (renderizada pelo libass do ffmpeg): legenda dinâmica, gancho,
// faixa de título, cards de promoção, chamada final, marca do canal, barra de progresso,
// partículas e transições. O texto vai num arquivo .ass, então acentos, dois-pontos, aspas e %
// não precisam de escape de filtro do ffmpeg (só trocamos { } \ que são especiais no ASS).
import { metricas } from './metricas.js';
import { palavraChave } from './legenda.js';

export const W = 1080;
export const H = 1920;
export const FPS = 30;
const LARGURA_UTIL = 900;
export const Y_LEGENDA = 1430;

// ---------- utilidades ----------
export function escAss(s) {
  return String(s ?? '').replace(/\\/g, '/').replace(/\{/g, '(').replace(/\}/g, ')').replace(/\r?\n/g, ' ');
}

/** "#RRGGBB" → "&HBBGGRR&" */
export function corAss(hex) {
  const h = hex.replace('#', '');
  return `&H${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}&`.toUpperCase();
}
function alfa(a) { return `&H${Math.round(Math.max(0, Math.min(255, a))).toString(16).padStart(2, '0').toUpperCase()}&`; }

export function tempoAss(s) {
  const cs = Math.max(0, Math.round(s * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const seg = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(seg).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
}

function retangulo(w, h, r = 0) {
  w = Math.round(w); h = Math.round(h); r = Math.round(Math.min(r, w / 2, h / 2));
  if (!r) return `m 0 0 l ${w} 0 ${w} ${h} 0 ${h}`;
  return `m ${r} 0 l ${w - r} 0 b ${w} 0 ${w} 0 ${w} ${r} l ${w} ${h - r} b ${w} ${h} ${w} ${h} ${w - r} ${h} ` +
    `l ${r} ${h} b 0 ${h} 0 ${h} 0 ${h - r} l 0 ${r} b 0 0 0 0 ${r} 0`;
}
function circulo(r) {
  const k = Math.round(r * 0.5523);
  return `m 0 ${-r} b ${k} ${-r} ${r} ${-k} ${r} 0 b ${r} ${k} ${k} ${r} 0 ${r} b ${-k} ${r} ${-r} ${k} ${-r} 0 b ${-r} ${-k} ${-k} ${-r} 0 ${-r}`;
}
function raios(n, raio) {
  const partes = [];
  for (let i = 0; i < n; i++) {
    const a1 = (i / n) * Math.PI * 2;
    const a2 = a1 + (Math.PI * 2) / n / 2;
    partes.push(`m 0 0 l ${Math.round(Math.cos(a1) * raio)} ${Math.round(Math.sin(a1) * raio)} ${Math.round(Math.cos(a2) * raio)} ${Math.round(Math.sin(a2) * raio)}`);
  }
  return partes.join(' ');
}

// gerador pseudoaleatório determinístico (o mesmo vídeo sai igual sempre)
function aleatorio(semente) {
  let s = semente >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}

const maiusc = (s) => String(s).toLocaleUpperCase('pt-BR');

/** Quebra `texto` em linhas que caibam em `largura` com o tamanho dado (métrica real). */
export function quebrarParaLargura(texto, largura, tamanho, m, maxLinhas = 3) {
  const palavras = String(texto).split(/\s+/).filter(Boolean);
  const linhas = [];
  let atual = '';
  for (const p of palavras) {
    const teste = atual ? `${atual} ${p}` : p;
    if (atual && m.largura(teste, tamanho) > largura) { linhas.push(atual); atual = p; } else atual = teste;
  }
  if (atual) linhas.push(atual);
  return linhas.length <= maxLinhas ? linhas : null;
}

/** Maior tamanho (até `max`) em que o texto cabe em `maxLinhas` linhas, com linhas equilibradas. */
export function ajustarTexto(texto, { largura, max, min = 30, maxLinhas = 3, m }) {
  for (let t = max; t >= min; t -= 2) {
    const linhas = quebrarParaLargura(texto, largura, t, m, maxLinhas);
    if (linhas && linhas.every((l) => m.largura(l, t) <= largura)) {
      return { tamanho: t, linhas: equilibrar(linhas, largura, t, m) };
    }
  }
  return { tamanho: min, linhas: quebrarParaLargura(texto, largura, min, m, 99) || [texto] };
}
function equilibrar(linhas, largura, t, m) {
  if (linhas.length !== 2) return linhas;
  const palavras = linhas.join(' ').split(' ');
  let melhor = linhas;
  let pior = Math.max(...linhas.map((l) => m.largura(l, t)));
  for (let i = 1; i < palavras.length; i++) {
    const a = palavras.slice(0, i).join(' ');
    const b = palavras.slice(i).join(' ');
    const w = Math.max(m.largura(a, t), m.largura(b, t));
    if (w <= largura && w < pior) { pior = w; melhor = [a, b]; }
  }
  return melhor;
}

// ---------- montagem do arquivo ----------
export function criarAss({ canal, fontes, duracaoTotal }) {
  const c = canal.cores;
  const eventos = [];
  const mT = metricas(fontes.titulo.arquivo);
  const mL = metricas(fontes.texto.arquivo);
  const ev = (camada, ini, fim, estilo, texto) => {
    if (fim - ini < 0.005) return;
    eventos.push({ camada, ini, fim, linha: `Dialogue: ${camada},${tempoAss(ini)},${tempoAss(fim)},${estilo},,0,0,0,,${texto}` });
  };
  const cabecalho = () => [
    '[Script Info]',
    '; gerado por producao/lib/ass.js',
    'ScriptType: v4.00+',
    `PlayResX: ${W}`,
    `PlayResY: ${H}`,
    'WrapStyle: 2',
    'ScaledBorderAndShadow: yes',
    'YCbCr Matrix: TV.709',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: T,${fontes.titulo.familia},100,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,${fontes.titulo.negrito ? -1 : 0},0,0,0,100,100,0,0,1,0,0,5,0,0,0,1`,
    `Style: L,${fontes.texto.familia},100,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,${fontes.texto.negrito ? -1 : 0},0,0,0,100,100,0,0,1,0,0,5,0,0,0,1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];

  const api = {
    eventos,
    mT,
    mL,
    texto() {
      const ordenados = [...eventos].sort((a, b) => a.ini - b.ini || a.camada - b.camada);
      return [...cabecalho(), ...ordenados.map((e) => e.linha), ''].join('\n');
    },

    /** barra de progresso no topo */
    progresso(total = duracaoTotal) {
      ev(90, 0, total, 'L', `{\\an7\\pos(0,0)\\bord0\\shad0\\c&H000000&\\alpha&H70&\\p1}${retangulo(W, 14)}`);
      ev(91, 0, total, 'L', `{\\an7\\pos(0,0)\\bord0\\shad0\\c${corAss(c.destaque)}\\fscx0\\t(0,${Math.round(total * 1000)},\\fscx100)\\p1}${retangulo(W, 14)}`);
    },

    /** marca do canal (pílula com ponto piscando + @) */
    marca(ini, fim) {
      const tam = 38;
      const nome = maiusc(canal.nome);
      const wNome = mT.largura(nome, tam);
      const x = 60; const y = 262; const hP = 58;
      const wP = wNome + 76;
      ev(80, ini, fim, 'T', `{\\an7\\pos(${x},${y})\\bord0\\shad3\\4c&H000000&\\4a&H90&\\c${corAss(c.alerta)}\\p1}${retangulo(wP, hP, 12)}`);
      // ponto "ao vivo" piscando
      let pisca = '';
      for (let k = 0; k < Math.min(60, Math.ceil((fim - ini) / 0.6)); k++) {
        pisca += `\\t(${k * 600},${k * 600 + 1},\\alpha&H00&)\\t(${k * 600 + 300},${k * 600 + 301},\\alpha&HA0&)`;
      }
      ev(81, ini, fim, 'T', `{\\an5\\pos(${x + 26},${y + hP / 2})\\bord0\\shad0\\c&HFFFFFF&${pisca}\\p1}${circulo(8)}`);
      ev(82, ini, fim, 'T', `{\\an4\\pos(${x + 46},${y + hP / 2 + 1})\\fs${tam}\\bord0\\shad0\\c&HFFFFFF&}${escAss(nome)}`);
      ev(82, ini, fim, 'L', `{\\an4\\pos(${x + wP + 16},${y + hP / 2 + 1})\\fs30\\bord3\\shad0\\3c&H000000&\\c&HFFFFFF&\\alpha&H20&}${escAss(canal.arroba)}`);
    },

    /** partículas e bokeh subindo (fundo gerado) */
    particulas(ini, fim, semente = 1) {
      const rnd = aleatorio(semente * 7919 + 13);
      const cores = [c.destaque, c.destaque2, c.texto, c.alerta];
      const n = 26;
      for (let i = 0; i < n; i++) {
        const vida = 5 + rnd() * 6;
        let t = ini - rnd() * vida;
        const x = 30 + rnd() * (W - 60);
        const grande = i < 5;
        const r = grande ? 60 + rnd() * 90 : 3 + rnd() * 7;
        const cor = cores[Math.floor(rnd() * cores.length)];
        const a = grande ? 0xE4 : 0x60 + rnd() * 0x60;
        const blur = grande ? 40 : 1.5;
        const deriva = (rnd() - 0.5) * 160;
        while (t < fim) {
          const t0 = Math.max(t, ini);
          const t1 = Math.min(t + vida, fim);
          const y0 = H + 120 - ((t0 - t) / vida) * (H + 240);
          const y1 = H + 120 - ((t1 - t) / vida) * (H + 240);
          const x0 = x + deriva * ((t0 - t) / vida);
          const x1 = x + deriva * ((t1 - t) / vida);
          ev(2, t0, t1, 'L', `{\\an5\\move(${x0.toFixed(0)},${y0.toFixed(0)},${x1.toFixed(0)},${y1.toFixed(0)})\\bord0\\shad0\\blur${blur}\\c${corAss(cor)}\\alpha${alfa(a)}\\p1}${circulo(Math.round(r))}`);
          t += vida;
        }
      }
    },

    /** transição: flash + faixa diagonal varrendo a tela */
    transicao(t) {
      ev(95, t, t + 0.22, 'L', `{\\an7\\pos(0,0)\\bord0\\shad0\\c&HFFFFFF&\\alpha&H50&\\t(0,220,\\alpha&HFF&)\\p1}${retangulo(W, H)}`);
      ev(94, t - 0.14, t + 0.16, 'L', `{\\an5\\move(${-W},${H / 2},${W * 2},${H / 2})\\frz-12\\bord0\\shad0\\c${corAss(c.destaque)}\\alpha&H10&\\p1}${retangulo(700, H * 1.6)}`);
      ev(93, t - 0.10, t + 0.20, 'L', `{\\an5\\move(${-W},${H / 2},${W * 2},${H / 2})\\frz-12\\bord0\\shad0\\c${corAss(c.alerta)}\\alpha&H30&\\p1}${retangulo(260, H * 1.6)}`);
    },

    /** texto com pop + tremida (quadro a quadro na entrada) e "respiração" depois */
    impacto({ ini, fim, x, y, conteudo, estilo = 'T', tremida = 14, durEntrada = 0.5, camada = 50, extra = '' }) {
      const quadros = Math.round(durEntrada * FPS);
      for (let k = 0; k < quadros; k++) {
        const t = k / FPS;
        const p = Math.min(1, t / 0.22);
        // easeOutBack: passa do tamanho e volta
        const s = 1 + 2.2 * Math.pow(p - 1, 3) + 1.2 * Math.pow(p - 1, 2);
        const esc = Math.max(0.2, 0.35 + 0.65 * s) * 100;
        const amp = tremida * (1 - t / durEntrada);
        const dx = Math.round(Math.sin(k * 2.7) * amp);
        const dy = Math.round(Math.cos(k * 3.1) * amp * 0.7);
        ev(camada, ini + k / FPS, ini + (k + 1) / FPS, estilo,
          `{\\an5\\pos(${x + dx},${y + dy})\\fscx${esc.toFixed(0)}\\fscy${esc.toFixed(0)}${extra}}${conteudo}`);
      }
      const resto = fim - ini - quadros / FPS;
      ev(camada, ini + quadros / FPS, fim, estilo,
        `{\\an5\\pos(${x},${y})${extra}\\t(0,${Math.round(resto * 1000)},\\fscx104\\fscy104)}${conteudo}`);
    },

    /** cena de gancho: raios girando, selo e título enorme */
    gancho({ ini, fim, texto, selo, chave }) {
      ev(3, ini, fim, 'L', `{\\an7\\pos(540,800)\\bord0\\shad0\\blur6\\c${corAss(c.destaque)}\\alpha&HE6&\\frz0\\t(0,${Math.round((fim - ini) * 1000)},\\frz40)\\p1}${raios(18, 1500)}`);
      ev(4, ini, fim, 'L', `{\\an5\\pos(540,820)\\bord0\\shad0\\blur60\\c${corAss(c.alerta)}\\alpha&HB0&\\p1}${circulo(420)}`);
      const largura = LARGURA_UTIL;
      const txt = maiusc(texto);
      const { tamanho, linhas } = ajustarTexto(txt, { largura, max: 156, min: 60, maxLinhas: 3, m: mT });
      const alturaLinha = tamanho * 1.05;
      const yTitulo = 840;
      // palavra-chave em destaque; resto branco
      const conteudo = linhas.map((l) => colorirChave(l, chave, c)).join('\\N');
      const bloco = `{\\fs${tamanho}\\bord${Math.round(tamanho / 14)}\\shad${Math.round(tamanho / 18)}\\3c&H000000&\\4c&H000000&\\4a&H40&\\c&HFFFFFF&\\q2\\fsp-1}${conteudo}`;
      api.impacto({ ini: ini + 0.08, fim, x: 540, y: yTitulo, conteudo: bloco, tremida: 16 });
      if (selo) {
        const tam = 46;
        const s = maiusc(selo);
        const w = mT.largura(s, tam) + 56;
        const ySelo = yTitulo - (linhas.length * alturaLinha) / 2 - 70;
        const caixa = `{\\an5\\bord0\\shad4\\4c&H000000&\\4a&H80&\\c${corAss(c.alerta)}\\frz3\\p1}${retangulo(w, 78, 14)}`;
        const letra = `{\\an5\\fs${tam}\\bord0\\shad0\\c&HFFFFFF&\\frz3}${escAss(s)}`;
        api.impacto({ ini, fim, x: 540, y: ySelo, conteudo: caixa, estilo: 'L', tremida: 8, durEntrada: 0.3, camada: 48 });
        api.impacto({ ini, fim, x: 540, y: ySelo, conteudo: letra, tremida: 8, durEntrada: 0.3, camada: 49 });
      }
    },

    /** faixa de título (cena com imagem): caixa da cor de destaque deslizando da esquerda */
    faixa({ ini, fim, texto, y, selo }) {
      const txt = maiusc(texto);
      const { tamanho, linhas } = ajustarTexto(txt, { largura: 880, max: 76, min: 40, maxLinhas: 2, m: mT });
      const alturaL = tamanho * 1.12;
      const larg = Math.max(...linhas.map((l) => mT.largura(l, tamanho))) + 60;
      const alt = linhas.length * alturaL + 34;
      const x = 540 - larg / 2;
      const ent = 0.28;
      ev(60, ini + 0.1, fim, 'L', `{\\an7\\move(${-larg - 40},${y},${x},${y},0,${ent * 1000})\\bord0\\shad6\\4c&H000000&\\4a&H70&\\c${corAss(c.destaque)}\\fax-0.08\\p1}${retangulo(larg, alt, 10)}`);
      ev(61, ini + 0.1, fim, 'T', `{\\an5\\move(${-larg / 2 - 40},${y + alt / 2},540,${y + alt / 2},0,${ent * 1000})\\fs${tamanho}\\bord0\\shad0\\c&H101010&\\fax-0.08\\q2}${linhas.map(escAss).join('\\N')}`);
      if (selo) {
        const s = maiusc(selo);
        const tam = 34;
        const w = mT.largura(s, tam) + 36;
        ev(62, ini + 0.25, fim, 'T', `{\\an7\\move(${-w},${y - 52},${x},${y - 52},0,240)\\bord0\\shad0\\c${corAss(c.alerta)}\\p1}${retangulo(w, 50, 8)}`);
        ev(63, ini + 0.25, fim, 'T', `{\\an4\\move(${-w + 18},${y - 26},${x + 18},${y - 26},0,240)\\fs${tam}\\bord0\\shad0\\c&HFFFFFF&}${escAss(s)}`);
      }
      return y + alt;
    },

    /** crédito da imagem, pequeno, no canto inferior esquerdo da imagem */
    credito({ ini, fim, texto, x, y }) {
      const t = `Imagem: ${texto}`;
      const tam = 26;
      const w = mL.largura(t, tam) + 24;
      ev(64, ini, fim, 'L', `{\\an1\\pos(${x},${y})\\bord0\\shad0\\c&H000000&\\alpha&H60&\\p1}${retangulo(w, 38, 6)}`);
      ev(65, ini, fim, 'L', `{\\an1\\pos(${x + 12},${y - 6})\\fs${tam}\\bord0\\shad0\\c&HFFFFFF&\\alpha&H10&}${escAss(t)}`);
    },

    /** manchete em painel (cena "imagem" sem imagem) */
    manchete({ ini, fim, texto, selo, chave }) {
      const txt = maiusc(texto);
      const { tamanho, linhas } = ajustarTexto(txt, { largura: 820, max: 110, min: 50, maxLinhas: 4, m: mT });
      const alturaL = tamanho * 1.08;
      const alt = linhas.length * alturaL + 120;
      const y = 820 - alt / 2;
      ev(40, ini, fim, 'L', `{\\an7\\pos(80,${y})\\bord4\\3c${corAss(c.destaque2)}\\3a&H40&\\shad10\\4c&H000000&\\4a&H60&\\c${corAss(c.card)}\\alpha&H28&\\fscx0\\t(0,220,\\fscx100)\\p1}${retangulo(920, alt, 26)}`);
      ev(41, ini, fim, 'L', `{\\an7\\pos(80,${y})\\bord0\\shad0\\c${corAss(c.destaque2)}\\fscy0\\t(100,300,\\fscy100)\\p1}${retangulo(14, alt, 0)}`);
      const conteudo = linhas.map((l) => colorirChave(l, chave, c)).join('\\N');
      ev(42, ini + 0.15, fim, 'T', `{\\an5\\pos(550,${y + alt / 2})\\fs${tamanho}\\bord0\\shad3\\4c&H000000&\\c&HFFFFFF&\\q2\\alpha&HFF&\\t(0,200,\\alpha&H00&)\\fscx92\\fscy92\\t(0,240,\\fscx100\\fscy100)}${conteudo}`);
      if (selo) {
        const s = maiusc(selo);
        const tam = 38;
        const w = mT.largura(s, tam) + 40;
        ev(43, ini + 0.2, fim, 'L', `{\\an7\\pos(${80 + 40},${y - 30})\\bord0\\shad0\\c${corAss(c.alerta)}\\fscx0\\t(0,180,\\fscx100)\\p1}${retangulo(w, 60, 10)}`);
        ev(44, ini + 0.3, fim, 'T', `{\\an4\\pos(${80 + 60},${y})\\fs${tam}\\bord0\\shad0\\c&HFFFFFF&}${escAss(s)}`);
      }
    },

    /** cabeçalho da lista */
    cabecalho({ ini, fim, texto }) {
      const txt = maiusc(texto);
      const { tamanho, linhas } = ajustarTexto(txt, { largura: 880, max: 78, min: 44, maxLinhas: 1, m: mT });
      api.impacto({ ini, fim, x: 540, y: 380, conteudo: `{\\fs${tamanho}\\bord6\\3c&H000000&\\shad4\\4c&H000000&\\4a&H50&\\c${corAss(c.destaque)}}${escAss(linhas.join(' '))}`, tremida: 6, durEntrada: 0.3 });
    },

    /** card de promoção entrando da direita */
    card({ ini, fim, item, topo, altura }) {
      const x = 70; const w = 940; const h = altura;
      const ent = 0.26;
      const desloc = 1150;
      const mv = (px, py) => `\\move(${px + desloc},${py},${px},${py},0,${ent * 1000})`;
      const add = (camada, estilo, px, py, an, corpo) => ev(camada, ini, fim, estilo, `{\\an${an}${mv(px, py)}${corpo}`);
      add(20, 'L', x, topo, 7, `\\bord0\\shad8\\4c&H000000&\\4a&H70&\\c${corAss(c.card)}\\alpha&H18&\\p1}${retangulo(w, h, 22)}`);
      add(21, 'L', x, topo, 7, `\\bord0\\shad0\\c${corAss(c.destaque2)}\\p1}${retangulo(12, h, 0)}`);
      const temDesc = Boolean(item.desconto);
      const larguraNome = temDesc ? 600 : 860;
      const nome = String(item.nome || '');
      let tamNome = Math.min(54, Math.round(h * 0.3));
      while (tamNome > 30 && mT.largura(nome, tamNome) > larguraNome) tamNome -= 2;
      let nomeTxt = nome;
      while (mT.largura(nomeTxt, tamNome) > larguraNome && nomeTxt.length > 4) nomeTxt = nomeTxt.slice(0, -2).trimEnd() + '…';
      if (nomeTxt !== nome && !nomeTxt.endsWith('…')) nomeTxt += '…';
      add(22, 'T', x + 40, topo + h * 0.32, 4, `\\fs${tamNome}\\bord0\\shad2\\4c&H000000&\\c&HFFFFFF&}${escAss(nomeTxt)}`);
      const yPreco = topo + h * 0.72;
      const tamPreco = Math.min(64, Math.round(h * 0.36));
      if (item.de) {
        add(22, 'L', x + 40, yPreco, 4, `\\fs${Math.round(tamPreco * 0.6)}\\bord0\\shad0\\c&HA8A2B8&\\s1}${escAss(item.de)}`);
      }
      if (item.por) {
        const dx = item.de ? mL.largura(item.de, Math.round(tamPreco * 0.6)) + 30 : 0;
        // preço novo: entra depois com um "pop" (junto do "ding")
        const ePreco = ini + 0.35;
        ev(23, ePreco, fim, 'T', `{\\an4\\pos(${x + 40 + dx},${yPreco})\\fs${tamPreco}\\bord4\\3c&H000000&\\shad0\\c${corAss(c.destaque)}\\fscx50\\fscy50\\t(0,120,\\fscx115\\fscy115)\\t(120,220,\\fscx100\\fscy100)}${escAss(item.por)}`);
      }
      if (temDesc) {
        const d = String(item.desconto);
        const tamD = Math.min(60, Math.round(h * 0.32));
        const bw = mT.largura(d, tamD) + 44;
        const bh = tamD * 1.5;
        const cx = x + w - 30 - bw / 2;
        const cy = topo + h / 2;
        ev(24, ini + 0.3, fim, 'L', `{\\an5\\pos(${cx},${cy})\\frz8\\bord0\\shad4\\4c&H000000&\\4a&H60&\\c${corAss(c.alerta)}\\fscx0\\fscy0\\t(0,140,\\fscx120\\fscy120)\\t(140,240,\\fscx100\\fscy100)\\p1}${retangulo(bw, bh, 14)}`);
        ev(25, ini + 0.3, fim, 'T', `{\\an5\\pos(${cx},${cy})\\frz8\\fs${tamD}\\bord0\\shad0\\c&HFFFFFF&\\fscx0\\fscy0\\t(0,140,\\fscx120\\fscy120)\\t(140,240,\\fscx100\\fscy100)}${escAss(d)}`);
      }
    },

    /** chamada final: título, @ pulsando, botão seguir, fonte */
    fim({ ini, fim, texto, fontes: fts }) {
      const txt = maiusc(texto || canal.chamadaFim);
      const { tamanho, linhas } = ajustarTexto(txt, { largura: 880, max: 120, min: 50, maxLinhas: 3, m: mT });
      const yT = 640;
      api.impacto({ ini, fim, x: 540, y: yT, conteudo: `{\\fs${tamanho}\\bord${Math.round(tamanho / 14)}\\3c&H000000&\\shad5\\4c&H000000&\\4a&H40&\\c${corAss(c.destaque)}\\q2}${linhas.map(escAss).join('\\N')}`, tremida: 10 });
      const yA = yT + (linhas.length * tamanho * 1.05) / 2 + 110;
      const arroba = canal.arroba;
      const tamA = 62;
      const wA = mT.largura(arroba, tamA) + 80;
      const dur = Math.round((fim - ini) * 1000);
      let pulso = '';
      for (let k = 400; k < dur; k += 800) pulso += `\\t(${k},${k + 400},\\fscx106\\fscy106)\\t(${k + 400},${k + 800},\\fscx100\\fscy100)`;
      ev(70, ini + 0.2, fim, 'L', `{\\an5\\pos(540,${yA})\\bord0\\shad6\\4c&H000000&\\4a&H60&\\c${corAss(c.alerta)}\\fscx0\\fscy0\\t(0,200,\\fscx100\\fscy100)${pulso}\\p1}${retangulo(wA, 104, 52)}`);
      ev(71, ini + 0.2, fim, 'T', `{\\an5\\pos(540,${yA + 2})\\fs${tamA}\\bord0\\shad0\\c&HFFFFFF&\\fscx0\\fscy0\\t(0,200,\\fscx100\\fscy100)${pulso}}${escAss(arroba)}`);
      // botão "+ SEGUIR" com cursor clicando
      const yB = yA + 150;
      const bt = '+ SEGUIR';
      const wB = mT.largura(bt, 46) + 70;
      ev(72, ini + 0.45, fim, 'L', `{\\an5\\pos(540,${yB})\\bord4\\3c&HFFFFFF&\\shad0\\c&H000000&\\alpha&H40&\\fscx0\\t(0,180,\\fscx100)\\t(900,960,\\fscx92\\fscy92\\c${corAss(c.destaque2)})\\t(960,1040,\\fscx100\\fscy100)\\p1}${retangulo(wB, 84, 42)}`);
      ev(73, ini + 0.45, fim, 'T', `{\\an5\\pos(540,${yB + 2})\\fs46\\bord0\\shad0\\c&HFFFFFF&\\alpha&HFF&\\t(120,200,\\alpha&H00&)\\t(900,960,\\c&H000000&)}${bt}`);
      const cursor = 'm 0 0 l 0 60 l 15 46 l 26 72 l 36 67 l 25 42 l 44 42';
      ev(74, ini + 0.45, fim, 'L', `{\\an7\\move(${540 + 260},${yB + 180},${540 + 60},${yB + 10},0,850)\\bord3\\3c&H000000&\\shad0\\c&HFFFFFF&\\t(860,940,\\fscx85\\fscy85)\\t(940,1020,\\fscx100\\fscy100)\\p1}${cursor}`);
      const oficiais = (fts || []).filter((f) => f && f.titulo).slice(0, 2);
      if (oficiais.length) {
        const t = 'Fonte: ' + oficiais.map((f) => f.titulo).join(' / ');
        let tam = 30;
        while (tam > 20 && mL.largura(t, tam) > 900) tam -= 2;
        ev(75, ini + 0.3, fim, 'L', `{\\an5\\pos(540,${yB + 140})\\fs${tam}\\bord0\\shad2\\4c&H000000&\\c&HFFFFFF&\\alpha&H30&}${escAss(t)}`);
      }
    },

    /** legenda dinâmica: blocos com pop, palavra-chave colorida */
    legenda(blocos, { y = Y_LEGENDA, textoCena = '' } = {}) {
      blocos.forEach((b, i) => {
        const inicioFrase = i === 0 || blocos[i - 1].fimFrase;
        const idx = palavraChave(b.palavras, { textoCena, inicioFrase });
        const palavras = b.palavras.map((p) => maiusc(p.texto));
        let tam = 82;
        const larg = (arr) => mL.largura(arr.join(' '), tam);
        let linhas = [palavras];
        if (larg(palavras) > 880) {
          // duas linhas equilibradas
          let melhor = null;
          for (let k = 1; k < palavras.length; k++) {
            const w = Math.max(larg(palavras.slice(0, k)), larg(palavras.slice(k)));
            if (!melhor || w < melhor.w) melhor = { w, k };
          }
          if (melhor) linhas = [palavras.slice(0, melhor.k), palavras.slice(melhor.k)];
          while (tam > 50 && Math.max(...linhas.map(larg)) > 880) tam -= 2;
        }
        let n = 0;
        const corDest = /\d|R\$|%/.test(b.palavras[idx]?.texto || '') ? c.destaque2 : c.destaque;
        const txt = linhas.map((l) => l.map((p) => {
          const j = n++;
          return j === idx ? `{\\c${corAss(corDest)}}${escAss(p)}{\\c&HFFFFFF&}` : escAss(p);
        }).join(' ')).join('\\N');
        ev(85, b.ini, b.fim, 'L', `{\\an5\\pos(540,${y})\\fs${tam}\\bord7\\3c&H000000&\\shad4\\4c&H000000&\\4a&H50&\\c&HFFFFFF&\\q2\\fscx80\\fscy80\\t(0,80,\\fscx107\\fscy107)\\t(80,150,\\fscx100\\fscy100)}${txt}`);
      });
    },
  };
  return api;
}

function colorirChave(linha, chave, c) {
  if (!chave) return escAss(linha);
  const alvo = maiusc(chave);
  const i = linha.indexOf(alvo);
  if (i < 0) return escAss(linha);
  return `${escAss(linha.slice(0, i))}{\\c${corAss(c.destaque)}}${escAss(alvo)}{\\c&HFFFFFF&}${escAss(linha.slice(i + alvo.length))}`;
}
