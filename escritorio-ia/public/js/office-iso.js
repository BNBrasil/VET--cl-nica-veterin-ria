// Escritório isométrico (manifest v2): um prédio só, personagens andando pelos corredores.
// Mesma interface pública que Office (office.js): setAgents, upsert, agentForRoom, roomAt, list, agents,
// width, height, render(ctx, now, dt). Extras opcionais usados por main.js: setHover(pt|null), onChat(msg),
// textPx (tamanho do pixel da fonte, para o texto não ficar minúsculo em escala 1x).

import { AnimPlayer } from './anim.js';
import { drawTextCase, textWidthCase } from './pixelfont.js';
import { mapState } from './office.js';
import { nomeDe } from './chat.js';

const SPEED = 40;           // px nativos por segundo
const BUBBLE_MS = 4000;     // duração do balão de fala
const BUBBLE_LINE = 22;     // caracteres por linha do balão (2 linhas ≈ 40 caracteres)
const INK = '#120e18';

function shade(hex, f) {
  const n = parseInt(String(hex || '#888888').slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f)))));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

function pointInPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Linha de 1 px nítida (Bresenham), para contornos sem antialias. */
function pixelLine(ctx, x0, y0, x1, y1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let guard = 0; guard < 4000; guard++) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/** Limpa markdown simples e corta em até 2 linhas de BUBBLE_LINE caracteres. */
export function bubbleLines(text) {
  const clean = String(text || '')
    .replace(/```[\s\S]*?(```|$)/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_#>~|]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return [];
  const words = clean.split(' ');
  const lines = [''];
  let cut = false;
  for (let w of words) {
    while (w.length > BUBBLE_LINE) { // palavra enorme: quebra no meio
      const room = BUBBLE_LINE - (lines[lines.length - 1] ? lines[lines.length - 1].length + 1 : 0);
      if (room < 4) { if (lines.length === 2) { cut = true; break; } lines.push(''); continue; }
      lines[lines.length - 1] += (lines[lines.length - 1] ? ' ' : '') + w.slice(0, room);
      w = w.slice(room);
      if (lines.length === 2) { cut = true; w = ''; break; }
      lines.push('');
    }
    if (cut) break;
    if (!w) continue;
    const cur = lines[lines.length - 1];
    if (!cur) { lines[lines.length - 1] = w; continue; }
    if (cur.length + 1 + w.length <= BUBBLE_LINE) { lines[lines.length - 1] = cur + ' ' + w; continue; }
    if (lines.length === 2) { cut = true; break; }
    lines.push(w);
  }
  const out = lines.filter(Boolean);
  if (cut && out.length) {
    let last = out[out.length - 1];
    if (last.length > BUBBLE_LINE - 1) last = last.slice(0, BUBBLE_LINE - 1);
    out[out.length - 1] = last.replace(/[\s.,;:!?-]+$/, '') + '…';
  }
  return out;
}

/** Medidas de uma linha da fonte de caixa mista: largura e linhas ocupadas (topo/base relativos). */
function measure(str) {
  let top = 0, bottom = 4;
  for (const ch of str) {
    if (/[ÁÀÂÃÉÊÍÓÔÕÚ]/.test(ch)) top = Math.min(top, -2);
    else if (/[áàâãéêíóôõúü]/.test(ch)) top = Math.min(top, -1);
    if (/[gjpqyçÇ]/.test(ch)) bottom = 6;
  }
  return { w: textWidthCase(str), top, bottom };
}

export class OfficeIso {
  constructor(roomsCfg, assets) {
    this.cfg = roomsCfg;
    this.assets = assets;
    this.m = assets.manifest;
    this.iso = true;
    this.placeholder = false;
    this.animMeta = this.m.animations || {};
    this.width = this.m.map?.w || assets.bg.naturalWidth || assets.bg.width;
    this.height = this.m.map?.h || assets.bg.naturalHeight || assets.bg.height;
    this.anchor = this.m.char?.anchor || { x: 16, y: 46 };
    this.charH = this.m.char?.h || 48;
    this.head = this.m.fx?.anchors?.head || { x: 0, y: -50 };
    this.textPx = 1;

    // salas: rooms.json + dados do manifest
    this.rooms = [];
    const add = (r, work) => {
      const mr = this.m.rooms?.[r.id] || {};
      const ar = assets.rooms?.[r.id] || {};
      // aceita [[x,y],…] ou [{x,y},…]
      const poly = Array.isArray(mr.poly) ? mr.poly.map((p) => (Array.isArray(p) ? p : [p.x, p.y])) : [];
      const room = { ...r, work, poly: poly.length >= 3 ? poly : null,
        label: mr.label || null, seat: mr.seat || null, door: mr.door || null, object: ar.object || null };
      if (!room.seat && room.poly) {
        const cx = room.poly.reduce((s, p) => s + p[0], 0) / room.poly.length;
        const cy = room.poly.reduce((s, p) => s + p[1], 0) / room.poly.length;
        room.seat = { x: cx, y: cy, flip: false };
      }
      if (!room.label && room.poly) {
        const top = room.poly.reduce((a, p) => (p[1] < a[1] ? p : a));
        room.label = { x: top[0], y: top[1] + 10 };
      }
      if (room.object) {
        room.obj = new AnimPlayer(room.object.sheet, this.animMeta);
        room.obj.play('obj_off');
      }
      this.rooms.push(room);
    };
    for (const r of roomsCfg.rooms) add(r, true);
    for (const r of roomsCfg.common || []) add(r, false);
    this.byId = Object.fromEntries(this.rooms.map((r) => [r.id, r]));

    // lounge: vagas do sofá e lugares dos visitantes
    const lr = this.byId.lounge;
    const fallback = lr?.seat ? [lr.seat] : [{ x: this.width / 2, y: this.height / 2 }];
    this.sofaSlots = (this.m.lounge?.sofa || []).length ? this.m.lounge.sofa : fallback;
    this.visSlots = (this.m.lounge?.visitors || []).length ? this.m.lounge.visitors : this.sofaSlots;
    this.slotOwners = { sofa: [], vis: [] };

    // grafo de caminhada
    this.nodes = this.m.paths?.nodes || {};
    this.adj = {};
    for (const id of Object.keys(this.nodes)) this.adj[id] = [];
    for (const [a, b] of this.m.paths?.edges || []) {
      if (!this.nodes[a] || !this.nodes[b]) continue;
      const d = Math.hypot(this.nodes[a].x - this.nodes[b].x, this.nodes[a].y - this.nodes[b].y);
      this.adj[a].push([b, d]); this.adj[b].push([a, d]);
    }
    this._distCache = new Map();

    this.agents = new Map();   // id → view
    this.bubbles = new Map();  // agentId → { lines, start, until }
    this.particles = [];
    this.hover = null;         // ponto no mundo
  }

  // ---------- dados ----------

  setAgents(list) {
    const seen = new Set();
    for (const a of list) { this.upsert(a, true); seen.add(a.id); }
    for (const id of [...this.agents.keys()]) if (!seen.has(id)) this.agents.delete(id);
  }

  upsert(agent, instant = false) {
    let v = this.agents.get(agent.id);
    if (!v) {
      const any = Object.values(this.assets.chars)[0] || null;
      const sheet = agent.visitor ? (this.assets.visitor || any) : (this.assets.chars[agent.room] || this.assets.visitor || any);
      v = {
        id: agent.id, agent, sheet,
        char: new AnimPlayer(sheet, this.animMeta),
        fx: new AnimPlayer(this.assets.fx || null, this.animMeta),
        pos: null, path: [], place: null, at: null, prevNode: null,
        walkTag: 'base_walk_se', flip: false, stateKey: null, nextZ: 0,
      };
      this.agents.set(agent.id, v);
      instant = true;
    }
    const prevKey = v.stateKey;
    v.agent = agent;
    v.stateKey = `${agent.state}/${agent.activity || ''}`;
    if (prevKey !== null && prevKey !== v.stateKey) v.restart = true;
    if (instant) v.instant = true;
  }

  get list() { return [...this.agents.values()].map((v) => v.agent); }

  agentForRoom(roomId) {
    const v = this.agents.get(roomId);
    return v && !v.agent.visitor ? v.agent : null;
  }

  roomAt(wx, wy) {
    for (const r of this.rooms) if (r.poly && pointInPoly(wx, wy, r.poly)) return r;
    return null;
  }

  setHover(pt) { this.hover = pt ? { x: pt.x, y: pt.y } : null; }

  /** Mensagem do WebSocket/chat: {type:'chat', mensagem:{kind:'text', agent, text}} → balão de fala. */
  onChat(msg) {
    const m = msg?.mensagem;
    if (msg?.type !== 'chat' || !m || m.kind !== 'text' || !m.agent) return;
    if (m.agent === 'voce' || m.agent === 'sistema') return;
    const lines = bubbleLines(m.text);
    if (!lines.length) return;
    const now = performance.now();
    this.bubbles.set(m.agent, { lines, start: now, until: now + BUBBLE_MS });
  }

  // ---------- lugares e caminhos ----------

  _assignSlots() {
    const want = { sofa: [], vis: [] };
    for (const v of this.agents.values()) {
      const a = v.agent;
      if (a.state === 'absent') continue;
      if (a.visitor) want.vis.push(v.id);
      else if (a.location === 'lounge') want.sofa.push(v.id);
    }
    for (const k of ['sofa', 'vis']) {
      const owners = this.slotOwners[k];
      const set = new Set(want[k]);
      for (let i = 0; i < owners.length; i++) if (owners[i] && !set.has(owners[i])) owners[i] = null;
      const have = new Set(owners.filter(Boolean));
      for (const id of want[k].sort()) {
        if (have.has(id)) continue;
        let i = owners.indexOf(null);
        if (i < 0) i = owners.length;
        owners[i] = id;
      }
      while (owners.length && owners[owners.length - 1] === null) owners.pop();
    }
  }

  _slotPoint(kind, i) {
    const slots = kind === 'sofa' ? this.sofaSlots : this.visSlots;
    const s = slots[i % slots.length];
    const ring = Math.floor(i / slots.length); // vagas extras: um passo isométrico para a frente
    return { x: s.x - ring * 12, y: s.y + ring * 6, flip: !!s.flip };
  }

  _target(v) {
    const a = v.agent;
    if (a.state === 'absent') return null;
    const lounge = this.byId.lounge;
    if (a.visitor || a.location === 'lounge') {
      const kind = a.visitor ? 'vis' : 'sofa';
      const i = this.slotOwners[kind].indexOf(v.id);
      const p = this._slotPoint(kind, Math.max(0, i));
      return { key: `${kind}:${i}`, kind, x: p.x, y: p.y, flip: p.flip, door: lounge?.door || null };
    }
    const r = this.byId[a.room] || this.byId[this.cfg.defaultRoom];
    if (!r || !r.seat) return null;
    return { key: 'seat:' + r.id, kind: 'seat', x: r.seat.x, y: r.seat.y, flip: !!r.seat.flip, door: r.door };
  }

  /** Dijkstra: lista de nós de a até b (inclusive) ou null. */
  _shortest(a, b) {
    if (!this.nodes[a] || !this.nodes[b]) return null;
    if (a === b) return [a];
    const key = a + '>' + b;
    if (this._distCache.has(key)) return this._distCache.get(key);
    const dist = { [a]: 0 }, prev = {}, done = new Set();
    for (;;) {
      let u = null, best = Infinity;
      for (const [n, d] of Object.entries(dist)) if (!done.has(n) && d < best) { best = d; u = n; }
      if (u === null) break;
      if (u === b) break;
      done.add(u);
      for (const [w, d] of this.adj[u]) {
        const nd = best + d;
        if (nd < (dist[w] ?? Infinity)) { dist[w] = nd; prev[w] = u; }
      }
    }
    let res = null;
    if (dist[b] !== undefined) {
      res = [b];
      while (res[0] !== a) res.unshift(prev[res[0]]);
    }
    this._distCache.set(key, res);
    return res;
  }

  _pathLen(nodes) {
    let s = 0;
    for (let i = 1; i < nodes.length; i++) s += Math.hypot(this.nodes[nodes[i]].x - this.nodes[nodes[i - 1]].x, this.nodes[nodes[i]].y - this.nodes[nodes[i - 1]].y);
    return s;
  }

  _route(v, t) {
    const end = { x: t.x, y: t.y };
    const graphTo = (start) => {
      const ns = t.door && start ? this._shortest(start, t.door) : null;
      return ns;
    };
    let starts = [];
    if (v.path.length) {
      const next = v.path.find((p) => p.node);
      if (next) starts.push(next.node);
      if (v.prevNode) starts.push(v.prevNode);
    } else if (v.at?.door) {
      if (v.at.door === t.door) return [end]; // mesma sala (ex.: trocar de vaga no sofá)
      starts.push(v.at.door);
    }
    let best = null;
    for (const s of starts) {
      const ns = graphTo(s);
      if (!ns) continue;
      const n0 = this.nodes[s];
      const cost = Math.hypot(n0.x - v.pos.x, n0.y - v.pos.y) + this._pathLen(ns);
      if (!best || cost < best.cost) best = { cost, ns };
    }
    if (!best) return [end]; // sem grafo: vai em linha reta
    const pts = best.ns.map((id) => ({ x: this.nodes[id].x, y: this.nodes[id].y, node: id }));
    pts.push(end);
    // remove ponto inicial se já estamos em cima dele
    while (pts.length > 1 && Math.hypot(pts[0].x - v.pos.x, pts[0].y - v.pos.y) < 0.5) { if (pts[0].node) v.prevNode = pts[0].node; pts.shift(); }
    return pts;
  }

  _face(v, dx, dy) {
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return;
    if (Math.abs(dy) >= 0.01) v.walkTag = dy > 0 ? 'base_walk_se' : 'base_walk_ne';
    if (Math.abs(dx) >= 0.01) v.flip = dx < 0;
  }

  _advance(v, dt) {
    let budget = SPEED * dt;
    while (budget > 0 && v.path.length) {
      const p = v.path[0];
      const dx = p.x - v.pos.x, dy = p.y - v.pos.y;
      const d = Math.hypot(dx, dy);
      this._face(v, dx, dy);
      if (d <= budget) {
        v.pos = { x: p.x, y: p.y };
        if (p.node) v.prevNode = p.node;
        v.path.shift();
        budget -= d;
      } else {
        v.pos = { x: v.pos.x + (dx / d) * budget, y: v.pos.y + (dy / d) * budget };
        budget = 0;
      }
    }
    if (!v.path.length && v.at) v.flip = v.at.flip;
  }

  _update(dt) {
    this._assignSlots();
    for (const v of this.agents.values()) {
      const t = this._target(v);
      if (!t) { v.pos = null; v.path = []; v.place = null; v.at = null; continue; }
      if (!v.pos || v.instant) {
        v.pos = { x: t.x, y: t.y }; v.path = []; v.place = t.key; v.at = t; v.flip = t.flip; v.instant = false;
        v.prevNode = null;
      } else if (v.place !== t.key) {
        v.path = this._route(v, t);
        v.place = t.key; v.at = t;
        if (v.path.length) v.prevNode = v.prevNode || null;
      }
      if (v.path.length) this._advance(v, dt);
    }
  }

  // ---------- desenho ----------

  render(ctx, now, dt) {
    this._update(dt);
    ctx.fillStyle = '#16141f';
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.drawImage(this.assets.bg, 0, 0);

    const hoverRoom = this.hover ? this.roomAt(this.hover.x, this.hover.y) : null;
    if (hoverRoom) this._drawHighlight(ctx, hoverRoom, now);

    const vis = [...this.agents.values()].filter((v) => v.pos && v.agent.state !== 'absent');
    for (const v of vis) this._drawShadow(ctx, v);

    // camada ordenada por profundidade: objetos, personagens e seus FX
    const items = [];
    for (const r of this.rooms) {
      if (!r.obj) continue;
      items.push({ y: r.object.y + (r.object.h || r.object.sheet.frames[0]?.h || 0), draw: () => this._drawObject(ctx, r, now) });
    }
    for (const v of vis) {
      const st = this._charState(v);
      v.st = st;
      items.push({ y: v.pos.y, draw: () => this._drawChar(ctx, v, st, now) });
      if (st.fx) items.push({ y: v.pos.y + 0.5, draw: () => this._drawFx(ctx, v, st, now) });
    }
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();

    if (this.assets.fg) ctx.drawImage(this.assets.fg, 0, 0);

    this._spawnParticles(vis, now);
    this._drawParticles(ctx, now);

    for (const r of this.rooms) this._drawLabel(ctx, r, r === hoverRoom);
    this._drawOverlays(ctx, vis, hoverRoom, now);
  }

  _charState(v) {
    const a = v.agent;
    const walking = v.path.length > 0;
    const onSofa = !walking && v.at?.kind === 'sofa';
    const workTag = a.visitor ? 'visitante_work' : `${a.room}_work`;
    const m = mapState(a, workTag);
    let tag;
    if (walking) tag = v.walkTag;
    else if (onSofa) tag = a.state === 'sleeping' || a.state === 'dozing' ? 'base_sleep' : (m.char || 'base_idle');
    else if (a.visitor && (a.state === 'idle' || a.state === 'dozing')) tag = 'base_stand';
    else tag = m.char;
    let fx = walking ? null : m.fx;
    if (onSofa && (a.state === 'sleeping' || a.state === 'dozing')) fx = 'fx_zzz';
    return { tag, fx, alt: m.alt, blink: m.blink, walking, flip: v.flip };
  }

  _drawShadow(ctx, v) {
    const x = Math.round(v.pos.x), y = Math.round(v.pos.y);
    const sofa = !v.path.length && v.at?.kind === 'sofa';
    const rows = sofa ? [6, 10, 6] : [4, 8, 9, 8, 4];
    ctx.fillStyle = 'rgba(10, 6, 20, 0.32)';
    const y0 = y - Math.floor(rows.length / 2);
    rows.forEach((hw, i) => ctx.fillRect(x - hw, y0 + i, hw * 2, 1));
  }

  _drawObject(ctx, r, now) {
    let tag = 'obj_work';
    if (r.work) {
      const a = this.agentForRoom(r.id);
      if (!a) tag = 'obj_off';
      else if (a.location === 'lounge' && a.state !== 'absent') tag = 'obj_sleep';
      else tag = mapState(a).obj;
    }
    if (!r.obj.has(tag)) tag = r.obj.has('obj_off') ? 'obj_off' : Object.keys(r.object.sheet.tags)[0];
    if (!tag) return;
    r.obj.play(tag, now);
    r.obj.draw(ctx, r.object.x, r.object.y, 'top', now);
  }

  _blit(ctx, sheet, f, x, y, ax, ay, flip) {
    if (!flip) {
      ctx.drawImage(sheet.img, f.x, f.y, f.w, f.h, x - ax, y - ay, f.w, f.h);
    } else {
      ctx.save();
      ctx.translate(x, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(sheet.img, f.x, f.y, f.w, f.h, -(f.w - ax), y - ay, f.w, f.h);
      ctx.restore();
    }
  }

  _drawChar(ctx, v, st, now) {
    let tag = st.tag;
    if (!tag) return;
    if (!v.char.has(tag)) {
      if (tag.startsWith('base_walk') && v.char.has('base_stand')) tag = 'base_stand';
      else tag = v.char.has('base_idle') ? 'base_idle' : Object.keys(v.sheet?.tags || {})[0];
    }
    if (!tag || !v.sheet) return;
    v.char.play(tag, now, v.restart && !st.walking);
    v.restart = false;
    const f = v.char.frame(now);
    if (!f) return;
    const x = Math.round(v.pos.x), y = Math.round(v.pos.y);
    this._blit(ctx, v.sheet, f, x, y, this.anchor.x, this.anchor.y, st.flip);
    v.bbox = { x: x - 12, y: y - this.anchor.y + 2, w: 24, h: this.anchor.y };
  }

  _headPoint(v) {
    const sx = v.flip ? -1 : 1;
    return { x: Math.round(v.pos.x + this.head.x * sx), y: Math.round(v.pos.y + this.head.y) };
  }

  /** Centro do FX `tag` (manifest.fx.anchors[tag], relativo ao pé, x espelhado no flip); senão, acima da cabeça. */
  _fxCenter(v, tag, f) {
    const a = this.m.fx?.anchors?.[tag];
    if (a) return { x: Math.round(v.pos.x + a.x * (v.flip ? -1 : 1)), y: Math.round(v.pos.y + a.y) };
    const h = this._headPoint(v);
    return { x: h.x, y: h.y - Math.floor((f?.h || 16) / 2) };
  }

  _drawFx(ctx, v, st, now) {
    const sheet = this.assets.fx;
    if (!sheet) return;
    let tag = st.fx;
    if (tag === 'fx_zzz') return; // dormindo: zZz vira partículas (abaixo)
    if (!sheet.tags[tag] && st.alt && sheet.tags[st.alt]) tag = st.alt;
    if (!sheet.tags[tag]) return;
    v.fx.play(tag, now);
    const t = sheet.tags[tag];
    if (st.blink && t.to === t.from && Math.floor(now / 400) % 2 === 1) return;
    const f = v.fx.frame(now);
    if (!f) return;
    const c = this._fxCenter(v, tag, f);
    ctx.drawImage(sheet.img, f.x, f.y, f.w, f.h, c.x - Math.floor(f.w / 2), c.y - Math.floor(f.h / 2), f.w, f.h);
  }

  // ---------- partículas (zZz de quem dorme, brilho de quem comemora) ----------

  _spawnParticles(vis, now) {
    const fx = this.assets.fx;
    for (const v of vis) {
      const st = v.agent.state;
      const sleeping = !v.path.length && (st === 'sleeping' || (st === 'dozing' && v.at?.kind === 'sofa'));
      if (sleeping && now >= v.nextZ) {
        const h = this._fxCenter(v, 'fx_zzz', null);
        this.particles.push({ kind: 'z', x: h.x, y: h.y + 8, t0: now, life: 2600, dir: v.flip ? -1 : 1 });
        v.nextZ = now + 1100 + Math.random() * 400;
      }
      if (st === 'done' && !v.path.length && now >= (v.nextSpark || 0)) {
        for (let i = 0; i < 2; i++) {
          this.particles.push({ kind: 's', x: v.pos.x + (Math.random() * 28 - 14), y: v.pos.y - 8 - Math.random() * 36, t0: now + i * 120, life: 700 });
        }
        v.nextSpark = now + 260;
      }
    }
    this.particles = this.particles.filter((p) => now - p.t0 < p.life);
    if (this.particles.length > 200) this.particles.splice(0, this.particles.length - 200);
    this._fxZ = fx?.tags.fx_zzz ? fx : null;
    this._fxS = fx?.tags.fx_sparkle ? fx : null;
  }

  _drawParticles(ctx, now) {
    for (const p of this.particles) {
      const k = (now - p.t0) / p.life;
      if (k < 0) continue;
      if (p.kind === 'z') {
        const x = Math.round(p.x + p.dir * (k * 10 + Math.sin(k * 7) * 2));
        const y = Math.round(p.y - k * 22);
        ctx.globalAlpha = k > 0.75 ? 0.4 : k > 0.55 ? 0.7 : 1;
        const fx = this._fxZ;
        if (fx) {
          const t = fx.tags.fx_zzz;
          const n = t.to - t.from + 1;
          const f = fx.frames[t.from + Math.min(n - 1, Math.floor(k * n))];
          ctx.drawImage(fx.img, f.x, f.y, f.w, f.h, x - Math.floor(f.w / 2), y - f.h, f.w, f.h);
        } else {
          const big = k > 0.4;
          drawTextCase(ctx, big ? 'Z' : 'z', x, y - 6, '#e8e8f8');
        }
        ctx.globalAlpha = 1;
      } else {
        const fx = this._fxS;
        const x = Math.round(p.x), y = Math.round(p.y);
        if (fx) {
          const t = fx.tags.fx_sparkle;
          const n = t.to - t.from + 1;
          const f = fx.frames[t.from + Math.min(n - 1, Math.floor(k * n))];
          ctx.drawImage(fx.img, f.x, f.y, f.w, f.h, x - Math.floor(f.w / 2), y - Math.floor(f.h / 2), f.w, f.h);
        } else {
          const s = k < 0.5 ? 2 : 1;
          ctx.fillStyle = '#fff8c0';
          ctx.fillRect(x - s, y, s * 2 + 1, 1); ctx.fillRect(x, y - s, 1, s * 2 + 1);
        }
      }
    }
  }

  // ---------- sala: destaque e plaquinha ----------

  _drawHighlight(ctx, r, now) {
    if (!r.poly) return;
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = r.accent;
    ctx.beginPath();
    r.poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = Math.floor(now / 500) % 2 ? r.accent : shade(r.accent, 0.35);
    for (let i = 0; i < r.poly.length; i++) {
      const a = r.poly[i], b = r.poly[(i + 1) % r.poly.length];
      pixelLine(ctx, a[0], a[1], b[0], b[1]);
    }
  }

  _drawLabel(ctx, r, hot) {
    if (!r.label) return;
    const px = this.textPx;
    const name = r.nome;
    const ms = measure(name);
    let extra = '';
    if (r.work) extra = '✓' + (this.agentForRoom(r.id)?.tasksDone || 0);
    const ew = extra ? textWidthCase(extra) : 0;
    const padX = 3, padT = 2 - ms.top, padB = 2;
    const w = (ms.w + padX * 2 + (extra ? ew + 6 : 0)) * px;
    const h = (padT + ms.bottom + 1 + padB) * px;
    const x = Math.round(r.label.x - w / 2), y = Math.round(r.label.y - h / 2);
    ctx.fillStyle = INK; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = hot ? shade(r.accent, 0.25) : r.accent; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = shade(r.accent, 0.45); ctx.fillRect(x, y, w, px);
    ctx.fillStyle = shade(r.accent, -0.35); ctx.fillRect(x, y + h - px, w, px);
    drawTextCase(ctx, name, x + padX * px, y + padT * px, shade(r.accent, -0.82), px);
    if (extra) {
      const bx = x + (ms.w + padX * 2 + 1) * px;
      ctx.fillStyle = shade(r.accent, -0.7); ctx.fillRect(bx, y + px, (ew + 4) * px, h - 2 * px);
      const n = this.agentForRoom(r.id)?.tasksDone || 0;
      drawTextCase(ctx, extra, bx + 2 * px, y + padT * px, n > 0 ? shade(r.accent, 0.5) : '#9890b0', px);
    }
  }

  // ---------- placas de nome e balões (sem sobreposição) ----------

  _drawOverlays(ctx, vis, hoverRoom, now) {
    const px = this.textPx;
    let hoverChar = null;
    if (this.hover) {
      for (const v of [...vis].sort((a, b) => b.pos.y - a.pos.y)) {
        const b = v.bbox;
        if (b && this.hover.x >= b.x && this.hover.x < b.x + b.w && this.hover.y >= b.y && this.hover.y < b.y + b.h) { hoverChar = v; break; }
      }
    }
    const inHoverRoom = (v) => {
      if (!hoverRoom || v.path.length) return false;
      if (hoverRoom.id === 'lounge') return v.at?.kind === 'sofa' || v.at?.kind === 'vis';
      return v.at?.kind === 'seat' && v.agent.room === hoverRoom.id;
    };
    // de frente para trás: quem está mais embaixo na tela mantém o lugar; os de trás sobem
    const order = [...vis].sort((a, b) => b.pos.y - a.pos.y);
    const placed = [];
    const draws = [];
    const place = (box) => {
      box.x = Math.max(1, Math.min(this.width - box.w - 1, box.x));
      for (let guard = 0; guard < 40; guard++) {
        const hit = placed.find((p) => box.x < p.x + p.w + 1 && box.x + box.w + 1 > p.x && box.y < p.y + p.h + 1 && box.y + box.h + 1 > p.y);
        if (!hit) break;
        box.y = hit.y - box.h - 2;
      }
      placed.push(box);
      return box;
    };
    for (const v of order) {
      const a = v.agent;
      const head = this._headPoint(v);
      let bottom = head.y + 4;
      // se há um FX sobre a cabeça (?, estrela, lupa…), placa e balão ficam acima dele
      const fxTag = v.st?.fx && v.st.fx !== 'fx_zzz' ? v.st.fx : null;
      const fxs = this.assets.fx;
      const ft = fxTag && fxs && (fxs.tags[fxTag] || (v.st.alt && fxs.tags[v.st.alt]));
      if (ft) {
        const fr = fxs.frames[ft.from];
        const c = this._fxCenter(v, fxs.tags[fxTag] ? fxTag : v.st.alt, fr);
        bottom = Math.min(bottom, c.y - Math.ceil((fr?.h || 16) / 2) - 1);
      }
      const showName = v === hoverChar || inHoverRoom(v) || a.state === 'working' || a.state === 'waiting';
      if (showName) {
        const name = nomeDe(a.id);
        const ms = measure(name);
        const w = (ms.w + 4) * px, h = (ms.bottom - ms.top + 1 + 3) * px;
        const box = place({ x: Math.round(v.pos.x - w / 2), y: bottom - h, w, h });
        bottom = box.y - px;
        const accent = this.byId[a.room]?.accent || '#d06030';
        draws.push(() => this._drawNamePlate(ctx, box, name, ms, accent, a.state === 'waiting', now));
      }
      const b = this.bubbles.get(a.id);
      if (b && now < b.until) {
        const lw = Math.max(...b.lines.map((l) => textWidthCase(l)));
        const lh = 9;
        const w = (lw + 8) * px, h = (b.lines.length * lh + 4) * px;
        const tail = 4 * px;
        const box = place({ x: Math.round(v.pos.x - w / 2), y: bottom - tail - h, w, h: h + tail });
        draws.push(() => this._drawBubble(ctx, { x: box.x, y: box.y, w, h }, b, v.pos.x, now));
      }
    }
    for (const [id, b] of this.bubbles) if (now >= b.until) this.bubbles.delete(id);
    for (const d of draws) d();
  }

  _drawNamePlate(ctx, box, name, ms, accent, waiting, now) {
    const px = this.textPx;
    ctx.fillStyle = INK; ctx.fillRect(box.x - 1, box.y - 1, box.w + 2, box.h + 2);
    ctx.fillStyle = '#211d30'; ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.fillStyle = waiting && Math.floor(now / 400) % 2 ? '#f0d030' : accent;
    ctx.fillRect(box.x, box.y + box.h - px, box.w, px);
    drawTextCase(ctx, name, box.x + 2 * px, box.y + (1 - ms.top) * px, '#ece8f6', px);
  }

  _drawBubble(ctx, r, b, ax, now) {
    const px = this.textPx;
    const { x, y, w, h } = r;
    const pop = now - b.start < 90 ? px : 0; // pulinho ao aparecer
    const yy = y + pop;
    // corpo com cantos cortados
    ctx.fillStyle = INK;
    ctx.fillRect(x + px, yy - px, w - 2 * px, h + 2 * px);
    ctx.fillRect(x - px, yy + px, w + 2 * px, h - 2 * px);
    ctx.fillRect(x, yy, w, h);
    ctx.fillStyle = '#fbf7ea';
    ctx.fillRect(x + px, yy, w - 2 * px, h);
    ctx.fillRect(x, yy + px, w, h - 2 * px);
    ctx.fillStyle = '#e2dccb';
    ctx.fillRect(x + px, yy + h - px, w - 2 * px, px);
    // rabinho apontando para o personagem
    const tx = Math.round(Math.max(x + 3 * px, Math.min(x + w - 6 * px, ax - px)));
    for (let i = 0; i < 4; i++) {
      const tw = (3 - i) * px;
      ctx.fillStyle = INK; ctx.fillRect(tx - px, yy + h + i * px, tw + 2 * px, px);
      if (tw > 0) { ctx.fillStyle = i === 0 ? '#e2dccb' : '#fbf7ea'; ctx.fillRect(tx, yy + h + i * px - (i === 0 ? 0 : 0), tw, px); }
    }
    // texto
    b.lines.forEach((line, i) => drawTextCase(ctx, line, x + 4 * px, yy + (3 + i * 9) * px, '#2a2238', px));
  }
}
