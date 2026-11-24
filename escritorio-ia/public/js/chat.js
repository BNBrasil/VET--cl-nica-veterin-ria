// Chat com os agentes + janela de configuração (login, nomes, permissões, desligar).
// Fala com o servidor por /api/* (POST JSON) e recebe as mensagens pelo mesmo WebSocket do escritório.

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let rooms = null;
let nomes = {};
let claude = null;
let mensagens = [];
let onNamesChanged = () => {};
let stick = true;

export function nomeDe(id) {
  if (!id) return '';
  if (id === 'voce') return 'Você';
  if (id === 'sistema') return 'Escritório';
  if (id.startsWith('visitante:')) return 'Visitante ' + id.slice(10);
  return nomes[id] || rooms?.rooms.find((r) => r.id === id)?.nomePadrao || id;
}
function cargoDe(id) {
  return rooms?.rooms.find((r) => r.id === id)?.cargo || '';
}
function corDe(id) {
  if (id === 'voce') return '#ece8f6';
  if (id === 'sistema') return '#9d96b8';
  if (id?.startsWith('visitante:')) return '#d06030';
  return rooms?.rooms.find((r) => r.id === id)?.accent || '#888';
}

async function api(path, body) {
  const r = await fetch('/api/' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// ---------- formatação leve (markdown básico, sempre escapado) ----------
function fmt(text) {
  const parts = String(text).split(/```/);
  return parts.map((p, i) => {
    if (i % 2) return `<pre><code>${esc(p.replace(/^[a-z0-9_-]*\n/i, ''))}</code></pre>`;
    return esc(p)
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
      .replace(/^#{1,6} (.+)$/gm, '<b>$1</b>')
      .replace(/^[-*] /gm, '• ')
      .replace(/\n/g, '<br>');
  }).join('');
}

function hora(at) {
  return new Date(at || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function msgHTML(m) {
  const c = corDe(m.agent);
  if (m.kind === 'tool') {
    return `<li class="msg tool" style="--c:${c}"><span class="who">${esc(nomeDe(m.agent))}</span> usou <b>${esc(m.tool)}</b>${m.text ? ` <span class="arg">${esc(m.text)}</span>` : ''}</li>`;
  }
  if (m.kind === 'delegate') {
    return `<li class="msg delegate" style="--c:${c}"><span class="who">${esc(nomeDe(m.agent))}</span> passou para <b style="color:${corDe(m.alvo)}">${esc(nomeDe(m.alvo))}</b>${cargoDe(m.alvo) ? ` <small>(${esc(cargoDe(m.alvo))})</small>` : ''}: ${esc(m.text)}</li>`;
  }
  if (m.kind === 'system' || m.kind === 'error') {
    return `<li class="msg ${m.kind}">${fmt(m.text)}</li>`;
  }
  const cargo = cargoDe(m.agent);
  return `<li class="msg ${m.kind === 'user' ? 'user' : 'text'}" style="--c:${c}">
    <div class="head"><span class="who">${esc(nomeDe(m.agent))}</span>${cargo ? `<small>${esc(cargo)}</small>` : ''}<time>${hora(m.at)}</time></div>
    <div class="body">${fmt(m.text)}</div></li>`;
}

function renderAll() {
  const ul = $('#chat-list');
  if (!mensagens.length) {
    ul.innerHTML = `<li class="msg system">Escreva o que você precisa. ${esc(nomeDe('orquestrador'))}, o orquestrador, divide o trabalho entre as salas e as respostas aparecem aqui.</li>`;
    return;
  }
  ul.innerHTML = mensagens.map(msgHTML).join('');
  scrollDown(true);
}
function append(m) {
  mensagens.push(m);
  if (mensagens.length > 500) mensagens.shift();
  const ul = $('#chat-list');
  if (mensagens.length === 1) ul.innerHTML = '';
  ul.insertAdjacentHTML('beforeend', msgHTML(m));
  scrollDown(false);
}
function scrollDown(force) {
  const ul = $('#chat-list');
  if (force || stick) ul.scrollTop = ul.scrollHeight;
}

// ---------- status do Claude Code ----------
function renderStatus() {
  const el = $('#claude-status');
  const btnSend = $('#chat-send');
  const busy = $('#chat-busy');
  if (!claude) { el.dataset.s = 'checking'; el.textContent = 'Verificando Claude Code…'; return; }
  let s, t;
  if (claude.instalado === false) { s = 'bad'; t = 'Claude Code não instalado'; }
  else if (claude.instalado && !claude.logado) { s = 'warn'; t = 'Falta fazer login'; }
  else if (claude.ocupado) { s = 'busy'; t = 'Agentes trabalhando' + (claude.fila ? ` · ${claude.fila} na fila` : ''); }
  else if (claude.logado) { s = 'ok'; t = 'Pronto' + (claude.versao ? ` · v${claude.versao}` : ''); }
  else { s = 'checking'; t = 'Verificando…'; }
  el.dataset.s = s;
  el.textContent = t;
  busy.hidden = !claude.ocupado;
  $('#chat-stop').hidden = !claude.ocupado;
  btnSend.disabled = false;
  if ((s === 'bad' || s === 'warn') && !renderStatus.opened) { renderStatus.opened = true; openSettings(); }
  renderSettingsStatus();
}

// ---------- janela de configuração ----------
function openSettings() {
  renderNames();
  renderSettingsStatus();
  const d = $('#settings'); if (!d.open) d.showModal();
}

function renderSettingsStatus() {
  const box = $('#cfg-claude');
  if (!box || !claude) return;
  const ok = (b) => (b ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>');
  let html = `<p>${ok(claude.instalado)} Claude Code ${claude.instalado ? 'instalado' + (claude.versao ? ` (v${esc(claude.versao)})` : '') : 'não encontrado'}</p>`;
  if (!claude.instalado) {
    html += `<p class="dim">O INICIAR.bat instala sozinho. Se preferir, instale por aqui (precisa do Node.js):</p>
      <button type="button" data-act="instalar">Instalar Claude Code</button>`;
  } else {
    html += `<p>${ok(claude.logado)} ${claude.logado ? 'Conectado' + (claude.email ? ' como ' + esc(claude.email) : '') + (claude.metodo ? ` <span class="dim">(${esc(claude.metodo)})</span>` : '') : 'Sem login'}</p>`;
    if (claude.login) {
      html += `<div class="login-box">
        <p>1. ${claude.login.url ? `Abra o link e autorize: <a href="${esc(claude.login.url)}" target="_blank" rel="noopener">abrir página de login</a>` : 'Abrindo o navegador para login…'}</p>
        <p>2. Se a página mostrar um código, cole aqui:</p>
        <div class="row"><input id="cfg-code" autocomplete="off" placeholder="código de autorização"><button type="button" data-act="codigo">Enviar</button></div>
        <button type="button" class="ghost" data-act="cancelar-login">Cancelar</button></div>`;
    } else {
      html += `<div class="row wrap">
        <button type="button" data-act="login-claudeai">${claude.logado ? 'Trocar conta' : 'Entrar com conta Claude (Pro/Max)'}</button>
        <button type="button" class="ghost" data-act="login-console">Entrar com Console (API)</button></div>
        <details><summary>Usar chave de API</summary>
        <div class="row"><input id="cfg-key" type="password" autocomplete="off" placeholder="sk-ant-..."><button type="button" data-act="chave">Salvar</button></div>
        ${claude.temChaveApi ? '<button type="button" class="ghost" data-act="tirar-chave">Remover chave salva</button>' : ''}
        <p class="dim">A chave fica só neste computador, em escritorio-ia/data/.</p></details>`;
    }
  }
  html += `<button type="button" class="ghost" data-act="verificar">Verificar de novo</button>`;
  box.innerHTML = html;
  const sel = $('#cfg-modo');
  if (sel && claude.modos && !sel.dataset.filled) {
    sel.innerHTML = Object.entries(claude.modos).map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join('');
    sel.dataset.filled = '1';
  }
  if (sel && document.activeElement !== sel) sel.value = claude.permissionMode;
}

function renderNames() {
  const box = $('#cfg-nomes');
  box.innerHTML = rooms.rooms.map((r) => `<label style="--c:${r.accent}"><span>${esc(r.cargo)}</span>
    <input name="${esc(r.id)}" maxlength="24" value="${esc(nomes[r.id] || r.nomePadrao || '')}" placeholder="${esc(r.nomePadrao || '')}"></label>`).join('');
}

async function act(name) {
  try {
    if (name === 'instalar') await api('instalar', {});
    else if (name === 'login-claudeai') await api('login', { metodo: 'claudeai' });
    else if (name === 'login-console') await api('login', { metodo: 'console' });
    else if (name === 'codigo') await api('login/codigo', { codigo: $('#cfg-code').value });
    else if (name === 'cancelar-login') await api('login/cancelar', {});
    else if (name === 'chave') { await api('chave', { chave: $('#cfg-key').value }); }
    else if (name === 'tirar-chave') await api('chave', { chave: '' });
    else if (name === 'verificar') { claude = await api('verificar', {}); renderStatus(); }
  } catch (e) {
    alert('Não deu certo: ' + e.message);
  }
}

// ---------- entrada pública ----------
export function initChat(opts) {
  rooms = opts.rooms;
  onNamesChanged = opts.onNamesChanged || onNamesChanged;
  for (const r of rooms.rooms) nomes[r.id] = r.nomePadrao || r.cargo;

  const form = $('#chat-form');
  const input = $('#chat-input');
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const texto = input.value.trim();
    if (!texto) return;
    input.value = '';
    autosize();
    stick = true;
    try {
      const r = await api('chat', { texto });
      if (!r.ok) append({ kind: 'error', agent: 'sistema', text: r.erro || 'Não foi possível enviar.' });
    } catch (e) {
      append({ kind: 'error', agent: 'sistema', text: 'Sem conexão com o servidor do escritório (' + e.message + ').' });
      input.value = texto;
    }
  });
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); form.requestSubmit(); }
  });
  const autosize = () => { input.style.height = 'auto'; input.style.height = Math.min(160, input.scrollHeight) + 'px'; };
  input.addEventListener('input', autosize);

  $('#chat-list').addEventListener('scroll', (ev) => {
    const el = ev.currentTarget;
    stick = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  });
  $('#chat-stop').addEventListener('click', () => api('parar', {}).catch(() => {}));
  $('#chat-new').addEventListener('click', () => {
    if (confirm('Começar uma conversa nova? O histórico deste chat será apagado.')) api('nova-conversa', {}).catch(() => {});
  });
  $('#btn-settings').addEventListener('click', openSettings);
  $('#settings').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-act]');
    if (b) act(b.dataset.act);
  });
  $('#cfg-modo').addEventListener('change', (ev) => api('permissao', { modo: ev.target.value }).catch(() => {}));
  $('#cfg-salvar-nomes').addEventListener('click', async () => {
    const data = {};
    for (const i of $('#cfg-nomes').querySelectorAll('input')) data[i.name] = i.value;
    try { nomes = await api('nomes', { nomes: data }); onNamesChanged(); renderAll(); $('#cfg-nomes-ok').hidden = false; setTimeout(() => ($('#cfg-nomes-ok').hidden = true), 1500); }
    catch (e) { alert('Não salvou: ' + e.message); }
  });
  $('#cfg-restaurar-nomes').addEventListener('click', () => {
    for (const i of $('#cfg-nomes').querySelectorAll('input')) i.value = rooms.rooms.find((r) => r.id === i.name)?.nomePadrao || '';
  });
  $('#cfg-desligar').addEventListener('click', async () => {
    if (!confirm('Desligar o escritório? Os agentes param e a página fica sem conexão.')) return;
    try { await api('desligar', {}); } catch {}
    document.body.classList.add('off');
  });
  $('#settings-close').addEventListener('click', () => $('#settings').close?.());
  renderAll();
  renderStatus();
}

export function chatDisabled(reason) {
  $('#chat').classList.add('disabled');
  $('#chat-list').innerHTML = `<li class="msg system">${esc(reason)}</li>`;
  $('#chat-input').disabled = true;
  $('#chat-send').disabled = true;
}

/** Mensagens do WebSocket que não são do escritório animado. */
export function onChatMessage(msg) {
  if (msg.type === 'chat_snapshot') {
    mensagens = msg.mensagens || [];
    if (msg.nomes) { nomes = msg.nomes; onNamesChanged(); }
    if (msg.claude) claude = msg.claude;
    renderAll(); renderStatus();
  } else if (msg.type === 'chat' && msg.mensagem) {
    append(msg.mensagem);
  } else if (msg.type === 'claude') {
    claude = msg.claude; renderStatus();
  } else if (msg.type === 'nomes') {
    nomes = msg.nomes || nomes; onNamesChanged(); renderAll();
  }
}
