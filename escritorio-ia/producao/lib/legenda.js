// Legenda: divide a fala em blocos de 2–4 palavras (legenda dinâmica queimada),
// distribui o tempo real da fala por sílabas, escolhe a palavra-chave e gera o .srt.
import { carregarPronuncia, pesoFala } from './normalizar.js';

const FRACAS = new Set(['o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'de', 'do', 'da', 'dos', 'das', 'em',
  'no', 'na', 'nos', 'nas', 'por', 'pra', 'pro', 'para', 'com', 'e', 'ou', 'que', 'se', 'ao', 'aos', 'à', 'às',
  'seu', 'sua', 'mais', 'até', 'é', 'tá', 'só', 'nem', 'mas', 'num', 'numa', 'pelo', 'pela', 'sem', 'já']);

/** Separa em palavras, mantendo juntos "R$ 79,96", "US$ 10" e "-60%". Remove os * de destaque mas marca. */
export function tokenizar(fala) {
  const texto = String(fala || '').replace(/(R\$|US\$|U\$|€)\s+(?=\d)/g, '$1 ').replace(/\s+/g, ' ').trim();
  const tokens = [];
  let emDestaque = false;
  for (const bruto of texto.split(' ')) {
    if (!bruto) continue;
    let p = bruto;
    const abre = p.startsWith('*');
    const fecha = /\*[.,!?:;]*$/.test(p);
    if (abre) emDestaque = true;
    const destaque = emDestaque;
    if (fecha) emDestaque = false;
    p = p.replace(/\*/g, '');
    if (!p) continue;
    tokens.push({ texto: p.replace(/ /g, ' '), destaque });
  }
  return tokens;
}

function fimDeFrase(p) { return /[.!?…]["')]*$/.test(p); }
function virgula(p) { return /[,;:]["')]*$/.test(p); }
function limpa(p) { return p.toLowerCase().replace(/[^\p{L}\p{N}$%]/gu, ''); }

/**
 * Agrupa em blocos de 2 a 4 palavras, até ~`maxChars` caracteres, quebrando na pontuação
 * e sem terminar bloco em artigo/preposição.
 */
export function dividirBlocos(fala, { min = 2, max = 4, maxChars = 22 } = {}) {
  const tokens = tokenizar(fala);
  const blocos = [];
  let atual = [];
  const tamanho = (arr) => arr.reduce((s, t) => s + t.texto.length + 1, -1);
  const fechar = () => { if (atual.length) blocos.push(atual); atual = []; };
  tokens.forEach((tok, i) => {
    const proximo = tokens[i + 1];
    if (atual.length >= min && (atual.length >= max || tamanho([...atual, tok]) > maxChars)) {
      // não deixa preposição/artigo pendurado no fim do bloco
      const ultimo = atual[atual.length - 1];
      if (atual.length > 1 && FRACAS.has(limpa(ultimo.texto)) && !virgula(ultimo.texto)) {
        atual.pop();
        fechar();
        atual.push(ultimo);
      } else fechar();
    }
    atual.push(tok);
    const restantes = tokens.length - i - 1;
    if (fimDeFrase(tok.texto)) fechar();
    else if (virgula(tok.texto) && atual.length >= min && restantes >= min) fechar();
    else if (!proximo) fechar();
  });
  // bloco de 1 palavra sozinho: junta com o anterior se couber (mesma frase)
  const final = [];
  for (const b of blocos) {
    const ant = final[final.length - 1];
    if (b.length === 1 && ant && !fimDeFrase(ant[ant.length - 1].texto) && ant.length < max + 1 &&
      tamanho([...ant, ...b]) <= maxChars + 6) ant.push(...b);
    else final.push(b);
  }
  return final.map((toks) => ({
    texto: toks.map((t) => t.texto).join(' '),
    palavras: toks,
    fimFrase: fimDeFrase(toks[toks.length - 1].texto),
    pausa: virgula(toks[toks.length - 1].texto),
  }));
}

/** Índice da palavra a destacar no bloco (ou -1). */
export function palavraChave(palavras, { textoCena = '', inicioFrase = false } = {}) {
  const marcada = palavras.findIndex((p) => p.destaque);
  if (marcada >= 0) return marcada;
  const termos = carregarPronuncia().map(([k]) => k.toLowerCase());
  const daCena = new Set(String(textoCena).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 4));
  let melhor = -1;
  let nota = 0;
  palavras.forEach((p, i) => {
    const w = p.texto.replace(/[.,!?:;"'()]/g, '');
    const lw = w.toLowerCase();
    let n = 0;
    if (/\d|R\$|%/.test(w)) n = 6;
    else if (/^\p{Lu}{2,}\d*$/u.test(w) || /^[A-Z]+\d+$/.test(w)) n = 5;
    else if (termos.includes(lw) && /^\p{Lu}/u.test(w)) n = 4;
    else if (daCena.has(lw)) n = 3;
    else if (/^\p{Lu}/u.test(w) && !(i === 0 && inicioFrase) && w.length > 2) n = 2;
    else if (w.length >= 8 && !FRACAS.has(lw)) n = 1;
    if (n > nota) { nota = n; melhor = i; }
  });
  return melhor;
}

/**
 * Distribui os blocos no tempo da fala. `segmentos` = trechos com voz (de silencedetect), em s relativos
 * ao início do áudio. Retorna blocos com { ini, fim } em s relativos ao áudio.
 */
export function cronometrar(blocos, { duracao, segmentos } = {}) {
  let segs = (segmentos && segmentos.length ? segmentos : [{ ini: 0, fim: duracao }])
    .filter((s) => s.fim > s.ini);
  if (!segs.length) segs = [{ ini: 0, fim: duracao || 1 }];
  const pesos = blocos.map((b) => pesoFala(b.texto));
  const total = pesos.reduce((a, b) => a + b, 0);
  const tempoFala = segs.reduce((s, g) => s + (g.fim - g.ini), 0);
  // posição "x" (0..tempoFala) → tempo real pulando os silêncios
  const real = (x) => {
    let acc = 0;
    for (const g of segs) {
      const len = g.fim - g.ini;
      if (x <= acc + len + 1e-9) return g.ini + (x - acc);
      acc += len;
    }
    return segs[segs.length - 1].fim;
  };
  const lacunas = segs.slice(1).map((g, i) => ({ ini: segs[i].fim, fim: g.ini }));
  let acc = 0;
  const out = blocos.map((b, i) => {
    const ini = real(acc + 1e-6);
    acc += (pesos[i] / total) * tempoFala;
    return { ...b, ini, fim: real(acc) };
  });
  // encaixa as fronteiras de pontuação nos silêncios próximos
  for (let i = 0; i < out.length - 1; i++) {
    const fronteira = out[i].fim;
    const perto = lacunas
      .map((l) => ({ l, dist: Math.min(Math.abs(l.ini - fronteira), Math.abs(l.fim - fronteira)) }))
      .filter(({ dist }) => dist < ((out[i].fimFrase || out[i].pausa) ? 0.7 : 0.25))
      .sort((a, b) => a.dist - b.dist)[0];
    if (perto && perto.l.ini > out[i].ini + 0.15 && perto.l.fim < out[i + 1].fim - 0.15) {
      out[i].fim = perto.l.ini;
      out[i + 1].ini = perto.l.fim;
    }
  }
  // mostra até o próximo bloco (em pausas longas, some um pouco depois)
  for (let i = 0; i < out.length; i++) {
    const prox = out[i + 1];
    const falaFim = out[i].fim;
    out[i].falaFim = falaFim;
    out[i].fim = prox ? (prox.ini - falaFim < 0.6 ? prox.ini : falaFim + 0.3) : falaFim + 0.25;
  }
  return out;
}

// ---------- SRT ----------
function tempoSrt(s) {
  const ms = Math.max(0, Math.round(s * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const seg = Math.floor((ms % 60000) / 1000);
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${p(h)}:${p(m)}:${p(seg)},${p(ms % 1000, 3)}`;
}

/** Quebra um texto em até 2 linhas de no máximo `max` caracteres (linha de baixo maior). */
export function quebrarLinhas(texto, max = 42) {
  if (texto.length <= max) return [texto];
  const palavras = texto.split(' ');
  let melhor = null;
  for (let i = 1; i < palavras.length; i++) {
    const a = palavras.slice(0, i).join(' ');
    const b = palavras.slice(i).join(' ');
    if (a.length > max || b.length > max) continue;
    let custo = Math.abs(a.length - b.length) + (a.length > b.length ? 3 : 0);
    if (FRACAS.has(limpa(palavras[i - 1]))) custo += 12;
    if (/[,.;:!?]$/.test(palavras[i - 1])) custo -= 8;
    if (!melhor || custo < melhor.custo) melhor = { custo, linhas: [a, b] };
  }
  return melhor ? melhor.linhas : [texto];
}

/**
 * Junta os blocos dinâmicos em legendas de leitura (para o .srt): até 2 linhas de 42 caracteres,
 * 1 a 7 s, uma frase por bloco quando possível.
 * @param {Array<{texto:string, ini:number, fim:number, falaFim?:number, fimFrase?:boolean}>} blocos tempos absolutos
 */
export function agruparParaSrt(blocos, { maxLinha = 42 } = {}) {
  const cues = [];
  let atual = null;
  for (const b of blocos) {
    const fimFala = b.falaFim ?? b.fim;
    if (atual) {
      const junto = `${atual.texto} ${b.texto}`;
      const cabe = junto.length <= maxLinha * 2 - 4 && quebrarLinhas(junto, maxLinha).length <= 2 &&
        fimFala - atual.ini <= 6.5 && !atual.fechada && b.ini - atual.fimFala < 0.5;
      if (cabe) {
        atual.texto = junto; atual.fim = b.fim; atual.fimFala = fimFala; atual.fechada = b.fimFrase && (fimFala - atual.ini) >= 1.2;
        continue;
      }
      cues.push(atual);
    }
    atual = { texto: b.texto, ini: b.ini, fim: b.fim, fimFala, fechada: b.fimFrase && (fimFala - b.ini) >= 1.2 };
  }
  if (atual) cues.push(atual);
  // tempos: mínimo 1 s, máximo 7 s, intervalo de ~2 quadros entre blocos
  for (let i = 0; i < cues.length; i++) {
    const c = cues[i];
    const prox = cues[i + 1];
    let fim = Math.min(c.fim, c.ini + 7);
    if (fim - c.ini < 1) fim = c.ini + 1;
    if (prox && fim > prox.ini - 0.08) fim = prox.ini - 0.08;
    if (fim - c.ini < 1 && prox) { prox.ini = Math.max(prox.ini, c.ini + 1.08); fim = c.ini + 1; }
    c.fim = fim;
  }
  return cues.map((c) => ({ texto: c.texto, ini: c.ini, fim: c.fim, linhas: quebrarLinhas(c.texto, maxLinha) }));
}

export function gerarSrt(cues) {
  return cues.map((c, i) => `${i + 1}\n${tempoSrt(c.ini)} --> ${tempoSrt(c.fim)}\n${(c.linhas || quebrarLinhas(c.texto)).join('\n')}\n`)
    .join('\n');
}
