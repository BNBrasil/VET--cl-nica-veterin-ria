---
name: postagem-redes
description: Use para escrever a legenda e as hashtags dos vídeos do canal gamer por rede (TikTok e Instagram) e para publicar pela fila - node producao/fila.js (listar, ver, revisar) e node producao/postar.js <id> [--redes] [--simular], estados do post.json e o que fazer em erro. Acione no social-media e sempre que for postar ou agendar.
---

# Postagem nas redes (TikTok + Instagram)

Contrato: `producao/CONTRATO.md` §2–§4. Cada vídeo pronto fica em `producao/saida/<id>/` com
`video.mp4`, `legenda.srt`, `capa.jpg` e `post.json` (estado, legenda, hashtags, fontes, criticidade).

## 1. Legenda do post
Estrutura (as 2 redes):
```
<linha 1 = gancho, ≤ 80 caracteres, sem hashtag>
<linha 2 = o fato: preço de/por, data "até 03/12", plataforma>
Fonte: <loja ou publisher>            ← neutro, sem @ e sem acusação (regra 6)
<CTA curta: "Salva pra não esquecer" / "Manda pra quem joga com você">
#tag1 #tag2 #tag3 (#tag4 #tag5)
```
| | TikTok | Instagram |
|---|---|---|
| Tamanho | curto: ~150 caracteres antes das hashtags | pode ser mais longo, mas a 1ª linha decide |
| Hashtags | 3–5 (limite 5) | 3–5 (limite 5) |
| CTA que funciona | "comenta qual você vai pegar" | "manda pra um amigo" (compartilhamento pesa) |
| Evitar | link na legenda (não clica) | "link na bio" sem ter link na bio |

Hashtags por tema: ver skill `nicho-gamer`. Sem acento, minúsculas, específicas + 1–2 amplas.
Nunca: promessa falsa ("GTA 6 GRÁTIS"), pedir curtida em troca de prêmio, @ de pessoa/empresa
(vira crítico), emoji em excesso (máx. 2).

A legenda/hashtags vêm do `post` do pauta.json e o `montar.js` copia para o `post.json`. Para ajustar
por rede, devolva o texto ao orquestrador/roteirista; não edite `post.json` à mão depois da revisão
(muda o conteúdo e invalida a aprovação do usuário).

## 2. Fila e publicação
```bash
node producao/fila.js listar                     # todos os posts e estados
node producao/fila.js ver <id>                   # detalhes, critico, motivos
node producao/fila.js revisar <id> [--critico] [--motivo "..."]   # normalmente feito pelo revisor
node producao/postar.js <id> --simular           # ensaio: tudo menos a chamada final
node producao/postar.js <id>                     # publica nas redes configuradas
node producao/postar.js <id> --redes tiktok      # só uma rede
```
Estados: `pronto → revisado → aprovado | aguardando → publicando → publicado | erro | rejeitado`
(+ `simulado` com `--simular`).

Decisão do social-media (aplique `criterios-criticos`):
| Estado em `fila.js ver` | Ação |
|---|---|
| `pronto` | não publique: peça a revisão (revisor) |
| `revisado`, `critico: false` | `postar.js <id>` |
| `aguardando` (crítico) | **não publique**; avise o orquestrador: "aguardando aprovação do usuário na página (aba Produção)" com os motivos |
| `aprovado` (pelo usuário) | `postar.js <id>` |
| `rejeitado` | não publique; reporte o motivo |
| `erro` | leia `post.json.redes.<rede>.erro`; erro de token/conta → avise o usuário (Configurar → Redes); erro temporário → tente 1 vez de novo |
| `publicado` | reporte `redes.<rede>.url` |

Se o `postar.js` recusar ("crítico sem aprovação"), isso é o comportamento correto: não tente contornar.

## 3. Particularidades
- **TikTok**: modo `direct` só publica público com app auditado (sem auditoria sai privado); modo
  `rascunho` manda para a caixa de entrada do app para o usuário finalizar. Reporte qual modo saiu.
- **Instagram**: Reels via Graph API (conta Profissional ligada a Página do Facebook), upload resumable.
- Tokens ficam em `data/segredos.json` (nunca leia, copie ou mostre o conteúdo).
- Primeira postagem em cada rede é sempre crítica (regra 5): avise o usuário que ela espera aprovação.
