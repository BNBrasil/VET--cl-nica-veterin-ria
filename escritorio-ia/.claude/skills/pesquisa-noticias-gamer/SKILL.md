---
name: pesquisa-noticias-gamer
description: Use para levantar a pauta do canal gamer - rodar node producao/fontes.js, ler o fontes-<data>.json, conferir cada notícia em 2 fontes (ou 1 oficial), separar fato de rumor, escolher a pauta do dia e montar o pauta.json com fontes e imagens com direito de uso. Acione no pesquisador e sempre que pedirem notícias, promoções, jogos grátis ou novidades de GTA.
---

# Pesquisa de notícias gamer

## 1. Coletar
```bash
node producao/fontes.js --tema tudo          # ou gta | promocoes | lancamentos
# atrás de proxy (HTTPS_PROXY definido): NODE_USE_ENV_PROXY=1 node producao/fontes.js ...
```
Grava `producao/trabalho/fontes-<aaaa-mm-dd>.json` e imprime um resumo. As fontes ficam em
`producao/fontes.json` (edite lá para ligar/desligar fontes, termos de busca e domínios oficiais).
Se uma fonte falhar, ela aparece em `erros` e o resto segue; só repita se faltar o tipo de que precisa.

## 2. Ler o JSON
| Campo | O que tem | Use para |
|---|---|---|
| `promocoes[]` | Steam: `nome, de, por, desconto, terminaEm, horasRestantes, url, imagem, credito, oficial:true` | top 5 / promoção única |
| `gratis[]` | Epic: `nome, estado (ativo/proximo), inicio, terminaEm, precoOriginal, freeToPlay, url, imagem` | "jogo grátis" |
| `lancamentos[]` | Steam `new_releases`/`coming_soon` (`estado: novo/em-breve`) | "saiu agora" (precisa de notícia para ter contexto) |
| `noticias[]` | `titulo, descricao, url, fonte, viaFeed, oficial, publicadoEm, rumor, palavrasRumor, temas, tambemEm, imagem, imagemUsoLivre:false` | GTA, lançamentos, notícias |

## 3. Conferir (regra das 2 fontes)
Para cada notícia candidata:
1. **Oficial** (`oficial: true`, ou você achou o post no site da publisher/loja) → fato confirmado.
2. Senão, precisa de **2 veículos independentes** dizendo o mesmo (`tambemEm` ajuda; senão procure
   com WebSearch/WebFetch pelo título). Dois sites citando o mesmo insider = **1 fonte** (rumor).
3. `rumor: true` ou origem anônima ("insider", "segundo fontes") → **rumor**, mesmo com 10 sites.
4. Datas e preços: sempre os da loja (`promocoes`/`gratis`), nunca os de matéria.
5. Anote numa tabela fato x rumor:

| Afirmação | Tipo | Fontes (url) | Oficial? |
|---|---|---|---|
| "Atualização X chega dia 3" | fato | rockstargames.com/newswire/…, ign | sim |
| "DLC de Liberty City em 2027" | rumor | insider via site Y | não |

## 4. Escolher a pauta do dia (prioridade)
1. Fato oficial novo de GTA/Rockstar (nas últimas 24 h).
2. Jogo grátis da Epic que entrou hoje (quinta, 13h de Brasília) — sempre rende.
3. Promoção forte: desconto ≥ 70% em jogo conhecido, ou top 5 em evento (Black Friday, Steam Sale).
4. Lançamento grande do dia (com notícia que dê contexto).
5. Rumor muito comentado — só rotulado e sabendo que vai para aprovação (crítico).
Evite repetir o mesmo assunto/formato do vídeo anterior (veja `producao/saida/*/post.json`).
Vários vídeos no mesmo dia = um pauta.json por assunto (cada um é uma frente em paralelo).

## 5. Montar o pauta.json (com o roteirista)
Schema no `producao/CONTRATO.md` §1. Salve em `producao/trabalho/pauta-<id>.json`, com
`id = <aaaa-mm-dd>-<slug>` (minúsculas, sem acento, `[a-z0-9-]`).
- `tipo`: `noticia` | `promocao` | `lancamento`.
- `fontes`: todas as URLs usadas, com `oficial` correto (é isso que a fila usa na regra 1 e 2).
- `imagem` de cena: **só** `imagem` de `promocoes`/`gratis`/`lancamentos` (`imagemUsoLivre: true`) ou
  kit de imprensa oficial; preencha `credito` (ex.: `"Steam (capa da loja)"`). Imagem de notícia
  (`imagemUsoLivre: false`) **nunca** vai para o vídeo: deixe `imagem: null` (fundo gerado).
- Cena `lista` para promoções: `itens: [{ nome, de, por, desconto: "-75%" }]` (máx. 5).
- Rumor: a fala e o `texto` da cena dizem "rumor"/"não confirmado".

Exemplo mínimo (jogo grátis):
```json
{
  "id": "2026-11-26-epic-gratis-bread-and-fred",
  "titulo": "Bread and Fred de graça na Epic",
  "tipo": "promocao",
  "voz": { "modelo": "pt_BR-faber-medium", "velocidade": 1.0 },
  "cenas": [
    { "tipo": "gancho", "fala": "Esse jogo de quarenta reais tá de graça agora na Epic.", "texto": "GRÁTIS NA EPIC", "imagem": null },
    { "tipo": "imagem", "fala": "Bread and Fred, cooperativo de escalada, sai de graça até três de dezembro.", "texto": "ATÉ 03/12", "imagem": "https://cdn1.epicgames.com/...jpg", "credito": "Epic Games Store (capa da loja)" },
    { "tipo": "fim", "fala": "Segue pra não perder o próximo!", "texto": "SIGA O CANAL" }
  ],
  "fontes": [{ "titulo": "Epic Games Store - jogos grátis", "url": "https://store.epicgames.com/pt-BR/p/bread-and-fred-1db362", "oficial": true }],
  "post": { "legenda": "Jogo de R$ 39,99 de graça na Epic até 03/12 🎮 Fonte: Epic Games Store", "hashtags": ["#jogosgratis", "#epicgames", "#gamer"] }
}
```

## 6. Devolver
Lista de pautas com: assunto, tipo, fato/rumor, fontes, caminho do pauta.json e se tende a ser
crítico (regras em `criterios-criticos`).
