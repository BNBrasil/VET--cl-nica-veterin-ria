#!/usr/bin/env node
// Monta o vídeo vertical do canal a partir de uma pauta.json (ver producao/CONTRATO.md).
// Uso: node producao/montar.js <pauta.json> [--voz-falsa] [--trilha pulso|lofi|hype|minhas|nenhuma|arquivo]
//                                            [--rapido] [--manter] [--saida pasta]
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PASTA_SAIDA, PASTA_TRABALHO, conferirFiltros, duracaoMidia, exigirFfmpeg, acharPiper } from './lib/ferramentas.js';
import { carregarCanal, escolherFontes } from './lib/canal.js';
import { falar, MODELO_PADRAO } from './tts.js';
import { dividirBlocos, cronometrar, agruparParaSrt, gerarSrt, tokenizar, palavraChave } from './lib/legenda.js';
import { criarAss, FPS, Y_LEGENDA } from './lib/ass.js';
import { fundoGerado, fundoImagem, concatenar, renderFinal, renderCapa, texturaGrade } from './lib/video.js';
import { garantirSons, escolherTrilha } from './lib/sons.js';
import { mixar } from './lib/audio.js';

export const DURACAO_MAX = 60;
const ATRASO_VOZ = 0.1; // a voz entra 0,1 s depois do corte (respiro para a transição)
const FOLGA = 0.3; // duração da cena = áudio + 0,3 s (contrato)
const TIPOS = new Set(['gancho', 'imagem', 'lista', 'fim']);
const SELOS = { noticia: 'ÚLTIMA HORA', promocao: 'PROMOÇÃO', lancamento: 'LANÇAMENTO' };

export function validarPauta(p) {
  const erros = [];
  if (!p || typeof p !== 'object') return ['pauta não é um objeto JSON'];
  if (!p.id || !/^[a-z0-9][a-z0-9-]{0,80}$/i.test(p.id)) erros.push('id ausente ou inválido (use letras, números e hífen)');
  if (!Array.isArray(p.cenas) || !p.cenas.length) erros.push('cenas: precisa de pelo menos uma cena');
  (p.cenas || []).forEach((c, i) => {
    if (!TIPOS.has(c.tipo)) erros.push(`cena ${i + 1}: tipo "${c.tipo}" inválido (gancho, imagem, lista, fim)`);
    if (!c.fala || !String(c.fala).trim()) erros.push(`cena ${i + 1}: sem "fala"`);
    if (c.tipo === 'lista' && (!Array.isArray(c.itens) || !c.itens.length)) erros.push(`cena ${i + 1}: lista sem "itens"`);
    if (c.imagem && !c.credito) erros.push(`cena ${i + 1}: imagem sem "credito"`);
  });
  return erros;
}

function log(...a) { if (!process.env.PRODUCAO_SILENCIO) console.log(...a); }

async function obterImagem(origem, pastaTrab, i, base) {
  if (!origem) return null;
  if (/^https?:\/\//i.test(origem)) {
    const ext = (origem.split('?')[0].match(/\.(jpe?g|png|webp|gif|bmp)$/i) || [, 'jpg'])[1].toLowerCase();
    const dest = path.join(pastaTrab, `imagem-${i + 1}.${ext}`);
    if (existsSync(dest)) return dest;
    log(`  baixando imagem da cena ${i + 1}...`);
    const r = await fetch(origem, { redirect: 'follow', signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error(`imagem da cena ${i + 1}: HTTP ${r.status}`);
    const tipo = r.headers.get('content-type') || '';
    if (tipo && !tipo.startsWith('image/')) throw new Error(`imagem da cena ${i + 1}: o link não é uma imagem (${tipo})`);
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 25 * 1024 * 1024) throw new Error(`imagem da cena ${i + 1}: maior que 25 MB`);
    writeFileSync(dest, buf);
    return dest;
  }
  const candidatos = [path.resolve(base, origem), path.resolve(origem)];
  const achado = candidatos.find((c) => existsSync(c));
  if (!achado) throw new Error(`imagem da cena ${i + 1} não encontrada: ${origem}`);
  return achado;
}

/** Momento (relativo à fala) em que um item da lista é citado; null se não achar. */
function momentoDoItem(item, blocos) {
  const chave = String(item.nome || '').toLowerCase().split(/\s+/).filter((w) => w.length >= 3).slice(0, 2);
  if (!chave.length) return null;
  const b = blocos.find((bl) => chave.some((w) => bl.texto.toLowerCase().includes(w)));
  return b ? b.ini : null;
}

/**
 * Monta o vídeo. Retorna { pasta, post, video, duracao, tempos }.
 * @param {string|object} pautaOuArquivo
 */
export async function montar(pautaOuArquivo, opts = {}) {
  const t0 = Date.now();
  const tempos = {};
  const marca = (k, desde) => { tempos[k] = +((Date.now() - desde) / 1000).toFixed(1); return Date.now(); };
  exigirFfmpeg();
  await conferirFiltros();

  const arquivoPauta = typeof pautaOuArquivo === 'string' ? path.resolve(pautaOuArquivo) : null;
  let pauta;
  if (arquivoPauta) {
    if (!existsSync(arquivoPauta)) throw new Error(`pauta não encontrada: ${arquivoPauta}`);
    try { pauta = JSON.parse(readFileSync(arquivoPauta, 'utf8')); } catch (e) { throw new Error(`pauta.json inválida: ${e.message}`); }
  } else pauta = pautaOuArquivo;
  const erros = validarPauta(pauta);
  if (erros.length) throw new Error('pauta com problemas:\n- ' + erros.join('\n- '));
  const base = arquivoPauta ? path.dirname(arquivoPauta) : process.cwd();

  const canal = carregarCanal(opts.canal);
  const fontes = escolherFontes(canal);
  const vozFalsa = opts.vozFalsa || process.env.PRODUCAO_VOZ_FALSA === '1';
  if (!vozFalsa && !acharPiper()) {
    throw new Error('Piper (voz gratuita) não instalado. Rode: node producao/instalar-voz.js ' +
      '(ou INICIAR.bat no Windows). Para testar sem voz: --voz-falsa');
  }
  const pastaTrab = path.join(opts.trabalho || PASTA_TRABALHO, pauta.id);
  const pastaSaida = path.join(opts.saida || PASTA_SAIDA, pauta.id);
  mkdirSync(path.join(pastaTrab, 'fontes'), { recursive: true });
  mkdirSync(pastaSaida, { recursive: true });
  for (const f of [fontes.titulo, fontes.texto]) copyFileSync(f.arquivo, path.join(pastaTrab, 'fontes', path.basename(f.arquivo)));

  let t = Date.now();
  const sons = await garantirSons({ log: (m) => log('  ' + m) });
  t = marca('sons', t);

  // 1) narração
  log(`[1/5] narração (${vozFalsa ? 'voz falsa de teste' : 'Piper'})`);
  const modelo = pauta.voz?.modelo || canal.voz.modelo || MODELO_PADRAO;
  let velocidade = Number(pauta.voz?.velocidade || canal.voz.velocidade || 1);
  let falas;
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    falas = [];
    for (const [i, cena] of pauta.cenas.entries()) {
      falas.push(await falar(cena.fala, { modelo, velocidade, falsa: vozFalsa }));
      log(`  cena ${i + 1}/${pauta.cenas.length}: ${falas[i].duracao.toFixed(2)} s`);
    }
    const total = falas.reduce((s, f) => s + f.duracao + FOLGA, 0);
    if (total <= DURACAO_MAX - 0.2) break;
    if (tentativa === 3 || velocidade >= 1.35) {
      throw new Error(`o vídeo ficaria com ${total.toFixed(1)} s (máximo ${DURACAO_MAX} s). Encurte as falas da pauta.`);
    }
    velocidade = Math.min(1.35, velocidade * (total / (DURACAO_MAX - 1)));
    log(`  ficou com ${total.toFixed(1)} s; acelerando a voz para ${velocidade.toFixed(2)}x`);
  }
  t = marca('narracao', t);

  // 2) linha do tempo (em quadros, para áudio e vídeo baterem)
  let quadroAtual = 0;
  const cenas = pauta.cenas.map((cena, i) => {
    const q = Math.round((falas[i].duracao + FOLGA) * FPS);
    const c = { ...cena, indice: i, inicio: quadroAtual / FPS, quadros: q, voz: falas[i] };
    quadroAtual += q;
    c.fim = quadroAtual / FPS;
    c.vozInicio = c.inicio + ATRASO_VOZ;
    return c;
  });
  const duracao = quadroAtual / FPS;

  // legenda: blocos sincronizados pelo áudio real de cada fala
  for (const c of cenas) {
    const blocos = cronometrar(dividirBlocos(c.fala), {
      duracao: c.voz.duracao, segmentos: c.voz.segmentos,
    });
    c.blocos = blocos.map((b) => ({ ...b, cena: c.indice, ini: b.ini + c.vozInicio, fim: Math.min(b.fim + c.vozInicio, c.fim), falaFim: b.falaFim + c.vozInicio }));
  }

  // 3) fundos
  log('[2/5] fundos das cenas');
  const clipes = cenas.map((c) => path.join(pastaTrab, `fundo-${c.indice + 1}.mp4`));
  for (const c of cenas) {
    if (c.tipo === 'imagem' && c.imagem) {
      try { c.arquivoImagem = await obterImagem(c.imagem, pastaTrab, c.indice, base); } catch (e) {
        log(`  aviso: ${e.message} — usando fundo gerado`);
      }
    }
  }
  // gera os fundos em paralelo (o gradiente e o libx264 não usam todos os núcleos sozinhos)
  const fila = [...cenas];
  const trabalhador = async () => {
    for (let c = fila.shift(); c; c = fila.shift()) {
      const saida = clipes[c.indice];
      if (c.arquivoImagem) {
        c.caixaImagem = await fundoImagem({ saida, quadros: c.quadros, imagem: c.arquivoImagem, cores: canal.cores });
        c.temImagem = true;
      } else {
        await fundoGerado({ saida, quadros: c.quadros, cores: canal.cores, semente: c.indice + 3,
          paleta: c.tipo === 'gancho' ? 'alerta' : 'normal' });
      }
    }
  };
  await texturaGrade(pastaTrab);
  await Promise.all(Array.from({ length: Math.min(3, cenas.length) }, trabalhador));
  const fundo = path.join(pastaTrab, 'fundo.mp4');
  await concatenar(clipes, fundo, pastaTrab);
  t = marca('fundos', t);

  // 4) camada gráfica + efeitos sonoros
  log('[3/5] gráficos, legenda e efeitos');
  const ass = criarAss({ canal, fontes, duracaoTotal: duracao });
  const efeitos = [];
  const ef = (nome, tempo, volume) => { if (canal.efeitos !== false) efeitos.push({ arquivo: sons.efeitos[nome], t: tempo, volume }); };
  ass.progresso(duracao);
  const fontesPauta = (pauta.fontes || []).filter((f) => f && f.titulo);
  for (const c of cenas) {
    const selo = c.selo || (c.tipo === 'gancho' ? SELOS[pauta.tipo] || 'NOTÍCIA' : null);
    if (c.indice > 0) { ass.transicao(c.inicio); ef('whoosh', c.inicio - 0.32, 0.55); }
    if (!c.temImagem && c.tipo !== 'lista') ass.particulas(c.inicio, c.fim, c.indice + 1);
    if (c.tipo === 'lista') ass.particulas(c.inicio, c.fim, c.indice + 1);
    if (c.tipo !== 'fim') ass.marca(c.inicio, c.fim);
    const chaveTexto = (txt) => {
      const toks = tokenizar(c.destaque ? `*${c.destaque}*` : txt);
      const k = palavraChave(toks, { textoCena: '' });
      return c.destaque || (k >= 0 ? toks[k].texto.replace(/[.,!?:;]$/, '') : null);
    };
    let yLegenda = Y_LEGENDA;
    if (c.tipo === 'gancho') {
      ass.gancho({ ini: c.inicio, fim: c.fim, texto: c.texto || pauta.titulo || '', selo, chave: chaveTexto(c.texto || pauta.titulo || '') });
      ef('impacto', c.inicio + 0.05, c.indice === 0 ? 0.7 : 0.5);
      // riser que sobe até a próxima cena
      if (c.fim - c.inicio > 2.2 && c.indice < cenas.length - 1) ef('riser', c.fim - 1.6, 0.32);
    } else if (c.tipo === 'imagem') {
      if (c.temImagem) {
        const cx = c.caixaImagem;
        const fimFaixa = ass.faixa({ ini: c.inicio, fim: c.fim, texto: c.texto || '', y: cx.y + cx.h + 62, selo: c.selo });
        if (c.credito) ass.credito({ ini: c.inicio, fim: c.fim, texto: c.credito, x: cx.x + 14, y: cx.y + cx.h - 14 });
        yLegenda = Math.max(Y_LEGENDA, fimFaixa + 130);
      } else if (c.texto) {
        ass.manchete({ ini: c.inicio, fim: c.fim, texto: c.texto, selo: c.selo, chave: chaveTexto(c.texto) });
      }
      if (c.texto) ef('clique', c.inicio + 0.12, 0.35);
    } else if (c.tipo === 'lista') {
      const itens = c.itens.slice(0, 5);
      if (c.texto) ass.cabecalho({ ini: c.inicio, fim: c.fim, texto: c.texto });
      const topo0 = 450;
      const espaco = 24;
      const altura = Math.min(200, Math.floor((900 - espaco * (itens.length - 1)) / itens.length));
      const janela = (c.fim - c.inicio) * 0.75;
      let anterior = c.inicio + 0.15;
      itens.forEach((item, k) => {
        const citado = momentoDoItem(item, c.blocos);
        let ini = citado != null ? citado - 0.1 : c.inicio + 0.25 + (janela * k) / itens.length;
        ini = Math.max(ini, anterior + 0.35);
        ini = Math.min(ini, c.fim - 0.8);
        anterior = ini;
        ass.card({ ini, fim: c.fim, item, topo: topo0 + k * (altura + espaco), altura });
        ef('pop', ini, 0.5);
        if (item.por) ef('ding', ini + 0.33, 0.32);
      });
      yLegenda = Math.max(Y_LEGENDA, topo0 + itens.length * (altura + espaco) + 90);
    } else if (c.tipo === 'fim') {
      ass.fim({ ini: c.inicio, fim: c.fim, texto: c.texto, fontes: fontesPauta });
      ef('impacto', c.inicio + 0.05, 0.35);
      ef('clique', c.inicio + 0.45 + 0.9, 0.5);
      ef('ding', c.inicio + 0.45 + 0.95, 0.25);
    }
    ass.legenda(c.blocos, { y: Math.min(yLegenda, 1500), textoCena: c.texto || '' });
  }
  const arqAss = path.join(pastaTrab, 'grafico.ass');
  writeFileSync(arqAss, ass.texto());

  // capa: título grande sobre o melhor quadro
  const capa = criarAss({ canal, fontes, duracaoTotal: 5 });
  const tituloCapa = pauta.titulo || cenas[0].texto || '';
  capa.marca(0, 5);
  capa.gancho({ ini: -1, fim: 5, texto: tituloCapa, selo: SELOS[pauta.tipo] || 'NOTÍCIA', chave: chaveDoTitulo(tituloCapa) });
  const arqCapa = path.join(pastaTrab, 'capa.ass');
  writeFileSync(arqCapa, capa.texto());
  t = marca('graficos', t);

  // 5) áudio
  log('[4/5] mixagem (voz + trilha com ducking + efeitos, -14 LUFS)');
  const trilha = escolherTrilha(opts.trilha || pauta.trilha || canal.trilha, pauta.tipo,
    { trilhas: sons.trilhas, semente: pauta.id.length });
  const mix = path.join(pastaTrab, 'mix.wav');
  await mixar({
    falas: cenas.map((c) => ({ wav: c.voz.wav, inicio: c.vozInicio })),
    efeitos, trilha, duracao, volumeTrilha: Number(canal.volumeTrilha ?? 0.6), saida: mix, pasta: pastaTrab,
  });
  t = marca('audio', t);

  // 6) render final, capa, srt, post.json
  log('[5/5] render final (H.264 1080x1920 30 fps)');
  const video = path.join(pastaSaida, 'video.mp4');
  await renderFinal({ pasta: pastaTrab, fundo, ass: arqAss, audio: mix, saida: video, duracao, preset: opts.rapido ? 'veryfast' : 'medium' });
  t = marca('render', t);
  const cenaCapa = cenas.find((c) => c.temImagem) || cenas[0];
  await renderCapa({ pasta: pastaTrab, fundo, tempo: cenaCapa.inicio + Math.min(1.5, (cenaCapa.fim - cenaCapa.inicio) / 2), ass: arqCapa, saida: path.join(pastaSaida, 'capa.jpg') });

  const todosBlocos = cenas.flatMap((c) => c.blocos);
  writeFileSync(path.join(pastaSaida, 'legenda.srt'), gerarSrt(agruparParaSrt(todosBlocos)));

  const duracaoReal = await duracaoMidia(video);
  const hashtags = (pauta.post?.hashtags || []).map((h) => (String(h).startsWith('#') ? h : `#${h}`));
  const post = {
    id: pauta.id,
    titulo: pauta.titulo || '',
    tipo: pauta.tipo || 'noticia',
    criadoEm: Date.now(),
    video: 'video.mp4',
    capa: 'capa.jpg',
    legenda: pauta.post?.legenda || pauta.titulo || '',
    hashtags,
    fontes: pauta.fontes || [],
    duracao: +duracaoReal.toFixed(2),
    estado: 'pronto',
    critico: null,
    motivos: [],
    redes: {},
  };
  // imagens usadas (o revisor confere crédito/direitos)
  const imagens = cenas.filter((c) => c.imagem).map((c) => ({ cena: c.indice + 1, origem: c.imagem, credito: c.credito || null, usada: Boolean(c.temImagem) }));
  if (imagens.length) post.imagens = imagens;
  writeFileSync(path.join(pastaSaida, 'post.json'), JSON.stringify(post, null, 2) + '\n');
  if (!opts.manter) {
    for (const c of [...clipes, fundo, path.join(pastaTrab, 'mix-bruto.wav')]) rmSync(c, { force: true });
  }
  tempos.total = +((Date.now() - t0) / 1000).toFixed(1);
  log(`Pronto: ${path.relative(process.cwd(), pastaSaida) || pastaSaida} (${duracaoReal.toFixed(1)} s, em ${tempos.total} s)`);
  log(`  tempos (s): ${Object.entries(tempos).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  return { pasta: pastaSaida, post, video, duracao: duracaoReal, tempos, cenas };
}

function chaveDoTitulo(titulo) {
  const toks = tokenizar(titulo);
  const k = palavraChave(toks, {});
  return k >= 0 ? toks[k].texto.replace(/[.,!?:;]$/, '') : null;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const args = process.argv.slice(2);
  const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
  const flag = (n) => { const i = args.indexOf(n); if (i >= 0) { args.splice(i, 1); return true; } return false; };
  const opts = {
    trilha: opt('--trilha'), saida: opt('--saida'),
    vozFalsa: flag('--voz-falsa'), rapido: flag('--rapido'), manter: flag('--manter'),
  };
  const [arquivo] = args;
  if (!arquivo) {
    console.log('uso: node producao/montar.js <pauta.json> [--voz-falsa] [--trilha pulso|lofi|hype|minhas|nenhuma] [--rapido] [--manter]');
    process.exit(1);
  }
  montar(arquivo, opts).catch((e) => { console.error('\nERRO: ' + e.message); process.exit(1); });
}
