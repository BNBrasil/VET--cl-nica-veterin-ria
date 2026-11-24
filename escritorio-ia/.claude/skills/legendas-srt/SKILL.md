---
name: legendas-srt
description: Use para criar, corrigir, sincronizar ou validar legendas .srt (e converter para .vtt) - formato exato do arquivo, regras de quebra (42 caracteres por linha, 2 linhas, tempo mínimo e máximo, velocidade de leitura), como gerar a partir do roteiro e como checar automaticamente.
---

# Legendas .srt

Validador: [`checar-srt.mjs`](checar-srt.mjs) → `node .claude/skills/legendas-srt/checar-srt.mjs legenda.srt`
(sai com código 1 se houver erro; avisos não reprovam).

## Formato (exato)
```
1
00:00:00,500 --> 00:00:02,400
Você ainda edita vídeo
na mão?

2
00:00:02,500 --> 00:00:04,800
Dá pra fazer tudo
no terminal.
```
- Número sequencial a partir de 1; tempo `HH:MM:SS,mmm` (**vírgula** no .srt; ponto no .vtt).
- Linha em branco entre blocos; arquivo em **UTF-8** (sem BOM, de preferência), fim de linha LF.
- Sem tags de cor/estilo, salvo `<i>` para fala em off / palavra estrangeira.

## Regras de quebra e tempo
| Regra | Valor |
|---|---|
| Caracteres por linha | **≤ 42** (9:16 queimada: prefira ≤ 32) |
| Linhas por bloco | **≤ 2** |
| Duração mínima | **1,0 s** (ideal ≥ 1,5 s) |
| Duração máxima | **7 s** |
| Velocidade de leitura | ≤ **17 caracteres/s** (CPS) |
| Intervalo entre blocos | ≥ 2 quadros (~ 80 ms a 30 fps), sem sobreposição |

Onde quebrar a linha (em ordem de preferência):
1. Depois de pontuação (`.`, `,`, `?`, `:`).
2. Antes de conjunção ou preposição (`e`, `mas`, `que`, `de`, `para`, `com`).
3. Nunca separe artigo do substantivo ("o / vídeo"), nem nome e sobrenome, nem número e unidade.
4. Prefira linha de baixo maior ou igual à de cima (formato pirâmide).
Uma frase por bloco quando possível; frase longa → 2 blocos consecutivos.

## Do roteiro para .srt
1. Pegue o VO do `roteiro.md`, uma frase curta por bloco.
2. Tempos iniciais pela tabela de cenas; depois ajuste ouvindo o áudio.
3. Estimativa sem áudio: duração ≈ caracteres / 15 s (mínimo 1 s).
4. Rode o validador e corrija os erros.

## Sincronizar
- Atrasar/adiantar tudo (ex.: +0,5 s) com ffmpeg:
  `ffmpeg -itsoffset 0.5 -i legenda.srt -c copy legenda_+0.5.srt`
- Converter para WebVTT (sites/players HTML): `ffmpeg -i legenda.srt legenda.vtt`
- Extrair legenda suave de um MP4: `ffmpeg -i video.mp4 -map 0:s:0 legenda.srt`

## Queimar ou anexar
Ver skill `cortes-ffmpeg`, seção 4 (queimada para reels; suave `mov_text` para MP4/YouTube —
no YouTube prefira subir o .srt separado).

## Checklist
- [ ] Validador sem erros
- [ ] Texto bate com a fala (revisor confere ortografia)
- [ ] Nomes próprios e marcas grafados certo
- [ ] Nenhum bloco cobre texto importante da tela
