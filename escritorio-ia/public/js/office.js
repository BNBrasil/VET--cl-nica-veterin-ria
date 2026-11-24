// Desenho do escritório: grade de salas, objetos, personagens, FX, plaquinhas e contadores.
// Tudo em pixels nativos do mundo; main.js aplica a escala inteira.

import { AnimPlayer } from './anim.js';
import { drawText, drawTextOutlined, textWidth } from './pixelfont.js';
import { colorFor } from './labels.js';

export const ROOM_W = 160;
export const ROOM_H = 112;
export const GAP = 8;
const WALK_SPEED = 64; // px nativos por segundo
const CHAR_W = 16, CHAR_H = 32;

// Posições padrão do MODO PLACEHOLDER (ou se o manifest não trouxer).
const PH_SEAT = { x: 80, y: 92 };
const PH_SOFA = { x: 44, y: 76 };
const PH_OBJ = { x: 72, y: 40, w: 16, h: 12 };

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f)))));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** Mapeamento estado → animação (CONTRATO §6). */
export function mapState(agent, workTag) {
  const s = agent?.state || 'absent';
  const a = agent?.activity;
  switch (s) {
    case 'working':
      if (a === 'reading') return { char: 'base_read', fx: null, obj: 'obj_work' };
      if (a === 'searching') return { char: 'base_read', fx: 'fx_magnifier', obj: 'obj_work' };
      return { char: workTag, fx: null, obj: 'obj_work' };
    case 'idle': return { char: 'base_idle', fx: null, obj: 'obj_off' };
    case 'dozing': return { char: 'base_doze', fx: null, obj: 'obj_off' };
    case 'sleeping': return { char: 'base_sleep', fx: 'fx_zzz', obj: 'obj_sleep' };
    case 'waiting': return { char: 'base_wait', fx: 'fx_question', obj: 'obj_work', blink: true };
    case 'done': return { char: 'base_done', fx: 'fx_star', obj: 'obj_work' };
    case 'error': return { char: 'base_error', fx: 'fx_smoke', alt: 'fx_sweat', obj: 'obj_work' };
    default: return { char: null, fx: null, obj: 'obj_off' };
  }
}

export class Office {
  constructor(roomsCfg, assets) {
    this.cfg = roomsCfg;
    this.assets = assets;
    this.placeholder = assets.placeholder;
    this.animMeta = assets.manifest?.animations || {};
    this.rooms = [];
    for (const r of roomsCfg.rooms) this.rooms.push({ ...r, work: true });
    for (const r of roomsCfg.common || []) this.rooms.push({ ...r, work: false });
    let maxC = 0, maxR = 0;
    for (const r of this.rooms) {
      r.x = GAP + r.col * (ROOM_W + GAP);
      r.y = GAP + r.row * (ROOM_H + GAP);
      maxC = Math.max(maxC, r.col); maxR = Math.max(maxR, r.row);
      const ar = assets.rooms?.[r.id];
      r.seat = ar?.seat || PH_SEAT;
      r.sofa = ar?.sofa || PH_SOFA;
      r.bg = ar?.bg || null;
      r.objSheet = ar?.object?.sheet || null;
      r.objPos = ar?.object ? { x: ar.object.x, y: ar.object.y } : PH_OBJ;
      r.obj = new AnimPlayer(r.objSheet, this.animMeta);
      r.obj.play('obj_off');
    }
    this.byId = Object.fromEntries(this.rooms.map((r) => [r.id, r]));
    this.lounge = this.byId.lounge;
    this.width = GAP + (maxC + 1) * (ROOM_W + GAP);
    this.height = GAP + (maxR + 1) * (ROOM_H + GAP);
    this.agents = new Map(); // id → view
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
      const sheet = this.placeholder ? null
        : agent.visitor ? (this.assets.visitor || null) : (this.assets.chars[agent.room] || null);
      v = {
        id: agent.id, agent, sheet,
        char: new AnimPlayer(sheet, this.animMeta),
        fx: new AnimPlayer(this.placeholder ? null : this.assets.fx || null, this.animMeta),
        pos: null, path: [], place: null, stateKey: null,
      };
      this.agents.set(agent.id, v);
      instant = true;
    }
    const prevKey = v.stateKey;
    v.agent = agent;
    v.stateKey = `${agent.state}/${agent.activity || ''}`;
    if (prevKey !== null && prevKey !== v.stateKey) v.restart = true; // transição reinicia a tag
    if (instant) v.instant = true;
  }

  get list() { return [...this.agents.values()].map((v) => v.agent); }

  agentForRoom(roomId) {
    const v = this.agents.get(roomId);
    return v && !v.agent.visitor ? v.agent : null;
  }

  roomAt(wx, wy) {
    for (const r of this.rooms) {
      if (wx >= r.x && wx < r.x + ROOM_W && wy >= r.y && wy < r.y + ROOM_H) return r;
    }
    return null;
  }

  // ---------- posições / caminhada ----------

  _layoutTargets() {
    // slots no sofá (residentes dormindo no lounge) e em pé no lounge (visitantes)
    const sofa = [], visitors = [];
    for (const v of this.agents.values()) {
      const a = v.agent;
      if (a.state === 'absent') continue;
      if (a.visitor) visitors.push(v);
      else if (a.location === 'lounge') sofa.push(v);
    }
    const order = (x) => x.sort((p, q) => (p.id < q.id ? -1 : 1));
    order(sofa); order(visitors);
    const L = this.lounge;
    const targets = new Map();
    sofa.forEach((v, i) => {
      const col = i % 5, row = Math.floor(i / 5);
      targets.set(v.id, { place: 'lounge', x: L.x + L.sofa.x + col * 18, y: L.y + L.sofa.y + row * 6, room: L });
    });
    visitors.forEach((v, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      targets.set(v.id, { place: 'lounge-v', x: L.x + 112 + col * 16, y: L.y + 100 - row * 10, room: L });
    });
    for (const v of this.agents.values()) {
      if (targets.has(v.id)) continue;
      const r = this.byId[v.agent.room] || this.byId[this.cfg.defaultRoom];
      if (!r) continue;
      targets.set(v.id, { place: 'seat:' + r.id, x: r.x + r.seat.x, y: r.y + r.seat.y, room: r });
    }
    return targets;
  }

  _exitY(room) {
    const L = this.lounge;
    return room.row < L.row ? room.y + ROOM_H + GAP / 2 : room.y - GAP / 2;
  }

  _route(from, fromRoom, to, toRoom) {
    const L = this.lounge;
    const gx = L.x - GAP / 2; // corredor vertical à esquerda do lounge
    const y1 = this._exitY(fromRoom), y2 = this._exitY(toRoom);
    const pts = [
      { x: from.x, y: y1 }, { x: gx, y: y1 }, { x: gx, y: y2 }, { x: to.x, y: y2 }, { x: to.x, y: to.y },
    ];
    const out = [];
    let last = from;
    for (const p of pts) {
      if (Math.abs(p.x - last.x) < 0.5 && Math.abs(p.y - last.y) < 0.5) continue;
      out.push(p); last = p;
    }
    return out;
  }

  _advance(v, dt) {
    let budget = WALK_SPEED * dt;
    while (budget > 0 && v.path.length) {
      const p = v.path[0];
      const dx = p.x - v.pos.x, dy = p.y - v.pos.y;
      const d = Math.hypot(dx, dy);
      if (d <= budget) { v.pos = { x: p.x, y: p.y }; v.path.shift(); v.trail?.push({ ...v.pos }); budget -= d; }
      else {
        v.pos = { x: v.pos.x + (dx / d) * budget, y: v.pos.y + (dy / d) * budget };
        v.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
        budget = 0;
      }
    }
  }

  // ---------- desenho ----------

  render(ctx, now, dt) {
    ctx.fillStyle = '#16141f';
    ctx.fillRect(0, 0, this.width, this.height);
    this._drawCorridors(ctx);

    const targets = this._layoutTargets();
    // atualiza posições
    for (const v of this.agents.values()) {
      const t = targets.get(v.id);
      if (!t) continue;
      if (!v.pos || v.instant) {
        v.pos = { x: t.x, y: t.y }; v.path = []; v.place = t.place; v.placeRoom = t.room; v.instant = false;
      } else if (v.place !== t.place) {
        const fromRoom = v.placeRoom || t.room;
        if (v.path.length && v.origin && v.origin.place === t.place) {
          // mudou de ideia no meio do caminho: volta pelos mesmos pontos
          v.path = [...v.trail].reverse();
          v.path.push({ x: t.x, y: t.y });
          v.trail = [{ ...v.pos }];
          v.origin = { place: v.place };
        } else {
          v.origin = { place: v.place };
          v.trail = [{ ...v.pos }];
          if (t.room === fromRoom) v.path = [{ x: t.x, y: t.y }];
          else v.path = this._route(v.pos, fromRoom, t, t.room);
        }
        v.place = t.place; v.placeRoom = t.room;
      } else if (!v.path.length && (v.pos.x !== t.x || v.pos.y !== t.y)) {
        v.path = [{ x: t.x, y: t.y }]; // slot do sofá mudou
      }
      if (v.path.length) this._advance(v, dt);
    }

    // salas
    for (const r of this.rooms) { this._drawRoom(ctx, r, now); this._drawPlate(ctx, r); }

    // personagens ordenados pela profundidade (y do pé)
    const vis = [...this.agents.values()].filter((v) => v.pos && v.agent.state !== 'absent');
    vis.sort((a, b) => a.pos.y - b.pos.y);
    const fxQueue = [];
    for (const v of vis) {
      const fx = this._drawAgent(ctx, v, now);
      if (fx) fxQueue.push(fx);
    }
    for (const f of fxQueue) f(); // FX por cima de tudo (inclusive plaquinhas)
  }

  _drawCorridors(ctx) {
    ctx.fillStyle = '#2a2638';
    ctx.fillRect(GAP / 2, GAP / 2, this.width - GAP, this.height - GAP);
    // tracejado do piso do corredor
    ctx.fillStyle = '#332e44';
    for (let x = GAP / 2; x < this.width - GAP / 2; x += 8) {
      for (const r of new Set(this.rooms.map((q) => q.row))) {
        ctx.fillRect(x, GAP + r * (ROOM_H + GAP) - 5, 4, 1);
      }
    }
  }

  _roomObjTag(r) {
    if (!r.work) return 'obj_work';
    const a = this.agentForRoom(r.id);
    if (!a) return 'obj_off';
    if (a.location === 'lounge' && a.state !== 'absent') return 'obj_sleep';
    return mapState(a).obj;
  }

  _drawRoom(ctx, r, now) {
    const objTag = this._roomObjTag(r);
    if (r.objSheet && !r.obj.has(objTag)) r.obj.play('obj_off', now);
    else r.obj.play(objTag, now);

    if (r.bg) {
      ctx.drawImage(r.bg, r.x, r.y);
    } else {
      this._drawRoomPlaceholder(ctx, r, now);
    }
    if (r.objSheet) {
      r.obj.draw(ctx, r.x + r.objPos.x, r.y + r.objPos.y, 'top', now);
    } else if (r.work) {
      this._drawObjPlaceholder(ctx, r, objTag, now);
    }
    // absent → cadeira vazia (no placeholder desenhamos a cadeira; com sprites o fundo já tem)
    if (r.work && !r.bg) {
      const a = this.agentForRoom(r.id);
      const empty = !a || a.state === 'absent' || a.location === 'lounge';
      if (empty) this._drawChair(ctx, r.x + r.seat.x, r.y + r.seat.y);
    }
  }

  _drawRoomPlaceholder(ctx, r, now) {
    const acc = r.accent;
    ctx.save();
    ctx.beginPath(); ctx.rect(r.x, r.y, ROOM_W, ROOM_H); ctx.clip();
    ctx.fillStyle = shade(acc, -0.78);
    ctx.fillRect(r.x, r.y, ROOM_W, ROOM_H);
    // piso quadriculado
    ctx.fillStyle = shade(acc, -0.72);
    for (let ty = 24; ty < ROOM_H; ty += 16)
      for (let tx = ((ty / 16) % 2) * 16; tx < ROOM_W; tx += 32) ctx.fillRect(r.x + tx, r.y + ty, 16, 16);
    // parede
    ctx.fillStyle = shade(acc, -0.45);
    ctx.fillRect(r.x, r.y, ROOM_W, 24);
    ctx.fillStyle = shade(acc, -0.6);
    ctx.fillRect(r.x, r.y + 22, ROOM_W, 2);
    // borda na cor de destaque
    ctx.fillStyle = acc;
    ctx.fillRect(r.x, r.y, ROOM_W, 1); ctx.fillRect(r.x, r.y + ROOM_H - 1, ROOM_W, 1);
    ctx.fillRect(r.x, r.y, 1, ROOM_H); ctx.fillRect(r.x + ROOM_W - 1, r.y, 1, ROOM_H);

    if (r.work) {
      // mesa
      const dx = r.x + 52, dy = r.y + 48;
      ctx.fillStyle = '#6a4a30'; ctx.fillRect(dx, dy, 56, 16);
      ctx.fillStyle = '#8a6440'; ctx.fillRect(dx, dy, 56, 3);
      ctx.fillStyle = '#3c2818'; ctx.fillRect(dx + 2, dy + 16, 3, 6); ctx.fillRect(dx + 51, dy + 16, 3, 6);
    } else if (r.id === 'lounge') {
      const s = r.sofa;
      ctx.fillStyle = '#4a6a5e'; ctx.fillRect(r.x + s.x - 16, r.y + s.y - 24, 104, 12);
      ctx.fillStyle = '#5e8a78'; ctx.fillRect(r.x + s.x - 16, r.y + s.y - 12, 104, 14);
      ctx.fillStyle = '#3a5248'; ctx.fillRect(r.x + s.x - 20, r.y + s.y - 20, 4, 22); ctx.fillRect(r.x + s.x + 88, r.y + s.y - 20, 4, 22);
      // planta
      ctx.fillStyle = '#7a4a2a'; ctx.fillRect(r.x + 140, r.y + 40, 8, 8);
      ctx.fillStyle = '#3c8a40'; ctx.fillRect(r.x + 138, r.y + 30, 12, 10);
    } else {
      // copa: balcão e cafeteira
      ctx.fillStyle = '#6a5040'; ctx.fillRect(r.x + 8, r.y + 26, 144, 14);
      ctx.fillStyle = '#c0c0c8'; ctx.fillRect(r.x + 20, r.y + 18, 10, 10);
      const steam = Math.floor(now / 300) % 3;
      ctx.fillStyle = '#e0e0e8'; ctx.fillRect(r.x + 24 + (steam - 1), r.y + 14 - steam, 1, 2);
      ctx.fillStyle = '#7a5a40'; ctx.fillRect(r.x + 56, r.y + 64, 48, 20);
    }
    ctx.restore();
  }

  _drawObjPlaceholder(ctx, r, tag, now) {
    const o = { x: r.x + r.objPos.x, y: r.y + r.objPos.y, w: PH_OBJ.w, h: PH_OBJ.h };
    ctx.fillStyle = '#202028'; ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = '#404048'; ctx.fillRect(o.x + 6, o.y + o.h, 4, 3);
    const step = r.obj.step(now);
    if (tag === 'obj_work') {
      ctx.fillStyle = shade(r.accent, 0.3); ctx.fillRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2);
      ctx.fillStyle = shade(r.accent, -0.3);
      for (let i = 0; i < 3; i++) ctx.fillRect(o.x + 2, o.y + 3 + i * 3, ((step + i * 2) % 4) * 3 + 2, 1);
    } else if (tag === 'obj_sleep') {
      ctx.fillStyle = '#182040'; ctx.fillRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2);
      ctx.fillStyle = '#6080d0'; ctx.fillRect(o.x + 2 + step * 3, o.y + 2 + (step % 2) * 6, 2, 2);
    } else {
      ctx.fillStyle = '#101014'; ctx.fillRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2);
    }
  }

  _drawChair(ctx, fx, fy) {
    ctx.fillStyle = '#303038'; ctx.fillRect(fx - 6, fy - 14, 12, 10);
    ctx.fillStyle = '#484858'; ctx.fillRect(fx - 7, fy - 6, 14, 3);
    ctx.fillStyle = '#202028'; ctx.fillRect(fx - 1, fy - 3, 2, 3);
  }

  _drawAgent(ctx, v, now) {
    const a = v.agent;
    const walking = v.path.length > 0;
    const onSofa = !walking && v.place === 'lounge';
    const workTag = a.visitor ? 'visitante_work' : `${a.room}_work`;
    const m = mapState(a, workTag);
    let tag = walking ? `base_walk_${v.dir || 'down'}` : onSofa ? 'base_sleep' : m.char;
    if (!tag) return null;
    if (v.char.sheet && !v.char.has(tag)) tag = v.char.has('base_idle') ? 'base_idle' : tag;
    v.char.play(tag, now, v.restart && !walking);
    v.restart = false;

    const x = Math.round(v.pos.x), y = Math.round(v.pos.y);
    let headY;
    if (v.char.sheet) {
      const f = v.char.draw(ctx, x, y, 'foot', now);
      headY = y - (f ? f.h : CHAR_H);
    } else {
      headY = this._drawCharPlaceholder(ctx, v, tag, x, y, now, onSofa);
    }

    // FX
    let fxTag = walking ? null : onSofa ? 'fx_zzz' : m.fx;
    if (!fxTag) return null;
    const fxSheet = v.fx.sheet;
    if (fxSheet && !fxSheet.tags[fxTag] && m.alt && fxSheet.tags[m.alt]) fxTag = m.alt;
    v.fx.play(fxTag, now);
    const blinkManual = m.blink && (!fxSheet || (fxSheet.tags[fxTag] && fxSheet.tags[fxTag].to === fxSheet.tags[fxTag].from));
    if (blinkManual && Math.floor(now / 400) % 2 === 1) return null;
    return () => {
      if (fxSheet && fxSheet.tags[fxTag]) {
        const f = v.fx.frame(now);
        if (f) v.fx.draw(ctx, x, headY - 1, 'foot', now);
      } else {
        this._drawFxPlaceholder(ctx, fxTag, x, headY, v.fx.step(now), now);
      }
    };
  }

  _drawCharPlaceholder(ctx, v, tag, x, y, now, onSofa) {
    const a = v.agent;
    const col = colorFor(a);
    const step = v.char.step(now);
    if (onSofa) {
      // deitado no sofá: 32x14
      const w = 18, h = 12, bx = x - 9, by = y - 16 + (step % 2);
      ctx.fillStyle = '#000'; ctx.fillRect(bx - 1, by - 1, w + 2, h + 2);
      ctx.fillStyle = col; ctx.fillRect(bx, by, w, h);
      ctx.fillStyle = shade(col, 0.4); ctx.fillRect(bx, by, 8, h);
      ctx.fillStyle = '#202020'; ctx.fillRect(bx + 2, by + 3, 3, 1); ctx.fillRect(bx + 2, by + 7, 3, 1);
      return by;
    }
    let bob = 0;
    if (tag.startsWith('base_walk')) bob = step % 2;
    else if (tag === 'base_doze') bob = step === 1 || step === 2 ? 1 : 0;
    else if (tag === 'base_sleep') bob = step >= 2 ? 1 : 0;
    else if (tag === 'base_done') bob = step % 2 ? -2 : 0;
    else if (tag === 'base_error') bob = 0;
    else if (tag.endsWith('_work') || tag === 'base_read') bob = step % 2;
    const ex = tag === 'base_error' ? (step % 2 ? 1 : -1) : 0;
    const bx = x - CHAR_W / 2 + ex, by = y - CHAR_H + bob;
    const hBody = CHAR_H - bob;
    ctx.fillStyle = '#000'; ctx.fillRect(bx - 1, by - 1, CHAR_W + 2, hBody + 2);
    ctx.fillStyle = col; ctx.fillRect(bx, by, CHAR_W, hBody);
    // cabeça mais clara, pernas mais escuras
    ctx.fillStyle = shade(col, 0.35); ctx.fillRect(bx, by, CHAR_W, 12);
    ctx.fillStyle = shade(col, -0.35); ctx.fillRect(bx, by + hBody - 8, CHAR_W, 8);
    if (tag.startsWith('base_walk')) {
      ctx.fillStyle = '#000'; ctx.fillRect(bx + 7, by + hBody - 7 + (step % 2), 2, 7);
    }
    // olhos
    ctx.fillStyle = '#181818';
    const sleepy = tag === 'base_sleep' || (tag === 'base_doze' && step !== 0);
    if (tag === 'base_walk_up') { /* de costas */ }
    else if (sleepy) { ctx.fillRect(bx + 3, by + 6, 3, 1); ctx.fillRect(bx + 10, by + 6, 3, 1); }
    else if (tag === 'base_read') { ctx.fillRect(bx + 4, by + 7, 2, 1); ctx.fillRect(bx + 10, by + 7, 2, 1); }
    else { ctx.fillRect(bx + 4, by + 4, 2, 3); ctx.fillRect(bx + 10, by + 4, 2, 3); }
    if (a.visitor) { // boné de visitante
      ctx.fillStyle = '#d06030'; ctx.fillRect(bx - 1, by - 1, CHAR_W + 2, 3); ctx.fillRect(bx + CHAR_W, by + 1, 3, 1);
    }
    if (tag === 'base_read' || tag.endsWith('_work')) { // braços/prancheta
      ctx.fillStyle = shade(col, -0.5); ctx.fillRect(bx + 2, by + 16 + (step % 2), 12, 2);
    }
    return by;
  }

  _drawFxPlaceholder(ctx, tag, x, headY, step, now) {
    switch (tag) {
      case 'fx_zzz': {
        const o = step;
        drawTextOutlined(ctx, 'z', x + 6, headY - 6 - o, '#e8e8f8', '#202030');
        if (o >= 1) drawTextOutlined(ctx, 'Z', x + 10, headY - 13 - o, '#e8e8f8', '#202030');
        if (o >= 2) drawTextOutlined(ctx, 'z', x + 15, headY - 20 - o, '#e8e8f8', '#202030');
        break;
      }
      case 'fx_question': {
        ctx.fillStyle = '#000'; ctx.fillRect(x - 6, headY - 15, 13, 11);
        ctx.fillStyle = '#fff'; ctx.fillRect(x - 5, headY - 14, 11, 9);
        ctx.fillRect(x - 1, headY - 5, 3, 2); ctx.fillRect(x, headY - 3, 1, 1);
        drawText(ctx, '?', x - 1, headY - 12, '#d04010');
        break;
      }
      case 'fx_star': {
        const c = step % 2 ? '#fff0a0' : '#f0c020';
        ctx.fillStyle = c;
        const sx = x - 1, sy = headY - 9 - (step % 2);
        ctx.fillRect(sx, sy - 3, 2, 8); ctx.fillRect(sx - 3, sy, 8, 2); ctx.fillRect(sx - 1, sy - 1, 4, 4);
        break;
      }
      case 'fx_smoke':
      case 'fx_sweat': {
        ctx.fillStyle = '#9090a0';
        for (let i = 0; i < 3; i++) {
          const k = (step + i) % 4;
          ctx.fillRect(x - 6 + i * 5, headY - 4 - k * 3, 4 - (k >> 1), 4 - (k >> 1));
        }
        ctx.fillStyle = '#60b0f0'; ctx.fillRect(x + 8, headY + 2 + (step % 3), 2, 3);
        break;
      }
      case 'fx_magnifier': {
        const ox = x + 6 + (step % 2) * 2, oy = headY + 10;
        ctx.fillStyle = '#e0e0f0';
        ctx.fillRect(ox, oy, 5, 1); ctx.fillRect(ox, oy + 4, 5, 1); ctx.fillRect(ox - 1, oy + 1, 1, 3); ctx.fillRect(ox + 5, oy + 1, 1, 3);
        ctx.fillStyle = '#80c0ff'; ctx.fillRect(ox, oy + 1, 5, 3);
        ctx.fillStyle = '#806040'; ctx.fillRect(ox + 5, oy + 5, 2, 2); ctx.fillRect(ox + 7, oy + 7, 2, 2);
        break;
      }
    }
  }

  _drawPlate(ctx, r) {
    const name = r.nome.toUpperCase();
    const w = textWidth(name) + 6;
    const px = r.x + Math.round((ROOM_W - w) / 2), py = r.y + 3;
    ctx.fillStyle = '#000'; ctx.fillRect(px - 1, py - 1, w + 2, 12);
    ctx.fillStyle = r.accent; ctx.fillRect(px, py, w, 10);
    ctx.fillStyle = shade(r.accent, 0.35); ctx.fillRect(px, py, w, 1);
    drawText(ctx, name, px + 3, py + 3, shade(r.accent, -0.8));

    if (r.work) {
      const a = this.agentForRoom(r.id);
      const n = a?.tasksDone || 0;
      const label = '✓' + n;
      const tw = textWidth(label) + 4;
      const bx = r.x + ROOM_W - tw - 4, by = r.y + ROOM_H - 12;
      ctx.fillStyle = '#000'; ctx.fillRect(bx - 1, by - 1, tw + 2, 11);
      ctx.fillStyle = '#1c1a28'; ctx.fillRect(bx, by, tw, 9);
      drawText(ctx, label, bx + 2, by + 2, n > 0 ? r.accent : '#707080');
    }
  }
}
