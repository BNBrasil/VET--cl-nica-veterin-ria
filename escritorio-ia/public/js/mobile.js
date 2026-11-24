// Celular: pareamento, abas no rodapé, seção "Celular" do Configurar, avisos e app instalável (PWA).
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DEMO = new URLSearchParams(location.search).get('demo') === '1';

async function api(path, body) {
  const r = await fetch('/api/' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok && !data.erro) data.erro = `HTTP ${r.status}`;
  return { ok: r.ok, ...data };
}

// ---------------- abas (só aparecem em telas estreitas) ----------------
let tab = 'chat';
let unread = 0;
function setTab(t) {
  tab = t;
  document.body.dataset.tab = t;
  for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('on', b.dataset.tab === t);
  if (t === 'chat') { unread = 0; updateBadge(); }
  // o canvas recalcula a escala quando volta a ficar visível
  requestAnimationFrame(() => dispatchEvent(new Event('resize')));
}
function updateBadge() {
  const b = $('#tab-badge');
  b.hidden = unread === 0;
  b.textContent = unread > 9 ? '9+' : String(unread);
}
for (const b of document.querySelectorAll('#tabs button')) b.addEventListener('click', () => setTab(b.dataset.tab));
setTab('chat');

// ---------------- novas mensagens: contador na aba e aviso no celular ----------------
const narrow = matchMedia('(max-width: 760px)');
new MutationObserver((muts) => {
  const added = muts.flatMap((m) => [...m.addedNodes]).filter((n) => n.nodeType === 1);
  if (!added.length || added.length > 3) return; // snapshot inteiro: não conta
  const msgs = added.filter((n) => n.classList.contains('text') || n.classList.contains('error'));
  if (!msgs.length) return;
  if (narrow.matches && tab !== 'chat') { unread += msgs.length; updateBadge(); }
  if (document.hidden) notify(msgs[msgs.length - 1]);
}).observe($('#chat-list'), { childList: true });

async function notify(li) {
  const who = li.querySelector('.who')?.textContent || 'Escritório';
  const body = (li.querySelector('.body')?.textContent || li.textContent || '').trim().slice(0, 140);
  navigator.vibrate?.(80);
  document.title = '• ' + document.title.replace(/^• /, '');
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) reg.showNotification(who, { body, icon: 'assets/icon-192.png', tag: 'escritorio-chat' });
    else new Notification(who, { body, icon: 'assets/icon-192.png' });
  } catch {}
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) document.title = document.title.replace(/^• /, ''); });

// ---------------- app instalável ----------------
if ('serviceWorker' in navigator && window.isSecureContext && !DEMO) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ---------------- acesso: local, pareado ou não pareado ----------------
let access = { local: true, pareado: true };

async function checkAccess() {
  if (DEMO) return;
  try {
    const r = await fetch('/api/acesso', { credentials: 'same-origin' });
    if (r.status === 404) return; // servidor sem chat
    access = await r.json();
  } catch { return; }
  document.body.classList.toggle('remote', !access.local);
  for (const el of document.querySelectorAll('[data-local-only]')) el.hidden = !access.local;
  $('#cfg-sec-aparelho').hidden = access.local;
  if (!access.pareado) showPairing();
}

function showPairing() {
  const box = $('#pair');
  box.hidden = false;
  const code = new URLSearchParams(location.search).get('parear');
  if (code) { $('#pair-code').value = code.replace(/\D/g, '').slice(0, 6); pair(); }
  else $('#pair-code').focus();
}
async function pair() {
  const codigo = $('#pair-code').value.trim();
  const msg = $('#pair-msg');
  if (!/^\d{6}$/.test(codigo)) { msg.textContent = 'Digite os 6 números.'; return; }
  msg.textContent = 'Conectando…';
  const r = await api('parear', { codigo }).catch((e) => ({ ok: false, erro: e.message }));
  if (r.ok) {
    msg.textContent = 'Pronto! Abrindo o escritório…';
    location.replace(location.pathname); // tira o código da URL
  } else {
    msg.textContent = r.erro || 'Não deu certo.';
  }
}
$('#pair-form').addEventListener('submit', (e) => { e.preventDefault(); pair(); });

// ---------------- Configurar → Celular (no computador) ----------------
let codeTimer = null;
async function renderCelular(code) {
  const box = $('#cfg-celular');
  if (!access.local) return;
  const st = await api('remoto').catch(() => null);
  if (!st || !st.ok) { box.innerHTML = '<p class="dim">Indisponível.</p>'; return; }
  const ts = st.tailscale || {};
  let html = '';
  if (!st.ativo) {
    html += `<p>Use o escritório pelo celular, em casa ou fora dela. Só aparelhos que você parear conseguem entrar.</p>
      <button type="button" data-cel="ligar">Ligar acesso pelo celular</button>
      <p class="dim">No Windows, se o Firewall perguntar, permita o Node.js em <b>redes privadas</b>.</p>`;
  } else {
    html += `<p><span class="ok">✓</span> Acesso pelo celular ligado.</p>`;
    html += ts.conectado
      ? `<p><span class="ok">✓</span> Tailscale conectado: funciona <b>fora de casa</b> também.${ts.https ? ` <span class="dim">HTTPS: ${esc(ts.https)}</span>` : ''}</p>`
      : `<p class="dim">Fora de casa: instale o <a href="https://tailscale.com/download" target="_blank" rel="noopener">Tailscale</a> no computador e no celular (guia em docs/CELULAR.md). Sem ele, funciona só no mesmo Wi-Fi.</p>`;
    if (code) {
      const first = code.links[0];
      html += `<div class="pair-code">
        ${first ? `<img alt="QR code para conectar o celular" src="/api/remoto/qr.svg?url=${encodeURIComponent(first.url)}">` : ''}
        <div><p>Código: <b class="big">${esc(code.codigo)}</b></p>
        <p class="dim" id="code-left"></p>
        <p class="dim">Ou abra no celular:</p>
        <ul>${code.links.map((l) => `<li><span class="tag">${l.tipo === 'wifi' ? 'Wi-Fi' : l.tipo === 'tailscale' ? 'Tailscale' : 'Tailscale HTTPS'}</span> ${esc(l.url.replace(/\?parear=.*/, ''))}</li>`).join('')}</ul></div></div>`;
    } else {
      html += `<button type="button" data-cel="codigo">Conectar um celular</button>`;
    }
    html += `<h4>Aparelhos conectados</h4>`;
    html += st.aparelhos.length
      ? `<ul class="devices">${st.aparelhos.map((d) => `<li><span>${esc(d.nome)}<br><small class="dim">visto ${new Date(d.vistoEm).toLocaleString('pt-BR')}</small></span>
          <button type="button" class="ghost small" data-cel="revogar" data-id="${esc(d.id)}">Revogar</button></li>`).join('')}</ul>`
      : '<p class="dim">Nenhum ainda.</p>';
    html += `<button type="button" class="ghost" data-cel="desligar">Desligar acesso pelo celular</button>`;
  }
  box.innerHTML = html;
  clearInterval(codeTimer);
  if (code) {
    const tick = () => {
      const s = Math.max(0, Math.round((code.expiraEm - Date.now()) / 1000));
      const el = $('#code-left');
      if (el) el.textContent = s ? `Vale por ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} · uso único` : 'Expirou. Gere outro.';
      if (!s) clearInterval(codeTimer);
    };
    tick();
    codeTimer = setInterval(tick, 1000);
  }
}

$('#cfg-celular').addEventListener('click', async (ev) => {
  const b = ev.target.closest('[data-cel]');
  if (!b) return;
  const act = b.dataset.cel;
  b.disabled = true;
  if (act === 'ligar' || act === 'desligar') {
    await api('remoto/ativar', { ativo: act === 'ligar' });
    $('#cfg-celular').innerHTML = '<p class="dim">Reabrindo o servidor…</p>';
    setTimeout(() => renderCelular(), 1500);
    return;
  }
  if (act === 'codigo') {
    const c = await api('remoto/codigo', {});
    if (c.ok) return renderCelular(c);
    alert(c.erro || 'Não foi possível gerar o código.');
  }
  if (act === 'revogar' && confirm('Desconectar este aparelho? Ele vai precisar parear de novo.')) {
    await api('remoto/revogar', { id: b.dataset.id });
  }
  renderCelular();
});

$('#btn-settings').addEventListener('click', () => { if (access.local && !DEMO) renderCelular(); });

// ---------------- Configurar → Este aparelho (no celular) ----------------
$('#cfg-sair').addEventListener('click', async () => {
  if (!confirm('Desconectar este aparelho do escritório?')) return;
  await api('remoto/sair', {}).catch(() => {});
  location.reload();
});
$('#cfg-avisos').addEventListener('click', async () => {
  if (!('Notification' in window)) return alert('Este navegador não suporta avisos.');
  if (!window.isSecureContext) return alert('Os avisos precisam do endereço HTTPS do Tailscale (veja docs/CELULAR.md). Sem ele, o celular só vibra com a página aberta.');
  const p = await Notification.requestPermission();
  $('#cfg-avisos').textContent = p === 'granted' ? 'Avisos ativados ✓' : 'Avisos bloqueados';
});

checkAccess();
