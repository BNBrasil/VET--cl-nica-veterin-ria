---
name: paleta-escritorio
description: Use sempre que for escolher cores para pixel art, animação ou peça visual do próprio Escritório de IA - regras da paleta fechada (32 a 48 cores), onde ela mora (art/palette.js, public/assets/palette.json, shared/rooms.json), cor de destaque de cada sala, como importar no Aseprite (.gpl) e como conferir se uma imagem usa só cores da paleta.
---

# Paleta do escritório

## Onde estão as cores (não duplique valores)
| Arquivo | O quê | Dono |
|---|---|---|
| `shared/rooms.json` → `rooms[].accent`, `common[].accent` | cor de destaque de cada sala | Integração |
| `art/palette.js` | paleta fechada completa (fonte) | Pixel art |
| `public/assets/palette.json` | mesma paleta exportada por `npm run sprites` | gerado |

Ver os destaques das salas:
```bash
node -e "const r=require('./shared/rooms.json');for(const x of [...r.rooms,...r.common])console.log(x.id.padEnd(14),x.accent,x.nome)"
```
Gerar paleta GIMP/Aseprite (.gpl) a partir do JSON: [`palette-to-gpl.mjs`](palette-to-gpl.mjs)
```bash
node .claude/skills/paleta-escritorio/palette-to-gpl.mjs public/assets/palette.json > art/escritorio.gpl
# sem palette.json ainda? gera só com os destaques das salas:
node .claude/skills/paleta-escritorio/palette-to-gpl.mjs shared/rooms.json > /tmp/destaques.gpl
```
Conferir se um PNG usa só cores da paleta (ImageMagick, se instalado):
```bash
convert sprite.png -alpha off -unique-colors txt:- | tail -n +2 | awk '{print $3}' | sort -u > usadas.txt
node -e "const p=require('./public/assets/palette.json');const l=(Array.isArray(p)?p:p.colors||p.palette).map(c=>(c.hex||c).toUpperCase());console.log(l.join('\n'))" | sort -u > paleta.txt
comm -23 usadas.txt paleta.txt   # vazio = ok
```

## Regras
- **Paleta fechada de 32 a 48 cores.** Precisa de cor nova? Peça à frente Pixel art para entrar
  em `art/palette.js`; nunca use cor "solta" num sprite.
- Rampas de 3–4 tons por material (sombra, base, luz, brilho); sombra puxa para azul/roxo,
  luz puxa para amarelo — nada de preto puro para sombra.
- Cor de destaque (`accent`) da sala aparece no personagem (roupa/acessório) e em 1–2 objetos
  da sala, para o usuário reconhecer a sala de longe.
- Contorno: 1 px, tom escuro da própria rampa (não preto puro), exceto onde precisa separar
  personagem do fundo.
- Placeholders do front (sem assets): verde = trabalhando, cinza = dormindo, amarelo = esperando.
  Não use exatamente esses três como cor dominante de personagem para não confundir.
- Exibição sempre em escala inteira (2x, 3x, 4x) com nearest neighbor
  (`image-rendering: pixelated` no CSS; `ctx.imageSmoothingEnabled = false` no canvas).

## Clima de cada sala (use a rampa do destaque)
Recepção (madeira quente, relógio), Roteiro (abajur amarelo, papel), Edição (escura, neon roxo),
Animação (mesa de luz ciano), Servidores (LEDs verdes, racks escuros), App-Mobile (telas azuis,
pufes), Design (rosa, plantas), Revisão (mesa limpa, carimbo vermelho), Copa (marrom café),
Lounge (verde-água, sofá).
