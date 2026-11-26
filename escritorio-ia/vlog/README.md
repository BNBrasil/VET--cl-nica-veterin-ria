# Vlog: jogue os vídeos, peça "edite meu vlog", poste

O escritório assiste os seus vídeos brutos, escolhe os melhores momentos de cada dia e entrega,
**para cada dia**, um vídeo longo para o YouTube e um curto para o Reels — com capa, legenda,
título, descrição, capítulos e hashtags prontos. No fim, faz um compilado com os melhores momentos.

## 1. Onde jogar os vídeos
Copie os vídeos do celular/câmera para **`escritorio-ia/vlog/brutos/`**.
- Pode jogar tudo misturado: o escritório descobre o dia de cada vídeo pelo nome
  (`VID_20251124_153012.mp4`, `PXL_...`, `WhatsApp Video 2025-11-24 ...`) ou pela data de gravação.
- Se preferir organizar, use uma subpasta por dia: `vlog/brutos/2025-11-24/`.
- Seus vídeos ficam lá do jeito que estão: **nada em `vlog/brutos/` é apagado ou alterado.**
- Os vídeos estão em outra pasta (ex.: HD externo)? Diga no chat: *"edite meu vlog, os vídeos estão em D:\Videos\viagem"*.

## 2. O que pedir no chat
- **"edite meu vlog"** — faz todos os dias que estão na pasta.
- **"faça os vídeos do dia 24/11"** — só um dia.
- **"faça um compilado de 24/11 a 30/11"** — melhores momentos de vários dias num vídeo só.
- Ajustes depois de ver: *"no dia 24 tira a parte do restaurante"*, *"o reels do dia 25 começa com a cachoeira"*,
  *"troca o título"*. Refazer é rápido.

## 3. Onde pegar os arquivos prontos
Em **`escritorio-ia/vlog/postar/<data>/`** (ex.: `vlog/postar/2025-11-24/`):

| Arquivo | Para quê |
|---|---|
| `youtube-16x9.mp4` | vídeo do YouTube (1920x1080) |
| `capa-youtube.jpg` | miniatura do YouTube (1280x720) |
| `descricao-youtube.txt` | título, descrição (com capítulos) e tags: copie e cole |
| `youtube.srt` | legenda: no YouTube Studio → Legendas → Enviar arquivo |
| `reels-9x16.mp4` | Reels/Shorts/TikTok (1080x1920, até 60 s, legenda já no vídeo) |
| `capa-reels.jpg` | capa do Reels |
| `legenda-reels.txt` | legenda do post + hashtags |
| `capitulos.txt`, `reels.srt` | capítulos e legenda do curto em separado |

O compilado fica em `vlog/postar/compilado-<de>_<ate>/`, com os mesmos arquivos.

## 4. Personalizar o canal (opcional)
Edite **`vlog/canal.json`**: nome do canal, `@`, cor de destaque (`#FFD400` = amarelo), hashtags e tags
que entram sempre. Fonte: no Windows usa Impact/Arial Black (legenda) e Arial Negrito (títulos); para
outra, ponha por exemplo `"fontes": { "legenda": { "arquivo": "C:/Windows/Fonts/segoeuib.ttf", "nome": "Segoe UI" } }`.

## 5. Precisa instalar?
- **ffmpeg**: o `INICIAR.bat` instala. Se o PC tiver placa NVIDIA (ex.: GTX 1650 Super), o render usa a placa
  sozinho e fica bem mais rápido.
- **Transcrição** (para legendas e para o escritório "ouvir" o vídeo): `node vlog/instalar-ferramentas.js` (uma vez).
- **Enquadrar o rosto no Reels** (opcional): instale Python e rode `pip install mediapipe opencv-python`.
  Sem isso o Reels usa o centro da imagem.

## Para quem quer rodar na mão
```bash
node vlog/analisar.js                                   # analisa os brutos → vlog/trabalho/<data>/
node vlog/renderizar.js 2025-11-24                      # precisa do vlog/trabalho/2025-11-24/edl.json
node vlog/renderizar.js 2025-11-24 --validar            # só confere o edl.json
node vlog/compilar.js --de 2025-11-24 --ate 2025-11-30  # compilado (--max-minutos 10 --max-curto 60)
node vlog/exemplos/gerar-clipes.js                      # cria 2 dias de vídeos de teste + edl de exemplo
```
O `edl.json` (lista de cortes) é escrito pelo agente **editor-vlog**; formato em `vlog/CONTRATO.md` e na
skill `.claude/skills/vlog-edicao/SKILL.md`. Variáveis úteis: `VLOG_BRUTOS` (pasta dos brutos),
`VLOG_ENCODER=libx264` (não usar a placa), `VLOG_PRESET=veryfast` (render mais rápido na CPU).
