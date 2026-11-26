// Atualizações automáticas a partir do GitHub (BNBrasil/escritorio-ia, privado).
//
// Usa o git do computador: as credenciais ficam no gerenciador do próprio Git (o INICIAR.bat faz o
// primeiro login no GitHub pelo navegador). Aqui o git roda SEM perguntar nada (GIT_TERMINAL_PROMPT=0),
// para nunca travar o servidor escondido.
//
// Nunca mexe nos dados do usuário: data/, vlog/brutos, producao/saida etc. estão no .gitignore.
// Arquivos versionados que o usuário mudou (ex.: producao/pronuncia.json) são preservados com
// --autostash; se não der para juntar, ficam numa cópia em data/backup-atualizacao-<data>/.
import { execFile } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const REPO_PADRAO = 'https://github.com/BNBrasil/escritorio-ia.git';
const SEIS_HORAS = 6 * 60 * 60 * 1000;

function sh(cmd, args, { cwd, env, timeout = 120000, shell = false } = {}) {
  return new Promise((resolve) => {
    execFile(cmd, args, {
      cwd, timeout, shell, windowsHide: true, maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never', ...env },
    }, (err, stdout, stderr) => resolve({ ok: !err, code: err?.code ?? 0, out: String(stdout).replace(/\s+$/, ''), err: String(stderr).trim() }));
  });
}

/** Explica um erro do git em português. */
export function explicarErroGit(txt = '') {
  const t = String(txt);
  if (/could not read Username|Authentication failed|terminal prompts disabled|403|Repository not found|could not read Password/i.test(t)) {
    return 'O GitHub pediu login. Feche o escritório e rode o INICIAR.bat uma vez: ele abre o navegador para você entrar na sua conta do GitHub (só na primeira vez).';
  }
  if (/Could not resolve host|unable to access|timed out|Failed to connect/i.test(t)) return 'Sem conexão com o GitHub agora. Tente mais tarde.';
  if (/not a git repository/i.test(t)) return 'Esta pasta ainda não está ligada ao GitHub.';
  if (/ENOENT|not recognized|não é reconhecido/i.test(t)) return 'O Git não está instalado (o INICIAR.bat instala).';
  return t.split('\n').filter(Boolean).slice(-3).join(' ') || 'erro desconhecido do git';
}

export class Atualizador extends EventEmitter {
  /** @param {{ dir: string, repo?: string, ramo?: string, git?: string, run?: Function, agora?: Function }} opts */
  constructor(opts) {
    super();
    this.dir = opts.dir;
    this.repo = opts.repo || process.env.ESCRITORIO_REPO || REPO_PADRAO;
    this.ramo = opts.ramo || 'main';
    this.git = opts.git || 'git';
    this.run = opts.run || sh;
    this.agora = opts.agora || Date.now;
    this.estado = { verificadoEm: 0, disponivel: false, aplicando: false };
    this.timer = null;
  }

  g(args, extra = {}) { return this.run(this.git, args, { cwd: this.dir, ...extra }); }

  versaoLocal() {
    try { return JSON.parse(readFileSync(path.join(this.dir, 'package.json'), 'utf8')).version || '0.0.0'; } catch { return '0.0.0'; }
  }

  /** 'git' (pasta é a raiz de um clone deste repositório), 'outro-git' (dentro de outro repositório) ou 'zip'. */
  async modo() {
    const top = await this.g(['rev-parse', '--show-toplevel']);
    if (!top.ok) return 'zip';
    if (path.resolve(top.out) !== path.resolve(this.dir)) return 'outro-git';
    const url = await this.g(['remote', 'get-url', 'origin']);
    const norm = (u) => String(u).toLowerCase().replace(/\.git$/, '').replace(/^git@github\.com:/, 'https://github.com/');
    return url.ok && norm(url.out) === norm(this.repo) ? 'git' : 'outro-git';
  }

  /** Confere o GitHub. Nunca lança erro. */
  async verificar() {
    const base = { verificadoEm: this.agora(), versao: this.versaoLocal(), aplicando: this.estado.aplicando };
    const modo = await this.modo();
    if (modo === 'outro-git') {
      this.estado = { ...base, modo, disponivel: false, erro: 'Esta cópia está dentro de outro repositório (modo desenvolvimento); atualização automática desligada.' };
      return this.publicar();
    }
    if (modo === 'zip') {
      // Pergunta ao GitHub qual é o último commit, sem precisar de clone.
      const r = await this.g(['ls-remote', this.repo, `refs/heads/${this.ramo}`], { timeout: 30000 });
      if (!r.ok) { this.estado = { ...base, modo, disponivel: false, erro: explicarErroGit(r.err) }; return this.publicar(); }
      const remoto = r.out.split(/\s/)[0];
      this.estado = { ...base, modo, disponivel: !!remoto, remoto: remoto?.slice(0, 7), commits: [],
        aviso: 'Instalado pelo zip: a primeira atualização liga esta pasta ao GitHub (seus dados ficam).' };
      return this.publicar();
    }
    const f = await this.g(['fetch', '--quiet', 'origin', this.ramo], { timeout: 60000 });
    if (!f.ok) { this.estado = { ...base, modo, disponivel: false, erro: explicarErroGit(f.err) }; return this.publicar(); }
    const atual = (await this.g(['rev-parse', 'HEAD'])).out;
    const remoto = (await this.g(['rev-parse', `origin/${this.ramo}`])).out;
    const log = await this.g(['log', '--format=%h%x09%s', `HEAD..origin/${this.ramo}`, '-n', '30']);
    const commits = log.out ? log.out.split('\n').map((l) => { const [h, ...m] = l.split('\t'); return { id: h, msg: m.join('\t') }; }) : [];
    const mod = await this.g(['status', '--porcelain', '--untracked-files=no']);
    this.estado = {
      ...base, modo, atual: atual.slice(0, 7), remoto: remoto.slice(0, 7), disponivel: commits.length > 0, commits,
      alteradosLocalmente: mod.out ? mod.out.split('\n').map((l) => l.slice(3)).filter(Boolean) : [],
    };
    return this.publicar();
  }

  publicar() { this.emit('estado', this.estado); return this.estado; }

  /** Baixa e aplica a versão nova. Emite 'reiniciar' no fim. */
  async aplicar({ log = () => {} } = {}) {
    if (this.estado.aplicando) return { ok: false, erro: 'Já está atualizando.' };
    this.estado = { ...this.estado, aplicando: true };
    this.publicar();
    try {
      const modo = await this.modo();
      if (modo === 'outro-git') throw new Error(this.estado.erro || 'atualização automática desligada nesta cópia');
      const antes = modo === 'git' ? (await this.g(['rev-parse', 'HEAD'])).out : null;
      const temaPersonalizado = existsSync(path.join(this.dir, 'data', 'aparencia.json'));

      if (modo === 'zip') {
        log('Ligando esta pasta ao GitHub…');
        await this.passo(['init', '-q']);
        await this.g(['remote', 'remove', 'origin']);
        await this.passo(['remote', 'add', 'origin', this.repo]);
        await this.passo(['fetch', '--quiet', 'origin', this.ramo], 120000);
        await this.backupDiferentes(`origin/${this.ramo}`, log);
        await this.passo(['reset', '--hard', `origin/${this.ramo}`]);
        await this.passo(['branch', '--set-upstream-to', `origin/${this.ramo}`]).catch(() => {});
      } else {
        if (temaPersonalizado) await this.g(['checkout', '--', 'public/assets']); // a arte é refeita depois
        log('Baixando a versão nova…');
        await this.backupDiferentes(`origin/${this.ramo}`, log, true);
        const p = await this.g(['pull', '--rebase', '--autostash', '--quiet', 'origin', this.ramo], { timeout: 180000 });
        if (!p.ok) {
          await this.g(['rebase', '--abort']);
          throw new Error(explicarErroGit(p.err) + ' (seus arquivos alterados estão em data/backup-atualizacao-*)');
        }
      }

      const mudou = antes ? (await this.g(['diff', '--name-only', antes, 'HEAD'])).out.split('\n') : ['package.json'];
      if (mudou.some((f) => /^package(-lock)?\.json$/.test(f))) {
        log('Instalando dependências novas…');
        const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        const r = await this.run(npm, ['install', '--no-audit', '--no-fund'], { cwd: this.dir, timeout: 300000, shell: process.platform === 'win32' });
        if (!r.ok) throw new Error('npm install falhou: ' + r.err.slice(-300));
      }
      if (temaPersonalizado) {
        log('Refazendo a arte com o seu tema…');
        await this.run(process.execPath, [path.join(this.dir, 'art', 'generate.js')], { cwd: this.dir, timeout: 180000 });
      }
      this.estado = { ...this.estado, aplicando: false, disponivel: false, commits: [], versao: this.versaoLocal() };
      this.publicar();
      log('Atualizado! Reiniciando o escritório…');
      this.emit('reiniciar');
      return { ok: true };
    } catch (e) {
      this.estado = { ...this.estado, aplicando: false, erro: e.message };
      this.publicar();
      return { ok: false, erro: e.message };
    }
  }

  async passo(args, timeout) {
    const r = await this.g(args, timeout ? { timeout } : {});
    if (!r.ok) throw new Error(explicarErroGit(r.err));
    return r;
  }

  /** Copia para data/backup-atualizacao-<data>/ os arquivos versionados que diferem da versão nova. */
  async backupDiferentes(ref, log, soAlteradosLocalmente = false) {
    const r = soAlteradosLocalmente
      ? await this.g(['diff', '--name-only', 'HEAD'])
      : await this.g(['diff', '--name-only', ref]);
    const arquivos = r.out.split('\n').filter((f) => f && !f.startsWith('public/assets/') && existsSync(path.join(this.dir, f)));
    if (!arquivos.length) return null;
    const pasta = path.join(this.dir, 'data', 'backup-atualizacao-' + new Date(this.agora()).toISOString().slice(0, 19).replace(/[:T]/g, '-'));
    for (const f of arquivos) {
      const destino = path.join(pasta, f);
      mkdirSync(path.dirname(destino), { recursive: true });
      copyFileSync(path.join(this.dir, f), destino);
    }
    log(`Cópia de segurança de ${arquivos.length} arquivo(s) alterado(s) em ${path.relative(this.dir, pasta)}`);
    return pasta;
  }

  iniciarVerificacaoPeriodica(intervalo = SEIS_HORAS) {
    this.verificar().catch(() => {});
    this.timer = setInterval(() => this.verificar().catch(() => {}), intervalo);
    this.timer.unref?.();
  }
  parar() { clearInterval(this.timer); }
}
