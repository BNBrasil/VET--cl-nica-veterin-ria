#!/usr/bin/env bash
# Testa os comandos principais da skill cortes-ffmpeg com um vídeo sintético.
# Uso: bash testar.sh [pasta_de_trabalho]   (padrão: pasta temporária)
set -euo pipefail
W="${1:-$(mktemp -d)}"; mkdir -p "$W"; cd "$W"
q() { ffmpeg -hide_banner -loglevel error "$@"; }
ok() { echo "OK  $1"; }

q -y -f lavfi -i testsrc=size=1920x1080:rate=30 -f lavfi -i sine=frequency=440:sample_rate=48000 \
  -t 12 -c:v libx264 -pix_fmt yuv420p -g 30 -c:a aac bruto.mp4 && ok "bruto sintético"
cat > legenda.srt <<'SRT'
1
00:00:00,500 --> 00:00:02,500
Você ainda edita vídeo
na mão?

2
00:00:02,600 --> 00:00:05,000
Teste de legenda queimada.
SRT

q -n -ss 2 -i bruto.mp4 -t 5 -c copy -avoid_negative_ts make_zero corte_copy.mp4 && ok "corte sem reencode"
q -n -ss 2.2 -i bruto.mp4 -t 5 -c:v libx264 -crf 18 -preset veryfast -c:a aac -b:a 192k corte_reenc.mp4 && ok "corte com reencode"
printf "file '%s'\n" corte_reenc.mp4 corte_reenc.mp4 > lista.txt
q -n -f concat -safe 0 -i lista.txt -c copy montagem.mp4 && ok "concat"
q -n -i corte_reenc.mp4 -vf "crop=ih*9/16:ih,scale=1080:1920,setsar=1" -c:v libx264 -crf 18 -preset veryfast -c:a copy crop_9x16.mp4 && ok "crop 9:16"
q -n -i corte_reenc.mp4 -filter_complex "[0:v]split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:5[bg];[b]scale=1080:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1[v]" -map "[v]" -map 0:a? -c:v libx264 -crf 18 -preset veryfast -c:a aac -b:a 192k blur_9x16.mp4 && ok "fundo desfocado 9:16"
q -n -i crop_9x16.mp4 -filter_complex "[0:v]split[a][b];[a]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,boxblur=20:5[bg];[b]scale=-2:1080[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1[v]" -map "[v]" -map 0:a? -c:v libx264 -crf 18 -preset veryfast -c:a aac blur_16x9.mp4 && ok "fundo desfocado 16:9"
q -n -i corte_reenc.mp4 -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1" -c:v libx264 -crf 18 -preset veryfast -c:a copy pad_9x16.mp4 && ok "pad 9:16"
q -n -i crop_9x16.mp4 -vf "subtitles=legenda.srt:force_style='FontName=DejaVu Sans,FontSize=12,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=1.5,Shadow=0,Alignment=2,MarginV=60'" -c:v libx264 -crf 18 -preset veryfast -c:a copy leg_9x16.mp4 && ok "legenda queimada"
q -n -i corte_reenc.mp4 -i legenda.srt -map 0 -map 1 -c copy -c:s mov_text -metadata:s:s:0 language=por softsub.mp4 && ok "legenda suave mov_text"
q -n -ss 1 -i corte_reenc.mp4 -frames:v 1 -q:v 2 thumb.jpg && ok "thumbnail quadro exato"
q -n -i corte_reenc.mp4 -vf "thumbnail=100,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2" -frames:v 1 -update 1 thumb_auto.jpg && ok "thumbnail automática"
ffmpeg -hide_banner -i corte_reenc.mp4 -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | grep -q input_i && ok "medição loudnorm"
q -n -i corte_reenc.mp4 -c:v copy -af loudnorm=I=-14:TP=-1.5:LRA=11 -ar 48000 -c:a aac -b:a 192k norm.mp4 && ok "normalização loudnorm"
q -n -i corte_reenc.mp4 -i bruto.mp4 -filter_complex "[1:a]volume=0.15,afade=t=in:d=1,afade=t=out:st=3:d=2[m];[0:a][m]amix=inputs=2:duration=first:dropout_transition=0[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k trilha.mp4 && ok "trilha mixada"

echo "--- specs"
for f in crop_9x16.mp4 blur_16x9.mp4 leg_9x16.mp4; do
  printf '%s: ' "$f"; ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,r_frame_rate -of csv=p=0 "$f"
done
echo "Pasta: $W"
