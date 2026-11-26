// TikTok: Content Posting API v2 (open.tiktokapis.com), envio do arquivo local (FILE_UPLOAD).
//
// Conferido em developers.tiktok.com (11/2026):
//   - creator_info:  POST /v2/post/publish/creator_info/query/  → privacy_level_options, max_video_post_duration_sec,
//                    creator_username, comment_disabled, duet_disabled, stitch_disabled
//   - Direct Post:   POST /v2/post/publish/video/init/        (escopo video.publish)  body { post_info, source_info }
//   - Rascunho:      POST /v2/post/publish/inbox/video/init/  (escopo video.upload)   body { source_info }
//                    → o vídeo vai para a caixa de entrada do app do TikTok e VOCÊ finaliza a postagem no celular.
//   - Upload:        PUT upload_url com Content-Range: bytes INICIO-FIM/TOTAL, Content-Type video/mp4 (206 = continua, 201 = fim)
//                    Pedaços de 5 MB a 64 MB (o último pode ter até 128 MB e absorve o resto); arquivo < 5 MB vai inteiro;
//                    total_chunk_count = floor(tamanho / chunk_size); de 1 a 1.000 pedaços; em ordem.
//   - Status:        POST /v2/post/publish/status/fetch/ { publish_id } → PROCESSING_UPLOAD | PROCESSING_DOWNLOAD |
//                    SEND_TO_USER_INBOX | PUBLISH_COMPLETE | FAILED (+ fail_reason, publicaly_available_post_id)
//   - Token:         POST /v2/oauth/token/ (grant_type=refresh_token, client_key, client_secret)
//
// LIMITES IMPORTANTES: app NÃO auditado só publica em conta PRIVADA e com privacidade SELF_ONLY (só você vê);
// o erro é "unaudited_client_can_only_post_to_private_accounts". Para posts públicos o app precisa passar na auditoria
// do TikTok. Cada token tem limite de ~6 inits por minuto. As diretrizes do TikTok pedem que o usuário escolha a
// privacidade (por isso ela vem de ⚙ Configurar → Redes sociais, e só é usada se o creator_info permitir).
// A CONFIRMAR com conta real: textos exatos de erro do seu app e o tempo de processamento.
//
// Credenciais: data/segredos.json → redes.tiktok { token, modo: "direct"|"rascunho", privacidade?, refreshToken?,
//              clientKey?, clientSecret?, expiraEm? }.
import { openSync, readSync, closeSync, statSync } from 'node:fs';
import { ErroRede, pedir, jsonDe, dormir, semSegredos } from './comum.js';

const API = 'https://open.tiktokapis.com';
const MB = 1024 * 1024;
export const CHUNK_MIN = 5 * MB;
export const CHUNK_MAX = 64 * MB;
export const CHUNK_PADRAO = 10 * MB;
export const LIMITE_TITULO = 2200;
const PRIVACIDADES = ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY'];

/** Divide o arquivo conforme as regras da API. Retorna { chunkSize, total, partes: [{inicio, fim}] } (fim inclusivo). */
export function planejarPedacos(tamanho, preferido = CHUNK_PADRAO) {
  if (!(tamanho > 0)) throw new ErroRede('Arquivo de vídeo vazio.');
  if (tamanho < CHUNK_MIN) return { chunkSize: tamanho, total: 1, partes: [{ inicio: 0, fim: tamanho - 1 }] };
  const chunkSize = Math.min(Math.max(preferido, CHUNK_MIN), CHUNK_MAX, tamanho);
  const total = Math.floor(tamanho / chunkSize);
  if (total > 1000) throw new ErroRede('Vídeo grande demais para o TikTok (mais de 1.000 pedaços).');
  const partes = [];
  for (let i = 0; i < total; i++) partes.push({ inicio: i * chunkSize, fim: i === total - 1 ? tamanho - 1 : (i + 1) * chunkSize - 1 });
  if (partes[total - 1].fim - partes[total - 1].inicio + 1 > 128 * MB) throw new ErroRede('Último pedaço passaria de 128 MB.');
  return { chunkSize, total, partes };
}

export function montarTitulo(legenda = '', hashtags = []) {
  const tags = [...new Set((hashtags || []).map((h) => String(h).trim()).filter(Boolean).map((h) => (h.startsWith('#') ? h : '#' + h)))];
  let t = String(legenda || '').trim();
  if (tags.length) t += (t ? '\n\n' : '') + tags.join(' ');
  return [...t].slice(0, LIMITE_TITULO).join('');
}

/** Escolhe a privacidade: a configurada, se o creator_info permitir; senão SELF_ONLY se existir; senão a primeira opção. */
export function escolherPrivacidade(opcoes = [], preferida) {
  const ops = (Array.isArray(opcoes) ? opcoes : []).filter((o) => PRIVACIDADES.includes(o));
  if (preferida && ops.includes(preferida)) return preferida;
  if (!preferida && ops.includes('PUBLIC_TO_EVERYONE')) return 'PUBLIC_TO_EVERYONE';
  if (ops.includes('SELF_ONLY')) return 'SELF_ONLY';
  return ops[0] || 'SELF_ONLY';
}

const FALHAS = {
  file_format_check_failed: 'formato do arquivo recusado',
  duration_check_failed: 'duração fora do permitido',
  frame_rate_check_failed: 'taxa de quadros recusada',
  picture_size_check_failed: 'resolução recusada',
  internal: 'erro interno do TikTok (tente de novo)',
  publish_cancelled: 'publicação cancelada',
  auth_removed: 'o acesso do app foi removido da conta',
  spam_risk_too_many_posts: 'muitas postagens hoje (limite do TikTok)',
  spam_risk_user_banned_from_posting: 'conta impedida de postar',
  spam_risk_text: 'o texto foi considerado spam',
  spam_risk: 'considerado spam pelo TikTok',
};
const ERROS = {
  access_token_invalid: 'Token do TikTok inválido ou expirado. Gere outro (docs/REDES.md) ou configure o refresh token.',
  scope_not_authorized: 'O token não tem o escopo necessário (video.publish para Direct Post, video.upload para rascunho).',
  unaudited_client_can_only_post_to_private_accounts: 'App não auditado: o TikTok só deixa postar em conta PRIVADA (e só SELF_ONLY). Deixe a conta privada para testar, use o modo rascunho, ou peça a auditoria do app.',
  privacy_level_option_mismatch: 'A privacidade escolhida não está entre as permitidas para esta conta.',
  spam_risk_too_many_posts: 'Limite diário de postagens pela API atingido.',
  spam_risk_too_many_pending_share: 'Há rascunhos demais pendentes na caixa de entrada do TikTok. Finalize ou apague alguns no app.',
  rate_limit_exceeded: 'Muitas chamadas seguidas ao TikTok. Espere um minuto.',
  reached_active_user_cap: 'O app atingiu o limite diário de usuários (comum em apps não auditados).',
  url_ownership_unverified: 'Domínio não verificado (só para PULL_FROM_URL).',
};

function erroApi(j, status, oQue, segredos) {
  const e = j?.error || {};
  const msg = ERROS[e.code] || null;
  const detalhe = semSegredos(e.message || j?._texto || `HTTP ${status}`, segredos);
  return new ErroRede(`TikTok (${oQue}): ${msg ? msg + ' ' : ''}[${e.code || status}: ${detalhe}]`, { codigo: e.code, temporario: status >= 500 || e.code === 'rate_limit_exceeded' });
}

async function chamar(f, caminho, token, body, oQue, segredos) {
  const res = await pedir(f, API + caminho, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' }, body: JSON.stringify(body ?? {}),
  }, { oQue: 'o TikTok', timeoutMs: 30000 });
  const j = await jsonDe(res);
  const ok = res.ok && (!j.error || j.error.code === 'ok' || j.error.code === '');
  if (!ok) throw erroApi(j, res.status, oQue, segredos);
  return j.data || {};
}

/** Renova o token com refresh_token + client_key/secret (se configurados). Retorna o patch salvo ou null. */
export async function renovarToken(cred, f = globalThis.fetch) {
  if (!cred?.refreshToken || !cred?.clientKey || !cred?.clientSecret) return null;
  const res = await pedir(f, `${API}/v2/oauth/token/`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
    body: new URLSearchParams({ client_key: cred.clientKey, client_secret: cred.clientSecret, grant_type: 'refresh_token', refresh_token: cred.refreshToken }).toString(),
  }, { oQue: 'o TikTok (renovar token)', timeoutMs: 20000 });
  const j = await jsonDe(res);
  if (!res.ok || !j.access_token) {
    throw new ErroRede(`TikTok: não consegui renovar o token (${semSegredos(j.error_description || j.error || j.message || res.status, [cred.refreshToken, cred.clientSecret])}). Gere um novo login.`);
  }
  return {
    token: j.access_token,
    refreshToken: j.refresh_token || cred.refreshToken,
    expiraEm: Date.now() + (Number(j.expires_in) || 86400) * 1000,
  };
}

function lerPedaco(arquivo, inicio, fim) {
  const buf = Buffer.alloc(fim - inicio + 1);
  const fd = openSync(arquivo, 'r');
  try { readSync(fd, buf, 0, buf.length, inicio); } finally { closeSync(fd); }
  return buf;
}

/**
 * Publica (direct) ou manda para a caixa de entrada (rascunho).
 * @param {object} a { arquivo, legenda, hashtags, duracao?, ia?, cred, salvarCred?(patch), fetch?, sleep?, log?, pollMax?, pollMs?, chunk? }
 * @returns {{ estado: 'publicado'|'rascunho', id, url, privacidade?, aviso? }}
 */
export async function publicar(a) {
  const f = a.fetch || globalThis.fetch;
  const sleep = a.sleep || dormir;
  const log = a.log || (() => {});
  let cred = { ...(a.cred || {}) };
  if (!cred.token) throw new ErroRede('TikTok não configurado: falta o token (⚙ Configurar → Redes sociais).');
  const modo = cred.modo === 'direct' ? 'direct' : 'rascunho';

  // token vencido? renova antes
  if (cred.expiraEm && Date.now() > cred.expiraEm - 5 * 60 * 1000) {
    const novo = await renovarToken(cred, f);
    if (novo) { cred = { ...cred, ...novo }; a.salvarCred?.(novo); log('[tiktok] token renovado'); }
  }
  const segredos = () => [cred.token, cred.refreshToken, cred.clientSecret];

  // chama; se o token estiver inválido e houver refresh, renova uma vez e repete
  const com = async (caminho, body, oQue) => {
    try { return await chamar(f, caminho, cred.token, body, oQue, segredos()); } catch (e) {
      if (e.codigo !== 'access_token_invalid') throw e;
      const novo = await renovarToken(cred, f);
      if (!novo) throw e;
      cred = { ...cred, ...novo }; a.salvarCred?.(novo); log('[tiktok] token renovado');
      return chamar(f, caminho, cred.token, body, oQue, segredos());
    }
  };

  const tamanho = statSync(a.arquivo).size;
  const plano = planejarPedacos(tamanho, a.chunk);
  const source_info = { source: 'FILE_UPLOAD', video_size: tamanho, chunk_size: plano.chunkSize, total_chunk_count: plano.total };

  let usuario = null, privacidade = null, init;
  if (modo === 'direct') {
    const info = await com('/v2/post/publish/creator_info/query/', {}, 'consultar o criador');
    usuario = info.creator_username || null;
    if (info.max_video_post_duration_sec && a.duracao && a.duracao > info.max_video_post_duration_sec) {
      throw new ErroRede(`TikTok: o vídeo tem ${Math.round(a.duracao)} s e esta conta aceita até ${info.max_video_post_duration_sec} s.`);
    }
    privacidade = escolherPrivacidade(info.privacy_level_options, cred.privacidade);
    init = await com('/v2/post/publish/video/init/', {
      post_info: {
        title: montarTitulo(a.legenda, a.hashtags), privacy_level: privacidade,
        disable_duet: !!info.duet_disabled, disable_comment: !!info.comment_disabled, disable_stitch: !!info.stitch_disabled,
        video_cover_timestamp_ms: 1000, is_aigc: a.ia !== false,
      },
      source_info,
    }, 'iniciar postagem');
  } else {
    init = await com('/v2/post/publish/inbox/video/init/', { source_info }, 'iniciar envio de rascunho');
  }
  const publishId = init.publish_id;
  const uploadUrl = init.upload_url;
  if (!publishId || typeof uploadUrl !== 'string' || !uploadUrl.startsWith('https://')) throw new ErroRede('TikTok não devolveu o endereço de upload.');
  log(`[tiktok] enviando ${(tamanho / 1e6).toFixed(1)} MB em ${plano.total} pedaço(s)`);

  for (const [i, p] of plano.partes.entries()) {
    const corpo = lerPedaco(a.arquivo, p.inicio, p.fim);
    let tentativa = 0;
    for (;;) {
      const res = await pedir(f, uploadUrl, {
        method: 'PUT', body: corpo,
        headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(corpo.length), 'Content-Range': `bytes ${p.inicio}-${p.fim}/${tamanho}` },
      }, { oQue: 'o upload do TikTok', timeoutMs: 5 * 60 * 1000 });
      if (res.status === 201 || res.status === 206 || res.ok) break;
      if (res.status >= 500 && tentativa++ < 3) { await sleep(2000 * tentativa); continue; }
      const motivo = { 400: 'cabeçalhos inválidos', 403: 'o link de upload expirou (vale 1 h)', 404: 'upload não encontrado', 416: 'pedaço fora de ordem' }[res.status] || `HTTP ${res.status}`;
      throw new ErroRede(`TikTok: falha ao enviar o pedaço ${i + 1}/${plano.total}: ${motivo}.`);
    }
  }

  // acompanha o processamento
  const alvo = modo === 'direct' ? 'PUBLISH_COMPLETE' : 'SEND_TO_USER_INBOX';
  const pollMax = a.pollMax ?? 40;
  let espera = a.pollMs ?? 3000;
  let st = {};
  for (let i = 0; i < pollMax; i++) {
    await sleep(espera);
    st = await com('/v2/post/publish/status/fetch/', { publish_id: publishId }, 'consultar status');
    if (st.status === alvo || st.status === 'PUBLISH_COMPLETE') break;
    if (st.status === 'FAILED') throw new ErroRede(`TikTok recusou o vídeo: ${FALHAS[st.fail_reason] || st.fail_reason || 'sem detalhe'}.`);
    espera = Math.min(15000, Math.round(espera * 1.5));
  }
  if (st.status !== alvo && st.status !== 'PUBLISH_COMPLETE') throw new ErroRede('O TikTok demorou demais para processar. Confira no app; se não aparecer, tente de novo.', { temporario: true });

  if (modo === 'rascunho') {
    return { estado: 'rascunho', id: publishId, url: null, aviso: 'Enviado para a caixa de entrada do app do TikTok: abra o app e finalize a postagem.' };
  }
  const postId = Array.isArray(st.publicaly_available_post_id) ? st.publicaly_available_post_id[0] : null;
  const url = postId && usuario ? `https://www.tiktok.com/@${usuario}/video/${postId}` : null;
  return {
    estado: 'publicado', id: postId ? String(postId) : publishId, url, privacidade,
    aviso: privacidade === 'SELF_ONLY' ? 'Publicado como privado (SELF_ONLY): só você vê. Para público, o app precisa ser auditado pelo TikTok.' : (url ? undefined : 'Publicado; o link aparece depois da moderação do TikTok.'),
  };
}

export function planejar(a) {
  const tamanho = statSync(a.arquivo).size;
  const plano = planejarPedacos(tamanho, a.chunk);
  const modo = a.cred?.modo === 'direct' ? 'direct' : 'rascunho';
  return {
    modo, tamanho, chunk_size: plano.chunkSize, total_chunk_count: plano.total, titulo: montarTitulo(a.legenda, a.hashtags),
    endpoint: modo === 'direct' ? '/v2/post/publish/video/init/' : '/v2/post/publish/inbox/video/init/',
    privacidadePreferida: a.cred?.privacidade || null, credenciais: !!a.cred?.token,
  };
}
