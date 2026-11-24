---
name: estrutura-roteiro
description: Use para escrever qualquer roteiro de vídeo (reels, shorts, YouTube, vinheta, vídeo institucional) - estrutura gancho/contexto/desenvolvimento/CTA, tempo por cena, tabela de cenas para o animador e o editor, e contagem de palavras por duração.
---

# Estrutura de roteiro

Template pronto: [`template-roteiro.md`](template-roteiro.md) (copie para `entregas/<projeto>/roteiro/roteiro.md`).

## Estrutura padrão (vídeo curto, 15–60 s)
| Bloco | Tempo (30 s) | Função |
|---|---|---|
| Gancho | 0–3 s | parar o scroll (skill `ganchos-reels`) |
| Contexto | 3–8 s | por que isso importa para quem assiste |
| Desenvolvimento | 8–25 s | 1 ideia por cena, 2–4 cenas |
| Virada/prova | 25–27 s | resultado, exemplo, número |
| CTA | 27–30 s | uma ação só (seguir, comentar, link) |

Vídeo longo (16:9, 3–10 min): gancho (0–15 s) → promessa → capítulos de 1–2 min → recapitulação → CTA.

## Duração × palavras (PT-BR, fala natural ≈ 2,5 palavras/s)
| Duração | Palavras faladas |
|---|---|
| 15 s | 30–38 |
| 30 s | 65–75 |
| 60 s | 130–150 |
| 90 s | 200–225 |

Conte com `wc -w` (quem tiver Bash) ou estime ~5 palavras por linha curta.

## Tabela de cenas (obrigatória — é o que o animador e o editor usam)
| # | In–Out | Fala (VO) | Texto na tela | Visual | Quem faz |
|---|---|---|---|---|---|
| 1 | 00:00–00:03 | "Você ainda edita vídeo na mão?" | EDITA NA MÃO? | close + zoom rápido | editor |
| 2 | 00:03–00:06 | — | logo | vinheta 3 s | animador |

Regras da tabela:
- Tempos em `mm:ss` contínuos, sem buracos.
- "Texto na tela" ≤ 6 palavras; vira legenda grande.
- "Quem faz": `animador` (motion/vinheta), `editor` (bruto/corte), `designer` (arte estática).

## Boas práticas
- Frases curtas (≤ 12 palavras) → legendas quebram bem (≤ 42 caracteres por linha).
- Verbo no começo, voz ativa, "você".
- Uma ideia por cena; corte quando a ideia muda.
- Feche com CTA único e concreto.
