# Vlog: de uma pasta de cortes brutos para vídeos prontos para postar

Fonte da verdade entre as frentes. Node >= 18, ES modules, sem dependências npm novas. Programas
externos grátis: ffmpeg, whisper.cpp (transcrição local). Python + MediaPipe é OPCIONAL (só para
enquadramento inteligente do rosto no 9:16). Tudo em português.

## Fluxo
```
vlog/brutos/  (vídeos do celular/câmera, misturados ou em subpastas)
   │ node vlog/analisar.js            (frente ANÁLISE)
   ▼
vlog/trabalho/<data>/analise.json + folhas/*.jpg + transcricao.srt
   │ agente editor-vlog LÊ a transcrição e OLHA as folhas de quadros (Read), escolhe os momentos
   ▼
vlog/trabalho/<data>/edl.json        (lista de cortes: versão longa 16:9 e curta 9:16)
   │ node vlog/renderizar.js <data>   (frente RENDER)
   ▼
vlog/postar/<data>/  youtube-16x9.mp4, reels-9x16.mp4, capa-*.jpg, descricao-youtube.txt,
                     legenda-reels.txt, capitulos.txt, legendas *.srt
   │ depois de todas as datas: node vlog/compilar.js --de AAAA-MM-DD --ate AAAA-MM-DD
   ▼
vlog/postar/compilado-<de>_<ate>/  (mesmos arquivos, com os melhores momentos de cada dia)
```
`vlog/brutos/`, `vlog/trabalho/`, `vlog/postar/` e `vlog/ferramentas/` ficam no .gitignore. A pasta dos brutos
pode ser outra: `VLOG_BRUTOS=D:\Videos\vlog` ou `--brutos <pasta>`.

## 1. Datas (`vlog/lib/datas.js`, frente ANÁLISE)
Ordem de prioridade para descobrir a data de cada vídeo:
1. nome da subpasta `AAAA-MM-DD` (ou `DD-MM-AAAA`);
2. padrão no nome do arquivo: `VID_20251124_153012`, `PXL_20251124_...`, `IMG_20251124`, `20251124_153012`,
   `2025-11-24 15.30.12`, `WhatsApp Video 2025-11-24 at ...`, `GH010123` (GoPro: usa o metadado);
3. metadado `creation_time` do ffprobe (convertido para o fuso local);
4. data de modificação do arquivo (avisa no relatório que é incerta).
Ordena os clipes de cada dia pelo horário.

## 2. `analise.json` (por data)
```json
{
  "data": "2025-11-24",
  "clipes": [{
    "arquivo": "C:/.../VID_20251124_153012.mp4", "inicioDoDia": "15:30:12", "duracao": 84.2,
    "largura": 1920, "altura": 1080, "fps": 30, "rotacao": 0, "temAudio": true,
    "falas":    [{ "ini": 3.2, "fim": 7.9, "texto": "olha que lugar incrível" }],
    "silencios":[{ "ini": 0, "fim": 2.1 }],
    "cenas":    [0, 12.4, 33.0],
    "energia":  [{ "t": 0, "rms": -32.5 }],
    "tremido": 0.2,
    "folha": "folhas/VID_20251124_153012.jpg",
    "quadros": [{ "t": 0, "img": "quadros/VID_..._0000.jpg" }]
  }],
  "resumo": { "totalSegundos": 0, "comFala": 0 }
}
```
- `folha`: imagem única (grade 4x4) com quadros espaçados do clipe e o tempo escrito em cada um, para o agente
  "ver" o clipe gastando pouco. `quadros`: os mesmos em arquivos separados (para olhar mais de perto).
- Transcrição: whisper.cpp com modelo `small` (padrão; `medium` opcional, melhor em português), idioma `pt`,
  com timestamps; filtra alucinações em trechos sem voz (só transcreve onde o volume passa de um limiar).
- `vlog/instalar-ferramentas.js`: baixa o whisper.cpp (binário oficial Windows; Linux/mac: compila ou usa o
  binário) e o modelo para `vlog/ferramentas/`. Cria o marcador `vlog/ferramentas/.pronto`.

## 3. `edl.json` (o agente escreve; `renderizar.js` lê)
```json
{
  "data": "2025-11-24", "titulo": "Um dia em Ouro Preto",
  "longo": {
    "cortes": [{ "clipe": 0, "ini": 3.0, "fim": 21.5, "capitulo": "Chegada", "legenda": true }],
    "transicao": "corte | fade | zoom", "trilha": null, "intro": "Ouro Preto · 24/11/2025"
  },
  "curto": {
    "cortes": [{ "clipe": 2, "ini": 10.0, "fim": 16.0, "foco": "rosto | centro | esquerda | direita" }],
    "gancho": "O lugar mais bonito que eu já vi", "duracaoMax": 60
  },
  "youtube": { "titulo": "...", "descricao": "...", "tags": ["vlog"] },
  "reels":   { "legenda": "...", "hashtags": ["#vlog"] }
}
```

## 4. Render (`vlog/renderizar.js <data>`, `vlog/compilar.js`)
- Longo 16:9: 1920x1080, 30 fps, H.264 High, AAC 48 kHz, -14 LUFS, faststart. Cortes com micro-fades de áudio
  (sem estalos), transição escolhida, título de abertura, capítulos em `capitulos.txt` (formato do YouTube:
  `00:00 Abertura`), legenda `.srt` a partir da transcrição (e queimada só se `legenda: true` em todos).
- Curto 9:16: 1080x1920, ≤ 60 s (ou `duracaoMax`), gancho escrito nos 2 primeiros segundos, legenda dinâmica
  queimada (blocos de 2–4 palavras), enquadramento: `rosto` (MediaPipe se instalado, senão cai para `centro`),
  `centro`/`esquerda`/`direita` = recorte fixo, vídeo vertical original = só escala; alternativa "fundo
  desfocado" quando o recorte cortaria demais.
- Corrige rotação de celular, mistura fps diferentes, clipes sem áudio (silêncio), estabilização leve opcional
  (`deshake`) se `tremido` alto.
- Compilado: pega os melhores trechos de cada dia (de cada edl.json, ou das marcações `"melhor": true`), com
  cartela de data entre os dias, e gera longo + curto.
- Não apaga nem altera NADA em `vlog/brutos/`.
