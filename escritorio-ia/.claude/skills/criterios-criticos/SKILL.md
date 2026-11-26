---
name: criterios-criticos
description: Use antes de marcar um post do canal gamer como revisado e antes de publicar - as 6 regras do contrato que tornam um post CRÍTICO (espera aprovação do usuário) com exemplos de crítico e não crítico, como registrar com node producao/fila.js revisar e o que nunca fazer. Acione no revisor e no social-media sempre que houver dúvida se algo pode sair sozinho.
---

# Critérios de criticidade (postagem mista)

Postagem mista: **não crítico sai sozinho**; **crítico espera a aprovação do usuário** na página
(aba Produção). Fonte da verdade: `producao/CONTRATO.md`, seção 3.

> As regras abaixo o `producao/fila.js` aplica **sempre**, mesmo que o revisor diga "não crítico", e o
> `postar.js` reaplica na hora de publicar. Mesmo assim, marque você: o seu motivo aparece para o
> usuário e explica a decisão. **Na dúvida, crítico.**

## As 6 regras (qualquer uma → crítico)
| # | Regra | Crítico (exemplo) | Não crítico (exemplo) |
|---|---|---|---|
| 1 | Notícia baseada em **rumor/vazamento** ("rumor", "vazou", "leak", "boato", "suposto", "insider") ou **sem fonte `oficial: true`** | "Insider diz que GTA 6 terá DLC de Liberty City"; notícia só com fonte IGN/Eurogamer sem confirmação oficial | "Rockstar anuncia atualização" com link do Rockstar Newswire (`oficial: true`) |
| 2 | **Preço/promoção sem fonte da própria loja**, ou promoção que **termina em menos de 6 h** | Preço tirado de matéria de site; promoção da Steam que acaba às 15h e são 10h | Top 5 da Steam com `fontes` apontando `store.steampowered.com` e fim em 3 dias |
| 3 | **Assunto sensível**: mortes, crimes reais, política, polêmica com pessoas reais, menores, saúde | "Morre dublador de…"; "GTA 6 citado em debate político"; caso de polícia ligado a jogo | Lançamento de jogo, promoção, trailer oficial |
| 4 | **Imagem sem `credito`** em alguma cena | Cena `imagem` com capa da Steam e `credito` vazio | Toda cena com imagem tem `credito: "Steam (capa da loja)"`; cenas sem imagem usam fundo gerado |
| 5 | **Primeira postagem em uma rede** (ainda não há nenhum `publicado` nela) | O 1º vídeo do canal no Instagram | A partir do 2º post publicado naquela rede |
| 6 | Legenda com **menção/acusação a pessoa ou empresa** | "@rockstargames cadê o GTA no PC?"; "A empresa X enganou os fãs" | "Fonte: Rockstar Games" (crédito neutro, sem @ e sem acusação) |

Observações:
- Rumor bem rotulado ("RUMOR / NÃO CONFIRMADO") **continua crítico**: o rótulo deixa publicável, não automático.
- Fonte oficial = loja (Steam, Epic) ou site da própria publisher/plataforma (Rockstar, Take-Two,
  PlayStation Blog, Xbox Wire, Nintendo). No `fontes-<data>.json` vem como `oficial: true`.
- `imagemUsoLivre: false` (foto de matéria de site de notícia) **não pode** ir para o vídeo, nem com crédito.

## Como registrar
```bash
# não crítico
node producao/fila.js revisar <id>
# crítico (um --motivo por regra que bateu; texto curto, o usuário lê na página)
node producao/fila.js revisar <id> --critico --motivo "rumor: fonte é insider, sem confirmação oficial" --motivo "regra 5: primeiro post no Instagram"
node producao/fila.js ver <id>     # confira estado (revisado | aguardando) e motivos
```
- O id é o da pasta `producao/saida/<id>/` (igual ao `id` do pauta.json).
- Resultado esperado: não crítico → `revisado` (o social-media publica); crítico → `aguardando`
  (aparece balão "?" no social-media e aviso no chat; o usuário aprova ou rejeita na página).

## Nunca
- Nunca use `node producao/fila.js aprovar` para liberar crítico (a CLI recusa, e tentar é falta grave).
- Nunca edite `post.json` à mão para trocar `critico`/`estado` (o postar.js reaplica as regras e a
  aprovação do usuário é assinada e amarrada ao conteúdo; mudar legenda depois invalida a aprovação).
- Nunca "suavize" o texto só para escapar da regra (tirar a palavra "rumor" de um rumor é mentir).
