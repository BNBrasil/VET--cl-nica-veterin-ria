---
name: phaser-escritorio
description: Use para manter ou evoluir a tela do próprio Escritório de IA (public/) - conexão WebSocket, snapshot/agent/event, máquina de estado → animação, leitura do manifest e sprite sheets Aseprite, placeholders sem assets, escala inteira pixelada, layout das salas a partir de shared/rooms.json; e para migrar a tela para Phaser 3 se pedirem.
---

# Tela do escritório (Canvas 2D / Phaser)

Fonte da verdade: `CONTRATO.md` seções 4–6. A versão atual é **HTML + ES modules + Canvas 2D,
sem build** (`public/index.html`, `public/css/`, `public/js/`). Phaser é opção de evolução,
não requisito; se migrar, mantenha o mesmo protocolo e o modo placeholder.

## Rodar
```bash
npm install && npm run sprites && npm start     # http://127.0.0.1:4317
npm run demo                                     # gera eventos falsos para ver todos os estados
```

## Dados de entrada
| De onde | O quê |
|---|---|
| `GET /shared/rooms.json` | salas (`id`, `nome`, `accent`, `col`, `row`), `common` (copa, lounge), `timers` |
| `GET /assets/manifest.json` | tamanhos, `animations` (fps/loop), `characters`, `rooms` (`background`, `seat`, `object`, `sofa`), `fx`, `visitor` |
| WS `/ws` | `snapshot` (todos os agentes), `agent` (um mudou), `event` (log) |

Layout: sala = `manifest.room` (160x112) posicionada em `col * w`, `row * h`; grade 4x3
(8 salas + copa + lounge). Personagem desenhado com o **pé** em `seat` (ponto inferior-central);
`location: "lounge"` → desenha no `sofa` do lounge.

## Cliente WebSocket (com reconexão)
```js
const proto = location.protocol === 'https:' ? 'wss' : 'ws';
const agentes = new Map();
function conectar(tentativa = 0) {
  const ws = new WebSocket(`${proto}://${location.host}/ws`);
  ws.onopen = () => (tentativa = 0);
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.type === 'snapshot') { agentes.clear(); m.agents.forEach((a) => agentes.set(a.id, a)); }
    else if (m.type === 'agent') agentes.set(m.agent.id, m.agent);
    else if (m.type === 'event') logar(m.event);
  };
  ws.onclose = () => setTimeout(() => conectar(tentativa + 1), Math.min(5000, 500 * 2 ** tentativa));
}
```

## Estado → animação (seção 6 do contrato)
```js
function visual(a) {
  switch (a.state) {
    case 'working':
      if (a.activity === 'reading') return { char: 'base_read', obj: 'obj_work' };
      if (a.activity === 'searching') return { char: 'base_read', fx: 'fx_magnifier', obj: 'obj_work' };
      return { char: `${a.visitor ? 'visitante' : a.room}_work`, obj: 'obj_work' };
    case 'idle': return { char: 'base_idle', obj: 'obj_off' };
    case 'dozing': return { char: 'base_doze', obj: 'obj_off' };
    case 'sleeping': return { char: 'base_sleep', fx: 'fx_zzz', obj: 'obj_sleep' };
    case 'waiting': return { char: 'base_wait', fx: 'fx_question', fxBlink: true, obj: 'obj_work' };
    case 'done': return { char: 'base_done', fx: 'fx_star', obj: 'obj_work' };
    case 'error': return { char: 'base_error', fx: 'fx_smoke', obj: 'obj_work' };
    default: return { char: null, obj: 'obj_off' }; // absent: cadeira vazia
  }
}
```

## Sprite sheet Aseprite (json-hash)
```js
async function carregarSheet(base, nome) {      // nome: 'char_editor-video'
  const [img, data] = await Promise.all([
    new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = `${base}/${nome}.png`; }),
    fetch(`${base}/${nome}.json`).then((r) => r.json()),
  ]);
  const tags = Object.fromEntries(data.meta.frameTags.map((t) => [t.name,
    Array.from({ length: t.to - t.from + 1 }, (_, i) => data.frames[`${t.name}_${i}`])]));
  return { img, tags };
}
function quadro(sheet, tag, t) {                   // t em ms; usa duration de cada quadro
  const fr = sheet.tags[tag]; if (!fr) return null;
  const total = fr.reduce((s, f) => s + f.duration, 0);
  let x = t % total; for (const f of fr) { if ((x -= f.duration) < 0) return f.frame; }
  return fr[0].frame;
}
// desenhar: ctx.drawImage(sheet.img, f.x, f.y, f.w, f.h, seat.x - f.w/2, seat.y - f.h, f.w, f.h)
```

## Pixel perfeito
```js
const escala = Math.max(1, Math.floor(Math.min(innerWidth / larguraMundo, innerHeight / alturaMundo)));
canvas.width = larguraMundo; canvas.height = alturaMundo;      // resolução lógica
canvas.style.width = larguraMundo * escala + 'px';             // escala inteira
ctx.imageSmoothingEnabled = false;                              // + CSS: image-rendering: pixelated
```
Arredonde todas as posições (`Math.round`) antes de desenhar.

## Modo placeholder (obrigatório funcionar)
Se `manifest.json` ou uma imagem falhar: fundo da sala = `accent` escurecido + nome; personagem =
retângulo 16x32 **verde** (working), **cinza** (dozing/sleeping), **amarelo** (waiting), branco
(idle), vermelho (error), dourado (done); nada se absent. Nunca deixe a tela em branco por asset faltando.

## Phaser 3 (se migrar)
- Sem build: `<script src="https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js"></script>`.
- Config: `pixelArt: true`, `scale: { mode: Phaser.Scale.FIT, autoRound: true }`.
- Carregar: `this.load.aseprite('char_editor-video', 'assets/char_editor-video.png', 'assets/char_editor-video.json')`
  e em `create()`: `this.anims.createFromAseprite('char_editor-video')` (cria uma animação por tag).
- Um `Sprite` por agente; troque com `sprite.play(tag, true)` ao receber `agent`.
- Mantenha o cliente WS e a função `visual()` acima como módulos puros (testáveis sem Phaser).

## Checklist antes de entregar
- [ ] Funciona sem `public/assets/` (placeholders) e com assets
- [ ] Reconecta se o servidor cair e voltar
- [ ] Visitante aparece no lounge e some quando o agente termina
- [ ] Escala inteira, sem borrão, em 1280 px e em 360 px de largura
- [ ] Nenhum valor de sala/cor/tempo fixo no JS (tudo de `rooms.json`/`manifest.json`)
