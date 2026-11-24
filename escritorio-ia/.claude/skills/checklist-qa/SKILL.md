---
name: checklist-qa
description: Use para revisar qualquer entrega antes de voltar ao orquestrador - checklists por tipo (texto/roteiro, legenda, vídeo, motion, sprite, design, código, site) e o formato do veredito APROVADO/REPROVADO com lista de bloqueantes e sugestões. Só leitura (Read, Grep, Glob).
---

# Checklist de QA

Use só as seções que se aplicam. Cada item que falhar vira **bloqueante** (reprova) ou
**sugestão** (não reprova). Na dúvida entre os dois: é bloqueante se o cliente notaria ou se
quebra spec/contrato.

## 0. Geral (sempre)
- [ ] Entregou o que o briefing pediu (formatos, quantidade, duração)?
- [ ] Arquivos existem nos caminhos informados (`Glob`)?
- [ ] Nomes no padrão `<slug>_<formato>_v<NN>.<ext>`
- [ ] Nenhum `[CONFIRMAR]`, `TODO`, `lorem ipsum`, `XXX` sobrando (`Grep`)
- [ ] Bruto/original preservado (vídeo, imagens)

## 1. Texto / roteiro
- [ ] Ortografia e gramática (skill `ortografia`)
- [ ] Gancho ≤ 3 s e entende-se sem som; CTA único no fim
- [ ] Contagem de palavras compatível com a duração (≈ 2,5 palavras/s)
- [ ] Tabela de cenas sem buracos de tempo; tempos somam a duração
- [ ] Tom de voz conforme briefing; sem promessa absoluta/sem prova
- [ ] Fatos e números com fonte

## 2. Legenda .srt
- [ ] Numeração sequencial, tempo `HH:MM:SS,mmm --> ...`
- [ ] ≤ 42 caracteres/linha, ≤ 2 linhas, ≥ 1 s por bloco, sem sobreposição
- [ ] Texto igual à fala do roteiro final; quebras não separam artigo/substantivo
- [ ] O editor rodou `checar-srt.mjs` (saída colada)?

## 3. Vídeo (pelo relatório ffprobe em `cortes.md`)
- [ ] 9:16 = 1080x1920 e 16:9 = 1920x1080 (os dois, se pedido)
- [ ] h264 High, yuv420p, 30 fps, AAC 48 kHz estéreo
- [ ] Loudness ≈ -14 LUFS (± 1)
- [ ] Duração dentro do limite da plataforma
- [ ] Thumbnail existe e no tamanho certo; `.srt` entregue
- [ ] `cortes.md` lista cortes e comandos

## 4. Motion (Remotion)
- [ ] Render existe nas proporções pedidas; comando de re-render em `anim.md`
- [ ] Texto dentro da área segura; fontes carregadas
- [ ] Sem `Math.random`/`Date.now` em componentes

## 5. Sprite / pixel art
- [ ] Validador `checar-sprite.mjs` sem erros (saída colada)
- [ ] Tags `base_*` e `<roomId>_work` presentes; 16x32; json-hash
- [ ] Só cores da paleta (skill `paleta-escritorio`)

## 6. Design
- [ ] Tamanho exato do formato; área segura respeitada
- [ ] Contraste AA (≥ 4,5:1 texto normal)
- [ ] Texto revisado igual ao aprovado do roteirista
- [ ] Fonte SVG/HTML + PNG (ou instrução de export)

## 7. Código
- [ ] Testes rodaram verdes (saída colada); comportamento novo tem teste
- [ ] Respeita `CONTRATO.md` (eventos, estados, portas, formatos) e lê `shared/rooms.json`
- [ ] Hooks: `exit 0`, nada em stdout, timeout curto
- [ ] Sem segredo no código, sem `console.log` de depuração esquecido, sem dependência nova injustificada
- [ ] Erros tratados na borda (JSON inválido não derruba servidor)
- [ ] Front funciona sem assets (placeholders)

## 8. Site / app
- [ ] 360 px sem rolagem horizontal; 1280 px ok
- [ ] `<title>`, description, OG, favicon; links relativos
- [ ] Alvos ≥ 44 px; `alt` em imagens; foco visível

## Veredito (formato fixo)
```
VEREDITO: REPROVADO
Escopo revisado: entregas/2026-11-24-dica/video/*, roteiro/legenda.srt
Bloqueantes:
1. [editor-video] video/dica_16x9_v01.mp4 — 1280x720, esperado 1920x1080 → reexportar com padrao-export
2. [roteirista] roteiro/legenda.srt:14 — "agente" escrito "ajente" → corrigir
Sugestões:
- [designer] thumb: aumentar o título para ≥ 120 px
Checklist usado: 0, 2, 3
```
APROVADO não tem bloqueantes; pode ter sugestões.
