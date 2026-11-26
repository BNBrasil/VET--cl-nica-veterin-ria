// Produção: fila de vídeos do canal gamer (aprovar / rejeitar / postar) + Configurar → Redes sociais e → Agenda.
// Recebe {type:'producao'} pelo WebSocket (main.js repassa como evento 'escritorio:ws') e consulta /api/producao.
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DEMO = new URLSearchParams(location.search).get('demo') === '1';

const ESTADO = {
  pronto: ['Em revisão', 'cinza'], revisado: ['Revisado', 'cinza'], aguardando: ['Aguardando você', 'amarelo'],
  aprovado: ['Aprovado', 'azul'], publicando: ['Publicando…', 'azul'], publicado: ['Publicado', 'verde'],
  simulado: ['Simulado', 'roxo'], erro: ['Erro', 'vermelho'], rejeitado: ['Rejeitado', 'cinza'],
};
const REDE = { tiktok: 'TikTok', instagram: 'Instagram' };
const ESTADO_REDE = { publicado: 'publicado', rascunho: 'na caixa de entrada', simulado: 'simulado', erro: 'erro' };

let dados = null;
let ocupado = new Set(); // ids com ação em andamento nesta página
let local = true;

async function api(path, body) {
  const r = await fetch('/api/' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok && !j.erro) j.erro = `HTTP ${r.status}`;
  return { status: r.status, okHttp: r.ok, ...j };
}

function dur(s) {
  if (!s && s !== 0) return '';
  const n = Math.round(s);
  return n >= 60 ? `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}` : `${n}s`;
}
function quando(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function botoes(p) {
  const id = esc(p.id);
  const sim = dados?.simulacao ? ' <small>(simulação)</small>' : '';
  if (ocupado.has(p.id) || p.estado === 'publicando' || dados?.emAndamento?.includes(p.id)) return '<p class="dim pub-wait"><i></i><i></i><i></i> publicando…</p>';
  const b = [];
  if (p.estado === 'aguardando') b.push(`<button type="button" data-prod="aprovar" data-id="${id}">✓ Aprovar e postar${sim}</button>`);
  if (['aprovado', 'erro', 'simulado'].includes(p.estado)) b.push(`<button type="button" data-prod="postar-agora" data-id="${id}">${p.estado === 'erro' ? '↻ Tentar de novo' : '▶ Postar agora'}${sim}</button>`);
  if (!['publicado', 'rejeitado', 'publicando'].includes(p.estado)) b.push(`<button type="button" class="ghost" data-prod="rejeitar" data-id="${id}">✕ Rejeitar</button>`);
  return b.length ? `<div class="row wrap">${b.join('')}</div>` : '';
}

function redesHTML(p) {
  const r = Object.entries(p.redes || {});
  if (!r.length) return '';
  return `<ul class="pub-redes">${r.map(([k, v]) => `<li class="r-${esc(v?.estado)}"><b>${esc(REDE[k] || k)}</b> ${esc(ESTADO_REDE[v?.estado] || v?.estado || '')}
    ${v?.url ? ` · <a href="${esc(v.url)}" target="_blank" rel="noopener">abrir post ↗</a>` : ''}
    ${v?.erro ? `<br><small class="bad">${esc(v.erro)}</small>` : ''}${v?.aviso ? `<br><small class="dim">${esc(v.aviso)}</small>` : ''}</li>`).join('')}</ul>`;
}

function cardHTML(p) {
  const [rotulo, cor] = ESTADO[p.estado] || [p.estado, 'cinza'];
  const id = encodeURIComponent(p.id);
  const tags = (p.hashtags || []).map((h) => esc(h)).join(' ');
  return `<article class="pub pub-${cor}" data-id="${esc(p.id)}">
    <div class="pub-media">${p.temVideo
      ? `<video controls playsinline preload="none" ${p.temCapa ? `poster="/api/producao/${id}/capa"` : ''} src="/api/producao/${id}/video"></video>`
      : p.temCapa ? `<img alt="" src="/api/producao/${id}/capa">` : '<div class="pub-vazio">sem vídeo</div>'}</div>
    <div class="pub-info">
      <div class="pub-top"><span class="pub-estado">${esc(rotulo)}</span>${p.critico ? '<span class="pub-crit">crítico</span>' : ''}
        <span class="dim">${esc(dur(p.duracao))}${p.criadoEm ? ' · ' + esc(quando(p.criadoEm)) : ''}</span></div>
      <h3>${esc(p.titulo)}</h3>
      ${p.motivos?.length ? `<ul class="pub-motivos">${p.motivos.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}
      ${p.aprovadoPor === 'usuario' ? `<p class="dim">✓ aprovado por você em ${esc(quando(p.aprovadoEm))}</p>` : ''}
      ${p.motivoRejeicao ? `<p class="dim">Rejeitado: ${esc(p.motivoRejeicao)}</p>` : ''}
      <details class="pub-leg"${p.estado === 'aguardando' ? ' open' : ''}><summary>Legenda</summary><p>${esc(p.legenda)}${tags ? `<br><span class="pub-tags">${tags}</span>` : ''}</p></details>
      ${redesHTML(p)}
      ${p.estado === 'erro' && p.erro && !Object.keys(p.redes || {}).length ? `<p class="bad">${esc(p.erro)}</p>` : ''}
      ${botoes(p)}
    </div></article>`;
}

function render() {
  const box = $('#prod-list');
  if (!box || !dados) return;
  const n = dados.aguardando || 0;
  for (const el of document.querySelectorAll('.prod-count')) { el.hidden = !n; el.textContent = n > 9 ? '9+' : String(n); }
  const aviso = $('#prod-aviso');
  aviso.hidden = !dados.simulacao;
  aviso.innerHTML = dados.simulacao
    ? `<b>Modo simulação</b> (${esc(dados.motivoSimulacao || 'sem tokens')}): aprovar e postar <b>não publica de verdade</b>, só testa o caminho. ${local ? 'Configure em <a href="#" data-prod="abrir-redes">⚙ Configurar → Redes sociais</a>.' : 'Configure as redes no computador.'}`
    : '';
  const posts = dados.posts || [];
  if (!posts.length) {
    box.innerHTML = '<p class="dim">Nenhum vídeo na fila. Peça no chat: "Produza o boletim gamer de agora" — ou ligue a Agenda em ⚙ Configurar.</p>';
    return;
  }
  // aguardando primeiro, depois o resto por data
  const ordem = (p) => (p.estado === 'aguardando' ? 0 : ['erro', 'aprovado', 'publicando'].includes(p.estado) ? 1 : 2);
  const lista = posts.slice().sort((a, b) => ordem(a) - ordem(b) || (b.criadoEm || 0) - (a.criadoEm || 0));
  // não recria um card cujo vídeo está tocando
  const tocando = [...box.querySelectorAll('video')].filter((v) => !v.paused).map((v) => v.closest('.pub')?.dataset.id);
  if (tocando.length) {
    for (const p of lista) {
      const el = box.querySelector(`.pub[data-id="${CSS.escape(p.id)}"]`);
      if (el && tocando.includes(p.id)) { el.querySelector('.pub-info').outerHTML = $('.pub-info', tpl(cardHTML(p))).outerHTML; }
      else if (el) el.outerHTML = cardHTML(p);
    }
    return;
  }
  box.innerHTML = lista.map(cardHTML).join('');
}
function tpl(html) { const t = document.createElement('template'); t.innerHTML = html; return t.content; }

async function carregar() {
  if (DEMO) return;
  const r = await api('producao').catch(() => null);
  if (r && r.okHttp) { dados = r; render(); }
  else if (r && r.status === 404) $('#producao').hidden = true;
}

async function acao(nome, id) {
  if (nome === 'abrir-redes') {
    $('#btn-settings').click();
    setTimeout(() => $('#cfg-sec-redes')?.scrollIntoView({ block: 'start' }), 100);
    return;
  }
  const p = dados?.posts?.find((x) => x.id === id);
  let body = {};
  if (nome === 'rejeitar') {
    const m = prompt(`Rejeitar "${p?.titulo || id}"? Diga o motivo (opcional):`, '');
    if (m === null) return;
    body = { motivo: m };
  }
  if (nome === 'aprovar' && !dados?.simulacao && !confirm(`Publicar "${p?.titulo || id}" agora nas redes configuradas?`)) return;
  ocupado.add(id); render();
  const r = await api(`producao/${encodeURIComponent(id)}/${nome}`, body).catch((e) => ({ erro: e.message }));
  ocupado.delete(id);
  if (r.erro || r.ok === false) alert('Não deu certo: ' + (r.erro || r.postagem?.erro || 'erro'));
  else if (r.postagem && r.postagem.ok === false) alert('Aprovado, mas a postagem não começou: ' + r.postagem.erro);
  await carregar();
}

// ---------------- Configurar → Redes sociais ----------------
const PRIV = { SELF_ONLY: 'Só eu (SELF_ONLY) — único que funciona sem auditoria', FOLLOWER_OF_CREATOR: 'Seguidores', MUTUAL_FOLLOW_FRIENDS: 'Amigos', PUBLIC_TO_EVERYONE: 'Todo mundo (precisa de app auditado)' };
async function renderRedes() {
  const box = $('#cfg-redes');
  if (!box || !local) return;
  const r = await api('redes').catch(() => null);
  if (!r || !r.okHttp) { box.innerHTML = '<p class="dim">Indisponível.</p>'; return; }
  const ig = r.redes.instagram, tt = r.redes.tiktok;
  const sim = (b) => (b ? '<span class="ok">✓ configurado</span>' : '<span class="bad">✗ não configurado</span>');
  box.innerHTML = `
    <p class="dim">Os tokens ficam só neste computador (escritorio-ia/data/segredos.json) e nunca aparecem de volta aqui. Passo a passo completo em <b>docs/REDES.md</b>.</p>
    <details${ig.configurado ? '' : ' open'}><summary><b>Instagram</b> — ${sim(ig.configurado)}</summary>
      <ol class="dim passos"><li>Conta Instagram <b>Profissional</b> ligada a uma <b>Página do Facebook</b>.</li>
        <li>App no <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener">Meta for Developers</a> com instagram_basic, instagram_content_publish, pages_show_list, pages_read_engagement.</li>
        <li>Gere um token de <b>longa duração</b> (60 dias) e pegue o <b>IG user id</b> (número).</li></ol>
      <label class="dim">Token de acesso<input id="rs-ig-token" type="password" autocomplete="off" placeholder="${ig.configurado ? '•••••• (deixe vazio para manter)' : 'EAAG...'}"></label>
      <label class="dim">IG user id<input id="rs-ig-id" inputmode="numeric" autocomplete="off" placeholder="${ig.temIgUserId ? '•••••• (deixe vazio para manter)' : '1784...'}"></label>
      <div class="row wrap"><button type="button" data-rs="salvar-ig">Salvar Instagram</button>${ig.configurado ? '<button type="button" class="ghost" data-rs="remover-ig">Remover</button>' : ''}</div>
    </details>
    <details${tt.configurado ? '' : ' open'}><summary><b>TikTok</b> — ${sim(tt.configurado)}</summary>
      <ol class="dim passos"><li>App no <a href="https://developers.tiktok.com/apps" target="_blank" rel="noopener">TikTok for Developers</a> com o produto <b>Content Posting API</b>.</li>
        <li>Escopos <b>video.upload</b> (rascunho) e <b>video.publish</b> (postagem direta).</li>
        <li><b>Sem auditoria do app</b>, o TikTok só aceita postagem direta em <b>conta privada</b> e como <b>SELF_ONLY</b>. O modo rascunho manda o vídeo para a caixa de entrada do app e você finaliza no celular.</li></ol>
      <label class="dim">Modo<select id="rs-tt-modo">
        <option value="rascunho"${tt.modo === 'rascunho' ? ' selected' : ''}>Rascunho: vai para a caixa de entrada do app (você finaliza)</option>
        <option value="direct"${tt.modo === 'direct' ? ' selected' : ''}>Direto: publica sozinho (precisa de app auditado para ser público)</option></select></label>
      <label class="dim">Privacidade no modo direto<select id="rs-tt-priv">${Object.entries(PRIV).map(([k, v]) => `<option value="${k}"${tt.privacidade === k ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
      <label class="dim">Access token<input id="rs-tt-token" type="password" autocomplete="off" placeholder="${tt.configurado ? '•••••• (deixe vazio para manter)' : 'act....'}"></label>
      <details><summary>Renovação automática (opcional) ${tt.renovacao ? '<span class="ok">✓</span>' : ''}</summary>
        <label class="dim">Refresh token<input id="rs-tt-refresh" type="password" autocomplete="off"></label>
        <label class="dim">Client key<input id="rs-tt-ck" autocomplete="off"></label>
        <label class="dim">Client secret<input id="rs-tt-cs" type="password" autocomplete="off"></label></details>
      <div class="row wrap"><button type="button" data-rs="salvar-tt">Salvar TikTok</button>${tt.configurado ? '<button type="button" class="ghost" data-rs="remover-tt">Remover</button>' : ''}</div>
    </details>
    <label class="check"><input type="checkbox" id="rs-simular"${r.simular ? ' checked' : ''}> Modo de teste: sempre simular (não publica nada, mesmo com tokens)</label>
    <p class="dim">Sem nenhum token configurado, o escritório simula automaticamente.</p>
    <span id="rs-ok" class="ok" hidden>✓ salvo</span>`;
}

async function salvarRedes(qual) {
  const v = (s) => $(s)?.value.trim() || '';
  let body;
  if (qual === 'salvar-ig') body = { instagram: { token: v('#rs-ig-token'), igUserId: v('#rs-ig-id') } };
  else if (qual === 'remover-ig') { if (!confirm('Remover o token do Instagram?')) return; body = { instagram: { remover: true } }; }
  else if (qual === 'salvar-tt') body = { tiktok: { token: v('#rs-tt-token'), modo: v('#rs-tt-modo'), privacidade: v('#rs-tt-priv'), refreshToken: v('#rs-tt-refresh'), clientKey: v('#rs-tt-ck'), clientSecret: v('#rs-tt-cs') } };
  else if (qual === 'remover-tt') { if (!confirm('Remover o token do TikTok?')) return; body = { tiktok: { remover: true } }; }
  else if (qual === 'simular') body = { simular: $('#rs-simular').checked };
  const r = await api('redes', body).catch((e) => ({ erro: e.message }));
  if (r.erro) return alert('Não salvou: ' + r.erro);
  await renderRedes();
  const ok = $('#rs-ok'); if (ok) { ok.hidden = false; setTimeout(() => (ok.hidden = true), 1500); }
  carregar();
}

// ---------------- Configurar → Agenda ----------------
async function renderAgenda() {
  const box = $('#cfg-agenda');
  if (!box || !local) return;
  const a = await api('agenda').catch(() => null);
  if (!a || !a.okHttp) { box.innerHTML = '<p class="dim">Indisponível.</p>'; return; }
  box.innerHTML = `
    <p class="dim">Nos horários abaixo, o escritório pede ao orquestrador: “Produza e publique o boletim gamer de agora”. Vídeos não críticos saem sozinhos; críticos esperam você na aba Produção. O computador precisa estar ligado com o escritório aberto.</p>
    <p>${a.ligada ? '<span class="ok">● ligada</span>' : '<span class="dim">⏸ pausada</span>'}${a.ultimo ? ` <span class="dim">· último disparo ${esc(a.ultimo)}</span>` : ''}</p>
    <div class="horarios">${(a.horarios.length ? a.horarios : ['09:00']).map((h) => `<span class="hora"><input type="time" value="${esc(h)}" aria-label="Horário"><button type="button" class="ghost small" data-ag="tirar" aria-label="Remover">✕</button></span>`).join('')}</div>
    <div class="row wrap"><button type="button" class="ghost" data-ag="mais">+ horário</button>
      <button type="button" data-ag="salvar">Salvar horários</button>
      <button type="button" class="ghost" data-ag="${a.ligada ? 'pausar' : 'ligar'}">${a.ligada ? '⏸ Pausar' : '▶ Ligar'}</button>
      <span id="ag-ok" class="ok" hidden>✓ salvo</span></div>`;
}
async function acaoAgenda(nome, btn) {
  const box = $('#cfg-agenda');
  if (nome === 'mais') { $('.horarios', box).insertAdjacentHTML('beforeend', '<span class="hora"><input type="time" value="18:00" aria-label="Horário"><button type="button" class="ghost small" data-ag="tirar" aria-label="Remover">✕</button></span>'); return; }
  if (nome === 'tirar') { btn.closest('.hora').remove(); return; }
  const horarios = [...box.querySelectorAll('input[type=time]')].map((i) => i.value).filter(Boolean);
  const body = nome === 'salvar' ? { horarios } : { horarios, ligada: nome === 'ligar' };
  const r = await api('agenda', body).catch((e) => ({ erro: e.message }));
  if (r.erro) return alert('Não salvou: ' + r.erro);
  await renderAgenda();
  const ok = $('#ag-ok'); if (ok) { ok.hidden = false; setTimeout(() => (ok.hidden = true), 1500); }
}

// ---------------- início ----------------
export function initProducao() {
  $('#prod-list')?.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-prod]');
    if (b) { ev.preventDefault(); acao(b.dataset.prod, b.dataset.id); }
  });
  $('#prod-aviso')?.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-prod]');
    if (b) { ev.preventDefault(); acao(b.dataset.prod); }
  });
  $('#cfg-redes')?.addEventListener('click', (ev) => { const b = ev.target.closest('[data-rs]'); if (b) salvarRedes(b.dataset.rs); });
  $('#cfg-redes')?.addEventListener('change', (ev) => { if (ev.target.id === 'rs-simular') salvarRedes('simular'); });
  $('#cfg-agenda')?.addEventListener('click', (ev) => { const b = ev.target.closest('[data-ag]'); if (b) acaoAgenda(b.dataset.ag, b); });
  $('#btn-settings')?.addEventListener('click', () => { if (!DEMO) { renderRedes(); renderAgenda(); } });
  addEventListener('escritorio:ws', (ev) => {
    const m = ev.detail;
    if (m?.type === 'producao') { dados = m; render(); }
  });
  addEventListener('escritorio:acesso', (ev) => { local = !!ev.detail?.local; render(); });
  if (DEMO) { $('#prod-list').innerHTML = '<p class="dim">A fila de produção precisa do servidor ligado.</p>'; return; }
  api('acesso').then((a) => { if (a.okHttp) local = !!a.local; }).catch(() => {}).finally(carregar);
  setInterval(() => { if (!document.hidden) carregar(); }, 30000);
}
