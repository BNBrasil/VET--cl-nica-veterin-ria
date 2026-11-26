# Produção de vídeo do canal gamer

Gera o vídeo vertical (TikTok / Reels) a partir de uma `pauta.json` (formato em `CONTRATO.md`).
Tudo offline e grátis: narração com **Piper**, edição com **ffmpeg**, efeitos e trilhas gerados por código.

## Instalar (uma vez)
- **ffmpeg**: no Windows o `INICIAR.bat` instala (winget `Gyan.FFmpeg`). Linux: `sudo apt install ffmpeg`; mac: `brew install ffmpeg`.
- **Voz**: `node producao/instalar-voz.js` — baixa o Piper e as vozes pt-BR (`faber` = padrão, `cadu`, `jeff`) para
  `producao/voz/` e cria `producao/voz/.pronto`. Idempotente (`--forcar` refaz, `--pip` usa `pip install piper-tts`).

## Usar
```bash
node producao/montar.js producao/exemplos/gta6-confirmado.json
#   --voz-falsa   testa sem Piper (tom com a duração estimada)
#   --trilha pulso|lofi|hype|minhas|nenhuma|caminho.mp3
#   --rapido      encode mais rápido (prévia)   --manter  guarda os intermediários
node producao/tts.js "GTA VI por R$ 349,90 no PS5" teste.wav --modelo pt_BR-cadu-medium
```
Saída em `producao/saida/<id>/`: `video.mp4` (1080x1920, H.264 High, 30 fps, AAC 48 kHz, -14 LUFS, faststart, ≤ 60 s),
`legenda.srt`, `capa.jpg`, `post.json` (estado `pronto`). Leva ~1 min por vídeo de 30 s num PC de 4 núcleos.

## Pauta: extras opcionais
- `"destaque": "GTA VI"` na cena: palavra pintada na cor de destaque no título.
- `"selo": "OFICIAL"`: etiqueta vermelha (no gancho o padrão vem do `tipo`: ÚLTIMA HORA / PROMOÇÃO / LANÇAMENTO).
- `*palavra*` na `fala`: força o destaque daquela palavra na legenda (o asterisco não é falado).
- `imagem`: caminho (relativo à pauta) ou URL (baixada para `producao/trabalho/`); exige `credito`.
  Só use imagem com direito de uso (kit de imprensa oficial, capa da loja, arte gerada).

## Personalizar
- `producao/canal.json`: nome, @, cores, fontes (`"fonte"`/`"fonteTitulo"` = caminho do .ttf), voz, trilha e volume.
  Sem fonte configurada usa Impact/Arial Black/Segoe UI Bold (Windows) ou Inter/DejaVu Sans Bold (Linux).
- `producao/pronuncia.json`: como a voz fala siglas e nomes (`"GTA": "gê tê á"`). Acento agudo marca a sílaba forte.
- `producao/sons/`: efeitos (`whoosh`, `pop`, `ding`, `riser`, `impacto`, `clique`) e trilhas (`pulso`, `lofi`, `hype`)
  gerados na 1ª montagem; apague um .wav para gerar de novo.
- `producao/sons/minhas/`: suas trilhas. **Só música livre de direitos** (sua, licenciada ou de biblioteca com licença clara);
  música com direitos derruba o vídeo ou a conta. Use `"trilha": "minhas"` no canal.json.

## Como funciona
`tts.js` normaliza o texto (preços, %, datas, horas, siglas, nomes de jogos) → Piper → cadeia de locução no ffmpeg
(passa-alta, EQ, de-esser, compressor, corte de silêncio, -16 LUFS) com cache por hash. `montar.js` mede cada fala,
monta a linha do tempo (cena = áudio + 0,3 s), gera os fundos (gradiente animado com grade ou imagem com Ken Burns),
desenha tudo que é texto num arquivo ASS (`lib/ass.js`: legenda dinâmica, gancho, cards, faixa, marca, barra de
progresso, transições) — texto em arquivo, sem problema de escape de `:`/`%`/aspas — e mixa voz + trilha com ducking +
efeitos (`lib/audio.js`), normalizando em -14 LUFS.

Testes: `npm test` (`test/producao-video.test.js`; a montagem usa voz falsa e só roda se houver ffmpeg).
