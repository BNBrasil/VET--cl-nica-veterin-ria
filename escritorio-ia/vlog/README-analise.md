# Vlog: análise dos brutos

Separa os vídeos por data, "vê" e "ouve" cada clipe e deixa tudo pronto para o editor escolher os momentos.
Formato dos arquivos: `vlog/CONTRATO.md` (seções 1 e 2).

## Uma vez só: instalar a transcrição (grátis, roda no seu PC)

```
node vlog/instalar-ferramentas.js                  # whisper.cpp + modelo small (~470 MB)
node vlog/instalar-ferramentas.js --modelo medium  # melhor em português (~1,5 GB); vira o padrão
```
- Windows: baixa o binário oficial do GitHub (ggml-org/whisper.cpp). Com placa NVIDIA (a GTX 1650 Super serve)
  baixa a versão CUDA 12.4 (~450 MB, já traz as DLLs; precisa de driver NVIDIA 528 ou mais novo, senão usa a
  CUDA 11.8) e também a de CPU como reserva. Testa a CUDA; se não rodar, fica com a CPU.
- Linux/mac: usa binário de release se existir, senão compila com cmake (precisa de `cmake` e compilador C++;
  com `nvcc` compila com CUDA; no mac usa Metal). Último recurso: `whisper-cli` do sistema (`brew install whisper-cpp`).
- Também baixa o detector de voz Silero (VAD, 1 MB), que evita o Whisper "inventar" fala em barulho ambiente.
- Confere sha256 dos modelos, é idempotente (rodar de novo não baixa nada) e cria `vlog/ferramentas/.pronto`.
  O `INICIAR.bat` já roda isso na primeira vez. Opções: `--cpu` (ignora a placa), `--forcar` (refaz tudo).

## Analisar

```
node vlog/analisar.js                              # usa vlog/brutos (ou a variável VLOG_BRUTOS)
node vlog/analisar.js --brutos "D:\Videos\vlog"
node vlog/analisar.js --data 2025-11-24            # só um dia
node vlog/analisar.js --modelo medium              # transcrição melhor (precisa ter instalado o medium)
node vlog/analisar.js --sem-transcricao            # só imagem/áudio, bem mais rápido
```
Outras opções: `--paralelo N` (clipes ao mesmo tempo; padrão = núcleos/4, máx. 4), `--refazer` (ignora o cache),
`--cpu` (não usa a placa no Whisper), `--rapido` (busca gulosa no Whisper: 2–3x mais rápido na CPU, pouco menos preciso).

A pasta pode ter vídeos soltos ou em subpastas. Arquivos de sistema (`.DS_Store`, `Thumbs.db`, `._*`, `.part`)
são ignorados. **Nada em `vlog/brutos/` é alterado.**

### Data de cada vídeo (nesta ordem)
1. subpasta com data: `2025-11-24`, `2025-11-24 Ouro Preto`, `24-11-2025`, `24.11.2025`, `20251124`;
2. nome do arquivo: `VID_20251124_153012`, `PXL_20251124_153012345`, `IMG_20251124_153012`, `MVIMG_…`, `20251124_153012`
   (Samsung), `VID20251124153012` (Oppo/Xiaomi), `2025-11-24 15.30.12` (Dropbox), `2025-11-24 15-30-12` (OBS),
   `video_2025-11-24_15-30-12` (Telegram), `WhatsApp Video 2025-11-24 at 15.30.12` / `at 3.30.12 PM`, `VID-20251124-WA0003`,
   `DJI_20251124153012_0001_D`, `Screen_Recording_20251124-153012`, `RPReplay_Final1700000000` (tela do iPhone);
3. metadado `creation_time` convertido para o fuso do PC (iPhone: `com.apple.quicktime.creationdate`, que já
   está na hora local; GoPro/DJI gravam a hora local marcada como UTC e não são convertidos). `GH010123`,
   `IMG_1234` e `DJI_0001` caem aqui;
4. data de modificação do arquivo — **incerta**, aparece nos avisos. Se errar, ponha o vídeo numa subpasta `AAAA-MM-DD`.

Dentro do dia os clipes ficam em ordem de horário (sem horário vão para o fim, por nome).

## O que sai (por data)
```
vlog/trabalho/<data>/
  analise.json        contrato seção 2 (+ nome, fonteData, orientacao, voz, falas[].palavras)
  transcricao.txt     leitura rápida: [clipe N] nome, horário, cada fala com o tempo dentro do clipe
  transcricao.srt     o dia todo com os clipes em sequência; cada legenda começa com [clipe N]
  folhas/<clipe>.jpg  grade 4x4 com o tempo escrito em cada quadro (1280x720; vertical 720x1280)
  quadros/<clipe>_00.jpg … _15.jpg   os mesmos 16 quadros, 480 px, para olhar de perto
vlog/trabalho/.cache/  cache por clipe (tamanho + data de modificação): rodar de novo só processa o que mudou
```
Campos: `largura`/`altura` são os do arquivo e `rotacao` (0/90/180/270) diz como girar (celular em pé =
1920x1080 + 90 → aparece 1080x1920; ver `orientacao`). `silencios` (silencedetect −35 dB, ≥ 0,6 s), `cenas`
(cortes com scene > 0,3), `energia` (sonoridade por segundo em LUFS, via ebur128), `voz` (trechos acima do
limiar adaptativo, que é o que vai para o Whisper), `tremido` (0 firme … 1 muito tremido; estimativa barata do
deslocamento global quadro a quadro — panorâmica suave e coisas mexendo na cena não contam).

Transcrição: Whisper em português só nos trechos com voz, VAD Silero, sem contexto entre janelas (evita laços),
e um filtro de alucinação (créditos tipo "Legendas pela comunidade Amara.org", "[Música]", "Obrigado por
assistir"/"Inscreva-se" quando o áudio é fraco ou a confiança baixa, frases repetidas, fala rápida demais).

## Tempos medidos (máquina de teste: 4 vCPU compartilhadas, sem GPU, whisper.cpp v1.9.6 CPU, modelo small)
Medidos com a máquina sobrecarregada por outras tarefas (carga 9–11 em 4 núcleos), então são o pior caso:
- análise (ffprobe + sinais + folha + 16 quadros): clipe 1080p30 de 3 min em 16 s ≈ **5 s por minuto de vídeo**;
  clipes curtos de 720p ficam em 3–10 s cada (o custo fixo da folha domina);
- transcrição `small` na CPU, busca padrão (beam 5): ≈ **3 min por minuto de fala** (1:08 de fala em 204 s);
  com `--rapido` (beam 1) o mesmo trecho ficou 3–7x mais rápido. Só os trechos com voz vão para o Whisper:
  silêncio e barulho ambiente não custam nada;
- instalar no Linux (compilar o whisper.cpp 1.9.6 + baixar o small 466 MB + VAD): ~3 min.

No PC do canal (Ryzen 7 5700X 16 threads + GTX 1650 Super com CUDA) a análise deve ficar ~3–4x mais rápida
(4 clipes em paralelo) e a transcrição na placa de vídeo bem abaixo de 1x o tempo real com o `small`.
