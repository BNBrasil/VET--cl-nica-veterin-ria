import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Atualizador, explicarErroGit } from '../server/atualizacao.js';

const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } }).trim();

function montar() {
  const raiz = mkdtempSync(path.join(os.tmpdir(), 'atu-'));
  const remoto = path.join(raiz, 'github.git');
  const autor = path.join(raiz, 'autor');
  git(raiz, 'init', '-q', '--bare', '-b', 'main', remoto);
  git(raiz, 'clone', '-q', remoto, autor);
  git(autor, 'checkout', '-q', '-b', 'main');
  writeFileSync(path.join(autor, 'package.json'), JSON.stringify({ name: 'x', version: '1.0.0' }));
  writeFileSync(path.join(autor, '.gitignore'), 'data/\n');
  mkdirSync(path.join(autor, 'producao'));
  writeFileSync(path.join(autor, 'producao', 'pronuncia.json'), '{"GTA":"gê tê á"}\n');
  writeFileSync(path.join(autor, 'leia.txt'), 'v1\n');
  git(autor, 'add', '.'); git(autor, 'commit', '-q', '-m', 'versão 1'); git(autor, 'push', '-q', 'origin', 'main');
  const novaVersao = (msg, arquivo = 'leia.txt', conteudo = msg + '\n') => {
    writeFileSync(path.join(autor, arquivo), conteudo);
    git(autor, 'commit', '-qam', msg); git(autor, 'push', '-q', 'origin', 'main');
  };
  return { raiz, remoto, novaVersao };
}

test('explica erros do git em português', () => {
  assert.match(explicarErroGit('fatal: could not read Username for https://github.com: terminal prompts disabled'), /INICIAR\.bat/);
  assert.match(explicarErroGit('Could not resolve host: github.com'), /Sem conexão/);
});

test('instalado pelo git: avisa, atualiza mantendo o que o usuário mudou e pede reinício', async () => {
  const { raiz, remoto, novaVersao } = montar();
  const pc = path.join(raiz, 'pc');
  git(raiz, 'clone', '-q', remoto, pc);
  const a = new Atualizador({ dir: pc, repo: remoto });

  assert.equal((await a.verificar()).disponivel, false);

  novaVersao('nova tela de temas');
  novaVersao('vozes Kokoro');
  // o usuário mudou um arquivo versionado e tem dados próprios
  writeFileSync(path.join(pc, 'producao', 'pronuncia.json'), '{"GTA":"gê tê á","Steam":"istim"}\n');
  mkdirSync(path.join(pc, 'data')); writeFileSync(path.join(pc, 'data', 'segredos.json'), '{"x":1}');

  const e = await a.verificar();
  assert.equal(e.modo, 'git');
  assert.equal(e.disponivel, true);
  assert.deepEqual(e.commits.map((c) => c.msg), ['vozes Kokoro', 'nova tela de temas']);
  assert.deepEqual(e.alteradosLocalmente, ['producao/pronuncia.json']);

  let reiniciou = false;
  a.on('reiniciar', () => { reiniciou = true; });
  const r = await a.aplicar();
  assert.equal(r.ok, true, r.erro);
  assert.equal(reiniciou, true);
  assert.equal(readFileSync(path.join(pc, 'leia.txt'), 'utf8'), 'vozes Kokoro\n');
  assert.match(readFileSync(path.join(pc, 'producao', 'pronuncia.json'), 'utf8'), /istim/, 'mudança do usuário preservada');
  assert.equal(readFileSync(path.join(pc, 'data', 'segredos.json'), 'utf8'), '{"x":1}', 'dados intocados');
  assert.ok(readdirSync(path.join(pc, 'data')).some((d) => d.startsWith('backup-atualizacao-')), 'cópia de segurança feita');
  assert.equal((await a.verificar()).disponivel, false);
});

test('instalado pelo zip: oferece atualização e liga a pasta ao GitHub sem perder dados', async () => {
  const { raiz, remoto, novaVersao } = montar();
  const zip = path.join(raiz, 'zip');
  mkdirSync(path.join(zip, 'producao'), { recursive: true });
  writeFileSync(path.join(zip, 'package.json'), JSON.stringify({ name: 'x', version: '1.0.0' }));
  writeFileSync(path.join(zip, 'leia.txt'), 'v1\n');
  writeFileSync(path.join(zip, 'producao', 'pronuncia.json'), '{"meu":"ajuste"}\n');
  mkdirSync(path.join(zip, 'data')); writeFileSync(path.join(zip, 'data', 'chat.json'), '[]');
  novaVersao('versão 2');

  const a = new Atualizador({ dir: zip, repo: remoto });
  const e = await a.verificar();
  assert.equal(e.modo, 'zip');
  assert.equal(e.disponivel, true);

  const r = await a.aplicar();
  assert.equal(r.ok, true, r.erro);
  assert.equal(readFileSync(path.join(zip, 'leia.txt'), 'utf8'), 'versão 2\n');
  assert.ok(existsSync(path.join(zip, '.git')));
  assert.equal(readFileSync(path.join(zip, 'data', 'chat.json'), 'utf8'), '[]');
  const backup = readdirSync(path.join(zip, 'data')).find((d) => d.startsWith('backup-atualizacao-'));
  assert.ok(backup, 'arquivo alterado guardado antes de sobrescrever');
  assert.match(readFileSync(path.join(zip, 'data', backup, 'producao', 'pronuncia.json'), 'utf8'), /ajuste/);
  assert.equal((await a.verificar()).modo, 'git', 'depois disso vira instalação por git');
});

test('cópia dentro de outro repositório (desenvolvimento) não atualiza sozinha', async () => {
  const { raiz, remoto } = montar();
  const outro = path.join(raiz, 'outro');
  git(raiz, 'clone', '-q', remoto, outro);
  const sub = path.join(outro, 'escritorio-ia');
  mkdirSync(sub);
  const a = new Atualizador({ dir: sub, repo: remoto });
  const e = await a.verificar();
  assert.equal(e.modo, 'outro-git');
  assert.equal(e.disponivel, false);
  assert.equal((await a.aplicar()).ok, false);
});
