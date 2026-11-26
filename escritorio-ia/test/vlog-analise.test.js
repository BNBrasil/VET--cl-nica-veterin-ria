// Testes da frente ANÁLISE do vlog: datas, agrupamento, parsers do ffmpeg, filtro de alucinação do Whisper
// e (se houver ffmpeg) uma análise real rápida de um clipe sintético, sem transcrição.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, existsSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {
  dataDoNome, dataDaPasta, dataDoMetadado, descobrirData, agruparPorData, tagsDoProbe, nomeSemData,
} from '../vlog/lib/datas.js';
import {
  parseSilencedetect, parseCenas, parseEbur128, energiaPorSegundo, trechosComVoz, resumirProbe, estimarTremido,
  ehVideo, arquivoIgnorado,
} from '../vlog/lib/midia.js';
import {
  filtrarAlucinacoes, colapsarRepeticoes, lerJsonWhisper, tempoWhisper, srtDoDia,
} from '../vlog/lib/transcrever.js';
import { rotuloTempo, temposDosQuadros, etiquetaPpm } from '../vlog/lib/folhas.js';
import { lerArgs, stemsUnicos, varrer } from '../vlog/analisar.js';
import { acharPrograma } from '../vlog/lib/externos.js';

const SP = -180; // fuso de Brasília (UTC-3), fixo para o teste não depender do computador

describe('vlog: data pelo nome do arquivo', () => {
  const casos = {
    'VID_20251124_153012.mp4': ['2025-11-24', '15:30:12'],
    'IMG_20251124_153012.mp4': ['2025-11-24', '15:30:12'],
    'PXL_20251124_153012345.mp4': ['2025-11-24', '15:30:12'],
    'PXL_20251124_153012345.LS.mp4': ['2025-11-24', '15:30:12'],
    'MVIMG_20251124_153012.mp4': ['2025-11-24', '15:30:12'],
    '20251124_153012.mp4': ['2025-11-24', '15:30:12'],
    '2025-11-24 15.30.12.mov': ['2025-11-24', '15:30:12'],
    '2025-11-24 15-30-12.mkv': ['2025-11-24', '15:30:12'], // OBS
    'video_2025-11-24_15-30-12.mp4': ['2025-11-24', '15:30:12'], // Telegram
    'WhatsApp Video 2025-11-24 at 15.30.12.mp4': ['2025-11-24', '15:30:12'],
    'WhatsApp Video 2025-11-24 at 3.30.12 PM.mp4': ['2025-11-24', '15:30:12'],
    'WhatsApp Video 2025-11-24 at 12.05.00 AM.mp4': ['2025-11-24', '00:05:00'],
    'VID-20251124-WA0003.mp4': ['2025-11-24', null], // WhatsApp Android
    'DJI_20251124153012_0001_D.MP4': ['2025-11-24', '15:30:12'],
    'VID20251124153012.mp4': ['2025-11-24', '15:30:12'], // Oppo/Realme
    'Screen_Recording_20251124-153012_Instagram.mp4': ['2025-11-24', '15:30:12'],
    'InShot_20251124_153012345.mp4': ['2025-11-24', '15:30:12'],
    'IMG_20251124.mp4': ['2025-11-24', null],
    '24-11-2025 15.30.mp4': ['2025-11-24', '15:30:00'],
    'RPReplay_Final1700000000.mp4': ['2023-11-14', '19:13:20'], // gravação de tela do iPhone (horário Unix)
  };
  for (const [nome, [data, hora]] of Object.entries(casos)) {
    test(nome, () => {
      const r = dataDoNome(nome, { fusoMin: SP });
      assert.ok(r, `sem data para ${nome}`);
      assert.equal(r.data, data);
      assert.equal(r.hora, hora);
    });
  }
  test('nomes sem data (GoPro, DJI antigo, iPhone IMG_1234) e datas inválidas', () => {
    for (const n of ['GH010123.MP4', 'GX010045.MP4', 'GOPR0001.MP4', 'DJI_0001.MP4', 'IMG_1234.MOV', 'clip.mp4', '20251399_101010.mp4', 'C0001.MP4']) {
      assert.equal(dataDoNome(n), null, n);
    }
    assert.ok(nomeSemData('GH010123.MP4'));
    assert.equal(dataDoNome('VID_20250230_101010.mp4'), null); // 30 de fevereiro
  });
});

describe('vlog: data pela pasta, metadado e mtime (ordem do contrato)', () => {
  test('subpasta AAAA-MM-DD / DD-MM-AAAA / com texto', () => {
    assert.equal(dataDaPasta('2025-11-24/a.mp4'), '2025-11-24');
    assert.equal(dataDaPasta('viagem/24-11-2025/b/a.mp4'), '2025-11-24');
    assert.equal(dataDaPasta('2025-11-24 Ouro Preto/a.mp4'), '2025-11-24');
    assert.equal(dataDaPasta('2025_11_24\\a.mp4'), '2025-11-24');
    assert.equal(dataDaPasta('Dia 3 - 25.11.2025/a.mp4'), '2025-11-25');
    assert.equal(dataDaPasta('a.mp4'), null);
    assert.equal(dataDaPasta('2025-11-24.mp4'), null); // o próprio arquivo não conta como pasta
  });
  test('pasta vence o nome; hora vem do nome se for do mesmo dia', () => {
    const r = descobrirData({ caminhoRelativo: '2025-11-24/VID_20251124_153012.mp4', fusoMin: SP });
    assert.deepEqual(r, { data: '2025-11-24', hora: '15:30:12', fonte: 'pasta', incerta: false });
    const r2 = descobrirData({ caminhoRelativo: '2025-11-25/VID_20251124_153012.mp4', fusoMin: SP });
    assert.equal(r2.data, '2025-11-25');
    assert.equal(r2.hora, null);
  });
  test('nome vence o metadado', () => {
    const r = descobrirData({ caminhoRelativo: 'VID_20251124_153012.mp4', tags: { creation_time: '2025-12-01T10:00:00.000000Z' }, fusoMin: SP });
    assert.equal(r.fonte, 'nome');
    assert.equal(r.data, '2025-11-24');
  });
  test('creation_time em UTC convertido para o fuso local (vira o dia anterior)', () => {
    const r = descobrirData({ caminhoRelativo: 'IMG_1234.MOV', tags: { creation_time: '2025-11-25T01:30:12.000000Z' }, fusoMin: SP });
    assert.deepEqual(r, { data: '2025-11-24', hora: '22:30:12', fonte: 'metadado', incerta: false });
  });
  test('iPhone: com.apple.quicktime.creationdate já tem a hora local', () => {
    const r = dataDoMetadado({ 'com.apple.quicktime.creationdate': '2025-11-24T22:30:12-0300', creation_time: '2025-11-25T01:30:12Z' }, { fusoMin: 0 });
    assert.deepEqual(r, { data: '2025-11-24', hora: '22:30:12' });
  });
  test('GoPro grava a hora local marcada como UTC: não converte', () => {
    const r = descobrirData({ caminhoRelativo: 'GH010123.MP4', tags: { creation_time: '2025-11-26T06:10:00.000000Z' }, fusoMin: SP });
    assert.equal(r.data, '2025-11-26');
    assert.equal(r.hora, '06:10:00');
  });
  test('datas zeradas (1904/1970) são ignoradas e cai no mtime, marcado como incerto', () => {
    const mtime = Date.UTC(2025, 10, 24, 18, 0, 0);
    const r = descobrirData({ caminhoRelativo: 'clip.mp4', tags: { creation_time: '1970-01-01T00:00:00.000000Z' }, mtime, fusoMin: SP });
    assert.deepEqual(r, { data: '2025-11-24', hora: '15:00:00', fonte: 'mtime', incerta: true });
  });
  test('tagsDoProbe junta tags do formato e dos streams', () => {
    const t = tagsDoProbe({ format: { tags: { major_brand: 'mp42' } }, streams: [{ tags: { creation_time: '2025-11-24T10:00:00Z' } }] });
    assert.equal(t.creation_time, '2025-11-24T10:00:00Z');
  });
});

describe('vlog: agrupamento e ordem', () => {
  test('datas em ordem; dentro do dia pelo horário, sem horário no fim, nome natural', () => {
    const g = agruparPorData([
      { data: '2025-11-25', hora: '09:00:00', nome: 'b' },
      { data: '2025-11-24', hora: null, nome: 'VID10' },
      { data: '2025-11-24', hora: null, nome: 'VID2' },
      { data: '2025-11-24', hora: '18:00:00', nome: 'x' },
      { data: '2025-11-24', hora: '07:30:00', nome: 'y' },
      { data: null, nome: 'sem data' },
    ]);
    assert.deepEqual([...g.keys()], ['2025-11-24', '2025-11-25']);
    assert.deepEqual(g.get('2025-11-24').map((c) => c.nome), ['y', 'x', 'VID2', 'VID10']);
  });
  test('stems únicos por dia', () => {
    assert.deepEqual(stemsUnicos([{ nome: 'VID_1.mp4' }, { nome: 'VID_1.MOV' }, { nome: 'a b#c.mp4' }]), ['VID_1', 'VID_1-2', 'a_b_c']);
  });
  test('arquivos de sistema e extensões', () => {
    assert.ok(ehVideo('a.MP4') && ehVideo('b.mov') && ehVideo('c.mts') && ehVideo('d.mkv'));
    assert.ok(!ehVideo('.DS_Store') && !ehVideo('._VID_1.mp4') && !ehVideo('Thumbs.db') && !ehVideo('a.jpg') && !ehVideo('a.mp4.part'));
    assert.ok(arquivoIgnorado('desktop.ini') && arquivoIgnorado('.trashed-123-VID.mp4'));
  });
  test('argumentos da linha de comando', () => {
    const o = lerArgs(['--brutos', 'D:\\Videos', '--data', '2025-11-24', '--modelo', 'medium', '--sem-transcricao']);
    assert.equal(o.brutos, 'D:\\Videos');
    assert.equal(o.data, '2025-11-24');
    assert.equal(o.modelo, 'medium');
    assert.ok(o.semTranscricao);
    assert.throws(() => lerArgs(['--data', '24/11/2025']));
    assert.throws(() => lerArgs(['--xyz']));
  });
});

describe('vlog: parsers das saídas do ffmpeg', () => {
  test('silencedetect (inclui silêncio aberto no fim)', () => {
    const err = `[silencedetect @ 0x55] silence_start: -0.00133333
[silencedetect @ 0x55] silence_end: 2.10133 | silence_duration: 2.10267
size=N/A time=00:00:10.00 bitrate=N/A
[silencedetect @ 0x55] silence_start: 7.5
[silencedetect @ 0x55] silence_end: 8.25 | silence_duration: 0.75
[silencedetect @ 0x55] silence_start: 12.004`;
    assert.deepEqual(parseSilencedetect(err, 15), [{ ini: 0, fim: 2.1 }, { ini: 7.5, fim: 8.25 }, { ini: 12, fim: 15 }]);
  });
  test('cenas (showinfo depois de select=gt(scene))', () => {
    const err = `[Parsed_showinfo_3 @ 0x5] config in time_base: 1/10, frame_rate: 10/1
[Parsed_showinfo_3 @ 0x5] n:   0 pts:    124 pts_time:12.4    duration:1 fmt:yuv420p
[Parsed_showinfo_3 @ 0x5] n:   1 pts:    127 pts_time:12.7    duration:1 fmt:yuv420p
[Parsed_showinfo_3 @ 0x5] n:   2 pts:    330 pts_time:33      duration:1 fmt:yuv420p`;
    assert.deepEqual(parseCenas(err), [0, 12.4, 33]);
  });
  test('ebur128 -> energia por segundo e trechos com voz', () => {
    const linhas = [];
    for (let i = 1; i <= 50; i++) {
      const t = i / 10;
      const M = t > 1.5 && t < 3.5 ? -20 : -60; // fala entre 1,5 e 3,5 s
      linhas.push(`[Parsed_ebur128_2 @ 0x5] t: ${t.toFixed(1)}      TARGET:-23 LUFS    M: ${M.toFixed(1)} S:-30.0     I: -25.0 LUFS       LRA:   0.0 LU`);
    }
    linhas.push('[Parsed_ebur128_2 @ 0x5] t: 5.1 TARGET:-23 LUFS    M: -inf S: -inf     I: -70.0 LUFS');
    const pts = parseEbur128(linhas.join('\n'));
    assert.equal(pts.length, 51);
    assert.equal(pts.at(-1).M, -120);
    const en = energiaPorSegundo(pts, 5.1);
    assert.equal(en.length, 6);
    assert.ok(en[2].rms > -25 && en[0].rms < -50, JSON.stringify(en));
    const voz = trechosComVoz(pts, 5.1);
    assert.equal(voz.length, 1);
    assert.ok(voz[0].ini >= 0.7 && voz[0].ini <= 1.3 && voz[0].fim >= 3.4 && voz[0].fim <= 4, JSON.stringify(voz));
  });
  test('ffprobe: rotação de celular, fps fracionário, sem áudio', () => {
    const r = resumirProbe({
      format: { duration: '84.2' },
      streams: [{ codec_type: 'video', width: 1920, height: 1080, avg_frame_rate: '30000/1001', side_data_list: [{ rotation: -90 }] }],
    });
    assert.deepEqual([r.largura, r.altura, r.rotacao, r.fps, r.temAudio, r.orientacao, r.duracao], [1920, 1080, 90, 29.97, false, 'vertical', 84.2]);
    const r2 = resumirProbe({ format: {}, streams: [{ codec_type: 'video', width: 1280, height: 720, r_frame_rate: '25/1', avg_frame_rate: '0/0', tags: { rotate: '180' }, duration: '3' }, { codec_type: 'audio' }] });
    assert.deepEqual([r2.rotacao, r2.fps, r2.temAudio, r2.orientacao, r2.duracao], [180, 25, true, 'horizontal', 3]);
  });
  test('tremido: imagem parada = 0, imagem sacudindo > imagem parada', () => {
    const L = 96, A = 54, n = 30;
    const quadro = (dx, dy) => {
      const b = Buffer.alloc(L * A);
      for (let y = 0; y < A; y++) for (let x = 0; x < L; x++) b[y * L + x] = (((x + dx) * 7) ^ ((y + dy) * 13)) & 255;
      return b;
    };
    const parado = Buffer.concat(Array.from({ length: n }, () => quadro(0, 0)));
    const liso = Buffer.alloc(L * A * n, 90);
    const tremendo = Buffer.concat(Array.from({ length: n }, (_, i) => quadro(i % 2 ? 2 : -1, i % 3 ? 1 : -2)));
    assert.equal(estimarTremido(parado, L, A), 0);
    assert.equal(estimarTremido(liso, L, A), 0);
    assert.ok(estimarTremido(tremendo, L, A) > 0.5);
  });
});

describe('vlog: whisper.cpp e alucinações', () => {
  test('JSON do whisper-cli (-ojf) com deslocamento e palavras', () => {
    const json = {
      transcription: [{
        timestamps: { from: '00:00:00,500', to: '00:00:02,000' }, offsets: { from: 500, to: 2000 }, text: ' Olha que lugar!',
        tokens: [
          { text: '[_BEG_]', offsets: { from: 500, to: 500 }, p: 0.9 },
          { text: ' Olha', offsets: { from: 500, to: 900 }, p: 0.9 },
          { text: ' que', offsets: { from: 900, to: 1100 }, p: 0.8 },
          { text: ' lug', offsets: { from: 1100, to: 1500 }, p: 0.7 },
          { text: 'ar!', offsets: { from: 1500, to: 2000 }, p: 0.8 },
        ],
      }],
    };
    const [s] = lerJsonWhisper(json, 10);
    assert.equal(s.ini, 10.5);
    assert.equal(s.fim, 12);
    assert.equal(s.texto, 'Olha que lugar!');
    assert.deepEqual(s.palavras.map((w) => w.w), ['Olha', 'que', 'lugar!']);
    assert.equal(s.palavras[2].t1, 12);
    assert.equal(tempoWhisper('00:01:02,345'), 62.345);
  });
  test('remove créditos de legenda, marcações e clichês em áudio fraco; mantém fala real', () => {
    const energia = (a) => (a >= 20 ? -60 : -20); // depois dos 20 s o áudio é só ruído
    const segs = [
      { ini: 0, fim: 3, texto: 'Bom dia, pessoal!', p: 0.9 },
      { ini: 3, fim: 5, texto: 'Legendas pela comunidade Amara.org', p: 0.9 },
      { ini: 5, fim: 6, texto: '[Música]', p: 0.9 },
      { ini: 6, fim: 7, texto: '♪ ♪', p: 0.9 },
      { ini: 10, fim: 12, texto: 'Até a próxima!', p: 0.9 }, // forte: é fala de verdade
      { ini: 21, fim: 23, texto: 'Obrigado por assistir.', p: 0.9 }, // fraco: alucinação clássica
      { ini: 24, fim: 25, texto: 'Inscreva-se no canal', p: 0.3 },
      { ini: 26, fim: 26.5, texto: 'isso aqui é um texto longo demais para meio segundo de áudio', p: 0.9 },
    ];
    const r = filtrarAlucinacoes(segs, { energia, limiar: -40 });
    assert.deepEqual(r.map((s) => s.texto), ['Bom dia, pessoal!', 'Até a próxima!']);
  });
  test('laços de repetição', () => {
    assert.equal(colapsarRepeticoes('vamos vamos vamos vamos vamos embora'), 'vamos embora');
    assert.equal(colapsarRepeticoes('olha só olha só olha só que lindo'), 'olha só que lindo');
    assert.equal(colapsarRepeticoes('é muito muito bonito'), 'é muito muito bonito');
    const segs = Array.from({ length: 5 }, (_, i) => ({ ini: i * 2, fim: i * 2 + 1.5, texto: 'E aí, beleza?' }));
    assert.equal(filtrarAlucinacoes(segs).length, 1);
    const dup = filtrarAlucinacoes([{ ini: 0, fim: 1, texto: 'Que lindo.' }, { ini: 1, fim: 2, texto: 'que lindo' }]);
    assert.deepEqual(dup, [{ ini: 0, fim: 2, texto: 'Que lindo.' }]);
  });
  test('SRT do dia com os clipes em sequência', () => {
    const srt = srtDoDia([{ duracao: 10, falas: [{ ini: 1, fim: 2.5, texto: 'oi' }] }, { duracao: 5, falas: [{ ini: 0.5, fim: 1, texto: 'tchau' }] }]);
    assert.match(srt, /^1\n00:00:01,000 --> 00:00:02,500\n\[clipe 0\] oi\n/);
    assert.match(srt, /2\n00:00:10,500 --> 00:00:11,000\n\[clipe 1\] tchau/);
  });
});

describe('vlog: folha de contato', () => {
  test('rótulos, tempos e etiqueta PPM', () => {
    assert.equal(rotuloTempo(75.4), '1:15');
    assert.equal(rotuloTempo(3725), '1:02:05');
    assert.equal(rotuloTempo(3.5, true), '0:03.5');
    const t = temposDosQuadros(16);
    assert.equal(t.length, 16);
    assert.equal(t[0], 0.5);
    assert.ok(t[15] <= 15.85);
    const ppm = etiquetaPpm('1:15');
    assert.match(ppm.subarray(0, 12).toString(), /^P6\n\d+ \d+\n/);
  });
});

const ffmpeg = acharPrograma('ffmpeg');
describe('vlog: análise real de um clipe sintético', { skip: !ffmpeg && 'ffmpeg não instalado' }, () => {
  test('--sem-transcricao: analise.json, folha e quadros; brutos intocados; cache', async () => {
    const { analisar } = await import('../vlog/analisar.js');
    const base = mkdtempSync(path.join(os.tmpdir(), 'vlog-teste-'));
    try {
      const brutos = path.join(base, 'brutos');
      mkdirSync(path.join(brutos, '2025-11-24'), { recursive: true });
      const clip = path.join(brutos, '2025-11-24', 'VID_20251124_101500.mp4');
      const r = spawnSync(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error',
        '-f', 'lavfi', '-i', 'testsrc2=s=320x180:r=15:d=3', '-f', 'lavfi', '-i', 'color=c=red:s=320x180:r=15:d=3',
        '-f', 'lavfi', '-i', 'sine=frequency=300:duration=6',
        '-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0[v];[2:a]volume=enable=\'lt(t,3)\':volume=0[a]',
        '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', clip]);
      assert.equal(r.status, 0, String(r.stderr));
      writeFileSync(path.join(brutos, '.DS_Store'), 'x');
      const antes = statSync(clip);
      const trabalho = path.join(base, 'trabalho');
      const res = await analisar({ brutos, trabalho, semTranscricao: true, silencioso: true });
      assert.equal(res.datas.length, 1);
      const a = JSON.parse(readFileSync(path.join(trabalho, '2025-11-24', 'analise.json'), 'utf8'));
      assert.equal(a.data, '2025-11-24');
      assert.equal(a.clipes.length, 1);
      const c = a.clipes[0];
      assert.equal(c.inicioDoDia, '10:15:00');
      assert.equal(c.largura, 320);
      assert.equal(c.temAudio, true);
      assert.ok(Math.abs(c.duracao - 6) < 0.2, String(c.duracao));
      assert.ok(c.cenas.some((t) => Math.abs(t - 3) < 0.3), JSON.stringify(c.cenas));
      assert.ok(c.silencios.length >= 1 && c.silencios[0].ini === 0 && Math.abs(c.silencios[0].fim - 3) < 0.4, JSON.stringify(c.silencios));
      assert.ok(c.energia.length >= 6 && c.energia[4].rms > c.energia[1].rms + 20, JSON.stringify(c.energia));
      assert.ok(existsSync(path.join(trabalho, '2025-11-24', c.folha)));
      assert.equal(c.quadros.length, 16);
      assert.ok(c.quadros.every((q) => existsSync(path.join(trabalho, '2025-11-24', q.img))));
      assert.ok(existsSync(path.join(trabalho, '2025-11-24', 'transcricao.srt')));
      assert.deepEqual(a.resumo.clipes, 1);
      // nada mudou nos brutos
      const depois = statSync(clip);
      assert.equal(depois.size, antes.size);
      assert.equal(depois.mtimeMs, antes.mtimeMs);
      assert.equal(varrer(brutos).length, 1);
      // segunda passada usa o cache (rápida)
      const t0 = Date.now();
      await analisar({ brutos, trabalho, semTranscricao: true, silencioso: true });
      assert.ok(Date.now() - t0 < 3000);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});

describe('vlog: instalador do whisper.cpp', () => {
  test('escolhe CUDA 12.4 na release estável mais nova que tenha binário Windows', async () => {
    const { escolherAsset } = await import('../vlog/instalar-ferramentas.js');
    const rel = [
      { tag: 'v1.9.7-rc', pre: true, assets: [{ nome: 'whisper-bin-win-cuda-12.4.0-x64.zip' }] },
      { tag: 'v1.9.6', pre: false, assets: [] }, // versões novas sem binários
      { tag: 'v1.9.2', pre: false, assets: [{ nome: 'whisper-bin-x64.zip' }, { nome: 'whisper-cublas-11.8.0-bin-x64.zip' }, { nome: 'whisper-cublas-12.4.0-bin-x64.zip' }] },
    ];
    const cuda = escolherAsset(rel, ['whisper-cublas-12.4.0-bin-x64.zip', 'whisper-bin-win-cuda-12.4.0-x64.zip']);
    assert.equal(cuda.tag, 'v1.9.2');
    assert.equal(cuda.nome, 'whisper-cublas-12.4.0-bin-x64.zip');
    assert.equal(escolherAsset(rel, ['whisper-bin-x64.zip']).tag, 'v1.9.2');
    assert.equal(escolherAsset(rel, ['nada.zip']), null);
  });
});
