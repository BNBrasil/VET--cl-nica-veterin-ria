---
name: canal-gamer
description: Use quando o pedido for "produza o boletim gamer", "produza e publique o boletim gamer de agora (fluxo canal-gamer)", vídeo de notícias de jogos, promoções, jogo grátis ou GTA para TikTok/Instagram - o fluxo completo em ondas paralelas (pesquisador, roteirista, locutor, editor-video, revisor, social-media, designer) com os comandos (fontes.js, tts.js, montar.js, fila.js, postar.js) e onde ficam os arquivos. Skill do orquestrador para o canal gamer.
---

# Fluxo do canal gamer (ondas paralelas, ≥ 4 agentes por onda)

Fonte da verdade: `producao/CONTRATO.md` (schemas, comandos, criticidade). Guia do nicho:
`producao/nicho.md`. Regra do escritório: skill `contrato-paralelo` — contrato antes, **4 ou mais
agentes ao mesmo tempo**, várias chamadas Agent **na mesma resposta**, dependente começa com placeholder.

## Onde ficam os arquivos
| Arquivo | Quem escreve | Quem lê |
|---|---|---|
| `entregas/<aaaa-mm-dd>-boletim-gamer/CONTRATO.md` | orquestrador | todos |
| `producao/trabalho/fontes-<data>.json` | pesquisador (`fontes.js`) | pesquisador, roteirista, revisor |
| `producao/trabalho/pesquisa-<data>.md` (fato x rumor, pautas) | pesquisador | roteirista, revisor |
| `producao/trabalho/pauta-<id>.json` (schema §1 do contrato) | roteirista (fecha) + pesquisador (fontes/dados) | locutor, editor, revisor |
| `producao/pronuncia.json` | locutor | tts.js / montar.js |
| `producao/trabalho/capa-<id>.svg` (opcional, fundo/capa do dia; o editor converte para PNG com ffmpeg/rsvg se for usar) | designer | editor (vira `imagem` com `credito: "arte própria"`) |
| `producao/trabalho/post-<id>.txt` (legenda + hashtags por rede) | social-media | roteirista (copia para `post` do pauta) |
| `producao/saida/<id>/` (`video.mp4`, `legenda.srt`, `capa.jpg`, `post.json`) | editor (`montar.js`) | revisor, social-media, fila |

`id` = `<aaaa-mm-dd>-<slug>` (ex.: `2026-11-26-epic-gratis-bread-and-fred`).

## Onda 0 — contrato (orquestrador, rápido)
Escreva `entregas/<data>-boletim-gamer/CONTRATO.md` (modelo em `contrato-paralelo`): quantos vídeos
(padrão: 1 por horário da agenda; em pedido manual, até 3: ex. GTA, promoções, jogo grátis), o `id`
provisório de cada um, donos e arquivos da tabela acima.

## Onda 1 — pesquisa e preparação (5 em paralelo, numa única resposta)
| Agente | Tarefa | Entrega |
|---|---|---|
| `pesquisador` | `node producao/fontes.js --tema tudo`; confere em 2 fontes; fato x rumor; escolhe as pautas e já preenche `fontes`, preços e imagens com direito | `fontes-<data>.json`, `pesquisa-<data>.md`, rascunho `pauta-<id>.json` |
| `roteirista` | a partir de `producao/nicho.md` e dos formatos prováveis (jogo grátis, top 5, GTA), escreve 3 ganchos e a estrutura de cenas de cada formato | estrutura no `pauta-<id>.json` (falas provisórias) |
| `designer` | identidade do dia e capa/fundo 1080x1920 (arte própria, sem imagem de terceiros) | `producao/trabalho/capa-<id>.svg` |
| `social-media` | rascunho de legenda e 3–5 hashtags por rede para cada formato provável | `producao/trabalho/post-<id>.txt` |
| `locutor` | `node producao/instalar-voz.js` (idempotente); adiciona ao `pronuncia.json` os nomes de jogos/empresas que aparecem no fontes do dia | `pronuncia.json` atualizado |

## Onda 2 — fechar e produzir (≥ 4 em paralelo)
| Agente | Tarefa |
|---|---|
| `roteirista` | fecha o `pauta-<id>.json` com os fatos do pesquisador (falas finais, `texto`, `itens`, `post` com a legenda do social-media) |
| `locutor` | gera e confere a narração das falas finais (`node producao/tts.js --help` para opções); corrige pronúncias; confere soma ≤ 60 s |
| `editor-video` | `node producao/montar.js producao/trabalho/pauta-<id>.json` (pode começar com o rascunho e rodar de novo com a versão final) e confere specs com ffprobe |
| `revisor` | pré-revisa fatos e direitos no pauta.json (fontes oficiais, rumor rotulado, imagem com `credito`, preço da loja) |
| `pesquisador` | (se houver 2º/3º vídeo) fecha os fatos dos outros pautas |

Vários vídeos (GTA, promoções, lançamento, jogo grátis): **cada vídeo é uma frente própria**, em
paralelo, com seu próprio `pauta-<id>.json` e sua própria chamada ao `montar.js`.

## Onda 3 — revisão, correção e postagem (≥ 4 em paralelo)
| Agente | Tarefa |
|---|---|
| `revisor` | revisão final de `producao/saida/<id>/` (vídeo, legenda.srt, post.json) + **criticidade**: `node producao/fila.js revisar <id> [--critico --motivo "..."]` |
| `editor-video` | corrige bloqueantes da pré-revisão e roda `montar.js` de novo se preciso |
| `designer` | capa final (`capa.jpg` do montar.js ou versão própria) conferida na área segura |
| `social-media` | legenda final por rede; quando o revisor marcar, publica os não críticos e reporta os críticos |

Depois da revisão (`fila.js ver <id>`):
- `revisado` e não crítico → social-media: `node producao/postar.js <id>` (ensaio: `--simular`).
- `aguardando` (crítico) → **não publica**: o usuário aprova na página (aba Produção). Avise com os motivos.
- `REPROVADO` pelo revisor → volta só os itens à sala dona (máx. 2 voltas) e revisa de novo.

## Entrega final (orquestrador)
```
## Boletim gamer <data>
Vídeos: <id> — <título> — <publicado (urls) | aguardando aprovação: motivos | erro: ...>
Fontes usadas: <lista curta, oficial sim/não>
Arquivos: producao/saida/<id>/ ...
Pendências: <...>
```

## Regras que não mudam
- Imagem no vídeo só de loja (Steam/Epic), kit de imprensa oficial ou arte própria, sempre com `credito`.
- Rumor só rotulado e sempre crítico. Preço/data sempre da loja.
- Ninguém aprova crítico além do usuário; ninguém edita `post.json` à mão.
- Agenda automática manda: "Produza e publique o boletim gamer de agora (fluxo canal-gamer)" — siga
  este fluxo inteiro, com 1 vídeo, sem perguntar nada ao usuário (as suposições vão no contrato).
