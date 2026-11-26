// Configurar → Aparência: temas prontos, formato do mapa, ajustes por sala e por personagem (com prévia),
// e as cores da interface (variáveis CSS em :root) que acompanham o tema. Contrato: temas/CONTRATO.md.
import { assetUrl, parseAseprite } from './assets.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ROTULOS = {
  formatos: { 'duas-fileiras': 'Duas fileiras', 'uma-fileira': 'Uma fileira (corredor reto)', L: 'Em L (duas alas)', andares: 'Dois andares' },
  tamanhos: { pequena: 'Pequenas', media: 'Médias', grande: 'Grandes' },
  pisos: { madeira: 'Madeira', carpete: 'Carpete', azulejo: 'Azulejo', concreto: 'Concreto', xadrez: 'Xadrez', grama: 'Grama' },
  paredes: { lisa: 'Lisa', tijolo: 'Tijolo', painel: 'Painel', papel: 'Papel de parede', vidro: 'Vidro' },
  cabelos: { curto: 'Curto', longo: 'Longo', coque: 'Coque', careca: 'Careca', bone: 'Boné', gorro: 'Gorro', cacheado: 'Cacheado', moicano: 'Moicano' },
  acessorios: { nenhum: 'Nenhum', oculos: 'Óculos', fone: 'Fone', bone: 'Boné', chapeu: 'Chapéu', bigode: 'Bigode', barba: 'Barba', lapis: 'Lápis' },
};

let info = null;          // GET /api/aparencia
let escolha = {};         // data/aparencia.json (local, atualizado a cada mudança)
let ifaceAplicada = null; // cores da interface do tema aplicado (para desfazer a prévia)
let salaSel = null;
let persSel = null;
let gerando = false;
let erro = null;
let mudouDesdeAplicar = false;
const sheets = new Map(); // id → Promise<sheet>

// ---------------------------------------------------------------- cores da interface
function rgb(hex) { const n = parseInt(String(hex).slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function hex([r, g, b]) { return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
function mix(a, b, t) { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v + (y[i] - v) * t)); }
function lum(h) { const [r, g, b] = rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
const HEX = /^#[0-9a-fA-F]{6}$/;

/** Aplica as cores da interface do tema nas variáveis CSS da página toda. */
export function aplicarInterface(iface) {
  if (!iface || typeof iface !== 'object') return;
  const fundo = HEX.test(iface.fundo || '') ? iface.fundo : '#0f0d16';
  const painel = HEX.test(iface.painel || '') ? iface.painel : '#211d30';
  const destaque = HEX.test(iface.destaque || '') ? iface.destaque : '#e0a030';
  const claro = lum(painel) > 0.4;
  const ink = HEX.test(iface.texto || '') ? iface.texto : claro ? '#221c30' : '#ece8f6';
  const st = document.documentElement.style;
  const set = (k, v) => st.setProperty(k, v);
  set('--bg', fundo);
  set('--bg2', mix(fundo, ink, 0.06));
  set('--panel', painel);
  set('--panel-hi', mix(painel, claro ? '#000000' : '#ffffff', 0.07));
  set('--line', mix(painel, ink, 0.2));
  set('--ink', ink);
  set('--ink-dim', mix(ink, painel, 0.38));
  set('--accent', destaque);
  set('--on-accent', lum(destaque) > 0.3 ? '#1a1300' : '#ffffff');
  set('--well', claro ? mix(painel, '#ffffff', 0.55) : mix(fundo, '#000000', 0.35));
  set('--stage', mix(fundo, painel, 0.4));
  set('--msg-user', mix(painel, destaque, 0.14));
  set('--link', claro ? '#1d5fa8' : '#8fc8ff');
  document.documentElement.dataset.temaClaro = claro ? '1' : '0';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = painel;
  const cs = document.querySelector('meta[name="color-scheme"]');
  if (cs) cs.content = claro ? 'light' : 'dark';
}

/** Cores do tema aplicado ao abrir a página (assets/tema.json do gerador; se não houver, pergunta ao servidor). */
export async function carregarInterfaceInicial() {
  try {
    const r = await fetch('/api/aparencia', { credentials: 'same-origin' });
    if (r.ok) {
      info = await r.json(); escolha = info.escolha || {}; ifaceAplicada = info.interface; aplicarInterface(info.interface);
      return;
    }
  } catch {}
  // sem servidor do chat (modo demo): usa o tema.json que o gerador grava junto dos sprites
  try {
    const r = await fetch(assetUrl('tema.json'), { cache: 'no-cache' });
    if (r.ok) {
      const t = await r.json();
      const iface = t.interface || t.tema?.interface;
      if (iface) { ifaceAplicada = iface; aplicarInterface(iface); }
    }
  } catch {}
}

// ---------------------------------------------------------------- servidor
async function api(path, body) {
  const r = await fetch('/api/' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.erro || `HTTP ${r.status}`);
  return data;
}

let fila = Promise.resolve();
function salvar(parcial) {
  mudouDesdeAplicar = true;
  fila = fila.then(() => api('aparencia', parcial)).then((r) => { if (r.escolha) escolha = r.escolha; erro = null; }, (e) => { erro = 'Não salvou: ' + e.message; })
    .then(renderBarra);
  return fila;
}

// ---------------------------------------------------------------- estado local
const temaAtual = () => info?.temas.find((t) => t.id === (escolha.tema || 'padrao')) || info?.temas[0];
const ajSala = (id) => escolha.salas?.[id] || {};
const ajPers = (id) => escolha.personagens?.[id] || {};
function setLocal(grupo, id, campo, valor) {
  const g = { ...(escolha[grupo] || {}) };
  const item = { ...(g[id] || {}) };
  if (valor === null) delete item[campo]; else item[campo] = valor;
  if (Object.keys(item).length) g[id] = item; else delete g[id];
  escolha = { ...escolha, [grupo]: g };
}

// ---------------------------------------------------------------- render
function opts(lista, rot, atual, padrao = 'Padrão do tema') {
  return `<option value="">${esc(padrao)}</option>` + lista.map((v) => `<option value="${esc(v)}" ${v === atual ? 'selected' : ''}>${esc(rot?.[v] || v)}</option>`).join('');
}

function cardTema(t, sel) {
  const mini = t.miniatura
    ? `<img src="${esc(assetUrl(t.miniatura.replace(/^assets\//, '')))}" alt="" loading="lazy">`
    : `<span class="ap-cores">${(t.cores.length ? t.cores : ['#333333']).map((c) => `<i style="background:${esc(c)}"></i>`).join('')}</span>`;
  const iface = t.interface || {};
  const claro = HEX.test(iface.painel || '') && lum(iface.painel) > 0.4;
  return `<button type="button" class="ap-tema ${sel ? 'on' : ''} ${claro ? 'claro' : ''}" data-tema="${esc(t.id)}" aria-pressed="${sel}"
    style="--t-bg:${esc(iface.fundo || '#0f0d16')};--t-pn:${esc(iface.painel || '#211d30')};--t-ac:${esc(iface.destaque || '#e0a030')}">
    <span class="ap-mini">${mini}</span><b>${esc(t.nome)}</b>${t.descricao ? `<small>${esc(t.descricao)}</small>` : ''}</button>`;
}

function render() {
  const box = $('#cfg-aparencia');
  if (!box || !info) return;
  const t = temaAtual();
  const o = info.opcoes;
  const mapa = escolha.mapa || {};
  salaSel = salaSel || o.salas[0]?.id;
  persSel = persSel || o.personagens[0]?.id;
  box.innerHTML = `
    <p class="dim">Escolha um tema pronto e ajuste salas e personagens. Nada muda no mapa até você clicar em <b>Aplicar</b> (a arte é redesenhada em alguns segundos).</p>
    <div class="ap-temas" role="group" aria-label="Temas">${info.temas.map((x) => cardTema(x, x.id === t?.id)).join('')}</div>
    <div class="ap-grid2">
      <label class="dim">Formato do mapa<select data-mapa="formato">${opts(o.formatos, ROTULOS.formatos, mapa.formato, `Padrão do tema${t?.mapa?.formato ? ' (' + (ROTULOS.formatos[t.mapa.formato] || t.mapa.formato) + ')' : ''}`)}</select></label>
      <label class="dim">Tamanho das salas<select data-mapa="tamanhoSala">${opts(o.tamanhos, ROTULOS.tamanhos, mapa.tamanhoSala, `Padrão do tema${t?.mapa?.tamanhoSala ? ' (' + (ROTULOS.tamanhos[t.mapa.tamanhoSala] || t.mapa.tamanhoSala) + ')' : ''}`)}</select></label>
    </div>
    <details class="ap-det" ${salaSel && Object.keys(escolha.salas || {}).length ? 'open' : ''}><summary><b>Salas</b> <span class="dim">destaque, piso e parede</span></summary>
      <div class="ap-chips" role="tablist" aria-label="Sala">${o.salas.map((s) => `<button type="button" class="ap-chip ${s.id === salaSel ? 'on' : ''} ${escolha.salas?.[s.id] ? 'mod' : ''}" data-sala="${esc(s.id)}" style="--c:${esc(ajSala(s.id).destaque || s.accent)}">${esc(s.nome)}</button>`).join('')}</div>
      <div id="ap-sala"></div>
    </details>
    <details class="ap-det" open><summary><b>Personagens</b> <span class="dim">pele, cabelo, roupa e acessório</span></summary>
      <div class="ap-chips" aria-label="Personagem">${o.personagens.map((p) => `<button type="button" class="ap-chip ${p.id === persSel ? 'on' : ''} ${escolha.personagens?.[p.id] ? 'mod' : ''}" data-pers="${esc(p.id)}" style="--c:${esc(p.accent)}">${esc(p.cargo)}${p.convidado ? ' <small>convidado</small>' : ''}</button>`).join('')}</div>
      <div id="ap-pers"></div>
    </details>
    <div class="ap-barra" id="ap-barra"></div>`;
  renderSala();
  renderPers();
  renderBarra();
}

function renderSala() {
  const el = $('#ap-sala');
  if (!el) return;
  const s = info.opcoes.salas.find((x) => x.id === salaSel);
  if (!s) { el.innerHTML = ''; return; }
  const aj = ajSala(s.id);
  const t = temaAtual();
  const base = { ...(t?.salas?.['*'] || {}), ...(t?.salas?.[s.id] || {}) };
  const destaque = aj.destaque || base.destaque || s.accent;
  el.innerHTML = `<div class="ap-editor">
    <label class="dim ap-cor ${aj.destaque ? '' : 'padrao'}">Destaque<span class="row"><input type="color" data-campo-sala="destaque" value="${esc(destaque)}">
      <button type="button" class="ghost small" data-limpa-sala="destaque" ${aj.destaque ? '' : 'disabled'} title="Voltar à cor padrão">↺</button></span></label>
    <label class="dim">Piso<select data-campo-sala="piso">${opts(info.opcoes.pisos, ROTULOS.pisos, aj.piso, `Padrão${base.piso ? ' (' + (ROTULOS.pisos[base.piso] || base.piso) + ')' : ''}`)}</select></label>
    <label class="dim">Parede<select data-campo-sala="parede">${opts(info.opcoes.paredes, ROTULOS.paredes, aj.parede, `Padrão${base.parede ? ' (' + (ROTULOS.paredes[base.parede] || base.parede) + ')' : ''}`)}</select></label>
  </div>`;
}

function renderPers() {
  const el = $('#ap-pers');
  if (!el) return;
  const p = info.opcoes.personagens.find((x) => x.id === persSel);
  if (!p) { el.innerHTML = ''; return; }
  const aj = ajPers(p.id);
  const pc = info.pecas?.[p.id] || {};
  const peles = temaAtual()?.peles?.length ? temaAtual().peles : (info.temas[0]?.peles?.length ? info.temas[0].peles : ['#f0c8a0', '#d09870', '#a06a48', '#7a4a30']);
  const cor = (campo, rot, padrao) => `<label class="dim ap-cor ${aj[campo] ? '' : 'padrao'}">${rot}<span class="row"><input type="color" data-campo-pers="${campo}" value="${esc(aj[campo] || padrao || '#808080')}">
      <button type="button" class="ghost small" data-limpa-pers="${campo}" ${aj[campo] ? '' : 'disabled'} title="Voltar ao padrão do cargo">↺</button></span></label>`;
  el.innerHTML = `<div class="ap-pers">
    <figure class="ap-previa"><canvas id="ap-canvas" width="128" height="192" aria-label="Prévia do personagem"></canvas>
      <figcaption class="dim" id="ap-previa-nota"></figcaption></figure>
    <div class="ap-editor">
      <div class="dim">Pele<div class="ap-peles" role="radiogroup" aria-label="Tom de pele">
        <button type="button" class="ap-pele ${aj.pele === undefined ? 'on' : ''}" data-pele="" title="Padrão do cargo">↺</button>
        ${peles.map((c, i) => `<button type="button" class="ap-pele ${aj.pele === i ? 'on' : ''}" data-pele="${i}" style="background:${esc(c)}" title="Tom ${i + 1}" aria-label="Tom de pele ${i + 1}"></button>`).join('')}</div></div>
      <label class="dim">Cabelo<select data-campo-pers="cabelo">${opts(info.opcoes.cabelos, ROTULOS.cabelos, aj.cabelo, 'Padrão do cargo')}</select></label>
      ${cor('corCabelo', 'Cor do cabelo', pc.cabelo?.[0])}
      ${cor('roupa', 'Roupa', pc.roupa?.[0])}
      ${cor('calca', 'Calça', pc.calca?.[0])}
      <label class="dim">Acessório<select data-campo-pers="acessorio">${opts(info.opcoes.acessorios, ROTULOS.acessorios, aj.acessorio, 'Padrão do cargo')}</select></label>
      <button type="button" class="ghost small" data-limpa-pers="*" ${Object.keys(aj).length ? '' : 'disabled'}>Tudo padrão para ${esc(p.nome || p.cargo)}</button>
    </div></div>`;
  desenharPrevia();
}

function renderBarra() {
  const el = $('#ap-barra');
  if (!el) return;
  let msg = '';
  if (gerando) msg = '<span class="ap-gerando"><i></i><i></i><i></i> gerando arte…</span>';
  else if (erro) msg = `<span class="bad">${esc(erro)}</span>`;
  else if (mudouDesdeAplicar) msg = '<span class="dim">Mudanças salvas · clique em Aplicar para ver no mapa.</span>';
  else msg = '<span class="dim">Tema aplicado.</span>';
  el.innerHTML = `<div class="ap-msg" role="status">${msg}</div>
    <div class="row"><button type="button" data-ap="aplicar" ${gerando ? 'disabled' : ''}>${gerando ? 'Gerando…' : 'Aplicar'}</button>
    <button type="button" class="ghost" data-ap="restaurar" ${gerando ? 'disabled' : ''}>Restaurar padrão</button></div>`;
}

// ---------------------------------------------------------------- prévia do personagem
function carregarSheet(id) {
  const m = info?._manifest;
  const c = m?.characters?.[id] || m?.visitor;
  if (!c) return Promise.resolve(null);
  const key = id + '|' + assetUrl('');
  if (!sheets.has(key)) {
    sheets.set(key, Promise.all([
      fetch(assetUrl(c.data), { cache: 'no-cache' }).then((r) => r.json()),
      new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = assetUrl(c.image); }),
    ]).then(([j, img]) => parseAseprite(j, img)).catch(() => null));
  }
  return sheets.get(key);
}

/** Rampa nova a partir de uma cor: cada tom original vira a cor nova escurecida/clareada na mesma proporção. */
function rampa(origens, nova) {
  const alvo = rgb(nova);
  const L0 = Math.max(0.02, lum(origens[0]));
  const out = new Map();
  for (const o of origens) {
    const r = Math.sqrt(Math.max(0.0001, lum(o)) / L0);
    const c = r <= 1 ? alvo.map((v) => v * r) : alvo.map((v) => v + (255 - v) * Math.min(1, r - 1));
    out.set(o.toLowerCase(), c.map(Math.round));
  }
  return out;
}

let previaTimer = null;
async function desenharPrevia() {
  const cv = $('#ap-canvas');
  if (!cv) return;
  const id = persSel;
  const nota = $('#ap-previa-nota');
  const sheet = await carregarSheet(id);
  if (persSel !== id || !cv.isConnected) return;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  if (!sheet) { ctx.clearRect(0, 0, cv.width, cv.height); if (nota) nota.textContent = 'Prévia depois de aplicar.'; return; }
  const tag = sheet.tags.base_idle || sheet.tags.base_stand || { from: 0, to: 0 };
  const aj = ajPers(id);
  const pc = info.pecas?.[id] || {};
  const troca = new Map();
  const peles = temaAtual()?.peles || [];
  if (aj.pele !== undefined && peles[aj.pele] && pc.pele?.length) for (const [k, v] of rampa(pc.pele, peles[aj.pele])) troca.set(k, v);
  if (aj.corCabelo && pc.cabelo?.length) for (const [k, v] of rampa(pc.cabelo, aj.corCabelo)) troca.set(k, v);
  if (aj.roupa && pc.roupa?.length) for (const [k, v] of rampa(pc.roupa, aj.roupa)) troca.set(k, v);
  if (aj.calca && pc.calca?.length) for (const [k, v] of rampa(pc.calca, aj.calca)) troca.set(k, v);
  const forma = aj.cabelo || aj.acessorio;
  if (nota) {
    nota.textContent = !Object.keys(aj).length ? 'Visual atual.'
      : forma ? 'Cores na hora; penteado e acessório aparecem depois de Aplicar.'
        : 'Prévia aproximada · o resultado final aparece ao Aplicar.';
  }
  // um quadro recolorido por quadro da animação parada
  const tmp = document.createElement('canvas');
  const quadros = [];
  for (let i = tag.from; i <= tag.to; i++) {
    const f = sheet.frames[i];
    tmp.width = f.w; tmp.height = f.h;
    const tc = tmp.getContext('2d', { willReadFrequently: true });
    tc.clearRect(0, 0, f.w, f.h);
    tc.drawImage(sheet.img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    if (troca.size) {
      const d = tc.getImageData(0, 0, f.w, f.h);
      const px = d.data;
      for (let k = 0; k < px.length; k += 4) {
        if (!px[k + 3]) continue;
        const h = hex([px[k], px[k + 1], px[k + 2]]);
        const n = troca.get(h);
        if (n) { px[k] = n[0]; px[k + 1] = n[1]; px[k + 2] = n[2]; }
      }
      tc.putImageData(d, 0, 0);
    }
    const c2 = document.createElement('canvas');
    c2.width = f.w; c2.height = f.h;
    c2.getContext('2d').drawImage(tmp, 0, 0);
    quadros.push({ c: c2, dur: f.duration || 250 });
  }
  clearTimeout(previaTimer);
  let i = 0;
  const passo = () => {
    if (!cv.isConnected || persSel !== id) return;
    const q = quadros[i % quadros.length];
    ctx.clearRect(0, 0, cv.width, cv.height);
    const s = Math.floor(Math.min(cv.width / q.c.width, cv.height / q.c.height));
    ctx.drawImage(q.c, Math.round((cv.width - q.c.width * s) / 2), cv.height - q.c.height * s, q.c.width * s, q.c.height * s);
    i++;
    if (quadros.length > 1) previaTimer = setTimeout(passo, q.dur);
  };
  passo();
}

// ---------------------------------------------------------------- eventos
let corTimer = null;
function onClick(ev) {
  const b = ev.target.closest('button');
  if (!b || !info) return;
  if (b.dataset.tema) {
    escolha = { ...escolha, tema: b.dataset.tema };
    aplicarInterface(temaAtual()?.interface); // prévia das cores da página; a arte vem ao Aplicar
    salvar({ tema: b.dataset.tema });
    render();
  } else if (b.dataset.sala) { salaSel = b.dataset.sala; for (const c of b.parentElement.children) c.classList.toggle('on', c === b); renderSala(); }
  else if (b.dataset.pers) { persSel = b.dataset.pers; for (const c of b.parentElement.children) c.classList.toggle('on', c === b); renderPers(); }
  else if (b.dataset.limpaSala) { setLocal('salas', salaSel, b.dataset.limpaSala, null); salvar({ salas: { [salaSel]: { [b.dataset.limpaSala]: null } } }); renderSala(); marcarChips(); }
  else if (b.dataset.limpaPers) {
    if (b.dataset.limpaPers === '*') { const g = { ...(escolha.personagens || {}) }; delete g[persSel]; escolha = { ...escolha, personagens: g }; salvar({ personagens: { [persSel]: null } }); }
    else { setLocal('personagens', persSel, b.dataset.limpaPers, null); salvar({ personagens: { [persSel]: { [b.dataset.limpaPers]: null } } }); }
    renderPers(); marcarChips();
  } else if (b.dataset.pele !== undefined) {
    const v = b.dataset.pele === '' ? null : Number(b.dataset.pele);
    setLocal('personagens', persSel, 'pele', v);
    salvar({ personagens: { [persSel]: { pele: v } } });
    renderPers(); marcarChips();
  } else if (b.dataset.ap === 'aplicar') aplicar();
  else if (b.dataset.ap === 'restaurar') restaurar();
}

function onChange(ev) {
  const el = ev.target;
  if (!info) return;
  if (el.dataset.mapa) {
    const v = el.value || null;
    escolha = { ...escolha, mapa: { ...(escolha.mapa || {}), [el.dataset.mapa]: v } };
    if (!v) delete escolha.mapa[el.dataset.mapa];
    salvar({ mapa: { [el.dataset.mapa]: v } });
  } else if (el.dataset.campoSala) {
    const v = el.value || null;
    setLocal('salas', salaSel, el.dataset.campoSala, v);
    if (el.type === 'color') { clearTimeout(corTimer); corTimer = setTimeout(() => salvar({ salas: { [salaSel]: { destaque: v } } }), 250); }
    else salvar({ salas: { [salaSel]: { [el.dataset.campoSala]: v } } });
    if (ev.type === 'change') renderSala();
    marcarChips();
  } else if (el.dataset.campoPers) {
    const v = el.value || null;
    const campo = el.dataset.campoPers;
    setLocal('personagens', persSel, campo, v);
    if (el.type === 'color') { clearTimeout(corTimer); corTimer = setTimeout(() => salvar({ personagens: { [persSel]: { [campo]: v } } }), 250); desenharPrevia(); }
    else { salvar({ personagens: { [persSel]: { [campo]: v } } }); }
    if (ev.type === 'change') renderPers();
    marcarChips();
  }
}

function marcarChips() {
  for (const c of document.querySelectorAll('#cfg-aparencia [data-sala]')) {
    c.classList.toggle('mod', !!escolha.salas?.[c.dataset.sala]);
    const s = info.opcoes.salas.find((x) => x.id === c.dataset.sala);
    c.style.setProperty('--c', ajSala(c.dataset.sala).destaque || s?.accent || '#888');
  }
  for (const c of document.querySelectorAll('#cfg-aparencia [data-pers]')) c.classList.toggle('mod', !!escolha.personagens?.[c.dataset.pers]);
}

async function aplicar() {
  await fila;
  gerando = true; erro = null; renderBarra();
  try { const r = await api('aparencia/aplicar', {}); gerando = r.estado === 'gerando'; }
  catch (e) { gerando = false; erro = 'Não deu para aplicar: ' + e.message; }
  renderBarra();
}

async function restaurar() {
  if (!confirm('Voltar ao tema padrão? Os ajustes de salas, personagens e mapa serão apagados.')) return;
  await fila;
  gerando = true; erro = null;
  try {
    const r = await api('aparencia/restaurar', {});
    escolha = r.escolha || { tema: 'padrao' };
    gerando = r.estado === 'gerando';
    aplicarInterface(temaAtual()?.interface);
  } catch (e) { gerando = false; erro = 'Não deu para restaurar: ' + e.message; }
  render();
}

async function abrir() {
  const box = $('#cfg-aparencia');
  if (!box) return;
  try {
    const [i, m] = await Promise.all([api('aparencia'), fetch(assetUrl('manifest.json'), { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)]);
    info = i; info._manifest = m;
    escolha = info.escolha || {};
    gerando = info.estado?.estado === 'gerando';
    erro = info.estado?.estado === 'erro' ? info.estado.erro : null;
    if (!ifaceAplicada) ifaceAplicada = info.interface;
    render();
  } catch (e) {
    box.innerHTML = `<p class="dim">${/404/.test(e.message) ? 'A aparência precisa do servidor ligado (INICIAR.bat ou npm start).' : 'Não consegui carregar a aparência (' + esc(e.message) + ').'}</p>`;
  }
}

// ---------------------------------------------------------------- entrada pública
export function initAparencia() {
  const box = $('#cfg-aparencia');
  if (!box) return;
  box.addEventListener('click', onClick);
  box.addEventListener('change', onChange);
  box.addEventListener('input', (ev) => { if (ev.target.type === 'color') onChange(ev); });
  $('#btn-settings')?.addEventListener('click', abrir);
  // fechou o Configurar sem aplicar: a página volta às cores do tema aplicado
  $('#settings')?.addEventListener('close', () => { if (ifaceAplicada && !gerando) aplicarInterface(ifaceAplicada); });
}

/** WebSocket: {type:'aparencia_estado'} (gerando/erro) — a troca de sprites em si fica com main.js. */
export function onAparenciaEstado(m) {
  gerando = m.estado === 'gerando';
  erro = m.estado === 'erro' ? (m.erro || 'Erro ao gerar a arte.') : null;
  renderBarra();
}

/** WebSocket: {type:'aparencia', versao, tema, interface} — chamado depois que main.js recarregou os sprites. */
export async function onAparenciaAplicada(m) {
  gerando = false; erro = null; mudouDesdeAplicar = false;
  if (m.interface) { ifaceAplicada = m.interface; aplicarInterface(m.interface); }
  if ($('#settings')?.open && info) {
    try {
      const [i, man] = await Promise.all([api('aparencia'), fetch(assetUrl('manifest.json'), { cache: 'no-cache' }).then((r) => r.json()).catch(() => null)]);
      info = i; info._manifest = man; escolha = info.escolha || escolha;
    } catch {}
    render();
  } else renderBarra();
}
