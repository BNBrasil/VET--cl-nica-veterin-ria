---
name: vlog-edicao
description: Use quando o pedido for "edite meu vlog", "faça os vídeos de cada dia", pasta de brutos de vários dias, ou compilado/melhores momentos - o fluxo completo (analisar.js → olhar folhas e transcrição → edl.json → renderizar.js → conferir → compilar.js), critérios de escolha dos momentos, formato do edl.json com exemplo, e como o orquestrador divide em frentes paralelas (um editor-vlog por data + roteirista, designer, social-media e revisor).
---

# Edição de vlog: dos brutos aos vídeos prontos para postar

Fonte da verdade: `vlog/CONTRATO.md`. Comandos rodam na raiz do `escritorio-ia/`.

## Visão geral
```
vlog/brutos/ (ou VLOG_BRUTOS / --brutos)  →  node vlog/analisar.js
vlog/trabalho/<data>/analise.json + folhas/*.jpg + transcricao.srt
   → (editor-vlog OLHA e escolhe) vlog/trabalho/<data>/edl.json
   → node vlog/renderizar.js <data>      → vlog/postar/<data>/
   → node vlog/compilar.js --de A --ate B → vlog/postar/compilado-A_B/
```
Saída de cada data: `youtube-16x9.mp4`, `reels-9x16.mp4`, `capa-youtube.jpg` (1280x720),
`capa-reels.jpg` (1080x1920), `descricao-youtube.txt`, `legenda-reels.txt`, `capitulos.txt`,
`youtube.srt`, `reels.srt`.

## Passo 1 — analisar (uma vez, para todas as datas)
```bash
node vlog/analisar.js                       # brutos em vlog/brutos/
node vlog/analisar.js --brutos "D:\Videos\viagem"   # outra pasta
node vlog/analisar.js --data 2025-11-24     # só uma data
```
Primeira vez: `node vlog/instalar-ferramentas.js` (baixa o whisper.cpp). Sem transcrição:
`--sem-transcricao` (o edl funciona igual, só não há legenda).

## Passo 2 — "assistir" o dia (sem abrir os vídeos)
1. `vlog/trabalho/<data>/analise.json`: lista de clipes **na ordem do dia** (índice = posição em
   `clipes`), duração, orientação, `temAudio`, `tremido` (0–1), `falas` com tempo, `silencios`, `cenas`.
2. A transcrição (`falas` de cada clipe / `transcricao.srt`): o que foi dito e quando.
3. **Olhe cada folha de contato com Read** (`folhas/<clipe>.jpg`, grade 4x4 com o tempo em cada quadro).
   Para ver de perto: `quadros[]` do analise.json, ou extraia você mesmo:
   `ffmpeg -ss 12.5 -i <clipe> -frames:v 1 -vf scale=640:-2 /tmp/q.jpg` e Read.
4. Anote em `vlog/trabalho/<data>/notas.md`: clipe → o que acontece, momentos fortes (tempo), lixo.

## Passo 3 — escolher os momentos (critérios)
- **Comece com o momento mais forte** (reação, vista, frase de impacto) — 3 a 6 s — e depois volte
  para a ordem do dia. Esse primeiro corte tem `"melhor": true`.
- **História do dia**: chegada/contexto → ponto alto → fechamento (despedida, pôr do sol, "até amanhã").
  Capítulos acompanham essa história (`capitulo` em cada corte; mínimo 3 capítulos de ≥ 10 s para o
  YouTube mostrar; trechos seguidos com o mesmo nome viram um capítulo só).
- **Corte**: silêncios (`silencios`), início/fim tremido ou de bolso, repetições (a mesma frase dita
  2 vezes: fique com a melhor), falas sem contexto, "ééé", câmera apontando para o chão.
- Corte **entre frases**, nunca no meio de uma palavra: use `falas[].ini/fim` com 0,2–0,4 s de folga.
- Trechos de 3–15 s; vista/paisagem sem fala ≤ 6 s; fala pode ser mais longa se for boa.
- **Longo**: 8–20 min se houver material (com pouco material, o que der — não estique).
- **Curto**: 30–60 s, só o melhor; o 1º corte é o gancho visual (algo acontecendo já no quadro 1);
  `gancho` = texto de até 6 palavras (skill `ganchos-reels`) que aparece nos 2 primeiros segundos.
- `tremido` ≥ 0,6 recebe estabilização leve automática; muito tremido (> 0,85) evite.
- Marque `"melhor": true` em 1–3 cortes do dia: são eles que entram no compilado.

## Passo 4 — escrever `vlog/trabalho/<data>/edl.json`
```json
{
  "data": "2025-11-24", "titulo": "Um dia em Ouro Preto",
  "longo": {
    "cortes": [
      { "clipe": 1, "ini": 7.0, "fim": 11.6, "capitulo": "Chegada", "legenda": true, "melhor": true },
      { "clipe": 0, "ini": 1.2, "fim": 12.6, "capitulo": "Chegada", "legenda": true },
      { "clipe": 1, "ini": 0.6, "fim": 6.8, "capitulo": "Igreja de ouro", "legenda": true },
      { "clipe": 3, "ini": 0.8, "fim": 14.6, "capitulo": "Pôr do sol", "legenda": true, "melhor": true }
    ],
    "transicao": "corte", "trilha": null, "intro": "Ouro Preto · 24/11/2025"
  },
  "curto": {
    "cortes": [
      { "clipe": 1, "ini": 7.0, "fim": 11.6, "foco": "centro" },
      { "clipe": 2, "ini": 2.0, "fim": 6.0, "foco": "fundo" },
      { "clipe": 3, "ini": 1.0, "fim": 5.6, "foco": "rosto" }
    ],
    "gancho": "O lugar mais bonito que eu já vi", "duracaoMax": 60
  },
  "capa": { "texto": "Ouro Preto em 1 dia" },
  "youtube": { "titulo": "...", "descricao": "...", "tags": ["ouro preto", "vlog de viagem"] },
  "reels": { "legenda": "...", "hashtags": ["#ouropreto", "#viagem"] }
}
```
Exemplos completos: `vlog/exemplos/2025-11-24/edl.json` e `2025-11-25/edl.json`.

| Campo | Valores |
|---|---|
| `clipe` | índice em `analise.clipes` (0, 1, …) **ou** o nome do arquivo |
| `ini`/`fim` | segundos dentro do clipe |
| `transicao` | `corte` (padrão, ritmo de vlog), `fade` (dip rápido para preto), `zoom` (punch-in de 0,35 s) |
| `legenda` | `true` em **todos** os cortes = legenda queimada no longo (o `.srt` sai sempre) |
| `foco` (curto) | `centro`, `esquerda`, `direita`, `rosto` (MediaPipe/OpenCV se instalados, senão centro), `fundo` (vídeo inteiro sobre fundo desfocado). Vídeo vertical: só escala, foco ignorado |
| `trilha` | caminho de um .mp3/.wav sem direitos autorais (fica a 12% por baixo da voz) ou `null` |
| `capa` | `{ "texto": "≤ 5 palavras", "youtube": {"clipe":1,"t":9.2}, "reels": {"clipe":3,"t":2} }` (opcional; padrão = trecho "melhor" na orientação certa) |
| `estabilizar` | `false` desliga a estabilização automática |

Textos: título do YouTube ≤ 70 caracteres com a palavra-chave no começo; descrição com 2–3 frases
(os capítulos são adicionados sozinhos); 5–15 tags; legenda do Reels começando pelo gancho + 1
pergunta; 3–8 hashtags. Padrões do canal em `vlog/canal.json` (nome, @, cores, fontes, hashtags).

## Passo 5 — renderizar e conferir
```bash
node vlog/renderizar.js 2025-11-24 --validar   # só checa o edl (mensagens dizem o corte e o campo)
node vlog/renderizar.js 2025-11-24             # gera tudo em vlog/postar/2025-11-24/
node vlog/renderizar.js 2025-11-24 --so curto  # refaz só uma versão
```
Rodar de novo é rápido: segmentos que não mudaram ficam em cache (`vlog/trabalho/<data>/render/`).
NVENC (placa NVIDIA) é usado sozinho se existir; `VLOG_ENCODER=libx264` força CPU,
`VLOG_PRESET=veryfast` acelera o libx264.

Conferir (obrigatório):
```bash
ffprobe -v error -show_entries stream=codec_name,profile,width,height,r_frame_rate,sample_rate:format=duration -of compact=p=0 vlog/postar/<data>/youtube-16x9.mp4
ffmpeg -hide_banner -i vlog/postar/<data>/reels-9x16.mp4 -af loudnorm=print_format=summary -f null - 2>&1 | grep "Input Integrated"
for t in 1 30 90; do ffmpeg -loglevel error -y -ss $t -i vlog/postar/<data>/youtube-16x9.mp4 -frames:v 1 -vf scale=960:-2 /tmp/l_$t.jpg; done
ffmpeg -loglevel error -y -ss 1 -i vlog/postar/<data>/reels-9x16.mp4 -frames:v 1 -vf scale=540:-2 /tmp/c_1.jpg
```
**Olhe os quadros e as capas com Read**: título legível, legenda sem cobrir rosto, gancho nos
primeiros 2 s, enquadramento 9:16 com a pessoa dentro, nada importante nos 250 px de cima e 340 px
de baixo do 9:16. Esperado: H.264 High, 1920x1080 / 1080x1920, 30/1, AAC 48000, ≈ -14 LUFS.
Leia `capitulos.txt` e os `.srt` (`node .claude/skills/legendas-srt/checar-srt.mjs vlog/postar/<data>/youtube.srt`).

## Passo 6 — compilado (depois de todas as datas)
```bash
node vlog/compilar.js --de 2025-11-24 --ate 2025-11-30 [--max-minutos 10] [--max-curto 60]
```
Usa os cortes `"melhor": true` de cada dia (senão os 3 maiores), abre com 4 s do melhor trecho,
cartela de data entre os dias, capítulo por dia; o curto pega o começo do curto de cada dia com a
data no canto. Títulos/gancho/textos: escreva `vlog/trabalho/compilado-<de>_<ate>.json`
(`{ "titulo", "gancho", "capa": {"texto"}, "youtube": {...}, "reels": {...}, "transicao" }`) e rode de novo.

## Como o orquestrador divide (regra do escritório: ≥ 4 agentes em paralelo + contrato)
Siga `contrato-paralelo`. Contrato do pedido em `entregas/<aaaa-mm-dd>-vlog/CONTRATO.md` apontando
para `vlog/CONTRATO.md`. **Cada data é uma frente própria.**

**Onda 0** (orquestrador): `node vlog/analisar.js` (ou já existe) e escreve o contrato com a lista de datas.

**Onda 1** — todas numa única resposta, várias chamadas Agent:
| Agente | Frente | Escreve só em |
|---|---|---|
| `editor-vlog` × N (um por data) | notas + edl.json + render da sua data | `vlog/trabalho/<data>/` (+ `vlog/postar/<data>/` via script) |
| `roteirista` | títulos do YouTube (3 opções por data) e ganchos do curto (skill `ganchos-reels`), lendo a transcrição | `entregas/<proj>/roteiro/titulos-<data>.md` |
| `designer` | confere/propõe cor e texto das capas (`vlog/canal.json` é do usuário: só sugere) e escolhe o quadro da capa | `entregas/<proj>/design/capas-<data>.md` |
| `social-media` | legenda do Reels + hashtags e tags do YouTube por data | `entregas/<proj>/social/post-<data>.md` |
| `revisor` | pré-revisão: contrato, notas e edl de cada data (história, duração, cortes no meio de fala) | `entregas/<proj>/revisao/onda1.md` |

Mínimo 4 em paralelo mesmo com 1 data: editor-vlog + roteirista + social-media + revisor (+ designer).
Com muitas datas (> 6), dispare em lotes de até 6 editores por onda.

**Onda 2**: cada `editor-vlog` aplica títulos/ganchos/legendas das outras frentes no `edl.json`
(campos `youtube`, `reels`, `curto.gancho`, `capa`) e roda `renderizar.js` de novo (rápido: cache);
`revisor` revisa `vlog/postar/<data>/` de cada data (skill `checklist-qa`, tipo vídeo) em paralelo;
1 `editor-vlog` roda o `compilar.js` assim que as datas estiverem prontas.

**Onda 3**: correções dos bloqueantes + revisão final do compilado; entrega com `checklist-entrega`.
