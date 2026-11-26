// Temas da arte: resolução de configuração (tema + ajustes do usuário), validação de valores,
// encaixe de cor livre na paleta (≤ 64) e geração rápida de um tema alternativo validada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolverConfig, validarAjustes, carregarTema, listarTemas, configDoDisco, PISOS, PAREDES, FORMATOS } from '../art/tema.js';
import { aplicarConfig } from '../art/aplicar.js';
import { COLORS, PALETTE, ACCENT, MAX_COLORS } from '../art/palette.js';
import { variacoes, luminance } from '../art/cor.js';

test('temas prontos existem e são válidos', () => {
  const ids = listarTemas();
  for (const id of ['padrao', 'neon', 'pastel', 'noturno', 'natureza', 'retro']) assert.ok(ids.includes(id), `falta temas/${id}.json`);
  for (const id of ids) {
    const t = carregarTema(id);
    assert.deepEqual(validarAjustes(t), [], `tema ${id} com valores inválidos`);
    assert.ok(t.nome && t.descricao, `tema ${id} sem nome/descrição`);
    for (const k of ['fundo', 'painel', 'destaque', 'texto']) assert.match(t.interface?.[k] || '', /^#[0-9a-f]{6}$/i, `tema ${id}: interface.${k}`);
  }
});

test('resolução: padrões ← tema "*" ← tema sala ← usuário "*" ← usuário sala', () => {
  const tema = { id: 'x', salas: { '*': { piso: 'carpete', iluminacao: 'noite' }, roteirista: { piso: 'grama', destaque: '#112233' } }, mapa: { formato: 'L' } };
  const ap = { salas: { '*': { parede: 'tijolo' }, roteirista: { destaque: '#ffcc00' }, designer: { piso: 'xadrez' } }, mapa: { tamanhoSala: 'grande' }, personagens: { roteirista: { cabelo: 'moicano', corCabelo: '#C0402A' } } };
  const c = resolverConfig({ tema, aparencia: ap });
  assert.equal(c.salas.roteirista.piso, 'grama');
  assert.equal(c.salas.roteirista.destaque, '#ffcc00');
  assert.equal(c.salas.roteirista.parede, 'tijolo');
  assert.equal(c.salas.designer.piso, 'xadrez');
  assert.equal(c.salas.animador.piso, 'carpete');
  assert.equal(c.salas.animador.destaque, '#40b0d0', 'destaque padrão vem de shared/rooms.json');
  assert.equal(c.iluminacao, 'noite');
  assert.deepEqual(c.mapa, { formato: 'L', tamanhoSala: 'grande' });
  assert.equal(c.personagens.roteirista.corCabelo, '#c0402a');
  assert.deepEqual(c.origem.destaqueUsuario, ['roteirista']);
});

test('sem nada configurado: tema padrao, duas-fileiras, média, dia', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-'));
  const c = configDoDisco({ dataDir: dir });
  assert.equal(c.tema.id, 'padrao');
  assert.deepEqual(c.mapa, { formato: 'duas-fileiras', tamanhoSala: 'media' });
  assert.equal(c.iluminacao, 'dia');
  assert.deepEqual(c.avisos, []);
  // aparencia.json na pasta de dados é lido
  fs.writeFileSync(path.join(dir, 'aparencia.json'), JSON.stringify({ tema: 'retro', mapa: { formato: 'andares' } }));
  const c2 = configDoDisco({ dataDir: dir });
  assert.equal(c2.tema.id, 'retro');
  assert.equal(c2.mapa.formato, 'andares');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('validação de valores: enumerações, cores e índice de pele', () => {
  const erros = validarAjustes({
    salas: { roteirista: { piso: 'marmore', parede: 'vidro', destaque: 'amarelo', corPiso: '#12345' } },
    personagens: { revisor: { pele: 9, cabelo: 'franja', acessorio: 'oculos', roupa: '#abcdef' } },
    mapa: { formato: 'circulo', tamanhoSala: 'media' },
  });
  const txt = erros.join('\n');
  assert.match(txt, /salas\.roteirista\.piso/);
  assert.match(txt, /salas\.roteirista\.destaque/);
  assert.match(txt, /salas\.roteirista\.corPiso/);
  assert.match(txt, /personagens\.revisor\.pele/);
  assert.match(txt, /personagens\.revisor\.cabelo/);
  assert.match(txt, /mapa\.formato/);
  assert.doesNotMatch(txt, /parede|acessorio|roupa|tamanhoSala/);
  assert.equal(erros.length, 6);
  // valores inválidos são ignorados (com aviso) na resolução; com estrito, lançam
  const c = resolverConfig({ tema: 'padrao', aparencia: { salas: { roteirista: { piso: 'marmore' } } } });
  assert.equal(c.salas.roteirista.piso, undefined);
  assert.equal(c.avisos.length, 1);
  assert.throws(() => resolverConfig({ tema: 'padrao', aparencia: { mapa: { formato: 'x' } }, estrito: true }), /mapa\.formato/);
  assert.throws(() => carregarTema('../etc'), /inválido/);
  assert.ok(PISOS.length === 6 && PAREDES.length === 5 && FORMATOS.length === 4);
});

test('cor de destaque livre: gera variações e encaixa na paleta sem passar de 64', () => {
  const v = variacoes('#ffcc00');
  assert.equal(v.mid, '#ffcc00');
  assert.ok(luminance(v.dark) < luminance(v.mid) && luminance(v.light) > luminance(v.mid) && luminance(v.pale) > luminance(v.light) - 1);

  // padrão: 63 cores, nada fundido
  const base = aplicarConfig(resolverConfig({ tema: 'padrao' }));
  assert.equal(COLORS.length, 63);
  assert.equal(base.merges.length, 0);

  // natureza (dia) já usa as 64; destaque e roupa livres continuam exatamente como escolhidos
  const cfg = resolverConfig({ tema: 'natureza', aparencia: { salas: { roteirista: { destaque: '#ffcc00' } }, personagens: { programador: { roupa: '#123456', corCabelo: '#ff00aa' } } } });
  const r = aplicarConfig(cfg);
  assert.ok(COLORS.length <= MAX_COLORS, `${COLORS.length} cores`);
  assert.ok(r.merges.length > 0);
  assert.equal(PALETTE[ACCENT.roteirista.mid], '#ffcc00');
  assert.ok(COLORS.includes('#ffcc00'));
  assert.ok(COLORS.includes('#123456') || COLORS.includes(PALETTE['pers.programador.roupa']));
  assert.ok(new Set(Object.values(PALETTE)).size <= MAX_COLORS);

  // à noite a cor escolhida recebe a mesma tinta do resto do escritório, mas a paleta continua ≤ 64
  aplicarConfig(resolverConfig({ tema: 'neon', aparencia: { salas: { roteirista: { destaque: '#ffcc00' } } } }));
  assert.ok(COLORS.length <= MAX_COLORS);
  assert.ok(COLORS.includes(PALETTE[ACCENT.roteirista.mid]));
});

test('gera um tema alternativo (retro, formato L, pequena) numa pasta temporária e valida', async () => {
  const { gerar } = await import('../art/generate.js');
  const { validar } = await import('../art/validate.js');
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'tema-arte-'));
  try {
    const cfg = resolverConfig({ tema: 'retro', aparencia: { personagens: { revisor: { cabelo: 'cacheado', acessorio: 'barba' } } } });
    cfg.mapa = { formato: 'L', tamanhoSala: 'pequena' };
    const r = gerar(cfg, { out, preview: false, icones: false });
    assert.deepEqual(validar(out, { rooms: cfg.rooms }), []);
    const tema = JSON.parse(fs.readFileSync(path.join(out, 'tema.json'), 'utf8'));
    assert.equal(tema.id, 'retro');
    assert.equal(tema.personagens.revisor.cabelo, 'cacheado');
    assert.equal(tema.personagens.revisor.acessorio, 'barba');
    assert.ok(r.manifest.convidados.pesquisador && fs.existsSync(path.join(out, 'char_social-media.png')));
    assert.ok(r.plan.W <= 1450);
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});
