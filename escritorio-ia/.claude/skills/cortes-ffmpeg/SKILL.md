---
name: cortes-ffmpeg
description: Use para qualquer operação de vídeo/áudio com ffmpeg - inspecionar (ffprobe), cortar com e sem reencode, juntar trechos, reenquadrar para 9:16 e 16:9 (crop, pad, fundo desfocado), queimar legenda, gerar thumbnail, normalizar áudio (loudnorm), trilha com volume e fades. Comandos prontos e testados.
---

# Cortes com ffmpeg

Regra de ouro: **nunca escreva por cima do bruto**. Saída sempre em arquivo novo; use `-n`
(não sobrescreve) quando houver risco de colisão. Todos os comandos abaixo foram testados com
ffmpeg 6.1 num vídeo sintético (`testsrc`). Script de teste: [`testar.sh`](testar.sh).

## 0. Inspecionar antes de tudo
```bash
ffprobe -v error -show_entries format=duration,bit_rate:stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels -of compact=p=0 bruto.mp4
# keyframes (para saber onde o corte sem reencode cai):
ffprobe -v error -select_streams v:0 -skip_frame nokey -show_entries frame=pts_time -of csv=p=0 bruto.mp4 | head
```

## 1. Cortar
Sem reencode (rápido, sem perda; o início "gruda" no keyframe anterior):
```bash
ffmpeg -n -ss 00:00:05 -i bruto.mp4 -t 10 -c copy -avoid_negative_ts make_zero corte_01.mp4
```
Com reencode (preciso no quadro; use para cortes finais):
```bash
ffmpeg -n -ss 00:00:05.200 -i bruto.mp4 -t 10 -c:v libx264 -crf 18 -preset veryfast -c:a aac -b:a 192k corte_01.mp4
```
`-ss` antes do `-i` = busca rápida; `-t` = duração (ou `-to` = tempo final relativo ao `-ss`).

## 2. Juntar trechos
Mesmo codec/resolução/fps → concat demuxer, sem reencode:
```bash
printf "file '%s'\n" corte_01.mp4 corte_02.mp4 > lista.txt
ffmpeg -n -f concat -safe 0 -i lista.txt -c copy montagem.mp4
```
Trechos diferentes → normalize cada um antes (passo 3/padrao-export) ou use filtro concat:
```bash
ffmpeg -n -i a.mp4 -i b.mp4 -filter_complex "[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]" -map "[v]" -map "[a]" -c:v libx264 -crf 18 -c:a aac montagem.mp4
```

## 3. Reenquadrar
16:9 → 9:16, **crop central** (perde as laterais):
```bash
ffmpeg -n -i in_16x9.mp4 -vf "crop=ih*9/16:ih,scale=1080:1920,setsar=1" -c:v libx264 -crf 18 -c:a copy out_9x16.mp4
```
Crop com foco deslocado (ex.: pessoa à esquerda, x = 25% da largura):
```bash
-vf "crop=ih*9/16:ih:(iw-ih*9/16)*0.25:0,scale=1080:1920,setsar=1"
```
16:9 → 9:16 **sem perder nada, fundo desfocado** (padrão para reels de vídeo horizontal):
```bash
ffmpeg -n -i in_16x9.mp4 -filter_complex "[0:v]split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:5[bg];[b]scale=1080:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1[v]" -map "[v]" -map 0:a? -c:v libx264 -crf 18 -c:a aac -b:a 192k out_9x16.mp4
```
Qualquer → 9:16 com **barras pretas (pad)**:
```bash
-vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1"
```
9:16 → 16:9 com fundo desfocado:
```bash
ffmpeg -n -i in_9x16.mp4 -filter_complex "[0:v]split[a][b];[a]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,boxblur=20:5[bg];[b]scale=-2:1080[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1[v]" -map "[v]" -map 0:a? -c:v libx264 -crf 18 -c:a aac out_16x9.mp4
```

## 4. Queimar legenda (.srt)
9:16 (reels/shorts) — legenda acima da área da interface (~490 px do fundo):
```bash
ffmpeg -n -i video_9x16.mp4 -vf "subtitles=legenda.srt:force_style='FontName=DejaVu Sans,FontSize=12,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=1.5,Shadow=0,Alignment=2,MarginV=60'" -c:v libx264 -crf 18 -c:a copy video_9x16_leg.mp4
```
16:9 (YouTube):
```bash
ffmpeg -n -i video_16x9.mp4 -vf "subtitles=legenda.srt:force_style='FontName=DejaVu Sans,FontSize=16,Bold=1,Outline=1.5,Shadow=0,Alignment=2,MarginV=20'" -c:v libx264 -crf 18 -c:a copy video_16x9_leg.mp4
```
- Precisa de ffmpeg com libass (`ffmpeg -filters | grep subtitles`).
- `FontSize` e `MarginV` são medidos na grade padrão do libass (288 de altura), escalada para o
  vídeo: em 1920 de altura, `MarginV=60` ≈ 400 px. Valores acima de ~100 jogam a legenda para o meio.
- `Alignment=2` = embaixo centralizado (8 = topo). Caminho com `:` ou `'` precisa de escape;
  prefira rodar na pasta do .srt.
- Para conferir um quadro com legenda, ponha `-ss` **depois** do `-i` (senão o tempo zera e a
  legenda some): `ffmpeg -i v.mp4 -ss 1 -frames:v 1 -vf "subtitles=legenda.srt" teste.png`.
- Legenda **suave** (faixa selecionável, para YouTube/MP4):
```bash
ffmpeg -n -i video.mp4 -i legenda.srt -map 0 -map 1 -c copy -c:s mov_text -metadata:s:s:0 language=por video_softsub.mp4
```

## 5. Thumbnail
Quadro exato:
```bash
ffmpeg -n -ss 00:00:03 -i video.mp4 -frames:v 1 -q:v 2 thumb.jpg
```
Quadro "mais representativo" num trecho (filtro thumbnail analisa lotes de 100 quadros):
```bash
ffmpeg -n -ss 2 -i video.mp4 -t 5 -vf "thumbnail=100,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2" -frames:v 1 -update 1 thumb_auto.jpg
```
Folha de contato (escolher capa): `-vf "fps=1,scale=320:-2,tile=4x3" -frames:v 1 contato.jpg`

## 6. Áudio
Medir loudness (procure `input_i` no JSON):
```bash
ffmpeg -hide_banner -i video.mp4 -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | tail -12
```
Normalizar (1 passada, bom o bastante para redes; -14 LUFS, pico -1,5 dBTP):
```bash
ffmpeg -n -i video.mp4 -c:v copy -af loudnorm=I=-14:TP=-1.5:LRA=11 -ar 48000 -c:a aac -b:a 192k video_norm.mp4
```
2 passadas (mais preciso): rode a medição, depois passe `measured_I`, `measured_TP`,
`measured_LRA`, `measured_thresh`, `offset` e `linear=true` no segundo comando.

Trilha por baixo da voz (trilha a 15%, fade in/out, corta no fim da voz):
```bash
ffmpeg -n -i video.mp4 -i trilha.mp3 -filter_complex "[1:a]volume=0.15,afade=t=in:d=1,afade=t=out:st=28:d=2[m];[0:a][m]amix=inputs=2:duration=first:dropout_transition=0[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k video_trilha.mp4
```
Fade de vídeo e áudio (entrada 0,5 s, saída nos últimos 0,5 s de um vídeo de 30 s):
```bash
-vf "fade=t=in:d=0.5,fade=t=out:st=29.5:d=0.5" -af "afade=t=in:d=0.5,afade=t=out:st=29.5:d=0.5"
```

## 7. Utilidades
- Acelerar 1,25x: `-filter_complex "[0:v]setpts=PTS/1.25[v];[0:a]atempo=1.25[a]" -map "[v]" -map "[a]"`
- Tirar áudio: `-an`; extrair áudio: `ffmpeg -i v.mp4 -vn -c:a copy audio.m4a`
- Texto rápido na tela: `-vf "drawtext=text='OFERTA':fontcolor=white:fontsize=96:x=(w-tw)/2:y=300:box=1:boxcolor=black@0.5:boxborderw=20"`
- Vídeo de teste: `ffmpeg -f lavfi -i testsrc=size=1920x1080:rate=30 -f lavfi -i sine=frequency=440:sample_rate=48000 -t 10 -c:v libx264 -pix_fmt yuv420p -c:a aac teste.mp4`

## Depois de cada export
Confira com o `ffprobe` do passo 0 e compare com `padrao-export`. Registre os comandos em `cortes.md`.
