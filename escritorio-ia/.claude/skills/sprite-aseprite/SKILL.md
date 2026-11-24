---
name: sprite-aseprite
description: Use para criar ou alterar sprites e animações pixel art do escritório (personagens 16x32, tiles 16x16, objetos de sala, FX) no Aseprite - grade, camadas, tags base_* e <cargo>_work, quadros e FPS da tabela, export PNG + JSON (json-hash) pela CLI e validação do JSON contra o contrato.
---

# Sprites no Aseprite

Fonte da verdade: `CONTRATO.md` seção 5 (formato dos arquivos) e a tabela de animações do PDF.
Validador: [`checar-sprite.mjs`](checar-sprite.mjs) → `node .claude/skills/sprite-aseprite/checar-sprite.mjs public/assets/char_editor-video.json editor-video`

## Grade e tamanhos
| Peça | Tamanho | Observação |
|---|---|---|
| Tile de piso/parede | 16x16 | grade 16x16 ligada (View > Grid) |
| Personagem | 16x32 | pé no ponto inferior-central (é o `seat` do manifest) |
| Fundo de sala | 160x112 | 10x7 tiles |
| Objeto de sala | múltiplo de 16 | tags `obj_off`, `obj_work`, `obj_sleep` |
| FX | 16x16 | tags `fx_zzz`, `fx_question`, `fx_smoke`, `fx_sweat`, `fx_star`, `fx_magnifier` |

Novo arquivo: *Color mode* **Indexed**, carregue a paleta do escritório (skill `paleta-escritorio`)
antes de desenhar. Fundo transparente. Sem antialias, sem pincel com suavização, sem rotação livre.

## Camadas (de baixo para cima)
`guia` (referência, não exporta) · `sombra` · `corpo` · `roupa` (cor de destaque da sala) ·
`cabeca` · `acessorio` (fone, lupa, caneta — o que identifica o cargo) · `fx` (opcional)

## Tags e quadros (obrigatório)
| Tag | Quadros | FPS | Duração por quadro (ms) | O que mostra |
|---|---|---|---|---|
| `<roomId>_work` | 4–6 | 8 | 125 | ação típica do cargo |
| `base_read` | 4 | 6 | 167 | folheia papel / rola tela |
| `base_idle` | 2 | 4 | 250 | respira, pisca |
| `base_doze` | 4 | 4 | 250 | cabeça cai e levanta |
| `base_sleep` | 4 | 3 | 333 | cabeça na mesa |
| `base_wait` | 2 | 4 | 250 | bate o pé |
| `base_done` | 4 | 8 | 125 | braços para cima |
| `base_error` | 3 | 6 | 167 | suor / susto |
| `base_walk_down/up/left/right` | 4 | 8 | 125 | caminhada |

`<roomId>` = id em `shared/rooms.json` (`orquestrador_work`, `editor-video_work`, …; visitante: `visitante_work`).
Ações de trabalho por cargo: orquestrador carimba/move cartão; roteirista bate na máquina de
escrever; editor-video fone + mouse; animador desenha na mesa digitalizadora; programador digita
rápido; desenvolvedor arrasta tela no celular; designer gira roda de cores; revisor lupa + carimbo.

Defina a duração na janela *Frame Properties* (selecione os quadros da tag e mude todos juntos).
Direção da tag: `forward`; loop é decidido pelo `manifest.animations`.

## Exportar (CLI)
```bash
aseprite -b art/src/char_editor-video.aseprite \
  --ignore-layer guia \
  --sheet public/assets/char_editor-video.png \
  --data  public/assets/char_editor-video.json \
  --format json-hash --list-tags \
  --sheet-type rows --sheet-pack \
  --filename-format '{tag}_{tagframe}'
```
- `{tag}_{tagframe}` gera chaves `base_idle_0`, `base_idle_1`… (formato `<anim>_<n>` do contrato).
- Exportar todos: `for f in art/src/char_*.aseprite; do n=$(basename "$f" .aseprite); aseprite -b "$f" --ignore-layer guia --sheet "public/assets/$n.png" --data "public/assets/$n.json" --format json-hash --list-tags --sheet-pack --filename-format '{tag}_{tagframe}'; done`
- GIF de preview de uma tag: `aseprite -b char_x.aseprite --tag base_idle --scale 4 --save-as preview_idle.gif`
- Aplicar paleta: `aseprite -b in.aseprite --palette art/escritorio.gpl --save-as out.aseprite`

**Atenção:** hoje `public/assets/` é gerado por `npm run sprites` (`art/generate.js`, frente Pixel art).
Sprite feito no Aseprite precisa sair no mesmo formato (o validador confere) e ser combinado com
essa frente antes de substituir arquivo gerado.

## Validar
```bash
node .claude/skills/sprite-aseprite/checar-sprite.mjs public/assets/char_editor-video.json editor-video
```
Confere: tags obrigatórias, nº de quadros por tag, duração ≈ 1000/FPS, tamanho 16x32, chaves `<tag>_<n>`.

## Checklist
- [ ] Só cores da paleta (Indexed), sem semitransparência fora da sombra
- [ ] Silhueta legível em 1x; testar em 3x e 4x (nearest neighbor)
- [ ] Pé alinhado no mesmo pixel em todas as tags (sem "pular" ao trocar de estado)
- [ ] Validador sem erros
