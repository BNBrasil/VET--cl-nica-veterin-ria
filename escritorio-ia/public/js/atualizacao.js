// Aviso de versão nova do escritório (no computador e no celular) e atualização com um toque.
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ADIAR = 'escritorio:atualizacao-adiada';

let estado = null;
let atualizando = false;

function adiada(remoto) {
  try { return localStorage.getItem(ADIAR) === String(remoto); } catch { return false; }
}

function render() {
  const bar = $('#atualizacao');
  if (!bar) return;
  if (atualizando) {
    bar.hidden = false;
    bar.innerHTML = `<b>⬆ Atualizando o escritório…</b> <span class="dim">baixando, instalando e reiniciando. A página recarrega sozinha.</span>`;
    return;
  }
  if (!estado || !estado.disponivel || adiada(estado.remoto)) {
    bar.hidden = !(estado && estado.erro && estado.erroVisivel);
    if (!bar.hidden) bar.innerHTML = `<b>⚠ Atualização:</b> ${esc(estado.erro)} <button type="button" class="ghost small" data-atu="fechar">OK</button>`;
    return;
  }
  const n = estado.commits?.length || 0;
  const lista = (estado.commits || []).slice(0, 8).map((c) => `<li>${esc(c.msg)}</li>`).join('');
  bar.hidden = false;
  bar.innerHTML = `<div class="atu-linha"><b>⬆ Nova versão do escritório disponível</b>
      <span class="dim">${n ? `${n} novidade${n > 1 ? 's' : ''}` : esc(estado.aviso || '')}</span>
      <span class="atu-botoes">${n ? '<button type="button" class="ghost small" data-atu="ver">Ver novidades</button>' : ''}
      <button type="button" class="small" data-atu="aplicar">Atualizar agora</button>
      <button type="button" class="ghost small" data-atu="depois">Depois</button></span></div>
    <ul class="atu-lista" hidden>${lista}${n > 8 ? `<li>… e mais ${n - 8}</li>` : ''}</ul>
    ${estado.alteradosLocalmente?.length ? `<p class="dim">Você alterou ${estado.alteradosLocalmente.length} arquivo(s) do projeto; eles serão mantidos (com cópia de segurança em data/).</p>` : ''}`;
}

async function aplicar() {
  if (!confirm('Baixar e instalar a versão nova agora? O escritório reinicia sozinho (leva menos de um minuto). Seus dados, chaves e vídeos não são mexidos.')) return;
  atualizando = true;
  render();
  try {
    const r = await fetch('/api/atualizacao/aplicar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
  } catch (e) {
    atualizando = false;
    estado = { ...estado, erro: 'Não consegui pedir a atualização: ' + e.message, erroVisivel: true };
    return render();
  }
  esperarReinicio();
}

// O servidor cai e volta com o código novo: quando voltar, recarrega a página.
function esperarReinicio() {
  let caiu = false;
  const inicio = Date.now();
  const tick = async () => {
    if (!atualizando) return;
    try {
      const r = await fetch('/api/acesso', { cache: 'no-store' });
      if (r.ok && caiu) { location.reload(); return; }
    } catch { caiu = true; }
    if (Date.now() - inicio > 5 * 60 * 1000) {
      atualizando = false;
      estado = { ...estado, erro: 'O escritório não voltou sozinho. Feche e abra de novo pelo INICIAR.bat.', erroVisivel: true };
      return render();
    }
    setTimeout(tick, 1500);
  };
  tick();
}

export function initAtualizacao() {
  const bar = $('#atualizacao');
  if (!bar || new URLSearchParams(location.search).get('demo') === '1') return;
  bar.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-atu]');
    if (!b) return;
    const a = b.dataset.atu;
    if (a === 'aplicar') aplicar();
    else if (a === 'ver') { const l = bar.querySelector('.atu-lista'); l.hidden = !l.hidden; }
    else if (a === 'depois') { try { localStorage.setItem(ADIAR, String(estado?.remoto)); } catch {} render(); }
    else if (a === 'fechar') { estado = { ...estado, erroVisivel: false }; render(); }
  });
  addEventListener('escritorio:ws', (ev) => {
    const m = ev.detail;
    if (m?.type !== 'atualizacao') return;
    const antes = estado;
    estado = m.estado;
    // erro durante uma atualização que ESTA página pediu: mostra
    if (atualizando && !estado.aplicando && estado.erro && antes?.aplicando) { atualizando = false; estado.erroVisivel = true; }
    render();
  });
  fetch('/api/atualizacao', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((e) => { if (e) { estado = e; render(); } }).catch(() => {});
}
