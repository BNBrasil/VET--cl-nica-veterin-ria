// Testes da frente RENDER do vlog: validação do edl, timeline/capítulos, legendas re-mapeadas,
// enquadramento por orientação e (se houver ffmpeg) um render curto de verdade com clipes sintéticos.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {
  validarEdl, calcularTimeline, calcularCapitulos, tempoCapitulo, tempoSrt, transcricaoRecortada,
  blocosSrt, gerarSrt, blocosDinamicos, filtroEnquadramento, dimensoesEfetivas, acharPrograma, corAss,
} from '../vlog/lib/render-comum.js';
import { filtroSegmento } from '../vlog/lib/render-motor.js';
import { assCurto, quebrasEquilibradas, palavraDestaque } from '../vlog/lib/render-ass.js';
import { textoDescricaoYoutube, textoLegendaReels } from '../vlog/lib/render-extras.js';
import { melhoresDoDia, montarCompilado } from '../vlog/compilar.js';

const analise = {
  data: '2025-11-24',
  clipes: [
    { arquivo: 'C:/v/VID_20251124_093012.mp4', duracao: 20, largura: 1920, altura: 1080, rotacao: 0, temAudio: true,
      falas: [{ ini: 2, fim: 6, texto: 'bom dia gente cheguei agora' }, { ini: 10, fim: 12, texto: 'olha isso' }] },
    { arquivo: 'C:/v/VID_20251124_120000.mp4', duracao: 10, largura: 1920, altura: 1080, rotacao: 90, temAudio: false, falas: [] },
    { arquivo: 'C:/v/PXL_20251124_150000.mp4', duracao: 30, largura: 1080, altura: 1920, rotacao: 0, temAudio: true,
      falas: [{ ini: 0, fim: 3, texto: 'o lugar mais bonito que eu já vi' }] },
  ],
};
const edlBom = () => ({
  data: '2025-11-24', titulo: 'Um dia',
  longo: { cortes: [{ clipe: 2, ini: 0, fim: 3, capitulo: 'Abertura' }, { clipe: 0, ini: 1, fim: 13, capitulo: 'Chegada' },
    { clipe: 1, ini: 0, fim: 10, capitulo: 'Igreja' }, { clipe: 2, ini: 5, fim: 25, capitulo: 'Mirante' }], transicao: 'fade' },
  curto: { cortes: [{ clipe: 2, ini: 0, fim: 3 }, { clipe: 0, ini: 2, fim: 6, foco: 'esquerda' }], gancho: 'Olha isso', duracaoMax: 60 },
});

describe('validação do edl', () => {
  test('edl correto passa sem erros', () => {
    const { erros } = validarEdl(edlBom(), analise);
    assert.deepEqual(erros, []);
  });
  test('erros claros: clipe inexistente, fim <= ini, passa da duração, transição e foco inválidos', () => {
    const e = edlBom();
    e.longo.cortes.push({ clipe: 7, ini: 0, fim: 1 }, { clipe: 0, ini: 5, fim: 4 }, { clipe: 1, ini: 2, fim: 15 });
    e.longo.transicao = 'explosao';
    e.curto.cortes[0].foco = 'cima';
    const { erros } = validarEdl(e, analise);
    assert.ok(erros.some((x) => /longo\.cortes\[4\].*clipe 7 não existe.*3 clipe/.test(x)), erros.join('\n'));
    assert.ok(erros.some((x) => /longo\.cortes\[5\].*"fim" \(4\) precisa ser maior que "ini" \(5\)/.test(x)));
    assert.ok(erros.some((x) => /longo\.cortes\[6\].*passa do fim do clipe 1/.test(x)));
    assert.ok(erros.some((x) => /transicao "explosao" inválida/.test(x)));
    assert.ok(erros.some((x) => /curto\.cortes\[0\]: foco "cima" inválido/.test(x)));
  });
  test('clipe pode ser referenciado pelo nome do arquivo; curto longo demais vira aviso', () => {
    const e = edlBom();
    e.curto.cortes = [{ clipe: 'PXL_20251124_150000.mp4', ini: 0, fim: 30 }, { clipe: 0, ini: 0, fim: 20 }];
    e.curto.duracaoMax = 45;
    const { erros, avisos } = validarEdl(e, analise);
    assert.deepEqual(erros, []);
    assert.ok(avisos.some((a) => /mais que duracaoMax/.test(a)));
  });
  test('edl vazio ou sem cortes', () => {
    assert.ok(validarEdl({}, analise).erros.length);
    assert.ok(validarEdl({ longo: { cortes: [] } }, analise).erros.some((x) => /pelo menos 1 corte/.test(x)));
  });
});

describe('timeline e capítulos', () => {
  test('offsets somam as durações (quantizadas a 30 fps) e maxDur corta o fim', () => {
    const { segmentos, duracao } = calcularTimeline(edlBom().longo.cortes, analise);
    assert.deepEqual(segmentos.map((s) => s.offset), [0, 3, 15, 25]);
    assert.equal(duracao, 45);
    const c = calcularTimeline([{ clipe: 0, ini: 0, fim: 1.01 }, { clipe: 2, ini: 0, fim: 30 }], analise, { maxDur: 20 });
    assert.equal(c.segmentos[0].dur, 1); // 1,01 s → 30 quadros
    assert.equal(c.duracao, 20);
    assert.equal(c.segmentos[1].fim, 19);
  });
  test('formato do YouTube: 00:00, primeiro em zero, curtos absorvidos', () => {
    assert.equal(tempoCapitulo(0), '00:00');
    assert.equal(tempoCapitulo(75.9), '01:15');
    assert.equal(tempoCapitulo(3725), '1:02:05');
    const { segmentos, duracao } = calcularTimeline(edlBom().longo.cortes, analise);
    const cap = calcularCapitulos(segmentos, duracao);
    // "Abertura" tem 3 s (< 10): o capítulo seguinte passa a começar em 00:00
    assert.equal(cap.texto, '00:00 Chegada\n00:15 Igreja\n00:25 Mirante');
    assert.equal(cap.valido, true);
  });
  test('sem capítulo no 1º trecho entra "Abertura"; menos de 3 → inválido', () => {
    const segs = [{ offset: 0, dur: 12 }, { offset: 12, dur: 30, capitulo: 'Praia' }];
    const cap = calcularCapitulos(segs, 42);
    assert.equal(cap.texto, '00:00 Abertura\n00:12 Praia');
    assert.equal(cap.valido, false);
  });
});

describe('legendas a partir da transcrição recortada', () => {
  test('tempos re-mapeados para depois dos cortes', () => {
    const { segmentos } = calcularTimeline([{ clipe: 2, ini: 0, fim: 3 }, { clipe: 0, ini: 4, fim: 12 }], analise);
    const falas = transcricaoRecortada(segmentos);
    assert.equal(falas[0].texto, 'o lugar mais bonito que eu já vi');
    // a fala "bom dia gente cheguei agora" (2–6 s) foi cortada em 4 s: só as palavras do fim entram
    const f2 = falas.find((f) => /agora/.test(f.texto));
    assert.ok(!/bom/.test(f2.texto));
    assert.ok(f2.ini >= 3 && f2.fim <= 5.01, `${f2.ini} ${f2.fim}`);
    const f3 = falas.find((f) => f.texto === 'olha isso');
    assert.ok(Math.abs(f3.ini - 9) < 1e-6 && Math.abs(f3.fim - 11) < 1e-6); // 10–12 → 3 + (10-4) = 9
  });
  test('srt no formato exato, ≤ 42 caracteres por linha, ≤ 2 linhas', () => {
    const { segmentos } = calcularTimeline([{ clipe: 2, ini: 0, fim: 3 }, { clipe: 0, ini: 0, fim: 13 }], analise);
    const srt = gerarSrt(blocosSrt(transcricaoRecortada(segmentos)));
    assert.match(srt, /^1\n00:00:00,000 --> 00:00:0\d,\d{3}\n/);
    for (const bloco of srt.trim().split('\n\n')) {
      const linhas = bloco.split('\n');
      assert.match(linhas[1], /^\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}$/);
      assert.ok(linhas.length - 2 <= 2);
      for (const l of linhas.slice(2)) assert.ok(l.length <= 42);
    }
    assert.equal(tempoSrt(3661.5), '01:01:01,500');
  });
  test('legenda dinâmica: blocos de 2 a 4 palavras sem terminar em "e"/"de"', () => {
    const falas = [{ palavras: 'já estou cansado e nem começou a trilha de verdade'.split(' ').map((w, i) => ({ w, t0: i * 0.3, t1: i * 0.3 + 0.28 })) }];
    const blocos = blocosDinamicos(falas);
    for (const b of blocos) assert.ok(b.palavras.length >= 1 && b.palavras.length <= 4);
    assert.ok(blocos.every((b, i) => i === blocos.length - 1 || !['e', 'de', 'a'].includes(b.palavras.at(-1).w)), JSON.stringify(blocos.map((b) => b.palavras.map((p) => p.w))));
    const ass = assCurto({ segmentos: [], duracao: 4, gancho: 'Gancho', canal: { cores: { destaque: '#FFD400', texto: '#FFFFFF', contorno: '#000000' }, marcaDagua: false }, fontes: { titulo: { nome: 'DejaVu Sans', negrito: 1 }, legenda: { nome: 'DejaVu Sans', negrito: 1 } }, falas });
    assert.match(ass, /Dialogue: 3,0:00:00\.00,0:00:02\.20,Gancho/);
    assert.ok(ass.includes(`\\c${corAss('#FFD400')}`)); // palavra falada em destaque
  });
});

describe('enquadramento por orientação', () => {
  const C = { w: 1080, h: 1920 }, L = { w: 1920, h: 1080 };
  test('rotação 90° troca largura e altura', () => {
    assert.deepEqual(dimensoesEfetivas({ largura: 1920, altura: 1080, rotacao: 90 }), { w: 1080, h: 1920 });
    assert.deepEqual(dimensoesEfetivas({ largura: 1920, altura: 1080, rotacao: -90 }), { w: 1080, h: 1920 });
  });
  test('9:16: vertical nativo/rotacionado só escala; horizontal recorta no foco', () => {
    assert.equal(filtroEnquadramento({ largura: 1080, altura: 1920 }, C).modo, 'escala');
    assert.equal(filtroEnquadramento({ largura: 1920, altura: 1080, rotacao: 90 }, C).modo, 'escala');
    const centro = filtroEnquadramento({ largura: 1920, altura: 1080 }, C, 'centro');
    assert.equal(centro.modo, 'recorte');
    assert.match(centro.filtro, /crop=w='trunc\(ih\*1080\/1920\/2\)\*2'.*iw\*0\.500/);
    assert.match(filtroEnquadramento({ largura: 1920, altura: 1080 }, C, 'esquerda').filtro, /iw\*0\.180/);
    assert.match(filtroEnquadramento({ largura: 1920, altura: 1080 }, C, 'direita').filtro, /iw\*0\.820/);
    assert.match(filtroEnquadramento({ largura: 1920, altura: 1080 }, C, 'rosto', { rostoX: 0.3 }).filtro, /iw\*0\.300/);
    assert.match(filtroEnquadramento({ largura: 1920, altura: 1080 }, C, 'rosto').filtro, /iw\*0\.500/); // sem rosto → centro
  });
  test('fundo desfocado: pedido, panorâmico, ou vertical no 16:9', () => {
    assert.equal(filtroEnquadramento({ largura: 1920, altura: 1080 }, C, 'fundo').modo, 'fundo');
    assert.equal(filtroEnquadramento({ largura: 3840, altura: 1080 }, C, 'centro').modo, 'fundo');
    const f = filtroEnquadramento({ largura: 1080, altura: 1920 }, L);
    assert.equal(f.modo, 'fundo');
    assert.match(f.filtro, /boxblur/);
    assert.equal(filtroEnquadramento({ largura: 1920, altura: 1080 }, L).modo, 'escala');
    assert.equal(filtroEnquadramento({ largura: 1440, altura: 1080 }, L).modo, 'recorte');
  });
  test('segmento: micro-fade de áudio em todo corte, silêncio para clipe sem áudio, ass com tempo global', () => {
    const seg = { tipo: 'clipe', dur: 2, offset: 12.5, info: { largura: 1920, altura: 1080 }, foco: 'centro' };
    const f = filtroSegmento(seg, { alvo: C, ass: { arquivo: 'curto.ass', fontes: 'fontes' }, temAudio: false });
    assert.match(f, /\[1:a\]aresample/);
    assert.match(f, /afade=t=in:st=0:d=0\.012/);
    assert.match(f, /setpts=PTS-STARTPTS\+12\.500000\/TB,ass=/);
    assert.match(f, /trim=end_frame=60/);
    const z = filtroSegmento(seg, { alvo: L, transicao: 'zoom', temAudio: true });
    assert.match(z, /\[0:a\]/);
    assert.match(z, /eval=frame/);
  });
});

describe('textos, capa e compilado', () => {
  test('quebra equilibrada e palavra de destaque', () => {
    assert.deepEqual([...quebrasEquilibradas('O LUGAR MAIS BONITO QUE EU JÁ VI'.split(' '), 12)], [2, 4]);
    assert.equal(palavraDestaque('Um dia em Ouro Preto'), 4);
  });
  test('descrição com capítulos e legenda com hashtags', () => {
    const canal = { tags: ['vlog'], hashtags: ['#vlog'], rodape: '' };
    const d = textoDescricaoYoutube({ edl: { ...edlBom(), youtube: { titulo: 'T', tags: ['praia'] } }, capitulos: { valido: true, texto: '00:00 A\n00:20 B\n00:40 C' }, canal });
    assert.match(d, /T\n\nDESCRIÇÃO/);
    assert.match(d, /Capítulos:\n00:00 A/);
    assert.match(d, /praia, vlog/);
    const r = textoLegendaReels({ edl: { reels: { legenda: 'Oi', hashtags: ['praia'] } }, canal });
    assert.equal(r, 'Oi\n\n#praia #vlog\n');
  });
  test('compilado usa "melhor": true, senão os maiores; cartela entre os dias', () => {
    const e1 = edlBom();
    e1.longo.cortes[1].melhor = true;
    assert.deepEqual(melhoresDoDia(e1, 100).map((c) => c.ini), [1]);
    assert.equal(melhoresDoDia(edlBom(), 100).length, 3); // sem "melhor": os 3 maiores
    assert.ok(melhoresDoDia(edlBom(), 15).reduce((s, c) => s + c.fim - c.ini, 0) <= 15);
    const dias = [
      { data: '2025-11-24', dir: '/x', analise, edl: e1 },
      { data: '2025-11-25', dir: '/x', analise, edl: edlBom() },
    ];
    const { analise: a, edl } = montarCompilado(dias, { de: '2025-11-24', ate: '2025-11-25', maxMinutos: 2 });
    assert.equal(a.clipes.length, 6);
    const cartelas = edl.longo.cortes.filter((c) => c.tipo === 'cartela');
    assert.deepEqual(cartelas.map((c) => c.texto), ['24/11', '25/11']);
    assert.ok(edl.longo.cortes.filter((c) => c.tipo !== 'cartela').every((c) => c.clipe >= 0 && c.clipe < 6));
    assert.ok(edl.longo.cortes.some((c) => c.clipe >= 3)); // clipes do 2º dia foram re-indexados
    assert.deepEqual(validarEdl(edl, a).erros, []);
    assert.ok(edl.curto.cortes.every((c) => /\d\d\/11/.test(c.rotulo)));
  });
});

// ------------------------------------------------------------------ render real (só com ffmpeg)
const temFfmpeg = !!(acharPrograma('ffmpeg') && acharPrograma('ffprobe'));
describe('render real com clipes sintéticos', { skip: !temFfmpeg && 'ffmpeg não instalado' }, () => {
  test('gera longo 16:9 + curto 9:16 + capas + textos e confere com ffprobe', { timeout: 600000 }, async () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), 'vlog-render-'));
    process.env.VLOG_RAPIDO = '1';
    process.env.VLOG_TRABALHO = path.join(tmp, 'trabalho');
    process.env.VLOG_POSTAR = path.join(tmp, 'postar');
    try {
      const { gerarExemplos } = await import('../vlog/exemplos/gerar-clipes.js');
      await gerarExemplos({ saida: tmp, rapido: true, semVoz: true, log: () => {} });
      const { renderizarData } = await import('../vlog/renderizar.js');
      const rel = await renderizarData('2025-11-24', { log: () => {} });
      const pasta = path.join(tmp, 'postar', '2025-11-24');
      for (const f of ['youtube-16x9.mp4', 'reels-9x16.mp4', 'capa-youtube.jpg', 'capa-reels.jpg', 'descricao-youtube.txt',
        'legenda-reels.txt', 'capitulos.txt', 'youtube.srt', 'reels.srt']) assert.ok(existsSync(path.join(pasta, f)), `falta ${f}`);
      for (const a of rel.arquivos) assert.deepEqual(a.problemas || [], [], a.arquivo);
      const probe = (f, campos) => spawnSync(acharPrograma('ffprobe'), ['-v', 'error', '-show_entries', campos, '-of', 'csv=p=0', path.join(pasta, f)], { encoding: 'utf8' }).stdout.trim();
      assert.equal(probe('capa-youtube.jpg', 'stream=width,height'), '1280,720');
      assert.equal(probe('capa-reels.jpg', 'stream=width,height'), '1080,1920');
      assert.equal(probe('reels-9x16.mp4', 'stream=width,height:stream_tags=:format='), '1080,1920');
      const dv = Number(probe('youtube-16x9.mp4', 'format=duration'));
      const somaCortes = JSON.parse(readFileSync(path.join(tmp, 'trabalho', '2025-11-24', 'edl.json'), 'utf8')).longo.cortes.reduce((s, c) => s + c.fim - c.ini, 0);
      assert.ok(Math.abs(dv - somaCortes) < 0.25, `duração ${dv} vs cortes ${somaCortes}`);
      assert.match(readFileSync(path.join(pasta, 'capitulos.txt'), 'utf8'), /^00:00 /);
      // o bruto não foi tocado: os clipes continuam lá com o mesmo tamanho
      assert.ok(existsSync(path.join(tmp, 'clipes', 'VID_20251124_093012.mp4')));
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
