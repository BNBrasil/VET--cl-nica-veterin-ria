// Ponto de entrada: carrega salas e assets, liga rede (ou demo), escala o canvas e atualiza a UI.

import { loadRooms, connect } from './net.js';
import { loadAssets } from './assets.js';
import { Office } from './office.js';
import { OfficeIso } from './office-iso.js';
import { startDemo } from './demo.js';
import { colorFor, stateText, STATE_PT } from './labels.js';
import { initChat, onChatMessage, nomeDe, chatDisabled } from './chat.js';
import { initProducao } from './producao.js';
import { initAparencia, onAparenciaEstado, onAparenciaAplicada, carregarInterfaceInicial } from './aparencia.js';

const $ = (s) => document.querySelector(s);
const canvas = $('#office');
const ctx = canvas.getContext('2d');
const wrap = $('#canvas-wrap');
const tooltip = $('#tooltip');
const params = new URLSearchParams(location.search);
const DEMO = params.get('demo') === '1';

let office = null;
let rooms = null;
let scale = 1; // pixels de dispositivo por pixel nativo
let dirty = true;
const events = [];
const MAX_EVENTS = 60;

function fatal(msg) {
  const el = $('#fatal');
  el.textContent = msg;
  el.hidden = false;
}

// ---------- escala inteira ----------

function resize() {
  if (!office) return;
  const dpr = window.devicePixelRatio || 1;
  const header = $('.topbar').getBoundingClientRect().height;
  const availW = Math.max(100, wrap.parentElement.clientWidth - 8);
  const availH = Math.max(100, window.innerHeight - header - 64);
  const fit = Math.floor(Math.min((availW * dpr) / office.width, (availH * dpr) / office.height));
  const minS = Math.max(1, Math.floor(dpr)); // nunca menor que 1 px CSS por pixel nativo
  const maxS = Math.floor((office.iso ? 3 : 4) * dpr); // até 4x (v1) / 3x (isométrico)
  scale = Math.max(minS, Math.min(maxS, fit));
  canvas.width = office.width * scale;
  canvas.height = office.height * scale;
  canvas.style.width = (canvas.width / dpr) + 'px';
  canvas.style.height = (canvas.height / dpr) + 'px';
  canvas.dataset.scale = String(scale / dpr);
  ctx.imageSmoothingEnabled = false;
  // texto do mapa isométrico: nunca menor que 2 px de tela por pixel da fonte
  office.textPx = scale / dpr >= 2 ? 1 : 2;
  const scrolls = canvas.width / dpr > availW + 1;
  $('#hint').textContent = scrolls
    ? 'Arraste o mapa para o lado · toque numa sala para ver os detalhes.'
    : 'Passe o mouse (ou toque) numa sala para ver os detalhes.';
}

// ---------- loop ----------

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = false;
  office.render(ctx, now, dt);
  requestAnimationFrame(frame);
}

// ---------- painel ----------

function roomName(id) {
  const r = rooms.rooms.find((x) => x.id === id) || (rooms.common || []).find((x) => x.id === id);
  return r ? r.nome : id;
}
function cargoOf(agent) {
  if (!agent) return '';
  if (agent.visitor) return 'Visitante ' + agent.id.replace(/^visitante:/, '');
  const r = rooms.rooms.find((x) => x.id === agent.room);
  return r ? r.cargo : agent.id;
}
function accentOf(agent) {
  if (agent?.visitor) return '#d06030';
  return rooms.rooms.find((x) => x.id === agent?.room)?.accent || '#888';
}
function ago(ms) {
  if (!ms) return '';
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `há ${s}s`;
  if (s < 3600) return `há ${Math.floor(s / 60)}min`;
  return `há ${Math.floor(s / 3600)}h`;
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderAgents() {
  const ul = $('#agents');
  const list = office.list;
  const rows = [];
  for (const r of rooms.rooms) {
    const a = list.find((x) => x.id === r.id && !x.visitor) || null;
    rows.push(agentRow(a, r));
  }
  for (const a of list.filter((x) => x.visitor && x.state !== 'absent')) rows.push(agentRow(a, null));
  ul.innerHTML = rows.join('');
}

function agentRow(a, room) {
  const st = a?.state || 'absent';
  const cargo = room ? `${nomeDe(room.id)} · ${room.cargo}` : cargoOf(a);
  const where = room ? room.nome : 'Lounge';
  const tool = a?.tool ? ` · <span class="tool">${esc(a.tool)}</span>` : '';
  const when = a?.since ? ` · ${ago(a.since)}` : '';
  return `<li class="agent ${st}" style="--c:${room ? room.accent : accentOf(a)}">
    <span class="dot" style="background:${colorFor(a)}"></span>
    <span class="who">${esc(cargo)} <small>${esc(where)}</small></span>
    <span class="tasks" title="Tarefas concluídas">✓ <b>${a?.tasksDone ?? 0}</b></span>
    <span class="what"><span class="st">${esc(a ? stateText(a) : STATE_PT.absent)}</span>${tool}${when}</span>
  </li>`;
}

function renderLog() {
  const ol = $('#log');
  if (!events.length) { ol.innerHTML = '<li class="empty">Nenhum evento ainda.</li>'; return; }
  ol.innerHTML = events.map((e, i) => {
    const a = office.agents.get(e.agentId)?.agent;
    const who = a ? cargoOf(a) : e.agentId;
    const t = new Date(e.at || Date.now()).toLocaleTimeString('pt-BR', { hour12: false });
    return `<li class="${i === 0 && e._fresh ? 'fresh' : ''}" style="--c:${accentOf(a || { room: e.agentId })}">
      <time>${t}</time><span><span class="ev-who">${esc(who)}</span> <span class="ev-hook">${esc(e.hook)}${e.tool ? ' · ' + esc(e.tool) : ''}</span></span>
      <span class="ev-sum">${esc(e.summary || '')}</span></li>`;
  }).join('');
  if (events[0]) events[0]._fresh = false;
}

// ---------- tooltip ----------

let tipRoom = null;
function toWorld(ev) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((ev.clientX - rect.left) / rect.width) * office.width,
    y: ((ev.clientY - rect.top) / rect.height) * office.height,
  };
}

function tipHTML(r) {
  if (r.id === 'lounge') {
    const here = office.list.filter((a) => a.state !== 'absent' && (a.visitor || a.location === 'lounge'));
    const items = here.map((a) => `<li>${esc(cargoOf(a))} — ${esc(stateText(a))}</li>`).join('');
    return `<h3>${esc(r.nome)}</h3><dl><dt>Área</dt><dd>comum (sofá e visitantes)</dd></dl>${items ? `<ul>${items}</ul>` : '<p>Ninguém por aqui.</p>'}`;
  }
  if (!r.work) return `<h3>${esc(r.nome)}</h3><dl><dt>Área</dt><dd>comum</dd></dl>`;
  const a = office.agentForRoom(r.id);
  return `<h3>${esc(nomeDe(r.id))} · ${esc(r.cargo)}</h3><dl>
    <dt>Sala</dt><dd>${esc(r.nome)}</dd>
    <dt>Estado</dt><dd>${esc(a ? stateText(a) : STATE_PT.absent)}${a?.since ? ' (' + ago(a.since) + ')' : ''}</dd>
    <dt>Ferramenta</dt><dd>${esc(a?.tool || '—')}</dd>
    <dt>Tarefas</dt><dd>${a?.tasksDone ?? 0}</dd>
    <dt>Mensagem</dt><dd>${esc(a?.lastMessage || '—')}</dd></dl>`;
}

function showTip(ev) {
  const w = toWorld(ev);
  office.setHover?.(w);
  const r = office.roomAt(w.x, w.y);
  if (!r) { tooltip.hidden = true; tipRoom = null; return; }
  tipRoom = r;
  tooltip.style.setProperty('--c', r.accent);
  tooltip.innerHTML = tipHTML(r);
  tooltip.hidden = false;
  const pad = 14;
  const tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
  let x = ev.clientX + pad, y = ev.clientY + pad;
  if (x + tw > innerWidth - 8) x = Math.max(8, ev.clientX - tw - pad);
  if (y + th > innerHeight - 8) y = Math.max(8, ev.clientY - th - pad);
  tooltip.style.left = x + 'px';
  tooltip.style.top = y + 'px';
  tooltip._ev = { clientX: ev.clientX, clientY: ev.clientY };
}
function hideTip() { tooltip.hidden = true; tipRoom = null; }

canvas.addEventListener('pointermove', (ev) => { if (ev.pointerType === 'mouse') showTip(ev); });
canvas.addEventListener('pointerleave', (ev) => { if (ev.pointerType === 'mouse') { hideTip(); office?.setHover?.(null); } });
canvas.addEventListener('pointerdown', (ev) => {
  if (ev.pointerType === 'mouse') return;
  const w = toWorld(ev);
  const r = office.roomAt(w.x, w.y);
  if (r && tipRoom === r && !tooltip.hidden) hideTip(); else showTip(ev);
});
document.addEventListener('pointerdown', (ev) => { if (ev.target !== canvas) { hideTip(); office?.setHover?.(null); } });

// ---------- dados ----------

function onSnapshot(agents) { office.setAgents(agents); dirty = true; }
function onAgent(agent) { office.upsert(agent); dirty = true; }
function onEvent(e) {
  events.unshift({ ...e, _fresh: true });
  if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;
  renderLog();
}

function setConn(status, text) {
  const el = $('#conn');
  el.dataset.status = status;
  $('#conn-text').textContent = text;
}

let retryAt = 0;
function onStatus(status, info) {
  if (status === 'open') setConn('open', 'Conectado');
  else if (status === 'connecting') setConn('connecting', 'Conectando…');
  else { retryAt = info.retryAt; tickConn(); }
}
function tickConn() {
  if ($('#conn').dataset.status === 'open' || DEMO || !retryAt) return;
  const s = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
  setConn('closed', `Desconectado · nova tentativa em ${s}s`);
}

// ---------- aparência: troca os sprites sem recarregar a página ----------

let trocando = null;
async function trocarAparencia(m) {
  const versao = m.versao || Date.now();
  // pedidos seguidos: espera a troca anterior e só aplica a mais nova
  trocando = (trocando || Promise.resolve()).then(async () => {
    const assets = await loadAssets({ versao });
    if (assets.placeholder || !office) { console.warn('[aparência] sprites novos não carregaram:', assets.reason); return; }
    const novo = assets.v2 ? new OfficeIso(rooms, assets) : new Office(rooms, assets);
    // mantém os estados dos agentes e os balões de fala
    novo.setAgents(office.list);
    if (office.bubbles && novo.bubbles) for (const [k, v] of office.bubbles) novo.bubbles.set(k, v);
    office = novo;
    window.__office = office;
    document.body.classList.toggle('iso', !!assets.v2);
    $('#ph-badge').hidden = true;
    resize();
    dirty = true;
  }).catch((e) => console.warn('[aparência] erro ao trocar:', e));
  await trocando;
  await onAparenciaAplicada(m);
}

// ---------- início ----------

async function boot() {
  const iface = carregarInterfaceInicial();
  try {
    rooms = await loadRooms();
  } catch (e) {
    fatal('Não consegui carregar /shared/rooms.json (' + e.message + '). O servidor está ligado?');
    return;
  }
  await iface;
  const assets = await loadAssets();
  if (assets.placeholder) {
    const b = $('#ph-badge');
    b.hidden = false;
    b.title = 'Modo placeholder: ' + (assets.reason || 'sem sprites');
    console.info('[escritório] MODO PLACEHOLDER:', assets.reason);
  }
  office = assets.v2 ? new OfficeIso(rooms, assets) : new Office(rooms, assets);
  if (assets.v2) document.body.classList.add('iso');
  window.__office = office; // útil para depurar no console
  resize();
  addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(() => resize()).observe(wrap.parentElement);
  requestAnimationFrame(frame);
  // celular: o mapa isométrico é largo; começa mostrando o meio
  if (office.iso && wrap.scrollWidth > wrap.clientWidth) wrap.scrollLeft = (wrap.scrollWidth - wrap.clientWidth) / 2;

  if (DEMO) {
    $('#demo-badge').hidden = false;
    setConn('demo', 'Offline (demo)');
    document.title = 'Escritório de IA · demo';
    startDemo(rooms, { onSnapshot, onAgent, onEvent, onChat: (m) => office.onChat?.(m) });
    initChat({ rooms, onNamesChanged: () => (dirty = true) });
    chatDisabled('O chat precisa do servidor ligado (INICIAR.bat ou npm start). No modo demo ele fica desligado.');
  } else {
    initChat({ rooms, onNamesChanged: () => (dirty = true) });
    // mensagens de chat vão para o painel do chat e também viram balões de fala no mapa
    connect({ onStatus, onSnapshot, onAgent, onEvent, onOther: (m) => {
      if (m.type === 'producao') { dispatchEvent(new CustomEvent('escritorio:ws', { detail: m })); return; }
      if (m.type === 'aparencia') { trocarAparencia(m); return; }
      if (m.type === 'aparencia_estado') { onAparenciaEstado(m); return; }
      onChatMessage(m); office.onChat?.(m);
    } });
  }

  initProducao();
  initAparencia();

  setInterval(() => {
    tickConn();
    // atualiza "há Xs" e o tooltip aberto
    renderAgents(); dirty = false;
    if (tipRoom && !tooltip.hidden) tooltip.innerHTML = tipHTML(tipRoom);
  }, 1000);
  setInterval(() => { if (dirty) { renderAgents(); dirty = false; } }, 200);
  renderAgents();
}

boot();
