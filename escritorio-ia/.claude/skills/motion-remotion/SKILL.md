---
name: motion-remotion
description: Use para motion graphics em código com Remotion (React) - vinhetas, aberturas, lower thirds, textos animados, cenas a partir da tabela de cenas do roteiro, nas versões 9:16 e 16:9. Inclui esqueleto de projeto pronto (template/), padrões de animação (interpolate, spring, Sequence) e comandos de preview e render.
---

# Motion com Remotion

Esqueleto pronto em [`template/`](template/): copie para a pasta do projeto e instale.
```bash
cp -r .claude/skills/motion-remotion/template entregas/<projeto>/anim/remotion
cd entregas/<projeto>/anim/remotion
npm install                     # remotion, @remotion/cli, react, react-dom
npx remotion studio             # preview no navegador (http://localhost:3000)
npx remotion render Vinheta9x16 out/vinheta_9x16.mp4 --codec h264 --crf 18
npx remotion render Vinheta16x9 out/vinheta_16x9.mp4 --codec h264 --crf 18
npx remotion still Vinheta9x16 out/thumb.png --frame 45   # quadro estático (thumbnail)
```
Requisitos: Node ≥ 18. O Remotion baixa um Chrome Headless no primeiro render (precisa de rede).
Template testado com `remotion`/`@remotion/cli` 4.0.242 (still + render H.264 1920x1080 30 fps). Todos os pacotes `remotion*`
precisam ter **a mesma versão**.

## Estrutura do template
```
template/
  package.json
  remotion.config.ts        # formato de imagem, codec padrão
  src/index.ts              # registerRoot(Root)
  src/Root.tsx              # <Composition> 9x16 e 16x9 (mesma cena, props diferentes)
  src/Vinheta.tsx           # cena exemplo: fundo, título com spring, subtítulo com fade, logo
```

## Conceitos (o mínimo)
- Tudo é função do quadro: `const frame = useCurrentFrame(); const { fps, width, height } = useVideoConfig();`
- Tempo em segundos → quadros: `Math.round(seg * fps)`; 30 fps padrão (ver `padrao-export`).
- `interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' })` para fade/posição.
- `spring({ frame, fps, config: { damping: 200 } })` para entrada com elástico suave.
- `<Sequence from={30} durationInFrames={60}>` posiciona um bloco na linha do tempo.
- `<AbsoluteFill>` = camada de tela cheia. `<Img src={staticFile('logo.png')} />` lê de `public/`.
- `<Audio src={staticFile('trilha.mp3')} volume={0.3} />` para trilha.
- **Nada de `Math.random()` ou `Date.now()`**: o render é paralelo; use `random('seed')` do remotion.

## Da tabela de cenas para composições
| Tabela do roteiro | Remotion |
|---|---|
| In–Out `00:00–00:03` | `<Sequence from={0} durationInFrames={90}>` |
| Texto na tela | prop `titulo` da cena |
| 9:16 e 16:9 | duas `<Composition>` com `width/height` diferentes e layout responsivo (`width < height`) |

## Regras
- Área segura 9:16: texto entre y = 250 e y = 1580 (1920 − 340).
- Fontes: carregue com `@remotion/google-fonts` ou `staticFile` + `@font-face`; nunca dependa de fonte do sistema.
- Cores da marca do cliente (skill `identidade-visual`); para peças do escritório, `paleta-escritorio`.
- Vinheta: 2–4 s; lower third: entra em 0,4 s, fica 3–4 s, sai em 0,3 s.
- Entregue render + fonte + comando no `anim.md`. Não versione `node_modules/` nem `out/` em git.

## Problemas comuns
- Render trava baixando Chrome → rede bloqueada; use `--browser-executable=/caminho/do/chrome`.
- `Version mismatch` → alinhe versões de todos os pacotes `remotion` e `@remotion/*`.
- Texto pulando → use `fontFamily` carregada e `delayRender` até a fonte carregar (o pacote google-fonts já faz).
