---
name: templates-posts
description: Use para produzir posts, carrosséis, stories, capas e thumbnails para redes sociais em SVG ou HTML/CSS - tamanhos por plataforma, áreas seguras, hierarquia de texto, templates prontos (post.html, post.svg) e comandos para exportar PNG. Acione quando pedirem post, carrossel, story, capa, banner ou thumbnail estática.
---

# Templates de posts

Templates: [`post.html`](post.html) (HTML/CSS, 1080x1350) e [`post.svg`](post.svg) (SVG, 1080x1350).

## Tamanhos
| Peça | Tamanho (px) | Proporção | Área segura |
|---|---|---|---|
| Post feed Instagram (padrão) | 1080x1350 | 4:5 | margem 64 px; grade de perfil corta para 3:4 central |
| Post quadrado | 1080x1080 | 1:1 | margem 64 px |
| Story / Reels capa / TikTok | 1080x1920 | 9:16 | sem texto nos 250 px de cima e 340 px de baixo |
| Thumbnail YouTube | 1280x720 | 16:9 | canto inferior direito tem a duração: deixe livre |
| LinkedIn / Open Graph | 1200x630 | 1,91:1 | texto central |
| Carrossel | 1080x1350 cada | 4:5 | mesmo fundo/grade em todos; seta/“arraste” no 1º |

## Hierarquia (regra 3 níveis)
1. **Título**: ≤ 7 palavras, 72–120 px, peso 700–800.
2. **Apoio**: 1–2 linhas, 32–40 px.
3. **Marca/CTA**: logo ou @perfil, 24–28 px.
Máximo ~20% da área com texto em anúncios. Uma ideia por slide no carrossel; último slide = CTA.

## Thumbnail
Rosto/objeto grande + 2–4 palavras gigantes (≥ 120 px em 1280) + contraste forte; teste em 160 px de largura (tamanho real na lista).

## Exportar PNG
SVG (o comando ffmpeg foi testado; precisa de ffmpeg compilado com librsvg):
```bash
rsvg-convert -w 1080 -h 1350 post.svg -o post.png
# ou, sem rsvg-convert:
ffmpeg -n -i post.svg -frames:v 1 post.png
```
HTML (Chrome/Chromium headless):
```bash
google-chrome --headless --disable-gpu --hide-scrollbars --window-size=1080,1350 --screenshot="$PWD/post.png" "file://$PWD/post.html"
# (testado; troque por chromium/chromium-browser conforme o sistema; como root/contêiner acrescente --no-sandbox)
# ou com Playwright: npx playwright screenshot --viewport-size=1080,1350 "file://$PWD/post.html" post.png
```
Carrossel em HTML: um arquivo por slide (`slide-01.html` …) ou `?slide=N` no mesmo template.
JPG para envio: `ffmpeg -i post.png -q:v 2 post.jpg`.

## Nomes
`<slug>_<peca>_<NN>.png` → `promo-vacina_feed_01.png`, `promo-vacina_story_01.png`, `promo-vacina_thumb.png`.

## Checklist
- [ ] Tamanho exato  - [ ] área segura  - [ ] contraste AA  - [ ] texto revisado (revisor)
- [ ] fontes embutidas/carregadas antes do screenshot  - [ ] marca/@perfil presente  - [ ] PNG exportado
