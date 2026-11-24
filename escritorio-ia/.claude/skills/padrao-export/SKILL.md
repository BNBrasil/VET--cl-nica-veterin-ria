---
name: padrao-export
description: Use ao exportar qualquer vídeo final ou intermediário - specs obrigatórias (H.264 High, AAC 48 kHz, 1080x1920 para 9:16 e 1920x1080 para 16:9, 30 fps, bitrates, -14 LUFS, faststart), nomes de arquivo e versão, pastas, e como conferir com ffprobe. Inclui script que exporta as duas versões de uma vez.
---

# Padrão de exportação

Script pronto: [`export.sh`](export.sh)
```bash
bash .claude/skills/padrao-export/export.sh <entrada> <slug> <versao> [blur|crop|pad] [legenda.srt] [pasta_saida]
# ex.: bash .claude/skills/padrao-export/export.sh bruto/gravacao.mov dica-ffmpeg 01 blur roteiro/legenda.srt entregas/2026-11-24-dica/video
```
Gera `<slug>_9x16_v01.mp4`, `<slug>_16x9_v01.mp4`, `<slug>_thumb_9x16.jpg`, `<slug>_thumb_16x9.jpg`
e imprime o relatório ffprobe para colar no `cortes.md`. Nunca sobrescreve: recusa se o arquivo
já existir (atenção: o ffmpeg 6.1 com `-n` não sobrescreve mas sai com código 0, então confira
existência antes em scripts).

## Specs
| Item | 9:16 (Reels, Shorts, TikTok) | 16:9 (YouTube, site) |
|---|---|---|
| Resolução | 1080x1920 | 1920x1080 |
| FPS | 30 (constante) | 30 (ou 24/60 se o bruto for) |
| Vídeo | H.264 High, `yuv420p`, CRF 18–20, preset `slow`/`medium` | igual |
| Bitrate alvo (se exigir CBR/VBR) | 8–12 Mbps (máx. 15) | 10–16 Mbps |
| GOP | 2 s (`-g 60`) | 2 s |
| Áudio | AAC-LC 48 kHz estéreo 192 kbps | igual |
| Loudness | -14 LUFS integrado, pico ≤ -1,5 dBTP | -14 LUFS |
| Contêiner | MP4 com `-movflags +faststart` | igual |
| Legenda | queimada (+ .srt separado) | .srt separado (suave) |
| Duração | Reels ≤ 90 s, Shorts ≤ 60 s (confira a plataforma) | livre |
| Thumbnail | 1080x1920 JPG | 1280x720 JPG (< 2 MB) |

Área segura 9:16: nada importante nos **250 px de cima** e **340 px de baixo**, nem nos 120 px
da direita (botões).

## Comando base (o que o script faz)
```bash
ffmpeg -n -i entrada.mp4 \
  -vf "<reenquadramento>,fps=30,format=yuv420p" \
  -c:v libx264 -profile:v high -crf 19 -preset medium -g 60 \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11" -ar 48000 -ac 2 -c:a aac -b:a 192k \
  -movflags +faststart saida.mp4
```

## Nomes e pastas
- `<slug>_<formato>_v<NN>.mp4` — slug em minúsculas, sem acento, com hífen: `dica-ffmpeg_9x16_v01.mp4`.
- Versão nova = número novo (`v02`); nunca sobrescreva uma versão já entregue.
- Variantes: `_leg` (legenda queimada), `_semtrilha`, `_teaser`.
- Pastas: `entregas/<projeto>/video/` (finais), `.../video/tmp/` (intermediários, podem ser apagados
  pelo editor — **o bruto, nunca**).

## Conferir (obrigatório antes de entregar)
```bash
ffprobe -v error -show_entries stream=codec_name,profile,width,height,r_frame_rate,pix_fmt,sample_rate,channels:format=duration,bit_rate -of default=nw=1 saida.mp4
ffmpeg -hide_banner -i saida.mp4 -af loudnorm=print_format=summary -f null - 2>&1 | grep -E "Input Integrated|Input True Peak"
```
Esperado: `h264`/`High`, largura/altura certas, `30/1`, `yuv420p`, `aac` 48000 2 canais, ≈ -14 LUFS.
