// Descobre a data (e o horário) de cada vídeo bruto. Funções puras, sem tocar em disco.
// Ordem de prioridade (vlog/CONTRATO.md, seção 1):
//   1. nome da subpasta (AAAA-MM-DD, DD-MM-AAAA e variações)
//   2. padrão no nome do arquivo (Android, iPhone, Pixel, Samsung, WhatsApp, OBS, DJI, Telegram...)
//   3. metadado creation_time do ffprobe, no fuso local (GoPro/DJI gravam a hora local marcada como UTC)
//   4. data de modificação do arquivo (incerta: avisa no relatório)

const p2 = (n) => String(n).padStart(2, '0');

function dataValida(a, m, d) {
  a = +a; m = +m; d = +d;
  if (a < 1990 || a > 2099 || m < 1 || m > 12 || d < 1) return false;
  const dias = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return d <= dias;
}

function horaValida(h, mi, s) {
  return +h >= 0 && +h <= 23 && +mi >= 0 && +mi <= 59 && +(s ?? 0) >= 0 && +(s ?? 0) <= 59;
}

function montar(a, m, d, h, mi, s) {
  if (!dataValida(a, m, d)) return null;
  const r = { data: `${a}-${p2(m)}-${p2(d)}`, hora: null };
  if (h != null && mi != null && horaValida(h, mi, s)) r.hora = `${p2(h)}:${p2(mi)}:${p2(s ?? 0)}`;
  return r;
}

// "3.30.12 PM" -> 15
function hora12(h, ampm) {
  h = +h;
  if (!ampm) return h;
  const pm = /^p/i.test(ampm);
  if (h === 12) return pm ? 12 : 0;
  return pm ? h + 12 : h;
}

// Câmeras que não carregam data no nome: a data vem do metadado.
const SEM_DATA_NO_NOME = [
  /^G[HXSL]\d{6}/i, // GoPro HERO6+ (GH010123, GX010123)
  /^GOPR\d{4}/i, /^GP\d{6}/i, // GoPro antigas
  /^DJI_\d{4}(?!\d)/i, // DJI antigo (DJI_0001)
  /^(IMG|MVI|MOV|DSC|DSCF|P\d{3}|C\d{4})_?\d{4}(?!\d)/i, // iPhone (IMG_1234), Canon, Sony, Fuji, Panasonic
];

/** É um nome de câmera que, sabidamente, não traz data (GoPro, DJI antigo, IMG_1234 do iPhone...). */
export function nomeSemData(nome) {
  return SEM_DATA_NO_NOME.some((re) => re.test(nome));
}

/** Câmeras que gravam creation_time com a hora LOCAL mas marcada como UTC ("Z"). */
export function gravaHoraLocalComoUtc(nome) {
  return /^(G[HXSL]\d{6}|GOPR\d{4}|GP\d{6}|DJI_)/i.test(nome);
}

// Padrões de nome de arquivo, do mais específico para o mais genérico.
// Cada um devolve [ano, mes, dia, hora?, min?, seg?].
const PADROES_NOME = [
  // WhatsApp (exportado/salvo): "WhatsApp Video 2025-11-24 at 15.30.12" ou "... at 3.30.12 PM"
  {
    re: /whatsapp (?:video|image|v[ií]deo)? ?(\d{4})-(\d{2})-(\d{2}) at (\d{1,2})[.:](\d{2})[.:](\d{2})(?:\s*([AP]M))?/i,
    f: (m) => [m[1], m[2], m[3], hora12(m[4], m[7]), m[5], m[6]],
  },
  // WhatsApp Android: "VID-20251124-WA0003" (só a data)
  { re: /(?:VID|IMG|AUD|PTT)-(\d{4})(\d{2})(\d{2})-WA\d+/i, f: (m) => [m[1], m[2], m[3]] },
  // DJI novo: "DJI_20251124153012_0001_D"
  { re: /DJI_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/i, f: (m) => m.slice(1, 7) },
  // AAAA-MM-DD hh.mm.ss | hh-mm-ss | hh_mm_ss | hh:mm:ss  (Dropbox, OBS "2025-11-24 15-30-12",
  // Telegram "video_2025-11-24_15-30-12", gravador de tela "2025-11-24-15-30-12", iOS "2025-11-24 at 15.30.12")
  {
    re: /(?<!\d)(\d{4})[-_.](\d{2})[-_.](\d{2})(?:[ _T-]|\s+at\s+|\s*às\s*)(\d{2})[-_.:h](\d{2})[-_.:m](\d{2})(?!\d)/i,
    f: (m) => m.slice(1, 7),
  },
  // AAAAMMDD_hhmmss / AAAAMMDD-hhmmss / AAAAMMDDThhmmss (VID_, IMG_, PXL_, MVIMG_, InShot_, Samsung "20251124_153012",
  // gravador de tela "Screen_Recording_20251124-153012"); PXL tem milissegundos colados (153012345)
  {
    re: /(?<!\d)(\d{4})(\d{2})(\d{2})[_\-T ](\d{2})(\d{2})(\d{2})(?:\d{0,3})(?!\d)/,
    f: (m) => m.slice(1, 7),
  },
  // 14 dígitos colados: "VID20251124153012" (Oppo/Realme/Xiaomi), "20251124153012"
  { re: /(?<!\d)(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?!\d)/, f: (m) => m.slice(1, 7) },
  // Só a data com separador: "2025-11-24", "2025_11_24", "Gravação 2025.11.24"
  { re: /(?<!\d)(\d{4})[-_.](\d{2})[-_.](\d{2})(?!\d)/, f: (m) => m.slice(1, 4) },
  // Só a data colada com prefixo de câmera: "IMG_20251124", "VID_20251124", "PXL_20251124"
  { re: /(?:^|[^a-z0-9])(?:VID|IMG|PXL|MVIMG|MOV|REC|Video|Record)[_-]?(\d{4})(\d{2})(\d{2})(?!\d)/i, f: (m) => m.slice(1, 4) },
  // DD-MM-AAAA (com hora opcional): "24-11-2025 15.30.12", "24.11.2025"
  {
    re: /(?<!\d)(\d{2})[-_.](\d{2})[-_.](\d{4})(?:[ _-](\d{2})[-_.:h](\d{2})(?:[-_.:m](\d{2}))?)?(?!\d)/,
    f: (m) => [m[3], m[2], m[1], m[4], m[5], m[6]],
  },
];

/** Data/hora a partir do nome do arquivo. Retorna { data, hora|null } ou null. */
export function dataDoNome(nomeArquivo) {
  const nome = String(nomeArquivo).replace(/^.*[\\/]/, '');
  if (nomeSemData(nome) && !/(\d{8})/.test(nome)) return null;
  for (const { re, f } of PADROES_NOME) {
    const m = nome.match(re);
    if (!m) continue;
    const [a, mes, d, h, mi, s] = f(m);
    const r = montar(a, mes, d, h, mi, s);
    if (r) return r;
  }
  return null;
}

// Pastas: "2025-11-24", "2025_11_24", "20251124", "24-11-2025", "24.11.2025", aceitando texto depois
// ("2025-11-24 Ouro Preto") ou antes ("Dia 3 - 2025-11-24").
const PADROES_PASTA = [
  { re: /(?<!\d)(\d{4})[-_.](\d{2})[-_.](\d{2})(?!\d)/, f: (m) => [m[1], m[2], m[3]] },
  { re: /(?<!\d)(\d{2})[-_.](\d{2})[-_.](\d{4})(?!\d)/, f: (m) => [m[3], m[2], m[1]] },
  { re: /^(\d{4})(\d{2})(\d{2})(?!\d)/, f: (m) => [m[1], m[2], m[3]] },
];

/** Data da subpasta mais próxima do arquivo que tenha uma data. `caminhoRelativo` é relativo à pasta dos brutos. */
export function dataDaPasta(caminhoRelativo) {
  const partes = String(caminhoRelativo).split(/[\\/]+/).filter(Boolean);
  partes.pop(); // o próprio arquivo
  for (let i = partes.length - 1; i >= 0; i--) {
    for (const { re, f } of PADROES_PASTA) {
      const m = partes[i].match(re);
      if (!m) continue;
      const r = montar(...f(m));
      if (r) return r.data;
    }
  }
  return null;
}

/** Converte um Date para { data, hora } no fuso local (ou no deslocamento `fusoMin`, minutos a leste de UTC). */
export function dataLocal(dt, fusoMin) {
  if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return null;
  if (fusoMin == null) {
    return {
      data: `${dt.getFullYear()}-${p2(dt.getMonth() + 1)}-${p2(dt.getDate())}`,
      hora: `${p2(dt.getHours())}:${p2(dt.getMinutes())}:${p2(dt.getSeconds())}`,
    };
  }
  const x = new Date(dt.getTime() + fusoMin * 60000);
  return {
    data: `${x.getUTCFullYear()}-${p2(x.getUTCMonth() + 1)}-${p2(x.getUTCDate())}`,
    hora: `${p2(x.getUTCHours())}:${p2(x.getUTCMinutes())}:${p2(x.getUTCSeconds())}`,
  };
}

/**
 * Data a partir dos metadados do ffprobe (format.tags + streams[].tags).
 * - `com.apple.quicktime.creationdate` (iPhone) já vem com o fuso de quem gravou: usa a hora escrita.
 * - `creation_time` (UTC) é convertido para o fuso local; GoPro/DJI gravam a hora local com "Z": usa como está.
 * - Ignora datas "zeradas" (1904/1970) que alguns apps escrevem.
 */
export function dataDoMetadado(tags = {}, { nomeArquivo = '', fusoMin } = {}) {
  const apple = tags['com.apple.quicktime.creationdate'];
  if (apple) {
    const m = String(apple).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
    if (m) {
      const r = montar(...m.slice(1, 7));
      if (r && +m[1] > 1990) return r;
    }
  }
  const ct = tags.creation_time || tags.date || tags['creation_time'];
  if (!ct) return null;
  const s = String(ct).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
  if (!m || +m[1] <= 1990) return null;
  if (gravaHoraLocalComoUtc(String(nomeArquivo).replace(/^.*[\\/]/, ''))) return montar(...m.slice(1, 7));
  // Sem indicação de fuso => o padrão do QuickTime/MP4 é UTC.
  const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? s : s.replace(' ', 'T') + 'Z';
  return dataLocal(new Date(iso), fusoMin);
}

/** Junta as tags do formato e dos streams (a primeira que tiver o campo vence). */
export function tagsDoProbe(probe) {
  const tags = { ...(probe?.format?.tags || {}) };
  for (const st of probe?.streams || []) {
    for (const [k, v] of Object.entries(st.tags || {})) if (tags[k] == null) tags[k] = v;
  }
  // ffprobe às vezes devolve as chaves com maiúsculas diferentes
  for (const k of Object.keys(tags)) {
    const kl = k.toLowerCase();
    if (tags[kl] == null) tags[kl] = tags[k];
  }
  return tags;
}

/**
 * Descobre a data de um clipe.
 * @param {object} o
 * @param {string} o.caminhoRelativo  caminho relativo à pasta dos brutos (com subpastas)
 * @param {object} [o.tags]           tags do ffprobe (tagsDoProbe)
 * @param {number|Date} [o.mtime]     data de modificação do arquivo
 * @param {number} [o.fusoMin]        fuso fixo (testes); padrão: fuso do computador
 * @returns {{data:string, hora:string|null, fonte:'pasta'|'nome'|'metadado'|'mtime', incerta:boolean}|null}
 */
export function descobrirData({ caminhoRelativo, tags, mtime, fusoMin } = {}) {
  const nome = String(caminhoRelativo || '').replace(/^.*[\\/]/, '');
  const doNome = dataDoNome(nome);
  const doMeta = tags ? dataDoMetadado(tags, { nomeArquivo: nome, fusoMin }) : null;
  const doMtime = mtime != null ? dataLocal(mtime instanceof Date ? mtime : new Date(mtime), fusoMin) : null;
  const daPasta = dataDaPasta(caminhoRelativo || '');

  // horário: o mais confiável que concorde com a data escolhida
  const horaPara = (data) => {
    for (const c of [doNome, doMeta, doMtime]) if (c && c.data === data && c.hora) return c.hora;
    return null;
  };

  if (daPasta) return { data: daPasta, hora: horaPara(daPasta), fonte: 'pasta', incerta: false };
  if (doNome) return { data: doNome.data, hora: horaPara(doNome.data), fonte: 'nome', incerta: false };
  if (doMeta) return { data: doMeta.data, hora: doMeta.hora, fonte: 'metadado', incerta: false };
  if (doMtime) return { data: doMtime.data, hora: doMtime.hora, fonte: 'mtime', incerta: true };
  return null;
}

/** "15:30:12" -> 55812 segundos (null => Infinity, vai para o fim). */
export function segundosDoDia(hora) {
  if (!hora) return Infinity;
  const [h, m, s] = hora.split(':').map(Number);
  return h * 3600 + m * 60 + (s || 0);
}

/**
 * Agrupa itens { data, hora, nome } por data. Datas em ordem crescente; dentro do dia, pelo horário
 * (sem horário vai para o fim) e depois pelo nome (ordem natural: VID2 < VID10).
 * @returns {Map<string, object[]>}
 */
export function agruparPorData(itens) {
  const cmpNome = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' }).compare;
  const mapa = new Map();
  for (const it of itens) {
    if (!it?.data) continue;
    if (!mapa.has(it.data)) mapa.set(it.data, []);
    mapa.get(it.data).push(it);
  }
  const ordenado = new Map([...mapa.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  for (const lista of ordenado.values()) {
    lista.sort((a, b) => segundosDoDia(a.hora) - segundosDoDia(b.hora) || cmpNome(a.nome || '', b.nome || ''));
  }
  return ordenado;
}
