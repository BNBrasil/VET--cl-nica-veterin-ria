// Aplica a configuração resolvida (art/tema.js) à paleta e devolve o "estilo" que o gerador usa:
// slots de cor do tema, família de destaque de cada sala, piso/parede por sala, aparência de cada personagem,
// iluminação (tinta global + mapa de "luz" para personagens e poças de luz) e a paleta final (≤ 64 cores).
import {
  BASE, BASE_ACCENT, ACCENT, SLOTS, resetPalette, defineColor, mapColors, hexOf, finalizarPaleta, MAX_COLORS,
} from './palette.js';
import { variacoes, escurecer, clarear, dist, luminance, ajustar, multiply, norm, mix } from './cor.js';
import { LOOKS, PELES, HAIRS, STANDING } from './chars.js';
import { PELE_PADRAO } from './tema.js';

const PELES_ORIG = PELES.map((p) => [...p]);
const AGENTES = Object.keys(BASE_ACCENT);

// tintas de iluminação (multiplica, soma)
const TINTA = {
  tarde: [[1.0, 0.86, 0.72], [14, 2, 0]],
  noite: [[0.5, 0.54, 0.8], [10, 8, 26]],
};
/** Slots que continuam acesos à noite (luzes, telas, neon) e a pele (rostos legíveis). */
const ACESOS = new Set(['lamp', 'neon', 'yellowPale', 'greenLight', 'cyanLight', 'snow', 'skin', 'skinMid', 'skinDark', 'skinDeep', 'blush']);

/** Família de cabelo de cada estilo interno (para traduzir os valores do contrato). */
const FAMILIA = { curto: ['short', 'neat', 'messy'], longo: ['long', 'bob'], coque: ['bun'], careca: ['bald'], cacheado: ['curly'], moicano: ['mohawk'] };
const CHAPEUS = ['cap', 'beanie', 'beret'];
const ACC_DE = { oculos: 'glasses', fone: 'headphones', bone: 'cap', chapeu: 'beret', lapis: 'pencil' };

/** Rótulos do contrato para a aparência padrão (interface). */
export function rotulosPadrao(look) {
  const accs = look.accs || (look.acc ? [look.acc] : []);
  let cabelo = Object.keys(FAMILIA).find((k) => FAMILIA[k].includes(look.style)) || 'curto';
  if (accs.includes('cap')) cabelo = 'bone';
  else if (accs.includes('beanie')) cabelo = 'gorro';
  const a = accs.find((x) => ['glasses', 'headphones', 'beret', 'pencil'].includes(x));
  const acessorio = a ? Object.keys(ACC_DE).find((k) => ACC_DE[k] === a) : look.mustache ? 'bigode' : look.beard ? 'barba' : 'nenhum';
  return { cabelo, acessorio };
}

/**
 * Aplica cfg. Retorna { style, looks, iluminacao, litMap, merges, preTint }.
 * style = { iluminacao, salas: { id: { floor, wall, neon } }, plantas, lights: [] }.
 */
export function aplicarConfig(cfg) {
  resetPalette();
  PELES.length = 0; for (const p of PELES_ORIG) PELES.push([...p]);
  const P = cfg.paleta || {};
  // 1) sobrescritas da base (tema)
  for (const [n, h] of Object.entries(P.base || {})) if (n in BASE) defineColor(n, h, 2);

  // 2) destaques das salas
  const rooms = cfg.rooms;
  const nativo = Object.fromEntries([...rooms.rooms, ...rooms.common].map((r) => [r.id, norm(r.accent)]));
  for (const id of AGENTES) {
    const s = cfg.salas?.[id] || {};
    const custom = s.destaque && s.destaque !== nativo[id];
    if (custom || s.neon) {
      const v = custom ? variacoes(s.destaque) : Object.fromEntries(Object.entries(BASE_ACCENT[id]).map(([k, n]) => [k, hexOf(n)]));
      if (custom && luminance(hexOf(BASE_ACCENT[id].pale)) < 100 && !(s.corParede && luminance(s.corParede) > 140)) v.pale = mix(v.dark, '#1a1420', 0.45); // salas escuras continuam escuras
      ACCENT[id] = {
        mid: defineColor(`ac.${id}.mid`, v.mid, 3), dark: defineColor(`ac.${id}.dark`, v.dark, 1),
        light: defineColor(`ac.${id}.light`, v.light, 1), pale: defineColor(`ac.${id}.pale`, v.pale, 1),
      };
    }
  }

  // 3) pisos e paredes
  const style = { iluminacao: cfg.iluminacao || 'dia', salas: {}, lights: [] };
  for (const id of [...AGENTES, 'corredor']) {
    const s = cfg.salas?.[id] || {};
    const st = {};
    if (s.piso || s.corPiso) {
      st.floor = { tipo: s.piso || null };
      if (s.corPiso) {
        const c = s.corPiso, t = s.piso || 'madeira';
        const b = t === 'xadrez' ? (luminance(c) > 128 ? escurecer(c, 0.55) : clarear(c, 0.55)) : t === 'azulejo' ? clarear(c, 0.25) : t === 'madeira' ? clarear(c, 0.18) : escurecer(c, 0.82);
        const k = t === 'madeira' ? escurecer(c, 0.68) : t === 'grama' ? clarear(c, 0.3) : t === 'concreto' ? clarear(c, 0.15) : escurecer(c, 0.75);
        st.floor.cols = [defineColor(`piso.${id}.a`, c), defineColor(`piso.${id}.b`, b), defineColor(`piso.${id}.c`, k)];
      }
    }
    if (s.parede || s.corParede) {
      const ac = ACCENT[id] || BASE_ACCENT.lounge;
      const t = s.parede || 'lisa';
      let main = ac.pale, dark = null, light = null;
      if (s.corParede) {
        main = defineColor(`parede.${id}.a`, s.corParede);
        dark = defineColor(`parede.${id}.b`, escurecer(s.corParede, 0.62));
        light = defineColor(`parede.${id}.c`, clarear(s.corParede, 0.45));
      } else if (t === 'tijolo') { main = ac.mid; } else if (t === 'painel') { main = 'woodLight'; dark = 'wood'; light = 'tan'; } else if (t === 'vidro') { main = 'cyanPale'; }
      const w = { tipo: t, main, dark, light };
      if (t === 'tijolo') w.mortar = luminance(hexOf(main)) > 140 ? 'light' : (light || ac.light);
      if (t === 'papel') w.motif = luminance(hexOf(main)) > 140 ? (dark ? light : ac.light) : ac.light;
      if (t === 'vidro' && style.iluminacao === 'noite' && !s.corParede) w.main = 'navy';
      st.wall = w;
    }
    if (s.neon) st.neon = true;
    style.salas[id] = st;
  }
  style.plantas = !!cfg.salas?.['*']?.plantas || Object.values(cfg.salas || {}).some((s) => s.plantas);

  // 4) pele (tema) e personagens
  if (P.pele && P.pele.join() !== PELE_PADRAO.join()) {
    P.pele.forEach((h, i) => {
      const next = P.pele[i + 1] ? P.pele[i + 1] : escurecer(h, 0.6);
      PELES[i] = [defineColor(`pele.${i}`, h, 2), defineColor(`pele.${i}.s`, i + 1 < P.pele.length ? next : next, 1)];
    });
    PELES.length = P.pele.length;
  }
  const looks = {};
  for (const [id, base] of Object.entries(LOOKS)) {
    const look = JSON.parse(JSON.stringify(base));
    // roupa acompanha o destaque da sala (padrão = mesmas cores de hoje)
    const sala = id === 'visitante' ? 'lounge' : id;
    if (ACCENT[sala] && id !== 'orquestrador') look.top = [ACCENT[sala].mid, ACCENT[sala].dark];
    if (id === 'orquestrador') { look.tie = ACCENT.orquestrador.mid; look.tieDark = ACCENT.orquestrador.dark; }
    const p = cfg.personagens?.[id] || {};
    if (p.pele !== undefined && p.pele < PELES.length) look.skin = p.pele;
    if (p.cabelo) {
      let accs = (look.accs || (look.acc ? [look.acc] : [])).filter((a) => !CHAPEUS.includes(a) || a === 'beret');
      const fam = FAMILIA[p.cabelo];
      if (fam) look.style = fam.includes(look.style) ? look.style : fam[0];
      else { look.style = FAMILIA.curto.includes(look.style) ? look.style : 'short'; accs = accs.filter((a) => a !== 'beret'); accs.push(p.cabelo === 'bone' ? 'cap' : 'beanie'); }
      look.accs = accs;
    }
    if (p.acessorio) {
      let accs = (look.accs || (look.acc ? [look.acc] : [])).filter((a) => !['glasses', 'headphones', 'pencil', 'beret'].includes(a));
      delete look.mustache; delete look.beard;
      const a = ACC_DE[p.acessorio];
      if (a) { if (a === 'cap' || a === 'beret') accs = accs.filter((x) => !CHAPEUS.includes(x)); accs.push(a); }
      if (p.acessorio === 'bigode') look.mustache = true;
      if (p.acessorio === 'barba') look.beard = true;
      look.accs = accs;
    }
    if (p.corCabelo) look.hair = [defineColor(`pers.${id}.cabelo`, p.corCabelo, 3), defineColor(`pers.${id}.cabeloS`, escurecer(p.corCabelo, 0.62)), defineColor(`pers.${id}.cabeloL`, clarear(p.corCabelo, 0.4))];
    if (p.roupa) look.top = [defineColor(`pers.${id}.roupa`, p.roupa, 3), defineColor(`pers.${id}.roupaS`, escurecer(p.roupa, 0.65))];
    if (p.calca) look.pants = defineColor(`pers.${id}.calca`, p.calca, 3);
    looks[id] = look;
  }

  // 5) ajuste global do tema (pastel etc.) e paleta restrita (retrô) — não mexe nas escolhas protegidas
  const doUsuario = new Set((cfg.origem?.destaqueUsuario || []).map((id) => `ac.${id}.mid`));
  if (P.ajuste) mapColors((n, h) => (n.startsWith('pers.') || doUsuario.has(n) || n === 'outline' ? null : ajustar(h, P.ajuste)));
  if (P.restrita?.length) {
    const R = P.restrita;
    mapColors((n, h, i) => (SLOTS.prio[i] >= 3 && n.startsWith('pers.') ? null : R.reduce((best, c) => (dist(h, c) < dist(h, best) ? c : best), R[0])));
  }

  // 6) iluminação
  const preTint = [...SLOTS.hex];
  const ilum = style.iluminacao;
  if (TINTA[ilum]) {
    const [m, a] = TINTA[ilum];
    const neonSlots = new Set(Object.entries(style.salas).filter(([, s]) => s.neon).map(([id]) => ACCENT[id]?.light));
    mapColors((n, h) => {
      if (ilum === 'noite' && (ACESOS.has(n) || neonSlots.has(n) || n.startsWith('pele.'))) return null;
      return multiply(h, m, a);
    });
  }

  // 7) cabe em 64 cores
  const merges = finalizarPaleta(dist, { max: MAX_COLORS });

  // 8) mapa de "luz": cada slot → slot cuja cor final é a mais próxima da cor antes da tinta
  let litMap = null;
  if (ilum === 'noite') {
    litMap = SLOTS.hex.map((h, i) => {
      const want = preTint[i];
      let best = i, bd = dist(h, want);
      SLOTS.hex.forEach((h2, k) => { const d = dist(h2, want); if (d < bd) { bd = d; best = k; } });
      return best;
    });
  }
  return { style, looks, litMap, merges, preTint };
}

/** Aparência resolvida em termos do contrato (para public/assets/tema.json e a interface). */
export function aparenciaResolvida(looks, cfg) {
  const out = {};
  for (const [id, look] of Object.entries(looks)) {
    const p = cfg.personagens?.[id] || {};
    const pad = rotulosPadrao(LOOKS[id]);
    const skin = typeof look.skin === 'number' ? look.skin : { light: 0, mid: 1, dark: 2, deep: 3 }[look.skin];
    const hair = Array.isArray(look.hair) ? look.hair : HAIRS[look.hair];
    out[id] = {
      pele: skin,
      cabelo: p.cabelo || pad.cabelo,
      corCabelo: p.corCabelo || hexOf(hair[0]),
      roupa: p.roupa || hexOf(look.top[0]),
      calca: p.calca || hexOf(look.pants),
      acessorio: p.acessorio || pad.acessorio,
      emPe: STANDING.includes(id),
    };
  }
  return out;
}

/** Remapeia os pixels de um Canvas pelo litMap (personagens/objetos "iluminados" à noite). */
export function acender(canvas, litMap) {
  if (!litMap) return canvas;
  const px = canvas.px_;
  for (let i = 0; i < px.length; i++) if (px[i] >= 0) px[i] = litMap[px[i]];
  return canvas;
}

/** Poças de luz no chão (noite): dentro do raio usa a cor "acesa"; na borda, pontilhado. */
export function pocasDeLuz(canvas, lights, litMap) {
  if (!litMap || !lights?.length) return;
  const { w, h, px_ } = canvas;
  const feito = new Uint8Array(w * h);
  for (const { x, y, r } of lights) {
    const rx = r * Math.SQRT2, ry = rx / 2;
    for (let yy = Math.max(0, Math.floor(y - ry)); yy <= Math.min(h - 1, Math.ceil(y + ry)); yy++) {
      for (let xx = Math.max(0, Math.floor(x - rx)); xx <= Math.min(w - 1, Math.ceil(x + rx)); xx++) {
        const d = ((xx - x) / rx) ** 2 + ((yy - y) / ry) ** 2;
        if (d > 1) continue;
        if (d > 0.62 && (xx + yy) % 2) continue;
        if (d > 0.85 && (xx % 2 || yy % 2)) continue;
        const k = yy * w + xx;
        if (px_[k] >= 0 && !feito[k]) { px_[k] = litMap[px_[k]]; feito[k] = 1; }
      }
    }
  }
}
