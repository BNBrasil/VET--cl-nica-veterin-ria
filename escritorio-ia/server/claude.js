// Ponte entre o chat da página e o Claude Code (modo headless: `claude -p --output-format stream-json`).
//
// Cada mensagem do chat roda um processo `claude -p` invisível, com o agente orquestrador, dentro da
// pasta do projeto (assim os hooks de .claude/settings.json continuam animando o escritório).
// A conversa continua entre mensagens com `--resume <session_id>`.
//
// Segurança: o texto do usuário vai SEMPRE pelo stdin, nunca como argumento de linha de comando.
// Os argumentos são constantes, ou valores validados (uuid da sessão, modo de permissão de uma lista).
import { spawn, execFile } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { IaLocal, MODELOS, MODELO_PADRAO, triagem } from './ia-local.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_DIR = path.join(__dirname, '..');
const IS_WIN = process.platform === 'win32';

export const PERMISSION_MODES = {
  acceptEdits: 'Seguro: edita arquivos, mas não roda comandos sem permissão',
  bypassPermissions: 'Autônomo: edita arquivos e roda comandos (ffmpeg, npm...) sem perguntar',
  plan: 'Só planejar: não altera nada, apenas propõe o plano',
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_HISTORY = 500;
const MAX_QUEUE = 5;
const MAX_NAME = 24;

function cleanText(s, max) {
  return String(s ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').slice(0, max);
}

/** Resumo curto do input de uma ferramenta, para mostrar no chat. */
export function toolSummary(name, input = {}) {
  const i = input || {};
  const v = i.description || i.file_path || i.notebook_path || i.command || i.pattern || i.url || i.query || i.path || i.prompt || '';
  const s = String(v).replace(/\s+/g, ' ').trim();
  return s.length > 140 ? s.slice(0, 137) + '...' : s;
}

/**
 * Lê as linhas JSON do stream do Claude Code e as transforma em mensagens de chat.
 * Exportado separado para poder ser testado sem rodar o Claude Code.
 */
export class StreamParser {
  constructor(rooms) {
    this.ids = new Set(rooms.map((r) => r.id));
    this.taskAgent = new Map(); // tool_use_id do Agent/Task -> agent_type
  }
  agentFor(parentToolUseId) {
    if (!parentToolUseId) return 'orquestrador';
    const t = this.taskAgent.get(parentToolUseId);
    if (!t) return 'orquestrador';
    return this.ids.has(t) ? t : 'visitante:' + t;
  }
  /** @returns {{ msgs: object[], sessionId?: string, result?: object }} */
  parse(m) {
    const out = { msgs: [] };
    if (!m || typeof m !== 'object') return out;
    if (m.session_id && m.type === 'system' && m.subtype === 'init') out.sessionId = m.session_id;
    if (m.type === 'system' && m.subtype === 'task_started' && m.tool_use_id && m.subagent_type) {
      this.taskAgent.set(m.tool_use_id, m.subagent_type);
    }
    if (m.type === 'assistant' && Array.isArray(m.message?.content)) {
      const agent = this.agentFor(m.parent_tool_use_id);
      for (const c of m.message.content) {
        if (c.type === 'text' && c.text && c.text.trim()) {
          out.msgs.push({ kind: 'text', agent, text: c.text.trim() });
        } else if (c.type === 'tool_use') {
          if ((c.name === 'Agent' || c.name === 'Task') && c.input) {
            const alvo = c.input.subagent_type || 'general-purpose';
            this.taskAgent.set(c.id, alvo);
            out.msgs.push({
              kind: 'delegate', agent, alvo: this.ids.has(alvo) ? alvo : 'visitante:' + alvo,
              text: c.input.description || toolSummary(c.name, c.input),
            });
          } else {
            out.msgs.push({ kind: 'tool', agent, tool: c.name, text: toolSummary(c.name, c.input) });
          }
        }
      }
    }
    if (m.type === 'result') {
      out.result = m;
      const denied = Array.isArray(m.permission_denials) ? m.permission_denials : [];
      if (denied.length) {
        const tools = [...new Set(denied.map((d) => d.tool_name).filter(Boolean))].join(', ');
        out.msgs.push({
          kind: 'system', agent: 'sistema',
          text: `Algumas ações foram bloqueadas pelo modo de permissão (${tools}). Para deixar os agentes rodarem comandos, troque para o modo "Autônomo" em ⚙ Configurar.`,
        });
      }
      if (m.is_error) {
        out.msgs.push({ kind: 'error', agent: 'sistema', text: String(m.result || m.subtype || 'Erro no Claude Code') });
      }
    }
    return out;
  }
}

function readJson(file, fallback) {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return fallback; }
}

export class ClaudeBridge extends EventEmitter {
  /**
   * @param {object} opts { rooms, dataDir, projectDir, bin }
   */
  constructor(opts) {
    super();
    this.rooms = opts.rooms;
    this.convidados = opts.convidados || []; // agentes sem sala própria (pesquisador, locutor, social media)
    this.projectDir = opts.projectDir || PROJECT_DIR;
    this.dataDir = opts.dataDir || path.join(this.projectDir, 'data');
    this.binOverride = opts.bin || process.env.CLAUDE_BIN || null;
    mkdirSync(this.dataDir, { recursive: true });
    this.cfgFile = path.join(this.dataDir, 'config.json');
    this.secretFile = path.join(this.dataDir, 'segredos.json');
    this.chatFile = path.join(this.dataDir, 'chat.json');
    const cfg = readJson(this.cfgFile, {});
    this.nomes = { ...this.defaultNames(), ...(cfg.nomes || {}) };
    // IA local (Ollama): responde perguntas simples sem gastar o Claude
    this.usarLocal = cfg.usarLocal !== false;
    const modeloLocal = MODELOS[cfg.modeloLocal] ? cfg.modeloLocal : (process.env.ESCRITORIO_MODELO_LOCAL || MODELO_PADRAO);
    this.ia = opts.iaLocal || new IaLocal({ modelo: modeloLocal });
    this.localInfo = { ligado: null, modeloPronto: false, verificadoEm: 0 };
    this.localOcupado = false;
    this.permissionMode = PERMISSION_MODES[cfg.permissionMode] ? cfg.permissionMode : 'acceptEdits';
    this.sessionId = UUID_RE.test(cfg.sessionId || '') ? cfg.sessionId : null;
    this.history = readJson(this.chatFile, []);
    if (!Array.isArray(this.history)) this.history = [];
    this.seq = this.history.reduce((n, m) => Math.max(n, m.id || 0), 0);
    this.proc = null;
    this.queue = [];
    this.login = null; // { proc, url, status }
    this.info = { instalado: null, versao: null, logado: null, metodo: null, verificadoEm: 0 };
    this.bin = null;
    this._saveTimer = null;
  }

  defaultNames() {
    const n = {};
    for (const r of [...this.rooms, ...this.convidados]) n[r.id] = r.nomePadrao || r.cargo;
    return n;
  }

  // ---------- persistência ----------
  saveConfig() {
    // preserva o que outras partes guardam no mesmo arquivo (agenda, produção...)
    writeFileSync(this.cfgFile, JSON.stringify({
      ...readJson(this.cfgFile, {}), nomes: this.nomes, permissionMode: this.permissionMode, sessionId: this.sessionId,
      usarLocal: this.usarLocal, modeloLocal: this.ia.modelo,
    }, null, 2));
  }
  saveChatSoon() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      try { writeFileSync(this.chatFile, JSON.stringify(this.history.slice(-MAX_HISTORY))); } catch {}
    }, 500);
    this._saveTimer.unref?.();
  }
  get apiKey() { return readJson(this.secretFile, {}).apiKey || null; }
  setApiKey(key) {
    const k = cleanText(key, 400).trim();
    // preserva os outros segredos (tokens das redes sociais, chave da fila)
    const s = readJson(this.secretFile, {});
    const rest = s && typeof s === 'object' && !Array.isArray(s) ? s : {};
    if (!k) delete rest.apiKey; else rest.apiKey = k;
    try { writeFileSync(this.secretFile, JSON.stringify(rest), { mode: 0o600 }); } catch (e) { if (k) throw e; }
    return this.refresh();
  }

  // ---------- ambiente / executável ----------
  env() {
    const env = { ...process.env };
    const extra = [path.join(os.homedir(), '.local', 'bin')];
    if (IS_WIN && process.env.APPDATA) extra.push(path.join(process.env.APPDATA, 'npm'));
    env.PATH = [...extra, env.PATH || env.Path || ''].join(path.delimiter);
    if (IS_WIN) env.Path = env.PATH;
    const key = this.apiKey;
    if (key) env.ANTHROPIC_API_KEY = key;
    env.CLAUDE_PROJECT_DIR = this.projectDir;
    return env;
  }

  async resolveBin() {
    if (this.binOverride) return (this.bin = this.binOverride);
    const env = this.env();
    if (IS_WIN) {
      const candidates = [path.join(os.homedir(), '.local', 'bin', 'claude.exe')];
      if (process.env.APPDATA) candidates.push(path.join(process.env.APPDATA, 'npm', 'claude.cmd'));
      for (const c of candidates) if (existsSync(c)) return (this.bin = c);
      const found = await new Promise((res) => execFile('where', ['claude'], { env, windowsHide: true }, (e, out) => res(e ? '' : String(out))));
      const first = found.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
        .sort((a, b) => (/\.exe$/i.test(b) ? 1 : 0) - (/\.exe$/i.test(a) ? 1 : 0))[0];
      return (this.bin = first || null);
    }
    const found = await new Promise((res) => execFile('sh', ['-c', 'command -v claude'], { env }, (e, out) => res(e ? '' : String(out).trim())));
    return (this.bin = found || null);
  }

  /** spawn seguro: em Windows, .cmd exige shell — por isso os argumentos nunca levam texto do usuário. */
  spawnClaude(args, extra = {}) {
    const needsShell = IS_WIN && /\.(cmd|bat)$/i.test(this.bin || '');
    const cmd = needsShell ? `"${this.bin}"` : this.bin;
    return spawn(cmd, args, {
      cwd: this.projectDir, env: this.env(), windowsHide: true, shell: needsShell,
      detached: !IS_WIN, stdio: ['pipe', 'pipe', 'pipe'], ...extra,
    });
  }

  runOnce(args, timeoutMs = 20000) {
    return new Promise((resolve) => {
      let out = '', err = '';
      let p;
      try { p = this.spawnClaude(args, { detached: false }); } catch (e) { return resolve({ code: -1, out, err: e.message }); }
      const t = setTimeout(() => { try { p.kill(); } catch {} }, timeoutMs);
      p.stdout.on('data', (d) => (out += d));
      p.stderr.on('data', (d) => (err += d));
      p.on('error', (e) => { clearTimeout(t); resolve({ code: -1, out, err: e.message }); });
      p.on('close', (code) => { clearTimeout(t); resolve({ code, out, err }); });
      p.stdin.end();
    });
  }

  /** Verifica se o Claude Code está instalado e logado. */
  async refresh() {
    const bin = await this.resolveBin();
    const info = { instalado: false, versao: null, logado: false, metodo: null, verificadoEm: Date.now() };
    if (bin) {
      const v = await this.runOnce(['--version'], 15000);
      if (v.code === 0) {
        info.instalado = true;
        info.versao = (v.out.match(/\d+\.\d+\.\d+/) || [v.out.trim()])[0];
        const s = await this.runOnce(['auth', 'status', '--json'], 15000);
        try {
          const j = JSON.parse(s.out);
          info.logado = !!j.loggedIn;
          info.metodo = j.authMethod || null;
          info.email = j.email || j.account?.email || null;
        } catch {
          info.logado = !!this.apiKey;
          info.metodo = this.apiKey ? 'api_key' : null;
        }
      }
    }
    this.info = info;
    await this.refreshLocal(true).catch(() => {});
    this.emit('status', this.status());
    return this.status();
  }

  status() {
    return {
      ...this.info,
      ocupado: !!this.proc,
      fila: this.queue.length,
      permissionMode: this.permissionMode,
      modos: PERMISSION_MODES,
      temChaveApi: !!this.apiKey,
      conversa: this.sessionId ? 'continuando' : 'nova',
      login: this.login ? { url: this.login.url, status: this.login.status } : null,
      iaLocal: { usar: this.usarLocal, modelo: this.ia.modelo, modelos: MODELOS, ocupado: this.localOcupado, baixando: !!this.baixando, ...this.localInfo },
    };
  }

  // ---------- instalação pela página ----------
  install() {
    if (this.installing) return false;
    this.installing = true;
    this.push({ kind: 'system', agent: 'sistema', text: 'Instalando o Claude Code (npm install -g @anthropic-ai/claude-code)... isso pode levar alguns minutos.' });
    const npm = IS_WIN ? 'npm.cmd' : 'npm';
    const p = spawn(npm, ['install', '-g', '@anthropic-ai/claude-code'], { env: this.env(), windowsHide: true, shell: IS_WIN });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('error', (e) => (err += e.message));
    p.on('close', async (code) => {
      this.installing = false;
      if (code === 0) this.push({ kind: 'system', agent: 'sistema', text: 'Claude Code instalado.' });
      else this.push({ kind: 'error', agent: 'sistema', text: 'Não consegui instalar: ' + err.slice(-400) });
      await this.refresh();
    });
    return true;
  }

  // ---------- login pela página ----------
  startLogin(metodo = 'claudeai') {
    if (!this.bin) return { ok: false, erro: 'Claude Code não está instalado.' };
    this.cancelLogin();
    const args = ['auth', 'login', metodo === 'console' ? '--console' : '--claudeai'];
    const p = this.spawnClaude(args, { detached: false });
    const login = { proc: p, url: null, status: 'abrindo' };
    this.login = login;
    let buf = '';
    const onData = (d) => {
      buf += d;
      const url = buf.match(/https:\/\/\S+/);
      if (url && !login.url) {
        login.url = url[0];
        login.status = 'aguardando';
        this.emit('status', this.status());
      }
    };
    p.stdout.on('data', onData);
    p.stderr.on('data', onData);
    p.on('error', () => {});
    p.on('close', async (code) => {
      if (this.login === login) this.login = null;
      await this.refresh();
      this.push({
        kind: code === 0 && this.info.logado ? 'system' : 'error', agent: 'sistema',
        text: code === 0 && this.info.logado ? 'Login feito. Pode mandar o pedido!' : 'O login não foi concluído. Tente de novo.',
      });
    });
    this.emit('status', this.status());
    return { ok: true };
  }
  sendLoginCode(code) {
    const c = cleanText(code, 2000).trim();
    if (!this.login || !c) return false;
    this.login.status = 'validando';
    this.login.proc.stdin.write(c + '\n');
    this.emit('status', this.status());
    return true;
  }
  cancelLogin() {
    if (this.login) { try { this.login.proc.kill(); } catch {} this.login = null; }
  }

  // ---------- nomes e configuração ----------
  setNames(nomes) {
    for (const [id, v] of Object.entries(nomes || {})) {
      if (![...this.rooms, ...this.convidados].some((r) => r.id === id)) continue;
      const n = cleanText(v, MAX_NAME).replace(/\s+/g, ' ').trim();
      this.nomes[id] = n || this.defaultNames()[id];
    }
    this.saveConfig();
    this.emit('nomes', this.nomes);
    return this.nomes;
  }
  setPermissionMode(mode) {
    if (!PERMISSION_MODES[mode]) return false;
    this.permissionMode = mode;
    this.saveConfig();
    this.emit('status', this.status());
    return true;
  }

  // ---------- chat ----------
  push(msg) {
    const m = { id: ++this.seq, at: Date.now(), ...msg };
    this.history.push(m);
    if (this.history.length > MAX_HISTORY) this.history.splice(0, this.history.length - MAX_HISTORY);
    this.saveChatSoon();
    this.emit('chat', m);
    return m;
  }

  teamHeader() {
    const lista = [...this.rooms, ...this.convidados].map((r) => `${this.nomes[r.id]} = ${r.id} (${r.cargo})`).join('; ');
    return `[Contexto do escritório: os agentes têm nomes. ${lista}. Quando eu citar um nome, delegue ao agente correspondente. Responda em português.]`;
  }

  // ---------- IA local ----------
  async refreshLocal(force = false) {
    if (!force && Date.now() - this.localInfo.verificadoEm < 30000) return this.localInfo;
    const st = await this.ia.status();
    this.localInfo = { ligado: st.ligado, modeloPronto: st.modeloPronto, instalados: st.modelos, verificadoEm: Date.now() };
    this.emit('status', this.status());
    return this.localInfo;
  }
  setIaLocal({ usar, modelo } = {}) {
    if (typeof usar === 'boolean') this.usarLocal = usar;
    if (modelo && MODELOS[modelo]) { this.ia.modelo = modelo; this.localInfo.verificadoEm = 0; }
    this.saveConfig();
    this.refreshLocal(true).catch(() => {});
    this.emit('status', this.status());
    return this.status().iaLocal;
  }
  baixarModelo() {
    if (this.baixando) return false;
    this.baixando = true;
    this.emit('status', this.status());
    let ultimo = -1;
    this.push({ kind: 'system', agent: 'sistema', text: `Baixando a IA local (${this.ia.modelo})... só na primeira vez.` });
    this.ia.baixar((p) => {
      if (!p.total) return;
      const pct = Math.floor((p.completed / p.total) * 4) * 25;
      if (pct > ultimo && pct < 100) { ultimo = pct; this.push({ kind: 'system', agent: 'sistema', text: `IA local: ${pct}% baixado` }); }
    }).then(() => this.push({ kind: 'system', agent: 'sistema', text: 'IA local pronta! Perguntas simples agora saem de graça.' }))
      .catch((e) => this.push({ kind: 'error', agent: 'sistema', text: 'Não consegui baixar a IA local: ' + e.message + ' (o Ollama está instalado e aberto?)' }))
      .finally(() => { this.baixando = false; this.refreshLocal(true).catch(() => {}); });
    return true;
  }
  async responderLocal(texto, motivo) {
    this.localOcupado = true;
    this.emit('status', this.status());
    try {
      const info = await this.refreshLocal();
      if (!info.ligado || !info.modeloPronto) throw new Error(info.ligado ? 'modelo não baixado' : 'Ollama desligado');
      const r = await this.ia.perguntar(texto);
      if (!r.texto) throw new Error('resposta vazia');
      this.push({ kind: 'text', agent: 'local', text: r.texto, meta: `${(r.ms / 1000).toFixed(1)} s`, motivo });
    } catch (e) {
      this.push({ kind: 'system', agent: 'sistema', text: `IA local indisponível (${e.message}); mandando para a equipe.` });
      this.enqueueClaude(texto);
    } finally {
      this.localOcupado = false;
      this.emit('status', this.status());
    }
  }

  send(text) {
    const t = cleanText(text, 20000).trim();
    if (!t) return { ok: false, erro: 'Mensagem vazia.' };
    if (this.proc && this.queue.length >= MAX_QUEUE) return { ok: false, erro: 'Fila cheia. Aguarde os agentes terminarem.' };
    this.push({ kind: 'user', agent: 'voce', text: t });
    const tri = triagem(t, { nomesAgentes: Object.values(this.nomes) });
    if (tri.destino === 'local' && (this.usarLocal || /^\/local\b/i.test(t)) && tri.texto) {
      this.responderLocal(tri.texto, tri.motivo);
      return { ok: true, destino: 'local' };
    }
    return this.enqueueClaude(tri.texto || t);
  }

  enqueueClaude(t) {
    this.queue.push(t);
    if (this.proc) {
      this.push({ kind: 'system', agent: 'sistema', text: 'Os agentes ainda estão trabalhando; sua mensagem entra em seguida.' });
      this.emit('status', this.status());
    } else this.next();
    return { ok: true, destino: 'claude' };
  }

  async next() {
    if (this.proc || !this.queue.length) return;
    const text = this.queue.shift();
    if (!this.bin) await this.resolveBin();
    if (!this.bin) {
      this.push({ kind: 'error', agent: 'sistema', text: 'O Claude Code não está instalado. Clique em ⚙ Configurar → Instalar, ou rode o INICIAR.bat.' });
      this.queue.length = 0;
      return this.emit('status', this.status());
    }
    const args = ['-p', '--output-format', 'stream-json', '--verbose', '--forward-subagent-text',
      '--agent', 'orquestrador', '--permission-mode', this.permissionMode];
    if (this.sessionId && UUID_RE.test(this.sessionId)) args.push('--resume', this.sessionId);
    const modelo = process.env.ESCRITORIO_MODELO;
    if (modelo && /^[a-z0-9.\-\[\]]{2,60}$/i.test(modelo)) args.push('--model', modelo);

    let p;
    try { p = this.spawnClaude(args); } catch (e) {
      this.push({ kind: 'error', agent: 'sistema', text: 'Não consegui abrir o Claude Code: ' + e.message });
      return this.next();
    }
    this.proc = p;
    this.emit('status', this.status());
    const parser = new StreamParser(this.rooms);
    let buf = '', err = '', gotResult = false;
    p.stdout.setEncoding('utf8');
    p.stdout.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line) continue;
        let m;
        try { m = JSON.parse(line); } catch { continue; }
        const r = parser.parse(m);
        if (r.sessionId && r.sessionId !== this.sessionId) { this.sessionId = r.sessionId; this.saveConfig(); }
        if (r.result) gotResult = true;
        for (const msg of r.msgs) this.push(msg);
      }
    });
    p.stderr.on('data', (d) => { err += d; if (err.length > 8000) err = err.slice(-8000); });
    p.on('error', (e) => { err += e.message; });
    p.on('close', (code, signal) => {
      if (this.proc !== p) return;
      this.proc = null;
      if (this._stopping) {
        this._stopping = false;
        this.push({ kind: 'system', agent: 'sistema', text: 'Trabalho interrompido.' });
      } else if (!gotResult && code !== 0) {
        const e = err.trim().split('\n').slice(-6).join('\n') || `código ${code ?? signal}`;
        const needLogin = /log ?in|auth|api key|credential/i.test(e);
        if (needLogin) this.refresh();
        this.push({ kind: 'error', agent: 'sistema', text: (needLogin ? 'Parece que é preciso fazer login (⚙ Configurar → Login). ' : 'O Claude Code parou com erro. ') + e });
        if (this.sessionId && /no conversation|session/i.test(e)) { this.sessionId = null; this.saveConfig(); }
      }
      this.emit('status', this.status());
      this.next();
    });
    p.stdin.on('error', () => {});
    p.stdin.end(this.teamHeader() + '\n\n' + text);
  }

  stop() {
    this.queue.length = 0;
    const p = this.proc;
    if (!p) return false;
    this._stopping = true;
    try {
      if (IS_WIN) spawn('taskkill', ['/pid', String(p.pid), '/T', '/F'], { windowsHide: true });
      else process.kill(-p.pid, 'SIGTERM');
    } catch { try { p.kill(); } catch {} }
    return true;
  }

  newConversation() {
    this.stop();
    this.sessionId = null;
    this.saveConfig();
    this.history = [];
    this.saveChatSoon();
    this.push({ kind: 'system', agent: 'sistema', text: 'Nova conversa iniciada.' });
    this.emit('reset');
    this.emit('status', this.status());
  }

  shutdown() { this.stop(); this.cancelLogin(); }
}
