import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {
  normalizarTexto, numeroPorExtenso, precoPorExtenso, contarSilabas,
} from '../producao/lib/normalizar.js';
import {
  dividirBlocos, cronometrar, agruparParaSrt, gerarSrt, palavraChave, tokenizar, quebrarLinhas,
} from '../producao/lib/legenda.js';
import { corAss, tempoAss, escAss } from '../producao/lib/ass.js';
import { validarPauta } from '../producao/montar.js';
import { acharPrograma } from '../producao/lib/ferramentas.js';

describe('normalização do texto para a voz', () => {
  test('números por extenso', () => {
    assert.equal(numeroPorExtenso(0), 'zero');
    assert.equal(numeroPorExtenso(21), 'vinte e um');
    assert.equal(numeroPorExtenso(100), 'cem');
    assert.equal(numeroPorExtenso(101), 'cento e um');
    assert.equal(numeroPorExtenso(1001), 'mil e um');
    assert.equal(numeroPorExtenso(1250), 'mil duzentos e cinquenta');
    assert.equal(numeroPorExtenso(2026), 'dois mil e vinte e seis');
    assert.equal(numeroPorExtenso(1500000), 'um milhão e quinhentos mil');
    assert.equal(numeroPorExtenso(2, { fem: true }), 'duas');
  });

  test('preços em reais e dólares', () => {
    assert.equal(precoPorExtenso('R$', '79,96'), 'setenta e nove reais e noventa e seis centavos');
    assert.equal(precoPorExtenso('R$', '1,00'), 'um real');
    assert.equal(precoPorExtenso('R$', '1.299,90'), 'mil duzentos e noventa e nove reais e noventa centavos');
    assert.equal(precoPorExtenso('R$', '0,50'), 'cinquenta centavos');
    assert.match(normalizarTexto('Sai por R$ 79,96.'), /setenta e nove reais e noventa e seis centavos/);
    assert.match(normalizarTexto('Custa US$ 69,99.'), /sessenta e nove dólares e noventa e nove centavos/);
    assert.match(normalizarTexto('Agora R$79!'), /setenta e nove reais!/);
  });

  test('porcentagens e desconto', () => {
    assert.match(normalizarTexto('Cyberpunk com -60%!'), /com sessenta por cento de desconto!/);
    assert.match(normalizarTexto('até 90% off'), /noventa por cento de desconto/);
    assert.match(normalizarTexto('cresceu 15%'), /quinze por cento/);
  });

  test('siglas e nomes de jogos com pronúncia', () => {
    const t = normalizarTexto('GTA VI chega ao PS5 e ao Xbox Series X|S com DLC na Steam.');
    assert.match(t, /^gê tê á seis chega ao pê ésse cinco/);
    assert.match(t, /écsbóx séries écs e ésse/);
    assert.match(t, /dê éle cê na istím/);
    assert.match(normalizarTexto('GTA V'), /gê tê á cinco/);
    assert.match(normalizarTexto('O RPG novo'), /érre pê gê/);
    assert.match(normalizarTexto('Final Fantasy VII'), /Final Fantasy sete/);
    assert.match(normalizarTexto('É OFICIAL'), /É OFICIAL/); // palavra comum não é soletrada
  });

  test('datas, horas, ordinais e limpeza', () => {
    assert.match(normalizarTexto('Sai em 26/05/2026'), /vinte e seis de maio de dois mil e vinte e seis/);
    assert.match(normalizarTexto('Trailer dia 4/12 às 14h'), /quatro de dezembro às catorze horas/);
    assert.match(normalizarTexto('às 18h30'), /dezoito e trinta/);
    assert.match(normalizarTexto('dia 1º de dezembro'), /primeiro de dezembro/);
    assert.match(normalizarTexto('são 2 horas'), /duas horas/);
    const t = normalizarTexto('Corre! 🎮 #gamer https://exemplo.com *agora*');
    assert.doesNotMatch(t, /🎮|#|https|\*/);
    assert.match(t, /\.$|!$/);
  });

  test('sílabas', () => {
    assert.equal(contarSilabas('casa'), 2);
    assert.equal(contarSilabas('promoção'), 3);
    assert.equal(contarSilabas('que'), 1);
  });
});

describe('legenda dinâmica', () => {
  const fala = 'A Rockstar acabou de confirmar: o trailer 3 de GTA VI sai dia 4/12. E o jogo custa *R$ 349,90* no PS5.';

  test('preço fica junto num token e *destaque* é marcado', () => {
    const toks = tokenizar(fala);
    const preco = toks.find((t) => t.texto.startsWith('R$'));
    assert.equal(preco.texto, 'R$ 349,90');
    assert.equal(preco.destaque, true);
  });

  test('blocos de 2 a 4 palavras, sem terminar em preposição', () => {
    const blocos = dividirBlocos(fala);
    assert.ok(blocos.length >= 5);
    for (const b of blocos) {
      assert.ok(b.palavras.length >= 1 && b.palavras.length <= 5, b.texto);
      assert.doesNotMatch(b.texto, /\s(de|o|a|e|no|da|do)$/i, b.texto);
    }
    assert.equal(blocos.map((b) => b.texto).join(' '), fala.replace(/\*/g, ''));
    assert.ok(blocos.some((b) => b.fimFrase));
  });

  test('palavra-chave: marcada > número > sigla', () => {
    const [b] = dividirBlocos('custa *muito* R$ 10');
    assert.equal(b.palavras[palavraChave(b.palavras)].texto, 'muito');
    const toks = tokenizar('o trailer 3 sai');
    assert.equal(toks[palavraChave(toks)].texto, '3');
    const toks2 = tokenizar('novo GTA chegando');
    assert.equal(toks2[palavraChave(toks2)].texto, 'GTA');
  });

  test('tempo distribuído na fala real, encaixado nas pausas', () => {
    const blocos = dividirBlocos(fala);
    const segmentos = [{ ini: 0.05, fim: 4.8 }, { ini: 5.5, fim: 9.0 }];
    const t = cronometrar(blocos, { duracao: 9.1, segmentos });
    assert.ok(t[0].ini >= 0.05 - 1e-6);
    for (let i = 0; i < t.length; i++) {
      assert.ok(t[i].fim > t[i].ini, `bloco ${i}`);
      if (i) assert.ok(t[i].ini >= t[i - 1].ini, 'ordem');
    }
    // o bloco que começa a segunda frase começa depois do silêncio
    const segunda = t.find((b) => b.texto.startsWith('E o jogo'));
    assert.ok(Math.abs(segunda.ini - 5.5) < 0.01, `segunda frase em ${segunda.ini}`);
    assert.ok(t[t.length - 1].falaFim <= 9.0 + 1e-6);
  });

  test('SRT no formato certo e dentro das regras', () => {
    const t = cronometrar(dividirBlocos(fala), { duracao: 9.1, segmentos: [{ ini: 0, fim: 4.8 }, { ini: 5.5, fim: 9 }] });
    const cues = agruparParaSrt(t);
    const srt = gerarSrt(cues);
    const blocos = srt.trim().split(/\n\n/);
    assert.equal(blocos.length, cues.length);
    let prevFim = -1;
    const ms = (s) => { const [h, m, r] = s.split(':'); const [sec, mil] = r.split(','); return ((+h * 60 + +m) * 60 + +sec) * 1000 + +mil; };
    blocos.forEach((b, i) => {
      const l = b.split('\n');
      assert.equal(l[0], String(i + 1));
      const m = /^(\d\d:\d\d:\d\d,\d{3}) --> (\d\d:\d\d:\d\d,\d{3})$/.exec(l[1]);
      assert.ok(m, l[1]);
      const ini = ms(m[1]); const fim = ms(m[2]);
      assert.ok(fim - ini >= 1000, `bloco ${i + 1} curto`);
      assert.ok(ini >= prevFim, 'sobreposição');
      prevFim = fim;
      const linhas = l.slice(2);
      assert.ok(linhas.length >= 1 && linhas.length <= 2);
      for (const x of linhas) assert.ok(x.length <= 42, x);
    });
    assert.deepEqual(quebrarLinhas('curto'), ['curto']);
  });
});

describe('utilidades ASS e pauta', () => {
  test('cores, tempos e escape', () => {
    assert.equal(corAss('#FFD60A'), '&H0AD6FF&');
    assert.equal(tempoAss(61.234), '0:01:01.23');
    assert.equal(escAss('a{b}\\c'), 'a(b)/c');
    assert.equal(escAss('GTA: 50% "off"'), 'GTA: 50% "off"');
  });

  test('validação da pauta', () => {
    assert.deepEqual(validarPauta({ id: 'x', cenas: [{ tipo: 'fim', fala: 'oi' }] }), []);
    const e = validarPauta({ id: 'a b', cenas: [{ tipo: 'nada', fala: '' }, { tipo: 'imagem', fala: 'x', imagem: 'a.jpg' }] });
    assert.ok(e.some((m) => /id/.test(m)));
    assert.ok(e.some((m) => /tipo/.test(m)));
    assert.ok(e.some((m) => /sem "fala"/.test(m)));
    assert.ok(e.some((m) => /credito/.test(m)));
  });
});

const temFfmpeg = Boolean(acharPrograma('ffmpeg') && acharPrograma('ffprobe'));

describe('montagem (precisa do ffmpeg)', { skip: !temFfmpeg && 'ffmpeg não instalado' }, () => {
  test('vídeo curto de 2 cenas com voz falsa nas specs do contrato', { timeout: 300000 }, async () => {
    process.env.PRODUCAO_SILENCIO = '1';
    const { montar } = await import('../producao/montar.js');
    const tmp = mkdtempSync(path.join(os.tmpdir(), 'producao-teste-'));
    try {
      const pauta = {
        id: 'teste-curto',
        titulo: 'Teste: GTA VI com -50%',
        tipo: 'promocao',
        cenas: [
          { tipo: 'gancho', fala: 'GTA VI com cinquenta por cento!', texto: 'GTA VI: -50%' },
          { tipo: 'fim', fala: 'Segue o canal!', texto: 'SIGA' },
        ],
        fontes: [{ titulo: 'Loja', url: 'https://exemplo.com', oficial: true }],
        post: { legenda: 'teste', hashtags: ['gta6', '#teste'] },
      };
      const r = await montar(pauta, { vozFalsa: true, rapido: true, saida: tmp, trabalho: tmp });
      const pasta = path.join(tmp, 'teste-curto');
      for (const f of ['video.mp4', 'legenda.srt', 'capa.jpg', 'post.json']) assert.ok(existsSync(path.join(pasta, f)), f);
      const probe = spawnSync(acharPrograma('ffprobe'), ['-v', 'error', '-show_entries',
        'stream=codec_name,profile,width,height,r_frame_rate,pix_fmt,sample_rate,channels:format=duration',
        '-of', 'json', path.join(pasta, 'video.mp4')], { encoding: 'utf8' });
      const info = JSON.parse(probe.stdout);
      const v = info.streams.find((s) => s.codec_name === 'h264');
      const a = info.streams.find((s) => s.codec_name === 'aac');
      assert.equal(v.width, 1080);
      assert.equal(v.height, 1920);
      assert.equal(v.r_frame_rate, '30/1');
      assert.equal(v.profile, 'High');
      assert.equal(v.pix_fmt, 'yuv420p');
      assert.equal(a.sample_rate, '48000');
      assert.equal(a.channels, 2);
      const dur = Number(info.format.duration);
      assert.ok(dur > 1 && dur <= 60, `duração ${dur}`);
      // faststart: o átomo moov vem antes do mdat
      const head = readFileSync(path.join(pasta, 'video.mp4')).subarray(0, 200000).toString('latin1');
      assert.ok(head.indexOf('moov') >= 0 && head.indexOf('moov') < head.indexOf('mdat'), 'faststart');
      // loudness ~ -14 LUFS
      const ln = spawnSync(acharPrograma('ffmpeg'), ['-hide_banner', '-i', path.join(pasta, 'video.mp4'), '-af',
        'ebur128', '-f', 'null', '-'], { encoding: 'utf8' });
      const lufs = Number(ln.stderr.split('Summary:')[1].match(/I:\s+(-?[\d.]+) LUFS/)[1]);
      assert.ok(Math.abs(lufs - -14) <= 1.5, `loudness ${lufs}`);
      const post = JSON.parse(readFileSync(path.join(pasta, 'post.json'), 'utf8'));
      assert.equal(post.estado, 'pronto');
      assert.equal(post.video, 'video.mp4');
      assert.equal(post.critico, null);
      assert.deepEqual(post.hashtags, ['#gta6', '#teste']);
      assert.ok(Math.abs(post.duracao - dur) < 0.2);
      const srt = readFileSync(path.join(pasta, 'legenda.srt'), 'utf8');
      assert.match(srt, /^1\n00:00:00,\d{3} --> /);
      assert.ok(r.cenas.length === 2);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
