// Objetos animados das salas: obj_off, obj_work (tela acende), obj_sleep (descanso de tela).
import { Canvas } from './draw.js';

export const OBJ_FPS = { obj_off: 2, obj_work: 8, obj_sleep: 3 };

function screenFrame(c, x, y, w, h, { body = 'ink', stand = true } = {}) {
  c.rect(x, y, w, h, body); c.frame(x, y, w, h, 'outline');
  if (stand) { const mx = x + (w >> 1); c.rect(mx - 1, y + h, 2, 2, 'shadow'); c.vline(mx - 2, y + h, y + h + 1, 'outline'); c.vline(mx + 1, y + h, y + h + 1, 'outline'); c.hline(mx - 4, mx + 3, y + h + 2, 'gray'); c.hline(mx - 5, mx + 4, y + h + 3, 'outline'); }
  return { x: x + 2, y: y + 2, w: w - 4, h: h - 4 };
}
const off = (c, s, col = 'outline') => { c.rect(s.x, s.y, s.w, s.h, col); c.px(s.x, s.y, 'shadow'); c.px(s.x + 1, s.y, 'shadow'); c.px(s.x, s.y + 1, 'shadow'); };
const make = (w, h, n, fn) => Array.from({ length: n }, (_, i) => { const c = new Canvas(w, h); fn(c, i); return c; });
/** descanso de tela padrão: bolinha quicando pela tela, cor de destaque */
function saver(c, s, i, col, col2) {
  off(c, s, 'outline');
  const pts = [[0.15, 0.2], [0.55, 0.65], [0.85, 0.25], [0.4, 0.75]];
  const [fx, fy] = pts[i % 4];
  const x = s.x + Math.round(fx * (s.w - 3)), y = s.y + Math.round(fy * (s.h - 3));
  c.rect(x, y, 3, 3, col); c.px(x, y, col2);
}

export const OBJECTS = {
  // Recepção: quadro kanban digital na parede — cartões andam entre colunas
  orquestrador: () => {
    const W = 40, H = 24;
    const board = (c, lit) => {
      const s = screenFrame(c, 0, 0, W, H, { body: 'woodDark', stand: false });
      c.rect(s.x, s.y, s.w, s.h, lit ? 'white' : 'light');
      for (let k = 0; k < 3; k++) { const cx = s.x + k * 12; c.hline(cx, cx + 10, s.y, ['red', 'orange', 'green'][k]); if (k) c.vline(cx - 1, s.y, s.y + s.h - 1, 'silver'); }
      return s;
    };
    const card = (c, x, y, col) => { c.rect(x, y, 8, 3, col); c.hline(x + 1, x + 5, y + 1, 'shadow'); };
    const fixed = (c, s) => { card(c, s.x + 1, s.y + 3, 'lamp'); card(c, s.x + 1, s.y + 8, 'pinkLight'); card(c, s.x + 13, s.y + 8, 'cyanLight'); card(c, s.x + 25, s.y + 3, 'greenLight'); card(c, s.x + 25, s.y + 8, 'greenLight'); };
    return {
      obj_off: make(W, H, 2, (c) => { const s = board(c, false); fixed(c, s); }),
      obj_work: make(W, H, 4, (c, i) => {
        const s = board(c, true); fixed(c, s);
        const path = [[1, 13], [7, 12], [13, 13], [19, 12]];
        const [px, py] = path[i];
        card(c, s.x + px, s.y + py, 'orange'); c.frame(s.x + px - 1, s.y + py - 1, 10, 5, 'orangeDark');
        if (i % 2) c.px(s.x + s.w - 2, s.y + s.h - 2, 'red');
      }),
      obj_sleep: make(W, H, 4, (c, i) => { const s = board(c, false); fixed(c, s); c.dither(s.x, s.y, s.w, s.h, 'light', 'silver'); saver(c, { x: s.x + 12, y: s.y + 4, w: 12, h: 10 }, i, 'orange', 'lamp'); }),
    };
  },
  // Roteiro: abajur amarelo na mesa
  roteirista: () => {
    const W = 16, H = 18;
    const lamp = (c, shade, bulb, glow) => {
      if (glow) { c.ellipse(0, 6, 16, 11, glow); }
      // haste e base
      c.line(9, 8, 5, 13, 'outline'); c.line(10, 8, 6, 13, 'gray'); c.rect(2, 14, 10, 2, 'yellowDark'); c.frame(1, 13, 12, 4, 'outline'); c.hline(2, 11, 14, 'yellow');
      // cúpula
      c.rect(7, 1, 7, 5, shade); c.frame(6, 0, 9, 7, 'outline'); c.hline(7, 13, 1, 'lamp'); c.px(6, 6, 'outline');
      c.hline(8, 12, 7, bulb); c.hline(7, 13, 6, 'outline');
    };
    return {
      obj_off: make(W, H, 2, (c) => lamp(c, 'yellowDark', 'gray', null)),
      obj_work: make(W, H, 4, (c, i) => {
        // cone de luz sob a cúpula (pulsa) + raios
        for (let y = 8; y <= 12; y++) for (let x = 8 - (y - 8); x <= 12 + (y - 8) && x < 16; x++) if (((x + y + i) & 1) === 0) c.px(x, y, 'lamp');
        lamp(c, 'yellow', 'lamp', null);
        if (i % 2) { c.hline(2, 4, 3, 'lamp'); c.px(3, 0, 'lamp'); c.px(4, 6, 'lamp'); } else { c.hline(3, 4, 3, 'lamp'); c.px(4, 1, 'lamp'); }
      }),
      obj_sleep: make(W, H, 4, (c, i) => lamp(c, i % 2 ? 'yellow' : 'yellowDark', i % 2 ? 'lamp' : 'yellowDark', null)),
    };
  },
  // Edição: 2 monitores com timeline
  'editor-video': () => {
    const W = 34, H = 18;
    const two = (c, fn) => { const a = screenFrame(c, 0, 0, 16, 13), b = screenFrame(c, 17, 0, 16, 13); fn(a, b); };
    return {
      obj_off: make(W, H, 2, (c, i) => two(c, (a, b) => { off(c, a); off(c, b); c.px(a.x + a.w, a.y + a.h + 1, i ? 'red' : 'redDark'); })),
      obj_work: make(W, H, 4, (c, i) => two(c, (a, b) => {
        // monitor A: vídeo (céu, sol, morro)
        c.rect(a.x, a.y, a.w, a.h, 'blueLight'); c.ellipse(a.x + 1 + i, a.y + 1, 4, 4, 'lamp'); c.rect(a.x, a.y + 6, a.w, 3, 'green'); c.px(a.x + 6, a.y + 5, 'green'); c.px(a.x + 7, a.y + 5, 'green');
        // monitor B: timeline com faixas e cursor correndo
        c.rect(b.x, b.y, b.w, b.h, 'ink');
        c.hline(b.x, b.x + 6, b.y + 2, 'purple'); c.hline(b.x + 7, b.x + 11, b.y + 2, 'neon');
        c.hline(b.x + 1, b.x + 9, b.y + 4, 'cyan'); c.hline(b.x + 3, b.x + 11, b.y + 6, 'green'); c.hline(b.x, b.x + 4, b.y + 8, 'orange');
        const ph = b.x + (i * 3) % b.w; c.vline(ph, b.y, b.y + b.h - 1, 'red'); c.px(ph, b.y, 'white');
      })),
      obj_sleep: make(W, H, 4, (c, i) => two(c, (a, b) => { saver(c, a, i, 'purple', 'neon'); saver(c, b, i + 2, 'neon', 'white'); })),
    };
  },
  // Animação: caixa de luz na parede com folhas de animação piscando (bola quicando)
  animador: () => {
    const W = 40, H = 26;
    const box = (c, bg) => { c.rect(0, 0, W, H, 'cyanDark'); c.frame(0, 0, W, H, 'outline'); c.rect(2, 2, W - 4, H - 4, bg); };
    const sheet = (c, x, ball, lit) => { c.rect(x, 4, 10, 16, lit ? 'white' : 'cream'); c.frame(x, 4, 10, 16, 'silver'); c.hline(x + 1, x + 8, 18, 'gray'); c.rect(x + 3, 6 + ball, 4, 4, lit ? 'pink' : 'silver'); c.px(x + 3, 6 + ball, 'white'); c.px(x + 6, 9 + ball, 'white'); c.px(x + 4, 7 + ball, lit ? 'pinkLight' : 'light'); };
    const bounce = [0, 4, 8, 4];
    return {
      obj_off: make(W, H, 2, (c) => { box(c, 'silver'); [4, 15, 26].forEach((x, k) => sheet(c, x, bounce[k], false)); }),
      obj_work: make(W, H, 4, (c, i) => { box(c, 'cyanLight'); [4, 15, 26].forEach((x, k) => sheet(c, x, bounce[(k + i) % 4], true)); c.rect(4 + (i % 3) * 11, 21, 10, 1, 'cyan'); }),
      obj_sleep: make(W, H, 4, (c, i) => { box(c, i % 2 ? 'cyanDark' : 'slate'); [4, 15, 26].forEach((x, k) => sheet(c, x, bounce[(k + (i >> 1)) % 4], false)); }),
    };
  },
  // Servidores: rack com LEDs e terminal com código verde rolando
  programador: () => {
    const W = 20, H = 48;
    const rack = (c) => { c.rect(0, 0, W, H, 'ink'); c.frame(0, 0, W, H, 'outline'); c.vline(1, 1, H - 2, 'shadow'); c.rect(2, 2, 16, 12, 'outline'); for (let y = 16; y < H - 4; y += 5) { c.rect(2, y, 16, 4, 'shadow'); c.hline(2, 17, y + 3, 'outline'); c.hline(9, 16, y + 1, 'gray'); } c.rect(1, H - 3, 3, 3, 'outline'); c.rect(W - 4, H - 3, 3, 3, 'outline'); };
    const leds = (c, pattern) => { let k = 0; for (let y = 16; y < H - 4; y += 5) { for (let j = 0; j < 3; j++) { const v = pattern(k++); if (v) c.px(3 + j * 2, y + 1, v); } } };
    const code = ['## ###', '### ##', '# ####', '#### #', '## ## ', '### # '];
    return {
      obj_off: make(W, H, 2, (c, i) => { rack(c); leds(c, (k) => (k % 3 === 0 ? 'greenDark' : null)); c.px(16, 12, i ? 'green' : 'greenDark'); }),
      obj_work: make(W, H, 4, (c, i) => {
        rack(c);
        leds(c, (k) => (((k * 7 + i * 5) % 4) === 0 ? null : ((k + i) % 5 === 0 ? 'orange' : ((k * 3 + i) % 2 ? 'greenLight' : 'green'))));
        for (let r = 0; r < 5; r++) { const row = code[(r + i) % code.length]; for (let x = 0; x < row.length; x++) if (row[x] === '#') c.px(3 + x * 2, 3 + r * 2, r === 4 ? 'greenLight' : 'green'); }
        if (i % 2) c.px(15, 11, 'greenLight');
      }),
      obj_sleep: make(W, H, 4, (c, i) => { rack(c); leds(c, (k) => ((k + i) % 6 === 0 ? 'greenDark' : null)); c.text('Z', 7 + (i % 2), 4 + (i >> 1), 'greenDark'); }),
    };
  },
  // App-mobile: monitor com telas de app sendo arrastadas
  desenvolvedor: () => {
    const W = 16, H = 17;
    return {
      obj_off: make(W, H, 2, (c, i) => { const s = screenFrame(c, 0, 0, 16, 13); off(c, s); c.px(s.x + s.w, s.y + s.h + 1, i ? 'blue' : 'blueDark'); }),
      obj_work: make(W, H, 4, (c, i) => {
        const s = screenFrame(c, 0, 0, 16, 13);
        c.rect(s.x, s.y, s.w, s.h, 'white');
        const phone = (x, col) => { c.rect(x, s.y + 1, 4, 7, 'ink'); c.rect(x + 1, s.y + 2, 2, 4, col); c.px(x + 1, s.y + 2, 'white'); };
        phone(s.x + 1, 'blue'); phone(s.x + 7, 'orange');
        const dx = [0, 2, 4, 2][i];
        phone(s.x + 2 + dx, 'cyan');
        c.px(s.x + 4 + dx, s.y + 7, 'outline'); c.px(s.x + 5 + dx, s.y + 8, 'outline');
      }),
      obj_sleep: make(W, H, 4, (c, i) => { const s = screenFrame(c, 0, 0, 16, 13); saver(c, s, i, 'blue', 'blueLight'); }),
    };
  },
  // Design: pôster que muda de cor
  designer: () => {
    const W = 28, H = 30;
    const schemes = [['pink', 'yellow', 'navy'], ['cyan', 'pink', 'purpleDark'], ['yellow', 'blue', 'redDark'], ['green', 'orange', 'navy']];
    const poster = (c, [a, b, bg], dim) => {
      c.rect(0, 0, W, H, 'outline'); c.rect(1, 1, W - 2, H - 2, dim ? 'shadow' : bg);
      c.ellipse(5, 4, 14, 14, dim ? 'gray' : a); c.ellipse(11, 9, 10, 10, dim ? 'silver' : b);
      c.rect(3, 21, W - 6, 2, dim ? 'gray' : a); c.rect(3, 24, 12, 2, dim ? 'gray' : 'white');
      c.px(W - 4, 3, 'white');
    };
    return {
      obj_off: make(W, H, 2, (c) => poster(c, schemes[0], false)),
      obj_work: make(W, H, 4, (c, i) => { poster(c, schemes[i], false); c.px(1 + (i * 7) % (W - 2), H - 2, 'white'); }),
      obj_sleep: make(W, H, 4, (c, i) => { poster(c, schemes[0], true); c.text('Z', 20, 3 + (i % 2), 'light'); }),
    };
  },
  // Revisão: monitor com documento recebendo checks
  revisor: () => {
    const W = 16, H = 17;
    return {
      obj_off: make(W, H, 2, (c, i) => { const s = screenFrame(c, 0, 0, 16, 13); off(c, s); c.px(s.x + s.w, s.y + s.h + 1, i ? 'red' : 'redDark'); }),
      obj_work: make(W, H, 4, (c, i) => {
        const s = screenFrame(c, 0, 0, 16, 13);
        c.rect(s.x, s.y, s.w, s.h, 'white');
        for (let r = 0; r < 4; r++) {
          const y = s.y + 1 + r * 2;
          c.hline(s.x + 4, s.x + 10, y, 'silver');
          if (r < i) { c.px(s.x + 1, y, 'green'); c.px(s.x + 2, y + 1 > s.y + s.h - 1 ? y : y, 'green'); c.px(s.x + 2, y, 'green'); }
          else c.px(s.x + 1, y, 'light');
        }
        c.hline(s.x, s.x + s.w - 1, s.y + 1 + ((i * 2) % 8), 'cyanLight');
      }),
      obj_sleep: make(W, H, 4, (c, i) => { const s = screenFrame(c, 0, 0, 16, 13); saver(c, s, i, 'red', 'pinkLight'); }),
    };
  },
  // Copa: cafeteira
  copa: () => {
    const W = 16, H = 16;
    const machine = (c, led) => {
      c.rect(1, 1, 14, 15, 'ink'); c.frame(1, 1, 14, 15, 'outline'); c.rect(2, 2, 12, 4, 'shadow'); c.hline(2, 13, 2, 'gray');
      c.rect(4, 7, 8, 7, 'outline'); c.rect(6, 6, 4, 2, 'silver'); c.px(12, 4, led);
      c.rect(6, 11, 4, 3, 'white'); c.px(10, 12, 'white');
    };
    return {
      obj_off: make(W, H, 2, (c) => machine(c, 'greenDark')),
      obj_work: make(W, H, 4, (c, i) => { machine(c, 'green'); c.vline(8, 8, 8 + (i % 3), 'woodDark'); c.px(7, 11, 'woodDark'); c.px(8, 11, 'woodDark'); c.px(6 + (i % 2), 0, 'light'); c.px(7 + (i % 2), 0, 'white'); }),
      obj_sleep: make(W, H, 4, (c, i) => machine(c, i % 2 ? 'red' : 'redDark')),
    };
  },
  // Lounge: TV
  lounge: () => {
    const W = 32, H = 20;
    const tv = (c) => { const s = screenFrame(c, 0, 0, W, 18, { stand: false }); c.rect(4, 18, 2, 2, 'outline'); c.rect(W - 6, 18, 2, 2, 'outline'); return s; };
    return {
      obj_off: make(W, H, 2, (c, i) => { const s = tv(c); off(c, s); c.px(W - 3, 16, i ? 'red' : 'redDark'); }),
      obj_work: make(W, H, 4, (c, i) => { const s = tv(c); c.rect(s.x, s.y, s.w, s.h, 'blueLight'); c.rect(s.x, s.y + 9, s.w, 5, 'green'); c.ellipse(s.x + 3 + i * 4, s.y + 4 - (i % 2), 6, 6, 'orange'); c.px(s.x + 5 + i * 4, s.y + 5 - (i % 2), 'outline'); c.ellipse(s.x + 20, s.y + 2, 5, 3, 'white'); }),
      obj_sleep: make(W, H, 4, (c, i) => { const s = tv(c); saver(c, s, i, 'teal', 'cyanLight'); }),
    };
  },
};

export function objectAnims(id) {
  const o = OBJECTS[id]();
  return ['obj_off', 'obj_work', 'obj_sleep'].map((tag) => ({ tag, frames: o[tag], fps: OBJ_FPS[tag] }));
}
