// Acesso pelo celular: pareamento por código/QR e token por aparelho.
//
// Regras de confiança:
//  - "Local" = conexão vinda do próprio computador (endereço de loopback) E com Host de loopback
//    (127.0.0.1 / localhost / ::1). Isso continua funcionando sem login, como sempre.
//  - Qualquer outra coisa (Wi-Fi de casa, Tailscale, `tailscale serve` com HTTPS) precisa de um aparelho
//    pareado: cookie `esc_token` (HttpOnly, SameSite=Strict). Só o hash do token fica salvo em disco.
//  - Gerar código de pareamento, revogar aparelhos, ligar/desligar o acesso remoto, login/chave de API,
//    instalar e desligar o escritório: SÓ do computador local.
import { randomBytes, randomInt, createHash, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const CODE_TTL_MS = 5 * 60 * 1000;
const COOKIE = 'esc_token';
const MAX_ATTEMPTS = 8;            // tentativas de código erradas por janela
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

const sha = (s) => createHash('sha256').update(String(s)).digest('hex');

export function hostnameOf(req) {
  const host = String(req.headers.host || '').toLowerCase();
  if (host.startsWith('[')) return host.slice(1, host.indexOf(']'));
  return host.replace(/:\d+$/, '');
}
export function isLoopbackAddr(addr = '') {
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1' || addr.startsWith('127.');
}
/** Requisição do próprio computador (sem proxy na frente). */
export function isLocal(req) {
  return isLoopbackAddr(req.socket?.remoteAddress) && LOOPBACK_HOSTS.has(hostnameOf(req)) && !req.headers['x-forwarded-for'];
}
/** Origin, quando presente, precisa ser a própria página (protege contra outros sites). */
export function originOk(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = String(req.headers.host || '').toLowerCase();
  return origin === 'http://' + host || origin === 'https://' + host;
}

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function deviceName(ua = '') {
  const u = String(ua);
  const os_ = /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? 'Android'
    : /Windows/.test(u) ? 'Windows' : /Mac OS/.test(u) ? 'Mac' : /Linux/.test(u) ? 'Linux' : 'Aparelho';
  const br = /Edg\//.test(u) ? 'Edge' : /SamsungBrowser/.test(u) ? 'Samsung Internet' : /CriOS|Chrome\//.test(u) ? 'Chrome'
    : /FxiOS|Firefox\//.test(u) ? 'Firefox' : /Safari\//.test(u) ? 'Safari' : 'navegador';
  return `${os_} · ${br}`;
}

/** Endereços pelos quais o celular pode chegar neste computador. */
export function networkAddresses(port) {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.internal || a.family !== 'IPv4') continue;
      const [x, y] = a.address.split('.').map(Number);
      const tailscale = x === 100 && y >= 64 && y <= 127; // 100.64.0.0/10 (CGNAT, usado pelo Tailscale)
      out.push({ interface: name, ip: a.address, tipo: tailscale ? 'tailscale' : 'wifi', url: `http://${a.address}:${port}/` });
    }
  }
  return out.sort((a, b) => (a.tipo === 'tailscale' ? -1 : 0) - (b.tipo === 'tailscale' ? -1 : 0));
}

/** Se o Tailscale estiver instalado, descobre o nome DNS deste computador na rede privada. */
export function tailscaleInfo() {
  return new Promise((resolve) => {
    execFile('tailscale', ['status', '--json'], { timeout: 4000, windowsHide: true }, (err, out) => {
      if (err) return resolve({ instalado: !(err.code === 'ENOENT'), conectado: false });
      try {
        const j = JSON.parse(out);
        const dns = String(j.Self?.DNSName || '').replace(/\.$/, '');
        resolve({ instalado: true, conectado: j.BackendState === 'Running', nome: dns || null, https: dns ? `https://${dns}/` : null });
      } catch { resolve({ instalado: true, conectado: false }); }
    });
  });
}

export class RemoteAccess {
  constructor({ dataDir, now = () => Date.now() }) {
    this.now = now;
    this.dataDir = dataDir;
    mkdirSync(dataDir, { recursive: true });
    this.file = path.join(dataDir, 'aparelhos.json');
    let saved = {};
    try { saved = JSON.parse(readFileSync(this.file, 'utf8')); } catch {}
    this.devices = Array.isArray(saved.aparelhos) ? saved.aparelhos : [];
    this.enabled = !!saved.remoto;
    this.code = null; // { hash, exp }
    this.attempts = [];
  }
  save() {
    writeFileSync(this.file, JSON.stringify({ remoto: this.enabled, aparelhos: this.devices }, null, 2), { mode: 0o600 });
  }
  setEnabled(on) { this.enabled = !!on; if (!on) this.code = null; this.save(); }

  newCode() {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    this.code = { hash: sha(code), exp: this.now() + CODE_TTL_MS };
    this.attempts = [];
    return { codigo: code, expiraEm: this.code.exp };
  }

  /** Troca um código válido por um token de aparelho. Retorna { ok, token?, erro? }. */
  pair(code, userAgent) {
    const t = this.now();
    this.attempts = this.attempts.filter((x) => t - x < ATTEMPT_WINDOW_MS);
    if (this.attempts.length >= MAX_ATTEMPTS) return { ok: false, erro: 'Muitas tentativas. Gere um código novo no computador.' };
    const c = String(code || '').replace(/\D/g, '');
    if (!this.code || t > this.code.exp) { this.attempts.push(t); return { ok: false, erro: 'Código expirado ou inexistente. Gere um novo no computador.' }; }
    const a = Buffer.from(sha(c)), b = Buffer.from(this.code.hash);
    if (c.length !== 6 || !timingSafeEqual(a, b)) { this.attempts.push(t); return { ok: false, erro: 'Código errado.' }; }
    this.code = null; // uso único
    const token = randomBytes(32).toString('base64url');
    const dev = { id: randomBytes(6).toString('hex'), nome: deviceName(userAgent), hash: sha(token), criadoEm: t, vistoEm: t };
    this.devices.push(dev);
    this.save();
    return { ok: true, token, aparelho: this.publicDevice(dev) };
  }

  deviceFor(req) {
    const tok = parseCookies(req)[COOKIE];
    if (!tok || tok.length > 200) return null;
    const h = sha(tok);
    const dev = this.devices.find((d) => d.hash === h);
    if (dev && this.now() - (dev.vistoEm || 0) > 60_000) { dev.vistoEm = this.now(); try { this.save(); } catch {} }
    return dev || null;
  }

  /** Contexto de acesso: { local, device, allowed } */
  check(req) {
    if (isLocal(req)) return { local: true, device: null, allowed: true };
    if (!this.enabled) return { local: false, device: null, allowed: false };
    const device = this.deviceFor(req);
    return { local: false, device, allowed: !!device };
  }

  cookieFor(token, secure) {
    return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${secure ? '; Secure' : ''}`;
  }

  revoke(id) {
    const n = this.devices.length;
    this.devices = this.devices.filter((d) => d.id !== id);
    if (this.devices.length !== n) this.save();
    return this.devices.length !== n;
  }
  publicDevice(d) { return { id: d.id, nome: d.nome, criadoEm: d.criadoEm, vistoEm: d.vistoEm }; }
  list() { return this.devices.map((d) => this.publicDevice(d)); }
}
