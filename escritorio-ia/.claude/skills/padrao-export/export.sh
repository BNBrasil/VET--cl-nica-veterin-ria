#!/usr/bin/env bash
# Exporta um vídeo nas versões 9:16 e 16:9 seguindo a skill padrao-export.
# Uso: export.sh <entrada> <slug> <versao> [blur|crop|pad] [legenda.srt] [pasta_saida]
set -euo pipefail
IN="${1:?entrada}"; SLUG="${2:?slug}"; VER="${3:?versao ex.: 01}"
MODO="${4:-blur}"; SRT="${5:-}"; OUT="${6:-.}"
mkdir -p "$OUT"
[ -f "$IN" ] || { echo "entrada não encontrada: $IN" >&2; exit 1; }

reenq() { # $1=W $2=H -> filtro de vídeo com saída [v]
  local W=$1 H=$2
  case "$MODO" in
    crop) echo "[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1[r]" ;;
    pad)  echo "[0:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black,setsar=1[r]" ;;
    *)    echo "[0:v]split[a][b];[a]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=20:5[bg];[b]scale=${W}:${H}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1[r]" ;;
  esac
}

exporta() { # $1=W $2=H $3=rotulo $4=estilo_legenda
  local W=$1 H=$2 R=$3 dst="$OUT/${SLUG}_${3}_v${VER}.mp4" vf
  if [ -e "$dst" ]; then echo "já existe: $dst (use outra versão)" >&2; exit 1; fi
  vf="$(reenq "$W" "$H");[r]fps=30,format=yuv420p"
  if [ -n "$SRT" ]; then
    vf="$vf,subtitles=${SRT_SEGURO}:force_style='$4'"
  fi
  vf="$vf[v]"
  local audio=(); ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$IN" | grep -q . \
    && audio=(-map 0:a:0 -af "loudnorm=I=-14:TP=-1.5:LRA=11" -ar 48000 -ac 2 -c:a aac -b:a 192k)
  ffmpeg -hide_banner -loglevel error -n -i "$IN" -filter_complex "$vf" -map "[v]" "${audio[@]}" \
    -c:v libx264 -profile:v high -crf 19 -preset medium -g 60 -movflags +faststart "$dst"
  ffmpeg -hide_banner -loglevel error -n -i "$dst" -ss "$(awk -v d="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$dst")" 'BEGIN{print d/3}')" \
    -frames:v 1 -q:v 2 "$OUT/${SLUG}_thumb_${R}.jpg"
  echo "== $dst"
  ffprobe -v error -show_entries stream=codec_name,profile,width,height,r_frame_rate,pix_fmt,sample_rate,channels:format=duration -of compact=p=0 "$dst"
}

# Copia a legenda para um caminho sem espaços/aspas/dois-pontos (o filtro subtitles exige escape).
SRT_SEGURO=""
if [ -n "$SRT" ]; then
  TMPD=$(mktemp -d); trap 'rm -rf "$TMPD"' EXIT
  cp "$SRT" "$TMPD/legenda.srt"; SRT_SEGURO="$TMPD/legenda.srt"
fi

exporta 1080 1920 9x16 "FontName=DejaVu Sans,FontSize=12,Bold=1,Outline=1.5,Shadow=0,Alignment=2,MarginV=60"
exporta 1920 1080 16x9 "FontName=DejaVu Sans,FontSize=16,Bold=1,Outline=1.5,Shadow=0,Alignment=2,MarginV=20"
echo "Bruto preservado: $IN"
