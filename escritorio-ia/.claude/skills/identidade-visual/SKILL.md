---
name: identidade-visual
description: Use para criar, documentar ou aplicar identidade visual de um cliente ou projeto - paleta com papéis e contraste, par tipográfico, escala de tamanhos, logo simples em SVG, tokens CSS e mini guia de marca (brand.md). Acione quando pedirem identidade, marca, paleta, logo, guia de estilo, ou quando uma peça precisar seguir a marca do cliente.
---

# Identidade visual

Entregáveis: `design/brand.md` (guia curto) + [`tokens.css`](tokens.css) (copie e ajuste) + `logo.svg`.

## 1. Paleta (5–7 cores com papel)
| Papel | Uso | Regra |
|---|---|---|
| `--cor-primaria` | marca, botões principais | contraste ≥ 4,5:1 com o texto em cima |
| `--cor-secundaria` | apoio, destaques | ≠ primária em matiz (≥ 30°) |
| `--cor-acento` | CTA, selos, 5–10% da área | a cor mais saturada |
| `--cor-fundo` / `--cor-superficie` | fundos e cartões | neutros |
| `--cor-texto` / `--cor-texto-suave` | texto | texto em fundo ≥ 4,5:1; suave ≥ 3:1 só em texto grande |
| `--cor-erro`/`--cor-sucesso` | estados | não usar como cor de marca |

Proporção 60/30/10 (fundo/apoio/acento). Gere tons com `color-mix(in oklch, var(--cor-primaria) 80%, white)`.
Contraste: fórmula WCAG; ferramenta rápida → `https://webaim.org/resources/contrastchecker/`.

## 2. Tipografia
- 1 família para títulos + 1 para texto (ou 1 família com pesos). Google Fonts com `display=swap`.
- Pares seguros: Inter + Inter; Poppins + Inter; Playfair Display + Source Sans 3; Space Grotesk + IBM Plex Sans.
- Escala 1,25: 12 · 14 · 16 · 20 · 25 · 31 · 39 · 49 px. Texto corrido 16–18 px, linha 1,5.
- Posts: título 64–120 px em 1080 de largura; nunca menos de 28 px.

## 3. Logo simples (SVG)
- Monograma ou palavra com fonte definida, convertido em SVG com `viewBox` e sem fontes externas
  (texto em `<path>` ou fonte declarada no guia).
- Versões: colorida, monocromática clara, monocromática escura, ícone quadrado (favicon 32/180/512).
- Área de respiro = altura da letra principal; tamanho mínimo 24 px de altura.

## 4. Elementos
Raio de borda (ex.: 12 px), estilo de ícone (traço 2 px ou preenchido), sombra (uma só), padrão
de foto (luz, enquadramento), grafismos (formas da marca).

## Modelo de `brand.md`
```markdown
# Marca — <cliente>
Essência: <3 palavras>   Tom de voz: <ver tom-de-voz>
## Cores
| Papel | Hex | Uso | Contraste c/ branco | c/ preto |
## Tipografia
Títulos: <fonte, pesos>  Texto: <fonte, pesos>  Escala: <...>
## Logo
Versões, respiro, tamanho mínimo, usos proibidos (esticar, mudar cor, sombra)
## Exemplos
Post feed, story, thumbnail (links dos arquivos)
```

## Clínica/negócio local (exemplo de direção)
Cores calmas e confiáveis (azul-petróleo ou verde-sálvia) + acento quente (coral/amarelo) para CTA,
fotos reais de equipe e pacientes, ícones arredondados, linguagem acolhedora.
