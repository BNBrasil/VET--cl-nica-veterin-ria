// Instagram: publica um Reel pela Instagram Graph API (conta Profissional ligada a uma Página do Facebook).
//
// Fluxo (developers.facebook.com/docs/instagram-platform/content-publishing/resumable-uploads, conferido em 11/2026):
//   1. POST graph.facebook.com/<versão>/<IG_USER_ID>/media  media_type=REELS, upload_type=resumable, caption, [cover_url]
//      → { id (container), uri }
//   2. POST rupload.facebook.com/ig-api-upload/<versão>/<container>  (corpo = arquivo)
//      headers: Authorization: OAuth <token>, offset: 0, file_size: <bytes>
//   3. GET  /<container>?fields=status_code,status  até FINISHED (poll com backoff e limite)
//   4. POST /<IG_USER_ID>/media_publish  creation_id=<container>  → { id (mídia) }
//   5. GET  /<mídia>?fields=permalink
// Versão da API: v27.0 (a mais recente no changelog em 11/2026); dá para trocar em redes.instagram.versao.
// A CONFIRMAR com conta real: limites de publicação por 24 h da sua conta e se cover_url é aceito do seu host.
//
// Credenciais: data/segredos.json → redes.instagram { token, igUserId, versao? }.
// O token vai sempre em header (nunca na URL) e nunca é registrado em log.
import { readFileSync, statSync } from 'node:fs';
import { ErroRede, pedir, jsonDe, dormir, semSegredos } from './comum.js';

export const VERSAO_PADRAO = 'v27.0';
const GRAPH = 'https://graph.facebook.com';
const RUPLOAD = 'https://rupload.facebook.com/ig-api-upload';
export const LIMITE_LEGENDA = 2200;
export const LIMITE_HASHTAGS = 30;

/** Legenda + hashtags dentro dos limites do Instagram (2.200 caracteres, 30 hashtags). */
export function montarLegenda(legenda = '', hashtags = []) {
  const tags = [...new Set((hashtags || []).map((h) => String(h).trim()).filter(Boolean).map((h) => (h.startsWith('#') ? h : '#' + h)))];
  const noTexto = (String(legenda).match(/#[\p{L}\p{N}_]+/gu) || []).length;
  const cabem = tags.slice(0, Math.max(0, LIMITE_HASHTAGS - noTexto));
  let texto = String(legenda || '').trim();
  if (cabem.length) texto += (texto ? '\n\n' : '') + cabem.join(' ');
  return [...texto].slice(0, LIMITE_LEGENDA).join('');
}

const ERROS = {
  190: 'Token do Instagram inválido ou expirado. Gere um novo token de longa duração (veja docs/REDES.md) e salve em ⚙ Configurar → Redes sociais.',
  10: 'O app não tem permissão para publicar. Confira as permissões instagram_basic e instagram_content_publish.',
  200: 'Permissão negada pelo Instagram. Confira instagram_content_publish e se a conta é Profissional ligada à Página.',
  100: 'Pedido recusado pelo Instagram (parâmetro inválido). Confira o IG user id.',
  4: 'Limite de chamadas do app atingido. Tente mais tarde.',
  17: 'Limite de chamadas da conta atingido. Tente mais tarde.',
  32: 'Limite de chamadas da Página atingido. Tente mais tarde.',
  9: 'Limite de publicações atingido. Tente mais tarde.',
  9007: 'O vídeo ainda não terminou de processar no Instagram.',
  2207026: 'O Instagram não aceitou o formato do vídeo (confira 9:16, H.264, AAC, até 90 s).',
};

function erroGraph(j, status, oQue, token) {
  const e = j?.error || {};
  const msg = ERROS[e.code] || ERROS[e.error_subcode] || null;
  const detalhe = semSegredos(e.error_user_msg || e.message || j?._texto || `HTTP ${status}`, [token]);
  return new ErroRede(`Instagram (${oQue}): ${msg ? msg + ' ' : ''}[${detalhe}]`, { codigo: e.code, temporario: [4, 17, 32, 9007].includes(e.code) || status >= 500 });
}

/**
 * Publica um Reel. Retorna { estado: 'publicado', id, url }.
 * @param {object} a { arquivo, legenda, hashtags, capaUrl?, cred: {token, igUserId, versao?}, fetch?, sleep?, log?, pollMax?, pollMs? }
 */
export async function publicar(a) {
  const f = a.fetch || globalThis.fetch;
  const sleep = a.sleep || dormir;
  const log = a.log || (() => {});
  const { token, igUserId } = a.cred || {};
  if (!token || !igUserId) throw new ErroRede('Instagram não configurado: falta o token ou o IG user id (⚙ Configurar → Redes sociais).');
  if (!/^\d{5,25}$/.test(String(igUserId))) throw new ErroRede('IG user id inválido (deve ser só números).');
  const versao = /^v\d{2}\.\d$/.test(a.cred.versao || '') ? a.cred.versao : VERSAO_PADRAO;
  const tamanho = statSync(a.arquivo).size;
  const auth = { Authorization: `OAuth ${token}` };

  // 1. container
  const params = new URLSearchParams({ media_type: 'REELS', upload_type: 'resumable', caption: montarLegenda(a.legenda, a.hashtags) });
  if (a.capaUrl && /^https:\/\//.test(a.capaUrl)) params.set('cover_url', a.capaUrl);
  if (a.compartilharNoFeed === false) params.set('share_to_feed', 'false');
  let res = await pedir(f, `${GRAPH}/${versao}/${igUserId}/media`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString(),
  }, { oQue: 'o Instagram', timeoutMs: 30000 });
  let j = await jsonDe(res);
  if (!res.ok || !j.id) throw erroGraph(j, res.status, 'criar container', token);
  const container = String(j.id);
  const uri = typeof j.uri === 'string' && j.uri.startsWith('https://rupload.facebook.com/') ? j.uri : `${RUPLOAD}/${versao}/${container}`;
  log(`[instagram] container ${container} criado; enviando ${(tamanho / 1e6).toFixed(1)} MB`);

  // 2. upload resumable do arquivo local
  res = await pedir(f, uri, {
    method: 'POST', headers: { ...auth, offset: '0', file_size: String(tamanho), 'Content-Type': 'application/octet-stream' },
    body: readFileSync(a.arquivo),
  }, { oQue: 'o servidor de upload do Instagram', timeoutMs: 10 * 60 * 1000 });
  j = await jsonDe(res);
  if (!res.ok || j.success === false) throw erroGraph(j, res.status, 'upload do vídeo', token);

  // 3. espera o processamento (backoff 3 s → 15 s, no máximo ~pollMax tentativas)
  const pollMax = a.pollMax ?? 40;
  let espera = a.pollMs ?? 3000;
  let status = '';
  for (let i = 0; i < pollMax; i++) {
    await sleep(espera);
    res = await pedir(f, `${GRAPH}/${versao}/${container}?fields=status_code,status`, { headers: auth }, { oQue: 'o Instagram', timeoutMs: 20000 });
    j = await jsonDe(res);
    if (!res.ok) throw erroGraph(j, res.status, 'status do processamento', token);
    status = j.status_code;
    if (status === 'FINISHED') break;
    if (status === 'ERROR' || status === 'EXPIRED') {
      throw new ErroRede(`Instagram recusou o vídeo no processamento (${status}): ${semSegredos(j.status || 'sem detalhe', [token])}`);
    }
    espera = Math.min(15000, Math.round(espera * 1.5));
  }
  if (status !== 'FINISHED') throw new ErroRede('O Instagram demorou demais para processar o vídeo. Tente "Postar agora" de novo mais tarde.', { temporario: true });

  // 4. publica
  res = await pedir(f, `${GRAPH}/${versao}/${igUserId}/media_publish`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ creation_id: container }).toString(),
  }, { oQue: 'o Instagram', timeoutMs: 60000 });
  j = await jsonDe(res);
  if (!res.ok || !j.id) throw erroGraph(j, res.status, 'publicar', token);
  const id = String(j.id);

  // 5. link público
  let url = null;
  try {
    res = await pedir(f, `${GRAPH}/${versao}/${id}?fields=permalink`, { headers: auth }, { oQue: 'o Instagram', timeoutMs: 20000 });
    j = await jsonDe(res);
    if (res.ok && typeof j.permalink === 'string') url = j.permalink;
  } catch {}
  return { estado: 'publicado', id, url };
}

/** O que seria enviado (para --simular), sem chamar a rede. */
export function planejar(a) {
  const tamanho = statSync(a.arquivo).size;
  const versao = /^v\d{2}\.\d$/.test(a.cred?.versao || '') ? a.cred.versao : VERSAO_PADRAO;
  return {
    versao, tamanho, media_type: 'REELS', upload_type: 'resumable', caption: montarLegenda(a.legenda, a.hashtags),
    cover_url: a.capaUrl && /^https:\/\//.test(a.capaUrl) ? a.capaUrl : null, credenciais: !!(a.cred?.token && a.cred?.igUserId),
  };
}
