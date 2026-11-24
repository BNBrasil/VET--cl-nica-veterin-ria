---
name: ui-mobile
description: Use ao construir ou revisar interfaces que precisam funcionar no celular - sites, landing pages, web apps e a própria tela do escritório - breakpoints, viewport, toque, tipografia fluida, safe areas, desempenho e como testar em larguras de celular. Mobile-first, HTML/CSS sem framework por padrão.
---

# UI mobile

## Base obrigatória
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#1b1b2a">
```
```css
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; font: 16px/1.5 system-ui, sans-serif; }
img, video, canvas, svg { max-width: 100%; height: auto; }
:root { --gutter: 16px; }
.container { padding-inline: max(var(--gutter), env(safe-area-inset-left)) max(var(--gutter), env(safe-area-inset-right)); }
```

## Mobile-first
- Escreva o CSS para **360 px** e amplie com `@media (min-width: 640px)`, `(min-width: 1024px)`.
- Layout com `flex`/`grid` e `gap`; nada de largura fixa em px maior que 320.
- Sem rolagem horizontal: teste com `document.documentElement.scrollWidth > innerWidth`.
- Tipografia fluida: `font-size: clamp(1.75rem, 1.2rem + 3vw, 3rem);` para títulos.
- Altura de tela cheia: `min-height: 100dvh` (não `100vh`, que quebra com a barra do navegador).

## Toque
- Alvos ≥ **44x44 px**, espaço ≥ 8 px entre eles.
- Nada que dependa de `:hover`; use `@media (hover: hover)` para efeitos de mouse.
- `input` com `font-size ≥ 16px` (evita zoom no iOS) e `type`/`inputmode`/`autocomplete` certos
  (`type="tel"`, `inputmode="numeric"`, `autocomplete="email"`).
- Botão principal ao alcance do polegar (parte de baixo) em fluxos longos.

## Desempenho
- Imagens com `loading="lazy"`, `width`/`height` definidos, `srcset` (1x/2x) e WebP/AVIF.
- Fontes: no máximo 2 famílias, `font-display: swap`.
- JS só o necessário; sem bibliotecas para o que o CSS faz.
- Meta: LCP < 2,5 s em 4G, CLS < 0,1.

## Acessibilidade
- Contraste AA, foco visível (`:focus-visible`), ordem de tabulação lógica, `alt` em imagens,
  `aria-label` em botões só com ícone, `prefers-reduced-motion` desliga animações não essenciais.

## Tela do escritório no celular
- Canvas em escala inteira (2x em 360 px = mundo de 640 px de largura não cabe → mostre 2 colunas
  de salas com rolagem vertical, ou escala 1x com zoom por toque). Nunca escala fracionária.
- Log de eventos vira gaveta recolhível embaixo.

## Testar
```bash
python3 -m http.server 8080 -d site/     # ou: npx serve site
```
- DevTools → modo dispositivo: 360x800, 390x844, 768x1024, 1280x800.
- Celular real na mesma rede: `http://<ip-da-maquina>:8080` (servidor precisa escutar em 0.0.0.0).
- Lighthouse (Chrome) → Mobile: Performance, Acessibilidade ≥ 90.

## Checklist
- [ ] 360 px sem rolagem horizontal  - [ ] alvos ≥ 44 px  - [ ] inputs ≥ 16 px
- [ ] 100dvh / safe areas  - [ ] imagens com dimensões  - [ ] contraste AA  - [ ] reduced motion
